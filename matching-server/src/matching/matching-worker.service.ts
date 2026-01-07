import { Injectable, Logger } from '@nestjs/common';
import * as AWSXRay from 'aws-xray-sdk-core';
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
  private readonly TIMEOUT_MS = 7000; // 마지막 유저 기준 7초 (테스트용)

  constructor(
    private readonly queueService: QueueService,
    private readonly queueGateway: QueueGateway,
    private readonly configService: ConfigService,
    private readonly agonesAllocatorService: AgonesAllocatorService,
    private readonly matchingTokenService: MatchingTokenService,
    private readonly route53Service: Route53Service,
  ) {}

  async onModuleInit() {
    this.logger.log('매칭 워커 서비스가 시작되었습니다');
  }

  // 2초마다 실행
  @Interval(2000)
  async handleMatchmaking() {
    const ns = AWSXRay.getNamespace();
    if (!ns) {
      // X-Ray 네임스페이스가 없으면 일반 실행
      await this.processMatchmaking();
      return;
    }

    await ns.runPromise(async () => {
      const segment = new AWSXRay.Segment('MatchingWorker:handleMatchmaking');
      AWSXRay.setSegment(segment);
      try {
        await this.processMatchmaking(segment);
      } catch (e) {
        segment.addError(e);
      } finally {
        segment.close();
      }
    });
  }

  private async processMatchmaking(segment?: any) {
    try {
      //클러스터 전역 리더 락
      const leader = await this.queueService.acquireLock(
        'matchmaking:leader',
        2, // TTL: 2초
      );

      if (!leader) {
        return;
      }

      if (this.isProcessing) {
        return;
      }
      this.isProcessing = true;

      let participants: string[] | null = null;

      try {
        const maxPlayers =
          this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

        // 1. 먼저 5인 매칭 시도
        participants =
          await this.queueService.extractMatchParticipants(maxPlayers);

        if (participants && participants.length === maxPlayers) {
          this.logger.log(`5인 풀 매칭 성공: ${participants.join(', ')}`);
          await this.createRoomAndNotify(participants);
          return;
        }

        // 2. 큐 상태 확인
        const queueLen = await this.queueService.getQueueLength();
        if (queueLen === 0) {
          return;
        }

        // 3. 마지막 유저 입장 시각 확인
        const lastJoinedAt = await this.queueService.getLastJoinedAt();
        if (!lastJoinedAt) {
          return;
        }

        const now = Date.now();
        const diff = now - lastJoinedAt;

        // 타임아웃 전이면 대기
        if (diff < this.TIMEOUT_MS) {
          return;
        }

        // 4. 15초 동안 아무도 안 들어왔을 때 -> 현재 인원(최대 maxPlayers명)으로 부분 매칭 실행
        participants = await this.queueService.extractMatchUpTo(maxPlayers);

        if (!participants || participants.length === 0) {
          return;
        }

        this.logger.log(
          `[부분 매칭] 타임아웃 후 매칭: ${participants.join(', ')} (인원: ${participants.length})`,
        );

        await this.createRoomAndNotify(participants);
      } catch (error) {
        this.logger.error('매칭 처리 중 에러 발생', error);
        if (segment) segment.addError(error);

          // 실패 시 롤백 -> 추출된 유저들을 다시 큐에 복구
        if (participants && participants.length > 0) {
          this.logger.warn(`롤백 실행: 유저 [${participants.join(', ')}] 재삽입`);
          await this.queueService.rollbackParticipants(participants);
        }
      } finally {
        this.isProcessing = false;
      }
    } catch (e) {
      this.logger.error('리더 락 획득 중 에러', e);
      if (segment) segment.addError(e);
    }
  }

  // 공통: 방 생성 + 상태 변경 + 웹소켓 통지
  private async createRoomAndNotify(participants: string[]): Promise<void> {
    const newRoomId = uuidv4();
    const maxPlayers =
      this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;
    const humanCount = participants.length;
    const botsToAdd = Math.max(0, maxPlayers - humanCount);

    // 1. 상태를 IN_GAME 으로 변경
    for (const userId of participants) {
      await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
    }

    console.log('createRoomAndNotify', participants);
    // Agones Allocator 호출
    const allocation = await this.agonesAllocatorService.allocate();
    const gameserverIp = allocation?.gameserverIp;
    const gameserverName = allocation?.gameserverName;
    const port = allocation?.port;

    if (allocation) {
      this.logger.log(
        `[Agones] Allocator가 GameServer ${gameserverName}(${gameserverIp}:${port})를 할당했습니다`,
      );
      this.logger.log(
        `[Agones] { "gameServerName": "${gameserverName}", "address": "${gameserverIp}", "port": ${port} }`,
      );
    }

    // 2. 매칭된 유저들에게 웹소켓으로 접속 정보 전송
			if (!gameserverIp || !port || !gameserverName) {
				throw new Error(`[Agones] GameServer 할당 실패: ${gameserverName}(${gameserverIp}:${port})`);
			}
		
			// 매칭된 유저들의 닉네임 정보 가져오기
			const userNicknames = await this.getUserNicknames(participants);

			// 매칭 완료 후
			const matchToken = this.matchingTokenService.issueToken({
				userIds: participants,
				roomId: newRoomId,
				expiresIn: '30s',
        maxPlayers,
        mode: 'NORMAL',
				userNicknames,
			});
			
			this.logger.log(`매칭 토큰 생성: ${matchToken}`);

      // Route53 DNS 레코드 생성 (실패 시 fallback으로 직접 IP 사용)
      let host = gameserverIp; // 기본값: 직접 IP
      try {
        host = await this.route53Service.upsertGameServerARecord(
          gameserverName,
          gameserverIp,
        );
        this.logger.log(`[Route53] DNS 레코드 생성 완료: ${host}`);
      } catch (error) {
        this.logger.error(`[Route53] DNS 레코드 생성 실패, 직접 IP 사용: ${gameserverIp}`, error);
      }
			
			// 유저에게 게임서버 정보 전달
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

  // 보스모드 매칭 워커 (1초마다 실행)
  @Interval(1000)
  async handleBossMatchmaking() {
    const ns = AWSXRay.getNamespace();
    if (!ns) {
      await this.processBossMatchmaking();
      return;
    }

    await ns.runPromise(async () => {
      const segment = new AWSXRay.Segment('MatchingWorker:handleBossMatchmaking');
      AWSXRay.setSegment(segment);
      try {
        await this.processBossMatchmaking(segment);
      } catch (e) {
        segment.addError(e);
      } finally {
        segment.close();
      }
    });
  }

  private async processBossMatchmaking(segment?: any) {
    try {
      if (this.isBossProcessing) {
        return;
      }

      // 클러스터 전역 리더 락
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
            `[보스모드] ${maxPlayers}인 풀 매칭 성공: ${participants.join(', ')}`,
          );
          await this.createBossRoomAndNotify(participants);
          return;
        }

        // 2. 큐 상태 확인
        const queueLen = await this.queueService.getBossQueueLength();
        if (queueLen === 0) {
          return;
        }

        // 3. 마지막 유저 입장 시각 확인
        const lastJoinedAt = await this.queueService.getBossLastJoinedAt();
        if (!lastJoinedAt) {
          return;
        }

        const now = Date.now();
        const diff = now - lastJoinedAt;

        // 타임아웃 전이면 대기
        if (diff < this.TIMEOUT_MS) {
          this.logger.debug(
            `대기열 인원=${queueLen}, 마지막 참여 이후 ${diff}ms 경과 (매칭 대기 중)`,
          );
          return;
        }

        // 4. 타임아웃 후 부분 매칭 실행
        participants = await this.queueService.extractBossMatchUpTo(maxPlayers);

        if (!participants || participants.length === 0) {
          return;
        }

        this.logger.log(
          `[보스모드 부분 매칭] 타임아웃 후 매칭: ${participants.join(', ')} (인원: ${participants.length})`,
        );

        await this.createBossRoomAndNotify(participants);
      } catch (error) {
        this.logger.error('[보스모드] 매칭 처리 중 에러 발생', error);
        if (segment) segment.addError(error);

        if (participants && participants.length > 0) {
          this.logger.warn(
            `[보스모드] 롤백 실행: 유저 [${participants.join(', ')}] 재삽입`,
          );
          await this.queueService.rollbackBossParticipants(participants);
        }
      } finally {
        this.isBossProcessing = false;
      }
    } catch (e) {
      this.logger.error('[보스모드] 리더 락 획득 중 에러', e);
      if (segment) segment.addError(e);
    }
  }

  // 보스모드: 방 생성 + 상태 변경 + 웹소켓 통지
  private async createBossRoomAndNotify(participants: string[]): Promise<void> {
    const newRoomId = uuidv4();
    const maxPlayers =
      this.configService.get<number>('BOSS_MATCH_PLAYER_COUNT') ?? 5;

    // 1. 상태를 IN_GAME 으로 변경
    for (const userId of participants) {
      await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
    }

    // 2. Agones Allocator 호출
    const allocation = await this.agonesAllocatorService.allocate();
    const gameserverIp = allocation?.gameserverIp;
    const gameserverName = allocation?.gameserverName;
    const port = allocation?.port;

    if (allocation) {
      this.logger.log(
        `[Agones-보스] Allocator가 GameServer ${gameserverName}(${gameserverIp}:${port})를 할당했습니다`,
      );
    }

    if (!gameserverIp || !port || !gameserverName) {
      throw new Error(`[Agones-보스] GameServer 할당 실패: ${gameserverName}(${gameserverIp}:${port})`);
    }

    // 매칭된 유저들의 닉네임 정보 가져오기
    const userNicknames = await this.getUserNicknames(participants);

    // 3. 매칭 완료 후 토큰 발행
    const matchToken = this.matchingTokenService.issueToken({
      userIds: participants,
      roomId: newRoomId,
      expiresIn: '30s',
      maxPlayers,
      mode: 'BOSS',
      userNicknames,
    });

    // 4. Route53 DNS 레코드 생성 (생략 가능하면 생략, 일단 일반 모드와 동일하게 적용)
    let host = gameserverIp;
    try {
      host = await this.route53Service.upsertGameServerARecord(
        gameserverName,
        gameserverIp,
      );
      this.logger.log(`[Route53-보스] DNS 레코드 생성 완료: ${host}`);
    } catch (error) {
      this.logger.error(`[Route53-보스] DNS 레코드 생성 실패, 직접 IP 사용: ${gameserverIp}`, error);
    }

    this.queueGateway.broadcastMatchFound(participants, {
      roomId: newRoomId,
      matchToken,
      gameUrl: `https://${host}:${port}`,
      host,
      port,
      gameServerName: gameserverName,
      mode: 'BOSS',
    });
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
