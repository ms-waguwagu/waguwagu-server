export interface PlayerState {
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