import { Injectable, Logger } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SqsResultService {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly logger = new Logger(SqsResultService.name);

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-2';
    this.queueUrl = this.configService.get<string>('GAME_RESULT_QUEUE_URL') || '';

    this.client = new SQSClient({ region });
  }

  async sendGameResult(roomId: string, results: any[]) {
    if (!this.queueUrl) {
      this.logger.warn('GAME_RESULT_QUEUE_URL가 설정되지 않아 데이터를 전송할 수 없습니다.');
      return;
    }

    try {
      const messageBody = JSON.stringify({
        roomId,
        results,
        timestamp: new Date().toISOString(),
      });

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
      });

      await this.client.send(command);
      this.logger.log(`[SQS] 결과 전송 성공: roomId=${roomId}, participants=${results.length}`);
    } catch (err) {
      this.logger.error(`[SQS] 결과 전송 실패: roomId=${roomId}`, err);
    }
  }
}
