// 추후 nest로 이전 예정
// 좌표 계산, 충돌 판정, 이동 속도 등 게임의 핵심 로직 담당

import { MAP_DATA, TILE_SIZE, MAP_COLS, MAP_ROWS } from "./map.js";

export const CONSTANTS = {
  PLAYER_SPEED: 4,
  PLAYER_SIZE: 20, // 플레이어 크기는 타일보다 작아야 움직이기 편함
  // MAP 크기는 타일 수 * 타일 크기로 자동 계산
  MAP_WIDTH: MAP_COLS * TILE_SIZE,
  MAP_HEIGHT: MAP_ROWS * TILE_SIZE,
};

export class GameCore {
  constructor() {
    // 게임의 '상태(State)' 데이터
    this.state = {
      players: {}, // id: { x, y, color }
      map: MAP_DATA, // 맵 데이터도 상태에 포함 (나중에 클라이언트에 전송용)
    };
  }

  // 플레이어 생성
  // startX, startY를 그리드 좌표로 받음
  addPlayer(id, color, gridX = 1, gridY = 1) {
    this.state.players[id] = {
      // 그리드 좌표를 픽셀 좌표로 변환 (+10은 중앙 정렬용 보정값)
      x: gridX * TILE_SIZE + 10,
      y: gridY * TILE_SIZE + 10,
      color: color,
      score: 0,
    };
  }

  // 입력(Input)을 받아서 상태(State)를 변경
  // 서버에서는 이 함수를 프론트에서 받은 입력 패킷으로 실행
  processInput(playerId, direction) {
    const player = this.state.players[playerId];
    if (!player) return;

    let nextX = player.x;
    let nextY = player.y;

    // 1. 이동할 예상 좌표 계산
    if (direction === "ArrowUp")
      (nextX = player.x), (nextY = player.y - CONSTANTS.PLAYER_SPEED);
    if (direction === "ArrowDown")
      (nextX = player.x), (nextY = player.y + CONSTANTS.PLAYER_SPEED);
    if (direction === "ArrowLeft")
      (nextX = player.x - CONSTANTS.PLAYER_SPEED), (nextY = player.y);
    if (direction === "ArrowRight")
      (nextX = player.x + CONSTANTS.PLAYER_SPEED), (nextY = player.y);

    // 2. 충돌 체크: 벽이 아니면 위치 업데이트
    if (!this.checkCollision(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
    }
  }

  // 충돌 감지 함수
  checkCollision(x, y) {
    const size = CONSTANTS.PLAYER_SIZE;

    // 플레이어의 네 모서리 좌표 확인
    const points = [
      { x: x, y: y }, // 좌상단
      { x: x + size, y: y }, // 우상단
      { x: x, y: y + size }, // 좌하단
      { x: x + size, y: y + size }, // 우하단
    ];

    for (const point of points) {
      // 픽셀 좌표 -> 그리드(배열) 인덱스로 변환
      const col = Math.floor(point.x / TILE_SIZE);
      const row = Math.floor(point.y / TILE_SIZE);

      // 맵 범위 밖이거나, 벽(= 1)이면 충돌
      if (
        row < 0 ||
        row >= MAP_ROWS ||
        col < 0 ||
        col >= MAP_COLS ||
        MAP_DATA[row][col] === 1
      ) {
        return true; // 충돌 발생
      }
    }
    return false; // 충돌 없음
  }

  getState() {
    return this.state;
  }
}
