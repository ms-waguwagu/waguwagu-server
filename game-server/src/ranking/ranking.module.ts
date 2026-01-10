import { Module } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { SqsResultService } from './sqs-result.service';

@Module({
  providers: [RankingService, SqsResultService],
  exports: [RankingService],
})
export class RankingModule {}
