import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { PlayerStatus } from '../common/constants';

@Injectable()
export class QueueService implements OnModuleInit {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private readonly SESSION_TTL = 3600; // 1시간

  // ==========================================
  // [중요] 배포 환경 경로 에러 방지를 위해
  // Lua Script를 코드 상수로 직접 정의합니다.
  // ==========================================

  // 1. 대기열 진입
  private readonly ENTER_QUEUE_LUA = `
    local sessionKey = KEYS[1]
    local queueKey = KEYS[2]
    local nickname = ARGV[1]
    local joinedAt = ARGV[2]
    local ttl = ARGV[3]
    local userId = ARGV[4]

    -- 1. 이미 게임 중인지 확인
    local status = redis.call('HGET', sessionKey, 'status')
    if status == 'IN_GAME' then
        return 'ALREADY_IN_GAME'
    end

    -- 2. 이미 대기열에 있는지 확인 (상태가 WAITING이면 중복)
    if status == 'WAITING' then
        return 'DUPLICATE_ENTRY'
    end

    -- 3. 세션 생성/갱신
    redis.call('HSET', sessionKey, 'status', 'WAITING', 'nickname', nickname, 'joinedAt', joinedAt)
    redis.call('EXPIRE', sessionKey, ttl)

    -- 4. 큐에 추가 (오른쪽 끝에 push)
    redis.call('RPUSH', queueKey, userId)

    -- 5. 마지막 입장 시각 기록 (타임아웃 계산용)
    redis.call('SET', queueKey .. ':lastJoinedAt', joinedAt)

    return userId
  `;

  // 2. 매칭 추출 (N명)
  private readonly EXTRACT_MATCH_LUA = `
    local queueKey = KEYS[1]
    local count = tonumber(ARGV[1])

    -- 큐 길이 확인
    local len = redis.call('LLEN', queueKey)
    if len < count then
        return nil
    end

    -- 앞에서 N명 추출
    local participants = redis.call('LPOP', queueKey, count)
    return participants
  `;

  // 3. 부분 매칭 추출 (최대 N명)
  private readonly EXTRACT_PARTIAL_MATCH_LUA = `
    local queueKey = KEYS[1]
    local maxCount = tonumber(ARGV[1])

    local len = redis.call('LLEN', queueKey)
    if len == 0 then
        return nil
    end

    -- min(len, maxCount) 만큼 추출
    local popCount = len
    if popCount > maxCount then
        popCount = maxCount
    end

    local participants = redis.call('LPOP', queueKey, popCount)
    return participants
  `;

  // 4. 매칭 취소
  private readonly CANCEL_MATCH_LUA = `
    local sessionKey = KEYS[1]
    local queueKey = KEYS[2]
    local userId = ARGV[1]

    -- 1. 상태 확인
    local status = redis.call('HGET', sessionKey, 'status')

    if status == 'IN_GAME' then
        return 'ALREADY_IN_GAME'
    end

    if status ~= 'WAITING' then
        return 'NOT_QUEUED'
    end

    -- 2. 큐에서 제거 (LREM: list remove)
    -- LREM key count value (count=0이면 모든 value 삭제)
    local removed = redis.call('LREM', queueKey, 0, userId)

    if removed > 0 then
        -- 3. 세션 상태를 IDLE로 변경 (삭제하지 않음, 재접속 등 고려)
        redis.call('HSET', sessionKey, 'status', 'IDLE')
        return 'CANCELLED'
    else
        -- 큐에는 없는데 상태가 WAITING인 경우 (이미 워커가 꺼내갔을 가능성 등)
        -- 워커가 꺼내가면 상태가 IN_GAME이 되므로, 여기는 타이밍 이슈 구간
        -- 안전하게 상태만 IDLE로 돌려줌
        redis.call('HSET', sessionKey, 'status', 'IDLE')
        return 'ALREADY_MATCHED_BY_WORKER'
    end
  `;

  async onModuleInit() {
    // 이제 파일 읽기 로직이 필요 없습니다.
  }

  // 대기열 진입 (Lua 기반)
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

    // Lua 스크립트 결과에 따른 예외 처리
    if (result === 'DUPLICATE_ENTRY') {
      throw new ConflictException('이미 대기열에 참여 중입니다.');
    }
    if (result === 'ALREADY_IN_GAME') {
      throw new ConflictException('이미 게임이 진행 중입니다.');
    }

