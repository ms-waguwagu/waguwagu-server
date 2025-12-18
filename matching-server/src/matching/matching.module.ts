import { Module } from '@nestjs/common';
import { MatchingWorker } from './matching-worker.service';
import { MatchingGameLoopController } from './matching-gameloop.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [MatchingGameLoopController],
  providers: [MatchingWorker],
})
export class MatchingModule {}
