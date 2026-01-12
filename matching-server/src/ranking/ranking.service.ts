
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRecord } from './game-record.entity';

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(GameRecord)
    private readonly repo: Repository<GameRecord>,
  ) {}

  async saveGameResults(
    roomId: string,
    results: { userId: string; nickname: string; score: number }[],
  ) {
    if (results.length === 0) return;

    await this.repo.insert(
      results.map((r) => ({
        roomId,
        userId: r.userId,
        nickname: r.nickname,
        score: r.score,
      })),
    );
  }

  async getTopRanking(limit = 10) {
    // 닉네임별 최고 점수만 추출하는 서브쿼리
    const subQuery = this.repo
      .createQueryBuilder('gr')
      .select('gr.nickname', 'nickname')
      .addSelect('MAX(gr.score)', 'maxScore')
      .groupBy('gr.nickname');

    // 메인 쿼리: 서브쿼리 결과와 조인하여 최고 점수 기록만 가져오기
    const results = await this.repo
      .createQueryBuilder('record')
      .innerJoin(
        `(${subQuery.getQuery()})`,
        'best',
        'record.nickname = best.nickname AND record.score = best.maxScore',
      )
      .orderBy('record.score', 'DESC')
      .addOrderBy('record.playedAt', 'DESC') // 동점일 경우 최신 기록 우선
      .take(limit)
      .getMany();

    return results;
  }
}
