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
import { RankingModule } from './ranking/ranking.module';
import { TypeOrmModule } from '@nestjs/typeorm';
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
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT') || 3306,
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME') || 'wagudb',
        entities: [GameRecord],
        synchronize: true,
        timezone: '+09:00',
        extra: {
          connectionLimit: 10,
        },
        logging: false,
      }),
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT') || 6379;
        
        console.log('[BOOT] Redis 연결 설정:', { host, port, tls: true });
        
        return {
          type: 'single',
          options: {
            host,
            port,
            // AuthEnabled: false이므로 비밀번호 불필요
            // TransitEncryption: true이므로 TLS 필수
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
              if (times > 3) {
                console.error('[Redis] 최대 재시도 횟수 초과');
                return null;
              }
              const delay = Math.min(times * 500, 2000);
              console.log(`[Redis] 재시도 ${times}회, ${delay}ms 대기`);
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
