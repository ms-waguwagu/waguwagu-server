import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingWorker } from './matching-worker.service';

import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [MatchingController],
  providers: [MatchingWorker],
})
export class MatchingModule {}
