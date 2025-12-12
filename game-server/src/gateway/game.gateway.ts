/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from '../engine/game-engine.service';
import { RankingService } from '../ranking/ranking.service';
import { PlayerService } from 'src/engine/player/player.service';
import { GhostManagerService } from 'src/engine/ghost/ghost-manager.service';
import { BotManagerService } from 'src/engine/bot/bot-manager.service';
import { CollisionService } from 'src/engine/core/collision.service';
import { LifecycleService } from 'src/engine/core/lifecycle.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: '*' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
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
  ) {}

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
      // console.log(`🧹 Room ${roomId} is now empty → deleting room`);
      this.logger.log(`게임 룸(${roomId}) 이 비어있으므로 삭제`);

      room.stopInterval(); // interval 정지
      delete this.rooms[roomId]; // 완전 삭제
      return;
    }

    // 남아있는 플레이어들에게 상태 전송
    this.server.to(roomId).emit('state', room.getState());
  }

  // 방 삭제 메서드
  removeRoom(roomId: string) {
    const room = this.rooms[roomId];
    if (!room) return;

    // console.log(`🔥 방 삭제: ${roomId}`);
    this.logger.log(`게임 룸 삭제: ${roomId}`);
    // interval 정지
    room.stopInterval();

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
    );

    engine.roomId = roomId;
    engine.roomManager = this;

    // 유령 추가 등 초기화
    engine.addGhost('g1');
    engine.addGhost('g2');
    engine.addGhost('g3');

    this.rooms[roomId] = engine;
    console.log(`[Gateway] 룸 (roomId:${roomId}) 생성됨.`);
    return true;
  }

  // ============================
  // 1) 클라이언트가 방 입장 요청
  // ============================
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, data: { roomId: string; nickname: string }) {
    const { roomId, nickname } = data;

    console.log(`Client ${client.id} joining room ${roomId}`);
    console.log('현재 생성된 rooms:', Object.keys(this.rooms));

    // 방 객체 없으면 생성
    if (!this.rooms[roomId]) {
      const engine = new GameEngineService(
        this.ghostManagerService,
        this.playerService,
        this.botManagerService,
        this.collisionService,
        this.lifecycleService,
      );

      // 👇 중요! roomId와 roomManager 설정
      engine.roomId = roomId;
      engine.roomManager = this; // GameGateway를 roomManager로 설정

      // 기본으로 유령 3마리 추가
      engine.addGhost('g1');
      engine.addGhost('g2');
      engine.addGhost('g3');

      this.rooms[roomId] = engine;
    }

    const room = this.rooms[roomId];

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;

    room.addPlayer(client.id, nickname);

    const MIN_PLAYERS = 5;

    const humanPlayers = room.playerCount();
    const botPlayers = room.getBotCount();
    const totalPlayers = humanPlayers + botPlayers;

    const botsToAdd = MIN_PLAYERS - totalPlayers - 1;

    for (let i = 0; i < botsToAdd; i++) {
      // 5명 - 플레이어 수 계산해서 봇 투입
      const botNumber = room.getNextBotNumber();
      const botName = `bot-${botNumber}`;
      room.addBotPlayer(botName);
      console.log(`🤖 CPU BOT 추가됨: ${botName}`);
    }

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

    // 해당 room만 30FPS 업데이트
    if (!room.intervalRunning) {
      room.intervalRunning = true;

      // 저장해두면 나중에 clearInterval 가능
      room.interval = setInterval(() => {
        room.update();

        // 브로드캐스트 상태 (게임오버 여부 포함)
        this.server.to(roomId).emit('state', room.getState());

        // 추가: 게임오버 발생하면 interval 정지(옵션)
        if (room.gameOver) {
          const finalScores = room.getAllPlayerScores();
          finalScores.forEach((score) => {
            this.rankingService.saveScore(
              score.playerId,
              score.nickname,
              score.score,
            );
          });
          console.log('💾 게임 종료 - 전체 점수 저장 완료:', finalScores);
          // 게임오버를 모든 클라이언트에 알린 뒤 interval 정지
          // (원하면 재시작 로직을 프론트에서 호출하게 설계)
          if (room.interval) {
            clearInterval(room.interval);
            room.interval = null;
            room.intervalRunning = false;
            console.log(`Room ${roomId} interval stopped due to gameOver`);
          }
        }
      }, 1000 / 30);
    }
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

    // 만약 interval이 멈췄다면 재시작
    if (!room.intervalRunning) {
      room.intervalRunning = true;
      room.interval = setInterval(() => {
        room.update();
        this.server.to(roomId).emit('state', room.getState());

        if (room.gameOver) {
          if (room.interval) {
            clearInterval(room.interval);
            room.interval = null;
            room.intervalRunning = false;
          }
        }
      }, 1000 / 30);
    }

    this.server.to(roomId).emit('state', room.getState());
  }
}
