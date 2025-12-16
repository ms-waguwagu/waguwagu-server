import { Module } from '@nestjs/common';
import { CollisionService } from './collision.service';
import { GhostModule } from '../ghost/ghost.module';
import { BotModule } from '../bot/bot.module';
import { PlayerModule } from '../player/player.module';
import { LifecycleService } from './lifecycle.service';
import { GameLoopService } from './game-loop.service';
import { BossModule } from '../../boss/boss.module';

@Module({
  imports: [GhostModule, PlayerModule, BotModule, BossModule],
  providers: [CollisionService, LifecycleService, GameLoopService],
  exports: [CollisionService, LifecycleService, GameLoopService],
})
export class CoreModule {}
