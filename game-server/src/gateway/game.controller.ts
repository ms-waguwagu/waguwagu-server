import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('internal') 
export class GameController {
  constructor(
		private readonly gameService: GameService
	) {}


  @Post('room') 
  createRoom(@Body() body: { roomId: string; users: string[], maxPlayers?: number; }) {
    const { roomId, users, maxPlayers } = body;

    if (!roomId || !users) {
      throw new BadRequestException('roomId와 users는 필수입니다.');
    }

    console.log(`방 생성 요청 수신: ${roomId}, 유저: ${users}`);

		const result = this.gameService.createRoomWithBots(roomId, users, maxPlayers);

    return {
        message: '게임룸이 생성되었습니다.',
        roomId: result.roomId,
    		botsAdded: result.botsToAdd,	
        ip: 'localhost', 
        port: 3001
      };
  }
}