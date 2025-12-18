// matching-server
import { Controller, Post, Body } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PlayerStatus } from '../common/constants';

@Controller('internal')
export class MatchingGameLoopController {
  constructor(private readonly queueService: QueueService) {}

  @Post('game-finished')
  async gameFinished(@Body() body: { userIds: string[] }) {
    console.log('🔥 game-finished user-google-Ids:', body.userIds);

    for (const userId of body.userIds) { //게임 종료 후 IDLE 상태로 변환
      const result = await this.queueService.updateStatus(userId, PlayerStatus.IDLE);
    }

    return { ok: true };
  }
}
