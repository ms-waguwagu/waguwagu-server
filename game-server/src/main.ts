/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const gamePort = config.get<number>('GAME_PORT') ?? 3001;

  await app.listen(gamePort);
  console.log(`🎮 Game Server running on port ${gamePort}`);
}

bootstrap();
