import { Controller, Post, Body, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { GameGateway } from './game.gateway';

@Controller('internal') // 
export class GameController {
  constructor(private readonly gameGateway: GameGateway) {}

  @Post('room') 
  createRoom(@Body() body: { roomId: string; users: string[] }) {
    const { roomId, users } = body;

    if (!roomId || !users) {
      throw new BadRequestException('roomId와 users는 필수입니다.');
    }

    console.log(`방 생성 요청 수신: ${roomId}, 유저: ${users}`);

    try {
      // 게이트웨이의 메서드를 호출하여 방을 미리 생성 
      const isCreated = this.gameGateway.createRoomByApi(roomId); 
      
      if (!isCreated) {
        throw new ConflictException('이미 존재하는 방 ID입니다.');
      }

      return {
        message: '게임룸이 생성되었습니다.',
        roomId,
        ip: 'localhost', 
        port: 3001
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('방 생성 중 오류 발생:', error);
      throw new InternalServerErrorException('방 생성에 실패했습니다.');
    }
  }
}