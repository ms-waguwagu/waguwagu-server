// engine/player/player.service.ts
import { Injectable } from '@nestjs/common';
import { PlayerState } from '../../state/player-state';
import { Direction } from '../../types/direction.type';
import {
  TILE_SIZE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PLAYER_COLORS,
} from '../../map/map.data';

export interface Dot {
  x: number;
  y: number;
  eaten: boolean;
}

@Injectable()
export class PlayerService {
  private players: Record<string, PlayerState> = {};
  private colorIndex = 0;

  constructor() {}

  getPlayers() {
    return Object.values(this.players);
  }

  getPlayerMap() {
    return this.players;
  }

  getPlayer(id: string) {
    return this.players[id] || null;
  }

  playerCount() {
    return Object.keys(this.players).length;
  }

  private pickColor(): string {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex += 1;
    return color;
  }

  addPlayer(id: string, nickname: string) {
    const spawnCol = 1;
    const spawnRow = 1;

    const color = this.pickColor();

    this.players[id] = {
      id,
      nickname,
      x: spawnCol * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
      y: spawnRow * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
      dir: { dx: 0, dy: 0 },
      color,
      score: 0,
      stunned: false,
      stunEndTime: 0,
      alpha: 1,
    };
  }

  removePlayer(id: string) {
    delete this.players[id];
  }

  handleInput(id: string, dir: Direction) {
    const p = this.players[id];
    if (!p) return;

    const clamp = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    p.dir = { dx: clamp(dir.dx), dy: clamp(dir.dy) };
  }

  updatePlayer(player: PlayerState, map: number[][], dots: Dot[]) {
    if (player.stunned) return;

    const { dx, dy } = player.dir;
    if (dx === 0 && dy === 0) return;

    const nextX = player.x + dx * PLAYER_SPEED;
    const nextY = player.y + dy * PLAYER_SPEED;

    if (!this.checkCollision(nextX, nextY, map)) {
      player.x = nextX;
      player.y = nextY;
      this.checkDotCollision(player, dots);
    }
  }

  private checkCollision(nextX: number, nextY: number, map: number[][]) {
    const minX = nextX;
    const maxX = nextX + PLAYER_SIZE;
    const minY = nextY;
    const maxY = nextY + PLAYER_SIZE;

    const startTileX = Math.floor(minX / TILE_SIZE);
    const startTileY = Math.floor(minY / TILE_SIZE);
    const endTileX = Math.floor(maxX / TILE_SIZE);
    const endTileY = Math.floor(maxY / TILE_SIZE);

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        if (tx < 0 || ty < 0 || ty >= map.length || tx >= map[0].length) {
          return true;
        }
        if (map[ty][tx] === 1) return true;
      }
    }
    return false;
  }

  private checkDotCollision(player: PlayerState, dots: Dot[]) {
    const px = Math.floor((player.x + PLAYER_SIZE / 2) / TILE_SIZE);
    const py = Math.floor((player.y + PLAYER_SIZE / 2) / TILE_SIZE);

    for (const dot of dots) {
      if (!dot.eaten && dot.x === px && dot.y === py) {
        dot.eaten = true;
        player.score += 10;
        break;
      }
    }
  }

  applyStun(player: PlayerState) {
    player.stunned = true;
    player.stunEndTime = Date.now() + 10000;
    player.alpha = 0.4;
    player.score = Math.max(0, player.score - 30);
  }
}
