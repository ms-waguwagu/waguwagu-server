import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GhostModule } from '../engine/ghost/ghost.module';
import { PlayerModule } from '../engine/player/player.module';
import { BotModule } from 'src/engine/bot/bot.module';
import { CoreModule } from 'src/engine/core/core.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { BossModule } from '../boss/boss.module';
import { AgonesModule } from '../agones/agones.module';

@Module({
  imports: [
    GhostModule,
    PlayerModule,
    BotModule,
    CoreModule,
    BossModule,
    AgonesModule,
  ],
  controllers: [GameController],
  providers: [GameGateway, GameService],
  exports: [GameGateway],
})
export class GameModule {}
