/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PlayerState } from '../state/player-state';
import { GhostState } from '../state/ghost-state';
import { Direction } from '../types/direction.type';
import {
  TILE_SIZE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  GHOST_SIZE,
  MAP_DESIGN,
  PLAYER_COLORS,
} from '../map/map.data';
import { parseMap } from '../map/map.service';
import { GhostService } from './ghost/ghost.service';

interface Dot {
  x: number;
  y: number;
  eaten: boolean;
}

@Injectable()
export class GameEngineService {
  // ========================= WebSocketGateway 호환 =========================
  roomId: string; // gateway에서 roomId 할당
  roomManager: any; // gateway 참조

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  // ========================= 게임 상태 =========================
  private players: Record<string, PlayerState> = {};
  private ghosts: Record<string, GhostState> = {};
  private map: number[][] = [];
  private dots: Dot[] = [];
  private ghostSpawns: { x: number; y: number }[] = [];

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  // 게임 시작 시간 & 제한 시간 추가
  gameStartTime: number = Date.now();
  maxGameDuration = 60000; // 1분 추후 !!시간변경가능!!

  constructor(private readonly ghostService: GhostService) {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;
    this.ghostSpawns = ghostSpawns;

    this.rows = map.length;
    this.cols = map[0].length;
  }

  // ========================= 플레이어 관리 =========================
  getPlayer(id: string) {
    return this.players[id] || null;
  }

  playerCount() {
    return Object.keys(this.players).length;
  }
  private colorIndex = 0;

