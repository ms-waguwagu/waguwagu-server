import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';

// getRedisToken을 안전하게 가져오기
let getRedisToken;
try {
  getRedisToken = require('@nestjs-modules/ioredis').getRedisToken;
} catch (e) {
  // fallback
  getRedisToken = () => 'default_IORedisModuleConnectionToken';
}

// fs/promises 모듈 모킹
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('return "LUA_SCRIPT"'),
}));

describe('QueueService', () => {
  let queueService: QueueService;
  let redisMock: any;

  beforeEach(async () => {
    redisMock = {
      lpush: jest.fn(),
      rpop: jest.fn(),
      llen: jest.fn(),
      lrange: jest.fn(),
      del: jest.fn(),
      eval: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      hgetall: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getRedisToken ? getRedisToken() : 'default_IORedisModuleConnectionToken',
          useValue: redisMock,
        },
      ],
    }).compile();

    queueService = module.get<QueueService>(QueueService);
    
    // onModuleInit 강제 호출 (Lua 스크립트 로딩 시뮬레이션)
    await queueService.onModuleInit();
  });

  it('유저를 대기열에 추가하면 redis.eval이 호출되어야 한다', async () => {
    redisMock.eval.mockResolvedValue('user1');
    redisMock.hget.mockResolvedValue('WAITING');

    const result = await queueService.enterQueue('user1', 'nickname');
    
    expect(redisMock.eval).toHaveBeenCalled();
    expect(result).toBe('user1');
  });
});
