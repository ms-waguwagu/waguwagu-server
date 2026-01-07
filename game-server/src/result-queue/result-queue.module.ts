import { Module } from '@nestjs/common';
import { ResultQueueService } from './result-queue.service';

@Module({
  providers: [ResultQueueService],
  exports: [ResultQueueService],
})
export class ResultQueueModule {}
