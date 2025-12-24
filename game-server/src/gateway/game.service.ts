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

  createRoomWithBots(
    roomId: string,
    users: string[],
    maxPlayers = 5,
    mode: 'NORMAL' | 'BOSS' = 'NORMAL',
  ) {
    // 1. 방 생성
    const isCreated = this.gameGateway.createRoomByApi(roomId, users, mode);

    if (!isCreated) {
      throw new ConflictException('이미 존재하는 방 ID입니다.');
    }

    // 2. 방 엔진 가져오기
    const room = this.gameGateway.getRoom(roomId);
    if (!room) {
      throw new InternalServerErrorException('게임 엔진 생성에 실패했습니다.');
    }

    // 3. 사람 수 기준으로 부족한 봇 수 계산
    const humanCount = users.length;
    const botsToAdd = Math.max(0, maxPlayers - humanCount);

    this.logger.debug(
      `[${mode}] 유저 ${humanCount}명, 목표 ${maxPlayers}명 → 봇 ${botsToAdd}개 추가`,
    );

    // 4. 봇 추가
    for (let i = 0; i < botsToAdd; i++) {
      const botNumber = room.getNextBotNumber();
      const botName = `bot-${botNumber}`;
      room.addBotPlayer(botName);

      this.logger.debug(`🤖 BOT 생성: ${botName}`);
    }

    return { roomId, botsToAdd };
  }

  // =========================
  // 새로고침 / 탭 닫기 처리
  // =========================
  handleUserLeave(googleSub: string) {
    this.gameGateway.handleHttpLeave(googleSub);
  }
}
