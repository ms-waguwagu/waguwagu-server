import { Module } from '@nestjs/common';
import { BossController } from './boss.controller';
import { GameModule } from '../gateway/game.module';
import { BossRoomService } from './boss.service';

@Module({
	imports: [GameModule],
  controllers: [BossController],
	providers: [BossRoomService],
})
export class BossModule {}
