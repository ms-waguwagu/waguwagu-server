import { Injectable } from '@nestjs/common';
import { PlayerService } from '../player/player.service';
import { BotManagerService } from '../bot/bot-manager.service';
import { GhostManagerService } from '../ghost/ghost-manager.service';
import { CollisionService } from './collision.service';
import { LifecycleService } from './lifecycle.service';

@Injectable()
export class GameLoopService {
    constructor(
        private readonly playerService: PlayerService,
        private readonly botManager: BotManagerService,
        private readonly ghostManager: GhostManagerService,
        private readonly collisionService: CollisionService,
        private readonly lifecycle: LifecycleService,
      ) {}

  run() {
    if (this.lifecycle.gameOver) {
      this.ghostManager.updateGhosts(this.lifecycle.map, this.playerService.getPlayers());
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
      this.playerService.updatePlayer(player, this.lifecycle.map, this.lifecycle.dots);
    }

    this.ghostManager.updateGhosts(this.lifecycle.map, this.playerService.getPlayers());

    this.botManager.updateBots(this.lifecycle.map, this.playerService.getPlayers(), (p) =>
      this.playerService['checkDotCollision'](p, this.lifecycle.dots),
    );

    const collidedPlayer = this.collisionService.checkPlayerGhostCollision(
      this.playerService.getPlayers(),
    );
    if (collidedPlayer) this.playerService.applyStun(collidedPlayer);

    const collidedBot = this.collisionService.checkBotGhostCollision();
    if (collidedBot) this.botManager.stunBot(collidedBot);

    if (this.lifecycle.allDotsEaten()) this.lifecycle.triggerGameOver('all_dots_eaten');
    if (this.lifecycle.isTimeOver()) this.lifecycle.triggerGameOver('time_over');
  }

  getState() {
    return this.lifecycle.getState(
      this.playerService.getPlayers(),
      this.botManager.getBots(),
      Object.values(this.ghostManager.getGhosts())
    );
  }
}
