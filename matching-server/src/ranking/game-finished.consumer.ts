import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { GameFinishedService } from '../internal/game-finished.service';

interface GameFinishedMessage {
  type?: string;
  roomId: string;
  results: {
    userId: string;
    nickname: string;
    score: number;
  }[];
}

@Injectable()
export class GameFinishedConsumer implements OnModuleInit {
  private readonly logger = new Logger(GameFinishedConsumer.name);

  private readonly sqs: SQSClient;
  private readonly queueUrl?: string;

  constructor(private readonly gameFinishedService: GameFinishedService) {
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
    this.queueUrl = process.env.GAME_RESULT_QUEUE_URL;
  }

  onModuleInit() {
    if (!this.queueUrl) {
      this.logger.error('❌ GAME_RESULT_QUEUE_URL env is not set');
      return;
    }

    this.logger.log('🎯 GameFinishedConsumer started (ranking)');
    this.poll();
  }

  private running = true;

  onModuleDestroy() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      try {
        const res = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl!,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20, // long polling
          }),
        );

        if (!res.Messages || res.Messages.length === 0) {
          continue;
        }

        for (const msg of res.Messages) {
          await this.handleMessage(msg);
        }
      } catch (err) {
        this.logger.error('❌ SQS polling error', err);
        await this.sleep(3000); // 🔥 에러 시 잠깐 쉼
      }
    }
  }

  private async handleMessage(message: any) {
    let payload: GameFinishedMessage;

    try {
      payload = JSON.parse(message.Body);
    } catch (err) {
      this.logger.error('❌ Invalid JSON message, deleting', err);
      await this.deleteMessage(message);
      return;
    }

    // 🔹 타입 가드 (확장 대비)
    if (payload.type && payload.type !== 'GAME_FINISHED') {
      this.logger.warn(`⚠️ Unknown message type: ${payload.type}`);
      await this.deleteMessage(message);
      return;
    }

    if (!payload.roomId || !payload.results?.length) {
      this.logger.warn('⚠️ Invalid GAME_FINISHED payload, deleting');
      await this.deleteMessage(message);
      return;
    }

    try {
      await this.gameFinishedService.handleGameFinished(
        payload.roomId,
        payload.results,
      );

      await this.deleteMessage(message);

      this.logger.log(
        `✅ GAME_FINISHED processed roomId=${payload.roomId}, players=${payload.results.length}`,
      );
    } catch (err) {
      this.logger.error(
        `❌ GAME_FINISHED handle failed roomId=${payload.roomId}`,
        err,
      );
      // ❗ Delete 안 하면 SQS가 재시도
    }
  }

  private async deleteMessage(message: any) {
    try {
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl!,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
    } catch (err) {
      this.logger.error('❌ Failed to delete SQS message', err);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
