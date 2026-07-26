import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatRoom, ChatRoomSchema } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { CloudinaryService } from './cloudinary.service';

export const chatModels = MongooseModule.forFeature([
  { name: ChatRoom.name, schema: ChatRoomSchema },
  { name: ChatMessage.name, schema: ChatMessageSchema },
]);

@Module({
  imports: [chatModels, AuthModule, UsersModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, CloudinaryService],
  exports: [chatModels, ChatGateway, ChatService, CloudinaryService],
})
export class ChatModule {}
