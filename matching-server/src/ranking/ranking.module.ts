import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRecord } from './game-record.entity';
import { RankingService } from './ranking.service';
import { RankingController } from './ranking.controller';
import { QueueModule } from '../queue/queue.module';
import { RankingPollingService } from './ranking-polling.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameRecord]), QueueModule],
  controllers: [RankingController],
  providers: [RankingService, RankingPollingService],
  exports: [RankingService],
})
export class RankingModule {}