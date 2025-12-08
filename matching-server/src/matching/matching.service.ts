import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import fs from 'fs/promises'; // fs 모듈 임포트
import path from 'path'; // path 모듈 임포트

@Injectable()
export class MatchingService implements OnModuleInit {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private readonly SESSION_TTL = 3600; // 1시간

  private ENTER_QUEUE_LUA: string;
  private EXTRACT_MATCH_LUA: string;
  private CANCEL_MATCH_LUA: string;

  async onModuleInit() {
    // 프로젝트 루트 경로를 기준으로 파일 경로 지정
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
  }

  // 대기열 진입 (Lua 기반)
  // 세션 저장 + TTL + 큐 등록을 하나의 스크립트로 처리
  async enterQueue(userId: string, nickname: string): Promise<string> {
    const sessionKey = `session:${userId}`;
    const queueKey = 'match_queue';
    const now = Date.now().toString();

    const result = await this.redis.eval(
      this.ENTER_QUEUE_LUA,
      2, // KEYS 개수
      sessionKey, // KEYS[1]
      queueKey, // KEYS[2]
      nickname, // ARGV[1]
      now, // ARGV[2]
      this.SESSION_TTL.toString(), // ARGV[3]
      userId, // ARGV[4]
    );

    console.log(
      sessionKey,
      queueKey,
      nickname,
      now,
      this.SESSION_TTL.toString(),
      userId,
    );

    const status = await this.redis.hget(sessionKey, 'status');

    console.log(`상태 확인용 UserID: ${userId}, Redis Status: ${status}`);

    // 4. Lua 스크립트 결과에 따른 예외 처리
    if (result === 'DUPLICATE_ENTRY') {
      throw new ConflictException('이미 대기열에 참여 중입니다.');
    }
    if (result === 'ALREADY_IN_GAME') {
      throw new ConflictException('이미 게임이 진행 중입니다.');
    }

    // Redis가 반환한 userId (string)
    return result as string;
  }

  // 매칭 큐에서 5명 추출 (Lua 기반)
  async extractMatchParticipants(count: number = 5): Promise<string[] | null> {
    const queueKey = 'match_queue';

    const result = await this.redis.eval(
      this.EXTRACT_MATCH_LUA,
      1, // KEYS 개수
      queueKey, // KEYS[1]
      count.toString(), // ARGV[1]
    );

    // 조건 불만족 시(5명 미만) null이 반환됨
    if (!result) {
      return null;
    }

    return result as string[];
  }

  // 매칭 취소 메서드
  async cancelQueue(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    const queueKey = 'match_queue';

    console.log(`\n🔍 [Cancel Debug Start] 요청 UserID: ${userId}`);

    // 1. 세션 상태 조회
    const currentStatus = await this.redis.hget(sessionKey, 'status');
    console.log(
      `👉 Redis 세션 상태 (HGET ${sessionKey} status):`,
      currentStatus,
    );

    const result = await this.redis.eval(
      this.CANCEL_MATCH_LUA,
      2, // KEYS 개수
      sessionKey, // KEYS[1]
      queueKey, // KEYS[2]
      userId, // ARGV[1]
    );

    const resultStr = result as string;

    switch (resultStr) {
      case 'CANCELLED':
        return; // 정상 취소 완료

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

  // 큐 길이 조회
  async getQueueLength(): Promise<number> {
    const queueKey = 'match_queue';
    return this.redis.llen(queueKey);
  }

  // 세션 조회 (단일 명령이라 Lua로 감싸지 않아도 됨)
  async getSessionInfo(userId: string): Promise<any> {
    const sessionKey = `session:${userId}`;
    return this.redis.hgetall(sessionKey);
  }

  // 상태 업데이트 (단일 명령)
  async updateStatus(
    userId: string,
    newStatus: 'IN_GAME' | 'IDLE' | 'WAITING',
  ): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.redis.hset(sessionKey, 'status', newStatus);
  }
}
