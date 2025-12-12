/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PlayerState } from '../state/player-state';
import { GhostState } from '../state/ghost-state';
import { Direction } from '../types/direction.type';
import {
  TILE_SIZE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  GHOST_SIZE,
  MAP_DESIGN,
} from '../map/map.data';
import { parseMap } from '../map/map.service';
import { GhostService } from './ghost/ghost.service';
import { PlayerBotService } from './player-bot.service';
import { PlayerService, Dot } from './player/player.service';

@Injectable()
export class GameEngineService {
  roomId: string;
  roomManager: any;

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  private ghosts: Record<string, GhostState> = {};
  private map: number[][] = [];
  private dots: Dot[] = [];
  private ghostSpawns: { x: number; y: number }[] = [];
  private botPlayers: PlayerState[] = [];

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  gameStartTime: number = Date.now();
  maxGameDuration = 60000;

  private botCount = 0;

  constructor(
    private readonly ghostService: GhostService,
    private readonly playerService: PlayerService,
  ) {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots as Dot[];
    this.ghostSpawns = ghostSpawns;

    this.rows = map.length;
    this.cols = map[0].length;
  }

  // ========== 플레이어 포워딩 ==========
  getPlayer(id: string) {
    return this.playerService.getPlayer(id);
  }

  addPlayer(id: string, nickname: string) {
    this.playerService.addPlayer(id, nickname);
  }

  removePlayer(id: string) {
    this.playerService.removePlayer(id);
  }

  handleInput(id: string, dir: Direction) {
    this.playerService.handleInput(id, dir);
  }

  playerCount() {
    return this.playerService.playerCount();
  }

  // ========== Ghost 관리 ==========
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

  // ========== 봇 ==========

  getNextBotNumber(): number {
    this.botCount += 1;
    return this.botCount;
  }

  addBotPlayer(nickname?: string) {
    const spawnCol = 1;
    const spawnRow = 1;
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;

    const botName = nickname ?? `bot-${this.botCount}`;

    this.botPlayers.push({
      id: botName,
      nickname: botName,
      x: spawnCol * TILE_SIZE + offset,
      y: spawnRow * TILE_SIZE + offset,
      dir: { dx: 0, dy: 0 },
      color: 'gray',
      score: 0,
      stunned: false,
      stunEndTime: 0,
      alpha: 1,
      path: [],
      targetX: undefined,
      targetY: undefined,
    });
  }

  public getBotCount(): number {
    return this.botPlayers.length;
  }

  // ========== 메인 업데이트 ==========
  update() {
    const now = Date.now();

    if (this.gameOver) {
      const ghostArray = Object.values(this.ghosts);
      ghostArray.forEach((ghost, index) => {
        const isChaser = index === 0;
        ghost.color = isChaser ? 'red' : 'white';

        GhostService.updateGhost(
          ghost,
          this.map,
          this.playerService.getPlayers(),
          isChaser,
        );
      });
      return;
    }

    // 플레이어 이동 업데이트
    for (const player of this.playerService.getPlayers()) {
      if (player.stunned) {
        if (now >= player.stunEndTime) {
          player.stunned = false;
          player.alpha = 1;
        }
        continue;
      }

      this.playerService.updatePlayer(player, this.map, this.dots);
    }

    // 유령 로직
    const ghostArray = Object.values(this.ghosts);
    ghostArray.forEach((ghost, index) => {
      const isChaser = index === 0;
      ghost.color = isChaser ? 'red' : 'white';

      GhostService.updateGhost(
        ghost,
        this.map,
        this.playerService.getPlayers(),
        isChaser,
      );
    });

    // 봇 이동
    for (const bot of this.botPlayers) {
      if (bot.stunned && now >= bot.stunEndTime) {
        bot.stunned = false;
        bot.alpha = 1;
      }

      PlayerBotService.updateBotPlayer(
        bot,
        this.map,
        this.playerService.getPlayers(),
        (p) => this.playerService['checkDotCollision'](p, this.dots),
      );
    }

    // 충돌
    this.checkBotGhostCollision();
    this.checkPlayerGhostCollision();

    // 점 다 먹으면 게임오버
    if (this.allDotsEaten()) {
      this.gameOver = true;
      this.gameOverReason = 'all_dots_eaten';
      this.onGameOver();
      return;
    }

    // 타이머 종료
    if (now - this.gameStartTime >= this.maxGameDuration) {
      this.gameOver = true;
      this.gameOverReason = 'time_over';
      this.onGameOver();
      return;
    }
  }

