import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatRoomDocument = HydratedDocument<ChatRoom>;

@Schema({ collection: 'chat_rooms', timestamps: true })
export class ChatRoom {
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    required: true,
    index: true,
  })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'ChatMessage', default: null })
  lastMessage?: Types.ObjectId | null;

  @Prop({ type: Date, default: null, index: true })
  lastMessageAt?: Date | null;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
