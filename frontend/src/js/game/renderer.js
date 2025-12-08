//화면 그리기 담당
// Canvas에 네모 그리기, 색칠하기

import { CONSTANTS } from "./game-core.js";
import { MAP_DATA, TILE_SIZE, MAP_ROWS, MAP_COLS } from "./map.js";

export class Renderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    // 캔버스 크기를 맵 크기에 맞춤
    this.canvas.width = CONSTANTS.MAP_WIDTH;
    this.canvas.height = CONSTANTS.MAP_HEIGHT;
  }

  draw(gameState) {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "blue";
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAP_DATA[row][col] === 1) {
          this.ctx.fillRect(
            col * TILE_SIZE,
            row * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
          );
        }
      }
    }

    Object.values(gameState.players).forEach((player) => {
      this.ctx.fillStyle = player.color;
      this.ctx.fillRect(
        player.x,
        player.y,
        CONSTANTS.PLAYER_SIZE,
        CONSTANTS.PLAYER_SIZE
      );
    });

    // 유령 그리기
    Object.values(gameState.ghosts).forEach((ghost) => {
      this.ctx.fillStyle = ghost.color;
      this.ctx.beginPath();
      this.ctx.arc(
        ghost.x + CONSTANTS.GHOST_SIZE / 2,
        ghost.y + CONSTANTS.GHOST_SIZE / 2,
        CONSTANTS.GHOST_SIZE / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    });

    // 게임 종료 표시
    if (gameState.gameOver) {
      this.ctx.fillStyle = "red";
      this.ctx.font = "40px sans-serif";
      this.ctx.fillText(
        "게임 종료!",
        this.canvas.width / 2 - 100,
        this.canvas.height / 2
      );
    }
  }
}
