import { Controller, Get, Query } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('top')
  async getTopRanking(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const records = await this.rankingService.getTopRanking(limitNum);

    return records.map((record, index) => ({
      rank: index + 1,
      nickname: record.nickname,
      score: record.score,
      playedAt: record.playedAt,
    }));
  }
}
