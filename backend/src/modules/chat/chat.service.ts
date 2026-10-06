import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { User } from '../users/schemas/user.schema';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
} from '../providers/schemas/provider.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
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

    const roomIds = rooms.map((room) => room._id);
    const unreadRows = roomIds.length
      ? await this.chatMessageModel.aggregate<{ _id: Types.ObjectId; count: number }>([
          {
            $match: {
              roomId: { $in: roomIds },
              senderId: { $ne: userObjectId },
              readBy: { $ne: userObjectId },
            },
          },
          { $group: { _id: '$roomId', count: { $sum: 1 } } },
        ])
      : [];
    const unreadByRoom = new Map(
      unreadRows.map((row) => [row._id.toString(), row.count]),
    );

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
        unreadCount: unreadByRoom.get(room._id.toString()) || 0,
      };
    });
  }

  async getAvailablePartners(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const existingRooms = await this.chatRoomModel
      .find({ participants: userObjectId })
      .select('participants')
      .lean()
      .exec();

    const excludedUserIds = new Set<string>([userId]);
    for (const room of existingRooms) {
      for (const participantId of room.participants) {
        excludedUserIds.add(participantId.toString());
      }
    }

    const providers = await this.providerModel
      .find({
        status: ProviderStatus.Active,
        capabilities: ProviderCapability.Photography,
      })
      .select('_id userId businessName capabilities media portfolio')
      .lean()
      .exec();

    const candidateUserIds = providers
      .map((provider) => provider.userId)
      .filter(
        (partnerUserId): partnerUserId is Types.ObjectId =>
          Boolean(partnerUserId) && !excludedUserIds.has(partnerUserId.toString()),
      );

    if (candidateUserIds.length === 0) return [];

    const users = await this.userModel
      .find({ _id: { $in: candidateUserIds } })
      .select('_id profile.fullName profile.avatarUrl')
      .lean()
      .exec();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    return providers.flatMap((provider) => {
      const partnerUserId = provider.userId?.toString();
      if (!partnerUserId || excludedUserIds.has(partnerUserId)) return [];

      const partnerUser = usersById.get(partnerUserId);
      if (!partnerUser) return [];

      const media = provider.media as
        | { logoUrl?: string | null; coverUrl?: string | null; images?: string[] }
        | undefined;
      const legacyPortfolio = (provider as any).portfolio as string[] | undefined;

      return [{
        _id: provider._id,
        userId: partnerUser._id,
        businessName:
          provider.businessName || partnerUser.profile?.fullName || 'Đối tác',
        capabilities: provider.capabilities || [],
        avatarUrl:
          partnerUser.profile?.avatarUrl ||
          media?.logoUrl ||
          media?.coverUrl ||
          media?.images?.[0] ||
          legacyPortfolio?.[0] ||
          null,
      }];
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
    let partner = await this.userModel.findById(otherUserId).exec();
    if (!partner) {
      const provider = await this.providerModel
        .findById(otherUserId)
        .select('userId')
        .lean()
        .exec();
      if (provider?.userId) {
        partner = await this.userModel.findById(provider.userId).exec();
      }
    }
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    const partnerObjectId = partner._id;
    if (userObjectId.equals(partnerObjectId)) {
      throw new BadRequestException('Cannot chat with yourself');
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
