import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';
import { QueueGateway } from '../queue/queue.gateway';
import { v4 as uuidv4 } from 'uuid'; //방 ID 생성용 
import axios from 'axios';
import { PlayerStatus } from '../common/constants';

@Injectable()
export class MatchingWorker {
  private readonly logger = new Logger(MatchingWorker.name);
  private isProcessing = false; // 중복 실행 방지용 플래그
	private readonly TIMEOUT_MS = 7000; // 마지막 유저 기준 7초 ‼️테스트용‼️

  constructor(
		private readonly queueService: QueueService, 
		private readonly queueGateway: QueueGateway,
    private readonly configService: ConfigService,
  ) {}

  // 1초마다 실행
  @Interval(1000)
  async handleMatchmaking() {
    // 이전 작업이 아직 안 끝났으면 스킵 (오버랩 방지)
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    let participants: string[]  | null = null;

    try {
			
       const maxPlayers =
        this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5; 
			
				// 1. 먼저 5인 매칭 시도
      participants = await this.queueService.extractMatchParticipants(
        maxPlayers,
      );

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
        this.logger.warn(
          `롤백 실행: 유저 [${participants.join(', ')}] 재삽입`,
        );
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

    // 2. 게임 룸 생성 요청
    const gameServerUrl = this.configService.get<string>('GAME_SERVER_URL');

    const response = await axios.post(`${gameServerUrl}/internal/room`, {
      roomId: newRoomId,
      users: participants,
			botCount: botsToAdd,
			maxPlayers,
    });

		//디버깅용 
		this.logger.log(`목표 인원: ${maxPlayers}, 매칭 된 유저 수: ${humanCount}, 봇 추가: ${botsToAdd}`);
    const roomInfo = response.data;

    this.logger.log(`게임 룸 생성 완료: ${newRoomId}`);

    // 3. 매칭된 유저들에게 웹소켓으로 접속 정보 전송
    this.queueGateway.broadcastMatchFound(participants, {
      roomId: newRoomId,
      gameServerIp: roomInfo.ip || 'localhost',
      port: roomInfo.port || 3001,
    });
  }
}
