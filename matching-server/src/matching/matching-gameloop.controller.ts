// matching-server
import { Controller, Post, Body } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PlayerStatus } from '../common/constants';
import axios from 'axios';

@Controller('internal')
export class MatchingGameLoopController {
  constructor(private readonly queueService: QueueService) {}

  @Post('game-finished')
  async gameFinished(
    @Body() body: { roomId: string; userIds: string[] },
  ) {
    const { roomId, userIds } = body;

    console.log('🏁 game-finished', { roomId, userIds });

    if (!roomId || !userIds || userIds.length === 0) return;

    for (const userId of userIds) {
      await this.queueService.updateStatus(
        userId,
        PlayerStatus.IDLE,
      );
    }
    return { ok: true };
  }
}