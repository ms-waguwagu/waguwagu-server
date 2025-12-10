import { Direction } from '../engine/game-engine.service';

export interface GhostState {
    id: string;
    x: number; // 픽셀 좌표
    y: number; // 픽셀 좌표
    dir: Direction;
    speed: number;
    color: string;
    target?: { x: number; y: number };
  }