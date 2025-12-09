// 게임 엔진 (GameCore.js)

import { MAP_DATA, TILE_SIZE, MAP_COLS, MAP_ROWS, generateDots } from "./map.js";

export const CONSTANTS = {
  PLAYER_SPEED: 4,
  PLAYER_SIZE: 18,
  MAP_WIDTH: MAP_COLS * TILE_SIZE,
  MAP_HEIGHT: MAP_ROWS * TILE_SIZE,
};

export class GameCore {
  constructor() {
    this.state = {
      players: {},
      map: MAP_DATA,
      dots: generateDots(MAP_DATA),
    };
  }

  addPlayer(id, color, gridX, gridY) {
    this.state.players[id] = {
      x: gridX * TILE_SIZE + (TILE_SIZE - CONSTANTS.PLAYER_SIZE) / 2,
      y: gridY * TILE_SIZE + (TILE_SIZE - CONSTANTS.PLAYER_SIZE) / 2,
      color,
      score: 0,
    };
  }

  processInput(playerId, direction) {
    const player = this.state.players[playerId];
    if (!player) return;

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
