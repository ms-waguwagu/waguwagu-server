import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as AWSXRay from 'aws-xray-sdk-core';
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
      this.logger.error('GAME_RESULT_QUEUE_URL 환경 변수가 설정되지 않았습니다');
      return;
    }

    this.logger.log('GameFinishedConsumer 시작 (랭킹)');
    this.poll();
  }

  private running = true;

  onModuleDestroy() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      const segment = new AWSXRay.Segment('SQS:Poll');
      
      await AWSXRay.getNamespace().runPromise(async () => {
        AWSXRay.setSegment(segment);
        try {
          const res = await this.sqs.send(
            new ReceiveMessageCommand({
              QueueUrl: this.queueUrl!,
              MaxNumberOfMessages: 10,
              WaitTimeSeconds: 20, // long polling
            }),
          );

          if (!res.Messages || res.Messages.length === 0) {
            return;
          }

          this.logger.log(`SQS 메시지 ${res.Messages.length}개 수신 완료`);

          for (const msg of res.Messages) {
            await this.handleMessage(msg);
          }
        } catch (err) {
          this.logger.error('SQS 폴링 에러', err);
          segment.addError(err);
          await this.sleep(3000); // 에러 시 잠깐 쉼
        } finally {
          segment.close();
        }
      });
    }
  }

  private async handleMessage(message: any) {
    let payload: GameFinishedMessage;

    try {
      payload = JSON.parse(message.Body);
    } catch (err) {
      this.logger.error('잘못된 JSON 메시지 형식입니다. 메시지를 삭제합니다.', err);
      await this.deleteMessage(message);
      return;
    }

    // 🔹 타입 가드 (확장 대비)
    if (payload.type && payload.type !== 'GAME_FINISHED') {
      this.logger.warn(`알 수 없는 메시지 타입입니다: ${payload.type}`);
      await this.deleteMessage(message);
      return;
    }

    if (!payload.roomId || !payload.results?.length) {
      this.logger.warn('부적절한 GAME_FINISHED 페이로드입니다. 메시지를 삭제합니다.');
      await this.deleteMessage(message);
      return;
    }

    const segment = new AWSXRay.Segment('GameFinishedConsumer:handleMessage');
    
    await AWSXRay.getNamespace().runPromise(async () => {
      AWSXRay.setSegment(segment);
      try {
        await this.gameFinishedService.handleGameFinished(
          payload.roomId,
          payload.results,
        );

        await this.deleteMessage(message);

        this.logger.log(
          `GAME_FINISHED 처리 완료: roomId=${payload.roomId}, 유저 수=${payload.results.length}`,
        );
      } catch (err) {
        this.logger.error(
          `GAME_FINISHED 처리 실패: roomId=${payload.roomId}`,
          err,
        );
        segment.addError(err);
      } finally {
        segment.close();
      }
    });
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
      this.logger.error('SQS 메시지 삭제 실패', err);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
