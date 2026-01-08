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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MatchingModule,
    AuthModule,
	  AgonesAllocatorModule,
		QueueModule,
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
