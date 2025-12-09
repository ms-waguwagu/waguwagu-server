// 화면 그리기 담당

import { CONSTANTS } from "./game-core.js";
import { MAP_DATA, TILE_SIZE, MAP_ROWS, MAP_COLS, generateDots } from "./map.js";

export class Renderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.canvas.width = CONSTANTS.MAP_WIDTH;
    this.canvas.height = CONSTANTS.MAP_HEIGHT;
  }

  // -------------------------------
  // DOT 그리기
  // -------------------------------
  drawDots(dots) {
    this.ctx.fillStyle = "#FFD700"; // 노란 점

    dots.forEach((dot) => {
      if (!dot.eaten) {
        this.ctx.beginPath();
        this.ctx.arc(
          dot.x * TILE_SIZE + TILE_SIZE / 2,
          dot.y * TILE_SIZE + TILE_SIZE / 2,
          3,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
    });
  }

  // -------------------------------
  // 점수판 업데이트
  // -------------------------------
  updateScoreboard(gameState) {
    const container = document.getElementById("score-entries");
    const screen = document.getElementById("game-screen");
    if (!container) return;

    screen.classList.add("show-scoreboard");
    container.innerHTML = "";

    const sorted = Object.entries(gameState.players)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.score - a.score);

    sorted.forEach((p) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <span style="color:${p.color}; font-weight:bold;">${p.id}</span>
        : <span class="score-value">${p.score}</span>
      `;
      container.appendChild(div);
    });
  }

  // -------------------------------
  // 메인 그리기 루프
  // -------------------------------
  draw(gameState) {
    // 배경
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 벽 그리기
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAP_DATA[row][col] === 1) {
          this.ctx.fillStyle = "blue";
          this.ctx.fillRect(
            col * TILE_SIZE,
            row * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
          );
        }
      }
    }

    // DOT 그리기
    gameState.dots.forEach(dot => {
      if (!dot.eaten) {
        this.ctx.fillStyle = "yellow";
        this.ctx.beginPath();
        this.ctx.arc(
          dot.x * TILE_SIZE + TILE_SIZE / 2,
          dot.y * TILE_SIZE + TILE_SIZE / 2,
          3,
          0, Math.PI * 2
        );
        this.ctx.fill();
      }
    });

    // 점수판 업데이트
    this.updateScoreboard(gameState);

    // 플레이어 그리기
    Object.values(gameState.players).forEach(player => {
      this.ctx.fillStyle = player.color;
      this.ctx.beginPath();
      this.ctx.arc(
        player.x,
        player.y,
        CONSTANTS.PLAYER_SIZE / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    });
  }

  // ⭐ draw() 바깥에 정의해야 한다!
  updateScoreboard(gameState) {
    const container = document.getElementById("score-entries");
    const gameScreen = document.getElementById("game-screen");

    if (!container) return;

    gameScreen.classList.add("show-scoreboard");
    container.innerHTML = "";

    Object.entries(gameState.players).forEach(([id, p]) => {
      const entry = document.createElement("div");
      entry.innerHTML = `
        <span style="color:${p.color}; font-weight:bold;">${p.nickname}</span>
        : <span class="score-value">${p.score}</span>
      `;
      container.appendChild(entry);

      // 점수 애니메이션
      const scoreValue = entry.querySelector(".score-value");
      scoreValue.classList.add("score-animate");
      setTimeout(() => scoreValue.classList.remove("score-animate"), 300);
    });

    // 5. 유령(옵션)
    if (gameState.ghosts) {
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
    }

    // 6. 종료 메시지
    if (gameState.gameOver) {
      this.ctx.fillStyle = "red";
      this.ctx.font = "40px sans-serif";
      this.ctx.fillText(
        "게임 종료!",
        this.canvas.width / 2 - 100,
        this.canvas.height / 2
      );
    }

    // 7. 점수판 업데이트
    this.updateScoreboard(gameState);
  }
}