    return result as string;
  }

  // 매칭 큐에서 N명 추출 (Lua 기반)
  async extractMatchParticipants(count: number): Promise<string[] | null> {
    const queueKey = 'match_queue';

    const result = await this.redis.eval(
      this.EXTRACT_MATCH_LUA,
      1, // KEYS 개수
      queueKey, // KEYS[1]
      count.toString(), // ARGV[1]
    );

    if (!result) {
      return null;
    }

    return result as string[];
  }

  // 마지막 입장 시각 가져오기
  async getLastJoinedAt(): Promise<number | null> {
    const queueKey = 'match_queue';
    const value = await this.redis.get(`${queueKey}:lastJoinedAt`);
    if (!value) return null;
    return Number(value);
  }

  // 최대 N명까지 꺼냄
  async extractMatchUpTo(count: number): Promise<string[] | null> {
    const queueKey = 'match_queue';

    const result = await this.redis.eval(
      this.EXTRACT_PARTIAL_MATCH_LUA,
      1,
      queueKey,
      count.toString(),
    );

    if (!result) return null;
    return result as string[];
  }

  async acquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
    // SET key value EX ttl NX
    const result = await this.redis.set(
      key,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  // 매칭 취소 메서드
  async cancelQueue(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    const queueKey = 'match_queue';

    this.printLog(`매칭 취소 요청 UserID: ${userId}`);

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
        return; 
      case 'ALREADY_IN_GAME':
      case 'ALREADY_MATCHED_BY_WORKER':
        throw new ConflictException('이미 매칭이 성사되어 취소할 수 없습니다.');
      case 'NOT_QUEUED':
        // throw new BadRequestException('대기열에 존재하지 않는 유저입니다.');
        // 멱등성을 위해 에러 대신 조용히 리턴하는 것도 방법입니다.
        return; 
      default:
        throw new InternalServerErrorException(
          '매칭 취소 중 알 수 없는 오류 발생',
        );
    }
  }

  async recoverStaleInGameSession(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    const session = await this.redis.hgetall(sessionKey);
    
    if (!session || Object.keys(session).length === 0) return;
    if (session.status !== PlayerStatus.IN_GAME) return;

    // 게임 중인데 큐 진입을 시도한다는 건 비정상 종료 후 재진입 상황
    await this.redis.hset(sessionKey, 'status', PlayerStatus.IDLE);
    await this.redis.expire(sessionKey, this.SESSION_TTL);

    console.warn(
      `[RECOVER] stale IN_GAME session reset to IDLE (userId=${userId})`,
    );
  }

  // 큐 길이 조회
  async getQueueLength(): Promise<number> {
    const queueKey = 'match_queue';
    return this.redis.llen(queueKey);
  }

  // 세션 조회
  async getSessionInfo(userId: string): Promise<any> {
    const sessionKey = `session:${userId}`;
    return this.redis.hgetall(sessionKey);
  }

  // 상태 업데이트
  async updateStatus(userId: string, newStatus: PlayerStatus): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.redis.hset(sessionKey, 'status', newStatus);
  }

  // 매칭 실패 시 롤백 (앞쪽으로 다시 넣음)
  async rollbackParticipants(participants: string[]): Promise<void> {
    const queueKey = 'match_queue';
    if (!participants || participants.length === 0) return;

    await this.redis.lpush(queueKey, ...participants);

    for (const userId of participants) {
      await this.updateStatus(userId, PlayerStatus.WAITING);
    }
  }

  getRedis() {
    return this.redis;
  }

  // ============================================
  // 보스모드 큐 관련 메서드
  // ============================================

  // 보스모드 대기열 진입
  async enterBossQueue(userId: string, nickname: string): Promise<string> {
    const sessionKey = `session:${userId}`;
    const queueKey = 'boss_match_queue';
    const now = Date.now().toString();

    const result = await this.redis.eval(
      this.ENTER_QUEUE_LUA,
      2, 
      sessionKey, 
      queueKey, 
      nickname, 
      now, 
      this.SESSION_TTL.toString(), 
      userId, 
    );
    
    if (result === 'DUPLICATE_ENTRY') {
      throw new ConflictException('이미 보스모드 대기열에 참여 중입니다.');
    }
    if (result === 'ALREADY_IN_GAME') {
      throw new ConflictException('이미 게임이 진행 중입니다.');
    }

    return result as string;
  }

  // 보스모드 매칭 큐 추출
  async extractBossMatchParticipants(count: number): Promise<string[] | null> {
    const queueKey = 'boss_match_queue';

    const result = await this.redis.eval(
      this.EXTRACT_MATCH_LUA,
      1, 
      queueKey, 
      count.toString(), 
    );

    if (!result) return null;
    return result as string[];
  }

  async getBossLastJoinedAt(): Promise<number | null> {
    const queueKey = 'boss_match_queue';
    const value = await this.redis.get(`${queueKey}:lastJoinedAt`);
    if (!value) return null;
    return Number(value);
  }

  async extractBossMatchUpTo(count: number): Promise<string[] | null> {
    const queueKey = 'boss_match_queue';

    const result = await this.redis.eval(
      this.EXTRACT_PARTIAL_MATCH_LUA,
      1,
      queueKey,
      count.toString(),
    );

    if (!result) return null;
    return result as string[];
  }

  // 보스모드 매칭 취소
  async cancelBossQueue(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    const queueKey = 'boss_match_queue';

    this.printLog(`보스모드 매칭 취소 UserID: ${userId}`);

    const result = await this.redis.eval(
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
        // throw new BadRequestException('보스모드 대기열에 존재하지 않습니다.');
        return;
      default:
        throw new InternalServerErrorException(
          '보스모드 매칭 취소 중 알 수 없는 오류 발생',
        );
    }
  }

  async getBossQueueLength(): Promise<number> {
    const queueKey = 'boss_match_queue';
    return this.redis.llen(queueKey);
  }

  async rollbackBossParticipants(participants: string[]): Promise<void> {
    const queueKey = 'boss_match_queue';
    if (!participants || participants.length === 0) return;

    await this.redis.lpush(queueKey, ...participants);

    for (const userId of participants) {
      await this.updateStatus(userId, PlayerStatus.WAITING);
    }
  }
  
  private printLog(msg: string) {
      console.log(`[QueueService] ${msg}`);
  }
}