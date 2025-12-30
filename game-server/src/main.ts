import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

async function bootstrap() {
  const keyPath = process.env.TLS_KEY_PATH || '/etc/tls/tls.key';
  const certPath = process.env.TLS_CERT_PATH || '/etc/tls/tls.crt';

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = app.get(ConfigService);
  const gamePort = config.get<number>('GAME_PORT') ?? 3001;

  await app.listen(gamePort, '0.0.0.0');
  console.log(`🎮 Game Server (HTTPS / WSS) running on port ${gamePort}`);
}

bootstrap();
