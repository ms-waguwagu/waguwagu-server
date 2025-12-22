import { Module } from '@nestjs/common';
import { GameResultController } from './game-result.controller';
import { GameResultService } from './game-result.service';
import { InternalTokenGuard } from '../common/guard/internal-token.guard';

@Module({
  controllers: [GameResultController],
  providers: [GameResultService, InternalTokenGuard],
})
export class GameResultModule {}
