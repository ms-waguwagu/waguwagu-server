import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RankingModule } from '../ranking/ranking.module';
import { GhostModule } from '../engine/ghost/ghost.module';
import { GameController } from './game.controller';

@Module({
  imports: [RankingModule, GhostModule],
  controllers: [GameController],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GameModule {}
