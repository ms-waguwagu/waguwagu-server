import { Injectable } from '@nestjs/common';
import { TILE_SIZE, PLAYER_SIZE, MAP_DESIGN } from '../../map/map.data';
import { parseMap } from '../../map/map.service';
import { GhostManagerService } from '../ghost/ghost-manager.service';
import { PlayerService, Dot } from '../player/player.service';
import { BotManagerService } from '../bot/bot-manager.service';

@Injectable()
export class LifecycleService {
  gameStartTime: number = Date.now();
  maxGameDuration = 60000;

  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  map: number[][] = [];
  dots: Dot[] = [];

  roomId: string;
  roomManager: any;

  constructor(
    private readonly ghostManager: GhostManagerService,
    private readonly playerService: PlayerService,
    private readonly botManager: BotManagerService,
  ) {}

  initialize() {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);

    this.map = map;
    this.dots = dots as Dot[];
    this.ghostManager.initialize(ghostSpawns);

    this.gameStartTime = Date.now();
    this.gameOver = false;
    this.gameOverReason = null;
  }

  isTimeOver(): boolean {
    const now = Date.now();
    return now - this.gameStartTime >= this.maxGameDuration;
  }

  allDotsEaten(): boolean {
    return this.dots.every((d) => d.eaten);
  }

  triggerGameOver(reason: string) {
    this.gameOver = true;
    this.gameOverReason = reason;

    this.sendGameOverEvent();

    if (process.env.MODE === 'DEV') {
      setTimeout(() => {
        this.resetGame();
      }, 5000);
    } else {
      setTimeout(() => {
        if (this.roomManager && this.roomId) {
          this.roomManager.removeRoom(this.roomId);
        }
      }, 5000);
    }
  }

  sendGameOverEvent() {
    if (this.roomManager?.server) {
      this.roomManager.server.to(this.roomId).emit('game-over', {
        players: this.playerService.getPlayers(),
        botPlayers: this.botManager.getBots(),
        reason: this.gameOverReason ?? 'unknown',
      });
    }
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

    this.ghostManager.initialize(ghostSpawns);
    this.botManager.resetBots();

    this.gameStartTime = Date.now();
    this.gameOver = false;
    this.gameOverReason = null;
  }
}
