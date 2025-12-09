import { Module } from '@nestjs/common';
import { GameGateway } from './gateway/game.gateway';
import { GameEngineService } from './engine/game-engine.service';
import { PhysicsService } from './engine/physics.service';

@Module({
  providers: [GameGateway, GameEngineService, PhysicsService],
})
export class AppModule {}
