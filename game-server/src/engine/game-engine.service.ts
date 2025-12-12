/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { Direction } from '../types/direction.type';
import { TILE_SIZE, PLAYER_SIZE, MAP_DESIGN } from '../map/map.data';
import { parseMap } from '../map/map.service';

import { GhostManagerService } from './ghost/ghost-manager.service';
import { PlayerService, Dot } from './player/player.service';
import { BotManagerService } from './bot/bot-manager.service';
import { CollisionService } from './core/collision.service';
import { LifecycleService } from './core/lifecycle.service';

@Injectable()
export class GameEngineService {
  roomId: string;
  roomManager: any;

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  constructor(
    private readonly ghostManager: GhostManagerService,
    private readonly playerService: PlayerService,
    private readonly botManager: BotManagerService,
    private readonly collisionService: CollisionService,
    private readonly lifecycle: LifecycleService,
  ) {
    const { map } = parseMap(MAP_DESIGN);

    this.lifecycle.initialize();

    this.rows = map.length;
    this.cols = map[0].length;
  }

  get map() {
    return this.lifecycle.map;
  }

  get dots() {
    return this.lifecycle.dots;
  }

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

  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    this.ghostManager.addGhost(id, opts);
  }

  addBotPlayer(nickname?: string) {
    this.botManager.addBotPlayer(nickname);
  }

  getBotCount() {
    return this.botManager.getBotCount();
  }

  getNextBotNumber() {
    return this.botManager.getNextBotNumber();
  }

  update() {
    if (this.lifecycle.gameOver) {
      this.ghostManager.updateGhosts(this.map, this.playerService.getPlayers());
      return;
    }

    const now = Date.now();

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

    this.ghostManager.updateGhosts(this.map, this.playerService.getPlayers());

    this.botManager.updateBots(this.map, this.playerService.getPlayers(), (p) =>
      this.playerService['checkDotCollision'](p, this.dots),
    );

    const collidedPlayer = this.collisionService.checkPlayerGhostCollision(
      this.playerService.getPlayers(),
    );
    if (collidedPlayer) {
      this.playerService.applyStun(collidedPlayer);
    }

    const collidedBot = this.collisionService.checkBotGhostCollision();
    if (collidedBot) {
      this.botManager.stunBot(collidedBot);
    }

    if (this.lifecycle.allDotsEaten()) {
      this.lifecycle.triggerGameOver('all_dots_eaten');
      return;
    }

    if (this.lifecycle.isTimeOver()) {
      this.lifecycle.triggerGameOver('time_over');
      return;
    }
  }
  get gameOver() {
    return this.lifecycle.gameOver;
  }

  resetGame() {
    return this.lifecycle.resetGame();
  }

  getAllPlayerScores() {
    return this.playerService.getPlayers().map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
    }));
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
    const now = Date.now();
    const remainingTime = Math.max(
      0,
      this.lifecycle.maxGameDuration - (now - this.lifecycle.gameStartTime),
    );

    return {
      players: this.playerService.getPlayers().map((p) => ({ ...p })),
      botPlayers: this.botManager.getBots().map((b) => ({ ...b })),
      dots: this.dots.map((d) => ({ ...d })),
      ghosts: Object.values(this.ghostManager.getGhosts()).map((g) => ({
        ...g,
      })),
      gameOver: this.lifecycle.gameOver,
      gameOverPlayerId: this.lifecycle.gameOverPlayerId,
      gameOverReason: this.lifecycle.gameOverReason,
      remainingTime,
    };
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
