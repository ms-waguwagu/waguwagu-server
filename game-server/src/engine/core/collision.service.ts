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

	// 플레이어 - 유령 충돌 체크
  checkPlayerGhostCollision(roomId: string, players: PlayerState[]) {
    for (const player of players) {
      if (player.stunned) continue;

      const px = player.x + PLAYER_SIZE / 2;
      const py = player.y + PLAYER_SIZE / 2;

      if (this.ghostManager.checkCollision(roomId, px, py)) {
        return player;
      }
    }
    return null;
  }

  checkBotGhostCollision(roomId: string) {
    for (const bot of this.botManager.getBots(roomId)) {
      if (bot.stunned) continue;

      const bx = bot.x + PLAYER_SIZE / 2;
      const by = bot.y + PLAYER_SIZE / 2;

      if (this.ghostManager.checkCollision(roomId, bx, by)) {
        return bot;
      }
    }
    return null;
  }
}
