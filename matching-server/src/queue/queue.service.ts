/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { PlayerStatus } from '../common/constants';

@Injectable()
export class QueueService implements OnModuleInit {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private readonly SESSION_TTL = 3600; // 1시간

  private ENTER_QUEUE_LUA: string;
  private EXTRACT_MATCH_LUA: string;
  private CANCEL_MATCH_LUA: string;
  private EXTRACT_PARTIAL_MATCH_LUA: string;

  async onModuleInit() {
    const luaDirPath = path.join(__dirname, 'lua');

    this.ENTER_QUEUE_LUA = await fs.readFile(
      path.join(luaDirPath, 'enter-queue.lua'),
      'utf8',
    );

    this.EXTRACT_MATCH_LUA = await fs.readFile(
      path.join(luaDirPath, 'extract-match.lua'),
      'utf8',
    );

    this.CANCEL_MATCH_LUA = await fs.readFile(
      path.join(luaDirPath, 'cancel-match.lua'),
      'utf8',
    );

    this.EXTRACT_PARTIAL_MATCH_LUA = await fs.readFile(
      path.join(luaDirPath, 'extract-partial-match.lua'),
      'utf8',
    );

    // Redis 연결 확인
    console.log(`QueueService initialized with Redis (상태: ${this.redis.status})`);
  }

  // ============================================
  // 일반 매칭 큐 메서드
  // ============================================

  async enterQueue(userId: string, nickname: string): Promise<string> {
    const redis = this.redis;
    const sessionKey = `session:${userId}`;
    const queueKey = 'match_queue';
    const now = Date.now().toString();

    console.log(`[QueueService] enterQueue 호출: userId=${userId}, nickname=${nickname}, now=${now}`);

    const result = await redis.eval(
      this.ENTER_QUEUE_LUA,
      2,
      sessionKey,
      queueKey,
      nickname,
      now,
      this.SESSION_TTL.toString(),
      userId,
    );

    console.log(`[QueueService] enterQueue 결과:`, result);

    if (result === 'DUPLICATE_ENTRY') {
      throw new ConflictException('이미 대기열에 참여 중입니다.');
    }
    if (result === 'ALREADY_IN_GAME') {
      throw new ConflictException('이미 게임이 진행 중입니다.');
    }

    return result as string;
  }

  async extractMatchParticipants(count: number): Promise<string[] | null> {
    const redis = this.redis;
    const queueKey = 'match_queue';

    const result = await redis.eval(
      this.EXTRACT_MATCH_LUA,
      1,
      queueKey,
      count.toString(),
    );

    return result ? (result as string[]) : null;
  }

  async getLastJoinedAt(): Promise<number | null> {
    const redis = this.redis;
    const queueKey = 'match_queue';
    const key = `${queueKey}:lastJoinedAt`;
    const value = await redis.get(key);
    console.log(`[QueueService] getLastJoinedAt: key=${key}, value=${value}, parsed=${value ? Number(value) : null}`);
    return value ? Number(value) : null;
  }

  async extractMatchUpTo(count: number): Promise<string[] | null> {
    const redis = this.redis;
    const queueKey = 'match_queue';

    console.log(`[QueueService] extractMatchUpTo 호출: count=${count}, queueKey=${queueKey}`);
    
    const result = await redis.eval(
      this.EXTRACT_PARTIAL_MATCH_LUA,
      1,
      queueKey,
      count.toString(),
    );

    console.log(`[QueueService] extractMatchUpTo 결과:`, result);
    return result ? (result as string[]) : null;
  }

  async acquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
    const redis = this.redis;
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async cancelQueue(userId: string): Promise<void> {
    const redis = this.redis;
    const sessionKey = `session:${userId}`;
    const queueKey = 'match_queue';

    console.log(`\n매칭 취소 UserID: ${userId}`);

    const currentStatus = await redis.hget(sessionKey, 'status');
    console.log(`Redis 세션 상태 (HGET ${sessionKey} status):`, currentStatus);

    const result = await redis.eval(
      this.CANCEL_MATCH_LUA,
      2,
      sessionKey,
      queueKey,
      userId,
    );

    const resultStr = result as string;

    switch (resultStr) {
      case 'CANCELLED':
        return;

      case 'ALREADY_IN_GAME':
      case 'ALREADY_MATCHED_BY_WORKER':
        throw new ConflictException('이미 매칭이 성사되어 취소할 수 없습니다.');

      case 'NOT_QUEUED':
        throw new BadRequestException('대기열에 존재하지 않는 유저입니다.');

      default:
        throw new InternalServerErrorException(
          '매칭 취소 중 알 수 없는 오류 발생',
        );
    }
  }

