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
}

type GameMode = 'NORMAL' | 'BOSS';

@WebSocketGateway({
  namespace: '/game',
  path: '/socket.io',
  cors: { origin: '*' },
  transports: ['websocket'],
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
  ) {}

	private verifyMatchToken(token: string): { userId: string; roomId: string; nickname?: string; mode?: 'NORMAL' | 'BOSS' } {
		const secret = process.env.MATCH_TOKEN_SECRET || 'match-token-secret';

		const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

		const userId = decoded?.userId as string | undefined;
		const roomId = decoded?.roomId as string | undefined;

		if (!userId || !roomId) {
			throw new Error('INVALID_MATCH_TOKEN_PAYLOAD');
		}

		return {
			userId,
			roomId,
			nickname: decoded.nickname as string | undefined,
			mode: decoded.mode as 'NORMAL' | 'BOSS' | undefined,
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

      if (!token) {
        return next(new Error('NO_MATCH_TOKEN'));
      }

      try {
        const payload: any = this.verifyMatchToken(token);

        socket.data.userId = payload.userId;
        socket.data.roomId = payload.roomId;

        if (payload.nickname) socket.data.nickname = payload.nickname;
        if (payload.mode) socket.data.mode = payload.mode as GameMode;

        return next();
      } catch {
        return next(new Error('INVALID_MATCH_TOKEN'));
      }
    });

    this.logger.log('GameGateway socket middleware ready');
  }

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connected socketId=${client.id} userId=${client.data?.userId} roomId=${client.data?.roomId}`,
    );
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected socketId=${client.id} userId=${client.data?.userId} roomId=${client.data?.roomId}`,
    );

    const roomId = client.data.roomId as string | undefined;
    if (!roomId) return;

    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;

    // 플레이어 제거
    room.removePlayer(client.id);
    client.leave(roomId);

    // 방에 아무도 없으면 종료 처리
    if (room.playerCount() === 0) {
      this.logger.log(`roomId=${roomId} is empty. cleaning up`);

      const userIds = Array.from(new Set(roomWrapper.users));

      await this.notifyGameFinished(userIds);

      room.stopInterval();
      delete this.rooms[roomId];
      return;
    }

    // 남아있는 플레이어들에게 상태 전송
    this.server.to(roomId).emit('state', room.getState());
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
  handleJoinRoom(client: Socket, data: { roomId?: string; nickname?: string; mode?: GameMode }) {
    // 토큰에서 내려온 값이 기준
    const tokenRoomId = client.data.roomId as string | undefined;
    const tokenUserId = client.data.userId as string | undefined;

    if (!tokenRoomId || !tokenUserId) {
      this.logger.warn('join-room: token data missing');
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
    const nickname =
      (client.data.nickname as string | undefined) ??
      data?.nickname ??
      `user-${String(tokenUserId).slice(-6)}`;

    const mode =
      (client.data.mode as GameMode | undefined) ??
      data?.mode ??
      'NORMAL';

    const roomWrapper = this.ensureRoom(roomId, mode);
    const room = roomWrapper.engine;

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;
    client.data.userId = tokenUserId;

    // 접속한 유저 기록(최소한)
    if (!roomWrapper.users.includes(tokenUserId)) {
      roomWrapper.users.push(tokenUserId);
    }

    room.addPlayer(client.id, tokenUserId, nickname);

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
      if (totalPlayers === 5) {
        this.startCountdown(roomId);
      }
    }
  }

  private startCountdown(roomId: string) {
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

    // ✅ heartbeat 시작
    const heartbeatInterval = setInterval(() => {
      const url =
        process.env.MATCHING_INTERNAL_URL ||
        'http://matching:3000/internal/game-heartbeat';

      axios
        .post(
          url,
          { userIds: roomWrapper.users },
          { timeout: 2000 },
        )
        .catch(() => {
          // 실패해도 게임에는 영향 없음
        });
    }, 5000);

    room.interval = setInterval(async () => {
      room.update();
      this.server.to(roomId).emit('state', room.getState());

      if (this.lifecycleService.isGameOver(roomId)) {
        // ⛔ 게임 종료 → heartbeat 중단
        clearInterval(heartbeatInterval);

        if (room.interval) {
          clearInterval(room.interval);
          room.interval = null;
          room.intervalRunning = false;
        }

        const userIds = Array.from(new Set(roomWrapper.users));
        await this.notifyGameFinished(userIds);

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
  private async notifyGameFinished(userIds: string[]) {
    if (!userIds || userIds.length === 0) {
      this.logger.warn('game-finished: empty userIds');
      return;
    }

    const url =
      process.env.MATCHING_INTERNAL_URL ||
      'http://matching:3000/internal/game-finished';

    try {
      await axios.post(url, { userIds }, { timeout: 3000 });
      this.logger.log(`game-finished notified to matching: ${userIds.join(',')}`);
    } catch (err) {
      this.logger.error('game-finished notify failed', err as any);
    }
  }
}
