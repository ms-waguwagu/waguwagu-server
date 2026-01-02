// matching-server/src/ranking/ranking.controller.ts
import { Controller, Get } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('api/game/ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('top')
  getTopRanking() {
    return this.rankingService.getTopRanking();
  }
}
