/* eslint-disable @typescript-eslint/no-unsafe-return */
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

  async getTopRanking(limit = 100) {
    // 유저별 최고 점수만 추출하는 서브쿼리
		// 닉네임별로 할지 결정 필요
    const subQuery = this.repo
      .createQueryBuilder('gr')
      .select('gr.userId', 'userId')
      .addSelect('MAX(gr.score)', 'maxScore')
      .groupBy('gr.userId');

    // 메인 쿼리: 서브쿼리 결과와 조인하여 최고 점수 기록만 가져오기
    const results = await this.repo
      .createQueryBuilder('record')
      .innerJoin(
        `(${subQuery.getQuery()})`,
        'best',
        'record.userId = best.userId AND record.score = best.maxScore',
      )
      .orderBy('record.score', 'DESC')
      .addOrderBy('record.playedAt', 'DESC') // 동점일 경우 최신 기록 우선
      .take(limit)
      .getMany();

    return results;
  }
}
