import { Module } from '@nestjs/common';
import { CollisionService } from './collision.service';
import { GhostModule } from './ghost/ghost.module';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [
    GhostModule,   
    BotModule,    
  ],
  providers: [CollisionService],
  exports: [CollisionService],
})
export class CoreModule {}
