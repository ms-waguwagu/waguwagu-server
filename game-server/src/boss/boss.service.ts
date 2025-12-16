import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BossManagerService } from './boss-manager.service';

interface DebugRoomConfig {
  nickname: string;
}

@Injectable()
export class BossRoomService {
  constructor(
    private readonly bossManager: BossManagerService,
  ) {}

  
   // 보스 디버그 모드 시작 요청
   // 실제 방 생성은 RoomManager(GameEngineService 쪽)가 처리함
  async createDebugRoom(config: DebugRoomConfig): Promise<{
    roomId: string;
    initialBossState: any;
  }> {

    const roomId = uuidv4();

    // BossManager에서 보스 생성
    const boss = this.bossManager.spawnBoss(roomId, {
      x: 10,
      y: 10,
    });

    return {
      roomId,
      initialBossState: boss,
    };
  }

  // 보스 상태 조회
  getBoss(roomId: string) {
    return this.bossManager.getBoss(roomId);
  }

  // AI 서버 응답 이동 적용
  moveBoss(roomId: string, dx: number, dy: number) {
    this.bossManager.moveBoss(roomId, dx, dy);
  }

  // 방 삭제 시 보스 제거
  removeBoss(roomId: string) {
    this.bossManager.removeBoss(roomId);
  }
}
