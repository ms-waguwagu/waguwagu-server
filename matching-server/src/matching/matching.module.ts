import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchingWorker } from './matching-worker.service';
import { MatchingGameLoopController } from './matching-gameloop.controller';

import { GameRecord } from '../ranking/game-record.entity';

import { QueueModule } from '../queue/queue.module';
import { AgonesAllocatorModule } from '../agones-allocator/agoness-allocator.module';
import { MatchingTokenService } from './matching-token.service';
import { Route53Service } from '../agones-allocator/route53.service';

@Module({
  imports: [
    QueueModule,
    AgonesAllocatorModule,
    TypeOrmModule.forFeature([GameRecord]),
  ],
  controllers: [MatchingGameLoopController],
  providers: [
    MatchingWorker,
    MatchingTokenService,
    Route53Service,
    // ⭐ GameFinished 관련은 모두 RankingModule에서 관리
  ],
})
export class MatchingModule {}
