import { Test, TestingModule } from '@nestjs/testing';
import { MatchingWorker } from './matching-worker.service';
import { QueueService } from '../queue/queue.service';
import { QueueGateway } from '../queue/queue.gateway';
import { ConfigService } from '@nestjs/config';
import { AgonesAllocatorService } from '../agones-allocator/agoness-allocator.service';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-room-id'),
}));

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: {} }),
}));

describe('MatchingWorkerService', () => {
  let worker: MatchingWorker;
  let queueService: jest.Mocked<QueueService>;
  let gateway: jest.Mocked<QueueGateway>;
  let agonesAllocatorService: jest.Mocked<AgonesAllocatorService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MatchingWorker,
        {
          provide: QueueService,
          useValue: {
            extractMatchParticipants: jest.fn(),
            updateStatus: jest.fn(),
            rollbackParticipants: jest.fn(),
          },
        },
        {
          provide: QueueGateway,
          useValue: {
            broadcastMatchFound: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(5) },
        },
        {
          provide: AgonesAllocatorService,
          useValue: {
            allocate: jest.fn(),
          },
        },
      ],
    }).compile();

    worker = module.get(MatchingWorker);
    queueService = module.get(QueueService);
    gateway = module.get(QueueGateway);
    agonesAllocatorService = module.get(AgonesAllocatorService);
  });

  it('5명 매칭되고 할당 성공하면 broadcastMatchFound 호출', async () => {
    queueService.extractMatchParticipants.mockResolvedValue([
      'u1', 'u2', 'u3', 'u4', 'u5',
    ]);
    agonesAllocatorService.allocate.mockResolvedValue({
      gameserverIp: '1.2.3.4',
      port: 7777,
    });

    await worker.handleMatchmaking();

    expect(gateway.broadcastMatchFound).toHaveBeenCalledTimes(1);
  });

  it('할당 실패 시(null 반환) 롤백 실행', async () => {
    queueService.extractMatchParticipants.mockResolvedValue([
      'u1', 'u2', 'u3', 'u4', 'u5',
    ]);
    // 할당 실패 시뮬레이션
    agonesAllocatorService.allocate.mockResolvedValue(null);

    await worker.handleMatchmaking();

    // broadcastMatchFound는 호출되지 않아야 함
    expect(gateway.broadcastMatchFound).not.toHaveBeenCalled();
    // 롤백은 호출되어야 함
    expect(queueService.rollbackParticipants).toHaveBeenCalledWith([
      'u1', 'u2', 'u3', 'u4', 'u5',
    ]);
  });
});