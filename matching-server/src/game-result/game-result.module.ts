import { Module } from '@nestjs/common';
import { GameResultController } from './game-result.controller';
import { GameResultService } from './game-result.service';

@Module({
  controllers: [GameResultController],
  providers: [GameResultService],
})
export class GameResultModule {}
