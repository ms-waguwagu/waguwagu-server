import { PlayerState } from './player-state';

export interface BotState extends PlayerState {
  path: { x: number; y: number }[];
  targetX: number;
  targetY: number;
}
