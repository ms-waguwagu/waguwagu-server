import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
// 기존 GameRoomService / RoomManager 같은 거 있으면 주입해서 사용
import { GameGateway } from '../gateway/game.gateway';

type GameMode = 'NORMAL' | 'BOSS';

interface BossInfo {
  x: number;
  y: number;
}

interface RoomState {
  id: string;
  mode: GameMode;
  players: Array<{
    id: string;
    nickname: string;
    x: number;
    y: number;
    dead: boolean;
  }>;
  boss: BossInfo;
  // TODO: 기존 필드(dots, timer 등)도 여기에 같이 포함
}

@Injectable()
export class BossRoomService {
  constructor(private readonly gameGateway: GameGateway) {}

  async createDebugRoom(nickname: string): Promise<string> {
    const roomId = uuidv4();

    const roomState: RoomState = {
      id: roomId,
      mode: 'BOSS',
      players: [
        {
          id: `debug-${Date.now()}`, // 임시 유저 ID
          nickname,
          x: 5,
          y: 5,
          dead: false,
        },
      ],
      boss: {
        x: 10,
        y: 10,
      },
    };

    // 이 부분은 너희 실제 구조에 맞게:
    this.gameGateway.createBossDebugRoom(roomState);

    return roomId;
  }
}
