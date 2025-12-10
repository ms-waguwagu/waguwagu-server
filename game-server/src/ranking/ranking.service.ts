import { Injectable } from '@nestjs/common';

@Injectable()
export class RankingService {
  private rankings: {
    playerId: string;
    nickname: string;
    score: number;
    timestamp: number;
  }[] = [];

  // 점수 저장
  saveScore(playerId: string, nickname: string, score: number) {
    this.rankings.push({
      playerId,
      nickname,
      score,
      timestamp: Date.now(),
    });
  }

  // TOP 10 가져오기 (rank 추가)
  getTop10() {
    return this.rankings
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1, // 순위 추가
        playerId: item.playerId,
        nickname: item.nickname,
        score: item.score,
        timestamp: item.timestamp,
        playedAt: item.timestamp,
      }));
  }

  // 전체 랭킹 개수 (선택사항)
  getTotalCount() {
    return this.rankings.length;
  }

  // 특정 플레이어 최고 점수 (선택사항)
  getPlayerBestScore(playerId: string) {
    const playerScores = this.rankings.filter((r) => r.playerId === playerId);
    if (playerScores.length === 0) return null;

    return playerScores.reduce((max, curr) =>
      curr.score > max.score ? curr : max,
    );
  }
}
