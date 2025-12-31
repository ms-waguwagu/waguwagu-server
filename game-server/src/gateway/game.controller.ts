import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { GameService } from './game.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  // =========================
  // [중요] 게임 룸 초기화 및 봇 생성
  // 요청자: 매칭 서버 (Agones 할당 직후 호출됨)
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
    
    this.logger.log(
      `🏠 [API] 룸 생성 요청 수신: roomId=${roomId}, 유저=${users.length}명, 모드=${gameMode}`,
    );

    // GameService를 통해 봇을 부족한 만큼 채워넣고 방을 만듭니다.
    const result = this.gameService.createRoomWithBots(
      roomId,
      users,
      maxPlayers,
      gameMode,
    );

    // 매칭 서버가 응답을 받아 로깅용으로 사용합니다.
    return {
      message: 'Game room initialized successfully',
      roomId: result.roomId,
      botsAdded: result.botsToAdd,
    };
  }

  // =========================
  // 유저의 강제 나가기 / 탭 닫기 요청
  // 요청자: 클라이언트 (HTTP)
  // =========================
  @UseGuards(AuthGuard('jwt'))
  @Post('api/game/leave')
  leaveGame(@Req() req) {
    // JWT에서 유저 ID 추출 (Google Sub 등)
    const googleSub = req.user?.googleSub || req.user?.sub;

    if (!googleSub) {
      throw new BadRequestException('유저 정보를 찾을 수 없습니다.');
    }

    this.logger.log(`🚪 [API] 유저 나가기 요청: ${googleSub}`);

    // 해당 유저의 소켓 연결을 끊어버림
    this.gameService.handleUserLeave(googleSub);

    return { ok: true };
  }
}