export interface PlayerState {
  googleSub: string; // ⭐ 필수, 유일 식별자
  id: string;
  nickname: string;
  x: number;
  y: number;
  dir: { dx: number; dy: number };
  color: string;
  score: number;
  stunned: boolean;
  stunEndTime: number;
  alpha: number;
}
