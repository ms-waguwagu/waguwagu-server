import { Module } from '@nestjs/common';
import { MatchingWorker } from './matching-worker.service';

import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [MatchingWorker],
})
export class MatchingModule {}
