/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BookingStatusService } from './booking-status.service';
import { BookingRescheduleService } from './booking-reschedule.service';
import { Booking, BookingStatus } from '../schemas/booking.schema';
import { BookingItem, BookingItemType } from '../schemas/booking-item.schema';
import { BookingSchedule } from '../schemas/booking-schedule.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { Provider } from '../../providers/schemas/provider.schema';
import { PaymentsService } from '../../payments/services/payments.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';
import { BookingsRepository } from '../repositories/bookings.repository';

describe('Bookings Service Unit Tests', () => {
  let bookingStatusService: BookingStatusService;
  let bookingRescheduleService: BookingRescheduleService;

  // Mock services
  let mockPaymentsService: any;
  let mockNotificationsService: any;

  // Mock Mongoose Session
  let mockSession: any;

  // Mock Models
  let mockBookingModel: any;
  let mockBookingItemModel: any;
  let mockBookingScheduleModel: any;
  let mockInventoryReservationModel: any;
  let mockProviderModel: any;

  // Mock Repository
  let mockBookingsRepository: any;

  beforeEach(async () => {
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    const mockDb = {
      startSession: jest.fn().mockResolvedValue(mockSession),
      model: jest.fn().mockImplementation((name) => {
        if (name === 'Provider') return mockProviderModel as unknown;
        if (name === 'BookingItem') return mockBookingItemModel as unknown;
        return null;
      }),
    };

    mockBookingModel = {
      findById: jest.fn(),
      find: jest.fn(),
      updateMany: jest.fn(),
      db: mockDb,
    };

    mockBookingItemModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    mockBookingScheduleModel = {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    };

    mockInventoryReservationModel = {
      updateMany: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    mockProviderModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    mockPaymentsService = {
      refundDeposit: jest.fn().mockResolvedValue({ success: true }),
      cancelSettlementsForBooking: jest.fn().mockResolvedValue(undefined),
      executeAutoTransfer: jest.fn().mockResolvedValue({ success: true }),
    };

    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    mockBookingsRepository = {
      startSession: jest.fn().mockResolvedValue(mockSession),
      findBookingById: jest.fn().mockImplementation((id, session) => {
        const result = mockBookingModel.findById(id);
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
      findBookings: jest.fn().mockImplementation((filter, sort, session) => {
        const result = mockBookingModel.find(filter);
        if (result && typeof result.select === 'function') {
          const selectResult = result.select('_id');
          if (selectResult && typeof selectResult.session === 'function') {
            return selectResult.session(session || null);
          }
          return selectResult;
        }
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
      findOneBooking: jest.fn().mockImplementation((filter, session) => {
        const result = mockBookingModel.findOne(filter);
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
      createBooking: jest.fn(),
      updateBooking: jest.fn().mockImplementation((id, update, session) => {
        const result = mockBookingModel.findByIdAndUpdate(id, update);
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
      updateManyBookings: jest
        .fn()
        .mockImplementation((filter, update, session) => {
          const result = mockBookingModel.updateMany(filter, update);
          if (result && typeof result.session === 'function') {
            return result.session(session || null);
          }
          return result;
        }),
      findBookingItems: jest
        .fn()
        .mockImplementation((filter, populateConfigs, session) => {
          const result = mockBookingItemModel.find(filter);
          if (result && typeof result.session === 'function') {
            return result.session(session || null);
          }
          return result;
        }),
      findOneBookingItem: jest.fn().mockImplementation((filter, session) => {
        const result = mockBookingItemModel.findOne(filter);
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
      createBookingItem: jest.fn(),
      updateBookingItem: jest.fn().mockImplementation((id, update, session) => {
        const result = mockBookingItemModel.updateOne({ _id: id }, update);
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
      updateManyBookingItems: jest.fn(),
      deleteManyBookingItems: jest.fn(),
      findSchedules: jest.fn(),
      createSchedule: jest.fn().mockImplementation((data, session) => {
        return mockBookingScheduleModel.create([data], { session });
      }),
      updateManySchedules: jest
        .fn()
        .mockImplementation((filter, update, session) => {
          const result = mockBookingScheduleModel.updateMany(filter, update);
          if (result && typeof result.session === 'function') {
            return result.session(session || null);
          }
          return result;
        }),
      deleteManySchedules: jest.fn().mockImplementation((filter, session) => {
        const result = mockBookingScheduleModel.deleteMany(filter);
        if (result && typeof result.session === 'function') {
          return result.session(session || null);
        }
        return result;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStatusService,
        BookingRescheduleService,
        {
          provide: BookingsRepository,
          useValue: mockBookingsRepository as unknown,
        },
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel as unknown,
        },
        {
          provide: getModelToken(BookingItem.name),
          useValue: mockBookingItemModel as unknown,
        },
        {
          provide: getModelToken(BookingSchedule.name),
          useValue: mockBookingScheduleModel as unknown,
        },
        {
          provide: getModelToken(InventoryReservation.name),
          useValue: mockInventoryReservationModel as unknown,
        },
        {
          provide: getModelToken(Provider.name),
          useValue: mockProviderModel as unknown,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService as unknown,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService as unknown,
        },
      ],
    }).compile();

    bookingStatusService =
      module.get<BookingStatusService>(BookingStatusService);
    bookingRescheduleService = module.get<BookingRescheduleService>(
      BookingRescheduleService,
    );
  });

  describe('cancelBooking', () => {
    it('Test 1: should cancel PENDING_PAYMENT booking successfully, release inventory, but NOT trigger refund', async () => {
      const mockBooking = {
        _id: new Types.ObjectId(),
        bookingCode: 'BK12345',
        customerId: new Types.ObjectId(),
        providerIds: [new Types.ObjectId()],
        status: BookingStatus.PendingPayment,
        pricingSummary: { grandTotal: 200000, subTotal: 200000 },
        statusTimeline: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return this;
        }),
      };

      mockBookingModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockProviderModel.find.mockReturnValue({
        session: jest.fn().mockResolvedValue([]),
      });

      mockBookingScheduleModel.updateMany.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      mockInventoryReservationModel.updateMany.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      const result = (await bookingStatusService.cancelBooking(
        mockBooking._id.toString(),
        mockBooking.customerId.toString(),
        [],
        'Khách hàng hủy đơn',
      )) as any;

      expect(result.booking.status).toBe(BookingStatus.Cancelled);
      expect(mockInventoryReservationModel.updateMany).toHaveBeenCalledWith(
        { bookingId: mockBooking._id },
        { $set: { status: ReservationStatus.Cancelled } },
      );
      expect(mockPaymentsService.refundDeposit).not.toHaveBeenCalled();
    });

    it('Test 2: should refund successfully when customer cancels CONFIRMED booking within free cancellation hours', async () => {
      const customerId = new Types.ObjectId();
      const mockBooking = {
        _id: new Types.ObjectId(),
        bookingCode: 'BK54321',
        customerId,
        providerIds: [new Types.ObjectId()],
        status: BookingStatus.Confirmed,
        pricingSummary: { grandTotal: 500000, subTotal: 500000 },
        statusTimeline: [],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Created 2 days ago
        save: jest.fn().mockImplementation(function (this: any) {
          return this;
        }),
      };

      const mockItems = [
        {
          itemType: BookingItemType.Product,
          rentalType: 'DAILY',
          rentalFrom: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Start in 5 days (free cancel limit is 24 hours)
          unitPrice: 200000,
          quantity: 1,
        },
      ];

      mockBookingModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockProviderModel.find.mockReturnValue({
        session: jest.fn().mockResolvedValue([]),
      });

      mockBookingItemModel.find.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockItems),
      });

      mockBookingScheduleModel.updateMany.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      mockInventoryReservationModel.updateMany.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      const result = (await bookingStatusService.cancelBooking(
        mockBooking._id.toString(),
        customerId.toString(),
        [],
        'Customer changed mind',
      )) as any;

      expect(result.success).toBe(true);
      expect(result.isFreeCancel).toBe(true);
      expect(result.refundAmount).toBe(500000);
      expect(mockPaymentsService.refundDeposit).toHaveBeenCalledWith(
        mockBooking._id.toString(),
        500000,
        mockSession,
      );
    });

    it('Test 3: should rollback transaction and propagate error when inventory release fails', async () => {
      const mockBooking = {
        _id: new Types.ObjectId(),
        bookingCode: 'BK7777',
        customerId: new Types.ObjectId(),
        providerIds: [new Types.ObjectId()],
        status: BookingStatus.PendingPayment,
        pricingSummary: { grandTotal: 250000, subTotal: 250000 },
        statusTimeline: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return this;
        }),
      };

      mockBookingModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockProviderModel.find.mockReturnValue({
        session: jest.fn().mockResolvedValue([]),
      });

      mockBookingScheduleModel.updateMany.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      // Fake inventory release error to trigger abortTransaction
      mockInventoryReservationModel.updateMany.mockReturnValue({
        session: jest.fn().mockRejectedValue(new Error('Mongoose write error')),
      });

      await expect(
        bookingStatusService.cancelBooking(
          mockBooking._id.toString(),
          mockBooking.customerId.toString(),
          [],
          'Hủy lỗi',
        ),
      ).rejects.toThrow('Mongoose write error');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('rescheduleBooking', () => {
    it('Test 1: should block rescheduling when the new photographer schedule overlaps with another booking', async () => {
      const customerId = new Types.ObjectId();
      const providerId = new Types.ObjectId();
      const mockBooking = {
        _id: new Types.ObjectId(),
        customerId,
        status: BookingStatus.Confirmed,
      };

      const mockBookingItem = {
        _id: new Types.ObjectId(),
        bookingId: mockBooking._id,
        itemType: BookingItemType.PhotographyPackage,
        providerId,
        shootDate: new Date(),
        shootTimeSlot: '08:00-10:00',
      };

      mockBookingModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockBookingItemModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBookingItem),
      });

      // Mock busy schedules showing provider is booked for that slot
      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
        }),
      });

      mockBookingItemModel.find.mockReturnValue({
        session: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            shootDate: new Date(),
            shootTimeSlot: '09:00-11:00', // overlaps with 08:00-11:00
            itemType: BookingItemType.PhotographyPackage,
            providerId,
          },
        ]),
      });

      await expect(
        bookingRescheduleService.rescheduleBooking(
          mockBooking._id.toString(),
          customerId.toString(),
          {
            itemId: mockBookingItem._id.toString(),
            newShootDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            newShootTimeSlot: '09:00-11:00',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Test 2: should reschedule successfully and update/delete schedules correctly', async () => {
      const customerId = new Types.ObjectId();
      const mockBooking = {
        _id: new Types.ObjectId(),
        customerId,
        status: BookingStatus.Confirmed,
        bookingCode: 'BRESCH',
      };

      const mockBookingItem = {
        _id: new Types.ObjectId(),
        bookingId: mockBooking._id,
        itemType: BookingItemType.Product,
        rentalType: 'DAILY',
        rentalFrom: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        rentalTo: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      };

      mockBookingModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockBookingItemModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBookingItem),
      });

      mockInventoryReservationModel.findOne.mockImplementation((query: any) => {
        if (query && query.inventoryItemId && !query.bookingItemId) {
          return {
            session: jest.fn().mockResolvedValue(null),
          };
        }
        return {
          session: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(),
            inventoryItemId: new Types.ObjectId(),
          }),
        };
      });

      mockInventoryReservationModel.updateOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      mockBookingItemModel.updateOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      mockBookingScheduleModel.deleteMany.mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      mockBookingScheduleModel.create.mockResolvedValue({});

      const newFrom = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const newTo = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const result = await bookingRescheduleService.rescheduleBooking(
        mockBooking._id.toString(),
        customerId.toString(),
        {
          itemId: mockBookingItem._id.toString(),
          newRentalFrom: newFrom,
          newRentalTo: newTo,
        },
      );

      expect(result.message).toBe('Đổi lịch thành công');
      expect(mockBookingScheduleModel.deleteMany).toHaveBeenCalled();
      expect(mockBookingScheduleModel.create).toHaveBeenCalled();
    });
  });
});
