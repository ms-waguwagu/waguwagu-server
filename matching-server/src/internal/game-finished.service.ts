import { Injectable, Logger } from '@nestjs/common';
import { RankingService } from '../ranking/ranking.service';
import { QueueService } from '../queue/queue.service';
import { PlayerStatus } from '../common/constants';

@Injectable()
export class GameFinishedService {
  private readonly logger = new Logger(GameFinishedService.name);

  constructor(
    private readonly rankingService: RankingService,
    private readonly queueService: QueueService,
  ) {}

  async handleGameFinished(
    roomId: string,
    results: { userId: string; nickname: string; score: number }[],
  ) {
    if (!results || results.length === 0) {
      this.logger.warn(`game-finished ignored roomId=${roomId}`);
      return;
    }

    await this.rankingService.saveGameResults(roomId, results);

    for (const r of results) {
      await this.queueService.updateStatus(r.userId, PlayerStatus.IDLE);
    }
  }
}
