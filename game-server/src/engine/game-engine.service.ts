/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PlayerState } from '../state/player-state';
import { GhostState } from '../state/ghost-state';
import { Direction } from '../types/direction.type';
import { TILE_SIZE, PLAYER_SIZE, PLAYER_SPEED, GHOST_SIZE, MAP_DESIGN, PLAYER_COLORS } from '../map/map.data';
import { parseMap } from '../map/map.service';
import { GhostService } from './ghost.service';

interface Dot {
  x: number;
  y: number;
  eaten: boolean;
}

@Injectable()
export class GameEngineService {
  // ========================= WebSocketGateway 호환 =========================
  roomId: string; // gateway에서 roomId 할당
  roomManager: any; // gateway 참조

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  // ========================= 게임 상태 =========================
  private players: Record<string, PlayerState> = {};
  private ghosts: Record<string, GhostState> = {};
  private map: number[][] = [];
  private dots: Dot[] = [];
  private ghostSpawns: { x: number; y: number }[] = [];

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  constructor() {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;
    this.ghostSpawns = ghostSpawns;

    this.rows = map.length;
    this.cols = map[0].length;
  }

  // ========================= 플레이어 관리 =========================
  getPlayer(id: string) {
    return this.players[id] || null;
  }

  playerCount() {
    return Object.keys(this.players).length;
  }

  addPlayer(id: string, nickname: string) {
    const spawnCol = 1;
    const spawnRow = 1;
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    const color = PLAYER_COLORS[Object.keys(this.players).length % PLAYER_COLORS.length];

    this.players[id] = {
      id,
      nickname,
      x: spawnCol * TILE_SIZE + offset,
      y: spawnRow * TILE_SIZE + offset,
      dir: { dx: 0, dy: 0 },
      color,
      score: 0,
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

  // ========================= Ghost 관리 =========================
  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    if (!this.ghostSpawns.length) return;
    const spawn = this.ghostSpawns[Math.floor(Math.random() * this.ghostSpawns.length)];
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

  // ========================= 게임 업데이트 =========================
  update() {
    if (this.gameOver) return;

    // 플레이어 이동
    for (const p of Object.values(this.players)) this.updatePlayer(p);

    // 유령 이동
    for (const g of Object.values(this.ghosts)) GhostService.updateGhost(g, this.map);

    // 충돌 체크
    this.checkPlayerGhostCollision();
  }

  private updatePlayer(player: PlayerState) {
    const { dx, dy } = player.dir;
    if (dx === 0 && dy === 0) return;

    const nextX = player.x + dx * PLAYER_SPEED;
    const nextY = player.y + dy * PLAYER_SPEED;

    if (!this.checkCollision(nextX, nextY, PLAYER_SIZE)) {
      player.x = nextX;
      player.y = nextY;
      this.checkDotCollision(player);
    }
  }

  // ========================= 충돌 체크 =========================
  private checkCollision(x: number, y: number, size: number) {
    const minX = x, maxX = x + size, minY = y, maxY = y + size;
    const startTileX = Math.floor(minX / TILE_SIZE);
    const startTileY = Math.floor(minY / TILE_SIZE);
    const endTileX = Math.floor(maxX / TILE_SIZE);
    const endTileY = Math.floor(maxY / TILE_SIZE);

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return true;
        if (this.map[ty][tx] === 1) return true;
      }
    }
    return false;
  }

  private checkDotCollision(player: PlayerState) {
    const px = Math.floor((player.x + PLAYER_SIZE / 2) / TILE_SIZE);
    const py = Math.floor((player.y + PLAYER_SIZE / 2) / TILE_SIZE);

    for (const dot of this.dots) {
      if (!dot.eaten && dot.x === px && dot.y === py) {
        dot.eaten = true;
        player.score += 10;
        break;
      }
    }
  }

  private checkPlayerGhostCollision() {
    for (const player of Object.values(this.players)) {
      for (const ghost of Object.values(this.ghosts)) {
        const dist = Math.hypot(player.x + PLAYER_SIZE / 2 - ghost.x, player.y + PLAYER_SIZE / 2 - ghost.y);
        if (dist < (PLAYER_SIZE + GHOST_SIZE) / 2 - 2) {
          this.gameOver = true;
          this.gameOverPlayerId = player.id;
          this.gameOverReason = `caught_by_ghost:${ghost.id}`;
        }
      }
    }
  }

  // ========================= 상태 반환 =========================
  getMapData() {
    return {
      map: this.map,
      dots: this.dots,
      rows: this.rows,
      cols: this.cols,
      tileSize: this.tileSize,
    };
  }

  getState() {
    return {
      players: JSON.parse(JSON.stringify(this.players)),
      ghosts: JSON.parse(JSON.stringify(this.ghosts)),
      dots: JSON.parse(JSON.stringify(this.dots)),
      gameOver: this.gameOver,
      gameOverPlayerId: this.gameOverPlayerId,
      gameOverReason: this.gameOverReason,
    };
  }

  allDotsEaten() {
    return this.dots.every(d => d.eaten);
  }

  getAllPlayerScores() {
    return Object.values(this.players).map(p => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
    }));
  }

  resetGame() {
    const { map, dots } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;

    const spawnOffset = (TILE_SIZE - PLAYER_SIZE) / 2;
    for (const p of Object.values(this.players)) {
      p.x = 1 * TILE_SIZE + spawnOffset;
      p.y = 1 * TILE_SIZE + spawnOffset;
      p.dir = { dx: 0, dy: 0 };
      p.score = 0;
    }

    const ghostOffset = TILE_SIZE / 2;
    for (const g of Object.values(this.ghosts)) {
      g.x = 14 * TILE_SIZE + ghostOffset;
      g.y = 13 * TILE_SIZE + ghostOffset;
      g.dir = { dx: 0, dy: 0 };
      g.path = [];
      g.targetX = undefined;
      g.targetY = undefined;
    }

    this.gameOver = false;
    this.gameOverPlayerId = null;
    this.gameOverReason = null;
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.intervalRunning = false;
    }
  }
}
