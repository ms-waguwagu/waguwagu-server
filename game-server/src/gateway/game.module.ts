import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RankingModule } from '../ranking/ranking.module';
import { GhostModule } from '../engine/ghost/ghost.module';

@Module({
  imports: [RankingModule, GhostModule],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GameModule {}
