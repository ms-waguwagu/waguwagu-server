// player-bot.service.ts
import { TILE_SIZE } from '../../map/map.data';
import { getPathBFS, findRandomTarget } from '../../pathfinding/pathfinding';
import { PlayerState } from '../../state/player-state';

export class BotMoveService {
  static updateBotPlayer(
    bot: PlayerState,
    map: number[][],
    targetPlayers: PlayerState[],
    checkDotCollision?: (player: PlayerState) => void,
  ) {
    // ⭐ 스턴 상태면 이동 스킵
    if (bot.stunned) return;

    // 기존 로직 계속...
    if (!bot.targetX || !bot.targetY || BotMoveService.reachedTarget(bot)) {
      if (bot.targetX != null) bot.x = bot.targetX;
      if (bot.targetY != null) bot.y = bot.targetY;

      if (!bot.path || bot.path.length === 0) {
        const targetTile = findRandomTarget(
          map,
          Math.floor(bot.x / TILE_SIZE),
          Math.floor(bot.y / TILE_SIZE),
        );

        if (targetTile) {
          bot.path = getPathBFS(
            map,
            Math.floor(bot.x / TILE_SIZE),
            Math.floor(bot.y / TILE_SIZE),
            targetTile.x,
            targetTile.y,
          );
        }
      }

      if (bot.path && bot.path.length > 0) {
        const nextStep = bot.path.shift()!;
        const offset = TILE_SIZE / 2;
        bot.targetX = nextStep.x * TILE_SIZE + offset;
        bot.targetY = nextStep.y * TILE_SIZE + offset;
      }
    }

    if (bot.targetX != null && bot.targetY != null) {
      const dx = bot.targetX - bot.x;
      const dy = bot.targetY - bot.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        const step = Math.min(3, dist); // 봇 속도
        bot.x += (dx / dist) * step;
        bot.y += (dy / dist) * step;
        bot.dir = { dx: dx / dist, dy: dy / dist };
      }
    }

    if (checkDotCollision) checkDotCollision(bot);
  }

  static reachedTarget(bot: PlayerState) {
    if (bot.targetX == null || bot.targetY == null) return true;
    const threshold = 0.5;
    return (
      Math.abs(bot.x - bot.targetX) < threshold &&
      Math.abs(bot.y - bot.targetY) < threshold
    );
  }
}
