import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH!),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH!),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  // CORS 설정
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = app.get(ConfigService);
  const gamePort = config.get<number>('GAME_PORT') ?? 3000;

  await app.listen(gamePort);
  console.log(`🎮 Game Server (HTTPS) running on port ${gamePort}`);
}

bootstrap();
