import { Injectable } from '@nestjs/common';
import { GameEngineService } from '../engine/game-engine.service';
import { GhostService } from '../engine/ghost/ghost.service';

export interface Room {
  id: string;
  engine: GameEngineService;
}

@Injectable()
export class RoomManager {
  private rooms: Map<string, Room> = new Map(); // ⭐ 방 목록 저장

  constructor(private readonly ghostService: GhostService) {}

  // 방 가져오기
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // 방 생성
  createRoom(roomId: string): Room {
    const room: Room = {
      id: roomId,
      engine: new GameEngineService(this.ghostService),
    };

    // ⭐ 엔진에 Room 정보 주입
    room.engine.roomId = roomId;
    room.engine.roomManager = this;

    this.rooms.set(roomId, room);

    console.log('🟢 방 생성됨:', roomId);
    return room;
  }

  // 방 삭제
  removeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log('🔥 방 삭제:', roomId);

    // 게임 루프 정지
    room.engine.stopInterval();

    // 삭제
    this.rooms.delete(roomId);
  }
}
