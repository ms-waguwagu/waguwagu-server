import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = Number(configService.get('MATCHING_PORT')) || 3000;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: '*',
    credentials: false,
  });

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Matching server listening on port ${port}`);
}

bootstrap();
