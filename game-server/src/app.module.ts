import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RankingModule } from './ranking/ranking.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    RankingModule, // ⭐ REST API 활성화
    GatewayModule, // ⭐ WebSocket + GameEngine 초기화
  ],
})
export class AppModule {}
