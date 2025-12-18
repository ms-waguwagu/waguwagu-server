import { Injectable } from '@nestjs/common';
import { TILE_SIZE, PLAYER_SIZE, MAP_DESIGN } from '../../map/map.data';
import { parseMap } from '../../map/map.service';
import { GhostManagerService } from '../ghost/ghost-manager.service';
import { PlayerService, Player, Dot } from '../player/player.service';
import { BotManagerService, Bot } from '../bot/bot-manager.service';
import { Logger } from '@nestjs/common';
import { BossManagerService } from '../../boss/boss-manager.service';
import axios from 'axios';

interface LifecycleState {
  gameStartTime: number;
  maxGameDuration: number;
  gameOver: boolean;
	gameOverPlayerId: string | null;
  gameOverReason: string | null;
  map: number[][];
  dots: Dot[];
}

@Injectable()
export class LifecycleService {
	private rooms: Record<string, LifecycleState> = {};
	private logger = new Logger(LifecycleService.name);
	
  gameStartTime: number = Date.now();
  maxGameDuration = 60000;

  gameOver = false;
  gameOverPlayerId: string | null = null;
  gameOverReason: string | null = null;

  map: number[][] = [];
  dots: Dot[] = [];

  roomId: string;
  roomManager: any;

  constructor(
    private readonly ghostManager: GhostManagerService,
    private readonly playerService: PlayerService,
    private readonly botManager: BotManagerService,
		private readonly bossManager: BossManagerService,
  ) {}

	// 방 상태 초기화
  initialize(roomId: string) {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);

    this.dots = dots as Dot[];
    this.ghostManager.initialize(roomId, ghostSpawns);

    this.gameStartTime = Date.now();
    this.map = map;
    this.gameOver = false;
		this.gameOverPlayerId = null;
    this.gameOverReason = null;

