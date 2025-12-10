import { Direction } from '../types/direction.type';

export interface PlayerState {
  id: string;
  nickname: string;
  x: number;
  y: number;
  dir: Direction;
  color: string;
  score: number;
}
