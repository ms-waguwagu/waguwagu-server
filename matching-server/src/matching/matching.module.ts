import { Module } from '@nestjs/common';
import { MatchingWorker } from './matching-worker.service';
import { MatchingGameLoopController } from './matching-gameloop.controller';
import { QueueModule } from '../queue/queue.module';
import { GameResultModule } from '../game-result/game-result.module';

const isLocal = process.env.NODE_ENV === 'local';

@Module({
  imports: [QueueModule, GameResultModule],
  controllers: [...(!isLocal ? [MatchingGameLoopController] : [])],
  providers: [...(!isLocal ? [MatchingWorker] : [])],
})
export class MatchingModule {}
