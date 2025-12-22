import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { GameModule } from './gateway/game.module';
import { AiModule } from './ai/ai.module';
import { BossModule } from './boss/boss.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AiModule,
    BossModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
