import { Injectable, Logger } from '@nestjs/common';
import { SqsResultService } from './sqs-result.service';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(private readonly sqsResultService: SqsResultService) {}


  // 게임 결과를 SQS로 전송  
  async saveResults(
    roomId: string,
    results: { userId: string; nickname: string; score: number }[],
  ) {
    if (results.length === 0) return;

    this.logger.log(`[Ranking] 게임 결과 SQS 전송 시도: roomId=${roomId}, count=${results.length}`);
    await this.sqsResultService.sendGameResult(roomId, results);
  }

  // 호환성을 위해 남겨두는 메서드들
  async saveScore(playerId: string, nickname: string, score: number) {
    // 개별 점수 저장이 필요한 경우 여기서 처리하거나 results에 합쳐서 보낼 수 있음
    return true;
  }

  async getTop10() {
    return [];
  }
}
