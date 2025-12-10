import { aStar, bfsPath, Point } from '../pathfinding/pathfinding';
import { PlayerState } from '../state/player-state';
import { GhostState } from '../state/ghost-state';
import { TILE_SIZE } from '../map/map.data';

export class GhostService {
  constructor(private map: number[][]) {}

  updateGhosts(ghosts: Record<string, GhostState>, players: PlayerState[]) {
    const ghostList = Object.values(ghosts);

    // ⭐ 플레이어가 아예 없는 경우 — 유령은 랜덤 이동
    if (!players || players.length === 0) {
      ghostList.forEach((g: GhostState) => {
        g.x += (Math.random() < 0.5 ? -1 : 1) * g.speed;
        g.y += (Math.random() < 0.5 ? -1 : 1) * g.speed;
      });
      return;
    }

    // ⭐ 스턴된 플레이어 제외한 유효 플레이어 목록
    const alivePlayers = players.filter((p) => !p.stunned);

    const targetList = alivePlayers.length > 0 ? alivePlayers : players;

    // ⭐ 가장 가까운 플레이어 찾기
    const targetPlayer = this.getClosestPlayer(ghosts, targetList);

    const ghostIds = Object.keys(ghosts);
    if (ghostIds.length === 0) return;

    ghostIds.forEach((id, index) => {
      const ghost = ghosts[id];
      const gx = Math.floor(ghost.x / TILE_SIZE);
      const gy = Math.floor(ghost.y / TILE_SIZE);

      if (index === 0) {
        // ⭐ 1번 유령은 가장 가까운 플레이어 추적
        const px = Math.floor(targetPlayer.x / TILE_SIZE);
        const py = Math.floor(targetPlayer.y / TILE_SIZE);

        const path = aStar({ x: gx, y: gy }, { x: px, y: py }, this.map);

        if (path && path.length > 0) {
          const next = path[0];
          ghost.x += (next.x - gx) * ghost.speed;
          ghost.y += (next.y - gy) * ghost.speed;
        } else {
          // ⭐ 길이 막히면 랜덤 이동
          ghost.x += (Math.random() < 0.5 ? -1 : 1) * ghost.speed;
          ghost.y += (Math.random() < 0.5 ? -1 : 1) * ghost.speed;
        }
      } else {
        // ⭐ 나머지 유령은 랜덤 BFS로 배회
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

  getClosestPlayer(ghosts: Record<string, GhostState>, players: PlayerState[]) {
    let closest = players[0];
    let minDist = Infinity;

    const ghost = Object.values(ghosts)[0];
    const gx = ghost.x;
    const gy = ghost.y;

    for (const p of players) {
      const d = Math.hypot(gx - p.x, gy - p.y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }

    return closest;
  }

  getRandomBfsTarget(start: Point, minDist: number, maxDist: number): Point {
    const queue: { p: Point; dist: number }[] = [{ p: start, dist: 0 }];
    const visited = new Set<string>();

    const key = (p: Point) => `${p.x},${p.y}`;
    visited.add(key(start));

    const candidates: Point[] = [];

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
        if (this.map[n.y]?.[n.x] === 1) continue;
        if (visited.has(key(n))) continue;

        visited.add(key(n));
        queue.push({ p: n, dist: dist + 1 });
      }
    }

    if (candidates.length === 0) return start;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
