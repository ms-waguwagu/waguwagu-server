import { Controller, Post, Body } from '@nestjs/common';
import { GameGateway } from './game.gateway';

@Controller('internal') // 
export class GameController {
  constructor(private readonly gameGateway: GameGateway) {}

  @Post('room') 
  createRoom(@Body() body: { roomId: string; users: string[] }) {
    const { roomId, users } = body;
    console.log(`방 생성 요청 수신: ${roomId}, 유저: ${users}`);

    // 게이트웨이의 메서드를 호출하여 방을 미리 생성 
    this.gameGateway.createRoomByApi(roomId); 

    return {
      message: '룸이 생성되었습니다.',
      roomId,
      ip: 'localhost', 
      port: 3001
    };
  }
}