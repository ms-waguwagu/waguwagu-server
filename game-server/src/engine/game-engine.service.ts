/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { GhostService } from './ghost.service';
import { PlayerState } from '../state/player-state';
import { GhostState } from '../state/ghost-state';

export type Direction = { dx: number; dy: number };

interface Dot {
  x: number; // 타일 좌표
  y: number; // 타일 좌표
  eaten: boolean;
}

const TILE_SIZE = 28;
const PLAYER_SIZE = 18;
const PLAYER_SPEED = 4;

const MAP_DESIGN: string[] = [
  '###############################', // 0
  '#.............................#', // 1
  '#.#.###.###.###.###.###.###.#.#', // 2
  '#.#.#...#.....#.#.....#...#.#.#', // 3
  '#.#...#...###.....###...#...#.#', // 4
  '#.#.###.#.....#.#.....#.###.#.#', // 5
  '#.......######...######.......#', // 6
  '#.#.###........#........###.#.#', // 7
  '#.#...#.######.#.######.#...#.#', // 8
  '#.#.#.#....#.......#....#.#.#.#', // 9
  '#.#...#.##.#.#####.#.##.#...#.#', // 10
  '#...###.#.............#.###...#', // 11
  '#.#.....#.###GGGGG###.#.....#.#', // 12
  '#.#.###.#.#GGG.G.GGG#.#.###.#.#', // 13
  '#...#...#.#GGG.G.GGG#.#...#...#', // 14
  '###.#.#...#GGG.G.GGG#...#.#.###', // 15
  '#...#...#.#GGG.G.GGG#.#...#...#', // 16
  '#.#.###.#.#GGG.G.GGG#.#.###.#.#', // 17
  '#.#.....#.###GGGGG###.#.....#.#', // 18
  '#...###.#.............#.###...#', // 19
  '#.#...#.##.#.#####.#.##.#...#.#', // 20
  '#.#.#.#....#.......#....#.#.#.#', // 21
  '#.#...#.######.#.######.#...#.#', // 22
  '#.#.###........#........###.#.#', // 23
  '#.......######...######.......#', // 24
  '#.#.###.#.....#.#.....#.###.#.#', // 25
  '#.#.#.....###.....###.....#.#.#', // 26
  '#.#...#.#.....#.#.....#.#...#.#', // 27
  '#.#.###.###.###.###.###.###.#.#', // 28
  '#.............................#', // 29
  '###############################', // 30
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
  roomId: string; // ⭐ 방 ID
  roomManager: any; // ⭐ 방 관리자 참조
  private ghostService: GhostService;

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

  // 플레이어 정보 반환 (추가)
  getPlayer(id: string): PlayerState | null {
    return this.players[id] || null;
  }

  // 게임 상태 표시 (간단히 플래그로 노출)
  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  // 게임 시작 시간 & 제한 시간 추가
  gameStartTime: number = Date.now();
  maxGameDuration = 60000; // 1분 추후 !!시간변경가능!!

  constructor() {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots; // 맵 전체에 도트 배치
    // this.dots = [{ x: 10, y: 10, eaten: false }]; 테스트 시 하나만 생성
    this.ghostSpawns = ghostSpawns;

    this.ghostService = new GhostService(this.map);
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

    // ⭐ 추가된 스턴 관련 필드들
    stunned: false,
    stunEndTime: 0,
    alpha: 1,   // 정상 플레이어는 불투명
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

    const now = Date.now();

    // 게임오버 상태면:
    if (this.gameOver) {
      
      // 유령은 계속 움직여야 함!!!
      this.ghostService.updateGhosts(this.ghosts, Object.values(this.players));
      return; // 플레이어 업데이트는 하지 않음
    }
    

    // 평상시 로직 ------------------
    for (const player of Object.values(this.players)) {
      if (player.stunned) {
        if (now >= player.stunEndTime) {
          player.stunned = false;
          player.alpha = 1;
        }
        continue;
      }

      this.updatePlayer(player);
    }

    this.ghostService.updateGhosts(this.ghosts, Object.values(this.players));
    this.checkPlayerGhostCollision();

    // 모든 점을 먹으면 게임 종료
    if (this.allDotsEaten()) {
      this.gameOver = true;
      this.gameOverReason = "all_dots_eaten";
      this.onGameOver();
      return;
    }
    
    // 1분 타이머
    if (now - this.gameStartTime >= this.maxGameDuration) {
      this.gameOver = true;
      this.gameOverReason = "time_over";
      this.onGameOver(); // 점수 저장 + 방 삭제 예약
      return;
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

    // ⬇ 스턴 상태이면 충돌 검사 스킵
    if (player.stunned) continue;

    for (const ghost of Object.values(this.ghosts)) {

      const pxCenter = player.x + PLAYER_SIZE / 2;
      const pyCenter = player.y + PLAYER_SIZE / 2;
      const gxCenter = ghost.x + PLAYER_SIZE / 2;
      const gyCenter = ghost.y + PLAYER_SIZE / 2;

      const dist = Math.hypot(pxCenter - gxCenter, pyCenter - gyCenter);
      const threshold = (PLAYER_SIZE + PLAYER_SIZE) / 2;

      if (dist < threshold) {

        // ⭐ 게임오버 제거하고 스턴만 적용
        player.stunned = true;
        player.stunEndTime = Date.now() + 10000; // 10초
        player.alpha = 0.4;
        player.score = Math.max(0, player.score - 30);

        console.log(`⚡ 플레이어 ${player.nickname} 스턴! 10초간 이동 불가 + 30점 차감`);

        return;
      }
    }
  }
}


  // ===== 상태 반환 (Gateway → 클라이언트 브로드캐스트) =====

 getState() {
  // 1. 원본 데이터 개수 확인
  const rawCount = Object.keys(this.players).length;

  // ⭐ now 선언 (가장 중요!)
  const now = Date.now();

  // ⭐ remainingTime 계산
  const remainingTime = Math.max(
    0,
    this.maxGameDuration - (now - this.gameStartTime)
  );

  // 2. 만약 0명이면 로그 출력
  if (rawCount === 0) {
    console.error('🚨 비상! getState()를 호출할 때 플레이어가 없음!');
    console.trace(); // 누가 이 함수를 불렀는지 추적 (Call Stack 출력)
  }

  // 3. 직렬화 (JSON 변환) 수행
  const serializedPlayers = JSON.parse(JSON.stringify(this.players));
  const serializedDots = JSON.parse(JSON.stringify(this.dots));
  const serializedGhosts = JSON.parse(JSON.stringify(this.ghosts));

  // 4. 최종 반환
  return {
    players: serializedPlayers,
    dots: serializedDots,
    ghosts: serializedGhosts,
    gameOver: this.gameOver,
    gameOverPlayerId: this.gameOverPlayerId,
    gameOverReason: this.gameOverReason,

    // ⭐ 프론트에 실시간 타이머 전달
    remainingTime,
  };
}

  // ===== 게임 리셋 및 종료 처리 =====
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

  // 모든 플레이어 점수 가져오기
  getAllPlayerScores(): Array<{ playerId: string; nickname: string; score: number }> {
    return Object.values(this.players).map(p => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
    }));
  }

  onGameOver() {
    console.log("💀 게임오버 발생! MODE =", process.env.MODE);

    // 👇 게임 종료 시 점수 저장
    const finalScores = this.getAllPlayerScores();
    console.log('🏆 최종 점수:', finalScores);

    // ⭐⭐ 클라이언트로 GAME OVER 이벤트 전송 ⭐⭐
    if (this.roomManager?.server) {
      this.roomManager.server.to(this.roomId).emit("game-over", {
        players: finalScores,
        reason: this.gameOverReason ?? "unknown",
      });
      console.log("📢 game-over 이벤트 전송 완료!");
    } else {
      console.error("❌ roomManager.server가 없어 game-over 이벤트를 보낼 수 없음");
    }

    // 이후 기존 로직 그대로 유지
    if (process.env.MODE === "DEV") {
      setTimeout(() => {
        console.log("🔄 DEV 모드 → 게임 자동 리셋 실행");
        this.resetGame();
      }, 5000);

    } else {
      setTimeout(() => {
        console.log("🔥 PROD 모드 → 방 삭제 실행:", this.roomId);

        if (this.roomManager && this.roomId) {
          this.roomManager.removeRoom(this.roomId);
        } else {
          console.error("❌ roomManager 또는 roomId가 없음!");
        }
      }, 5000);
    }
  }
}
