import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GameResultService } from './game-result.service';
import { GameResultDto } from './dto/game-result.dto';
import { InternalTokenGuard } from '../common/guard/internal-token.guard';

const isLocal = process.env.NODE_ENV === 'local';

@Controller('internal')
export class GameResultController {
  constructor(private readonly service: GameResultService) {}

  @UseGuards(InternalTokenGuard)
  @Post('game-result')
  async saveGameResult(@Body() dto: GameResultDto) {
    if (isLocal) {
      // 🔹 local에서는 "받았음"까지만 보장
      console.log('📨 [LOCAL] GAME_RESULT received', {
        gameId: dto.gameId,
        roomId: dto.roomId,
        resultsCount: dto.results?.length ?? 0,
      });

      return { ok: true, mode: 'local' };
    }

    // 🔹 dev / prod
    await this.service.save(dto);
    return { ok: true };
  }
}
