import { Injectable } from '@nestjs/common';

type Direction = { dx: number; dy: number };

interface PlayerState {
  id: string;
  x: number; // 픽셀 좌표
  y: number; // 픽셀 좌표
  dir: Direction; // 현재 이동 방향 (-1,0,1)
  color: string;
  score: number;
  nickname: string;
}

interface Dot {
  x: number; // 타일 좌표
  y: number; // 타일 좌표
  eaten: boolean;
}

interface GhostState {
  id: string;
  x: number; // 픽셀 좌표
  y: number; // 픽셀 좌표
  dir: Direction;
  speed: number;
  color: string;
}

const TILE_SIZE = 28;
const PLAYER_SIZE = 18;
const PLAYER_SPEED = 4;

const MAP_DESIGN: string[] = [
  '###############################', // 0
  '#.............................#', // 1
  '#.###.#####.###.###.#####.###.#', // 2
  '#.###.#...#.#.....#.#...#.###.#', // 3
  '#.###.###.#.#######.#.###.###.#', // 4
  '#.............................#', // 5
  '#.#####.#.###########.#.#####.#', // 6
  '#.#.....#.....###.....#.....#.#', // 7
  '#.#.###.#.###.###.###.#.###.#.#', // 8
  '#.#.#.#.#...#.....#...#.#.#.#.#', // 9
  '#.#.#.#.###.#######.###.#.#.#.#', // 10
  '#.#.#.....................#.#.#', // 11
  '#.#.#.###.###GGGGG###.###.#.#.#', // 12
  '#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#', // 13
  '#...#.#.#.#GGG.G.GGG#.#.#.#...#', // 14
  '###.#.#.#.#GGG.G.GGG#.#.#.#.###', // 15
  '#...#.#.#.#GGG.G.GGG#.#.#.#...#', // 16
  '#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#', // 17
  '#.#.#.###.###GGGGG###.###.#.#.#', // 18
  '#.#.#.....................#.#.#', // 19
  '#.#.#.###.###########.###.#.#.#', // 20
  '#.#.#.#.#...#.....#...#.#.#.#.#', // 21
  '#.#.###.#.###.#.#.###.#.###.#.#', // 22
  '#.#.....#.....#.#.....#.....#.#', // 23
  '#.#####.#.###########.#.#####.#', // 24
  '#.............................#', // 25
  '#.###.###.#.#######.#.###.###.#', // 26
  '#.#.#.#...#.#.....#.#...#.#.#.#', // 27
  '#.###.#####.###.###.#####.###.#', // 28
  '###############################', // 29
];

const PLAYER_COLORS = ['yellow', 'cyan', 'magenta', 'orange', 'lime'];

function parseMap(design: string[]): {
  map: number[][];
  dots: Dot[];
  ghostSpawns: { x: number; y: number }[];
} {
  const map: number[][] = [];
  const dots: Dot[] = [];
  const ghostSpawns: { x: number; y: number }[] = [];

  for (let row = 0; row < design.length; row++) {
    const rowArr: number[] = [];
    const line = design[row];

    for (let col = 0; col < line.length; col++) {
      const ch = line[col];

      if (ch === '#') {
        rowArr.push(1); // 벽
      } else {
        rowArr.push(0); // 길

        if (ch === 'G') {
          ghostSpawns.push({ x: col, y: row }); // 유령 스폰 타일 저장
        } else {
          dots.push({ x: col, y: row, eaten: false });
        }
      }
    }
    map.push(rowArr);
  }

  return { map, dots, ghostSpawns };
}

@Injectable()
export class GameEngineService {
  private players: Record<string, PlayerState> = {};
  private ghosts: Record<string, GhostState> = {};
  private map: number[][];
  private dots: Dot[];
  private ghostSpawns: { x: number; y: number }[] = [];

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  // 게임 상태 표시 (간단히 플래그로 노출)
  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  constructor() {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;
    this.ghostSpawns = ghostSpawns;

    this.rows = map.length;
    this.cols = map[0].length;
  }

