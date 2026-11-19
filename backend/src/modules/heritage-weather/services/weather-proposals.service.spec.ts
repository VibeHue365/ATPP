import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeatherProposalsService } from './weather-proposals.service';
import {
  ProposalChangeType,
  ProposalStatus,
  WeatherProposal,
} from '../schemas/weather-proposal.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemType,
} from '../../bookings/schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import { HeritageSpotsService } from './heritage-spots.service';
import { RefundOutboxService } from './refund-outbox.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ComboRescheduleCoordinatorService } from './combo-reschedule-coordinator.service';

describe('WeatherProposalsService', () => {
  let service: WeatherProposalsService;

  const mockProposalModel: any = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockBookingModel: any = {
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockBookingItemModel: any = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockBookingScheduleModel: any = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockHeritageSpotsService: any = {
    findById: jest.fn(),
    calculateTravelFeeDelta: jest.fn(),
  };

  const mockRefundOutboxService: any = {
    enqueueRefund: jest.fn(),
  };

  const mockRedisService: any = {
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockComboCoordinator: any = {
    isComboBooking: jest.fn().mockReturnValue(false),
    coordinateComboProposalResponse: jest.fn(),
    applyComboProposalChanges: jest.fn(),
  };

  const mockConfigService: any = {
    get: jest.fn().mockReturnValue('https://vibe-hue.vn'),
  };

  const customerId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();

  const createMockBooking = (overrides?: any) => ({
    _id: bookingId,
    bookingCode: 'BK-20261112',
    customerId,
    providerIds: [providerId],
    status: BookingStatus.Confirmed,
    weatherRescheduleCount: 0,
    hasPendingWeatherAction: false,
    ...overrides,
  });

  const futureTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const futureTomorrowStr = futureTomorrow.toISOString().split('T')[0];

  const createMockPhotoItem = () => ({
    _id: new Types.ObjectId(),
    bookingId,
    itemType: BookingItemType.PhotographyPackage,
    shootDate: futureTomorrow,
    shootTimeSlot: '14:00-16:00',
    shootLocation: 'Đại Nội Huế',
  });

  const createMockSchedule = () => ({
    _id: new Types.ObjectId(),
    bookingId,
    scheduleType: BookingScheduleType.Photoshoot,
    startsAt: new Date(`${futureTomorrowStr}T14:00:00+07:00`),
    endsAt: new Date(`${futureTomorrowStr}T16:00:00+07:00`),
    providerLocalDate: futureTomorrowStr,
    timeSlot: '14:00-16:00',
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherProposalsService,
        {
          provide: getModelToken(WeatherProposal.name),
          useValue: mockProposalModel,
        },
        { provide: getModelToken(Booking.name), useValue: mockBookingModel },
        {
          provide: getModelToken(BookingItem.name),
          useValue: mockBookingItemModel,
        },
        {
          provide: getModelToken(BookingSchedule.name),
          useValue: mockBookingScheduleModel,
        },
        { provide: HeritageSpotsService, useValue: mockHeritageSpotsService },
        { provide: RefundOutboxService, useValue: mockRefundOutboxService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: ComboRescheduleCoordinatorService,
          useValue: mockComboCoordinator,
        },
      ],
    }).compile();

    service = module.get<WeatherProposalsService>(WeatherProposalsService);
  });

  describe('createProposal', () => {
    it('AD-01 & AD-02: should allow LOCATION_ONLY even if quota exhausted and set additionalFeeDue=0 if fee drops', async () => {
      const exhaustedBooking = createMockBooking({ weatherRescheduleCount: 2 });
      mockBookingModel.findById.mockResolvedValueOnce(exhaustedBooking);
      mockBookingItemModel.findOne.mockResolvedValueOnce(createMockPhotoItem());
      mockBookingScheduleModel.findOne.mockResolvedValueOnce(
        createMockSchedule(),
      );

      // Target spot is closer (e.g. old travel fee 50000, new 20000 -> delta -30000 -> additionalFeeDue = 0)
      mockHeritageSpotsService.findById.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        name: 'Cung An Định',
      });
      mockHeritageSpotsService.calculateTravelFeeDelta.mockResolvedValueOnce({
        oldTravelFee: 50000,
        newTravelFee: 20000,
        rawFeeDelta: -30000,
        additionalFeeDue: 0, // Strict AD-01
      });

      const mockSavedProposal = {
        _id: new Types.ObjectId(),
        status: ProposalStatus.PENDING,
        additionalFeeDue: 0,
        changeType: ProposalChangeType.LOCATION_ONLY,
      };
      mockProposalModel.create.mockResolvedValueOnce(mockSavedProposal);

      const result = await service.createProposal(
        bookingId.toString(),
        customerId.toString(),
        {
          changeType: ProposalChangeType.LOCATION_ONLY,
          proposedSpotId: new Types.ObjectId().toString(),
        },
      );

      expect(result.additionalFeeDue).toBe(0);
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({ hasPendingWeatherAction: true }),
        }),
      );
    });

    it('AD-02: should reject DATE_AND_SLOT proposal if quota is exhausted (count >= 2)', async () => {
      const exhaustedBooking = createMockBooking({ weatherRescheduleCount: 2 });
      mockBookingModel.findById.mockResolvedValueOnce(exhaustedBooking);

      await expect(
        service.createProposal(bookingId.toString(), customerId.toString(), {
          changeType: ProposalChangeType.DATE_AND_SLOT,
          proposedDate: '2026-11-20',
          proposedTimeSlot: '09:00-11:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject proposal if booking already has hasPendingWeatherAction = true', async () => {
      const lockedBooking = createMockBooking({
        hasPendingWeatherAction: true,
      });
      mockBookingModel.findById.mockResolvedValueOnce(lockedBooking);

      await expect(
        service.createProposal(bookingId.toString(), customerId.toString(), {
          changeType: ProposalChangeType.LOCATION_ONLY,
        }),
      ).rejects.toThrow(
        'Đơn hàng đang có một đề xuất đổi lịch hoặc yêu cầu hủy thời tiết đang chờ xử lý.',
      );
    });
  });

  describe('respondProposal', () => {
    it('should handle REJECTED decision: release Redis hold, unlock booking', async () => {
      const mockProposal = {
        _id: new Types.ObjectId(),
        bookingId,
        providerIds: [providerId],
        status: ProposalStatus.PENDING,
        temporaryHoldRef: 'hold:photographer:123',
        providerResponses: new Map(),
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findById.mockResolvedValueOnce(mockProposal);
      mockBookingModel.findById.mockResolvedValueOnce(createMockBooking());

      const result = await service.respondProposal(
        mockProposal._id.toString(),
        providerId.toString(),
        { decision: 'REJECTED', rejectionReason: 'Trùng lịch chụp khác' },
      );

      expect(result.status).toBe(ProposalStatus.REJECTED);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'hold:photographer:123',
      );
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({ hasPendingWeatherAction: false }),
        }),
      );
    });

    it('AD-02: APPROVED with additionalFeeDue = 0 and LOCATION_ONLY should NOT increment weatherRescheduleCount', async () => {
      const mockProposal = {
        _id: new Types.ObjectId(),
        bookingId,
        providerIds: [providerId],
        status: ProposalStatus.PENDING,
        additionalFeeDue: 0,
        changeType: ProposalChangeType.LOCATION_ONLY,
        temporaryHoldRef: 'hold:photographer:123',
        proposedSchedule: {
          date: futureTomorrowStr,
          timeSlot: '14:00-16:00',
          spotName: 'Cung An Định',
          spotId: new Types.ObjectId(),
        },
        providerResponses: new Map(),
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findById.mockResolvedValueOnce(mockProposal);
      mockBookingModel.findById.mockResolvedValueOnce(createMockBooking());

      const result = await service.respondProposal(
        mockProposal._id.toString(),
        providerId.toString(),
        { decision: 'APPROVED' },
      );

      expect(result.status).toBe(ProposalStatus.APPLIED);
      // AD-02: LOCATION_ONLY must NOT increment weatherRescheduleCount
      expect(mockBookingModel.updateOne).not.toHaveBeenCalledWith(
        { _id: bookingId },
        { $inc: { weatherRescheduleCount: 1 } },
      );
    });

    it('AD-02: APPROVED with additionalFeeDue = 0 and DATE_AND_SLOT should increment weatherRescheduleCount by 1', async () => {
      const mockProposal = {
        _id: new Types.ObjectId(),
        bookingId,
        providerIds: [providerId],
        status: ProposalStatus.PENDING,
        additionalFeeDue: 0,
        changeType: ProposalChangeType.DATE_AND_SLOT,
        temporaryHoldRef: 'hold:photographer:123',
        proposedSchedule: {
          date: '2026-11-20',
          timeSlot: '09:00-11:00',
          spotName: 'Đại Nội Huế',
          spotId: new Types.ObjectId(),
        },
        providerResponses: new Map(),
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findById.mockResolvedValueOnce(mockProposal);
      mockBookingModel.findById.mockResolvedValueOnce(createMockBooking());

      const result = await service.respondProposal(
        mockProposal._id.toString(),
        providerId.toString(),
        { decision: 'APPROVED' },
      );

      expect(result.status).toBe(ProposalStatus.APPLIED);
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        { $inc: { weatherRescheduleCount: 1 } },
      );
    });

    it('APPROVED with additionalFeeDue > 0 sets status APPROVED_PENDING_PAYMENT and creates payment link', async () => {
      const mockProposal = {
        _id: new Types.ObjectId(),
        bookingId,
        providerIds: [providerId],
        status: ProposalStatus.PENDING,
        additionalFeeDue: 100000,
        changeType: ProposalChangeType.DATE_AND_SLOT,
        originalSchedule: {
          date: futureTomorrowStr,
          timeSlot: '14:00-16:00',
        },
        temporaryHoldRef: 'hold:photographer:123',
        providerResponses: new Map(),
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findById.mockResolvedValueOnce(mockProposal);
      mockBookingModel.findById.mockResolvedValueOnce(createMockBooking());

      const result = await service.respondProposal(
        mockProposal._id.toString(),
        providerId.toString(),
        { decision: 'APPROVED' },
      );

      expect(result.status).toBe(ProposalStatus.APPROVED_PENDING_PAYMENT);
      expect(result.additionalPayment?.amount).toBe(100000);
      expect(result.additionalPayment?.checkoutUrl).toContain('orderCode=');
      expect(result.paymentExpiresAt).toBeDefined();
    });
  });

  describe('captureProposalPayment', () => {
    it('On-time payment captures fee and applies proposal', async () => {
      const mockProposal: any = {
        _id: new Types.ObjectId(),
        bookingId,
        status: ProposalStatus.APPROVED_PENDING_PAYMENT,
        paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins in future
        changeType: ProposalChangeType.DATE_AND_SLOT,
        proposedSchedule: {
          date: '2026-11-20',
          timeSlot: '09:00-11:00',
          spotName: 'Đại Nội Huế',
        },
        additionalPayment: { orderCode: 888999, status: 'PENDING' },
        temporaryHoldRef: 'hold:photographer:123',
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findOne.mockResolvedValueOnce(mockProposal);
      mockBookingModel.findById.mockResolvedValueOnce(createMockBooking());

      const res = await service.captureProposalPayment(888999, 100000);

      expect(res.success).toBe(true);
      expect(mockProposal.status).toBe(ProposalStatus.APPLIED);
      expect(mockProposal.additionalPayment.status).toBe('PAID');
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'hold:photographer:123',
      );
    });

    it('Late Webhook captures fee after paymentExpiresAt -> enqueues auto-refund via RefundOutbox', async () => {
      const mockProposal: any = {
        _id: new Types.ObjectId(),
        bookingId,
        status: ProposalStatus.APPROVED_PENDING_PAYMENT,
        paymentExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired 5 mins ago!
        additionalPayment: { orderCode: 888999, status: 'PENDING' },
        temporaryHoldRef: 'hold:photographer:123',
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findOne.mockResolvedValueOnce(mockProposal);
      mockBookingModel.findById.mockResolvedValueOnce(createMockBooking());

      const res = await service.captureProposalPayment(888999, 100000);

      expect(res.success).toBe(false);
      expect(mockProposal.status).toBe(ProposalStatus.EXPIRED_PAYMENT_CAPTURED);
      // Automatic durable refund enqueued!
      expect(mockRefundOutboxService.enqueueRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId,
          amount: 100000,
          sourceEventId: `refund:late_fee:${mockProposal._id}`,
        }),
      );
    });
  });

  describe('cancelProposal', () => {
    it('should cancel pending proposal and release Redis hold', async () => {
      const mockProposal: any = {
        _id: new Types.ObjectId(),
        bookingId,
        customerId,
        status: ProposalStatus.PENDING,
        temporaryHoldRef: 'hold:photographer:123',
        save: jest.fn().mockResolvedValue(true),
      };
      mockProposalModel.findById.mockResolvedValueOnce(mockProposal);

      const result = await service.cancelProposal(
        mockProposal._id.toString(),
        customerId.toString(),
      );

      expect(result.status).toBe(ProposalStatus.CANCELLED);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'hold:photographer:123',
      );
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({ hasPendingWeatherAction: false }),
        }),
      );
    });

    it('should reject cancellation if user is not customer', async () => {
      const mockProposal: any = {
        _id: new Types.ObjectId(),
        customerId,
        status: ProposalStatus.PENDING,
      };
      mockProposalModel.findById.mockResolvedValueOnce(mockProposal);

      await expect(
        service.cancelProposal(
          mockProposal._id.toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getProposal & listProposalsByBooking', () => {
    it('should get proposal by id', async () => {
      const mockProposal = { _id: new Types.ObjectId() };
      mockProposalModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockProposal),
      });

      const res = await service.getProposal(mockProposal._id.toString());
      expect(res).toEqual(mockProposal);
    });

    it('should return null for invalid objectId in getProposal', async () => {
      const res = await service.getProposal('invalid-id');
      expect(res).toBeNull();
    });

    it('should list proposals by booking', async () => {
      const bId = new Types.ObjectId();
      mockProposalModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce([{ _id: 'prop-1' }]),
        }),
      });

      const res = await service.listProposalsByBooking(bId.toString());
      expect(res).toHaveLength(1);
    });
  });
});
