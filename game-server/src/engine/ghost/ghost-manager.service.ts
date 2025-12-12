import { Injectable } from '@nestjs/common';
import { GhostState } from '../../state/ghost-state';
import { TILE_SIZE, PLAYER_SIZE } from '../../map/map.data';
import { GhostMoveService } from './ghost-move.service';
import { PlayerState } from '../../state/player-state';

@Injectable()
export class GhostManagerService {
  private ghosts: Record<string, GhostState> = {};
  private ghostSpawns: { x: number; y: number }[] = [];

  constructor() {}

  initialize(spawns: { x: number; y: number }[]) {
    this.ghostSpawns = spawns;
  }

  getGhosts() {
    return this.ghosts;
  }

  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    if (!this.ghostSpawns.length) return;

    const spawn =
      this.ghostSpawns[Math.floor(Math.random() * this.ghostSpawns.length)];
    const offset = TILE_SIZE / 2;

    this.ghosts[id] = {
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

  updateGhosts(map: number[][], players: PlayerState[]) {
    const ghostArray = Object.values(this.ghosts);

    ghostArray.forEach((ghost, index) => {
      const isChaser = index === 0;
      ghost.color = isChaser ? 'red' : 'white';
      GhostMoveService.updateGhost(ghost, map, players, isChaser);
    });
  }

  checkCollision(x: number, y: number) {
    for (const ghost of Object.values(this.ghosts)) {
      const gx = ghost.x + PLAYER_SIZE / 2;
      const gy = ghost.y + PLAYER_SIZE / 2;

      const dist = Math.hypot(x - gx, y - gy);
      const threshold = PLAYER_SIZE;

      if (dist < threshold) return true;
    }
    return false;
  }
}
