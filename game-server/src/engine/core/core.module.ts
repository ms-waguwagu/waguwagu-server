import { Module } from '@nestjs/common';
import { CollisionService } from './collision.service';
import { GhostModule } from '../ghost/ghost.module';
import { BotModule } from '../bot/bot.module';
import { PlayerModule } from '../player/player.module';
import { LifecycleService } from './lifecycle.service';

@Module({
  imports: [GhostModule, PlayerModule, BotModule],
  providers: [CollisionService, LifecycleService],
  exports: [CollisionService, LifecycleService],
})
export class CoreModule {}
