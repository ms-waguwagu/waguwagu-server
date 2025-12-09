// 게임 엔진 (GameCore.js)

import { MAP_DATA, TILE_SIZE, MAP_COLS, MAP_ROWS, generateDots } from "./map.js";

import {
  GHOST_POINTS,
  MAP_DATA,
  TILE_SIZE,
  MAP_ROWS,
  MAP_COLS,
} from "./map.js";

export const CONSTANTS = {
  PLAYER_SPEED: 2,
  GHOST_SPEED: 3,
  GHOST_SIZE: 22,
  PLAYER_SIZE: 18,
  MAP_WIDTH: MAP_COLS * TILE_SIZE,
  MAP_HEIGHT: MAP_ROWS * TILE_SIZE,
};

// ===============================
// DOT 생성 함수
// ===============================
export function generateDots(map) {
  const dots = [];

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (map[row][col] === 0) {
        dots.push({ x: col, y: row, eaten: false });
      }
    }
  }
  return dots;
}

export class GameCore {
  constructor() {
    this.state = {
      players: {},
      ghosts: {},
      map: MAP_DATA,
      gameOver: false,
      dots: generateDots(MAP_DATA), // ← 🔥 DOT 자동 생성
    };

    this.ghostDirections = {};
  }

  // ------------------------------
  // 플레이어 추가
  // ------------------------------
  addPlayer(id, color, gridX, gridY) {
    this.state.players[id] = {
      x: gridX * TILE_SIZE + (TILE_SIZE - CONSTANTS.PLAYER_SIZE) / 2,
      y: gridY * TILE_SIZE + (TILE_SIZE - CONSTANTS.PLAYER_SIZE) / 2,
      color: color,
      score: 0,
    };
  }

  // TODO: 수정 필요!!! 백엔드로 
  // ------------------------------
  // 유령 스폰
  // ------------------------------
  addGhost(id, color) {
    // G 위치 중 랜덤 선택
    const { x: gridX, y: gridY } =
      GHOST_POINTS[Math.floor(Math.random() * GHOST_POINTS.length)];

    this.state.ghosts[id] = {
      x: gridX * TILE_SIZE + (TILE_SIZE - CONSTANTS.GHOST_SIZE) / 2,
      y: gridY * TILE_SIZE + (TILE_SIZE - CONSTANTS.GHOST_SIZE) / 2,
      color: color,
    };

    // 초기 랜덤 방향
    const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    this.ghostDirections[id] = dirs[Math.floor(Math.random() * 4)];
  }

  // ------------------------------
  // DOT 먹기 처리
  // ------------------------------
  checkDotCollision(player) {
    const px = Math.floor(player.x / TILE_SIZE);
    const py = Math.floor(player.y / TILE_SIZE);

    for (const dot of this.state.dots) {
      if (!dot.eaten && dot.x === px && dot.y === py) {
        dot.eaten = true;
        player.score += 10; // 🔥 점수 증가
      }
    }
  }

  // ------------------------------
  // 입력 처리
  // ------------------------------
  processInput(playerId, direction) {
    const player = this.state.players[playerId];
    if (!player || this.state.gameOver) return;

    let nextX = player.x;
    let nextY = player.y;

    if (direction === "ArrowUp") nextY -= CONSTANTS.PLAYER_SPEED;
    if (direction === "ArrowDown") nextY += CONSTANTS.PLAYER_SPEED;
    if (direction === "ArrowLeft") nextX -= CONSTANTS.PLAYER_SPEED;
    if (direction === "ArrowRight") nextX += CONSTANTS.PLAYER_SPEED;

    if (!this.checkCollision(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;

      this.checkDotCollision(player);
      this.checkEndConditions();
    }
  }

  checkCollision(x, y) {
    const size = CONSTANTS.PLAYER_SIZE;

    const points = [
      { x: x, y: y },
      { x: x + size, y: y },
      { x: x, y: y + size },
      { x: x + size, y: y + size },
    ];

    for (const p of points) {
      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);

      if (
        row < 0 ||
        row >= MAP_ROWS ||
        col < 0 ||
        col >= MAP_COLS ||
        MAP_DATA[row][col] === 1
      ) {
        return true;
      }
    }
    return false;
  }

  //TODO: 수정 필요!!!
  checkDotCollision(player) {
    const px = Math.floor(player.x / TILE_SIZE);
    const py = Math.floor(player.y / TILE_SIZE);

    for (const dot of this.state.dots) {
      if (!dot.eaten && dot.x === px && dot.y === py) {
        dot.eaten = true;
        player.score += 10;
      }
    }
  }

  checkEndConditions() {
    const allDotsEaten = this.state.dots.every(dot => dot.eaten);

    if (allDotsEaten) {
      window.dispatchEvent(
        new CustomEvent("game-end", { detail: { reason: "ALL_DOTS" } })
      );
      return true;
    }
    return false;
  // ------------------------------
  // 유령 업데이트 (기존 그대로)
  // ------------------------------
  updateGhosts() {
    for (const id in this.state.ghosts) {
      const ghost = this.state.ghosts[id];

      if (Math.random() < 0.02) {
        const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        this.ghostDirections[id] = dirs[Math.floor(Math.random() * 4)];
      }

      let nextX = ghost.x;
      let nextY = ghost.y;

      switch (this.ghostDirections[id]) {
        case "ArrowUp":
          nextY -= CONSTANTS.GHOST_SPEED;
          break;
        case "ArrowDown":
          nextY += CONSTANTS.GHOST_SPEED;
          break;
        case "ArrowLeft":
          nextX -= CONSTANTS.GHOST_SPEED;
          break;
        case "ArrowRight":
          nextX += CONSTANTS.GHOST_SPEED;
          break;
      }

      if (this.checkCollision(nextX, nextY)) {
        const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        this.ghostDirections[id] = dirs[Math.floor(Math.random() * 4)];
      } else {
        ghost.x = nextX;
        ghost.y = nextY;
      }

      // 플레이어와 충돌 시 게임 종료
      for (const pid in this.state.players) {
        const p = this.state.players[pid];
        const dx = p.x - ghost.x;
        const dy = p.y - ghost.y;
        if (Math.sqrt(dx * dx + dy * dy) < CONSTANTS.PLAYER_SIZE) {
          this.state.gameOver = true;
        }
      }
    }
  }

  getState() {
    return this.state;
  }

  getFinalResults() {
    return Object.entries(this.state.players)
      .map(([id, p]) => ({
        id,
        score: p.score,
        color: p.color,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
