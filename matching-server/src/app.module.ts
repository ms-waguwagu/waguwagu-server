import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MatchingModule } from './matching/matching.module';
import { AuthModule } from './auth/auth.module';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';

import { TypeOrmModule } from '@nestjs/typeorm';

// ⭐ 추가
import { GameResultModule } from './game-result/game-result.module';
import { UserEntity } from './entities/user.entity';
import { GameEntity } from './entities/game.entity';
import { GameResultEntity } from './entities/game-result.entity';

@Module({
  imports: [
    /* =========================
       Global Config / Schedule
    ========================= */
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    /* =========================
       Redis (세션 / 매칭)
    ========================= */
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

    /* =========================
       MySQL (RDS) ⭐
    ========================= */
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT') ?? 3306),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        entities: [UserEntity, GameEntity, GameResultEntity],
        synchronize: false, // ⭐ 반드시 false (DDL 직접 관리)
        logging: false,
      }),
    }),

    /* =========================
       Domain Modules
    ========================= */
    AuthModule,
    MatchingModule,

    // ⭐ 게임 결과 저장 (RDS)
    GameResultModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
