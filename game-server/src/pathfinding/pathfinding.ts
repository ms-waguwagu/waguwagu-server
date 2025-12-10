import { Direction } from '../types/direction.type';
import { shuffle } from '../engine/utils.service';

export interface Tile {
  x: number;
  y: number;
}

export function getPathBFS(
  map: number[][],
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): Tile[] {
  const queue: Array<{ x: number; y: number; path: Tile[] }> = [];
  const visited = new Set<string>();
  queue.push({ x: startX, y: startY, path: [] });
  visited.add(`${startX},${startY}`);

  while (queue.length) {
    const { x, y, path } = queue.shift()!;
    if (x === targetX && y === targetY) return path;

    let dirs: Direction[] = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    dirs = shuffle(dirs);

    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx < 0 || nx >= map[0].length || ny < 0 || ny >= map.length) continue;
      if (map[ny][nx] === 1) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
    }
  }
  return [];
}

export function findRandomTarget(map: number[][], startX: number, startY: number, maxDepth = 10): Tile | null {
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; depth: number }> = [];
  const candidates: Tile[] = [];

  queue.push({ x: startX, y: startY, depth: 0 });
  visited.add(`${startX},${startY}`);

  while (queue.length) {
    const { x, y, depth } = queue.shift()!;
    if (depth > 0) candidates.push({ x, y });
    if (depth >= maxDepth) continue;

    let dirs: Direction[] = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    dirs = shuffle(dirs);

    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx < 0 || nx >= map[0].length || ny < 0 || ny >= map.length) continue;
      if (map[ny][nx] === 1) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, depth: depth + 1 });
    }
  }

  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
