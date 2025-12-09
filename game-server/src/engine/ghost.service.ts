import { aStar, bfsPath, Point } from '../pathfinding/pathfinding';
import { PlayerState } from '../state/player-state';
import { GhostState } from '../state/ghost-state';
import { TILE_SIZE } from '../map/map.data';

export class GhostService {
  constructor(private map: number[][]) {}

  updateGhosts(ghosts: Record<string, GhostState>, players: PlayerState[]) {
    if (players.length === 0) return;
    const player = players[0];

    const ghostIds = Object.keys(ghosts);
    if (ghostIds.length === 0) return;

    ghostIds.forEach((id, index) => {
      const ghost = ghosts[id];
      const gx = Math.floor(ghost.x / TILE_SIZE);
      const gy = Math.floor(ghost.y / TILE_SIZE);

      if (index === 0) {
        // 첫번째 유령: 플레이어 추적
        const px = Math.floor(player.x / TILE_SIZE);
        const py = Math.floor(player.y / TILE_SIZE);
        const target = { x: px, y: py };
        const path = aStar({ x: gx, y: gy }, target, this.map);
        if (path && path.length > 0) {
          const next = path[0];
          ghost.x += (next.x - gx) * ghost.speed;
          ghost.y += (next.y - gy) * ghost.speed;
        }
      } else {
        // 그 외 유령: 랜덤 BFS
        if (!ghost.target || (gx === ghost.target.x && gy === ghost.target.y)) {
          ghost.target = this.getRandomBfsTarget({ x: gx, y: gy }, 5, 10);
        }
        const path = bfsPath({ x: gx, y: gy }, ghost.target, this.map);
        if (path && path.length > 0) {
          const next = path[0];
          ghost.x += (next.x - gx) * ghost.speed;
          ghost.y += (next.y - gy) * ghost.speed;
        }
      }
    });
  }

  getRandomBfsTarget(start: Point, minDist: number, maxDist: number): Point {
    const queue: { p: Point; dist: number }[] = [{ p: start, dist: 0 }];
    const visited = new Set<string>();
    const key = (p: Point) => `${p.x},${p.y}`;
    visited.add(key(start));
    let candidates: Point[] = [];

    while (queue.length > 0) {
      const { p, dist } = queue.shift()!;
      if (dist >= minDist && dist <= maxDist) {
        candidates.push(p);
      }
      if (dist > maxDist) continue;

      const neighbors: Point[] = [
        { x: p.x + 1, y: p.y },
        { x: p.x - 1, y: p.y },
        { x: p.x, y: p.y + 1 },
        { x: p.x, y: p.y - 1 },
      ];

      for (const n of neighbors) {
        if (this.map[n.y]?.[n.x] === 1) continue; // 벽이면 스킵
        if (visited.has(key(n))) continue;
        visited.add(key(n));
        queue.push({ p: n, dist: dist + 1 });
      }
    }

    if (candidates.length === 0) return start;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
