import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RateLimitService } from '../auth/services/rate-limit.service';

@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_URL || '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map to store online users: userId -> array of socketIds
  private readonly activeConnections = new Map<string, string[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (Socket ID: ${client.id})`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      (client as any).user = payload; // Attach user payload to socket client

      const userId = payload.sub || payload.id;
      if (!userId) {
        this.logger.warn(`Connection rejected: Sub/Id missing in token payload (Socket ID: ${client.id})`);
        client.disconnect();
        return;
      }

      const userSockets = this.activeConnections.get(userId) || [];
      userSockets.push(client.id);
      this.activeConnections.set(userId, userSockets);

      this.logger.log(
        `User connected: ${userId} (Socket ID: ${client.id}). Total online users: ${this.activeConnections.size}`,
      );

      client.emit('authenticated', { userId });
    } catch (error) {
      this.logger.error(
        `Connection rejected: Authentication failed (Socket ID: ${client.id}). Error: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const payload = (client as any).user;
    if (payload) {
      const userId = payload.sub || payload.id;
      if (userId) {
        const userSockets = this.activeConnections.get(userId) || [];
        const updatedSockets = userSockets.filter((id) => id !== client.id);
        if (updatedSockets.length > 0) {
          this.activeConnections.set(userId, updatedSockets);
        } else {
          this.activeConnections.delete(userId);
        }
        this.logger.log(
          `User disconnected: ${userId} (Socket ID: ${client.id}). Total online users: ${this.activeConnections.size}`,
        );
      }
    } else {
      this.logger.log(`Unauthenticated socket disconnected (Socket ID: ${client.id})`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: any): string {
    this.logger.log(`Received 'ping' from client: ${client.id}. Data: ${JSON.stringify(data)}`);
    client.emit('pong', { message: 'pong', timestamp: new Date().toISOString() });
    return 'pong';
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = (client as any).user;
    if (!user) return { error: 'Unauthorized' };
    const userId = user.sub || user.id;

    try {
      await this.chatService.assertUserInRoom(data.roomId, userId, user.roles);
      client.join(`room:${data.roomId}`);
      this.logger.log(`Socket ${client.id} (user ${userId}) joined room:${data.roomId}`);
      return { status: 'joined', roomId: data.roomId };
    } catch {
      this.logger.warn(`Unauthorized join_room attempt by user ${userId} to room:${data?.roomId}`);
      client.emit('error', {
        code: 'UNAUTHORIZED_ROOM',
        message: 'Bạn không có quyền tham gia cuộc trò chuyện này',
      });
      return { error: 'Forbidden' };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; messageText: string; attachments?: string[] },
  ) {
    const user = (client as any).user;
    if (!user) {
      this.logger.warn(`SendMessage rejected: Unauthenticated socket (Socket ID: ${client.id})`);
      return;
    }
    const userId = user.sub || user.id;
    const { roomId, messageText, attachments = [] } = data;

    try {
      await this.rateLimitService.assertRateLimit(`chat_ws_${userId}`, 30, 60);
      const message = await this.chatService.createMessage(
        roomId,
        userId,
        messageText,
        attachments,
      );

      // Broadcast the message to all authorized users in the socket room
      this.server.to(`room:${roomId}`).emit('new_message', message);

      // Notify room participants
      const participants = await this.chatService.getRoomParticipants(roomId);
      participants.forEach((pId) => {
        const userSockets = this.activeConnections.get(pId) || [];
        userSockets.forEach((socketId) => {
          this.server.to(socketId).emit('room_update', { roomId, message });
        });
      });
    } catch (err: any) {
      client.emit('error', {
        message: err?.message || 'Không thể gửi tin nhắn',
      });
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = (client as any).user;
    if (!user) return;
    const userId = user.sub || user.id;

    try {
      await this.chatService.markRoomAsRead(data.roomId, userId);
      this.server
        .to(`room:${data.roomId}`)
        .emit('messages_read', { roomId: data.roomId, userId });
    } catch {
      // Ignore unauthorized mark_read
    }
  }

  getActiveConnections(): Map<string, string[]> {
    return this.activeConnections;
  }
}
