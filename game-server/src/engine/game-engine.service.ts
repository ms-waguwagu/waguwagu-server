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
    private readonly gameLoop: GameLoopService,
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
    this.gameLoop.run();
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
    return this.gameLoop.getState();
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
