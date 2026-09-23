/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BookingsSchedulerService } from './bookings-scheduler.service';
import { BookingSchedule } from '../schemas/booking-schedule.schema';
import { Booking, BookingStatus } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import {
  Notification,
  NotificationType,
} from '../../notifications/schemas/notification.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { PhotographyHoldService } from './photography-hold.service';
import { BookingStatusService } from './booking-status.service';
import { BookingsRepository } from '../repositories/bookings.repository';

describe('BookingsSchedulerService - Notification & Reminders', () => {
  let service: BookingsSchedulerService;
  let notificationsService: jest.Mocked<NotificationsService>;

  const mockCustomerId = new Types.ObjectId().toString();
  const mockPhotographerUserId = new Types.ObjectId().toString();
  const mockProviderDocId = new Types.ObjectId();
  const mockBookingId = new Types.ObjectId();

  const mockNotificationModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockBookingModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockBookingItemModel = {
    find: jest.fn(),
  };

  const mockBookingScheduleModel = {
    find: jest.fn(),
  };

  const mockProviderModel = {
    find: jest.fn(),
    findById: jest.fn(),
  };

  const mockPhotographyHoldService = {
    expireExpiredHolds: jest.fn().mockResolvedValue(0),
  };

  const mockBookingStatusService = {
    completeBooking: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
      findAll: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      emitBookingUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsSchedulerService,
        {
          provide: getModelToken(BookingSchedule.name),
          useValue: mockBookingScheduleModel,
        },
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
        {
          provide: getModelToken(BookingItem.name),
          useValue: mockBookingItemModel,
        },
        {
          provide: getModelToken(Provider.name),
          useValue: mockProviderModel,
        },
        {
          provide: getModelToken(Notification.name),
          useValue: mockNotificationModel,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: PhotographyHoldService,
          useValue: mockPhotographyHoldService,
        },
        {
          provide: BookingStatusService,
          useValue: mockBookingStatusService,
        },
      ],
    }).compile();

    service = module.get<BookingsSchedulerService>(BookingsSchedulerService);
    notificationsService = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleRentalItemReminders', () => {
    it('should send 24h pickup reminder for rental booking starting tomorrow', async () => {
      const now = new Date(2026, 0, 10, 8, 0, 0);
      jest.useFakeTimers().setSystemTime(now);
      const pickupDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      mockBookingScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
        then: (resolve: any) => resolve([]),
      });

      const mockBooking = {
        _id: mockBookingId,
        bookingCode: 'BKG12345',
        customerId: mockCustomerId,
        status: BookingStatus.Confirmed,
        pricingSummary: { depositTotal: 500000 },
      };

      const mockRentalItem = {
        _id: new Types.ObjectId(),
        bookingId: mockBookingId,
        itemType: BookingItemType.Product,
        rentalType: 'DAILY',
        rentalFrom: pickupDate,
        rentalTo: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      };

      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockBooking]),
        }),
      });

      mockBookingItemModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockRentalItem]),
      });

      mockNotificationModel.findOne.mockResolvedValue(null);

      await service.handleScheduleReminders();

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        mockCustomerId,
        'Nhắc nhở: Lịch nhận áo dài ngày mai',
        expect.stringContaining('BKG12345'),
        NotificationType.Booking,
        expect.objectContaining({ bookingId: mockBookingId }),
      );
    });

    it('should send 24h return reminder for rental booking due tomorrow', async () => {
      const now = new Date(2026, 0, 10, 20, 0, 0);
      jest.useFakeTimers().setSystemTime(now);
      const returnDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      mockBookingScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
        then: (resolve: any) => resolve([]),
      });

      const mockBooking = {
        _id: mockBookingId,
        bookingCode: 'BKG-RET-01',
        customerId: mockCustomerId,
        status: BookingStatus.PickedUp,
        pricingSummary: { depositTotal: 1000000 },
      };

      const mockRentalItem = {
        _id: new Types.ObjectId(),
        bookingId: mockBookingId,
        itemType: BookingItemType.Product,
        rentalType: 'DAILY',
        rentalFrom: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        rentalTo: returnDate,
      };

      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockBooking]),
        }),
      });

      mockBookingItemModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockRentalItem]),
      });

      mockNotificationModel.findOne.mockResolvedValue(null);

      await service.handleScheduleReminders();

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        mockCustomerId,
        'Nhắc nhở: Hạn trả áo dài ngày mai',
        expect.stringContaining('1.000.000đ'),
        NotificationType.Booking,
        expect.objectContaining({ bookingId: mockBookingId }),
      );
    });

    it('should send overdue return alert when return deadline has passed', async () => {
      const now = new Date(2026, 0, 10, 20, 0, 0);
      jest.useFakeTimers().setSystemTime(now);
      const returnDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      mockBookingScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
        then: (resolve: any) => resolve([]),
      });

      const mockBooking = {
        _id: mockBookingId,
        bookingCode: 'BKG-OVERDUE',
        customerId: mockCustomerId,
        status: BookingStatus.PickedUp,
        pricingSummary: { depositTotal: 500000 },
      };

      const mockRentalItem = {
        _id: new Types.ObjectId(),
        bookingId: mockBookingId,
        itemType: BookingItemType.Product,
        rentalType: 'DAILY',
        rentalFrom: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        rentalTo: returnDate,
      };

      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockBooking]),
        }),
      });

      mockBookingItemModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockRentalItem]),
      });

      mockNotificationModel.findOne.mockResolvedValue(null);

      await service.handleScheduleReminders();

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        mockCustomerId,
        'Cảnh báo: Đơn hàng quá hạn trả áo dài',
        expect.stringContaining('BKG-OVERDUE'),
        NotificationType.Booking,
        expect.objectContaining({ bookingId: mockBookingId }),
      );
    });
  });

  describe('handlePhotographyItemReminders', () => {
    it('should send 24h photoshoot reminder to both customer and photographer', async () => {
      const now = new Date(2026, 0, 10, 9, 0, 0);
      jest.useFakeTimers().setSystemTime(now);
      const shootDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      mockBookingScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
        then: (resolve: any) => resolve([]),
      });

      const mockBooking = {
        _id: mockBookingId,
        bookingCode: 'BKG-PHOTO',
        customerId: mockCustomerId,
        status: BookingStatus.Confirmed,
        pricingSummary: { grandTotal: 2000000 },
      };

      const mockPhotoItem = {
        _id: new Types.ObjectId(),
        bookingId: mockBookingId,
        itemType: BookingItemType.PhotographyPackage,
        providerId: mockProviderDocId,
        shootDate,
        shootTimeSlot: '09:00 - 11:00',
      };

      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockBooking]),
        }),
      });

      mockBookingItemModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockPhotoItem]),
      });

      mockProviderModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: mockProviderDocId,
            userId: mockPhotographerUserId,
          }),
        }),
      });

      mockNotificationModel.findOne.mockResolvedValue(null);

      await service.handleScheduleReminders();

      // Customer notification
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        mockCustomerId,
        'Nhắc nhở: Lịch chụp ảnh ngày mai',
        expect.stringContaining('09:00 - 11:00'),
        NotificationType.Booking,
        expect.objectContaining({ bookingId: mockBookingId }),
      );

      // Photographer notification
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        mockPhotographerUserId,
        'Nhắc nhở: Lịch chụp ảnh với khách hàng ngày mai',
        expect.stringContaining('09:00 - 11:00'),
        NotificationType.Booking,
        expect.objectContaining({ bookingId: mockBookingId }),
      );
    });

    it('should still notify the photographer when the customer reminder already exists', async () => {
      const now = new Date(2026, 0, 10, 9, 0, 0);
      const itemId = new Types.ObjectId();
      const item = {
        _id: itemId,
        itemType: BookingItemType.PhotographyPackage,
        providerId: mockProviderDocId,
        shootDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        shootTimeSlot: '09:00 - 11:00',
      };
      const booking = {
        _id: mockBookingId,
        bookingCode: 'BKG-PHOTO-RECOVERY',
      };

      mockProviderModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: mockProviderDocId,
            userId: mockPhotographerUserId,
          }),
        }),
      });
      mockNotificationModel.findOne
        .mockResolvedValueOnce({ _id: new Types.ObjectId() })
        .mockResolvedValueOnce(null);

      await (service as any).handlePhotographyItemReminders(
        item,
        booking,
        mockCustomerId,
        now,
      );

      expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        mockPhotographerUserId,
        'Nhắc nhở: Lịch chụp ảnh với khách hàng ngày mai',
        expect.stringContaining('BKG-PHOTO-RECOVERY'),
        NotificationType.Booking,
        expect.objectContaining({
          reminderKey: `prov_photo_24h_${itemId}`,
        }),
      );
    });
  });
});

