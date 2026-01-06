import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QueueService } from './queue.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PlayerStatus } from '../common/constants';

// ✅ Socket.IO Redis Adapter (멀티 파드 브로드캐스트 동기화)
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

@WebSocketGateway({
  namespace: '/queue',
  path: '/socket.io',
  cors: { origin: '*' },
})
export class QueueGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QueueGateway.name);

  // ✅ Redis adapter init guard (afterInit이 여러 번 불릴 수 있는 환경 방어)
  private adapterReady = false;

  // ✅ node-redis clients for adapter
  private pubClient?: RedisClientType;
  private subClient?: RedisClientType;

  constructor(
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * ✅ 멀티 파드 환경에서 server.emit / room broadcast가 전체 파드로 공유되게 함
   */
  async afterInit(server: Server) {
    if (this.adapterReady) return;

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || process.env.REDIS_URL;

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set. Socket.IO will NOT be synchronized across pods. (replica>1이면 1/5 문제 재발)',
      );
      return;
    }

    try {
      this.pubClient = createClient({ url: redisUrl });
      this.subClient = this.pubClient.duplicate();

      await this.pubClient.connect();
      await this.subClient.connect();

      server.adapter(createAdapter(this.pubClient, this.subClient));

      this.adapterReady = true;
      this.logger.log('✅ Socket.IO Redis Adapter attached (multi-pod ready)');
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to attach Socket.IO Redis Adapter: ${err?.message}`,
        err,
      );
    }
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log('WS CONNECT 시도');

      const token = client.handshake.auth?.token;
      if (!token) throw new Error('토큰 없음');

      const decoded: any = this.jwtService.verify(token);
      const userId: string | undefined = decoded.googleSub;
      const nickname: string | undefined = decoded.nickname;

      if (!userId) throw new Error('googleSub 없음');

      client.data.userId = userId;
      client.data.nickname = nickname;

      // ✅ 핵심: userId 기반 room에 조인
      // 멀티 파드여도 adapter 덕분에 room broadcast가 동작
      client.join(`user:${userId}`);

      this.logger.log(
        `클라이언트 연결 성공: ${nickname ?? userId}, socketId=${client.id}, userRoom=user:${userId}`,
      );

      // 접속 직후 현재 상태를 한 번 보내주면 UI가 덜 흔들림(선택)
      // const status = await this.getQueueStatusData();
      // client.emit('queue_status', status);
    } catch (error: any) {
      this.logger.warn(`클라이언트 연결 실패: ${error?.message}`);
      client.emit('error', { message: error?.message ?? 'WS 연결 실패' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data.userId;
    if (!userId) return;

    try {
      const session = await this.queueService.getSessionInfo(userId);
      const status = session?.status;

      // ✅ 이미 매칭되었거나 게임 중이면 큐 취소 시도하지 않음
      if (status !== PlayerStatus.WAITING) {
        this.logger.log(`disconnect: userId=${userId}, status=${status}`);
        return;
      }

      // 일반/보스 큐 모두 확인하여 취소 시도
      try {
        await this.queueService.cancelQueue(userId);
        this.logger.log(`연결 끊김으로 인한 일반모드 매칭 취소: ${userId}`);
      } catch (normalError: any) {
        try {
          await this.queueService.cancelBossQueue(userId);
          this.logger.log(`연결 끊김으로 인한 보스모드 매칭 취소: ${userId}`);
        } catch (bossError: any) {
          this.logger.debug(
            `연결 끊김 처리: 일반 큐 취소 실패(${normalError?.message}), 보스 큐 취소 실패(${bossError?.message})`,
          );
        }
      }

      // 상태 갱신 푸시(선택)
      await this.broadcastQueueStatus();
      await this.broadcastBossQueueStatus();
    } catch (e: any) {
      this.logger.error(`disconnect 처리 중 에러 (userId=${userId})`, e);
    }
  }

  // ============================
  // 일반 매칭 큐
  // ============================

  @SubscribeMessage('join_queue')
  async handleJoinQueue(@ConnectedSocket() client: Socket) {
    const { userId, nickname } = client.data as {
      userId?: string;
      nickname?: string;
    };

    try {
      if (!userId) throw new Error('userId 없음');

      await this.queueService.recoverStaleInGameSession(userId);
      await this.queueService.enterQueue(userId, nickname ?? 'unknown');

      client.emit('queue_joined', { message: '대기열 진입 성공' });
      await this.broadcastQueueStatus();
    } catch (error: any) {
      client.emit('error', { message: error?.message ?? 'join_queue 실패' });
    }
  }

  @SubscribeMessage('cancel_queue')
  async handleCancelQueue(@ConnectedSocket() client: Socket) {
    const { userId } = client.data as { userId?: string };

    try {
      if (!userId) throw new Error('userId 없음');

      await this.queueService.cancelQueue(userId);
      client.emit('queue_cancelled', { message: '대기열 취소 성공' });

      await this.broadcastQueueStatus();
    } catch (error: any) {
      client.emit('error', { message: error?.message ?? 'cancel_queue 실패' });
    }
  }

  @SubscribeMessage('request_queue_status')
  async handleRequestQueueStatus(@ConnectedSocket() client: Socket) {
    const status = await this.getQueueStatusData();
    client.emit('queue_status', status);
  }

  // ============================
  // 보스모드 큐
  // ============================

  @SubscribeMessage('join_boss_queue')
  async handleJoinBossQueue(@ConnectedSocket() client: Socket) {
    const { userId, nickname } = client.data as {
      userId?: string;
      nickname?: string;
    };

    try {
      if (!userId) throw new Error('userId 없음');

      await this.queueService.recoverStaleInGameSession(userId);
      await this.queueService.enterBossQueue(userId, nickname ?? 'unknown');

      client.emit('boss_queue_joined', {
        message: '보스모드 대기열 진입 성공',
      });

      await this.broadcastBossQueueStatus();
    } catch (error: any) {
      client.emit('error', {
        message: error?.message ?? 'join_boss_queue 실패',
      });
    }
  }

  @SubscribeMessage('cancel_boss_queue')
  async handleCancelBossQueue(@ConnectedSocket() client: Socket) {
    const { userId } = client.data as { userId?: string };

    try {
      if (!userId) throw new Error('userId 없음');

      await this.queueService.cancelBossQueue(userId);

      client.emit('boss_queue_cancelled', {
        message: '보스모드 대기열 취소 성공',
      });

      await this.broadcastBossQueueStatus();
    } catch (error: any) {
      client.emit('error', {
        message: error?.message ?? 'cancel_boss_queue 실패',
      });
    }
  }

  @SubscribeMessage('request_boss_queue_status')
  async handleRequestBossQueueStatus(@ConnectedSocket() client: Socket) {
    const status = await this.getBossQueueStatusData();
    client.emit('boss_queue_status', status);
  }

  // ============================
  // Worker → 매칭 성사 알림
  // ============================

  /**
   * ✅ 멀티 파드에서도 user room으로 정확히 라우팅 됨
   * - 기존: userId → socketId(Map) (❌ 멀티 파드에서 깨짐)
   * - 변경: userId room(`user:${userId}`) (✅ 어느 파드에 붙어도 받음)
   */
  broadcastMatchFound(userIds: string[], roomInfo: any) {
    this.logger.log(`[broadcastMatchFound] userIds: ${userIds.join(', ')}`);

    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('match_found', {
        message: '매칭 성공! 게임 서버로 이동합니다.',
        ...roomInfo,
      });
    });
  }

  // ============================
  // Queue status helpers
  // ============================

  private async getQueueStatusData() {
    const totalLength = await this.queueService.getQueueLength();
    const MAX_PLAYERS_COUNT =
      this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

    let currentCount = totalLength % MAX_PLAYERS_COUNT;
    if (currentCount === 0 && totalLength > 0) currentCount = MAX_PLAYERS_COUNT;

    return {
      currentCount,
      totalQueueLength: totalLength,
    };
  }

  async broadcastQueueStatus() {
    const status = await this.getQueueStatusData();
    // ✅ adapter 붙으면 멀티 파드 전체에 브로드캐스트
    this.server.emit('queue_status', status);
  }

  private async getBossQueueStatusData() {
    const totalLength = await this.queueService.getBossQueueLength();
    const MAX_PLAYERS_COUNT =
      this.configService.get<number>('BOSS_MATCH_PLAYER_COUNT') ?? 5;

    let currentCount = totalLength % MAX_PLAYERS_COUNT;
    if (currentCount === 0 && totalLength > 0) currentCount = MAX_PLAYERS_COUNT;

    return {
      currentCount,
      totalQueueLength: totalLength,
    };
  }

  async broadcastBossQueueStatus() {
    const status = await this.getBossQueueStatusData();
    this.server.emit('boss_queue_status', status);
  }
}