  private pickColor(): string {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex += 1;
    return color;
  }

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
      alpha: 1, // 정상 플레이어는 불투명
    };
  }

  removePlayer(id: string) {
    delete this.players[id];
  }

  handleInput(id: string, dir: Direction) {
    const p = this.players[id];
    if (!p) return;
    const clamp = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    p.dir = { dx: clamp(dir.dx), dy: clamp(dir.dy) };
  }

  // ========================= Ghost 관리 =========================
  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    if (!this.ghostSpawns.length) return;
    const spawn =
      this.ghostSpawns[Math.floor(Math.random() * this.ghostSpawns.length)];
    const offset = TILE_SIZE / 2;

    this.ghosts[id] = {
      id,
      x: spawn.x * TILE_SIZE + offset,
      y: spawn.y * TILE_SIZE + offset,
      dir: { dx: 0, dy: 0 },
      speed: opts?.speed ?? 5,
      color: opts?.color ?? 'white',
      path: [],
      targetX: undefined,
      targetY: undefined,
    };
  }

  // ========================= 게임 업데이트 =========================
  update() {
    const now = Date.now();

    // 게임오버 상태면:
    if (this.gameOver) {
      for (const ghost of Object.values(this.ghosts)) {
        GhostService.updateGhost(ghost, this.map);
      }
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

    for (const ghost of Object.values(this.ghosts)) {
      GhostService.updateGhost(ghost, this.map);
    }

    this.checkPlayerGhostCollision();

    // 모든 점을 먹으면 게임 종료
    if (this.allDotsEaten()) {
      this.gameOver = true;
      this.gameOverReason = 'all_dots_eaten';
      this.onGameOver();
      return;
    }

    // 1분 타이머
    if (now - this.gameStartTime >= this.maxGameDuration) {
      this.gameOver = true;
      this.gameOverReason = 'time_over';
      this.onGameOver(); // 점수 저장 + 방 삭제 예약
      return;
    }
  }

  private updatePlayer(player: PlayerState) {
    const { dx, dy } = player.dir;
    if (dx === 0 && dy === 0) return;

    const nextX = player.x + dx * PLAYER_SPEED;
    const nextY = player.y + dy * PLAYER_SPEED;

    if (!this.checkCollision(nextX, nextY, PLAYER_SIZE)) {
      player.x = nextX;
      player.y = nextY;
      this.checkDotCollision(player);
    }
  }

  // ========================= 충돌 체크 =========================
  private checkCollision(x: number, y: number, size: number) {
    const minX = x,
      maxX = x + size,
      minY = y,
      maxY = y + size;
    const startTileX = Math.floor(minX / TILE_SIZE);
    const startTileY = Math.floor(minY / TILE_SIZE);
    const endTileX = Math.floor(maxX / TILE_SIZE);
    const endTileY = Math.floor(maxY / TILE_SIZE);

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return true;
        if (this.map[ty][tx] === 1) return true;
      }
    }
    return false;
  }

  private checkDotCollision(player: PlayerState) {
    const px = Math.floor((player.x + PLAYER_SIZE / 2) / TILE_SIZE);
    const py = Math.floor((player.y + PLAYER_SIZE / 2) / TILE_SIZE);

    for (const dot of this.dots) {
      if (!dot.eaten && dot.x === px && dot.y === py) {
        dot.eaten = true;
        player.score += 10;
        break;
      }
    }
  }

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

          console.log(
            `⚡ 플레이어 ${player.nickname} 스턴! 10초간 이동 불가 + 30점 차감`,
          );

          return;
        }
      }
    }
  }

  // ========================= 상태 반환 =========================
  getMapData() {
    return {
      map: this.map,
      dots: this.dots,
      rows: this.rows,
      cols: this.cols,
      tileSize: this.tileSize,
    };
  }

  getState() {
    // 1. 원본 데이터 개수 확인
    const rawCount = Object.keys(this.players).length;

    // ⭐ now 선언 (가장 중요!)
    const now = Date.now();

    // ⭐ remainingTime 계산
    const remainingTime = Math.max(
      0,
      this.maxGameDuration - (now - this.gameStartTime),
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

  resetGame() {
    const { map, dots } = parseMap(MAP_DESIGN);
    this.map = map;
    this.dots = dots;

    const spawnOffset = (TILE_SIZE - PLAYER_SIZE) / 2;
    for (const p of Object.values(this.players)) {
      p.x = 1 * TILE_SIZE + spawnOffset;
      p.y = 1 * TILE_SIZE + spawnOffset;
      p.dir = { dx: 0, dy: 0 };
      p.score = 0;
    }

    const ghostOffset = TILE_SIZE / 2;
    for (const g of Object.values(this.ghosts)) {
      g.x = 14 * TILE_SIZE + ghostOffset;
      g.y = 13 * TILE_SIZE + ghostOffset;
      g.dir = { dx: 0, dy: 0 };
      g.path = [];
      g.targetX = undefined;
      g.targetY = undefined;
    }

    this.gameOver = false;
    this.gameOverPlayerId = null;
    this.gameOverReason = null;
  }

  // 모든 플레이어 점수 가져오기
  getAllPlayerScores(): Array<{
    playerId: string;
    nickname: string;
    score: number;
  }> {
    return Object.values(this.players).map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
    }));
  }

  onGameOver() {
    console.log('💀 게임오버 발생! MODE =', process.env.MODE);

    // 👇 게임 종료 시 점수 저장
    const finalScores = this.getAllPlayerScores();
    console.log('🏆 최종 점수:', finalScores);

    // ⭐⭐ 클라이언트로 GAME OVER 이벤트 전송 ⭐⭐
    if (this.roomManager?.server) {
      this.roomManager.server.to(this.roomId).emit('game-over', {
        players: finalScores,
        reason: this.gameOverReason ?? 'unknown',
      });
      console.log('📢 game-over 이벤트 전송 완료!');
    } else {
      console.error(
        '❌ roomManager.server가 없어 game-over 이벤트를 보낼 수 없음',
      );
    }

    // 이후 기존 로직 그대로 유지
    if (process.env.MODE === 'DEV') {
      setTimeout(() => {
        console.log('🔄 DEV 모드 → 게임 자동 리셋 실행');
        this.resetGame();
      }, 5000);
    } else {
      setTimeout(() => {
        console.log('🔥 PROD 모드 → 방 삭제 실행:', this.roomId);

        if (this.roomManager && this.roomId) {
          this.roomManager.removeRoom(this.roomId);
        } else {
          console.error('❌ roomManager 또는 roomId가 없음!');
        }
      }, 5000);
    }
  }
  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.intervalRunning = false;
      console.log(`Room ${this.roomId} interval stopped`);
    }
  }
}
