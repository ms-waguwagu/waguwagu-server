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
import * as jwt from 'jsonwebtoken';

import { AgonesService } from '../agones/agones.service';

import { GameEngineService } from '../engine/game-engine.service';
import { PlayerService } from 'src/engine/player/player.service';
import { GhostManagerService } from 'src/engine/ghost/ghost-manager.service';
import { BotManagerService } from 'src/engine/bot/bot-manager.service';
import { CollisionService } from 'src/engine/core/collision.service';
import { LifecycleService } from 'src/engine/core/lifecycle.service';
import { GameLoopService } from 'src/engine/core/game-loop.service';
import { BossManagerService } from '../boss/boss-manager.service';

interface RoomWrapper {
  engine: GameEngineService;
  users: string[]; // googleSub list (참가자 기록)
  finished?: boolean;
  countdownStarted?: boolean;
}

type GameMode = 'NORMAL' | 'BOSS';

@WebSocketGateway({
  namespace: '/game',
  path: '/socket.io',
  cors: { origin: '*' },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // roomId -> room wrapper
  private rooms: Record<string, RoomWrapper> = {};

  // googleSub -> roomId (HTTP leave용)
  private userRoomMap = new Map<string, string>();

  constructor(
    private ghostManagerService: GhostManagerService,
    private playerService: PlayerService,
    private botManagerService: BotManagerService,
    private collisionService: CollisionService,
    private lifecycleService: LifecycleService,
    private gameLoopService: GameLoopService,
    private bossManagerService: BossManagerService,
    private agonesService: AgonesService,
  ) {}

  private verifyMatchToken(token: string): {
    userIds: string[];
    roomId: string;
    nickname?: string;
    mode?: 'NORMAL' | 'BOSS';
    maxPlayers?: number;
  } {
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
      nickname: decoded.nickname as string | undefined,
      mode: decoded.mode as 'NORMAL' | 'BOSS' | undefined,
      maxPlayers: decoded.maxPlayers as number | undefined,
    };
  }

  afterInit(server: Server) {
    this.lifecycleService.roomManager = this;

    const nsp: any = (this.server as any).use
      ? this.server
      : (this.server as any).of?.('/game');

    if (!nsp?.use) {
      this.logger.warn('socket middleware(use)를 붙일 수 없습니다.');
      return;
    }

    // 연결 단계에서 matchToken 검증
    nsp.use((socket: Socket, next: (err?: any) => void) => {
      const token = socket.handshake.auth?.matchToken;
      this.logger.log(
        `[Middleware] Connection attempt, token exists: ${!!token}`,
      );

      if (!token) {
        this.logger.warn('[Middleware] NO_MATCH_TOKEN - rejecting connection');
        return next(new Error('NO_MATCH_TOKEN'));
      }

      try {
        const payload = this.verifyMatchToken(token);

        socket.data.userIds = payload.userIds;
        socket.data.roomId = payload.roomId;

        if (payload.nickname) socket.data.nickname = payload.nickname;
        if (payload.mode) socket.data.mode = payload.mode as GameMode;
        if (payload.maxPlayers) socket.data.maxPlayers = payload.maxPlayers;

        return next();
      } catch (err: any) {
        this.logger.error(`[Middleware] INVALID_MATCH_TOKEN: ${err?.message}`);
        return next(new Error('INVALID_MATCH_TOKEN'));
      }
    });

    this.logger.log('GameGateway socket middleware ready');
  }

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connected socketId=${client.id} roomId=${client.data?.roomId} tokenUsers=${(client.data?.userIds ?? []).join(',')}`,
    );
  }

  // ✅ 새로고침/뒤로가기/탭닫기 = 소켓 끊김 → "탈주" 취급 → 결과 전송 X
  async handleDisconnect(client: Socket) {
    const roomId = client.data.roomId as string | undefined;
    const googleSub = client.data.userId as string | undefined;

    this.logger.log(
      `Client disconnected socketId=${client.id} userId=${googleSub} roomId=${roomId}`,
    );

    if (!roomId) return;

    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;

    // 1) 플레이어 제거 (소켓 기준)
    room.removePlayer(client.id);
    client.leave(roomId);

    // 2) 매핑 정리 (googleSub가 있으면)
    if (googleSub) {
      this.userRoomMap.delete(googleSub);
    }

    // 3) 방에 아무도 없으면 방 정리 (⚠️ 결과 전송 X)
    if (room.playerCount() === 0) {
      if (roomWrapper.finished) return;
      roomWrapper.finished = true;

      room.stopInterval();
      delete this.rooms[roomId];
      this.lifecycleService.removeRoom(roomId);

      this.logger.log(`[ROOM CLOSED by disconnect] roomId=${roomId}`);
      return;
    }

    // 4) 남은 사람들에게 상태 전송
    this.server.to(roomId).emit('state', room.getState());
  }

  // ✅ HTTP에서 새로고침/뒤로가기 처리할 때 호출(= 탈주) → 결과 전송 X
  handleHttpLeave(googleSub: string) {
    const roomId = this.userRoomMap.get(googleSub);
    if (!roomId) return;

    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;

    // googleSub 기준으로 플레이어 제거가 불가능하면,
    // room.removePlayerByUserId 같은 메서드가 있으면 그걸 쓰는 게 베스트.
    // 현재는 "소켓 기반" removePlayer(client.id) 구조라서,
    // 여기서는 "강제로 방을 정리"하는 방식이 안전함(탈주 처리).
    this.logger.log(`[HTTP LEAVE] user=${googleSub}, room=${roomId}`);

    this.userRoomMap.delete(googleSub);

    // 남은 인원이 0이 되는 상황을 보장할 수 없으므로,
    // 서버 측에서 특정 유저만 정확히 제거하려면
    // 엔진에 removePlayerByUserId(googleSub) 추가하는게 정답.
    // 일단은 "탈주 → 방 유지"를 원하면 아래를 주석 처리하고,
    // "탈주 → 방 강제 종료"면 아래 유지.
    // 👉 지금 요구사항(새로고침=나가기)면 강제 종료가 더 명확함.
    room.stopInterval();
    delete this.rooms[roomId];
    this.lifecycleService.removeRoom(roomId);

    this.logger.log(`[ROOM CLOSED by http leave] roomId=${roomId}`);
  }

  // 방 조회
  getRoom(roomId: string): GameEngineService | undefined {
    return this.rooms[roomId]?.engine;
  }

  // 방 삭제(외부에서 호출)
  removeRoom(roomId: string) {
    const roomWrapper = this.rooms[roomId];
    if (!roomWrapper) return;

    const room = roomWrapper.engine;
    room.stopInterval();

    this.ghostManagerService.clearRoom(roomId);
    this.playerService.clearRoom(roomId);
    this.botManagerService.resetBots(roomId);
    this.bossManagerService.removeBoss(roomId);

    this.server.in(roomId).disconnectSockets();

    delete this.rooms[roomId];
    this.lifecycleService.removeRoom(roomId);

    this.logger.log(`Room ${roomId} removed from GameGateway.`);
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
  @SubscribeMessage('join-room')
  handleJoinRoom(
    client: Socket,
    data: {
      roomId?: string;
      nickname?: string;
      mode?: GameMode;
      userId?: string;
    },
  ) {
    const tokenRoomId = client.data.roomId as string | undefined;
    const tokenUserIds = client.data.userIds as string[] | undefined;

    const userId =
      data?.userId || (client.handshake.query?.userId as string | undefined);

    if (!tokenRoomId || !tokenUserIds) {
      this.logger.warn('join-room: token data missing');
      client.disconnect();
      return;
    }

    if (!userId || !tokenUserIds.includes(userId)) {
      this.logger.warn(
        `join-room: userId=${userId} not in token userIds=${tokenUserIds.join(',')}`,
      );
      client.disconnect();
      return;
    }

    if (data?.roomId && data.roomId !== tokenRoomId) {
      this.logger.warn(
        `join-room roomId mismatch token=${tokenRoomId} client=${data.roomId}`,
      );
      client.disconnect();
      return;
    }

    const roomId = tokenRoomId;

    const nickname =
      (client.data.nickname as string | undefined) ??
      data?.nickname ??
      `user-${String(userId).slice(-6)}`;

    const mode =
      (client.data.mode as GameMode | undefined) ?? data?.mode ?? 'NORMAL';

    const maxPlayers = (client.data.maxPlayers as number | undefined) ?? 5;

    const isNewRoom = !this.rooms[roomId];
    const roomWrapper = this.ensureRoom(roomId, mode);
    const room = roomWrapper.engine;

    // join
    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;
    client.data.userId = userId;

    // HTTP leave를 위해 googleSub -> roomId 기록
    this.userRoomMap.set(userId, roomId);

    // 참가자 기록
    if (!roomWrapper.users.includes(userId)) {
      roomWrapper.users.push(userId);
    }

    room.addPlayer(client.id, userId, nickname);

    // 봇 자동 추가 (방 처음 생성 시)
    if (isNewRoom && !room.isBossMode()) {
      const playersInToken = tokenUserIds.length;
      const botsToAdd = Math.max(0, maxPlayers - playersInToken);

      this.logger.log(
        `[Agones Flow] Initializing room. roomId=${roomId}, botsToAdd=${botsToAdd}, maxPlayers=${maxPlayers}, playersInToken=${playersInToken}`,
      );

      for (let i = 0; i < botsToAdd; i++) {
        room.addBotPlayer();
      }
    }

    // init-game
    client.emit('init-game', {
      playerId: client.id,
      roomId,
      mapData: room.getMapData(),
      initialState: room.getState(),
    });

    // broadcast state
    this.server.to(roomId).emit('state', room.getState());

    // start condition
    const humanPlayers = room.playerCount();
    const botPlayers = room.getBotCount();
    const totalPlayers = humanPlayers + botPlayers;

    if (room.isBossMode()) {
      if (!room.intervalRunning) {
        room.startBossMode();
      }
    } else {
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

      // ✅ 정상 종료(유일한 결과 전송 지점)
      if (this.lifecycleService.isGameOver(roomId)) {
        if (roomWrapper.finished) return;
        roomWrapper.finished = true;

        // 1) 루프 중단
        room.stopInterval();

        // 2) 결과 스냅샷
        const results = [...room.getAllPlayerScores()];

        // 3) 결과 있을 때만 전송
        if (results.length > 0) {
          await this.notifyGameFinished(roomId, results);
        }

        // 4) 정리
        delete this.rooms[roomId];
        this.lifecycleService.removeRoom(roomId);
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
  // (reset은 이제 안 쓴다 했으니 필요 없으면 제거 가능)
  // ============================

  // ============================
  // matching 서버로 종료 알림
  // ============================
  private async notifyGameFinished(
    roomId: string,
    results: { userId: string; nickname: string; score: number }[],
  ) {
    if (!roomId || !results || results.length === 0) {
      this.logger.warn('game-finished: invalid payload');
      return;
    }

    const url =
      process.env.MATCHING_INTERNAL_URL ||
      'http://matching:3000/internal/game-finished';

    try {
      await axios.post(url, { roomId, results }, { timeout: 3000 });

      this.logger.log(
        `🏁 game-finished notified roomId=${roomId} results=${results
          .map((r) => `${r.userId}:${r.score}`)
          .join(', ')}`,
      );
    } catch (err: any) {
      this.logger.error('game-finished notify failed', err);
    }
  }
}
