import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MatchingModule } from './matching/matching.module';
import { AuthModule } from './auth/auth.module';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
<<<<<<< HEAD
import { RedisModule } from '@nestjs-modules/ioredis';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GameResultModule } from './game-result/game-result.module';
import { UserEntity } from './entities/user.entity';
import { GameEntity } from './entities/game.entity';
import { GameResultEntity } from './entities/game-result.entity';

const isLocal = process.env.NODE_ENV === 'local';
=======
import { AgonesTestModule } from './agones-test/agones-test.module';
import { AgonesAllocatorModule } from './agones-allocator/agoness-allocator.module';
import { QueueModule } from './queue/queue.module';
>>>>>>> main

@Module({
  imports: [
    /* =========================
       Global Config / Schedule
    ========================= */
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    /* =========================
       Redis (❌ local 제외)
    ========================= */
    ...(!isLocal
      ? [
          RedisModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
              isGlobal: true,
              type: 'single',
              options: {
                host: configService.get<string>('REDIS_HOST'),
                port: configService.get<number>('REDIS_PORT'),
              },
            }),
          }),
        ]
      : []),

    /* =========================
       MySQL (❌ local 제외)
    ========================= */
    ...(!isLocal
      ? [
          TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'mysql',
              host: config.get<string>('DB_HOST'),
              port: Number(config.get<string>('DB_PORT') ?? 3306),
              username: config.get<string>('DB_USER'),
              password: config.get<string>('DB_PASSWORD'),
              database: config.get<string>('DB_NAME'),
              entities: [UserEntity, GameEntity, GameResultEntity],
              synchronize: false,
              logging: false,
            }),
          }),
        ]
      : []),

    /* =========================
       Domain Modules
    ========================= */
    AuthModule,
    MatchingModule,
    GameResultModule,
		AgonesTestModule,
		AgonesAllocatorModule,
		QueueModule,
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
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
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
