/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Types } from 'mongoose';
import { NotificationType } from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const userId = new Types.ObjectId();
  const notificationId = new Types.ObjectId();

  function executable<T>(result: T) {
    return {
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(result),
    };
  }

  function create(
    options: { email?: string; sockets?: string[]; pushToken?: string } = {},
  ) {
    const saved = { _id: notificationId, title: 'Booking confirmed' };
    const notificationModel = Object.assign(
      jest.fn().mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(saved),
      })),
      {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
        updateMany: jest.fn(),
      },
    );
    const userModel = {
      findById: jest.fn().mockResolvedValue(
        options.email || options.pushToken
          ? {
              _id: userId,
              auth: { email: options.email },
              pushTokens: options.pushToken
                ? [{ token: options.pushToken, platform: 'android' }]
                : [],
            }
          : null,
      ),
      updateMany: jest.fn().mockReturnValue(executable({ modifiedCount: 1 })),
      updateOne: jest.fn().mockReturnValue(executable({ modifiedCount: 1 })),
    };
    const mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const chatGateway = {
      server: { to },
      getActiveConnections: jest
        .fn()
        .mockReturnValue(new Map([[userId.toString(), options.sockets ?? []]])),
    };
    return {
      service: new NotificationsService(
        notificationModel as never,
        userModel as never,
        mailService as never,
        chatGateway as never,
      ),
      notificationModel,
      userModel,
      mailService,
      chatGateway,
      emit,
      to,
      saved,
    };
  }

  it('queries notifications newest first', async () => {
    const { service, notificationModel } = create();
    notificationModel.find.mockReturnValue(
      executable([{ _id: notificationId }]),
    );
    await expect(service.findAll(userId.toString())).resolves.toHaveLength(1);
    expect(notificationModel.find).toHaveBeenCalledWith({ userId });
  });

  it('marks one notification as read only for its owner', async () => {
    const { service, notificationModel } = create();
    notificationModel.findOneAndUpdate.mockReturnValue(
      executable({ _id: notificationId }),
    );
    await service.markAsRead(notificationId.toString(), userId.toString());
    expect(notificationModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: expect.any(Date) } },
      { new: true },
    );
  });

  it('returns the number of notifications marked as read', async () => {
    const { service, notificationModel } = create();
    notificationModel.updateMany.mockReturnValue(
      executable({ modifiedCount: 3 }),
    );
    await expect(service.markAllAsRead(userId.toString())).resolves.toEqual({
      modifiedCount: 3,
    });
  });

  it('moves a device token to the currently authenticated user', async () => {
    const { service, userModel } = create();
    await service.registerPushToken(
      userId.toString(),
      'ExpoPushToken[token-1]',
      'android',
    );
    expect(userModel.updateMany).toHaveBeenCalledWith(
      {},
      { $pull: { pushTokens: { token: 'ExpoPushToken[token-1]' } } },
    );
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: userId },
      {
        $push: {
          pushTokens: expect.objectContaining({
            token: 'ExpoPushToken[token-1]',
            platform: 'android',
          }),
        },
      },
    );
  });

  it('sends an Expo push notification with navigation metadata', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ status: 'ok', id: 'ticket-1' }] }),
          { status: 200 },
        ),
      );
    const { service, saved } = create({ pushToken: 'ExpoPushToken[token-1]' });
    await expect(
      service.createNotification(
        userId.toString(),
        'Booking confirmed',
        'Your booking is ready.',
        NotificationType.Booking,
        { bookingId: 'booking-1' },
      ),
    ).resolves.toBe(saved);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({ body: expect.stringContaining('booking-1') }),
    );
    fetchMock.mockRestore();
  });

  it('persists, emails and emits a new notification to every active socket', async () => {
    const { service, mailService, to, emit, saved } = create({
      email: 'customer@example.com',
      sockets: ['socket-a', 'socket-b'],
    });
    await expect(
      service.createNotification(
        userId.toString(),
        'Booking confirmed',
        'Your booking is ready.',
        NotificationType.Booking,
        { bookingId: 'booking-1' },
      ),
    ).resolves.toBe(saved);
    expect(mailService.sendMail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringContaining('Booking confirmed'),
      expect.stringContaining('Your booking is ready.'),
    );
    expect(to).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith('new_notification', saved);
  });

  it('does not create a duplicate business notification for the same key', async () => {
    const { service, notificationModel } = create();
    const existing = { _id: notificationId, metadata: { dedupeKey: 'price:1:5' } };
    notificationModel.findOne.mockReturnValue(executable(existing));

    await expect(
      service.createNotificationOnce(
        userId.toString(),
        'price:1:5',
        'Review price',
        'Product reached five rentals.',
        NotificationType.System,
      ),
    ).resolves.toBe(existing);
    expect(notificationModel).not.toHaveBeenCalled();
  });

  it('does not fail persistence when email and websocket delivery fail', async () => {
    const { service, mailService, chatGateway, saved } = create({
      email: 'customer@example.com',
      sockets: ['socket-a'],
    });
    mailService.sendMail.mockRejectedValue(new Error('SMTP unavailable'));
    chatGateway.server.to.mockImplementation(() => {
      throw new Error('socket unavailable');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    await expect(
      service.createNotification(
        userId.toString(),
        'Title',
        'Content',
        NotificationType.System,
      ),
    ).resolves.toBe(saved);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('emits booking updates to all recipients and tolerates a missing server', () => {
    const { service, chatGateway, emit } = create({ sockets: ['socket-a'] });
    const payload = { bookingId: 'booking-1', status: 'CONFIRMED' };
    service.emitBookingUpdate(payload, [userId.toString()]);
    expect(emit).toHaveBeenCalledWith('booking_updated', payload);
    chatGateway.server = undefined;
    expect(() =>
      service.emitBookingUpdate(payload, [userId.toString()]),
    ).not.toThrow();
  });
});
