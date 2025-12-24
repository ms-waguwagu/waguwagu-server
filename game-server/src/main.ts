/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정 추가 
  app.enableCors({
    origin: '*', // 개발 환경: 모든 origin 허용
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = app.get(ConfigService);
  const gamePort = config.get<number>('GAME_PORT') ?? 3001;

  await app.listen(gamePort);
  console.log(`🎮 Game Server running on port ${gamePort}`);
}

bootstrap();
