import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MatchingModule } from './matching/matching.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';
import { AgonesAllocatorModule } from './agones-allocator/agoness-allocator.module';
import { QueueModule } from './queue/queue.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankingModule } from './ranking/ranking.module';
import { GameRecord } from './ranking/game-record.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MatchingModule,
    AuthModule,
	  AgonesAllocatorModule,
		QueueModule,
		RankingModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [GameRecord],
        synchronize: true, // 테이블 자동 생성 활성화
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT') || 6379;
        
        console.log('[BOOT] Redis 연결 설정 (TLS):', { host, port });
        
        return {
          type: 'single',
          options: {
            host,
            port,
            tls: {
              servername: host,
              rejectUnauthorized: false, // 자체 서명 인증서 허용
            },
            lazyConnect: false,
            enableReadyCheck: false,
            connectTimeout: 10000,
            commandTimeout: 5000,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
              const delay = Math.min(times * 500, 2000);
              return delay;
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
