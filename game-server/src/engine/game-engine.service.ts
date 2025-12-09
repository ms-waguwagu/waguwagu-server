/* eslint-disable prettier/prettier */
// backend/src/game/engine/game-engine.service.ts
import { Injectable } from '@nestjs/common';

type Direction = { dx: number; dy: number };

interface PlayerState {
  id: string;
  x: number;      // 픽셀 좌표
  y: number;      // 픽셀 좌표
  dir: Direction; // 현재 이동 방향 (-1,0,1)
  color: string;
  score: number;
  nickname: string;
}

interface Dot {
  x: number;      // 타일 좌표
  y: number;      // 타일 좌표
  eaten: boolean;
}

// ===== 맵 / 상수 =====
const TILE_SIZE = 28;
const PLAYER_SIZE = 18;
const PLAYER_SPEED = 4;

// 프론트 map.js랑 동일한 디자인 (문자열)
const MAP_DESIGN: string[] = [
  "###############################", // 0
  "#.............................#", // 1
  "#.###.#####.###.###.#####.###.#", // 2
  "#.###.#...#.#.....#.#...#.###.#", // 3
  "#.###.###.#.#######.#.###.###.#", // 4
  "#.............................#", // 5
  "#.#####.#.###########.#.#####.#", // 6
  "#.#.....#.....###.....#.....#.#", // 7
  "#.#.###.#.###.###.###.#.###.#.#", // 8
  "#.#.#.#.#...#.....#...#.#.#.#.#", // 9
  "#.#.#.#.###.#######.###.#.#.#.#", // 10
  "#.#.#.....................#.#.#", // 11
  "#.#.#.###.###GGGGG###.###.#.#.#", // 12
  "#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#", // 13
  "#...#.#.#.#GGG.G.GGG#.#.#.#...#", // 14
  "###.#.#.#.#GGG.G.GGG#.#.#.#.###", // 15
  "#...#.#.#.#GGG.G.GGG#.#.#.#...#", // 16
  "#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#", // 17
  "#.#.#.###.###GGGGG###.###.#.#.#", // 18
  "#.#.#.....................#.#.#", // 19
  "#.#.#.###.###########.###.#.#.#", // 20
  "#.#.#.#.#...#.....#...#.#.#.#.#", // 21
  "#.#.###.#.###.#.#.###.#.###.#.#", // 22
  "#.#.....#.....#.#.....#.....#.#", // 23
  "#.#####.#.###########.#.#####.#", // 24
  "#.............................#", // 25
  "#.###.###.#.#######.#.###.###.#", // 26
  "#.#.#.#...#.#.....#.#...#.#.#.#", // 27
  "#.###.#####.###.###.#####.###.#", // 28
  "###############################", // 29
];

const PLAYER_COLORS = ['yellow', 'cyan', 'magenta', 'orange', 'lime'];

// 문자맵 → 숫자맵 + dot 정보 생성
function parseMap(design: string[]): { map: number[][]; dots: Dot[] } {
  const map: number[][] = [];
  const dots: Dot[] = [];

  for (let row = 0; row < design.length; row++) {
    const rowArr: number[] = [];
    const line = design[row];

    for (let col = 0; col < line.length; col++) {
      const ch = line[col];

      if (ch === '#') {
        rowArr.push(1); // 벽
      } else {
        rowArr.push(0); // 길

        // G(유령 집) 부분에는 dot 안 생성
        if (ch !== 'G') {
          dots.push({ x: col, y: row, eaten: false });
        }
      }
    }
    map.push(rowArr);
  }

  return { map, dots };
}

@Injectable()
export class GameEngineService {
  private players: Record<string, PlayerState> = {};
  private map: number[][];
  private dots: Dot[];

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  intervalRunning = false;

  constructor() {
    const { map, dots } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;

    this.rows = map.length;
    this.cols = map[0].length;
  }

  // ===== 플레이어 관리 =====

  addPlayer(id: string, nickname: string) {
    // 간단히 왼쪽 위 근처 스폰 (나중에 SPAWN_POINTS 같은 구조로 변경 가능)
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

  // ===== 입력 처리 =====

  // 클라이언트에서 온 방향 입력 저장
  handleInput(id: string, dir: Direction) {
    const p = this.players[id];
    if (!p) return;

    // -1,0,1 범위만 허용 (이상한 값 들어오면 방어)
    const clamp = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

    p.dir = {
      dx: clamp(dir.dx),
      dy: clamp(dir.dy),
    };
  }

  // ===== 매 틱마다 호출 (Gateway setInterval 에서 호출) =====

  update() {
    for (const player of Object.values(this.players)) {
      this.updatePlayer(player);
    }
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

  // ===== 상태 반환 (Gateway → 클라이언트 브로드캐스트) =====

  getState() {
  return {
    players: JSON.parse(JSON.stringify(this.players)),
    dots: JSON.parse(JSON.stringify(this.dots)),
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
  }
}