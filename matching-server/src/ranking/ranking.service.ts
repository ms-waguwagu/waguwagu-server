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

  getTopRanking(limit = 100) {
    return this.repo.find({
      order: { score: 'DESC' },
      take: limit,
    });
  }
}
