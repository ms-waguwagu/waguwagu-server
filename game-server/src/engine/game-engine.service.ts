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

import { GhostManagerService } from './ghost/ghost-manager.service';
import { PlayerBotService } from './player-bot.service';
import { PlayerService, Dot } from './player/player.service';

@Injectable()
export class GameEngineService {
  roomId: string;
  roomManager: any;

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  private map: number[][] = [];
  private dots: Dot[] = [];
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
    private readonly ghostManager: GhostManagerService,
    private readonly playerService: PlayerService,
  ) {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);

    this.map = map;
    this.dots = dots as Dot[];
    this.ghostManager.initialize(ghostSpawns);

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

  // ========== 유령 관리 ==========
  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    this.ghostManager.addGhost(id, opts);
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
      // 게임오버 상태에서도 고스트만 업데이트됨
      this.ghostManager.updateGhosts(
        this.map,
        this.playerService.getPlayers(),
      );
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

    // 유령 이동 (관리자)
    this.ghostManager.updateGhosts(this.map, this.playerService.getPlayers());

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

    // 충돌 체크
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

      const px = player.x + PLAYER_SIZE / 2;
      const py = player.y + PLAYER_SIZE / 2;

      if (this.ghostManager.checkCollision(px, py)) {
        this.playerService.applyStun(player);
        return;
      }
    }
  }

  private checkBotGhostCollision() {
    for (const bot of this.botPlayers) {
      if (bot.stunned) continue;

      const bx = bot.x + PLAYER_SIZE / 2;
      const by = bot.y + PLAYER_SIZE / 2;

      if (this.ghostManager.checkCollision(bx, by)) {
        bot.stunned = true;
        bot.stunEndTime = Date.now() + 10000;
        bot.alpha = 0.4;
        bot.score = Math.max(0, bot.score - 30);
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

    return {
      players: this.playerService.getPlayers().map((p) => ({ ...p })),
      botPlayers: this.botPlayers.map((b) => ({ ...b })),
      dots: this.dots.map((d) => ({ ...d })),
      ghosts: Object.values(this.ghostManager.getGhosts()).map((g) => ({ ...g })),
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
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots as Dot[];

    const spawnOffset = (TILE_SIZE - PLAYER_SIZE) / 2;

    for (const p of this.playerService.getPlayers()) {
      p.x = 1 * TILE_SIZE + spawnOffset;
      p.y = 1 * TILE_SIZE + spawnOffset;
      p.dir = { dx: 0, dy: 0 };
      p.score = 0;
    }

    // 유령 위치도 초기화
    this.ghostManager.initialize(ghostSpawns);

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
