import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
const AgonesSDK = require('@google-cloud/agones-sdk');

@Injectable()
export class AgonesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgonesService.name);
  private readonly agonesSDK: any;
  private healthTimer?: NodeJS.Timeout;
  private shutdownTimer?: NodeJS.Timeout;
  private gameStarted = false;

  constructor() {
    this.agonesSDK = new AgonesSDK();
  }

  async onModuleInit() {
    try {
      await this.agonesSDK.connect();
      this.logger.log('Agones에 연결되었습니다.');

      // 2초마다 health ping
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

  // 게임 시작 시 호출 (Agones 상태 관리용)
  onGameStart() {
    if (this.gameStarted) return;
    this.gameStarted = true;
    this.logger.log('게임 시작 감지 (Agones 상태 유지)');
  }

  // 명시적 셧다운 (방에 유저가 없을 때 호출)
  async shutdown() {
    this.logger.warn('인원 0명 감지 -> Agones Shutdown 실행');
    try {
      await this.agonesSDK.shutdown();
    } catch (e) {
      this.logger.error('Agones shutdown 호출 실패', e);
    }
  }

  onModuleDestroy() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.shutdownTimer) clearTimeout(this.shutdownTimer);
  }
}