import { BookingRescheduleService } from './booking-reschedule.service';

describe('BookingRescheduleService - Notifications', () => {
  let rescheduleService: BookingRescheduleService;
  let notificationsService: jest.Mocked<NotificationsService>;

  const mockCustomerId = new Types.ObjectId().toString();
  const mockProviderUserId = new Types.ObjectId().toString();
  const mockProviderDocId = new Types.ObjectId();
  const mockBookingId = new Types.ObjectId().toString();
  const mockItemId = new Types.ObjectId().toString();

  const mockBookingsRepository = {
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
    findBookingById: jest.fn(),
    findOneBookingItem: jest.fn(),
    findBookings: jest.fn().mockResolvedValue([]),
    findBookingItems: jest.fn().mockResolvedValue([]),
    updateBookingItem: jest.fn(),
    deleteManySchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateManySchedules: jest.fn(),
  };

  const mockInventoryReservationModel = {
    findOne: jest
      .fn()
      .mockReturnValue({ session: jest.fn().mockResolvedValue(null) }),
    updateOne: jest
      .fn()
      .mockReturnValue({ session: jest.fn().mockResolvedValue({}) }),
  };

  const mockProviderModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
      findAll: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      emitBookingUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingRescheduleService,
        {
          provide: BookingsRepository,
          useValue: mockBookingsRepository,
        },
        {
          provide: getModelToken('InventoryReservation'),
          useValue: mockInventoryReservationModel,
        },
        {
          provide: getModelToken(Provider.name),
          useValue: mockProviderModel,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    rescheduleService = module.get<BookingRescheduleService>(
      BookingRescheduleService,
    );
    notificationsService = module.get(NotificationsService);
  });

  it('should notify both customer and provider when reschedule succeeds', async () => {
    const mockBooking = {
      _id: new Types.ObjectId(mockBookingId),
      bookingCode: 'BKG-RESCHEDULE',
      customerId: mockCustomerId,
      status: BookingStatus.Confirmed,
      providerIds: [mockProviderDocId],
    };

    const mockBookingItem = {
      _id: new Types.ObjectId(mockItemId),
      bookingId: mockBooking._id,
      itemType: BookingItemType.Product,
      rentalType: 'DAILY',
      rentalFrom: new Date(Date.now() + 48 * 60 * 60 * 1000),
      rentalTo: new Date(Date.now() + 72 * 60 * 60 * 1000),
      productId: new Types.ObjectId(),
    };

    mockBookingsRepository.findBookingById.mockResolvedValue(mockBooking);
    mockBookingsRepository.findOneBookingItem.mockResolvedValue(
      mockBookingItem,
    );

    mockProviderModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { _id: mockProviderDocId, userId: mockProviderUserId },
          ]),
      }),
    });

    const newFrom = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const newTo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    await rescheduleService.rescheduleBooking(mockBookingId, mockCustomerId, {
      itemId: mockItemId,
      newRentalFrom: newFrom,
      newRentalTo: newTo,
    });

    // Customer notification
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      mockCustomerId,
      'Đổi lịch thành công',
      expect.stringContaining(`từ ngày ${newFrom} đến ngày ${newTo}`),
      NotificationType.Booking,
      expect.objectContaining({ bookingId: mockBooking._id }),
    );

    // Provider notification
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      mockProviderUserId,
      'Khách hàng đã đổi lịch đơn hàng',
      expect.stringContaining(mockBooking.bookingCode),
      NotificationType.Booking,
      expect.objectContaining({ bookingId: mockBooking._id }),
    );
  });
});
