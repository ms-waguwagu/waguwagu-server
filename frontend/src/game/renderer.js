// 화면 그리기 담당
const CONSTANTS = {
  GHOST_SIZE: 28,
  PLAYER_SIZE: 20,
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

    // 유령 이미지 로드
    this.ghostImages = {
      red: new Image(),
      yellow: new Image(),
      green: new Image(),
			pink: new Image(),
    };
    this.ghostImages.red.src = "../images/red.webp";
    this.ghostImages.yellow.src = "../images/yellow.webp";
    this.ghostImages.green.src = "../images/green.png";
    this.ghostImages.pink.src = "../images/pink.webp";

    // 봇 이미지 로드
    this.botImage = new Image();
    this.botImage.src = "../images/bot.png";
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
    
    // 네온 블루 스타일 설정
    ctx.strokeStyle = "#2121ff"; 
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const r = 8; // 라운딩 반경
    const off = 4; // 벽 안쪽으로의 오프셋

    for (let row = 0; row < this.mapRows; row++) {
      for (let col = 0; col < this.mapCols; col++) {
        if (this.map[row][col] === 1) {
          const x = col * this.tileSize;
          const y = row * this.tileSize;
          const w = this.tileSize;

          const up = row > 0 ? this.map[row - 1][col] : 0;
          const down = row < this.mapRows - 1 ? this.map[row + 1][col] : 0;
          const left = col > 0 ? this.map[row][col - 1] : 0;
          const right = col < this.mapCols - 1 ? this.map[row][col + 1] : 0;

          ctx.beginPath();
          
          // 위쪽 변
          if (up !== 1) {
            ctx.moveTo(left === 1 ? x : x + r + off, y + off);
            ctx.lineTo(right === 1 ? x + w : x + w - r - off, y + off);
          }
          // 아래쪽 변
          if (down !== 1) {
            ctx.moveTo(left === 1 ? x : x + r + off, y + w - off);
            ctx.lineTo(right === 1 ? x + w : x + w - r - off, y + w - off);
          }
          // 왼쪽 변
          if (left !== 1) {
            ctx.moveTo(x + off, up === 1 ? y : y + r + off);
            ctx.lineTo(x + off, down === 1 ? y + w : y + w - r - off);
          }
          // 오른쪽 변
          if (right !== 1) {
            ctx.moveTo(x + w - off, up === 1 ? y : y + r + off);
            ctx.lineTo(x + w - off, down === 1 ? y + w : y + w - r - off);
          }
          ctx.stroke(); // 직선들 먼저 그리기

          // 바깥쪽 모서리 라운딩 (각 모서리 독립적으로 렌더링하여 연결선 방지)
          if (up !== 1 && left !== 1) {
            ctx.beginPath();
            ctx.arc(x + r + off, y + r + off, r, Math.PI, Math.PI * 1.5);
            ctx.stroke();
          }
          if (up !== 1 && right !== 1) {
            ctx.beginPath();
            ctx.arc(x + w - (r + off), y + r + off, r, Math.PI * 1.5, 0);
            ctx.stroke();
          }
          if (down !== 1 && right !== 1) {
            ctx.beginPath();
            ctx.arc(x + w - (r + off), y + w - (r + off), r, 0, Math.PI * 0.5);
            ctx.stroke();
          }
          if (down !== 1 && left !== 1) {
            ctx.beginPath();
            ctx.arc(x + r + off, y + w - (r + off), r, Math.PI * 0.5, Math.PI);
            ctx.stroke();
          }
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
      
      const botRenderSize = 30; 

      if (this.botImage.complete) {
        const isFlipped = bot.dir && bot.dir.dx < 0;
        if (isFlipped) {
          ctx.save();
          // 이미지의 중심점을 기준으로 반전
          ctx.translate(bot.x + botRenderSize / 2, bot.y + botRenderSize / 2);
          ctx.scale(-1, 1);
          ctx.drawImage(
            this.botImage,
            -botRenderSize / 2,
            -botRenderSize / 2,
            botRenderSize,
            botRenderSize
          );
          ctx.restore();
        } else {
          ctx.drawImage(
            this.botImage,
            bot.x,
            bot.y,
            botRenderSize,
            botRenderSize
          );
        }
      } else {
        ctx.fillStyle = bot.color ?? "yellow";
        ctx.fillRect(
          bot.x,
          bot.y,
          botRenderSize,
          botRenderSize
        );
      }
  
      ctx.restore();
    });
  }

  
  drawGhosts(ghosts) {
    const ctx = this.ctx;
    Object.values(ghosts).forEach((ghost) => {
      let img = this.ghostImages.yellow; // 기본값
      if (ghost.color === "red" || ghost.id === "g1") {
        img = this.ghostImages.red;
      } else if (ghost.color === "yellow" || ghost.id === "g2") {
        img = this.ghostImages.yellow;
      } else if (ghost.color === "green" || ghost.id === "g3") {
        img = this.ghostImages.green;
      } else if (ghost.color === "pink" || ghost.id === "g4") {
        img = this.ghostImages.pink;
      }

      if (img && img.complete) {
        ctx.save();
        
        // 왼쪽으로 이동 중이면 이미지 반전 (눈이 왼쪽을 보도록)
        const isFlipped = ghost.dir && ghost.dir.dx < 0;
        if (isFlipped) {
          ctx.translate(ghost.x, ghost.y);
          ctx.scale(-1, 1);
          ctx.drawImage(
            img,
            -CONSTANTS.GHOST_SIZE / 2,
            -CONSTANTS.GHOST_SIZE / 2,
            CONSTANTS.GHOST_SIZE,
            CONSTANTS.GHOST_SIZE
          );
        } else {
          ctx.drawImage(
            img,
            ghost.x - CONSTANTS.GHOST_SIZE / 2,
            ghost.y - CONSTANTS.GHOST_SIZE / 2,
            CONSTANTS.GHOST_SIZE,
            CONSTANTS.GHOST_SIZE
          );
        }
        
        ctx.restore();
      } else {
        // 이미지 로딩 전에는 기존처럼 원형으로 그림
        ctx.fillStyle = ghost.color || "white";
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, CONSTANTS.GHOST_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      }
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
