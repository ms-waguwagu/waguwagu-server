import { Injectable, Logger } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

interface GameFinishedPayload {
  roomId: string;
  endedAt: number;
  results: {
    userId: string;
    nickname: string;
    score: number;
  }[];
}

@Injectable()
export class GameResultProducer {
  private readonly logger = new Logger(GameResultProducer.name);
  private readonly sqs: SQSClient;

  constructor() {
    // AWS SDK v3는 아래 env들을 자동으로 자동 인식함
    // AWS_ACCESS_KEY_ID
    // AWS_SECRET_ACCESS_KEY
    // AWS_REGION
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
  }

  // ✅ 인자는 payload 하나만 받는다
  async sendGameFinished(payload: GameFinishedPayload): Promise<void> {
    if (!process.env.GAME_RESULT_QUEUE) {
      this.logger.error('GAME_RESULT_QUEUE env is not set');
      return;
    }

    if (!payload?.roomId || !payload?.results || payload.results.length === 0) {
      this.logger.warn('Invalid GAME_FINISHED payload');
      return;
    }

    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: process.env.GAME_RESULT_QUEUE_URL,
          MessageBody: JSON.stringify({
            ...payload,
            type: 'GAME_FINISHED', // consumer 분기용
          }),
        }),
      );

      this.logger.log(
        `🏁 GAME_FINISHED sent roomId=${payload.roomId}, players=${payload.results.length}`,
      );
    } catch (err: any) {
      this.logger.error(
        `❌ GAME_FINISHED send failed roomId=${payload.roomId}`,
        err?.stack || err,
      );
      throw err;
    }
  }
}
