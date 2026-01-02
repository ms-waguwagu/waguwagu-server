import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MatchingModule } from './matching/matching.module';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { AgonesAllocatorModule } from './agones-allocator/agoness-allocator.module';
import { RankingModule } from './ranking/ranking.module'; // ✅ 추가

import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';

import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRecord } from './ranking/game-record.entity';

@Module({
  imports: [
    // =====================
    // 1️⃣ Global Config
    // =====================
    ConfigModule.forRoot({ isGlobal: true }),

    // =====================
    // 2️⃣ Scheduler (MatchingWorker)
    // =====================
    ScheduleModule.forRoot(),

    // =====================
    // 3️⃣ Aurora MySQL (TypeORM)
    // =====================
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql', // ⭐ Aurora MySQL = mysql
        host: configService.get<string>('DB_HOST'), // Aurora Cluster Endpoint
        port: 3306,
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),

        entities: [GameRecord],

        // ⚠️ prod에서는 false 권장
        synchronize: true,

        timezone: '+09:00',

        extra: {
          connectionLimit: 10,
        },

        logging: ['error'],
      }),
    }),

    // =====================
    // 4️⃣ Redis (Queue / Session)
    // =====================
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT');

        console.log('[BOOT] Redis config:', host, port);

        return {
          isGlobal: true,
          type: 'single',
          options: {
            host,
            port,
            tls: {
              servername: host,
              rejectUnauthorized: true,
            },
          },
        };
      },
    }),

    // =====================
    // 5️⃣ Feature Modules
    // =====================
    MatchingModule,
    AuthModule,
    QueueModule,
    RankingModule, // ✅ 핵심
    AgonesAllocatorModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
