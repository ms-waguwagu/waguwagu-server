// ===== A* Pathfinding =====

// 좌표를 나타내는 Point 타입
export interface Point {
  x: number;
  y: number;
}

// 휴리스틱 함수 (Manhattan distance 사용)
// a와 b 두 좌표 간의 "직선이 아닌 격자 거리"를 계산
export function heuristic(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// A* 알고리즘 구현
// start: 시작 좌표, goal: 목표 좌표, grid: 0 = 길, 1 = 벽
export function aStar(start: Point, goal: Point, grid: number[][]): Point[] | null {
  const openSet: Point[] = []; // 탐색 후보 노드
  const cameFrom = new Map<string, Point>(); // 경로 추적용
  const gScore = new Map<string, number>(); // 시작점에서 해당 노드까지의 비용
  const fScore = new Map<string, number>(); // gScore + 휴리스틱(목표까지 예상 비용)

  const key = (p: Point) => `${p.x},${p.y}`;

  // 시작점 초기화
  openSet.push(start);
  gScore.set(key(start), 0); // 시작점 비용 0
  fScore.set(key(start), heuristic(start, goal)); // fScore = gScore + h

  while (openSet.length > 0) {
    // openSet에서 fScore가 가장 낮은 노드를 선택
    openSet.sort((a, b) => {
      return (
        (fScore.get(key(a)) ?? Infinity) - (fScore.get(key(b)) ?? Infinity)
      );
    });

    const current = openSet.shift(); // 현재 탐색 노드
    if (!current) break; // 안전장치: undefined 방어

    // 목표 도착 시 경로 복원
    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [];
      let temp: Point = current;

      // cameFrom을 따라 시작점까지 거꾸로 추적
      while (cameFrom.has(key(temp))) {
        path.push(temp);
        temp = cameFrom.get(key(temp))!;
      }

      path.reverse(); // 경로를 시작->목표 순으로 뒤집기
      return path;
    }

    // 현재 노드의 상하좌우 이웃 좌표
    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y }, // 오른쪽
      { x: current.x - 1, y: current.y }, // 왼쪽
      { x: current.x, y: current.y + 1 }, // 아래
      { x: current.x, y: current.y - 1 }, // 위
    ];

    for (const n of neighbors) {
      // 격자 범위 밖이거나 벽이면 스킵
      if (grid[n.y]?.[n.x] === 1) continue;

      // 현재 노드에서 이웃 노드까지 비용 (모든 이동 비용 = 1)
      const tentativeG = (gScore.get(key(current)) ?? Infinity) + 1;

      // gScore가 없거나, 더 작은 비용으로 도달 가능하면 갱신
      if (!gScore.has(key(n)) || tentativeG < gScore.get(key(n))!) {
        cameFrom.set(key(n), current); // 경로 추적
        gScore.set(key(n), tentativeG); // 실제 비용 갱신
        fScore.set(key(n), tentativeG + heuristic(n, goal)); // 총 예상 비용 갱신

        // openSet에 아직 없는 노드라면 추가
        if (!openSet.find((p) => p.x === n.x && p.y === n.y)) {
          openSet.push(n);
        }
      }
    }
  }
  return null;
}

// ===== BFS Pathfinding =====

export function bfsPath(start: Point, goal: Point, grid: number[][]): Point[] | null {
  const queue: Point[] = [start];
  const cameFrom = new Map<string, Point>();
  const visited = new Set<string>();
  const key = (p: Point) => `${p.x},${p.y}`;

  visited.add(key(start));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) {
      // 경로 복원
      const path: Point[] = [];
      let temp: Point = current;
      while (cameFrom.has(key(temp))) {
        path.push(temp);
        temp = cameFrom.get(key(temp))!;
      }
      path.reverse();
      return path;
    }

    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const n of neighbors) {
      if (
        n.x < 0 ||
        n.y < 0 ||
        n.y >= grid.length ||
        n.x >= grid[0].length ||
        grid[n.y][n.x] === 1 ||
        visited.has(key(n))
      )
        continue;

      queue.push(n);
      visited.add(key(n));
      cameFrom.set(key(n), current);
    }
  }

  return null; // 경로 없음
}
