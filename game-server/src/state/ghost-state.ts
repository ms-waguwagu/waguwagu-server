import { Direction } from '../types/direction.type';

export interface GhostState {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  speed: number;
  color: string;
  targetX?: number;
  targetY?: number;
  path?: Array<{ x: number; y: number }>;
  recentTiles?: { x: number; y: number }[];
}
