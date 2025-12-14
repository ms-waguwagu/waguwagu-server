// src/engine/boss/boss-manager.service.ts
import { Injectable } from '@nestjs/common';
import { BossState } from '../state/boss-state';

@Injectable()
export class BossManagerService {
  private bosses: Record<string, BossState | null> = {};

  getBoss(roomId: string): BossState | null {
    return this.bosses[roomId] ?? null;
  }

  // 보스를 생성/등록
  // - initial.x, initial.y 없으면 일단 (0,0)에 둠 (나중에 스폰 타일 맞추기)
  spawnBoss(roomId: string, initial?: Partial<BossState>): BossState {
    const boss: BossState = {
      roomId,
      x: initial?.x ?? 0,
      y: initial?.y ?? 0,
      dir: initial?.dir ?? { dx: 0, dy: 0 },
      phase: initial?.phase ?? 1,
      speed: initial?.speed ?? 1.5,
      size: initial?.size ?? 26,
    };

    this.bosses[roomId] = boss;
    return boss;
  }

  // AI 서버 응답 등을 반영해서 위치 업데이트용 (지금은 단순 델타 이동만)
  moveBoss(roomId: string, dx: number, dy: number) {
    const boss = this.bosses[roomId];
    if (!boss) return;

    boss.x += dx;
    boss.y += dy;
    boss.dir = { dx, dy };
  }

  removeBoss(roomId: string) {
    delete this.bosses[roomId];
  }
}
