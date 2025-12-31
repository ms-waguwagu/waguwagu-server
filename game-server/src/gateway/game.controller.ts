import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GameService } from './game.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class GameController {
  constructor(private readonly gameService: GameService) {}

  // =========================
  // 게임 룸 생성 (매칭 서버 → 게임 서버)
  // =========================
  @Post('internal/room')
  createRoom(
    @Body()
    body: {
      roomId: string;
      users: string[];
      maxPlayers?: number;
      mode?: 'NORMAL' | 'BOSS';
    },
  ) {
    const { roomId, users, maxPlayers, mode } = body;

    if (!roomId || !users) {
      throw new BadRequestException('roomId와 users는 필수입니다.');
    }

    const gameMode = mode || 'NORMAL';
    console.log(
      `[ROOM CREATE] ${roomId}, users=${users.join(',')}, mode=${gameMode}`,
    );

    const result = this.gameService.createRoomWithBots(
      roomId,
      users,
      maxPlayers,
      gameMode,
    );

    return {
      message: '게임룸이 생성되었습니다.',
      roomId: result.roomId,
      botsAdded: result.botsToAdd,
      ip: 'localhost',
      port: 3001,
    };
  }

	

  // =========================
  // 게임 강제 종료 (새로고침 / 탭 닫기)
  // =========================
  @UseGuards(AuthGuard('jwt'))
  @Post('api/game/leave')
  leaveGame(@Req() req) {
    const googleSub = req.user?.googleSub;

    if (!googleSub) {
      throw new BadRequestException('googleSub가 없습니다.');
    }

    console.log(`🚪 [GAME LEAVE] googleSub=${googleSub}`);

    this.gameService.handleUserLeave(googleSub);

    return { ok: true };
  }

  // =========================
// 게임 종료 알림 (게임 서버 → 매칭 서버)
// =========================
@Post('internal/game-finished')
  async gameFinished(
    @Body()
    body: {
      roomId: string;
      userIds: string[];
    },
  ) {
    const { roomId, userIds } = body;

    if (!roomId || !userIds || userIds.length === 0) {
      throw new BadRequestException('roomId와 userIds는 필수입니다.');
    }

    console.log(
      `🏁 [GAME FINISHED] roomId=${roomId}, users=${userIds.join(',')}`,
    );

    // 여기서 "매칭 서버로 알림"만 한다
    await this.gameService.notifyGameFinished(roomId, userIds);

    return { ok: true };
  }
}