  // ========== 충돌 처리 ==========
  private checkPlayerGhostCollision() {
    for (const player of this.playerService.getPlayers()) {
      if (player.stunned) continue;

      for (const ghost of Object.values(this.ghosts)) {
        const px = player.x + PLAYER_SIZE / 2;
        const py = player.y + PLAYER_SIZE / 2;
        const gx = ghost.x + PLAYER_SIZE / 2;
        const gy = ghost.y + PLAYER_SIZE / 2;

        const dist = Math.hypot(px - gx, py - gy);
        const threshold = PLAYER_SIZE;

        if (dist < threshold) {
          this.playerService.applyStun(player);
          return;
        }
      }
    }
  }

  private checkBotGhostCollision() {
    for (const bot of this.botPlayers) {
      if (bot.stunned) continue;

      for (const ghost of Object.values(this.ghosts)) {
        const bx = bot.x + PLAYER_SIZE / 2;
        const by = bot.y + PLAYER_SIZE / 2;
        const gx = ghost.x + PLAYER_SIZE / 2;
        const gy = ghost.y + PLAYER_SIZE / 2;

        const dist = Math.hypot(bx - gx, by - gy);
        const threshold = PLAYER_SIZE;

        if (dist < threshold) {
          bot.stunned = true;
          bot.stunEndTime = Date.now() + 10000;
          bot.alpha = 0.4;
          bot.score = Math.max(0, bot.score - 30);
          break;
        }
      }
    }
  }

  // ========== 상태 반환 ==========
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
    const now = Date.now();

    const remainingTime = Math.max(
      0,
      this.maxGameDuration - (now - this.gameStartTime),
    );

    const serializedPlayers = this.playerService
      .getPlayers()
      .map((p) => ({ ...p }));
    const serializedBotPlayers = this.botPlayers.map((b) => ({ ...b }));
    const serializedDots = this.dots.map((d) => ({ ...d }));
    const serializedGhosts = Object.values(this.ghosts).map((g) => ({ ...g }));

    return {
      players: serializedPlayers,
      botPlayers: serializedBotPlayers,
      dots: serializedDots,
      ghosts: serializedGhosts,
      gameOver: this.gameOver,
      gameOverPlayerId: this.gameOverPlayerId,
      gameOverReason: this.gameOverReason,
      remainingTime,
    };
  }

  // ========== 게임 리셋 ==========
  allDotsEaten(): boolean {
    return this.dots.every((d) => d.eaten);
  }

  resetGame() {
    const { map, dots } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots as Dot[];

    const spawnOffset = (TILE_SIZE - PLAYER_SIZE) / 2;

    for (const p of this.playerService.getPlayers()) {
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

  getAllPlayerScores() {
    const humanScores = this.playerService.getPlayers().map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
    }));

    const botScores = this.botPlayers.map((b) => ({
      playerId: b.id,
      nickname: b.nickname,
      score: b.score,
    }));

    return [...humanScores, ...botScores];
  }

  onGameOver() {
    console.log('💀 게임오버 발생! MODE =', process.env.MODE);

    const finalScores = this.getAllPlayerScores();

    if (this.roomManager?.server) {
      this.roomManager.server.to(this.roomId).emit('game-over', {
        players: this.playerService.getPlayers(),
        botPlayers: this.botPlayers,
        reason: this.gameOverReason ?? 'unknown',
      });
      console.log('📢 game-over 이벤트 전송 완료!');
    }

    if (process.env.MODE === 'DEV') {
      setTimeout(() => {
        console.log('🔄 DEV 모드 → 게임 자동 리셋 실행');
        this.resetGame();
      }, 5000);
    } else {
      setTimeout(() => {
        console.log('🔥 PROD 모드 → 방 삭제 실행:', this.roomId);

        if (this.roomManager && this.roomId) {
          this.roomManager.removeRoom(this.roomId);
        }
      }, 5000);
    }
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.intervalRunning = false;
      console.log(`Room ${this.roomId} interval stopped`);
    }
  }
}
