import { Injectable } from '@nestjs/common';
import { TILE_SIZE, PLAYER_SIZE } from '../../map/map.data';
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

  addBotPlayer(roomId: string, nickname?: string) {
    this.ensureRoom(roomId);
    const spawnCol = 1;
    const spawnRow = 1;
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    
    // 봇은 번호로 생성
    const botNum = this.getNextBotNumber(roomId);
    const botName = `bot-${botNum}`;

    this.botPlayers[roomId].push({
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
      targetX: spawnCol * TILE_SIZE + offset,
      targetY: spawnRow * TILE_SIZE + offset,
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
    bot.stunEndTime = Date.now() + 10000;
    bot.alpha = 0.4;
    bot.score = Math.max(0, bot.score - 30);
  }

  resetBots(roomId: string) {
    delete this.botPlayers[roomId];
    delete this.botCount[roomId];
  }
}
