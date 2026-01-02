import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { GameGateway } from './game.gateway';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly gameGateway: GameGateway) {}

  // =========================================
  // 룸 생성 + 봇 자동 추가
  // =========================================
  createRoomWithBots(
    roomId: string,
    users: string[],
    maxPlayers = 5,
    mode: 'NORMAL' | 'BOSS' = 'NORMAL',
  ) {
    // 1️⃣ 이미 방이 존재하면 거부
    const existingRoom = this.gameGateway.getRoom(roomId);
    if (existingRoom) {
      throw new ConflictException('이미 존재하는 방 ID입니다.');
    }

    // 2️⃣ 방 생성
    const roomWrapper = this.gameGateway.ensureRoom(roomId, mode);
    const room = roomWrapper.engine;

    if (!room) {
      throw new InternalServerErrorException('게임 엔진 생성 실패');
    }

    // 3️⃣ 봇 수 계산
    const humanCount = users.length;
    const botsToAdd = Math.max(0, maxPlayers - humanCount);

    this.logger.log(
      `[ROOM INIT] roomId=${roomId}, humans=${humanCount}, bots=${botsToAdd}, mode=${mode}`,
    );

    // 4️⃣ 봇 추가
    for (let i = 0; i < botsToAdd; i++) {
      room.addBotPlayer();
    }

    return {
      roomId,
      botsToAdd,
    };
  }

  // =========================================
  // 새로고침 / 뒤로가기 / 탭 닫기
  // =========================================
  handleUserLeave(googleSub: string) {
    this.logger.log(`[GAME LEAVE] user=${googleSub}`);
    this.gameGateway.handleHttpLeave(googleSub);
  }
}
