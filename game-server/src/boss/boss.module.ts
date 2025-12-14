import { Module } from '@nestjs/common';
import { BossController } from './boss.controller';
import { BossRoomService } from './boss.service';
import { BossManagerService } from './boss-manager.service';

@Module({
  controllers: [BossController],
	providers: [BossRoomService, BossManagerService],
	exports: [BossManagerService],
})
export class BossModule {}
