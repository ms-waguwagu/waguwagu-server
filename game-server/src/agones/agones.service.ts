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

  // 임시: 게임 시작 시 호출
  // (첫 유저 WebSocket 접속 시)
  onGameStart() {
    if (this.gameStarted) return;

    this.gameStarted = true;
    this.logger.warn('게임 시작 감지 → 20초 후 shutdown 예약');

    this.shutdownTimer = setTimeout(() => {
      this.logger.warn('개발용 타임아웃(20초) → Agones Shutdown');
      this.agonesSDK.shutdown();
    }, 20_000);
  }

  onModuleDestroy() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.shutdownTimer) clearTimeout(this.shutdownTimer);
  }
}
