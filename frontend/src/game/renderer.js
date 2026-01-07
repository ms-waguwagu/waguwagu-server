// 화면 그리기 담당 - VINTAGE PACMAN STYLE
const CONSTANTS = {
  GHOST_SIZE: 20,
  PLAYER_SIZE: 18,
  BOSS_SIZE: 26,
};

// 유령 아이콘과 빈티지 색상
const GHOST_ICONS = ['👻', '😈', '🤖', '👾'];
const GHOST_COLORS = ['#d97d54', '#c46c44', '#f4b183', '#d9a66a'];

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

    this.previousScores = {};
    this.ghostIconIndices = {};
  }

  draw(gameState) {
    this.clearCanvas();
    this.drawMap();
    this.drawDots(gameState.dots || []);
    this.drawPlayers(gameState.players || {});
    this.drawGhosts(gameState.ghosts || {});
    this.drawBotPlayers(gameState.botPlayers || {});
    this.updateScoreboard(gameState);

    if (gameState.boss) {
      this.drawBoss(gameState.boss);
    }
  }

  // 보스 그리기 - 빈티지 스타일
  drawBoss(boss) {
    const ctx = this.ctx;
    ctx.save();

    const size = CONSTANTS.BOSS_SIZE;
    const cx = boss.x + size / 2;
    const cy = boss.y + size / 2;

    // 약한 글로우
    const pulse = Math.sin(Date.now() / 400) * 0.1 + 1;
    ctx.shadowBlur = 12 * pulse;
    ctx.shadowColor = 'rgba(217, 90, 70, 0.4)';
    
    // 보스 몸체 - 빈티지 오렌지
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, '#e8936a');
    gradient.addColorStop(1, '#d95a46');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 테두리
    ctx.strokeStyle = '#c44e3a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 보스 아이콘
    ctx.shadowBlur = 8;
    ctx.font = `${size * 0.7}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💀', cx, cy);

    ctx.restore();
  }

  clearCanvas() {
    // 빈티지 다크 블루그레이 배경
    this.ctx.fillStyle = '#2a3744';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // 빈티지 팩맨 스타일 벽 - 둥근 테두리
  drawMap() {
    const ctx = this.ctx;
    const ts = this.tileSize;
    
    for (let row = 0; row < this.mapRows; row++) {
      for (let col = 0; col < this.mapCols; col++) {
        if (this.map[row][col] === 1) {
          const x = col * ts;
          const y = row * ts;
          
          ctx.save();
          
          // 빈티지 오렌지 벽
          ctx.strokeStyle = '#d97d54';
          ctx.lineWidth = 2;
          
          // 부드러운 글로우
          ctx.shadowBlur = 5;
          ctx.shadowColor = 'rgba(217, 125, 84, 0.3)';
          
          // 둥근 모서리 사각형
          const radius = ts * 0.25;
          const padding = 2;
          
          ctx.beginPath();
          ctx.moveTo(x + padding + radius, y + padding);
          ctx.lineTo(x + ts - padding - radius, y + padding);
          ctx.arcTo(x + ts - padding, y + padding, x + ts - padding, y + padding + radius, radius);
          ctx.lineTo(x + ts - padding, y + ts - padding - radius);
          ctx.arcTo(x + ts - padding, y + ts - padding, x + ts - padding - radius, y + ts - padding, radius);
          ctx.lineTo(x + padding + radius, y + ts - padding);
          ctx.arcTo(x + padding, y + ts - padding, x + padding, y + ts - padding - radius, radius);
          ctx.lineTo(x + padding, y + padding + radius);
          ctx.arcTo(x + padding, y + padding, x + padding + radius, y + padding, radius);
          ctx.closePath();
          
          ctx.stroke();
          
          ctx.restore();
        }
      }
    }
  }

  // 점(먹이) 그리기 - 빈티지 노란색
  drawDots(dots = []) {
    const ctx = this.ctx;
    
    dots.forEach((dot) => {
      if (!dot.eaten) {
        const cx = dot.x * this.tileSize + this.tileSize / 2;
        const cy = dot.y * this.tileSize + this.tileSize / 2;
        
        ctx.save();
        
        // 부드러운 글로우
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(244, 197, 78, 0.4)';
        
        ctx.fillStyle = '#f4c54e';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
    });
  }

  // 플레이어(팩맨) 그리기 - 빈티지
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

      // 부드러운 글로우
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.adjustColorToVintage(player.color) + '50';

      // 색상을 빈티지 톤으로 변환
      ctx.fillStyle = this.adjustColorToVintage(player.color);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, directionAngle + mouthAngle, directionAngle - mouthAngle);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
  }

  // 색상을 빈티지 톤으로 조정하는 헬퍼 함수
  adjustColorToVintage(color) {
    // 노란색 계열은 빈티지 골드로
    if (color.includes('yellow') || color.includes('#ff') || color.includes('#FE')) {
      return '#f4c54e';
    }
    return color;
  }

  // 봇 플레이어 그리기 - 빈티지
  drawBotPlayers(botPlayers) {
    const ctx = this.ctx;
  
    Object.values(botPlayers).forEach((bot) => {
      ctx.save();
  
      ctx.globalAlpha = bot.alpha !== undefined ? bot.alpha : 1;
      const color = bot.color === "yellow" ? "#f4c54e" : bot.color;

      // 부드러운 글로우
      ctx.shadowBlur = 6;
      ctx.shadowColor = color + '40';

      ctx.fillStyle = color;
      ctx.fillRect(bot.x, bot.y, CONSTANTS.PLAYER_SIZE, CONSTANTS.PLAYER_SIZE);
  
      ctx.restore();
    });
  }

  // 유령 그리기 - 빈티지 아이콘
  drawGhosts(ghosts) {
    const ctx = this.ctx;
    
    Object.entries(ghosts).forEach(([ghostId, ghost], index) => {
      // 각 유령마다 고유 아이콘 할당
      if (!this.ghostIconIndices[ghostId]) {
        this.ghostIconIndices[ghostId] = index % GHOST_ICONS.length;
      }
      
      const iconIndex = this.ghostIconIndices[ghostId];
      const ghostIcon = GHOST_ICONS[iconIndex];
      const ghostColor = GHOST_COLORS[iconIndex];
      
      const cx = ghost.x;
      const cy = ghost.y;
      const size = CONSTANTS.GHOST_SIZE;
      
      ctx.save();
      
      // 약한 펄스
      const pulse = Math.sin(Date.now() / 600 + index) * 0.08 + 1;
      
      // 배경 원
      ctx.fillStyle = 'rgba(42, 55, 68, 0.6)';
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // 빈티지 테두리
      ctx.strokeStyle = ghostColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = ghostColor + '40';
      ctx.stroke();
      
      // 유령 아이콘
      ctx.shadowBlur = 8;
      ctx.shadowColor = ghostColor + '50';
      ctx.font = `${size * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ghostIcon, cx, cy);
      
      ctx.restore();
    });
  }

  updateScoreboard(gameState) {
    const container = document.getElementById("score-entries");
    const gameScreen = document.getElementById("game-screen");
    if (!container || !gameScreen) return;
  
    gameScreen.classList.add("show-scoreboard");
    container.innerHTML = "";
  
    // 사람 + 봇 합치기
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
      color: b.color || "#f4c54e",
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