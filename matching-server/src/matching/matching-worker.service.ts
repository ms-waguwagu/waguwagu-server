import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';
import { QueueGateway } from '../queue/queue.gateway';
import { v4 as uuidv4 } from 'uuid';
import { PlayerStatus } from '../common/constants';
import { AgonesAllocatorService } from '../agones-allocator/agoness-allocator.service';
import { MatchingTokenService } from './matching-token.service';
import { Route53Service } from '../agones-allocator/route53.service';

@Injectable()
export class MatchingWorker implements OnModuleInit {
  private readonly logger = new Logger(MatchingWorker.name);
  private isProcessing = false;
  private isBossProcessing = false;
  private readonly TIMEOUT_MS = 3000; // ⭐ 3초로 단축 (테스트용)
  private tickCount = 0; // ⭐ 실행 횟수 카운트

  constructor(
    private readonly queueService: QueueService,
    private readonly queueGateway: QueueGateway,
    private readonly configService: ConfigService,
    private readonly agonesAllocatorService: AgonesAllocatorService,
    private readonly matchingTokenService: MatchingTokenService,
    private readonly route53Service: Route53Service,
  ) {}

  // ⭐ 초기화 로그
  onModuleInit() {
    this.logger.log('✅ MatchingWorker initialized');
    this.logger.log(`⏱️  Interval: 1000ms, Timeout: ${this.TIMEOUT_MS}ms`);
  }

  @Interval(1000)
  async handleMatchmaking() {
    this.tickCount++;

    // ⭐ 매 10틱마다 로그 (너무 많으면 스팸이라)
    if (this.tickCount % 10 === 0) {
      this.logger.debug(`[Tick ${this.tickCount}] handleMatchmaking 실행`);
    }

    // 클러스터 전역 리더 락
    const leader = await this.queueService.acquireLock('matchmaking:leader', 2);

    if (!leader) {
      if (this.tickCount % 10 === 0) {
        this.logger.debug(`[Tick ${this.tickCount}] 리더 락 획득 실패`);
      }
      return;
    }

    // ⭐ 락 획득 성공 시 항상 로그
    this.logger.log(`[Tick ${this.tickCount}] ✅ 리더 락 획득 성공!`);

    if (this.isProcessing) {
      this.logger.debug('이미 처리 중, 스킵');
      return;
    }
    this.isProcessing = true;

    let participants: string[] | null = null;

    try {
      const maxPlayers =
        this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

      // ⭐ 큐 길이 먼저 확인
      const queueLen = await this.queueService.getQueueLength();
      this.logger.log(`현재 큐 길이: ${queueLen}명`);

      if (queueLen === 0) {
        this.logger.debug('큐가 비어있음, 스킵');
        return;
      }

      // 1. 5인 매칭 시도
      participants =
        await this.queueService.extractMatchParticipants(maxPlayers);

      if (participants && participants.length === maxPlayers) {
        this.logger.log(
          `🎉 ${maxPlayers}명 풀 매칭 성공: ${participants.join(', ')}`,
        );

        await this.createRoomAndNotify(participants);
        return;
      }

      // 2. 마지막 입장 시각 확인
      const lastJoinedAt = await this.queueService.getLastJoinedAt();
      if (!lastJoinedAt) {
        this.logger.debug('마지막 입장 시각 없음');
        return;
      }

      const now = Date.now();
      const diff = now - lastJoinedAt;

      this.logger.debug(
        `대기열 인원=${queueLen}, 마지막 입장 이후 ${diff}ms 경과`,
      );

      if (diff < this.TIMEOUT_MS) {
        this.logger.debug(
          `타임아웃 대기 중 (${this.TIMEOUT_MS - diff}ms 남음)`,
        );
        return;
      }

      // 3. 부분 매칭 실행
      participants = await this.queueService.extractMatchUpTo(maxPlayers);

      if (!participants || participants.length === 0) {
        this.logger.warn('부분 매칭 실행했지만 참가자 없음');
        return;
      }

      this.logger.log(
        `⏰ [부분 매칭] 타임아웃 후 매칭: ${participants.join(', ')} (인원: ${participants.length})`,
      );

      await this.createRoomAndNotify(participants);
    } catch (error) {
      this.logger.error('❌ 매칭 처리 중 에러 발생', error);

      if (participants && participants.length > 0) {
        this.logger.warn(`🔄 롤백 실행: [${participants.join(', ')}]`);
        await this.queueService.rollbackParticipants(participants);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async createRoomAndNotify(participants: string[]): Promise<void> {
    this.logger.log(`[createRoomAndNotify] 시작: ${participants.length}명`);

    const newRoomId = uuidv4();
    const maxPlayers =
      this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

    // 1. 상태 변경
    for (const userId of participants) {
      await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
    }
    this.logger.log('✅ 유저 상태 IN_GAME으로 변경');

    // 2. Agones 할당
    this.logger.log('🎮 Agones GameServer 할당 요청...');
    const allocation = await this.agonesAllocatorService.allocate();
    const gameserverIp = allocation?.gameserverIp;
    const gameserverName = allocation?.gameserverName;
    const port = allocation?.port;

    if (!gameserverIp || !port || !gameserverName) {
      throw new Error(
        `❌ GameServer 할당 실패: ${gameserverName}(${gameserverIp}:${port})`,
      );
    }

    this.logger.log(
      `✅ [Agones] GameServer 할당 완료: ${gameserverName}(${gameserverIp}:${port})`,
    );

    // 3. 닉네임 정보 가져오기
    const userNicknames = await this.getUserNicknames(participants);

    // 4. 매칭 토큰 생성
    const matchToken = this.matchingTokenService.issueToken({
      userIds: participants,
      roomId: newRoomId,
      expiresIn: '30s',
      maxPlayers,
      mode: 'NORMAL',
      userNicknames,
    });

    this.logger.log(`🎫 매칭 토큰 생성 완료`);

    // 5. Route53 DNS 레코드 생성
    let host = gameserverIp;
    try {
      host = await this.route53Service.upsertGameServerARecord(
        gameserverName,
        gameserverIp,
      );
      this.logger.log(`✅ [Route53] DNS: ${host}`);
    } catch (error) {
      this.logger.error(`⚠️  [Route53] DNS 실패, IP 사용: ${gameserverIp}`);
    }

    // 6. 유저에게 매칭 정보 전송
    this.queueGateway.broadcastMatchFound(participants, {
      roomId: newRoomId,
      matchToken,
      gameUrl: `https://${host}:${port}`,
      host,
      port,
      gameServerName: gameserverName,
      mode: 'NORMAL',
    });

    this.logger.log(`🎉 매칭 완료! ${participants.length}명 → ${host}:${port}`);
  }

  // 보스모드도 동일하게 로그 추가
  @Interval(1000)
  async handleBossMatchmaking() {
    // ... 동일한 패턴으로 로그 추가
  }

  private async getUserNicknames(
    userIds: string[],
  ): Promise<Record<string, string>> {
    const nicknames: Record<string, string> = {};
    for (const userId of userIds) {
      const session = await this.queueService.getSessionInfo(userId);
      if (session && session.nickname) {
        nicknames[userId] = session.nickname;
      }
    }
    return nicknames;
  }
}
