import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './schemas/notification.schema';

describe('NotificationsService notification channels', () => {
  const userId = new Types.ObjectId().toString();
  const save = jest.fn();
  const notificationModel: any = jest.fn().mockImplementation(() => ({ save }));
  const userModel = { findById: jest.fn() };
  const mailService = { sendMail: jest.fn() };
  const emit = jest.fn();
  const chatGateway = {
    server: { to: jest.fn().mockReturnValue({ emit }) },
    getActiveConnections: jest.fn(),
  };
  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    save.mockResolvedValue({ _id: new Types.ObjectId() });
    chatGateway.getActiveConnections.mockReturnValue(
      new Map([[userId, ['socket-1']]]),
    );
    service = new NotificationsService(
      notificationModel,
      userModel as never,
      mailService as never,
      chatGateway as never,
    );
  });

  it('respects marketing email and app push opt-outs', async () => {
    userModel.findById.mockResolvedValue({
      auth: { email: 'customer@example.com' },
      notificationPreferences: { marketingEmail: false, appPush: false },
    });

    await service.createNotification(
      userId,
      'Marketing update',
      'Optional campaign content',
      NotificationType.System,
      { channel: 'MARKETING' },
    );

    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('still sends transactional email when marketing email is disabled', async () => {
    userModel.findById.mockResolvedValue({
      auth: { email: 'customer@example.com' },
      notificationPreferences: { marketingEmail: false, appPush: true },
    });

    await service.createNotification(
      userId,
      'Dispute update',
      'Your dispute status changed.',
      NotificationType.Dispute,
      { critical: true },
    );

    expect(mailService.sendMail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringContaining('Dispute update'),
      expect.stringContaining('Your dispute status changed.'),
    );
    expect(emit).toHaveBeenCalledWith(
      'new_notification',
      expect.any(Object),
    );
  });
});
