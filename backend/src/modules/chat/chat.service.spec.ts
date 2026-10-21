/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const userId = new Types.ObjectId();
  const partnerId = new Types.ObjectId();
  const roomId = new Types.ObjectId();

  function query<T>(result: T) {
    return {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(result),
    };
  }

  function create() {
    const roomModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
    };
    const messageModel = {
      find: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    };
    const userModel = { findById: jest.fn() };
    return {
      service: new ChatService(
        roomModel as never,
        messageModel as never,
        userModel as never,
      ),
      roomModel,
      messageModel,
      userModel,
    };
  }

  it('validates room and partner identifiers', async () => {
    const { service } = create();
    await expect(service.getMessages('invalid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.getOrCreateRoom(userId.toString(), 'invalid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getOrCreateRoom(userId.toString(), userId.toString()),
    ).rejects.toThrow('Cannot chat with yourself');
  });

  it('rejects a missing chat partner', async () => {
    const { service, userModel } = create();
    userModel.findById.mockReturnValue(query(null));
    await expect(
      service.getOrCreateRoom(userId.toString(), partnerId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates and maps a new one-to-one room', async () => {
    const { service, roomModel, userModel } = create();
    userModel.findById.mockReturnValue(query({ _id: partnerId }));
    roomModel.findOne.mockReturnValue(query(null));
    roomModel.create.mockResolvedValue({
      _id: roomId,
      lastMessageAt: new Date('2026-09-28T00:00:00Z'),
      populate: jest.fn().mockResolvedValue({
        _id: roomId,
        participants: [
          { _id: userId, profile: { fullName: 'Customer' } },
          {
            _id: partnerId,
            profile: { fullName: 'Provider' },
            roles: ['PROVIDER'],
          },
        ],
        lastMessageAt: new Date('2026-09-28T00:00:00Z'),
      }),
    });
    await expect(
      service.getOrCreateRoom(userId.toString(), partnerId.toString()),
    ).resolves.toMatchObject({
      id: roomId,
      otherParticipant: { id: partnerId, fullName: 'Provider' },
    });
    expect(roomModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ participants: [userId, partnerId] }),
    );
  });

  it('creates a message and updates room activity', async () => {
    const { service, roomModel, messageModel } = create();
    const messageId = new Types.ObjectId();
    messageModel.create.mockResolvedValue({ _id: messageId });
    await service.createMessage(
      roomId.toString(),
      userId.toString(),
      'Xin chào',
      ['photo.jpg'],
    );
    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId,
        senderId: userId,
        messageText: 'Xin chào',
        attachments: ['photo.jpg'],
        isRead: false,
      }),
    );
    expect(roomModel.updateOne).toHaveBeenCalledWith(
      { _id: roomId },
      expect.objectContaining({
        $set: expect.objectContaining({ lastMessage: messageId }),
      }),
    );
  });

  it('marks only other users messages as read', async () => {
    const { service, messageModel } = create();
    await service.markRoomAsRead(roomId.toString(), userId.toString());
    expect(messageModel.updateMany).toHaveBeenCalledWith(
      { roomId, senderId: { $ne: userId }, readBy: { $ne: userId } },
      { $set: { isRead: true }, $addToSet: { readBy: userId } },
    );
  });

  it('returns no participants for a deleted room', async () => {
    const { service, roomModel } = create();
    roomModel.findById.mockReturnValue(query(null));
    await expect(
      service.getRoomParticipants(roomId.toString()),
    ).resolves.toEqual([]);
  });
});
