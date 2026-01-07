import * as AWSXRay from 'aws-xray-sdk-core';

AWSXRay.enableAutomaticMode(); 
AWSXRay.captureHTTPsGlobal(require('http'));
AWSXRay.captureHTTPsGlobal(require('https'));
AWSXRay.setContextMissingStrategy('LOG_ERROR');

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { closeRedis } from './common/redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: ['https://www.waguwagu.cloud', 'https://waguwagu.cloud'],
    credentials: true,
  });

  const port = Number(configService.get('MATCHING_PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Matching Server is running on port ${port}`);

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n⚠️  Received ${signal}, starting graceful shutdown...`);

    try {
      // 1. Stop accepting new requests
      await app.close();
      console.log('✅ NestJS application closed');

      // 2. Close Redis connection
      await closeRedis();
      console.log('✅ Redis connection closed');

      console.log('👋 Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
}

bootstrap();
