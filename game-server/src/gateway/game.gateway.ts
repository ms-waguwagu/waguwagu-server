/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from '../engine/game-engine.service';
import { RankingService } from '../ranking/ranking.service';
import { PlayerService } from 'src/engine/player/player.service';
import { GhostManagerService } from 'src/engine/ghost/ghost-manager.service';
import { BotManagerService } from 'src/engine/bot/bot-manager.service';
import { CollisionService } from 'src/engine/core/collision.service';
import { LifecycleService } from 'src/engine/core/lifecycle.service';
import { GameLoopService } from 'src/engine/core/game-loop.service';
import { Logger } from '@nestjs/common';
import { BossManagerService } from '../boss/boss-manager.service';

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: '*' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // roomId → GameEngineService instance
  private rooms: Record<string, GameEngineService> = {};

  constructor(
    private rankingService: RankingService,
    private ghostManagerService: GhostManagerService,
    private playerService: PlayerService,
    private botManagerService: BotManagerService,
    private collisionService: CollisionService,
    private lifecycleService: LifecycleService,
    private gameLoopService: GameLoopService,
		private bossManagerService: BossManagerService,
  ) {}

	// ‼️추후 보스모드에 대기열 추가할 때에는 없어도 됨(OnGatewayInit)‼️
  afterInit(server: Server) {
    this.lifecycleService.roomManager = this;
  }

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);

    const roomId = client.data.roomId;
    if (!roomId) return;

    const room = this.rooms[roomId];
    if (!room) return;

    // 플레이어 제거
    room.removePlayer(client.id);
    client.leave(roomId);

    // 플레이어가 아무도 없으면 방 삭제
    if (room.playerCount() === 0) {
      this.logger.log(`게임 룸(${roomId}) 이 비어있으므로 삭제`);

      room.stopInterval(); // interval 정지
      delete this.rooms[roomId]; // 완전 삭제
      return;
    }

    // 남아있는 플레이어들에게 상태 전송
    this.server.to(roomId).emit('state', room.getState());
  }

	// 방 조회 메서드
	getRoom(roomId: string): GameEngineService | undefined {
    return this.rooms[roomId];
  }

  // 방 삭제 메서드
  removeRoom(roomId: string) {
    const room = this.rooms[roomId];
    if (!room) return;

    this.logger.log(`게임 룸 삭제: ${roomId}`);
    // interval 정지
    room.stopInterval();
		
    this.ghostManagerService.clearRoom(roomId);
    this.playerService.clearRoom(roomId);
    this.botManagerService.resetBots(roomId);

    // 모든 클라이언트 연결 끊기
    this.server.in(roomId).disconnectSockets();

    // 방 삭제
    delete this.rooms[roomId];
  }

  // ============================
  // 1) 클라이언트가 방 입장 요청
  // ============================

  // 컨트롤러에서 호출할 방 생성 메서드
  createRoomByApi(roomId: string): boolean {
    if (this.rooms[roomId]) {
      console.log(`⚠️ Room ${roomId} already exists.`);
      return false;
    }

    const engine = new GameEngineService(
      this.ghostManagerService,
      this.playerService,
      this.botManagerService,
      this.collisionService,
      this.lifecycleService,
      this.gameLoopService,
			//‼️보스매니저 추가‼️
			this.bossManagerService,
    );

    engine.roomId = roomId;
    engine.roomManager = this;

		// 초기화
		this.lifecycleService.initialize(roomId);

    this.rooms[roomId] = engine;
    console.log(`[Gateway] 룸 (roomId:${roomId}) 생성됨.`);
    return true;
  }

  // ============================
  // 1) 클라이언트가 방 입장 요청
  // ============================
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, data: { roomId: string; userId: string; nickname: string, mode?: 'NORMAL' | 'BOSS' }) {
    const { roomId, nickname, userId, mode } = data;
		const gameMode = mode ?? 'NORMAL';

    console.log(`Google Client ${userId} joining room ${roomId}`);
    console.log('현재 생성된 rooms:', Object.keys(this.rooms));

    // 방 객체 없으면 생성
    if (!this.rooms[roomId]) {
      const engine = new GameEngineService(
        this.ghostManagerService,
        this.playerService,
        this.botManagerService,
        this.collisionService,
        this.lifecycleService,
        this.gameLoopService,
				this.bossManagerService,
      );

      // 👇 중요! roomId와 roomManager 설정
      engine.roomId = roomId;
      engine.roomManager = this; // GameGateway를 roomManager로 설정

      this.rooms[roomId] = engine;

      // 일반모드에서는 필요 없음
			// 보스모드에서는 방을 미리 생성하지 않고 클라이언트가 입장할 때 생성
			// -> initialize 필요
      this.lifecycleService.initialize(roomId);
    }

    const room = this.rooms[roomId];

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;

		// 유저만 추가
    room.addPlayer(client.id, userId, nickname);

    const humanPlayers = room.playerCount();
    const botPlayers = room.getBotCount();
    const totalPlayers = humanPlayers + botPlayers;


    // 내 ID 전달
    // 맵 데이터를 포함한 초기 정보를 전송
    client.emit('init-game', {
      playerId: client.id,
      roomId: roomId,
      mapData: room.getMapData(), // 맵 데이터(벽, 크기) 전송
      initialState: room.getState(), // 현재 점, 플레이어 위치
    });

    // 방 전체에 현재 상태 전달
    this.server.to(roomId).emit('state', room.getState());

		if (room.isBossMode()) {
    	// 보스 모드는 첫 유저 들어오면 바로 시작
    	console.log(`🎬 Room ${roomId} → 보스 모드 시작`);
    	if (!room.intervalRunning) {
      	room.startBossMode();
    	}
  	} else {
    	// 일반 모드는 5명 모이면 카운트다운 후 시작
    	if (totalPlayers === 5) {
				console.log(`🎬 Room ${roomId} → 카운트다운 시작`);
      	this.startCountdown(roomId);
    	}
   	}
  }

  private startCountdown(roomId: string) {
    let count = 3;

    const interval = setInterval(() => {
      this.server.to(roomId).emit('countdown', { count });
      count--;

      if (count < 0) {
        clearInterval(interval);
        this.server.to(roomId).emit('countdown', { count: 0 });

        // 카운트다운 완료 → 게임 시작
        this.startGameLoop(roomId);
      }
    }, 1000);
  }

	// 게임엔진으로 옮기기
  private startGameLoop(roomId: string) {
    const room = this.rooms[roomId];
    if (!room) return;

    if (room.intervalRunning) return;

    room.intervalRunning = true;

    room.interval = setInterval(() => {
      room.update();
      this.server.to(roomId).emit('state', room.getState());

      if (room.gameOver) {
        const finalScores = room.getAllPlayerScores();
        finalScores.forEach((score) => {
          this.rankingService.saveScore(
            score.playerId,
            score.nickname,
            score.score,
          );
        });

        if (room.interval) {
          clearInterval(room.interval);
          room.interval = null;
          room.intervalRunning = false;
        }
      }
    }, 1000 / 30);
  }

  // ============================
  // 2) 이동 입력 처리
  // ============================
  @SubscribeMessage('input')
  handleInput(client: Socket, data: { dir: { dx: number; dy: number } }) {
    const roomId = client.data.roomId;
    if (!roomId) return;

    const room = this.rooms[roomId];
    if (!room) return;

    room.handleInput(client.id, data.dir);
  }

  // ============================
  // 3) 클라이언트가 게임 리셋 요청 (옵션)
  // ============================
  @SubscribeMessage('reset')
  handleReset(client: Socket, data: { roomId: string }) {
    const roomId = data.roomId;
    const room = this.rooms[roomId];
    if (!room) return;

    room.resetGame();

    // 리셋 후 카운트다운
    this.startCountdown(roomId);

    this.server.to(roomId).emit('state', room.getState());
  }

	// ============================
	// 4) ‼️보스 테스트‼️
	// ============================
	createBossDebugRoom(roomState: any) {
		const roomId = roomState.id;
    if (this.rooms[roomId]) return;
		

    // 기존 방 생성 로직 재사용
    const engine = new GameEngineService(
      this.ghostManagerService,
      this.playerService,
      this.botManagerService,
      this.collisionService,
      this.lifecycleService,
      this.gameLoopService,
			this.bossManagerService,
    );


    engine.roomId = roomId;
    engine.roomManager = this;

		engine.setMode('BOSS');

		// 초기화
		this.lifecycleService.initialize(roomId);

		
  // ‼️보스 스폰
  if (roomState.boss) {
    this.bossManagerService.spawnBoss(roomId, {
      x: roomState.boss.x,
      y: roomState.boss.y,
			// ‼️필요하면 phase, speed도 여기서 튜닝 가능‼️
    });
  }

    this.rooms[roomId] = engine;

		// 보스 모드 전용 루프 시작
		engine.startBossMode();

    this.logger.log(`[Boss Debug] 룸 생성됨: ${roomId}`);
  }
}
