import { Controller, Get, Post, Body } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('ranking')
export class RankingController {
  constructor(private rankingService: RankingService) {}

  @Get('top')
  getTopRankings() {
    return this.rankingService.getTop10();
  }

  // 👇 POST 엔드포인트 추가
  @Post('save')
  saveScore(
    @Body() body: { playerId?: string; nickname: string; score: number },
  ) {
    const playerId = body.playerId || `player_${Date.now()}`;
    this.rankingService.saveScore(playerId, body.nickname, body.score);
    return { success: true, message: '점수가 저장되었습니다' };
  }
}
