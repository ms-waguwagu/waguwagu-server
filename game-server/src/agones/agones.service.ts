import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
const AgonesSDK = require('@google-cloud/agones-sdk');

@Injectable()
export class AgonesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgonesService.name);
  private readonly agonesSDK: any;
  private healthTimer?: NodeJS.Timeout;

  constructor() {
    this.agonesSDK = new AgonesSDK();
  }

  async onModuleInit() {
    try {
      await this.agonesSDK.connect();
      this.logger.log('Agones에 연결되었습니다.');

      //주기적으로 health ping 보내기 (2초마다 )
      this.healthTimer = setInterval(() => {
        try {
          this.agonesSDK.health();
        } catch (e) {
          this.logger.error('Agones health ping 실패', e);
        }
      }, 2000);

      await this.agonesSDK.ready();
      this.logger.log('Agones에 게임서버가 준비되었습니다.');
    } catch (error) {
      this.logger.error('Agones SDK 초기화 실패', error);
    }
  }

  onModuleDestroy() {
    if (this.healthTimer) clearInterval(this.healthTimer);
  }
}
