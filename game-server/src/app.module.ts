import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RankingModule } from './ranking/ranking.module';
import { GameModule } from './gateway/game.module';
import { AiModule } from './ai/ai.module';
import { BossModule } from './boss/boss.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AgonesModule } from './agones/agones.module';
import { ResultQueueModule } from './result-queue/result-queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AgonesModule,
    AiModule,
    BossModule,
    RankingModule, 
    GameModule, 
    ResultQueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
