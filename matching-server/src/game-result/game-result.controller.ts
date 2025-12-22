import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GameResultService } from './game-result.service';
import { GameResultDto } from './dto/game-result.dto';
import { InternalTokenGuard } from '../common/guard/internal-token.guard';

@Controller('internal')
export class GameResultController {
  constructor(private readonly service: GameResultService) {}

  @UseGuards(InternalTokenGuard)
  @Post('game-result')
  async saveGameResult(@Body() dto: GameResultDto) {
    await this.service.save(dto);
    return { ok: true };
  }
}
