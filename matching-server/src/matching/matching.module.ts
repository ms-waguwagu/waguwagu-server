/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchingWorker } from './matching-worker.service';
import { MatchingGameLoopController } from './matching-gameloop.controller';

import { GameFinishedController } from '../internal/game-finished.controller';
import { GameFinishedService } from '../internal/game-finished.service';

import { RankingService } from '../ranking/ranking.service';
import { GameRecord } from '../ranking/game-record.entity';

import { QueueModule } from '../queue/queue.module';
import { AgonesAllocatorModule } from '../agones-allocator/agoness-allocator.module';
import { MatchingTokenService } from './matching-token.service';
import { Route53Service } from '../agones-allocator/route53.service';

@Module({
  imports: [
    QueueModule,
    AgonesAllocatorModule,

    // ⭐ RDS(GameRecord) 사용
    TypeOrmModule.forFeature([GameRecord]),
  ],
  controllers: [
    MatchingGameLoopController,
    GameFinishedController, // ⭐ 추가
  ],
  providers: [
    MatchingWorker,
    MatchingTokenService,
    Route53Service,

    // ⭐ game-finished 파이프라인
    GameFinishedService,
    RankingService,
  ],
})
export class MatchingModule {}
