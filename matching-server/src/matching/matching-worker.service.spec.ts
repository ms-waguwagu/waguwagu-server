import { Test, TestingModule } from '@nestjs/testing';
import { MatchingWorker } from './matching-worker.service';
import { QueueService } from '../queue/queue.service';
import { QueueGateway } from '../queue/queue.gateway';
import { ConfigService } from '@nestjs/config';
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
      ],
    }).compile();

    worker = module.get(MatchingWorker);
    queueService = module.get(QueueService);
    gateway = module.get(QueueGateway);
  });

  it('5명 매칭되면 broadcastMatchFound 호출', async () => {
    queueService.extractMatchParticipants.mockResolvedValue([
      'u1',
      'u2',
      'u3',
      'u4',
      'u5',
    ]);

    await worker.handleMatchmaking();

    expect(gateway.broadcastMatchFound).toHaveBeenCalledTimes(1);
  });
});
