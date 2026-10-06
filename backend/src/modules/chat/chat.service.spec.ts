import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';

describe('ChatService.getOrCreateRoom', () => {
  const currentUserId = new Types.ObjectId().toString();
  const providerId = new Types.ObjectId().toString();
  const partnerUserId = new Types.ObjectId();

  const createService = (partnerId: Types.ObjectId = partnerUserId) => {
    const populatedRoom = {
      _id: new Types.ObjectId(),
      participants: [
        { _id: new Types.ObjectId(currentUserId), profile: { fullName: 'Current user' } },
        {
          _id: partnerId,
          profile: { fullName: 'Partner' },
          roles: ['PROVIDER'],
          defaultRole: 'PROVIDER',
        },
      ],
      lastMessageAt: new Date(),
    };
    const room = {
      populate: jest.fn().mockResolvedValue(populatedRoom),
    };

    const chatRoomModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(room) }),
      create: jest.fn(),
    };
    const chatMessageModel = {};
    const userModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ _id: partnerId }),
        }),
    };
    const providerModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ userId: partnerId }),
          }),
        }),
      }),
    };

    return {
      service: new ChatService(
        chatRoomModel as any,
        chatMessageModel as any,
        userModel as any,
        providerModel as any,
      ),
      chatRoomModel,
      userModel,
      providerModel,
    };
  };

  it('resolves a provider id to its owning user before opening the room', async () => {
    const { service, chatRoomModel, userModel, providerModel } = createService();

    const result = await service.getOrCreateRoom(currentUserId, providerId);

    expect(providerModel.findById).toHaveBeenCalledWith(providerId);
    expect(userModel.findById).toHaveBeenLastCalledWith(partnerUserId);
    expect(chatRoomModel.findOne).toHaveBeenCalledWith({
      participants: {
        $all: [new Types.ObjectId(currentUserId), partnerUserId],
      },
    });
    expect(result.otherParticipant?.id).toEqual(partnerUserId);
  });

  it('rejects selecting the provider owned by the current user', async () => {
    const { service } = createService(new Types.ObjectId(currentUserId));

    await expect(service.getOrCreateRoom(currentUserId, providerId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ChatService.getAvailablePartners', () => {
  it('excludes providers without users and users who already have a room', async () => {
    const currentUserId = new Types.ObjectId();
    const existingPartnerId = new Types.ObjectId();
    const availablePartnerId = new Types.ObjectId();
    const orphanPartnerId = new Types.ObjectId();

    const chatRoomModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { participants: [currentUserId, existingPartnerId] },
            ]),
          }),
        }),
      }),
    };
    const providerModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: new Types.ObjectId(),
                userId: existingPartnerId,
                businessName: 'Already chatting',
                capabilities: ['PHOTOGRAPHY'],
              },
              {
                _id: new Types.ObjectId(),
                userId: availablePartnerId,
                businessName: 'Available partner',
                capabilities: ['PHOTOGRAPHY'],
              },
              {
                _id: new Types.ObjectId(),
                userId: orphanPartnerId,
                businessName: 'Missing user',
                capabilities: ['PHOTOGRAPHY'],
              },
            ]),
          }),
        }),
      }),
    };
    const userModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: availablePartnerId,
                profile: { fullName: 'Available user', avatarUrl: null },
              },
            ]),
          }),
        }),
      }),
    };

    const service = new ChatService(
      chatRoomModel as any,
      {} as any,
      userModel as any,
      providerModel as any,
    );

    const result = await service.getAvailablePartners(currentUserId.toString());

    expect(result).toHaveLength(1);
    expect(result[0].userId).toEqual(availablePartnerId);
    expect(result[0].businessName).toBe('Available partner');
  });
});
