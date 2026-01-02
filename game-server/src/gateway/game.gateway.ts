import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { AgonesService } from '../agones/agones.service';

import { GameEngineService } from '../engine/game-engine.service';
import { RankingService } from '../ranking/ranking.service';
import { PlayerService } from 'src/engine/player/player.service';
import { GhostManagerService } from 'src/engine/ghost/ghost-manager.service';
import { BotManagerService } from 'src/engine/bot/bot-manager.service';
import { CollisionService } from 'src/engine/core/collision.service';
import { LifecycleService } from 'src/engine/core/lifecycle.service';
import { GameLoopService } from 'src/engine/core/game-loop.service';
import { BossManagerService } from '../boss/boss-manager.service';
import * as jwt from 'jsonwebtoken';

interface RoomWrapper {
  engine: GameEngineService;
  users: string[];
  finished?: boolean;
  countdownStarted?: boolean;
}

type GameMode = 'NORMAL' | 'BOSS';

@WebSocketGateway({
  namespace: '/game',
  path: '/socket.io',
  cors: { origin: '*' },
  // transports 제거하여 polling과 websocket 모두 허용
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // roomId → GameEngineService instance
  private rooms: Record<string, RoomWrapper> = {};

  constructor(
    private rankingService: RankingService,
    private ghostManagerService: GhostManagerService,
    private playerService: PlayerService,
    private botManagerService: BotManagerService,
    private collisionService: CollisionService,
    private lifecycleService: LifecycleService,
    private gameLoopService: GameLoopService,
    private bossManagerService: BossManagerService,
    private agonesService: AgonesService,
  ) {}

	private verifyMatchToken(token: string): { userIds: string[]; roomId: string; nickname?: string; mode?: 'NORMAL' | 'BOSS'; maxPlayers?: number; userNicknames?: Record<string, string> } {
		const secret = process.env.MATCH_TOKEN_SECRET || 'match-token-secret';

		const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

		const userIds = decoded?.userIds as string[] | undefined;
		const roomId = decoded?.roomId as string | undefined;

		if (!userIds || !roomId) {
			throw new Error('INVALID_MATCH_TOKEN_PAYLOAD');
		}

		return {
			userIds,
			roomId,
			mode: decoded.mode as 'NORMAL' | 'BOSS' | undefined,
      maxPlayers: decoded.maxPlayers as number | undefined,
      userNicknames: decoded.userNicknames as Record<string, string> | undefined,
		};
	}


  afterInit(server: Server) {
    this.lifecycleService.roomManager = this;

    // namespace gateway일 때도 안전하게 미들웨어를 붙이기
    const nsp: any =
      (this.server as any).use ? this.server : (this.server as any).of?.('/game');

    if (!nsp?.use) {
      this.logger.warn('socket middleware(use)를 붙일 수 없습니다.');
      return;
    }

    // 1) 연결 단계에서 matchToken 검증
    nsp.use((socket: Socket, next: (err?: any) => void) => {
      const token = socket.handshake.auth?.matchToken;
      this.logger.log(`[Middleware] Connection attempt, token exists: ${!!token}`);

      if (!token) {
        this.logger.warn('[Middleware] NO_MATCH_TOKEN - rejecting connection');
        return next(new Error('NO_MATCH_TOKEN'));
      }

      try {
        const payload = this.verifyMatchToken(token);
        this.logger.log(`[Middleware] Token verified for userIds=${payload.userIds.join(',')}, roomId=${payload.roomId}`);

        socket.data.userIds = payload.userIds;
        socket.data.roomId = payload.roomId;

        if (payload.userNicknames) socket.data.userNicknames = payload.userNicknames;
        if (payload.mode) socket.data.mode = payload.mode as GameMode;
        if (payload.maxPlayers) socket.data.maxPlayers = payload.maxPlayers;

        return next();
      } catch (err) {
        this.logger.error(`[Middleware] INVALID_MATCH_TOKEN: ${err.message}`);
        return next(new Error('INVALID_MATCH_TOKEN'));
      }
    });

    this.logger.log('GameGateway socket middleware ready');
  }

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connected socketId=${client.id} userIds=${client.data?.userIds.join(',')} roomId=${client.data?.roomId}`,
    );
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected socketId=${client.id} userId=${client.data?.userId} roomId=${client.data?.roomId}`,
    );

    const roomId = client.data.roomId as string | undefined;
    if (roomId) {
      const roomWrapper = this.rooms[roomId];
      if (roomWrapper) {
        const room = roomWrapper.engine;
        room.removePlayer(client.id);
        client.leave(roomId);

        this.logger.log(`Room ${roomId} human players left: ${room.playerCount()}`);

        // 만약 방에 사람이 없고 아직 정리가 안 된 경우 간단 정리
        if (room.playerCount() === 0 && !roomWrapper.finished) {
          this.logger.log(`Room ${roomId} is now empty. Stopping interval.`);
          roomWrapper.finished = true;
          room.stopInterval();
          // delete this.rooms[roomId]; // LifecycleService에서 지우므로 여기선 굳이 안 지워도 됨
        }
        
        // 남아있는 플레이어들에게 상태 전송 (방이 떠 있는 경우만)
        if (this.rooms[roomId]) {
          this.server.to(roomId).emit('state', room.getState());
        }
      }
    }

    // 어떤 유저가 나가든 항상 전체 서버 인원 체크
    await this.checkPodShutdown();
  }

  private async checkPodShutdown() {
    const connectedSockets = await this.server.fetchSockets();
    const count = connectedSockets.length;
    this.logger.log(`[PodShutdownCheck] 현재 연결된 총 소켓 수: ${count}`);

    if (count === 0) {
      this.logger.warn('[PodShutdownCheck] 서버에 더 이상 연결된 유저가 없습니다. Agones Shutdown 호출');
      await this.agonesService.shutdown();
    }
  }
  // HTTP에서 강퇴/나가기 처리할 때 사용
  handleHttpLeave(userId: string) {
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data?.userId === userId) {
        this.logger.log(`HTTP leave -> socket disconnect userId=${userId}`);
        socket.disconnect(true);
        return;
      }
    }
    this.logger.warn(`HTTP leave requested but no socket userId=${userId}`);
  }

  // 방 조회
  getRoom(roomId: string): GameEngineService | undefined {
    return this.rooms[roomId]?.engine;
  }

  // 방 삭제
  removeRoom(roomId: string) {
    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;

    room.stopInterval();

    this.ghostManagerService.clearRoom(roomId);
    this.playerService.clearRoom(roomId);
    this.botManagerService.resetBots(roomId);

    this.server.in(roomId).disconnectSockets();

    delete this.rooms[roomId];
    this.logger.log(`Room ${roomId} removed from GameGateway.`);

    this.checkPodShutdown();
  }

  // 내부: 방 엔진 생성
   ensureRoom(roomId: string, mode: GameMode): RoomWrapper {
    if (this.rooms[roomId]) return this.rooms[roomId];

    const engine = new GameEngineService(
      this.ghostManagerService,
      this.playerService,
      this.botManagerService,
      this.collisionService,
      this.lifecycleService,
      this.gameLoopService,
      this.bossManagerService,
    );

    engine.roomId = roomId;
    engine.roomManager = this;

    if (mode === 'BOSS') {
      engine.setMode('BOSS');
    }

    this.lifecycleService.initialize(roomId);

    if (mode === 'BOSS') {
      this.bossManagerService.spawnBoss(roomId, { x: 200, y: 200 });
      engine.startBossMode();
    }

    this.rooms[roomId] = { engine, users: [] };
    this.logger.log(`room created roomId=${roomId} mode=${mode}`);

    return this.rooms[roomId];
  }

  // ============================
  // 1) 클라이언트 방 입장
  // ============================
  // 클라이언트는 roomId만 보내는 걸 권장
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, data: { roomId?: string; nickname?: string; mode?: GameMode; userId?: string }) {
    // 토큰에서 내려온 값이 기준
    const tokenRoomId = client.data.roomId as string | undefined;
    const tokenUserIds = client.data.userIds as string[] | undefined;

    // userId는 클라이언트가 보내거나 쿼리에서 가져옴
    const userId = data?.userId || (client.handshake.query?.userId as string | undefined);

    if (!tokenRoomId || !tokenUserIds) {
      this.logger.warn('join-room: token data missing');
      client.disconnect();
      return;
    }

    // userId가 토큰의 userIds에 포함되어야 함
    if (!userId || !tokenUserIds.includes(userId)) {
      this.logger.warn(`join-room: userId=${userId} not in token userIds=${tokenUserIds.join(',')}`);
      client.disconnect();
      return;
    }

    // 클라가 roomId를 보내면, 토큰과 일치해야 함
    if (data?.roomId && data.roomId !== tokenRoomId) {
      this.logger.warn(
        `join-room roomId mismatch token=${tokenRoomId} client=${data.roomId}`,
      );
      client.disconnect();
      return;
    }

    const roomId = tokenRoomId;

    // nickname/mode도 가능하면 토큰 기준
    const userNicknames = client.data.userNicknames as Record<string, string> | undefined;
    const nickname =
      userNicknames?.[userId] ??
      (client.data.nickname as string | undefined) ??
      data?.nickname ??
      `user-${String(userId).slice(-6)}`;

    const mode =
      (client.data.mode as GameMode | undefined) ??
      data?.mode ??
      'NORMAL';

    const maxPlayers = (client.data.maxPlayers as number | undefined) ?? 5;

    const isNewRoom = !this.rooms[roomId];
    const roomWrapper = this.ensureRoom(roomId, mode);
    const room = roomWrapper.engine;

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;
    client.data.userId = userId;

    // 접속한 유저 기록(최소한)
    if (!roomWrapper.users.includes(userId)) {
      roomWrapper.users.push(userId);
    }

    room.addPlayer(client.id, userId, nickname);

    // [New] 봇 자동 추가 로직 (Agones 흐름 복구)
    // 방이 처음 생성되었고, 토큰 등으로 전달받은 예상 유저수보다 부족한 경우 봇으로 채움
    if (isNewRoom && !room.isBossMode()) {
      const playersInToken = tokenUserIds.length;
      const botsToAdd = Math.max(0, maxPlayers - playersInToken);
      
      this.logger.log(`[Agones Flow] Initializing room. roomId: ${roomId}, botsToAdd: ${botsToAdd}, maxPlayers: ${maxPlayers}, Players: ${playersInToken}`);
      
      for (let i = 0; i < botsToAdd; i++) {
        room.addBotPlayer(); // BotManager에서 내부적으로 번호 매김
      }
    }

    // init-game 전송
    client.emit('init-game', {
      playerId: client.id,
      roomId,
      mapData: room.getMapData(),
      initialState: room.getState(),
    });

    // 전체 상태 전파
    this.server.to(roomId).emit('state', room.getState());

    // 시작 조건
    const humanPlayers = room.playerCount();
    const botPlayers = room.getBotCount();
    const totalPlayers = humanPlayers + botPlayers;

    if (room.isBossMode()) {
      if (!room.intervalRunning) {
        room.startBossMode();
      }
    } else {
      // maxPlayers(봇 포함 5명)가 모이면 카운트다운 시작
      if (totalPlayers >= maxPlayers && !roomWrapper.countdownStarted) {
        roomWrapper.countdownStarted = true;
        this.startCountdown(roomId);
      }
    }
  }

  private startCountdown(roomId: string) {
    this.logger.log(`[Countdown] Starting for room ${roomId}`);
    let count = 3;

    const interval = setInterval(() => {
      this.server.to(roomId).emit('countdown', { count });
      count--;

      if (count < 0) {
        clearInterval(interval);
        this.server.to(roomId).emit('countdown', { count: 0 });
        this.startGameLoop(roomId);
      }
    }, 1000);
  }

  private startGameLoop(roomId: string) {
    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;
    if (room.intervalRunning) return;

    room.intervalRunning = true;

    room.interval = setInterval(async () => {
      room.update();
      this.server.to(roomId).emit('state', room.getState());

      if (this.lifecycleService.isGameOver(roomId)) {
        if (roomWrapper.finished) return;
        roomWrapper.finished = true;

        const userIds = Array.from(new Set(roomWrapper.users));

        // await this.notifyGameFinished(roomId, userIds);

        room.stopInterval();
        delete this.rooms[roomId];
      }
    }, 1000 / 30);
  }


  // ============================
  // 2) 이동 입력
  // ============================
  @SubscribeMessage('input')
  handleInput(client: Socket, data: { dir: { dx: number; dy: number } }) {
    const roomId = client.data.roomId as string | undefined;
    if (!roomId) return;

    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    roomWrapper.engine.handleInput(client.id, data.dir);
  }

  // ============================
  // 3) 리셋(옵션)
  // ============================
  @SubscribeMessage('reset')
  handleReset(client: Socket, data: { roomId: string }) {
    const roomId = data.roomId;
    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;

    room.resetGame();
    this.startCountdown(roomId);
    this.server.to(roomId).emit('state', room.getState());
  }

  // ============================
  // matching 서버로 종료 알림
  // ============================
  /*
  private async notifyGameFinished(roomId: string, userIds: string[]) {
    if (!roomId || !userIds || userIds.length === 0) {
      this.logger.warn('game-finished: invalid payload');
      return;
    }

    const url =
      process.env.MATCHING_INTERNAL_URL ||
      'http://matching:3000/internal/game-finished';
      

    try {
      await axios.post(
        url,
        { roomId, userIds },
        { timeout: 3000 },
      );
      this.logger.log(
        `🏁 game-finished notified roomId=${roomId} users=${userIds.join(',')}`,
      );
    } catch (err) {
      this.logger.error('game-finished notify failed', err as any);
    }
  }
  */
}
