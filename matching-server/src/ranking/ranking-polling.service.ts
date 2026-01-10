import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { RankingService } from './ranking.service';

@Injectable()
export class RankingPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RankingPollingService.name);
  private client: SQSClient;
  private queueUrl: string;
  private pollingInterval: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly rankingService: RankingService,
  ) {
    const region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-2';
    this.queueUrl = this.configService.get<string>('GAME_RESULT_QUEUE_URL') || '';

    this.client = new SQSClient({ region });
  }

  onModuleInit() {
    if (!this.queueUrl) {
      this.logger.warn('GAME_RESULT_QUEUE_URL가 설정되지 않아 랭킹 폴링을 시작할 수 없습니다.');
      return;
    }

    this.logger.log('SQS 랭킹 결과 폴링 시작...');
    // 5초마다 폴링 시도
    this.pollingInterval = setInterval(() => this.pollMessages(), 5000);
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private async pollMessages() {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 2, // 롱 폴링 (최대 2초 대기)
      });

      const response = await this.client.send(command);

      if (response.Messages && response.Messages.length > 0) {
        this.logger.log(`[SQS] ${response.Messages.length}개의 게임 결과 메시지 수신`);
        
        for (const message of response.Messages) {
          await this.processMessage(message);
        }
      }
    } catch (err) {
      this.logger.error('[SQS] 메시지 폴링 중 오류 발생', err);
    }
  }

  private async processMessage(message: Message) {
    try {
      if (!message.Body) return;

      const data = JSON.parse(message.Body);
      const { roomId, results } = data;

      if (!roomId || !results) {
        this.logger.warn(`[SQS] 유효하지 않은 결과 데이터: roomId=${roomId}`);
        if (message.ReceiptHandle) {
          await this.deleteMessage(message.ReceiptHandle);
        }
        return;
      }

      this.logger.log(`[SQS] 결과 저장 중: roomId=${roomId}, participants=${results.length}`);
      
      // RDS 저장
      await this.rankingService.saveGameResults(roomId, results);

      // 처리 완료 후 SQS에서 제거
      if (message.ReceiptHandle) {
        await this.deleteMessage(message.ReceiptHandle);
      }
    } catch (err) {
      this.logger.error('[SQS] 메시지 처리 중 오류 발생', err);
    }
  }

  private async deleteMessage(receiptHandle: string) {
    if (!this.queueUrl) return;
    
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.client.send(command);
    } catch (err) {
      this.logger.error('[SQS] 메시지 삭제 실패', err);
    }
  }
}
