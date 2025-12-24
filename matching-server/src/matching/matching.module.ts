import { Module } from '@nestjs/common';
import { MatchingWorker } from './matching-worker.service';
import { MatchingGameLoopController } from './matching-gameloop.controller';
import { QueueModule } from '../queue/queue.module';
import { GameResultModule } from '../game-result/game-result.module';
import { AgonesAllocatorService } from '../agones-allocator/agoness-allocator.service';
import { AgonesAllocatorModule } from '../agones-allocator/agoness-allocator.module';

const isLocal = process.env.NODE_ENV === 'local';
@Module({
  imports: [
    QueueModule,
    AgonesAllocatorModule, // 메인에서 추가된 모듈
    GameResultModule, // 내 브랜치에서 추가한 모듈 (있다면 유지)
  ],
  controllers: [...(!isLocal ? [MatchingGameLoopController] : [])],
  providers: [
    ...(!isLocal ? [MatchingWorker] : []),
    AgonesAllocatorService, // 메인에서 추가된 서비스
  ],
})
export class MatchingModule {}
