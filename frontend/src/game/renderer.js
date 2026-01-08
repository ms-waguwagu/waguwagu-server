// 화면 그리기 담당
const CONSTANTS = {
  GHOST_SIZE: 20,
  PLAYER_SIZE: 18,
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
  }
  clearCanvas() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMap() {
    const ctx = this.ctx;
    ctx.save();
    
    // 네온 효과 설정 (성능을 위해 그림자 제거)
    ctx.strokeStyle = "#4d4dff"; // 더 밝은 블루로 대체
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let row = 0; row < this.mapRows; row++) {
      for (let col = 0; col < this.mapCols; col++) {
        if (this.map[row][col] === 1) {
          const x = col * this.tileSize;
          const y = row * this.tileSize;
          const half = this.tileSize / 2;

          // 주변 타일 확인 (0: 길, 1: 벽)
          const up = row > 0 ? this.map[row - 1][col] : 0;
          const down = row < this.mapRows - 1 ? this.map[row + 1][col] : 0;
          const left = col > 0 ? this.map[row][col - 1] : 0;
          const right = col < this.mapCols - 1 ? this.map[row][col + 1] : 0;

          // 벽의 가장자리 그리기 (간단한 라인 기반)
          ctx.beginPath();
          
          // 맵 데이터 특성에 따라 사각형 대신 선으로 연결감을 줌
          if (up !== 1) { // 위쪽이 길이면 위쪽 가로선
            ctx.moveTo(x + 2, y + 2);
            ctx.lineTo(x + this.tileSize - 2, y + 2);
          }
          if (down !== 1) { // 아래쪽이 길이면 아래쪽 가로선
            ctx.moveTo(x + 2, y + this.tileSize - 2);
            ctx.lineTo(x + this.tileSize - 2, y + this.tileSize - 2);
          }
          if (left !== 1) { // 왼쪽이 길이면 왼쪽 세로선
            ctx.moveTo(x + 2, y + 2);
            ctx.lineTo(x + 2, y + this.tileSize - 2);
          }
          if (right !== 1) { // 오른쪽이 길이면 오른쪽 세로선
            ctx.moveTo(x + this.tileSize - 2, y + 2);
            ctx.lineTo(x + this.tileSize - 2, y + this.tileSize - 2);
          }
          
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  drawDots(dots = []) {
    this.ctx.fillStyle = "#FFB8AE"; // 클래식 연분홍 도트
    dots.forEach((dot) => {
      if (!dot.eaten) {
        const cx = dot.x * this.tileSize + this.tileSize / 2;
        const cy = dot.y * this.tileSize + this.tileSize / 2;
        this.ctx.beginPath();
        
        // 파워 펠렛인 경우 더 크게 그림 (임의의 기준: dot.isPowerPellet 같은 필드가 있다면)
        const radius = dot.type === "power" ? 7 : 2.5;
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 파워 펠렛에 글로우 효과
        if (dot.type === "power") {
          this.ctx.save();
          this.ctx.shadowColor = "#FFB8AE";
          this.ctx.shadowBlur = 10;
          this.ctx.fill();
          this.ctx.restore();
        }
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
