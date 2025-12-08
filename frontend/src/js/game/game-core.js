import { MAP_DATA, TILE_SIZE, MAP_ROWS, MAP_COLS } from "./map.js";

export const CONSTANTS = {
  PLAYER_SPEED: 4,
  GHOST_SPEED: 2, // 유령 속도
  PLAYER_SIZE: 18, // 플레이어 크기는 타일보다 작아야 움직이기 편함
  // MAP 크기는 타일 수 * 타일 크기로 자동 계산
  MAP_WIDTH: MAP_COLS * TILE_SIZE,
  MAP_HEIGHT: MAP_ROWS * TILE_SIZE,
};

export class GameCore {
  constructor() {
    this.state = {
      players: {},
      ghosts: {},
      map: MAP_DATA,
      gameOver: false,
    };
    this.ghostDirections = {};
  }

  // 플레이어 추가
  // gridX, gridY를 직접 넣지 않고, 스폰 인덱스(0~4)를 사용할 수도 있음
  addPlayer(id, color, gridX, gridY) {
    this.state.players[id] = {
      // 중앙 정렬 보정값 수정 (타일 크기 절반 - 플레이어 크기 절반)
      x: gridX * TILE_SIZE + (TILE_SIZE - CONSTANTS.PLAYER_SIZE) / 2,
      y: gridY * TILE_SIZE + (TILE_SIZE - CONSTANTS.PLAYER_SIZE) / 2,
      color: color,
      score: 0,
    };
  }

  // 안전하게 유령 스폰
  addGhost(id, color) {
    const { col: gridX, row: gridY } = this.getRandomFreeTile();
    this.state.ghosts[id] = {
      x: gridX * TILE_SIZE + 10,
      y: gridY * TILE_SIZE + 10,
      color: color,
    };

    // 초기 랜덤 방향
    const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    this.ghostDirections[id] = dirs[Math.floor(Math.random() * 4)];
  }

  // 길(Path, 0) 위 랜덤 타일 선택
  getRandomFreeTile() {
    let row, col;
    do {
      row = Math.floor(Math.random() * MAP_ROWS);
      col = Math.floor(Math.random() * MAP_COLS);
    } while (MAP_DATA[row][col] !== 0);
    return { row, col };
  }

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

    for (const point of points) {
      const col = Math.floor(point.x / TILE_SIZE);
      const row = Math.floor(point.y / TILE_SIZE);
      if (
        row < 0 ||
        row >= MAP_ROWS ||
        col < 0 ||
        col >= MAP_COLS ||
        MAP_DATA[row][col] === 1
      )
        return true;
    }
    return false;
  }

  updateGhosts() {
    for (const id in this.state.ghosts) {
      const ghost = this.state.ghosts[id];

      // 랜덤 방향 변경 확률
      if (Math.random() < 0.02) {
        // 2% 확률로 방향 바꿈
        const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        this.ghostDirections[id] = dirs[Math.floor(Math.random() * 4)];
      }

      let dir = this.ghostDirections[id];
      let nextX = ghost.x;
      let nextY = ghost.y;

      switch (dir) {
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

      // 벽 충돌 시 무작위 다른 방향
      if (this.checkCollision(nextX, nextY)) {
        const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        this.ghostDirections[id] = dirs[Math.floor(Math.random() * 4)];
      } else {
        ghost.x = nextX;
        ghost.y = nextY;
      }

      // 플레이어와 충돌 체크
      for (const playerId in this.state.players) {
        const player = this.state.players[playerId];
        const dx = player.x - ghost.x;
        const dy = player.y - ghost.y;
        if (Math.sqrt(dx * dx + dy * dy) < CONSTANTS.PLAYER_SIZE) {
          this.state.gameOver = true;
        }
      }
    }
  }

  getState() {
    return this.state;
  }
}
