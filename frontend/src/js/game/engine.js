import { MAP_DATA, generateDots } from "./map.js";

export class GameEngine {
  constructor() {
    // 플레이어 목록 (socketId → player object)
    this.players = {};

    // 점(dot) 생성
    this.dots = generateDots(MAP_DATA);
  }

  // 플레이어 등록
  addPlayer(id, x, y, color) {
    this.players[id] = {
      x,
      y,
      color,
      score: 0,
    };
  }

  // 플레이어 이동 처리
  movePlayer(id, dx, dy) {
    const p = this.players[id];
    if (!p) return;

    const newX = p.x + dx;
    const newY = p.y + dy;

    // 벽 충돌 체크 (MAP_DATA가 0만 통과 가능)
    const tileX = Math.floor(newX);
    const tileY = Math.floor(newY);

    if (MAP_DATA[tileY] && MAP_DATA[tileY][tileX] === 1) {
      return; // 벽이면 이동 안 함
    }

    p.x = newX;
    p.y = newY;

    this.checkDotCollision(p);
  }

  // dot 먹었는지 체크
  checkDotCollision(player) {
    for (let dot of this.dots) {
      if (dot.eaten) continue;

      if (player.x === dot.x && player.y === dot.y) {
        dot.eaten = true;
        player.score += 10;
      }
    }
  }

  // Renderer에 넘겨줄 게임 상태
  getState() {
    return {
      players: this.players,
      dots: this.dots,
    };
  }
}
