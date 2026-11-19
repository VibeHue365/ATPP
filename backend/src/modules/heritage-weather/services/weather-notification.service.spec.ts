import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { WeatherNotificationService } from './weather-notification.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { ChatGateway } from '../../chat/chat.gateway';
import { Provider } from '../../providers/schemas/provider.schema';

describe('WeatherNotificationService', () => {
  let service: WeatherNotificationService;

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const activeConnectionsMap = new Map<string, string[]>();

  const mockChatGateway = {
    server: mockServer,
    getActiveConnections: jest.fn().mockReturnValue(activeConnectionsMap),
  };

  const mockProviderModel = {
    findById: jest.fn(),
  };

  const customerId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const providerUserId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const proposalId = new Types.ObjectId();

  beforeEach(async () => {
    jest.clearAllMocks();
    activeConnectionsMap.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherNotificationService,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: ChatGateway,
          useValue: mockChatGateway,
        },
        {
          provide: getModelToken(Provider.name),
          useValue: mockProviderModel,
        },
      ],
    }).compile();

    service = module.get<WeatherNotificationService>(
      WeatherNotificationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendWeatherRedAlert', () => {
    it('should create notification and emit weather_red_alert to customer socket', async () => {
      activeConnectionsMap.set(customerId.toString(), ['socket-cust-1']);

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-RED-1',
        customerId,
      };

      await service.sendWeatherRedAlert({
        booking,
        shootDate: '2026-11-20',
        timeSlot: '08:00 - 10:00',
        milestone: 'T-24h',
        reason: 'Mưa lớn dự báo 15mm/h',
        spotName: 'Đại Nội Huế',
      });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        customerId.toString(),
        expect.stringContaining('[Cảnh báo thời tiết]'),
        expect.stringContaining('Mưa lớn dự báo 15mm/h'),
        NotificationType.Weather,
        expect.objectContaining({
          milestone: 'T-24h',
          isRedAlert: true,
        }),
      );

      expect(mockServer.to).toHaveBeenCalledWith('socket-cust-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'weather_red_alert',
        expect.objectContaining({
          bookingId: bookingId.toString(),
          milestone: 'T-24h',
          isRedAlert: true,
        }),
      );
    });
  });

  describe('sendPlanBProposed', () => {
    it('should resolve provider user and emit plan_b_proposed', async () => {
      activeConnectionsMap.set(providerUserId.toString(), ['socket-prov-1']);
      mockProviderModel.findById.mockResolvedValue({
        _id: providerId,
        userId: providerUserId,
      });

      const proposal = {
        _id: proposalId,
        proposedDate: '2026-11-21',
        proposedTimeSlot: '09:00 - 11:00',
        changeType: 'DATE_AND_SLOT',
        expiresAt: new Date(),
        proposedSpotName: 'Cung An Định',
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-PLANB-1',
      };

      await service.sendPlanBProposed({
        proposal,
        booking,
        providerIds: [providerId],
      });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        providerUserId.toString(),
        expect.stringContaining('[Đề xuất đổi lịch]'),
        expect.any(String),
        NotificationType.Weather,
        expect.objectContaining({ proposalId: proposalId.toString() }),
      );

      expect(mockServer.to).toHaveBeenCalledWith('socket-prov-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'plan_b_proposed',
        expect.objectContaining({
          proposalId: proposalId.toString(),
          proposedDate: '2026-11-21',
        }),
      );
    });
  });

  describe('sendPlanBPaymentRequired', () => {
    it('should notify customer and emit plan_b_approved_payment_required', async () => {
      activeConnectionsMap.set(customerId.toString(), ['socket-cust-2']);

      const proposal = {
        _id: proposalId,
        additionalFeeDue: 150000,
        paymentExpiresAt: new Date(),
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-PAY-1',
        customerId,
      };

      await service.sendPlanBPaymentRequired({
        proposal,
        booking,
        paymentUrl: 'https://pay.vn/checkout',
      });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        customerId.toString(),
        expect.stringContaining('[Thanh toán phụ phí]'),
        expect.stringMatching(/150[.,]000/),
        NotificationType.Weather,
        expect.objectContaining({ additionalFee: 150000 }),
      );

      expect(mockServer.to).toHaveBeenCalledWith('socket-cust-2');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'plan_b_approved_payment_required',
        expect.objectContaining({
          additionalFee: 150000,
          paymentUrl: 'https://pay.vn/checkout',
        }),
      );
    });
  });

  describe('sendPlanBApplied', () => {
    it('should notify all recipient users and broadcast to room', async () => {
      activeConnectionsMap.set(customerId.toString(), ['socket-cust-3']);

      const proposal = {
        _id: proposalId,
        proposedDate: '2026-11-22',
        proposedTimeSlot: '14:00 - 16:00',
        proposedSpotName: 'Lăng Khải Định',
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-APPLIED-1',
      };

      await service.sendPlanBApplied({
        proposal,
        booking,
        recipientUserIds: [customerId.toString()],
      });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        customerId.toString(),
        expect.stringContaining('[Cập nhật lịch mới]'),
        expect.any(String),
        NotificationType.Weather,
        expect.objectContaining({ spotName: 'Lăng Khải Định' }),
      );

      expect(mockServer.to).toHaveBeenCalledWith(
        `booking:${bookingId.toString()}`,
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        'plan_b_applied',
        expect.objectContaining({
          spotName: 'Lăng Khải Định',
          newDate: '2026-11-22',
        }),
      );
    });
  });

  describe('sendRefundStatusUpdated', () => {
    it('should send notification and emit refund_status_updated', async () => {
      activeConnectionsMap.set(customerId.toString(), ['socket-cust-4']);

      await service.sendRefundStatusUpdated({
        userId: customerId.toString(),
        refundId: 'ref-123',
        bookingId: bookingId.toString(),
        status: 'COMPLETED',
        amount: 800000,
      });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        customerId.toString(),
        expect.stringContaining('[Cập nhật hoàn tiền]'),
        expect.stringMatching(/800[.,]000/),
        NotificationType.Weather,
        expect.objectContaining({ status: 'COMPLETED' }),
      );

      expect(mockServer.to).toHaveBeenCalledWith('socket-cust-4');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'refund_status_updated',
        expect.objectContaining({ status: 'COMPLETED', amount: 800000 }),
      );
    });
  });

  describe('sendWeatherCancellationReviewed', () => {
    it('should notify customer when cancellation is approved', async () => {
      activeConnectionsMap.set(customerId.toString(), ['socket-cust-5']);

      const cancellation = {
        _id: new Types.ObjectId(),
        status: 'APPROVED_FULL_REFUND',
        reviewDecision: {
          approvedRefundAmount: 1200000,
          notes: 'Đầy đủ bằng chứng vé máy bay ngày bão',
        },
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-CANCEL-1',
        customerId,
      };

      await service.sendWeatherCancellationReviewed({ cancellation, booking });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        customerId.toString(),
        expect.stringContaining('chấp thuận'),
        expect.stringMatching(/1[.,]200[.,]000/),
        NotificationType.Weather,
        expect.objectContaining({ status: 'APPROVED_FULL_REFUND' }),
      );

      expect(mockServer.to).toHaveBeenCalledWith('socket-cust-5');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'weather_cancellation_reviewed',
        expect.objectContaining({ status: 'APPROVED_FULL_REFUND' }),
      );
    });

    it('should notify customer when cancellation is rejected', async () => {
      activeConnectionsMap.set(customerId.toString(), ['socket-cust-6']);

      const cancellation = {
        _id: new Types.ObjectId(),
        status: 'REJECTED',
        reviewDecision: {
          approvedRefundAmount: 0,
          notes: 'Vé tàu không đúng ngày bão',
        },
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-CANCEL-2',
        customerId,
      };

      await service.sendWeatherCancellationReviewed({ cancellation, booking });

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        customerId.toString(),
        expect.stringContaining('không được chấp thuận'),
        expect.stringContaining('Vé tàu không đúng ngày bão'),
        NotificationType.Weather,
        expect.objectContaining({ status: 'REJECTED' }),
      );
    });
  });
});
