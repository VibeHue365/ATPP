import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { ChatService } from './chat.service';

type Row = Record<string, any>;

const userId = new Types.ObjectId();
const partnerId = new Types.ObjectId();
const roomId = new Types.ObjectId();

function query(result: unknown) {
  const q: Row = {};
  for (const method of ['populate', 'sort', 'skip', 'limit'])
    q[method] = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(result);
  return q;
}

function createChat(room: Row | null = { participants: [userId, partnerId] }) {
  const roomModel = {
    findById: jest.fn().mockReturnValue(query(room)),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const messageModel = {
    create: jest.fn(async (data: Row) => ({
      _id: new Types.ObjectId(),
      ...data,
    })),
    find: jest.fn().mockReturnValue(query([])),
    updateMany: jest.fn().mockResolvedValue(undefined),
  };
  const userModel = {
    findById: jest.fn().mockReturnValue(query({ _id: partnerId })),
  };
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

describe('UC-58 Send Message (DatTT)', () => {
  const send = (
    service: ChatService,
    text: string,
    attachments: string[] = [],
    sender = userId.toString(),
  ) => service.createMessage(roomId.toString(), sender, text, attachments);

  it('UT-58 UTCID05 rejects an empty message without attachments', async () => {
    const { service, messageModel } = createChat();

    await expect(send(service, '   ')).rejects.toThrow(
      new BadRequestException('Nội dung tin nhắn không được để trống.'),
    );
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('UT-58 UTCID06 accepts 2000 characters and rejects 2001 characters', async () => {
    const { service } = createChat();

    await expect(send(service, 'a'.repeat(2000))).resolves.toBeDefined();
    await expect(send(service, 'a'.repeat(2001))).rejects.toThrow(
      new BadRequestException(
        'Nội dung tin nhắn vượt quá giới hạn 2000 ký tự.',
      ),
    );
  });

  it('UT-58 UTCID07 accepts 5 attachments and rejects 6 attachments', async () => {
    const { service } = createChat();
    const files = (n: number) =>
      Array.from({ length: n }, (_, i) => `f${i}.jpg`);

    await expect(send(service, '', files(5))).resolves.toBeDefined();
    await expect(send(service, '', files(6))).rejects.toThrow(
      new BadRequestException('Mỗi tin nhắn chỉ được đính kèm tối đa 5 tệp.'),
    );
  });

  it('UT-58 UTCID08 trims the message and marks it read by the sender', async () => {
    const { service, messageModel } = createChat();

    await send(service, '  Xin chào shop  ');

    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messageText: 'Xin chào shop',
        isRead: false,
        readBy: [userId],
      }),
    );
  });

  it('UT-58 UTCID09 forbids a user outside the conversation from sending', async () => {
    const { service, messageModel } = createChat();

    await expect(
      send(service, 'Hi', [], new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('UT-58 UTCID10 returns not found for a deleted conversation', async () => {
    const { service } = createChat(null);

    await expect(send(service, 'Hi')).rejects.toThrow(
      new NotFoundException('Không tìm thấy cuộc trò chuyện này'),
    );
  });

  it('UT-58 UTCID11 rejects a malformed room id', async () => {
    const { service, roomModel } = createChat();

    await expect(
      service.createMessage('room-1', userId.toString(), 'Hi'),
    ).rejects.toThrow(new BadRequestException('ID phòng chat không hợp lệ'));
    expect(roomModel.findById).not.toHaveBeenCalled();
  });
});

describe('UC-59 Manage Conversations (DatTT)', () => {
  it('UT-59 UTCID03 reuses the existing one-to-one room', async () => {
    const existing = {
      _id: roomId,
      lastMessageAt: new Date(),
      populate: jest.fn().mockResolvedValue({
        _id: roomId,
        participants: [
          { _id: userId },
          { _id: partnerId, profile: { fullName: 'Shop' } },
        ],
        lastMessageAt: new Date(),
      }),
    };
    const { service, roomModel } = createChat();
    roomModel.findOne.mockReturnValue(query(existing));

    const result = await service.getOrCreateRoom(
      userId.toString(),
      partnerId.toString(),
    );

    expect(roomModel.create).not.toHaveBeenCalled();
    expect(result.otherParticipant).toMatchObject({
      id: partnerId,
      fullName: 'Shop',
    });
  });

  it('UT-59 UTCID04 lists rooms by latest activity with the other participant and last message', async () => {
    const { service, roomModel } = createChat();
    const rooms = [
      {
        _id: roomId,
        participants: [
          { _id: userId },
          { _id: partnerId, profile: {}, roles: ['PROVIDER'] },
        ],
        lastMessage: {
          _id: new Types.ObjectId(),
          messageText: 'Còn áo không?',
          senderId: { _id: partnerId },
          isRead: false,
        },
        lastMessageAt: new Date(),
      },
    ];
    const q = query(rooms);
    roomModel.find.mockReturnValue(q);

    const [room] = await service.getRooms(userId.toString());

    expect(q.sort).toHaveBeenCalledWith({ lastMessageAt: -1 });
    expect(room.otherParticipant).toMatchObject({
      id: partnerId,
      fullName: 'Người dùng',
      roles: ['PROVIDER'],
    });
    expect(room.lastMessage).toMatchObject({
      messageText: 'Còn áo không?',
      senderId: partnerId,
      isRead: false,
    });
  });

  it('UT-59 UTCID05 pages messages from oldest to newest', async () => {
    const { service, messageModel } = createChat();
    const q = query([]);
    messageModel.find.mockReturnValue(q);

    await service.getMessages(roomId.toString(), userId.toString(), [], 20, 40);

    expect(q.sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(q.skip).toHaveBeenCalledWith(40);
    expect(q.limit).toHaveBeenCalledWith(20);
  });

  it('UT-59 UTCID06 lets an administrator read a conversation without being a participant', async () => {
    const { service } = createChat();

    await expect(
      service.getMessages(roomId.toString(), new Types.ObjectId().toString(), [
        'admin',
      ]),
    ).resolves.toEqual([]);
  });

  it('UT-59 UTCID07 forbids a non-participant from marking messages as read', async () => {
    const { service, messageModel } = createChat();

    await expect(
      service.markRoomAsRead(
        roomId.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageModel.updateMany).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ Notifications
function createNotifications(
  user: Row | null = { auth: { email: 'lan@example.com' } },
  sockets: string[] = [],
) {
  const saved: Row = { _id: new Types.ObjectId() };
  const NotificationModel: any = jest
    .fn()
    .mockImplementation((data: Row) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...saved, ...data }),
    }));
  NotificationModel.findOneAndUpdate = jest
    .fn()
    .mockReturnValue({ exec: () => Promise.resolve(null) });
  NotificationModel.updateMany = jest
    .fn()
    .mockReturnValue({ exec: () => Promise.resolve({ modifiedCount: 3 }) });
  const userModel = { findById: jest.fn().mockResolvedValue(user) };
  const mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
  const emit = jest.fn();
  const chatGateway = {
    server: { to: jest.fn().mockReturnValue({ emit }) },
    getActiveConnections: () => new Map([[userId.toString(), sockets]]),
  };
  const service = new NotificationsService(
    NotificationModel,
    userModel as any,
    mailService as any,
    chatGateway as any,
  );
  return { service, NotificationModel, mailService, chatGateway, emit };
}

describe('UC-57 View Notifications (DatTT)', () => {
  it('UT-57 UTCID06 does not mark a notification of another user as read', async () => {
    const { service, NotificationModel } = createNotifications();
    const notificationId = new Types.ObjectId();

    await expect(
      service.markAsRead(notificationId.toString(), userId.toString()),
    ).resolves.toBeNull();
    expect(NotificationModel.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: notificationId,
      userId,
    });
  });

  it('UT-57 UTCID07 marks only the unread notifications of the user as read', async () => {
    const { service, NotificationModel } = createNotifications();

    await expect(service.markAllAsRead(userId.toString())).resolves.toEqual({
      modifiedCount: 3,
    });
    expect(NotificationModel.updateMany.mock.calls[0][0]).toEqual({
      userId,
      isRead: false,
    });
  });

  it('UT-57 UTCID08 saves the notification without email when the user has no email', async () => {
    const { service, mailService } = createNotifications({ auth: {} });

    await expect(
      service.createNotification(
        userId.toString(),
        'Đơn hàng',
        'Đã xác nhận',
        NotificationType.Booking,
      ),
    ).resolves.toMatchObject({ title: 'Đơn hàng', isRead: false });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('UT-57 UTCID09 delivers a new notification to every active socket of the user', async () => {
    const { service, chatGateway, emit } = createNotifications(null, [
      'socket-a',
      'socket-b',
    ]);

    await service.createNotification(
      userId.toString(),
      'Tin mới',
      'Bạn có tin nhắn',
      NotificationType.System,
    );

    expect(
      chatGateway.server.to.mock.calls.map(([id]: [string]) => id),
    ).toEqual(['socket-a', 'socket-b']);
    expect(emit).toHaveBeenCalledWith(
      'new_notification',
      expect.objectContaining({ title: 'Tin mới' }),
    );
  });

  it('UT-57 UTCID10 rejects a malformed notification id', async () => {
    const { service, NotificationModel } = createNotifications();

    await expect(
      service.markAsRead('notification-1', userId.toString()),
    ).rejects.toThrow();
    expect(NotificationModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Known defect UT-DEF-57-01: notification title and content are inserted into the email HTML without escaping.
  it.failing(
    'UT-57 UTCID11 escapes user-provided text in the notification email',
    async () => {
      const { service, mailService } = createNotifications();

      await service.createNotification(
        userId.toString(),
        'Đơn hàng đã hủy',
        'Lý do: <a href="https://evil.test">Nhận hoàn tiền</a>',
        NotificationType.Booking,
      );

      expect(mailService.sendMail.mock.calls[0][2]).not.toContain(
        '<a href="https://evil.test">',
      );
    },
  );
});
