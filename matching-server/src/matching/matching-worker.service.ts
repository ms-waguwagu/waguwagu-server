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

    let participants: string[] = [];

    try {
      const participants = await this.queueService.extractMatchParticipants(this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5);

      if (!participants) {
        return;
      }

      this.logger.log(`매칭 성사! 참여자: ${participants.join(', ')}`);

			// 2. 고유 Room ID 생성
      const newRoomId = uuidv4();

			 // 매칭된 유저들을 IN_GAME 으로 설정 
      for (const userId of participants) {
        await this.queueService.updateStatus(userId, PlayerStatus.IN_GAME);
      }


      // 3. 게임 룸 생성 요청
			const gameServerUrl = this.configService.get<string>('GAME_SERVER_URL'); 
      const response = await axios.post(`${gameServerUrl}/internal/room`, {
        roomId: newRoomId,
        users: participants
      });
      
      const roomInfo = response.data;

      this.logger.log(`게임 룸 생성 완료~!: ${newRoomId}`);

      // 4. 5명의 유저에게 웹소켓으로 매칭 성공 & 접속 정보 전송
      this.queueGateway.broadcastMatchFound(participants, {
        roomId: newRoomId,
        gameServerIp: roomInfo.ip || 'localhost',
        port: roomInfo.port || 3001
      });

    } catch (error) {
      this.logger.error('매칭 처리 중 에러 발생', error);
      // 실패 시 롤백 로직 필요 (추출된 유저들을 다시 큐 맨 앞에 넣어줘야 함)
      if (participants && participants.length > 0) {
        this.logger.warn(`롤백 실행: 유저 [${participants.join(', ')}] 재삽입`);
        await this.queueService.rollbackParticipants(participants);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