  async recoverStaleInGameSession(userId: string): Promise<void> {
    console.log(`[QueueService] recoverStaleInGameSession 시작 - userId: ${userId}`);
    
    try {
      console.log('[QueueService] Redis 클라이언트 가져오는 중...');
      const redis = this.redis;
      console.log('[QueueService] Redis 클라이언트 획득 완료');
      
      const sessionKey = `session:${userId}`;
      console.log(`[QueueService] Redis HGETALL 호출 - key: ${sessionKey}`);
      
      const session = await redis.hgetall(sessionKey);
      console.log(`[QueueService] Redis HGETALL 완료 - 결과:`, session);
      
      if (!session || Object.keys(session).length === 0) {
        console.log('[QueueService] 세션 정보 없음 - 종료');
        return;
      }

      console.log(`[QueueService] 세션 상태: ${session.status}`);
      if (session.status !== PlayerStatus.IN_GAME) {
        console.log('[QueueService] IN_GAME 상태 아님 - 종료');
        return;
      }

      console.log('[QueueService] stale IN_GAME 세션 발견 - IDLE로 복구 중...');
      await redis.hset(sessionKey, 'status', PlayerStatus.IDLE);
      await redis.expire(sessionKey, this.SESSION_TTL);

      console.warn(
        `[RECOVER] stale IN_GAME session reset to IDLE (userId=${userId})`,
      );
    } catch (error) {
      console.error(`[QueueService] recoverStaleInGameSession 에러 - userId: ${userId}`, error);
      throw error;
    }
  }

  async getQueueLength(): Promise<number> {
    const redis = this.redis;
    const length = await redis.llen('match_queue');
    console.log(`[QueueService] getQueueLength: ${length}`);
    return length;
  }

  async getSessionInfo(userId: string): Promise<any> {
    const redis = this.redis;
    const sessionKey = `session:${userId}`;
    return redis.hgetall(sessionKey);
  }

  async updateStatus(userId: string, newStatus: PlayerStatus): Promise<void> {
    const redis = this.redis;
    const sessionKey = `session:${userId}`;
    await redis.hset(sessionKey, 'status', newStatus);
  }

  async rollbackParticipants(participants: string[]): Promise<void> {
    if (!participants || participants.length === 0) return;

    const redis = this.redis;
    const queueKey = 'match_queue';

    await redis.lpush(queueKey, ...participants);

    for (const userId of participants) {
      await this.updateStatus(userId, PlayerStatus.WAITING);
    }
  }


  // ============================================
  // 보스모드 큐 메서드
  // ============================================

  async enterBossQueue(userId: string, nickname: string): Promise<string> {
    const redis = this.redis;
    const sessionKey = `session:${userId}`;
    const queueKey = 'boss_match_queue';
    const now = Date.now().toString();

    const result = await redis.eval(
      this.ENTER_QUEUE_LUA,
      2,
      sessionKey,
      queueKey,
      nickname,
      now,
      this.SESSION_TTL.toString(),
      userId,
    );

    console.log('enterBossQueue result', result);

    if (result === 'DUPLICATE_ENTRY') {
      throw new ConflictException('이미 보스모드 대기열에 참여 중입니다.');
    }
    if (result === 'ALREADY_IN_GAME') {
      throw new ConflictException('이미 게임이 진행 중입니다.');
    }

    return result as string;
  }

  async extractBossMatchParticipants(count: number): Promise<string[] | null> {
    const redis = this.redis;
    const queueKey = 'boss_match_queue';

    const result = await redis.eval(
      this.EXTRACT_MATCH_LUA,
      1,
      queueKey,
      count.toString(),
    );

    return result ? (result as string[]) : null;
  }

  async getBossLastJoinedAt(): Promise<number | null> {
    const redis = this.redis;
    const queueKey = 'boss_match_queue';
    const value = await redis.get(`${queueKey}:lastJoinedAt`);
    return value ? Number(value) : null;
  }

  async extractBossMatchUpTo(count: number): Promise<string[] | null> {
    const redis = this.redis;
    const queueKey = 'boss_match_queue';

    const result = await redis.eval(
      this.EXTRACT_PARTIAL_MATCH_LUA,
      1,
      queueKey,
      count.toString(),
    );

    return result ? (result as string[]) : null;
  }

  async cancelBossQueue(userId: string): Promise<void> {
    const redis = this.redis;
    const sessionKey = `session:${userId}`;
    const queueKey = 'boss_match_queue';

    console.log(`\n보스모드 매칭 취소 UserID: ${userId}`);

    const currentStatus = await redis.hget(sessionKey, 'status');
    console.log(`Redis 세션 상태 (HGET ${sessionKey} status):`, currentStatus);

    const result = await redis.eval(
      this.CANCEL_MATCH_LUA,
      2,
      sessionKey,
      queueKey,
      userId,
    );

    const resultStr = result as string;

    switch (resultStr) {
      case 'CANCELLED':
        return;

      case 'ALREADY_IN_GAME':
      case 'ALREADY_MATCHED_BY_WORKER':
        throw new ConflictException('이미 매칭이 성사되어 취소할 수 없습니다.');

      case 'NOT_QUEUED':
        throw new BadRequestException(
          '보스모드 대기열에 존재하지 않는 유저입니다.',
        );

      default:
        throw new InternalServerErrorException(
          '보스모드 매칭 취소 중 알 수 없는 오류 발생',
        );
    }
  }

  async getBossQueueLength(): Promise<number> {
    const redis = this.redis;
    return redis.llen('boss_match_queue');
  }

  async rollbackBossParticipants(participants: string[]): Promise<void> {
    if (!participants || participants.length === 0) return;

    const redis = this.redis;
    const queueKey = 'boss_match_queue';

    await redis.lpush(queueKey, ...participants);

    for (const userId of participants) {
      await this.updateStatus(userId, PlayerStatus.WAITING);
    }
  }
}
