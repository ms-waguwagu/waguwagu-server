import { Controller, Post, Body } from '@nestjs/common';
import { RoomManager } from './room/room-manager.service';

@Controller('game')
export class GameController {
  constructor(private readonly roomManager: RoomManager) {}

  @Post('create')
  createRoom(@Body() body: { roomId: string; players: string[] }) {
    const { roomId, players } = body;

    // 방 생성 (room 변수를 받을 필요 없음)
    this.roomManager.createRoom(roomId);

    console.log(`🟢 [게임서버] 새 방 생성됨: ${roomId}`);
    console.log('👥 참가자:', players);

    return { ok: true, roomId };
  }
}
