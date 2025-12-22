import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RankingService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 전체 랭킹 (누적 최고 점수 기준)
   */
  async getRanking(limit = 20) {
    const rows = await this.dataSource.query(
      `
      SELECT
        u.nickname,
        MAX(gr.score) AS score
      FROM game_results gr
      JOIN users u ON gr.google_sub = u.google_sub
      GROUP BY gr.google_sub, u.nickname
      ORDER BY score DESC
      LIMIT ?
      `,
      [limit],
    );

    return rows.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      score: Number(row.score),
    }));
  }
}
