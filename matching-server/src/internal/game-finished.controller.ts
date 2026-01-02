import { Body, Controller, Post } from '@nestjs/common';
import { GameFinishedService } from './game-finished.service';

@Controller('internal')
export class GameFinishedController {
  constructor(private readonly gameFinishedService: GameFinishedService) {}

  @Post('game-finished')
  async gameFinished(
    @Body()
    body: {
      roomId: string;
      results: {
        userId: string;
        nickname: string;
        score: number;
      }[];
    },
  ) {
    await this.gameFinishedService.handleGameFinished(
      body.roomId,
      body.results,
    );

    return { ok: true };
  }
}
