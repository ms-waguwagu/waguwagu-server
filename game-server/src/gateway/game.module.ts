import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RankingModule } from '../ranking/ranking.module';
import { GhostModule } from '../engine/ghost/ghost.module';
import { PlayerModule } from '../engine/player/player.module';
import { BotModule } from 'src/engine/bot/bot.module';
import { CoreModule } from 'src/engine/core/core.module';
import { GameController } from './game.controller';

@Module({
  imports: [RankingModule, GhostModule, PlayerModule, BotModule, CoreModule],
  controllers: [GameController],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GameModule {}
