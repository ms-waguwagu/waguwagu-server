import { GhostState } from '../../state/ghost-state';
import { PlayerState } from 'src/state/player-state';
import { randomDirection } from '../utils.service';
import { getPathBFS, findRandomTarget } from '../../pathfinding/pathfinding';
import { TILE_SIZE } from '../../map/map.data';

export class GhostService {
static updateGhost(
  ghost: GhostState,
  map: number[][],
  players: PlayerState[],
  isChaser: boolean
) {
  if (!ghost.targetX || !ghost.targetY || GhostService.reachedTarget(ghost)) {
    if (ghost.targetX != null) ghost.x = ghost.targetX;
    if (ghost.targetY != null) ghost.y = ghost.targetY;

    if (!ghost.path || ghost.path.length === 0) {
      let targetTile;

      if (isChaser) {
        // 살아있는 플레이어 중 첫 번째 선택
        const alivePlayers = players.filter(p => !p.stunned);
        if (alivePlayers.length > 0) {
          const player = alivePlayers[0]; // 단순히 첫 번째 살아있는 플레이어 추적
          targetTile = {
            x: Math.floor(player.x / TILE_SIZE),
            y: Math.floor(player.y / TILE_SIZE),
          };
        } else {
          // 살아있는 플레이어 없으면 랜덤 BFS
          targetTile = findRandomTarget(
            map,
            Math.floor(ghost.x / TILE_SIZE),
            Math.floor(ghost.y / TILE_SIZE)
          );
        }
      } else {
        // 일반 유령 랜덤 BFS
        targetTile = findRandomTarget(
          map,
          Math.floor(ghost.x / TILE_SIZE),
          Math.floor(ghost.y / TILE_SIZE)
        );
      }

      if (targetTile) {
        ghost.path = getPathBFS(
          map,
          Math.floor(ghost.x / TILE_SIZE),
          Math.floor(ghost.y / TILE_SIZE),
          targetTile.x,
          targetTile.y
        );
      }
    }

    if (ghost.path && ghost.path.length > 0) {
      const nextStep = ghost.path.shift()!;
      const offset = TILE_SIZE / 2;
      ghost.targetX = nextStep.x * TILE_SIZE + offset;
      ghost.targetY = nextStep.y * TILE_SIZE + offset;
    } else {
      const dir = randomDirection();
      const offset = TILE_SIZE / 2;
      const currentTileX = Math.floor(ghost.x / TILE_SIZE);
      const currentTileY = Math.floor(ghost.y / TILE_SIZE);
      ghost.targetX = (currentTileX + dir.dx) * TILE_SIZE + offset;
      ghost.targetY = (currentTileY + dir.dy) * TILE_SIZE + offset;
    }
  }

  // 기존 이동 로직 유지
  if (ghost.targetX != null && ghost.targetY != null) {
    const dx = ghost.targetX - ghost.x;
    const dy = ghost.targetY - ghost.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      const step = Math.min(ghost.speed, dist);
      ghost.x += (dx / dist) * step;
      ghost.y += (dy / dist) * step;
      ghost.dir = { dx: dx / dist, dy: dy / dist };
    }
  }
}

  static reachedTarget(ghost: GhostState) {
    if (ghost.targetX == null || ghost.targetY == null) return true;
    const threshold = 0.5;
    return (
      Math.abs(ghost.x - ghost.targetX) < threshold &&
      Math.abs(ghost.y - ghost.targetY) < threshold
    );
  }
}
