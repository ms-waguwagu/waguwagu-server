import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AgonesSDK = require('@google-cloud/agones-sdk');

@Injectable()
export class AgonesService implements OnModuleInit {
  private readonly logger = new Logger(AgonesService.name);
  private readonly agonesSDK: any;

  constructor() {
    this.agonesSDK = new AgonesSDK();
  }

  async onModuleInit() {
    try {
      // 1) SDK 서버 연결 (최대 30초 내 연결 실패하면 reject)
      await this.agonesSDK.connect();
      this.logger.log('Agones에 연결되었습니다.');

      // 2) 주기적 헬스 핑(스트림)
      this.agonesSDK.health((err: any) => {
        if (err) {
          this.logger.error('Agones 헬스 핑 실패', err);
        }
      });

      // 3) 게임서버가 손님 받을 준비 됐다는 표시
      await this.agonesSDK.ready();
      this.logger.log('Agones에 게임서버가 준비되었습니다.');
    } catch (error) {
      this.logger.error('Agones SDK 초기화 실패', error);
    }
  }
}
