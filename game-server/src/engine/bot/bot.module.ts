import { Module } from '@nestjs/common';
import { BotManagerService } from './bot-manager.service';
import { BotMoveService } from './bot-move.service';

@Module({
  providers: [BotManagerService, BotMoveService],
  exports: [BotManagerService, BotMoveService],
})
export class BotModule {}
