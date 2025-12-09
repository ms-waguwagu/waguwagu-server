// 화면 그리기 담당

import { CONSTANTS } from "./game-core.js";
import { MAP_DATA, TILE_SIZE, MAP_ROWS, MAP_COLS } from "./map.js";

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
  drawDots(dots = []) {
    const ctx = this.ctx;
    ctx.fillStyle = "#FFD700"; // 노란 점

    dots.forEach((dot) => {
      if (!dot.eaten) {
        ctx.beginPath();
        ctx.arc(
          dot.x * TILE_SIZE + TILE_SIZE / 2,
          dot.y * TILE_SIZE + TILE_SIZE / 2,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
  }

  // -------------------------------
  // 점수판 업데이트
  // -------------------------------
  updateScoreboard(gameState) {
    const container = document.getElementById("score-entries");
    const gameScreen = document.getElementById("game-screen");
    if (!container || !gameScreen) return;

    gameScreen.classList.add("show-scoreboard");
    container.innerHTML = "";

    const playersEntries = Object.entries(gameState.players || {}).map(
      ([id, p]) => ({
        id,
        nickname: p.nickname || id,                 // 닉네임 없으면 id 사용
        score: typeof p.score === "number" ? p.score : 0,
        color: p.color || "#ffffff",
      })
    );

    // 점수 순 정렬
    playersEntries.sort((a, b) => b.score - a.score);

    playersEntries.forEach((p) => {
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
  }

  // -------------------------------
  // 메인 그리기 루프
  // -------------------------------
  draw(gameState) {
    const ctx = this.ctx;

    // 1. 배경 클리어
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. 맵(벽) 그리기
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAP_DATA[row][col] === 1) {
          ctx.fillStyle = "blue";
          ctx.fillRect(
            col * TILE_SIZE,
            row * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
          );
        }
      }
    }

    // 3. DOT 그리기
    if (Array.isArray(gameState.dots)) {
      this.drawDots(gameState.dots);
    }

    // 4. 플레이어 그리기
    Object.values(gameState.players || {}).forEach((player) => {
      ctx.fillStyle = player.color || "yellow";
      ctx.beginPath();
      ctx.arc(
        player.x,
        player.y,
        CONSTANTS.PLAYER_SIZE / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    // 5. 유령 그리기 (옵션)
    if (gameState.ghosts) {
      Object.values(gameState.ghosts).forEach((ghost) => {
        ctx.fillStyle = ghost.color || "white";
        ctx.beginPath();
        ctx.arc(
          ghost.x,
          ghost.y,
          CONSTANTS.GHOST_SIZE / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    }

    // 6. 게임 종료 텍스트
    if (gameState.gameOver) {
      ctx.fillStyle = "red";
      ctx.font = "40px sans-serif";
      ctx.fillText(
        "게임 종료!",
        this.canvas.width / 2 - 100,
        this.canvas.height / 2
      );
    }

    // 7. 점수판 업데이트 (화면 그린 뒤 호출)
    this.updateScoreboard(gameState);
  }
}
