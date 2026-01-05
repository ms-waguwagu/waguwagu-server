// src/common/redis.ts
import Redis from 'ioredis';

let redis: Redis | null = null;
let isConnecting = false;
let connectionFailed = false;

export function getRedis(): Redis | null {
  // 연결 실패했으면 null 반환
  if (connectionFailed) {
    return null;
  }

  if (!process.env.REDIS_HOST) {
    console.warn('[Redis] REDIS_HOST not set, redis disabled');
    return null;
  }

  if (!redis && !isConnecting) {
    isConnecting = true;
    console.log('[Redis] Initializing redis client...');

    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true, // 수동 연결로 에러 핸들링 개선
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retry attempts reached, giving up');
          connectionFailed = true;
          return null;
        }
        const delay = Math.min(times * 500, 2000);
        console.log(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      tls:
        process.env.REDIS_TLS === 'true'
          ? {
              servername: process.env.REDIS_HOST,
              rejectUnauthorized: true,
            }
          : undefined,
    });

    // 에러 핸들러 (Unhandled error 방지)
    redis.on('error', (err) => {
      console.error('[Redis Error]', err.message);
      // DNS 실패나 연결 실패면 더 이상 시도하지 않음
      if (
        err.message.includes('ENOTFOUND') ||
        err.message.includes('ECONNREFUSED')
      ) {
        connectionFailed = true;
        console.error('[Redis] Connection permanently failed, disabling Redis');
      }
    });

    redis.on('connect', () => {
      console.log('[Redis] ✅ Connected successfully');
      connectionFailed = false;
      isConnecting = false;
    });

    redis.on('ready', () => {
      console.log('[Redis] ✅ Ready to accept commands');
    });

    redis.on('close', () => {
      console.warn('[Redis] ⚠️  Connection closed');
    });

    redis.on('reconnecting', () => {
      console.log('[Redis] 🔄 Reconnecting...');
    });

    redis.on('end', () => {
      console.warn('[Redis] ⚠️  Connection ended');
    });

    // 즉시 연결 시도
    redis.connect().catch((err) => {
      console.error('[Redis] Initial connection failed:', err.message);
      connectionFailed = true;
      isConnecting = false;
    });
  }

  return redis;
}

/**
 * 애플리케이션 종료 시 Redis 연결 정리
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    console.log('[Redis] Closing connection...');
    try {
      await redis.quit();
      console.log('[Redis] ✅ Connection closed gracefully');
    } catch (err) {
      console.error('[Redis] Error closing connection:', err);
      redis.disconnect(); // 강제 종료
    }
    redis = null;
    isConnecting = false;
    connectionFailed = false;
  }
}

/**
 * Redis 연결 상태 확인
 */
export function isRedisConnected(): boolean {
  return redis?.status === 'ready';
}

/**
 * Redis 연결 강제 재시도
 */
export async function reconnectRedis(): Promise<void> {
  if (redis) {
    await closeRedis();
  }
  connectionFailed = false;
  isConnecting = false;
  getRedis();
}
