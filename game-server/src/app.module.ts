import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GameGateway } from './gateway/game.gateway';
import { GameEngineService } from './engine/game-engine.service';
import { PhysicsService } from './engine/physics.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,     // ⭐ 전역에서 ConfigService 사용 가능
    }),
  ],
  providers: [GameGateway, GameEngineService, PhysicsService],
})
export class AppModule {}
