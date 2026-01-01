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
  private readonly TIMEOUT_MS = 7000; // 마지막 유저 기준 7초 ‼️테스트용‼️

  constructor(
    private readonly queueService: QueueService,
    private readonly queueGateway: QueueGateway,
    private readonly configService: ConfigService,
    private readonly agonesAllocatorService: AgonesAllocatorService,
    private readonly matchingTokenService: MatchingTokenService,
    private readonly route53Service: Route53Service,
  ) {}

  // 1초마다 실행
  @Interval(1000)
  async handleMatchmaking() {

    //클러스터 전역 리더 락
    const leader = await this.queueService.acquireLock(
      'matchmaking:leader',
      2, // TTL: 2초 (Interval 1초보다 살짝 크게)
    );

    if (!leader) {
      return;
    }

    // ⬇️ 기존 코드 그대로
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
        this.logger.log(
          `5명 풀 매칭 ${participants.join(', ')} (인원: ${participants.length})`,
        );

        await this.createRoomAndNotify(participants);
        return; // 5명 방 하나 만들고 끝 (finally에서 isProcessing 해제됨)
      }

      // 이제부터는 큐에 5명 미만이 있거나, 아예 없거나
      // 2. 큐가 비었으면 아무 것도 안 함
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

      // 디버깅용 !! 아직 15초 안 지났으면 기다리기만 함
      if (diff < this.TIMEOUT_MS) {
        this.logger.debug(
          `대기열 인원=${queueLen}, 마지막 입장 이후 ${diff}ms 경과 (타임아웃 전)`,
        );
        return;
      }

      // 4. 15초 동안 아무도 안 들어왔을 때 -> 현재 인원(최대 maxPlayers명)으로 부분 매칭 실행
      participants = await this.queueService.extractMatchUpTo(maxPlayers);

      if (!participants || participants.length === 0) {
        return;
      }

      this.logger.log(
        `[부분 매칭] 타임아웃 후 매칭: ${participants.join(
          ', ',
        )} (인원: ${participants.length})`,
      );

      await this.createRoomAndNotify(participants);
    } catch (error) {
      this.logger.error('매칭 처리 중 에러 발생', error);

      // 실패 시 롤백 -> 추출된 유저들을 다시 큐에 복구
      if (participants && participants.length > 0) {
        this.logger.warn(`롤백 실행: 유저 [${participants.join(', ')}] 재삽입`);
        await this.queueService.rollbackParticipants(participants);
      }
    } finally {
      this.isProcessing = false;
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

    // // 2. 게임 룸 생성 요청 (기존 API 호출 일단 유지)
    // const gameServerUrl = this.configService.get<string>('GAME_SERVER_URL');

    // const response = await axios.post(`${gameServerUrl}/internal/room`, {
    //   roomId: newRoomId,
    //   users: participants,
    //   botCount: botsToAdd,
    //   maxPlayers,
    // });

    //디버깅용
    // this.logger.log(
    //   `목표 인원: ${maxPlayers}, 매칭 된 유저 수: ${humanCount}, 봇 추가: ${botsToAdd}`,
    // );
    // const roomInfo = response.data;

    // this.logger.log(`게임 룸 생성 완료: ${newRoomId}`);

    // 3. 매칭된 유저들에게 웹소켓으로 접속 정보 전송
			if (!gameserverIp || !port || !gameserverName) {
				throw new Error(`[Agones] GameServer 할당 실패: ${gameserverName}(${gameserverIp}:${port})`);
			}
		
			// 매칭 완료 후
			const matchToken = this.matchingTokenService.issueToken({
				userIds: participants,
				roomId: newRoomId,
				expiresIn: '30s',
        maxPlayers,
        mode: 'NORMAL',
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
          `[보스모드] ${maxPlayers}명 풀 매칭 ${participants.join(', ')} (인원: ${participants.length})`,
        );

        await this.createBossRoomAndNotify(participants);
        return;
      }

      // 2. 큐가 비었으면 아무 것도 안 함
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

      // 타임아웃 전이면 기다리기만 함
      if (diff < this.TIMEOUT_MS) {
        this.logger.debug(
          `[보스모드] 대기열 인원=${queueLen}, 마지막 입장 이후 ${diff}ms 경과 (타임아웃 전)`,
        );
        return;
      }

      // 4. 타임아웃 후 부분 매칭 실행
      participants = await this.queueService.extractBossMatchUpTo(maxPlayers);

      if (!participants || participants.length === 0) {
        return;
      }

      this.logger.log(
        `[보스모드 부분 매칭] 타임아웃 후 매칭: ${participants.join(
          ', ',
        )} (인원: ${participants.length})`,
      );

      await this.createBossRoomAndNotify(participants);
    } catch (error) {
      this.logger.error('[보스모드] 매칭 처리 중 에러 발생', error);

      // 실패 시 롤백 -> 추출된 유저들을 다시 큐에 복구
      if (participants && participants.length > 0) {
        this.logger.warn(
          `[보스모드] 롤백 실행: 유저 [${participants.join(', ')}] 재삽입`,
        );
        await this.queueService.rollbackBossParticipants(participants);
      }
    } finally {
      this.isBossProcessing = false;
    }
  }

  // 보스모드: 방 생성 + 상태 변경 + 웹소켓 통지
  private async createBossRoomAndNotify(participants: string[]): Promise<void> {
    const newRoomId = uuidv4();
    const maxPlayers =
      this.configService.get<number>('BOSS_MATCH_PLAYER_COUNT') ?? 5;
    const humanCount = participants.length;
    const botsToAdd = Math.max(0, maxPlayers - humanCount);

    // 1. 상태를 IN_GAME 으로 변경
    for (const userId of participants) {
      await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
    }

    // // 2. 게임 룸 생성 요청
    // const gameServerUrl = this.configService.get<string>('GAME_SERVER_URL');

    // const response = await axios.post(`${gameServerUrl}/internal/room`, {
    //   roomId: newRoomId,
    //   users: participants,
    //   botCount: botsToAdd,
    //   maxPlayers,
    //   mode: 'BOSS',
    // });

    // this.logger.log(
    //   `[보스모드] 목표 인원: ${maxPlayers}, 매칭 된 유저 수: ${humanCount}, 봇 추가: ${botsToAdd}`,
    // );
    // const roomInfo = response.data;

    // this.logger.log(`[보스모드] 게임 룸 생성 완료: ${newRoomId}`);

    // 3. 매칭된 유저들에게 웹소켓으로 접속 정보 전송
    const matchToken = this.matchingTokenService.issueToken({
      userIds: participants,
      roomId: newRoomId,
      expiresIn: '30s',
      maxPlayers,
      mode: 'BOSS',
    });

    this.queueGateway.broadcastMatchFound(participants, {
      roomId: newRoomId,
      matchToken,
      mode: 'BOSS',
      // host: roomInfo.ip || 'localhost',
      // port: roomInfo.port || 3001,
      // Agones 연동 시 실제 호스트/포트 정보를 어떻게 가져올지 체크 필요
    });
  }
}
