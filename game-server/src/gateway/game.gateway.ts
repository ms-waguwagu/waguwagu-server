import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from '../engine/game-engine.service';

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: '*' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // roomId → GameEngineService instance
  private rooms: Record<string, GameEngineService> = {};

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
      console.log(`🧹 Room ${roomId} is now empty → deleting room`);

      room.stopInterval(); // interval 정지
      delete this.rooms[roomId]; // 완전 삭제
      return;
    }

    // 남아있는 플레이어들에게 상태 전송
    this.server.to(roomId).emit('state', room.getState());
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
      const engine = new GameEngineService();

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

    // 내 ID 전달
		// 맵 데이터를 포함한 초기 정보를 전송
		client.emit('init-game', {
      playerId: client.id,
      roomId: roomId,
      mapData: room.getMapData(), // 맵 데이터(벽, 크기) 전송
      initialState: room.getState() // 현재 점, 플레이어 위치
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
