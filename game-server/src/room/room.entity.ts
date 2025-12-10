import { GameEngineService } from 'src/engine/game-engine.service';

export interface RoomEntity {
  id: string;
  engine: GameEngineService;
}
