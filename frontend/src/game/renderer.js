// 화면 그리기 담당
const CONSTANTS = {
  GHOST_SIZE: 20,
  PLAYER_SIZE: 18,
	BOSS_SIZE: 26, // ‼️보스테스트‼️

};

export class Renderer {
  constructor(canvasId, mapData) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.map = mapData.map;
    this.tileSize = mapData.tileSize;
    this.mapRows = mapData.rows;
    this.mapCols = mapData.cols;

    this.canvas.width = this.mapCols * this.tileSize;
    this.canvas.height = this.mapRows * this.tileSize;

    console.log(
      `[Renderer Init] Canvas Size: ${this.canvas.width}x${this.canvas.height} (Rows: ${this.mapRows}, Cols: ${this.mapCols})`
    );

    this.previousScores = {}; // 플레이어 점수 변화 체크용
  }

  // -------------------------------
  // 메인 그리기 루프 
  // -------------------------------
  draw(gameState) {
    this.clearCanvas();
    this.drawMap();
    this.drawDots(gameState.dots || []);
    this.drawPlayers(gameState.players || {});
    this.drawGhosts(gameState.ghosts || {});
    this.drawBotPlayers(gameState.botPlayers || {});
    this.updateScoreboard(gameState);

    // ‼️보스테스트‼️ 보스가 있을 때만 그림
    if (gameState.boss) {
      this.drawBoss(gameState.boss);
    }
  }
  // ‼️보스테스트‼️
	drawBoss(boss) {
  const ctx = this.ctx;
  ctx.save();

  ctx.fillStyle = "orange"; // 보스 주황색
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;

  const size = CONSTANTS.BOSS_SIZE;

  ctx.beginPath();
  ctx.arc(
    boss.x + size / 2,
    boss.y + size / 2,
    size / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}


  clearCanvas() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

  drawDots(dots = []) {
    this.ctx.fillStyle = "#FFD700"; // 노란 점
    dots.forEach((dot) => {
      if (!dot.eaten) {
        const cx = dot.x * this.tileSize + this.tileSize / 2;
        const cy = dot.y * this.tileSize + this.tileSize / 2;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  drawPlayers(players) {
    const ctx = this.ctx;

    Object.values(players).forEach((player) => {
      ctx.save();

      ctx.globalAlpha = player.alpha !== undefined ? player.alpha : 1;

      // 팩맨 애니메이션
      const time = Date.now() / 150;
      const mouthOpen = (Math.sin(time) + 1) / 2;
      const maxAngle = Math.PI / 3.5;
      const mouthAngle = mouthOpen * maxAngle;

      const cx = player.x + CONSTANTS.PLAYER_SIZE / 2;
      const cy = player.y + CONSTANTS.PLAYER_SIZE / 2;
      const radius = CONSTANTS.PLAYER_SIZE / 2;

      let directionAngle = 0;
      if (player.dir.dx === 1) directionAngle = 0;
      else if (player.dir.dx === -1) directionAngle = Math.PI;
      else if (player.dir.dy === -1) directionAngle = -Math.PI / 2;
      else if (player.dir.dy === 1) directionAngle = Math.PI / 2;

      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, directionAngle + mouthAngle, directionAngle - mouthAngle);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
  }

  drawBotPlayers(botPlayers) {
    const ctx = this.ctx;
  
    Object.values(botPlayers).forEach((bot) => {
      ctx.save();
  
      ctx.globalAlpha = bot.alpha !== undefined ? bot.alpha : 1;
      ctx.fillStyle = bot.color ?? "yellow";
  
      ctx.fillRect(
        bot.x,
        bot.y,
        CONSTANTS.PLAYER_SIZE,
        CONSTANTS.PLAYER_SIZE
      );
  
      ctx.restore();
    });
  }

  
  drawGhosts(ghosts) {
    const ctx = this.ctx;
    Object.values(ghosts).forEach((ghost) => {
      ctx.fillStyle = ghost.color || "white";
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, CONSTANTS.GHOST_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  updateScoreboard(gameState) {
    const container = document.getElementById("score-entries");
    const gameScreen = document.getElementById("game-screen");
    if (!container || !gameScreen) return;
  
    gameScreen.classList.add("show-scoreboard");
    container.innerHTML = "";
  
    // 사람 + 봇 모두 합치기
    const humanPlayers = Object.entries(gameState.players || {}).map(
      ([id, p]) => ({
        id,
        nickname: p.nickname || id,
        score: typeof p.score === "number" ? p.score : 0,
        color: p.color || "#ffffff",
      })
    );
  
    const botPlayers = Object.values(gameState.botPlayers || []).map((b) => ({
      id: b.id,
      nickname: b.nickname,
      score: typeof b.score === "number" ? b.score : 0,
      color: b.color || "yellow",
    }));
  
    const allPlayers = [...humanPlayers, ...botPlayers];
  
    // 점수 순 정렬
    allPlayers.sort((a, b) => b.score - a.score);
  
    // 점수판 렌더링
    allPlayers.forEach((p) => {
      const entry = document.createElement("div");
      const oldScore = this.previousScores[p.id] ?? p.score;
  
      entry.innerHTML = `
        <span class="player-name" style="color:${p.color};">${p.nickname}</span>
        <span class="player-score score-value">${p.score}</span>
      `;
  
      const scoreValue = entry.querySelector(".player-score");
  
      if (p.score > oldScore) {
        scoreValue.classList.add("score-increase");
        setTimeout(() => scoreValue.classList.remove("score-increase"), 500);
      } else if (p.score < oldScore) {
        scoreValue.classList.add("score-decrease");
        setTimeout(() => scoreValue.classList.remove("score-decrease"), 500);
      }
  
      this.previousScores[p.id] = p.score;
      container.appendChild(entry);
    });
  }
}
