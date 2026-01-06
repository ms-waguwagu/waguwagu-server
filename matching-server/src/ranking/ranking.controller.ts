/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Query, Logger } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('ranking')
export class RankingController {
  private readonly logger = new Logger(RankingController.name);

  constructor(private readonly rankingService: RankingService) {}

  @Get('top')
  async getTopRanking(@Query('limit') limit?: string) {
    this.logger.log(`랭킹 조회 요청 수신 (limit: ${limit})`);
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const records = await this.rankingService.getTopRanking(limitNum);

    return records.map((record, index) => ({
      rank: index + 1,
      nickname: record.nickname,
      score: record.score,
      playedAt: record.playedAt, // 추가
    }));
  }
}
