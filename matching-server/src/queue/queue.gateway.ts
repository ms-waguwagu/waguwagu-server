import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QueueService } from './queue.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PlayerStatus } from '../common/constants';

@WebSocketGateway({ 
	namespace: '/queue', 
	path: '/socket.io',
	cors: { origin: '*' } })
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QueueGateway.name);

  // 핵심!! UserId와 SocketId를 연결하는 맵
  private connectedUsers: Map<string, string> = new Map();

  constructor(
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log('WS CONNECT 시도');
      const token = client.handshake.auth?.token;
      if (!token) throw new Error('토큰 없음');

      const decoded = this.jwtService.verify(token);
      const userId = decoded.googleSub;
      const nickname = decoded.nickname;

      // 연결될 때 맵에 적어둠
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;
      client.data.nickname = nickname;

      this.logger.log(
        `클라이언트 연결 성공: ${decoded.nickname}, 소켓 연결 세션 ID: ${client.id}`,
      );
    } catch (error) {
      this.logger.warn(`클라이언트 연결 실패: ${error.message}`);
      client.emit('error', { message: error.message });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // 나갈 때 맵에서 지움
    const userId = client.data.userId;

    if (!userId) return;

    this.connectedUsers.delete(userId);
    try {
      const session = await this.queueService.getSessionInfo(userId);
      const status = session?.status;

      //이미 매칭되었거나 게임 중이면 큐 취소를 시도하지 않음
      if (status !== PlayerStatus.WAITING) {
        this.logger.log(`disconnect: userId=${userId}, status=${status}`);
        return;
      }

      // 일반모드 큐와 보스모드 큐 모두 확인하여 취소 시도
      try {
        await this.queueService.cancelQueue(userId);
        this.logger.log(`연결 끊김으로 인한 일반모드 매칭 취소: ${userId}`);
      } catch (normalError: any) {
        // 일반모드 큐에 없으면 보스모드 큐 확인
        try {
          await this.queueService.cancelBossQueue(userId);
          this.logger.log(`연결 끊김으로 인한 보스모드 매칭 취소: ${userId}`);
        } catch (bossError: any) {
          // 둘 다 실패하면 로그만 남김 (이미 매칭되었을 수 있음)
          this.logger.debug(
            `연결 끊김 처리: 일반모드 큐 취소 실패 (${normalError.message}), 보스모드 큐 취소 실패 (${bossError.message})`,
          );
        }
      }
    } catch (e: any) {
      this.logger.error(`disconnect 처리 중 에러 (userId=${userId})`, e);
    }
  }

  // 대기열 입장 요청
  @SubscribeMessage('join_queue')
  async handleJoinQueue(@ConnectedSocket() client: Socket) {
    const { userId, nickname } = client.data;

    try {
      await this.queueService.enterQueue(userId, nickname);

      // 성공 응답 전송
      client.emit('queue_joined', { message: '대기열 진입 성공' });

      // 대기열 상태 갱신하여 모두에게 푸시
      this.broadcastQueueStatus();
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // 대기열 취소 요청
  @SubscribeMessage('cancel_queue')
  async handleCancelQueue(@ConnectedSocket() client: Socket) {
    const { userId } = client.data;

    try {
      await this.queueService.cancelQueue(userId);

      client.emit('queue_cancelled', { message: '대기열 취소 성공' });

      // 상태 갱신 푸시
      this.broadcastQueueStatus();
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // 대기열 상태 조회
  // 클라이언트가 요청할 수도 있고, 서버가 변경될 때마다 뿌릴 수도 있음
  @SubscribeMessage('request_queue_status')
  async handleRequestQueueStatus(@ConnectedSocket() client: Socket) {
    const status = await this.getQueueStatusData();
    client.emit('queue_status', status);
  }

  // ============================================
  // 보스모드 큐 관련 이벤트 핸들러
  // ============================================

  // 보스모드 대기열 입장 요청
  @SubscribeMessage('join_boss_queue')
  async handleJoinBossQueue(@ConnectedSocket() client: Socket) {
    const { userId, nickname } = client.data;

    try {
      await this.queueService.enterBossQueue(userId, nickname);

      // 성공 응답 전송
      client.emit('boss_queue_joined', {
        message: '보스모드 대기열 진입 성공',
      });

      // 대기열 상태 갱신하여 모두에게 푸시
      this.broadcastBossQueueStatus();
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // 보스모드 대기열 취소 요청
  @SubscribeMessage('cancel_boss_queue')
  async handleCancelBossQueue(@ConnectedSocket() client: Socket) {
    const { userId } = client.data;

    try {
      await this.queueService.cancelBossQueue(userId);

      client.emit('boss_queue_cancelled', {
        message: '보스모드 대기열 취소 성공',
      });

      // 상태 갱신 푸시
      this.broadcastBossQueueStatus();
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  // 보스모드 대기열 상태 조회
  @SubscribeMessage('request_boss_queue_status')
  async handleRequestBossQueueStatus(@ConnectedSocket() client: Socket) {
    const status = await this.getBossQueueStatusData();
    client.emit('boss_queue_status', status);
  }

  // Worker가 호출할 함수. 매칭 성사 알림
  broadcastMatchFound(userIds: string[], roomInfo: any) {
    userIds.forEach((userId) => {
      const socketId = this.connectedUsers.get(userId);
      if (socketId) {
        this.server.to(socketId).emit('match_found', {
          message: '매칭 성공! 게임 서버로 이동합니다.',
          ...roomInfo,
        });
      }
    });
  }

  // 헬퍼: 현재 큐 상태 데이터 생성
  private async getQueueStatusData() {
    const totalLength = await this.queueService.getQueueLength();
    const MAX_PLAYERS_COUNT =
      this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;
    let currentCount = totalLength % MAX_PLAYERS_COUNT;

    if (currentCount === 0 && totalLength > 0) {
      currentCount = MAX_PLAYERS_COUNT;
    }

    return {
      currentCount,
      totalQueueLength: totalLength,
    };
  }

  // 헬퍼: 모든 접속자에게 큐 상태 푸시 (인원 변동 시 호출)
  async broadcastQueueStatus() {
    const status = await this.getQueueStatusData();
    this.server.emit('queue_status', status); // namespace 전체 방송
  }

  // ============================================
  // 보스모드 큐 상태 관련 헬퍼 메서드
  // ============================================

  // 헬퍼: 보스모드 큐 상태 데이터 생성
  private async getBossQueueStatusData() {
    const totalLength = await this.queueService.getBossQueueLength();
    const MAX_PLAYERS_COUNT =
      this.configService.get<number>('BOSS_MATCH_PLAYER_COUNT') ?? 5;
    let currentCount = totalLength % MAX_PLAYERS_COUNT;

    if (currentCount === 0 && totalLength > 0) {
      currentCount = MAX_PLAYERS_COUNT;
    }

    return {
      currentCount,
      totalQueueLength: totalLength,
    };
  }

  // 헬퍼: 모든 접속자에게 보스모드 큐 상태 푸시
  async broadcastBossQueueStatus() {
    const status = await this.getBossQueueStatusData();
    this.server.emit('boss_queue_status', status);
  }
}
