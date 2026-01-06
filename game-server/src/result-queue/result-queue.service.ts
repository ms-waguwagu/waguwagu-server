import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import * as AWSXRay from 'aws-xray-sdk-core';

@Injectable()
export class ResultQueueService implements OnModuleInit {
  private readonly logger = new Logger(ResultQueueService.name);
  private sqs: SQSClient;
  private queueUrl: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-2';
    this.queueUrl = this.configService.get<string>('GAME_RESULT_QUEUE_URL')!;

    this.sqs = new SQSClient({ region });

    // 진단 로그: AWS 자격 증명 관련 환경 변수 확인
    const hasRole = process.env.AWS_ROLE_ARN;
    const hasToken = process.env.AWS_WEB_IDENTITY_TOKEN_FILE;
    
    if (hasRole && hasToken) {
      this.logger.log('AWS IAM 역할을 감지했습니다 (IRSA 활성화됨)');
    } else {
      this.logger.warn('AWS IAM 역할 또는 토큰 환경 변수를 찾을 수 없습니다. SQS 전송 시 권한 에러가 발생할 수 있습니다.');
    }

    if (!this.queueUrl) {
      this.logger.error('GAME_RESULT_QUEUE_URL 환경 변수가 정의되지 않았습니다');
    } else {
      this.logger.log(`ResultQueueService 초기화 완료 (Queue: ${this.queueUrl})`);
    }
  }

  async sendGameResult(roomId: string, results: { userId: string; nickname: string; score: number }[]) {
    if (!this.queueUrl) {
      this.logger.error('게임 결과를 전송할 수 없습니다: GAME_RESULT_QUEUE_URL 누락');
      return;
    }

    const segment = new AWSXRay.Segment('SQS:SendGameResult');
    
    await AWSXRay.getNamespace().runPromise(async () => {
      AWSXRay.setSegment(segment);
      try {
        const payload = {
          type: 'GAME_FINISHED',
          roomId,
          results,
          timestamp: new Date().toISOString(),
        };

        await this.sqs.send(
          new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify(payload),
          }),
        );

        this.logger.log(`게임 결과 SQS 전송 완료: roomId=${roomId} (유저 수: ${results.length})`);
      } catch (error) {
        this.logger.error(`게임 결과 SQS 전송 실패: roomId=${roomId}`, error);
        segment.addError(error);
      } finally {
        segment.close();
      }
    });
  }
}
