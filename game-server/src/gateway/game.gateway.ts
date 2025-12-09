/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

    room.removePlayer(client.id);

    // 방 전체에게 player 제거 브로드캐스트
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
      this.rooms[roomId] = new GameEngineService();
    }

    const room = this.rooms[roomId];

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.nickname = nickname;

    room.addPlayer(client.id, nickname);

    // 내 ID 전달
    client.emit('joined', { playerId: client.id, roomId });

    // 방 전체에 현재 상태 전달
    this.server.to(roomId).emit('state', room.getState());

    // 해당 room만 30FPS 업데이트
    if (!room.intervalRunning) {
      room.intervalRunning = true;

      setInterval(() => {
        room.update(); // ⭐ 게임 엔진 틱 돌리기
        this.server.to(roomId).emit('state', room.getState());
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
    room.handleInput(client.id, data.dir);
  }
}
