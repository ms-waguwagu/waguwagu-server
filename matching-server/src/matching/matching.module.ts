import { Module } from '@nestjs/common';
import { MatchingWorker } from './matching-worker.service';
import { MatchingGameLoopController } from './matching-gameloop.controller';
import { QueueModule } from '../queue/queue.module';
import { AgonesAllocatorService } from '../agones-allocator/agoness-allocator.service';
import { AgonesAllocatorModule } from '../agones-allocator/agoness-allocator.module';
import { MatchingTokenService } from './matching-token.service';

@Module({
  imports: [QueueModule, AgonesAllocatorModule],
  controllers: [MatchingGameLoopController],
  providers: [MatchingWorker, AgonesAllocatorService, MatchingTokenService],
})
export class MatchingModule {}
