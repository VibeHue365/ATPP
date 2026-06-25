import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatRoom, ChatRoomSchema } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';

export const chatModels = MongooseModule.forFeature([
  { name: ChatRoom.name, schema: ChatRoomSchema },
  { name: ChatMessage.name, schema: ChatMessageSchema },
]);

@Module({
  imports: [chatModels],
  exports: [chatModels],
})
export class ChatModule {}
