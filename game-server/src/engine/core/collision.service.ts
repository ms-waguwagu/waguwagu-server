import { Injectable } from '@nestjs/common';
import { PlayerState } from '../../state/player-state';
import { GhostManagerService } from '../ghost/ghost-manager.service';
import { BotManagerService } from '../bot/bot-manager.service';
import { PLAYER_SIZE } from '../../map/map.data';

@Injectable()
export class CollisionService {
  constructor(
    private readonly ghostManager: GhostManagerService,
    private readonly botManager: BotManagerService,
  ) {}

  checkPlayerGhostCollision(players: PlayerState[]) {
    for (const player of players) {
      if (player.stunned) continue;

      const px = player.x + PLAYER_SIZE / 2;
      const py = player.y + PLAYER_SIZE / 2;

      if (this.ghostManager.checkCollision(px, py)) {
        return player;
      }
    }
    return null;
  }

  checkBotGhostCollision() {
    for (const bot of this.botManager.getBots()) {
      if (bot.stunned) continue;

      const bx = bot.x + PLAYER_SIZE / 2;
      const by = bot.y + PLAYER_SIZE / 2;

      if (this.ghostManager.checkCollision(bx, by)) {
        return bot;
      }
    }
    return null;
  }
}
