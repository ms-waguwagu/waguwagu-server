import { Injectable } from '@nestjs/common';

interface RankingItem {
  playerId: string;
  nickname: string;
  score: number;
  playedAt: number;
}

@Injectable()
export class RankingService {
  // 🔥 임시 인메모리 랭킹 저장소
  private rankings: RankingItem[] = [];

  // ⭐ 점수 저장
  async saveScore(playerId: string, nickname: string, score: number) {
    const item: RankingItem = {
      playerId,
      nickname,
      score,
      playedAt: Date.now(),
    };

    this.rankings.push(item);
    return true;
  }

  // ⭐ TOP10 조회
  async getTop10() {
    return this.rankings
      // 🤖 봇 제외
      .filter((item) => !item.nickname.startsWith('bot-'))
      // 점수 내림차순
      .sort((a, b) => b.score - a.score)
      // TOP 10
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        playerId: item.playerId,
        nickname: item.nickname,
        score: item.score,
        playedAt: item.playedAt,
      }));
  }

  // ⭐ 특정 플레이어 최고 점수
  async getPlayerBestScore(playerId: string) {
    const scores = this.rankings
      .filter((item) => item.playerId === playerId)
      .sort((a, b) => b.score - a.score);

    return scores[0] || null;
  }
}
