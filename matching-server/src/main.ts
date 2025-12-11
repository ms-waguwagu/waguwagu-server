import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';





async function bootstrap() {
  const app = await NestFactory.create(AppModule, {logger: ['log', 'error', 'warn', 'debug', 'verbose'], // 모든 로그 활성화
  });
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
    origin: '*',
    credentials: false,
  });

  await app.listen(configService.get<string>('PORT') || 3000); 
}
bootstrap();
