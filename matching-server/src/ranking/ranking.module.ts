import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRecord } from './game-record.entity';
import { RankingService } from './ranking.service';
import { RankingController } from './ranking.controller';
import { GameFinishedService } from '../internal/game-finished.service'; // ⭐ 추가
import { GameFinishedConsumer } from './game-finished.consumer'; // ⭐ 추가
import { QueueModule } from '../queue/queue.module'; // ⭐ GameFinishedService가 QueueService 사용

@Module({
  imports: [TypeOrmModule.forFeature([GameRecord]), QueueModule],
  controllers: [RankingController],
  providers: [RankingService, GameFinishedService, GameFinishedConsumer],
  exports: [RankingService],
})
export class RankingModule {}
