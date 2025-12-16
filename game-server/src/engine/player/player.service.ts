import { Injectable } from '@nestjs/common';
import { PlayerState } from '../../state/player-state';
import { Direction } from '../../types/direction.type';
import {
  TILE_SIZE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PLAYER_COLORS,
} from '../../map/map.data';

export type Player = PlayerState;

export interface Dot {
  x: number;
  y: number;
  eaten: boolean;
}

@Injectable()
export class PlayerService {
  // private players: Record<string, PlayerState> = {};
  // private colorIndex = 0;

	private players: Record<string, Record<string, PlayerState>> = {};
  private colorIndex: Record<string, number> = {};

	private ensureRoom(roomId: string) {
    if (!this.players[roomId]) {
      this.players[roomId] = {};
      this.colorIndex[roomId] = 0;
    }
  }

  constructor() {}

  getPlayers(roomId: string) {
		this.ensureRoom(roomId);
    return Object.values(this.players[roomId]);
  }

  getPlayerMap(roomId: string) {
		this.ensureRoom(roomId);
    return this.players[roomId];
  }

  getPlayer(roomId: string, id: string) {
    return this.players[roomId][id] || null;
  }

  playerCount(roomId: string) {
    return Object.keys(this.players[roomId]).length;
  }

  private pickColor(roomId: string): string {
		this.ensureRoom(roomId);
		const idx = this.colorIndex[roomId];
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    this.colorIndex[roomId] += 1;
    return color;
  }

  addPlayer(roomId: string, id: string, nickname: string) {
		this.ensureRoom(roomId);
    const spawnCol = 1;
    const spawnRow = 1;

    const color = this.pickColor(roomId);

    this.players[roomId][id] = {
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

  removePlayer(roomId: string, id: string) {
		this.ensureRoom(roomId);
    delete this.players[roomId][id];
  }

  handleInput(roomId: string, id: string, dir: Direction) {
		this.ensureRoom(roomId);
    const p = this.players[roomId][id];
    if (!p) return;

    const clamp = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    p.dir = { dx: clamp(dir.dx), dy: clamp(dir.dy) };
  }


  // updatePlayer / checkCollision / checkDotCollision / applyStun 은
  // 그대로 두고, 호출할 때 roomId 기반 players 배열을 넘겨주면 됨
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

  checkDotCollision(player: PlayerState, dots: Dot[]) {
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

	clearRoom(roomId: string) {
    delete this.players[roomId];
    delete this.colorIndex[roomId];
  }

  applyStun(player: PlayerState) {
    player.stunned = true;
    player.stunEndTime = Date.now() + 10000;
    player.alpha = 0.4;
    player.score = Math.max(0, player.score - 30);
  }
}
