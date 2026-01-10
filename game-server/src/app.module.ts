import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RankingModule } from './ranking/ranking.module';
import { GameModule } from './gateway/game.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AgonesModule } from './agones/agones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AgonesModule,
    RankingModule, 
    GameModule, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
