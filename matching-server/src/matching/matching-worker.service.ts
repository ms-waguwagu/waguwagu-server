import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';
import { QueueGateway } from '../queue/queue.gateway';
import { v4 as uuidv4 } from 'uuid'; //방 ID 생성용
import axios from 'axios';
import { PlayerStatus } from '../common/constants';
import { AgonesAllocatorService } from '../agones-allocator/agoness-allocator.service';
import { MatchingTokenService } from './matching-token.service';
import { Route53Service } from '../agones-allocator/route53.service';

@Injectable()
export class MatchingWorker {
  private readonly logger = new Logger(MatchingWorker.name);
  private isProcessing = false; // 중복 실행 방지용 플래그
  private isBossProcessing = false; // 보스모드 중복 실행 방지용 플래그
  private readonly TIMEOUT_MS = 7000; // 마지막 유저 기준 7초

  constructor(
    private readonly queueService: QueueService,
    private readonly queueGateway: QueueGateway,
    private readonly configService: ConfigService,
    private readonly agonesAllocatorService: AgonesAllocatorService,
    private readonly matchingTokenService: MatchingTokenService,
    private readonly route53Service: Route53Service,
  ) {}

  // ============================================
  // 일반 매칭 워커
  // ============================================
  @Interval(1000)
  async handleMatchmaking() {
    //클러스터 전역 리더 락
    const leader = await this.queueService.acquireLock(
      'matchmaking:leader',
      2, // TTL: 2초
    );

    if (!leader) return;

    if (this.isProcessing) return;
    this.isProcessing = true;

    let participants: string[] | null = null;

    try {
      const maxPlayers =
        this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

      // 1. 먼저 5인 매칭 시도
      participants =
        await this.queueService.extractMatchParticipants(maxPlayers);

      if (participants && participants.length === maxPlayers) {
        this.logger.log(
          `5명 풀 매칭 ${participants.join(', ')} (인원: ${participants.length})`,
        );

        await this.createRoomAndNotify(participants);
        return; 
      }

      // 2. 큐가 비었으면 아무 것도 안 함
      const queueLen = await this.queueService.getQueueLength();
      if (queueLen === 0) return;

      // 3. 마지막 유저 입장 시각 확인
      const lastJoinedAt = await this.queueService.getLastJoinedAt();
      if (!lastJoinedAt) return;

      const now = Date.now();
      const diff = now - lastJoinedAt;

      // 타임아웃 전이면 대기
      if (diff < this.TIMEOUT_MS) {
        this.logger.debug(
          `대기열 인원=${queueLen}, 마지막 입장 이후 ${diff}ms 경과 (타임아웃 전)`,
        );
        return;
      }

      // 4. 타임아웃 후 부분 매칭 실행
      participants = await this.queueService.extractMatchUpTo(maxPlayers);

      if (!participants || participants.length === 0) return;

      this.logger.log(
        `[부분 매칭] 타임아웃 후 매칭: ${participants.join(', ')} (인원: ${participants.length})`,
      );

      await this.createRoomAndNotify(participants);
    } catch (error) {
      this.logger.error('매칭 처리 중 에러 발생', error);

      // 실패 시 롤백
      if (participants && participants.length > 0) {
        this.logger.warn(`롤백 실행: 유저 [${participants.join(', ')}] 재삽입`);
        await this.queueService.rollbackParticipants(participants);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================
  // 일반 매칭 처리 로직 (Agones + API 호출)
  // ============================================
  private async createRoomAndNotify(participants: string[]): Promise<void> {
    const newRoomId = uuidv4();
    const maxPlayers = this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

    // 1. 상태를 IN_GAME 으로 변경
    for (const userId of participants) {
      await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
    }

    // 2. Agones Allocator 호출
    const allocation = await this.agonesAllocatorService.allocate();
    const gameserverIp = allocation?.gameserverIp;
    const gameserverName = allocation?.gameserverName;
    const port = allocation?.port;

    if (!gameserverIp || !port || !gameserverName) {
        // 할당 실패 시 에러 던짐 -> catch에서 롤백됨
        throw new Error(`[Agones] GameServer 할당 실패`);
    }

    this.logger.log(
        `[Agones] GameServer 할당 완료: ${gameserverName}(${gameserverIp}:${port})`,
    );

    // 3. [추가됨] 게임 서버 API 호출하여 봇 생성 및 룸 초기화 요청
    // Agones IP를 사용하여 해당 파드에 직접 요청
    try {
        // 주의: 게임 서버의 HTTP 포트가 3000번이라고 가정 (환경에 맞게 수정 필요)
        const gameApiUrl = `http://${gameserverIp}:${port}/internal/room`;
        
        await axios.post(gameApiUrl, {
            roomId: newRoomId,
            users: participants,
            maxPlayers: maxPlayers,
            mode: 'NORMAL',
        });
        this.logger.log(`[API] 게임 룸/봇 생성 요청 성공: ${newRoomId}`);
    } catch (error) {
        this.logger.error(`[API] 게임 룸 생성 요청 실패: ${error.message}`);
        // API 호출 실패는 치명적이지 않을 수 있으나(게임서버가 알아서 만들수도 있음), 로그는 남김
    }
   
    // 4. 매칭 토큰 발급
    const matchToken = this.matchingTokenService.issueToken({
    userIds: participants,
    roomId: newRoomId,
    expiresIn: '30s',
    });
    
    this.logger.log(`매칭 토큰 생성: ${matchToken}`);

    // 5. Route53 DNS 레코드 생성 (실패 시 fallback으로 직접 IP 사용)
    let host = gameserverIp;
    try {
    host = await this.route53Service.upsertGameServerARecord(
        gameserverName,
        gameserverIp,
    );
    this.logger.log(`[Route53] DNS 레코드 생성 완료: ${host}`);
    } catch (error) {
    this.logger.error(`[Route53] DNS 레코드 생성 실패, 직접 IP 사용`, error);
    }
    
    // 6. 유저에게 게임서버 정보 전달
    this.queueGateway.broadcastMatchFound(participants, {
        roomId: newRoomId,
        matchToken,
        gameUrl: `https://${host}:${port}`,
        host,
        port,
        gameServerName: gameserverName,
        mode: 'NORMAL',
    });
  }

  // ============================================
  // 보스모드 매칭 워커
  // ============================================

  @Interval(1000)
  async handleBossMatchmaking() {

    // 1️⃣ Pod 내부 중복 방지
    if (this.isBossProcessing) {
      return;
    }

    // 2️⃣ 클러스터 전역 리더 락
    const leader = await this.queueService.acquireLock(
      'matchmaking:boss:leader',
      2,
    );
    if (!leader) return;
    this.isBossProcessing = true;

    let participants: string[] | null = null;

    try {
      const maxPlayers =
        this.configService.get<number>('BOSS_MATCH_PLAYER_COUNT') ?? 5;

      // 1. 먼저 풀 매칭 시도
      participants =
        await this.queueService.extractBossMatchParticipants(maxPlayers);

      if (participants && participants.length === maxPlayers) {
        this.logger.log(
          `[보스모드] ${maxPlayers}명 풀 매칭 ${participants.join(', ')}`,
        );

        await this.createBossRoomAndNotify(participants);
        return;
      }

      // 2. 큐가 비었으면 아무 것도 안 함
      const queueLen = await this.queueService.getBossQueueLength();
      if (queueLen === 0) return;

      // 3. 마지막 유저 입장 시각 확인
      const lastJoinedAt = await this.queueService.getBossLastJoinedAt();
      if (!lastJoinedAt) return;

      const now = Date.now();
      const diff = now - lastJoinedAt;

      // 타임아웃 전이면 대기
      if (diff < this.TIMEOUT_MS) {
        this.logger.debug(
          `[보스모드] 대기열 인원=${queueLen}, 타임아웃 전(${diff}ms)`,
        );
        return;
      }

      // 4. 타임아웃 후 부분 매칭 실행
      participants = await this.queueService.extractBossMatchUpTo(maxPlayers);

      if (!participants || participants.length === 0) return;

      this.logger.log(
        `[보스모드 부분 매칭] 타임아웃 후 매칭: ${participants.join(', ')}`,
      );

      await this.createBossRoomAndNotify(participants);
    } catch (error) {
      this.logger.error('[보스모드] 매칭 처리 중 에러 발생', error);

      if (participants && participants.length > 0) {
        this.logger.warn(`[보스모드] 롤백 실행`);
        await this.queueService.rollbackBossParticipants(participants);
      }
    } finally {
      this.isBossProcessing = false;
    }
  }

  // ============================================
  // 보스 모드 처리 로직 (Agones 적용됨)
  // ============================================
  private async createBossRoomAndNotify(participants: string[]): Promise<void> {
    const newRoomId = uuidv4();
    const maxPlayers = this.configService.get<number>('BOSS_MATCH_PLAYER_COUNT') ?? 5;

    // 1. 상태를 IN_GAME 으로 변경
    for (const userId of participants) {
      await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
    }

    // 2. Agones Allocator 호출 (보스모드도 Agones 사용)
    const allocation = await this.agonesAllocatorService.allocate();
    const gameserverIp = allocation?.gameserverIp;
    const gameserverName = allocation?.gameserverName;
    const port = allocation?.port;

    if (!gameserverIp || !port || !gameserverName) {
        throw new Error(`[Agones-Boss] GameServer 할당 실패`);
    }

    // 3. 게임 룸 생성 요청 (API 호출)
    try {
        const gameApiUrl = `http://${gameserverIp}:${port}/internal/room`;
        await axios.post(gameApiUrl, {
            roomId: newRoomId,
            users: participants,
            maxPlayers: maxPlayers,
            mode: 'BOSS',
        });
        this.logger.log(`[API-Boss] 룸 생성 요청 성공: ${newRoomId}`);
    } catch (error) {
        this.logger.error(`[API-Boss] 룸 생성 요청 실패: ${error.message}`);
    }

    // 4. 매칭 토큰 발급
    const matchToken = this.matchingTokenService.issueToken({
        userIds: participants,
        roomId: newRoomId,
        expiresIn: '30s',
    });

    // 5. Route53 DNS (선택)
    let host = gameserverIp;
    try {
        host = await this.route53Service.upsertGameServerARecord(
            gameserverName,
            gameserverIp,
        );
    } catch (error) {
        this.logger.error(`[Route53-Boss] 실패, IP 사용`, error);
    }

    // 6. 유저 통지
    this.queueGateway.broadcastMatchFound(participants, {
      roomId: newRoomId,
      matchToken,
      host, // DNS 혹은 IP
      port,
      gameUrl: `https://${host}:${port}`, // 클라에서 사용하는 주소
      gameServerName: gameserverName,
      mode: 'BOSS',
    });
  }
}