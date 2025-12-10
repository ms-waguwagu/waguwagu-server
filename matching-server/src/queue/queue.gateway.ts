import { OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { QueueService } from "./queue.service";
import { JwtService } from "@nestjs/jwt";

@WebSocketGateway({ namespace: 'queue', cors: { origin: '*' } })
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 핵심!! UserId와 SocketId를 연결하는 맵
  private connectedUsers: Map<string, string> = new Map();

  constructor(
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token?.split(' ')[1];
      if (!token) throw new Error('Token missing');
      
      const decoded = this.jwtService.verify(token);
      const userId = decoded.uuid; // 혹은 decoded.sub 등 토큰 구조에 맞게
      
      // 연결될 때 맵에 적어둠
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId; // 나중에 disconnect 때 쓰려고 저장

    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // 나갈 때도 맵에서 지움
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
    }
  }

  // ... (join_queue 등 기존 코드)

  // 워커가 호출할 함수: "이 사람들에게 매칭됐다고 알려줘!"
  broadcastMatchFound(userIds: string[]) {
    userIds.forEach((userId) => {
      const socketId = this.connectedUsers.get(userId);
      if (socketId) {
        // 그 사람에게만 콕 집어서 전송
        this.server.to(socketId).emit('match_found', {
          message: '매칭 성공! 잠시 후 게임이 시작됩니다.',
          participants: userIds // 필요하다면 보냄
        });
      }
    });
  }
}