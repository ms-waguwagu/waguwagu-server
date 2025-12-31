import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameGateway } from './game.gateway';
import axios from 'axios';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly gameGateway: GameGateway,
    private readonly configService: ConfigService,
  ) {}

  // =========================
  // 방 생성 및 봇 투입 로직
  // (매칭 서버에서 호출됨)
  // =========================
  createRoomWithBots(
    roomId: string,
    users: string[],
    maxPlayers = 5,
    mode: 'NORMAL' | 'BOSS' = 'NORMAL',
  ) {
    // 1. 방 생성 (Gateway의 ensureRoom은 RoomWrapper 객체를 반환)
    const roomWrapper = this.gameGateway.ensureRoom(roomId, mode);

    if (!roomWrapper) {
      throw new InternalServerErrorException('방 생성에 실패했습니다.');
    }

    // 2. 방 엔진 가져오기
    const room = roomWrapper.engine;
    if (!room) {
      throw new InternalServerErrorException('게임 엔진을 찾을 수 없습니다.');
    }

    // 3. 봇이 얼마나 필요한지 계산
    const humanCount = users.length;
    // 보스모드일 때는 봇이 필요 없다면 0으로 처리 (기획에 맞춰 조정 가능)
    const botsToAdd = Math.max(0, maxPlayers - humanCount);

    this.logger.debug(
      `[${mode}] roomId=${roomId} 유저 ${humanCount}명, 목표 ${maxPlayers}명 → 봇 ${botsToAdd}개 추가 예정`,
    );

    // 4. 봇 추가
    // (혹시 API가 중복 호출되어도 봇이 계속 늘어나지 않도록 현재 개수 체크)
    const currentBotCount = room.getBotCount();
    
    if (currentBotCount < botsToAdd) {
        const needed = botsToAdd - currentBotCount;
        
        for (let i = 0; i < needed; i++) {
          // getNextBotNumber가 없으면 현재 개수 기반으로 번호 생성 (충돌 방지)
          const nextNum = currentBotCount + i + 1;
          const botNumber = room.getNextBotNumber ? room.getNextBotNumber() : nextNum; 
          const botName = `bot-${botNumber}`;
          
          room.addBotPlayer(botName);
          this.logger.debug(`🤖 BOT 생성: ${botName}`);
        }
    }

    return { roomId, botsToAdd };
  }

  // =========================
  // 유저 강제 퇴장 처리 (API)
  // =========================
  handleUserLeave(userId: string) {
    this.gameGateway.handleHttpLeave(userId);
  }

  // =========================
  // 게임 종료 → 매칭 서버 알림
  // =========================
  async notifyGameFinished(roomId: string, userIds: string[]) {
    const matchingUrl = this.configService.get<string>('MATCHING_INTERNAL_URL');
    // 내부 통신용 보안 토큰 (옵션)
    const internalToken = this.configService.get<string>('INTERNAL_TOKEN'); 

    if (!matchingUrl) {
        this.logger.warn('MATCHING_INTERNAL_URL 환경변수가 설정되지 않았습니다.');
        return;
    }

    try {
      await axios.post(
        `${matchingUrl}/internal/game-finished`,
        {
          roomId,
          userIds,
        },
        {
          headers: {
            'x-internal-token': internalToken,
          },
          timeout: 5000, // 타임아웃 설정 권장
        },
      );

      this.logger.log(
        `🏁 [GAME FINISHED] 매칭 서버 알림 완료: roomId=${roomId}`,
      );
    } catch (err) {
      this.logger.error(
        `[GAME FINISHED FAIL] 매칭 서버 알림 실패: roomId=${roomId}`,
        err?.message,
      );
    }
  }
}