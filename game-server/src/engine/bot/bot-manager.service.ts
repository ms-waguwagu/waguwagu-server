import { Injectable } from '@nestjs/common';
import { TILE_SIZE, PLAYER_SIZE, PLAYER_SPAWNS } from '../../map/map.data';
import { BotMoveService } from './bot-move.service';
import { BotState } from '../../state/bot-state';
import { PlayerState } from '../../state/player-state';

export type Bot = BotState;

@Injectable()
export class BotManagerService {
  // private botPlayers: BotState[] = [];
  // private botCount = 0;

	private botPlayers: Record<string, BotState[]> = {};
  private botCount: Record<string, number> = {};

  private ensureRoom(roomId: string) {
    if (!this.botPlayers[roomId]) {
      this.botPlayers[roomId] = [];
      this.botCount[roomId] = 0;
    }
  }

  getBots(roomId: string): BotState[] {
		this.ensureRoom(roomId);
    return this.botPlayers[roomId];
  }

  getBotCount(roomId: string): number {
    this.ensureRoom(roomId);
    return this.botPlayers[roomId].length;
  }

  getNextBotNumber(roomId: string): number {
    this.ensureRoom(roomId);
    this.botCount[roomId] += 1;
    return this.botCount[roomId];
  }

  addBotPlayer(roomId: string, spawnIndex: number, nickname?: string) {
    this.ensureRoom(roomId);
    const spawn = PLAYER_SPAWNS[spawnIndex % PLAYER_SPAWNS.length];
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    
    const botNum = this.getNextBotNumber(roomId);
    const botName = nickname || `bot-${botNum}`;

    this.botPlayers[roomId].push({
      id: botName,
      nickname: botName,
      x: spawn.x * TILE_SIZE + offset,
      y: spawn.y * TILE_SIZE + offset,
      dir: { dx: 0, dy: 0 },
      color: 'gray',
      score: 0,
      stunned: false,
      stunEndTime: 0,
      alpha: 1,
      path: [],
      targetX: spawn.x * TILE_SIZE + offset,
      targetY: spawn.y * TILE_SIZE + offset,
    });
  }

  updateBots(
		roomId: string,
    map: number[][],
    humans: PlayerState[],
    checkDotCollision: (bot: BotState) => void,
  ) {
		this.ensureRoom(roomId);
    const now = Date.now();

    for (const bot of this.botPlayers[roomId]) {
      if (bot.stunned && now >= bot.stunEndTime) {
        bot.stunned = false;
        bot.alpha = 1;
      }

      BotMoveService.updateBotPlayer(bot, map, humans, checkDotCollision);
    }
  }

  stunBot(bot: BotState) {
    bot.stunned = true;
    bot.stunEndTime = Date.now() + 3000;
    bot.alpha = 0.4;
    bot.score = Math.max(0, bot.score - 30);
  }

  resetBots(roomId: string) {
    delete this.botPlayers[roomId];
    delete this.botCount[roomId];
  }
}