	// 클라이언트 초기화를 위한 맵 데이터 반환
	getMapData() {
    return {
      map: this.map,  
			dots: this.dots,         
      rows: this.rows,
      cols: this.cols,
      tileSize: this.tileSize, 
    };
  }

  // 플레이어 수 반환
  playerCount() {
    return Object.keys(this.players).length;
  }

  // interval 정지
  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.intervalRunning = false;
      // console.log('⛔ Room interval stopped');
    }
  }

  // ===== 플레이어 관리 =====

  addPlayer(id: string, nickname: string) {
    // 간단히 왼쪽 위 근처 스폰
    const spawnCol = 1;
    const spawnRow = 1;

    const color = this.pickColor();

    this.players[id] = {
      id,
      nickname,
      x: spawnCol * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
      y: spawnRow * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
      dir: { dx: 0, dy: 0 },
      color,
      score: 0,
    };
  }

  removePlayer(id: string) {
    delete this.players[id];
  }

  private pickColor(): string {
    const currentCount = Object.keys(this.players).length;
    return PLAYER_COLORS[currentCount % PLAYER_COLORS.length];
  }

  // ===== 유령 관리 =====

  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    if (this.ghostSpawns.length === 0) {
      console.warn('⚠ G 스폰 타일이 없습니다! 유령 생성 실패');
      return;
    }

    const spawn =
      this.ghostSpawns[Math.floor(Math.random() * this.ghostSpawns.length)];

    this.ghosts[id] = {
      id,
      x: spawn.x * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
      y: spawn.y * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
      dir: this.randomDir(),
      speed: opts?.speed ?? 2,
      color: opts?.color ?? 'white',
    };
  }

  private randomDir(): Direction {
    const dirs: Direction[] = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  // ===== 입력 처리 =====

  handleInput(id: string, dir: Direction) {
    const p = this.players[id];
    if (!p) return;

    // -1,0,1 범위만 허용
    const clamp = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

    p.dir = {
      dx: clamp(dir.dx),
      dy: clamp(dir.dy),
    };
  }

  // ===== 매 틱마다 호출 (Gateway setInterval 에서 호출) =====

  update() {
    if (this.gameOver) return; // 게임오버면 업데이트 중지

    for (const player of Object.values(this.players)) {
      this.updatePlayer(player);
    }

    for (const ghost of Object.values(this.ghosts)) {
      this.updateGhost(ghost);
    }

    this.checkPlayerGhostCollision();
  }

  private updatePlayer(player: PlayerState) {
    const { dx, dy } = player.dir;
    if (dx === 0 && dy === 0) return; // 가만히 있음

    const nextX = player.x + dx * PLAYER_SPEED;
    const nextY = player.y + dy * PLAYER_SPEED;

    if (!this.checkCollision(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
      this.checkDotCollision(player);
    }
  }

  private updateGhost(ghost: GhostState) {
    // 단순 랜덤 워크-ish: 현재 방향 유지, 벽 만나면 방향 변경
    const nextX = ghost.x + ghost.dir.dx * ghost.speed;
    const nextY = ghost.y + ghost.dir.dy * ghost.speed;

    if (this.checkCollision(nextX, nextY)) {
      // 방향 변경 시, 가능한 방향(벽이 아닌) 중 선택
      const possible = this.getAvailableDirections(ghost);
      if (possible.length > 0) {
        ghost.dir = possible[Math.floor(Math.random() * possible.length)];
      } else {
        // 완전 막혔으면 랜덤 방향으로
        ghost.dir = this.randomDir();
      }
      return;
    }

    // 약간의 랜덤 방향 변경 (좀 더 자연스럽게)
    if (Math.random() < 0.01) {
      ghost.dir = this.randomDir();
    }

    ghost.x = nextX;
    ghost.y = nextY;
  }

  private getAvailableDirections(ghost: GhostState): Direction[] {
    const dirs: Direction[] = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const available: Direction[] = [];

    for (const d of dirs) {
      const nx = ghost.x + d.dx * TILE_SIZE; // 한 타일만 테스트
      const ny = ghost.y + d.dy * TILE_SIZE;
      if (!this.checkCollision(nx, ny)) {
        available.push(d);
      }
    }

    return available;
  }

  // ===== 충돌 판정 =====

  private checkCollision(x: number, y: number): boolean {
    const size = PLAYER_SIZE;

    // 플레이어 네 꼭짓점
    const points = [
      { x, y },
      { x: x + size, y },
      { x, y: y + size },
      { x: x + size, y: y + size },
    ];

    for (const p of points) {
      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);

      if (
        row < 0 ||
        row >= this.rows ||
        col < 0 ||
        col >= this.cols ||
        this.map[row][col] === 1
      ) {
        return true; // 벽 또는 맵 밖
      }
    }
    return false;
  }

  // ===== dot 먹기 & 점수 =====

  private checkDotCollision(player: PlayerState) {
    const px = Math.floor(player.x / TILE_SIZE);
    const py = Math.floor(player.y / TILE_SIZE);

    for (const dot of this.dots) {
      if (dot.eaten) continue;
      if (dot.x === px && dot.y === py) {
        dot.eaten = true;
        player.score += 10;
        break;
      }
    }
  }

  // 플레이어-유령 충돌 검사
  private checkPlayerGhostCollision() {
    for (const player of Object.values(this.players)) {
      for (const ghost of Object.values(this.ghosts)) {
        // 충돌 기준: 중심 간 거리 < threshold
        const pxCenter = player.x + PLAYER_SIZE / 2;
        const pyCenter = player.y + PLAYER_SIZE / 2;
        const gxCenter = ghost.x + PLAYER_SIZE / 2;
        const gyCenter = ghost.y + PLAYER_SIZE / 2;

        const dist = Math.hypot(pxCenter - gxCenter, pyCenter - gyCenter);
        const threshold = (PLAYER_SIZE + PLAYER_SIZE) / 2; // 유연한 기준

        if (dist < threshold) {
          // 게임오버 상태 설정
          this.gameOver = true;
          this.gameOverPlayerId = player.id;
          this.gameOverReason = `caught_by_ghost:${ghost.id}`;
          // 로그 남김
          // console.log('💀 플레이어가 유령에게 잡혔다!', player.id, ghost.id);
          return;
        }
      }
    }
  }

  // ===== 상태 반환 (Gateway → 클라이언트 브로드캐스트) =====

  getState() {

		// 1. 원본 데이터 개수 확인
    const rawCount = Object.keys(this.players).length;

    // 2. 만약 0명이면 로그 출력
    if (rawCount === 0) {
      console.error("🚨 비상! getState()를 호출할 때 플레이어가 없음!");
      console.trace(); // 누가 이 함수를 불렀는지 추적 (Call Stack 출력)
    }

    // 3. 직렬화 (JSON 변환) 수행
    const serializedPlayers = JSON.parse(JSON.stringify(this.players));
    const serializedDots = JSON.parse(JSON.stringify(this.dots));
    
    // ❗️ 정리 필요 ❗️
    return {
      players: serializedPlayers,
      dots: serializedDots,
      ghosts: JSON.parse(JSON.stringify(this.ghosts)),
      gameOver: this.gameOver,
      gameOverPlayerId: this.gameOverPlayerId,
      gameOverReason: this.gameOverReason,

    };
  }

  // 모든 dot이 먹혔는지 (나중에 게임 종료 처리에 사용)
  allDotsEaten(): boolean {
    return this.dots.every((d) => d.eaten);
  }

  // 게임 리셋 (원하면 사용)
  resetGame() {
    const { map, dots } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;

    // 기존 플레이어는 유지하되 위치/점수만 초기화
    for (const p of Object.values(this.players)) {
      const spawnCol = 1;
      const spawnRow = 1;

      p.x = spawnCol * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
      p.y = spawnRow * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
      p.dir = { dx: 0, dy: 0 };
      p.score = 0;
    }

    // 유령 초기화: 재배치 또는 삭제
    for (const g of Object.values(this.ghosts)) {
      const spawnCol = 14;
      const spawnRow = 13;
      g.x = spawnCol * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
      g.y = spawnRow * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
      g.dir = this.randomDir();
    }

    this.gameOver = false;
    this.gameOverPlayerId = null;
    this.gameOverReason = null;
  }
}
