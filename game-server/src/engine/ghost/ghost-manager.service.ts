import { Injectable } from '@nestjs/common';
import { GhostState } from '../../state/ghost-state';
import { TILE_SIZE, PLAYER_SIZE } from '../../map/map.data';
import { GhostMoveService } from './ghost-move.service';
import { PlayerState } from '../../state/player-state';

@Injectable()
export class GhostManagerService {
	private ghosts: Record<string, Record<string, GhostState>> = {};
  private ghostSpawns: Record<string, { x: number; y: number }[]> = {};

	private ensureRoom(roomId: string) {
    if (!this.ghosts[roomId]) {
      this.ghosts[roomId] = {};
    }
  }

  constructor() {}

  initialize(roomId: string, spawns: { x: number; y: number }[]) {
		this.ensureRoom(roomId);
    this.ghostSpawns[roomId] = spawns;

		// 기본 유령 3개 생성
    this.addGhost(roomId, 'g1');
    this.addGhost(roomId, 'g2');
    this.addGhost(roomId, 'g3');
  }

  getGhosts(roomId: string) {
		this.ensureRoom(roomId);
    return this.ghosts[roomId];
  }

  addGhost(roomId: string, id: string, opts?: Partial<{ color: string; speed: number }>) {
		this.ensureRoom(roomId);
    if (!this.ghostSpawns[roomId] || !this.ghostSpawns[roomId].length) {
      console.log(`유령 생성 실패: ${roomId}의 spawn이 없습니다.`);
      return;
    }

    const spawn =
      this.ghostSpawns[roomId][Math.floor(Math.random() * this.ghostSpawns[roomId].length)];
    const offset = TILE_SIZE / 2;

    this.ghosts[roomId][id] = {
      id,
      x: spawn.x * TILE_SIZE + offset,
      y: spawn.y * TILE_SIZE + offset,
      dir: { dx: 0, dy: 0 },
      speed: opts?.speed ?? 5,
      color: opts?.color ?? 'white',
      path: [],
      targetX: undefined,
      targetY: undefined,
    };
  }

  updateGhosts(roomId: string, map: number[][], players: PlayerState[]) {
		this.ensureRoom(roomId);
    const ghostArray = Object.values(this.ghosts[roomId]);

    ghostArray.forEach((ghost, index) => {
      const isChaser = index === 0;
      ghost.color = isChaser ? 'red' : 'white';
      GhostMoveService.updateGhost(ghost, roomId, map, players, isChaser);
    });
  }

  checkCollision(roomId: string, x: number, y: number) {
		this.ensureRoom(roomId);
    for (const ghost of Object.values(this.ghosts[roomId])) {
      const gx = ghost.x + PLAYER_SIZE / 2;
      const gy = ghost.y + PLAYER_SIZE / 2;

      const dist = Math.hypot(x - gx, y - gy);
      const threshold = PLAYER_SIZE;

      if (dist < threshold) return true;
    }
    return false;
  }

	clearRoom(roomId: string) {
  delete this.ghosts[roomId];
  delete this.ghostSpawns[roomId];
}
}
