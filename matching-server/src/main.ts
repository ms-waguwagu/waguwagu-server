import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

	app.use(cookieParser());

  await app.listen(configService.get<string>('PORT') || 3000); // 개발환경에서는 기본값 허용
}
bootstrap();
