import { Injectable } from '@nestjs/common';
import { PlayerState } from '../../state/player-state';
import { TILE_SIZE, PLAYER_SIZE } from '../../map/map.data';
import { BotMoveService } from './bot-move.service';
import { PlayerState as HumanPlayer } from '../../state/player-state';
import { Dot } from '../player/player.service';

@Injectable()
export class BotManagerService {
  private botPlayers: PlayerState[] = [];
  private botCount = 0;

  getBots() {
    return this.botPlayers;
  }

  getBotCount(): number {
    return this.botPlayers.length;
  }

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

  updateBots(
    map: number[][],
    humans: HumanPlayer[],
    checkDotCollision: (p: PlayerState) => void,
  ) {
    const now = Date.now();

    for (const bot of this.botPlayers) {
      if (bot.stunned && now >= bot.stunEndTime) {
        bot.stunned = false;
        bot.alpha = 1;
      }

      BotMoveService.updateBotPlayer(
        bot,
        map,
        humans,
        checkDotCollision,
      );
    }
  }

  applyGhostCollision(ghostHitCallback: (bot: PlayerState) => void) {
    // 외부에서 충돌 여부 체크 후, true면 이 함수 호출하도록 설계
    ghostHitCallback;
  }

  stunBot(bot: PlayerState) {
    bot.stunned = true;
    bot.stunEndTime = Date.now() + 10000;
    bot.alpha = 0.4;
    bot.score = Math.max(0, bot.score - 30);
  }

  resetBots() {
    this.botPlayers = [];
    this.botCount = 0;
  }
}