    this.rooms[roomId] = {
      gameStartTime: this.gameStartTime,
      maxGameDuration: this.maxGameDuration,
      gameOver: this.gameOver,
      gameOverPlayerId: this.gameOverPlayerId,
      gameOverReason: this.gameOverReason,
      map: this.map,
      dots: this.dots,
    };
  }

	// 방 상태 가져오기
  private get(roomId: string): LifecycleState | undefined {
    return this.rooms[roomId];
  }

	// 맵 정보 가져오기
  getMap(roomId: string) {
    return this.rooms[roomId].map;
  }

	// 점 정보 가져오기
  getDots(roomId: string) {
    return this.rooms[roomId].dots;
  }

	// 게임 시간 체크
  isTimeOver(roomId: string): boolean {
		const state = this.get(roomId);
    if (!state) return false;
    const now = Date.now();
    return now - state.gameStartTime >= state.maxGameDuration;
  }

	// 점이 다 먹혔는지 체크
  allDotsEaten(roomId: string): boolean {
    const state = this.get(roomId);
    if (!state) return false;
    return state.dots.every((d) => d.eaten);
  }

	//‼️보스 테스트‼️
	// 게임 종료 체크
  isGameOver(roomId: string): boolean {
    const state = this.rooms[roomId];
    return state?.gameOver ?? false;
  }

  async triggerGameOver(roomId: string, reason: string) {
    if (!this.roomManager?.server) return;
  
    const state = this.rooms[roomId];
    if (!state || state.gameOver) {
      return; //이미 종료 처리
    }
    state.gameOver = true;
    state.gameOverReason = reason;
  
    this.sendGameOverEvent(roomId);
  
    // 여기서 매칭 서버에 알림
    try {
      const players = this.playerService.getPlayers(roomId);
      const userIds = players.map(p => p.googleSub); // ⚠️ userId = googleSub
  
      await axios.post(
        `${process.env.MATCHING_SERVER_URL}/internal/game-finished`,
        { userIds }
      );
  
      this.logger.log(
        `매칭 서버에 게임 종료 알림 완료: roomId=${roomId}, users=${userIds.join(',')}`,
      );
    } catch (err) {
      this.logger.error(
        `매칭 서버 게임 종료 알림 실패: roomId=${roomId}`,
        err,
      );
    }
  
    // Gateway에도 방 삭제 요청
    setTimeout(() => {
      if (process.env.MODE === 'DEV') {
        this.resetGame(roomId);
      } else {
        this.removeRoom(roomId);
      }
    }, 5000);
  }
  
	// 게임 종료 이벤트 전송
  sendGameOverEvent(roomId: string) {
		if (!this.roomManager?.server) return;

    const state = this.rooms[roomId];
    const reason = state?.gameOverReason ?? 'unknown';

    this.roomManager.server.to(roomId).emit('game-over', {
      players: this.playerService.getPlayers(roomId),
      botPlayers: this.botManager.getBots(roomId),
      reason: reason,
    });
  }


  // 방 삭제
  removeRoom(roomId: string) {
    delete this.rooms[roomId];
    this.playerService.clearRoom(roomId);
    this.botManager.resetBots(roomId);
    this.ghostManager.clearRoom(roomId);
		this.bossManager.removeBoss(roomId);

    this.logger.log(`게임룸 ${roomId} 이 삭제되었습니다.`);
  }

	// 게임 리셋
  resetGame(roomId: string) {
    const { map, dots, ghostSpawns } = parseMap(MAP_DESIGN);
		const state = this.rooms[roomId];
		if (!state) return;

    state.map = map;
    state.dots = dots as Dot[];

		// 플레이어 위치 초기화
    const spawnOffset = (TILE_SIZE - PLAYER_SIZE) / 2;

    for (const p of this.playerService.getPlayers(roomId)) {
      p.x = 1 * TILE_SIZE + spawnOffset;
      p.y = 1 * TILE_SIZE + spawnOffset;
      p.dir = { dx: 0, dy: 0 };
      p.score = 0;
    }

    this.ghostManager.initialize(roomId, ghostSpawns);
    this.botManager.resetBots(roomId);

    state.gameStartTime = Date.now();
    state.gameOver = false;
    state.gameOverReason = null;
  }
  
	// ‼️보스 테스트‼️
  // getState(roomId: string, players: Player[], bots: Bot[], ghosts: any[], boss?: { x: number; y: number } | null) {
	// 	const state = this.get(roomId);
  //   const now = Date.now();
  //   const remainingTime = Math.max(0, state.maxGameDuration - (now - state.gameStartTime));
  
  //   return {
  //     players: players.map(p => ({ ...p })),
  //     botPlayers: bots.map(b => ({ ...b })),
  //     dots: state.dots.map(d => ({ ...d })),
  //     ghosts: ghosts.map(g => ({ ...g })),
  //     gameOver: state.gameOver,
  //     gameOverPlayerId: state.gameOverPlayerId,
  //     gameOverReason: state.gameOverReason,
  //     remainingTime,
	// 		// ‼️보스 테스트‼️
	// 		boss: 
  //   };
  // }

	// 방 전체 상태 반환 (일반 + 보스 공통)
  getState(roomId: string) {
    const state = this.get(roomId);
    if (!state) {
      return {
        players: [],
        botPlayers: [],
        dots: [],
        ghosts: [],
        boss: null,
        gameOver: false,
        gameOverPlayerId: null,
        gameOverReason: 'room_not_found',
        remainingTime: 0,
      };
    }

    const now = Date.now();
    const remainingTime = Math.max(
      0,
      state.maxGameDuration - (now - state.gameStartTime),
    );

    return {
      players: this.playerService.getPlayers(roomId).map((p) => ({ ...p })),
      botPlayers: this.botManager.getBots(roomId).map((b) => ({ ...b })),
      dots: state.dots.map((d) => ({ ...d })),
      ghosts: Object.values(this.ghostManager.getGhosts(roomId)).map((g) => ({
        ...g,
      })),
			// 일반모드는 null, 보스모드는 실제 상태
      boss: this.bossManager.getBoss(roomId), 
      gameOver: state.gameOver,
      gameOverPlayerId: state.gameOverPlayerId,
      gameOverReason: state.gameOverReason,
      remainingTime,
    };
	}
}
