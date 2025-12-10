export interface PlayerState {
    id: string;                // 플레이어 고유 ID
    x: number;                 // 현재 x 좌표 (픽셀 단위)
    y: number;                 // 현재 y 좌표 (픽셀 단위)
    dir: { dx: number; dy: number }; // 현재 이동 방향 (-1,0,1)
    color: string;             // 플레이어 색상 (렌더링용)
    score: number;             // 점수 (dot 먹으면 올라감)
    nickname: string;          // 플레이어 닉네임
  }
  