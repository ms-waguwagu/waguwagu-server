/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { Direction } from '../types/direction.type';
import { TILE_SIZE, MAP_DESIGN } from '../map/map.data';
import { parseMap } from '../map/map.service';

import { GhostManagerService } from './ghost/ghost-manager.service';
import { PlayerService } from './player/player.service';
import { BotManagerService } from './bot/bot-manager.service';
import { CollisionService } from './core/collision.service';
import { LifecycleService } from './core/lifecycle.service';
import { GameLoopService } from './core/game-loop.service';
import { BossManagerService } from '../boss/boss-manager.service';

type GameMode = 'NORMAL' | 'BOSS';

@Injectable()
export class GameEngineService {
  roomId: string;
  roomManager: any;

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  gameMode: GameMode = 'NORMAL';

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  constructor(
    private readonly ghostManager: GhostManagerService,
    private readonly playerService: PlayerService,
    private readonly botManager: BotManagerService,
    private readonly collisionService: CollisionService,
    private readonly lifecycle: LifecycleService,
    private readonly gameLoop: GameLoopService,
    private readonly bossManager: BossManagerService,
  ) {
    const { map } = parseMap(MAP_DESIGN);
    this.rows = map.length;
    this.cols = map[0].length;
  }

  /* =========================
     초기화 / 모드
  ========================= */

  initialize() {
    this.lifecycle.initialize(this.roomId);
  }

  setMode(mode: GameMode) {
    this.gameMode = mode;
  }

  isBossMode(): boolean {
    return this.gameMode === 'BOSS';
  }

  /* =========================
     Map / State
  ========================= */

  get map() {
    return this.lifecycle.getMap(this.roomId);
  }

  get dots() {
    return this.lifecycle.getDots(this.roomId);
  }

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
    return this.gameLoop.getState(this.roomId);
  }

  /* =========================
     Player / Bot / Ghost
  ========================= */

  getPlayer(id: string) {
    return this.playerService.getPlayer(this.roomId, id);
  }

  addPlayer(id: string, googleSub: string, nickname: string) {
    this.playerService.addPlayer(this.roomId, id, googleSub, nickname);
  }

  removePlayer(id: string) {
    this.playerService.removePlayer(this.roomId, id);
  }

  handleInput(id: string, dir: Direction) {
    this.playerService.handleInput(this.roomId, id, dir);
  }

  playerCount() {
    return this.playerService.playerCount(this.roomId);
  }

  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    this.ghostManager.addGhost(this.roomId, id, opts);
  }

  addBotPlayer(nickname?: string) {
    this.botManager.addBotPlayer(this.roomId, nickname);
  }

  getBotCount() {
    return this.botManager.getBotCount(this.roomId);
  }

  getNextBotNumber() {
    return this.botManager.getNextBotNumber(this.roomId);
  }

  /* =========================
     Game Loop
  ========================= */

  update() {
    this.gameLoop.run(this.roomId);
  }

  get gameOver() {
    return this.lifecycle.isGameOver(this.roomId);
  }

  resetGame() {
    return this.lifecycle.resetGame(this.roomId);
  }

  /* =========================
     ⭐ 게임 종료 결과 생성 (핵심)
  ========================= */

  /**
   * 게임 정상 종료 시 최종 결과 생성
   * - googleSub 기준
   * - score 내림차순
   * - rank 계산 포함
   */
  getFinalResults(): {
    googleSub: string;
    score: number;
    rank: number;
  }[] {
    const players = this.playerService.getPlayers(this.roomId);

    return players
      .map((p) => ({
        googleSub: p.googleSub,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((p, index) => ({
        ...p,
        rank: index + 1,
      }));
  }

  /* =========================
     Boss Mode (Debug / Test)
  ========================= */

  startBossMode() {
    if (this.intervalRunning) {
      console.log(`[BossMode] Room ${this.roomId} 이미 실행 중`);
      return;
    }
    const results = this.getFinalResults();

    console.log(`[BossMode] Room ${this.roomId} 보스 모드 시작`);
    this.intervalRunning = true;

    this.interval = setInterval(() => {
      this.update();

      if (this.roomManager?.server) {
        this.roomManager.server.to(this.roomId).emit('state', this.getState());
      }

      if (this.gameOver) {
        console.log(`[Game] Room ${this.roomId} 게임 종료`);

        const results = this.getFinalResults();

        // ⭐ Matching Server에 "게임 종료" 알림
        this.roomManager?.onGameFinished({
          roomId: this.roomId,
          results,
        });

        this.stopInterval();
      }
    }, 1000 / 30);
  }

  /* =========================
     Cleanup
  ========================= */

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.intervalRunning = false;
      console.log(`Room ${this.roomId} interval stopped`);
    }
  }
}
