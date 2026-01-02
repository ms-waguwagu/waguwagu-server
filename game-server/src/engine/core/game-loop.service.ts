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

  run(roomId: string) {
    if (this.lifecycle.isGameOver(roomId)) return;

    const players = this.playerService.getPlayers(roomId);
    const bots = this.botManager.getBots(roomId);
    const now = Date.now();
    const map = this.lifecycle.getMap(roomId);
    const dots = this.lifecycle.getDots(roomId);

    // 플레이어 업데이트
    for (const player of players) {
      if (player.stunned) {
        if (now >= player.stunEndTime) {
          player.stunned = false;
          player.alpha = 1;
        }
        continue;
      }
      this.playerService.updatePlayer(player, map, dots);
    }

    // 유령 업데이트
    this.ghostManager.updateGhosts(roomId, map, players);

    // 봇 업데이트
    this.botManager.updateBots(roomId, map, players, (bot) =>
      this.playerService.checkDotCollision(bot, dots),
    );

    // 충돌 체크
    const collidedPlayer = this.collisionService.checkPlayerGhostCollision(
      roomId,
      players,
    );
    if (collidedPlayer) this.playerService.applyStun(collidedPlayer);

    const collidedBot = this.collisionService.checkBotGhostCollision(roomId);
    if (collidedBot) this.botManager.stunBot(collidedBot);

    // 게임 종료 조건
    if (this.lifecycle.allDotsEaten(roomId)) {
      this.lifecycle.triggerGameOver(roomId, 'all_dots_eaten');
    } else if (this.lifecycle.isTimeOver(roomId)) {
      this.lifecycle.triggerGameOver(roomId, 'time_over');
    }
  }

  // ‼️보스 테스트‼️
  // ‼️ boss ?? null 과 boss?: { x: number; y: number } | null) 이 부분 추가 ‼️
  // getState(roomId: string) {
  //   return this.lifecycle.getState(
  // 		roomId,
  //     this.playerService.getPlayers(roomId),
  //     this.botManager.getBots(roomId),
  //     Object.values(this.ghostManager.getGhosts(roomId)),
  //     boss ?? null,
  //   );
  // }
  // ‼️roomId만 넘기면 모든 상태를 lifecycle이 조합‼️
  getState(roomId: string) {
    return this.lifecycle.getState(roomId);
  }
}
