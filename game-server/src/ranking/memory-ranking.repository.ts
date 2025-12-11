// 로컬 테스트 용

import { RankingRepository } from './ranking.repository';

export class MemoryRankingRepository implements RankingRepository {
  private scores: Map<string, { nickname: string; score: number }> = new Map();

  async saveScore(playerId: string, nickname: string, score: number) {
    const current = this.scores.get(playerId);

    if (!current || score > current.score) {
      this.scores.set(playerId, { nickname, score });
    }
  }

  async getWeeklyRanking() {
    return [...this.scores.entries()]
      .map(([playerId, data]) => ({
        playerId,
        nickname: data.nickname,
        score: data.score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // top 50
  }
}
