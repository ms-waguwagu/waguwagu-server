// 화면 그리기 담당

const CONSTANTS = {
  GHOST_SIZE: 22,
  PLAYER_SIZE: 18,
};

export class Renderer {
  constructor(canvasId, mapData) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    // 서버에서 받은 데이터
    this.map = mapData.map;
    this.tileSize = mapData.tileSize;
    this.mapRows = mapData.rows;
    this.mapCols = mapData.cols;

    // 캔버스 크기 동적 설정
    this.canvas.width = this.mapCols * this.tileSize;
    this.canvas.height = this.mapRows * this.tileSize;
    console.log(
      `[Renderer Init] Canvas Size: ${this.canvas.width}x${this.canvas.height} (Rows: ${this.mapRows}, Cols: ${this.mapCols})`
    );
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
    this.drawMap();

    // 3. DOT 그리기
    if (Array.isArray(gameState.dots)) {
      this.drawDots(gameState.dots);
    }

    // 4. 플레이어 그리기
    if (gameState.players) {
      this.drawPlayers(gameState.players);
    }

    // 5. 유령 그리기 (옵션)
    if (gameState.ghosts) {
      Object.values(gameState.ghosts).forEach((ghost) => {
        ctx.fillStyle = ghost.color || "white";
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, CONSTANTS.GHOST_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 6. 게임 종료 텍스트
    // if (gameState.gameOver) {
    //   ctx.fillStyle = "red";
    //   ctx.font = "40px sans-serif";
    //   ctx.fillText(
    //     "게임 종료!",
    //     this.canvas.width / 2 - 100,
    //     this.canvas.height / 2
    //   );
    // }

    // 7. 점수판 업데이트 (화면 그린 뒤 호출)
    this.updateScoreboard(gameState);
  }

  drawMap() {
    this.ctx.fillStyle = "blue"; // 벽 색깔
    for (let row = 0; row < this.mapRows; row++) {
      for (let col = 0; col < this.mapCols; col++) {
        if (this.map[row][col] === 1) {
          this.ctx.fillRect(
            col * this.tileSize,
            row * this.tileSize,
            this.tileSize,
            this.tileSize
          );
        }
      }
    }
  }

  // -------------------------------
  // DOT 그리기
  // -------------------------------
  drawDots(dots = []) {
    const ctx = this.ctx;
    ctx.fillStyle = "#FFD700"; // 노란 점

    dots.forEach((dot) => {
      if (!dot.eaten) {
        // 도트는 타일 중앙에 작게 그림
        const cx = dot.x * this.tileSize + this.tileSize / 2;
        const cy = dot.y * this.tileSize + this.tileSize / 2;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  // -------------------------------
  // 플레이어 그리기
  // -------------------------------
  drawPlayers(players) {
    Object.values(players).forEach((player) => {
      this.ctx.fillStyle = player.color;
      this.ctx.fillRect(player.x, player.y, 18, 18); // 사이즈는 조정 필요
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
        nickname: p.nickname || id, // 닉네임 없으면 id 사용
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
}
