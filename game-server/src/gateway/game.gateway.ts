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

import { GameEngineService } from '../engine/game-engine.service';
import { RankingService } from '../ranking/ranking.service';
import { PlayerService } from 'src/engine/player/player.service';
import { GhostManagerService } from 'src/engine/ghost/ghost-manager.service';
import { BotManagerService } from 'src/engine/bot/bot-manager.service';
import { CollisionService } from 'src/engine/core/collision.service';
import { LifecycleService } from 'src/engine/core/lifecycle.service';
import { GameLoopService } from 'src/engine/core/game-loop.service';
import { BossManagerService } from '../boss/boss-manager.service';

interface RoomWrapper {
  engine: GameEngineService;
  users: string[];
  finished?: boolean;
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

  // roomId → GameEngineService instance
  private rooms: Record<string, RoomWrapper> = {};

  // 유령 방 방지용 타임아웃 (Agones와 무관하게 서버 리소스 관리용)
  private idleTimeout: NodeJS.Timeout | null = null;

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

  private verifyMatchToken(token: string): { userIds: string[]; roomId: string; nickname?: string; mode?: 'NORMAL' | 'BOSS' } {
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
    };
  }

  // ============================================
  // 초기화 (미들웨어 설정)
  // ============================================
  afterInit(server: Server) {
    this.lifecycleService.roomManager = this;

    const nsp: any =
      (this.server as any).use ? this.server : (this.server as any).of?.('/game');

    if (!nsp?.use) {
      this.logger.warn('socket middleware(use)를 붙일 수 없습니다.');
      return;
    }

    // 토큰 검증 미들웨어
    nsp.use((socket: Socket, next: (err?: any) => void) => {
      const token = socket.handshake.auth?.matchToken;
      
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
        return next();
      } catch (err) {
        this.logger.error(`[Middleware] INVALID_MATCH_TOKEN: ${err.message}`);
        return next(new Error('INVALID_MATCH_TOKEN'));
      }
    });

    this.logger.log('GameGateway socket middleware ready');

    // [서버 관리] 60초 동안 아무도 접속하지 않으면 프로세스 종료 (리소스 낭비 방지)
    // Agones SDK가 없어도, 컨테이너가 계속 떠있는 것을 막기 위해 자체적으로 종료 로직을 두는 것이 좋습니다.
    this.idleTimeout = setTimeout(() => {
      this.logger.warn('[Timeout] No players joined in 60s. Process exiting...');
      process.exit(0); 
    }, 60000);
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
      if (roomWrapper.finished) return;
      roomWrapper.finished = true;

      const userIds = Array.from(new Set(roomWrapper.users));
      await this.notifyGameFinished(roomId, userIds);

      room.stopInterval();
      delete this.rooms[roomId];
      return;
    }
    // 남아있는 플레이어들에게 상태 전송
    this.server.to(roomId).emit('state', room.getState());
  }

  handleHttpLeave(userId: string) {
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data?.userId === userId) {
        socket.disconnect(true);
        return;
      }
    }
  }

  getRoom(roomId: string): GameEngineService | undefined {
    return this.rooms[roomId]?.engine;
  }

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

    if (mode === 'BOSS') engine.setMode('BOSS');

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
  handleJoinRoom(client: Socket, data: { roomId?: string; nickname?: string; mode?: GameMode; userId?: string }) {
    
    // 첫 유저 접속 시 자동 종료 타이머 해제
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
      this.logger.log('[Info] Player joined, idle timeout cancelled.');
    }

    const tokenRoomId = client.data.roomId as string | undefined;
    const tokenUserIds = client.data.userIds as string[] | undefined;
    const userId = data?.userId || (client.handshake.query?.userId as string | undefined);

    if (!tokenRoomId || !tokenUserIds || !userId || !tokenUserIds.includes(userId)) {
      client.disconnect();
      return;
    }
    if (data?.roomId && data.roomId !== tokenRoomId) {
      client.disconnect();
      return;
    }

    const roomId = tokenRoomId;
    const nickname = (client.data.nickname as string) ?? data?.nickname ?? `user-${userId.slice(-6)}`;
    const mode = (client.data.mode as GameMode) ?? data?.mode ?? 'NORMAL';

    const roomWrapper = this.ensureRoom(roomId, mode);
    const room = roomWrapper.engine;

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;
    client.data.userId = userId;

    if (!roomWrapper.users.includes(userId)) {
      roomWrapper.users.push(userId);
    }

    room.addPlayer(client.id, userId, nickname);

    client.emit('init-game', {
      playerId: client.id,
      roomId,
      mapData: room.getMapData(),
      initialState: room.getState(),
    });

    this.server.to(roomId).emit('state', room.getState());

    const totalPlayers = room.playerCount() + room.getBotCount();

    if (room.isBossMode()) {
      if (!room.intervalRunning) room.startBossMode();
    } else {
      if (totalPlayers === 5) this.startCountdown(roomId);
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
    room.interval = setInterval(async () => {
      room.update();
      this.server.to(roomId).emit('state', room.getState());

      if (this.lifecycleService.isGameOver(roomId)) {
        if (roomWrapper.finished) return;
        roomWrapper.finished = true;
        const userIds = Array.from(new Set(roomWrapper.users));
        await this.notifyGameFinished(roomId, userIds);
        room.stopInterval();
        delete this.rooms[roomId];
      }
    }, 1000 / 30);
  }

  @SubscribeMessage('input')
  handleInput(client: Socket, data: { dir: { dx: number; dy: number } }) {
    const roomId = client.data.roomId as string;
    if (!roomId) return;
    const roomWrapper = this.rooms[roomId];
    if (roomWrapper) roomWrapper.engine.handleInput(client.id, data.dir);
  }

  @SubscribeMessage('reset')
  handleReset(client: Socket, data: { roomId: string }) {
    const roomWrapper = this.rooms[data.roomId];
    if (roomWrapper) {
      roomWrapper.engine.resetGame();
      this.startCountdown(data.roomId);
      this.server.to(data.roomId).emit('state', roomWrapper.engine.getState());
    }
  }

  // ============================
  // 매칭 서버 통보 및 프로세스 종료
  // ============================
  private async notifyGameFinished(roomId: string, userIds: string[]) {
    if (roomId && userIds && userIds.length > 0) {
      const url = process.env.MATCHING_INTERNAL_URL || 'http://matching:3000/internal/game-finished';
      try {
        await axios.post(url, { roomId, userIds }, { timeout: 3000 });
        this.logger.log(`🏁 Game finished notified. Room: ${roomId}`);
      } catch (err) {
        this.logger.error('Game finished notify failed', err);
      }
    }

    // [중요] 게임이 끝나면 현재 파드(컨테이너)를 종료합니다.
    // Agones SDK가 없으므로 shutdown() 대신 프로세스 종료를 사용하여 
    // Kubernetes가 파드를 재시작하거나 삭제하도록 유도합니다.
    this.logger.log('Game finished. Exiting process...');
    setTimeout(() => process.exit(0), 1000);
  }
}