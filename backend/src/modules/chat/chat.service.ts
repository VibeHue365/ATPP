import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getRooms(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const rooms = await this.chatRoomModel
      .find({ participants: userObjectId })
      .populate('participants', 'profile roles defaultRole auth.email')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'profile' },
      })
      .sort({ lastMessageAt: -1 })
      .exec();

    return rooms.map((room) => {
      const otherParticipant = room.participants.find(
        (p: any) => p._id.toString() !== userId,
      ) as any;

      return {
        id: room._id,
        otherParticipant: otherParticipant
          ? {
              id: otherParticipant._id,
              fullName: otherParticipant.profile?.fullName || 'Người dùng',
              avatarUrl: otherParticipant.profile?.avatarUrl || null,
              roles: otherParticipant.roles,
              defaultRole: otherParticipant.defaultRole,
            }
          : null,
        lastMessage: room.lastMessage
          ? {
              id: (room.lastMessage as any)._id,
              messageText: (room.lastMessage as any).messageText,
              senderId: (room.lastMessage as any).senderId?._id || (room.lastMessage as any).senderId,
              isRead: (room.lastMessage as any).isRead,
              createdAt: (room.lastMessage as any).createdAt,
            }
          : null,
        lastMessageAt: room.lastMessageAt,
      };
    });
  }

  async getMessages(roomId: string, limit: number = 50, skip: number = 0) {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('Invalid room id');
    }
    const messages = await this.chatMessageModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ createdAt: 1 }) // Order from oldest to newest for visual flow
      .skip(skip)
      .limit(limit)
      .exec();

    return messages;
  }

  async getOrCreateRoom(userId: string, otherUserId: string) {
    if (!Types.ObjectId.isValid(otherUserId)) {
      throw new BadRequestException('Invalid partner id');
    }

    const userObjectId = new Types.ObjectId(userId);
    const partnerObjectId = new Types.ObjectId(otherUserId);

    if (userId === otherUserId) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    // Check if partner exists
    const partner = await this.userModel.findById(partnerObjectId).exec();
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Find 1v1 room
    let room = await this.chatRoomModel
      .findOne({
        participants: { $all: [userObjectId, partnerObjectId] },
      })
      .exec();

    if (!room) {
      room = await this.chatRoomModel.create({
        participants: [userObjectId, partnerObjectId],
        lastMessage: null,
        lastMessageAt: new Date(),
      });
    }

    // Populate and return mapped room
    const populatedRoom = await room.populate('participants', 'profile roles defaultRole');
    const otherParticipant = populatedRoom.participants.find(
      (p: any) => p._id.toString() !== userId,
    ) as any;

    return {
      id: populatedRoom._id,
      otherParticipant: otherParticipant
        ? {
            id: otherParticipant._id,
            fullName: otherParticipant.profile?.fullName || 'Người dùng',
            avatarUrl: otherParticipant.profile?.avatarUrl || null,
            roles: otherParticipant.roles,
            defaultRole: otherParticipant.defaultRole,
          }
        : null,
      lastMessage: null,
      lastMessageAt: populatedRoom.lastMessageAt,
    };
  }

  async createMessage(roomId: string, senderId: string, messageText: string, attachments: string[] = []) {
    const message = await this.chatMessageModel.create({
      roomId: new Types.ObjectId(roomId),
      senderId: new Types.ObjectId(senderId),
      messageText,
      attachments,
      isRead: false,
      readBy: [new Types.ObjectId(senderId)],
    });

    await this.chatRoomModel.updateOne(
      { _id: new Types.ObjectId(roomId) },
      {
        $set: {
          lastMessage: message._id,
          lastMessageAt: new Date(),
        },
      },
    );

    return message;
  }

  async markRoomAsRead(roomId: string, userId: string) {
    const roomObjectId = new Types.ObjectId(roomId);
    const userObjectId = new Types.ObjectId(userId);

    await this.chatMessageModel.updateMany(
      {
        roomId: roomObjectId,
        senderId: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
      },
      {
        $set: { isRead: true },
        $addToSet: { readBy: userObjectId },
      },
    );
  }

  async getRoomParticipants(roomId: string): Promise<string[]> {
    const room = await this.chatRoomModel.findById(new Types.ObjectId(roomId)).exec();
    if (!room) return [];
    return room.participants.map((id) => id.toString());
  }
}
