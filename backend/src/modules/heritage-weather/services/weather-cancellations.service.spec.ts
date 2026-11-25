import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WeatherCancellationsService } from './weather-cancellations.service';
import {
  CancellationEligibilityBasis,
  CancellationReviewStatus,
  WeatherCancellationRequest,
} from '../schemas/weather-cancellation.schema';
import {
  HeritageSpot,
  HeritageSpotSpaceType,
} from '../schemas/heritage-spot.schema';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemType,
} from '../../bookings/schemas/booking-item.schema';
import {
  BookingSchedule,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import { Payment, PaymentStatus } from '../../payments/schemas/payment.schema';
import { RefundRequest } from '../../payments/schemas/refund-request.schema';
import { OpenMeteoClientService } from './open-meteo-client.service';
import { HeritageScoringService } from './heritage-scoring.service';
import { RefundOutboxService } from './refund-outbox.service';
import { InventorySlotLeaseService } from '../../bookings/services/inventory-slot-lease.service';

describe('WeatherCancellationsService', () => {
  let service: WeatherCancellationsService;

  const mockCancellationModel: any = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockBookingModel: any = {
    findById: jest.fn(),
  };

  const mockBookingItemModel: any = {
    findOne: jest.fn(),
  };

  const mockBookingScheduleModel: any = {
    findOne: jest.fn(),
  };

  const mockSpotModel: any = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  const mockPaymentModel: any = {
    find: jest.fn(),
  };

  const mockRefundRequestModel: any = {
    create: jest.fn(),
  };

  const mockOpenMeteoService: any = {
    getHourlyMetrics: jest.fn(),
  };

  const mockScoringService: any = {
    assessTimeSlot: jest.fn(),
  };

  const mockRefundOutboxService: any = {
    enqueueRefund: jest.fn(),
  };

  const mockSlotLeaseService: any = {
    releaseBookingLeases: jest.fn().mockResolvedValue(2),
  };

  const customerId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const requestId = new Types.ObjectId();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherCancellationsService,
        {
          provide: getModelToken(WeatherCancellationRequest.name),
          useValue: mockCancellationModel,
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
          provide: getModelToken(BookingSchedule.name),
          useValue: mockBookingScheduleModel,
        },
        {
          provide: getModelToken(HeritageSpot.name),
          useValue: mockSpotModel,
        },
        {
          provide: getModelToken(Payment.name),
          useValue: mockPaymentModel,
        },
        {
          provide: getModelToken(RefundRequest.name),
          useValue: mockRefundRequestModel,
        },
        {
          provide: OpenMeteoClientService,
          useValue: mockOpenMeteoService,
        },
        {
          provide: HeritageScoringService,
          useValue: mockScoringService,
        },
        {
          provide: RefundOutboxService,
          useValue: mockRefundOutboxService,
        },
        {
          provide: InventorySlotLeaseService,
          useValue: mockSlotLeaseService,
        },
      ],
    }).compile();

    service = module.get<WeatherCancellationsService>(
      WeatherCancellationsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitCancellationRequest', () => {
    const validDto = {
      reason:
        'Bão số 6 ngập lụt toàn bộ đường vào Đại Nội, không thể di chuyển.',
      evidencePhotos: ['https://example.com/ticket.jpg'],
    };

    it('should throw BadRequestException if bookingId is invalid', async () => {
      await expect(
        service.submitCancellationRequest(
          'invalid-id',
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingModel.findById.mockResolvedValue(null);

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if customer does not own booking', async () => {
      const otherCustomerId = new Types.ObjectId();
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId: otherCustomerId,
      });

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if booking status is not eligible', async () => {
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId,
        status: BookingStatus.Cancelled,
      });

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if booking already has pending weather action', async () => {
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: true,
      });

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if existing pending request exists in DB', async () => {
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: false,
      });
      mockCancellationModel.findOne.mockResolvedValue({ _id: requestId });

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if assessment is not RED_ALERT', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockCancellationModel.findOne.mockResolvedValue(null);
      mockBookingItemModel.findOne.mockResolvedValue({
        shootDate: new Date('2026-11-20'),
        shootTimeSlot: '08:00 - 10:00',
        shootLocation: 'Đại Nội Huế',
      });
      mockBookingScheduleModel.findOne.mockResolvedValue(null);
      mockSpotModel.findOne.mockResolvedValue(null);
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValue([]);
      mockScoringService.assessTimeSlot.mockReturnValue({
        isRedAlert: false,
        hourlyBreakdown: [],
      });

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          validDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for Basis B if quota < 2 and no evidence photos provided (AD-03)', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: false,
        weatherRescheduleCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockCancellationModel.findOne.mockResolvedValue(null);
      mockBookingItemModel.findOne.mockResolvedValue({
        shootDate: new Date('2026-11-20'),
        shootTimeSlot: '08:00 - 10:00',
      });
      mockBookingScheduleModel.findOne.mockResolvedValue(null);
      mockSpotModel.findOne.mockResolvedValue(null);
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValue([]);
      mockScoringService.assessTimeSlot.mockReturnValue({
        isRedAlert: true,
        hourlyBreakdown: [
          {
            isRedAlert: true,
            precipitationMm: 5.0,
            precipitationProbability: 80,
            weatherCode: 95,
          },
        ],
      });

      await expect(
        service.submitCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
          {
            reason: 'Mưa to gió lớn không thể đến nơi',
            evidencePhotos: [],
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should succeed with Basis A when weatherRescheduleCount >= 2 and RED_ALERT (AD-03)', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: false,
        weatherRescheduleCount: 2, // Quota exhausted
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockCancellationModel.findOne.mockResolvedValue(null);
      mockBookingItemModel.findOne.mockResolvedValue({
        shootDate: new Date('2026-11-20'),
        shootTimeSlot: '08:00 - 10:00',
        shootLocation: 'Đại Nội Huế',
      });
      mockBookingScheduleModel.findOne.mockResolvedValue(null);
      mockSpotModel.findOne.mockResolvedValue(null);
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValue([]);
      mockScoringService.assessTimeSlot.mockReturnValue({
        isRedAlert: true,
        hourlyBreakdown: [
          {
            isRedAlert: true,
            precipitationMm: 6.5,
            precipitationProbability: 90,
            weatherCode: 95,
          },
        ],
      });

      const createdDoc = {
        _id: requestId,
        bookingId,
        customerId,
        eligibilityBasis: CancellationEligibilityBasis.BASIS_A_QUOTA_EXHAUSTED,
        weatherRescheduleCountAtSubmission: 2,
        status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
      };
      mockCancellationModel.create.mockResolvedValue(createdDoc);

      const result = await service.submitCancellationRequest(
        bookingId.toString(),
        customerId.toString(),
        {
          reason: 'Đã hết lượt đổi ngày, thời tiết vẫn bão cấp 8.',
          evidencePhotos: [],
        },
      );

      expect(result).toBeDefined();
      expect(result.eligibilityBasis).toBe(
        CancellationEligibilityBasis.BASIS_A_QUOTA_EXHAUSTED,
      );
      expect(mockBooking.hasPendingWeatherAction).toBe(true);
      expect(mockBooking.activeWeatherCancellationId).toEqual(requestId);
      expect(mockBooking.disputeDeferredUntil).toBeDefined();
      expect(mockBooking.save).toHaveBeenCalled();
    });

    it('should succeed with Basis B when quota < 2, RED_ALERT and evidence photos provided (AD-03)', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.DepositPaid,
        hasPendingWeatherAction: false,
        weatherRescheduleCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockCancellationModel.findOne.mockResolvedValue(null);
      mockBookingItemModel.findOne.mockResolvedValue({
        shootDate: new Date('2026-11-20'),
        shootTimeSlot: '08:00 - 10:00',
        shootLocation: 'Lăng Khải Định',
      });
      mockBookingScheduleModel.findOne.mockResolvedValue(null);
      mockSpotModel.findOne.mockResolvedValue({
        name: 'Lăng Khải Định',
        spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
        location: { coordinates: [107.59, 16.39] },
      });
      mockOpenMeteoService.getHourlyMetrics.mockResolvedValue([]);
      mockScoringService.assessTimeSlot.mockReturnValue({
        isRedAlert: true,
        hourlyBreakdown: [
          {
            isRedAlert: true,
            precipitationMm: 8.0,
            precipitationProbability: 95,
            weatherCode: 96,
          },
        ],
      });

      const createdDoc = {
        _id: requestId,
        bookingId,
        customerId,
        eligibilityBasis: CancellationEligibilityBasis.BASIS_B_FORCE_MAJEURE,
        weatherRescheduleCountAtSubmission: 1,
        status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
      };
      mockCancellationModel.create.mockResolvedValue(createdDoc);

      const result = await service.submitCancellationRequest(
        bookingId.toString(),
        customerId.toString(),
        validDto,
      );

      expect(result.eligibilityBasis).toBe(
        CancellationEligibilityBasis.BASIS_B_FORCE_MAJEURE,
      );
      expect(mockBooking.hasPendingWeatherAction).toBe(true);
      expect(mockBooking.activeWeatherCancellationId).toEqual(requestId);
      expect(mockBooking.save).toHaveBeenCalled();
    });
  });

  describe('getBookingCancellationRequest', () => {
    it('should throw BadRequestException if bookingId is invalid', async () => {
      await expect(
        service.getBookingCancellationRequest(
          'invalid-id',
          customerId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingModel.findById.mockResolvedValue(null);

      await expect(
        service.getBookingCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if customer is not owner', async () => {
      const otherId = new Types.ObjectId();
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId: otherId,
      });

      await expect(
        service.getBookingCancellationRequest(
          bookingId.toString(),
          customerId.toString(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return cancellation document if found', async () => {
      mockBookingModel.findById.mockResolvedValue({
        _id: bookingId,
        customerId,
      });
      const queryObj = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: requestId, bookingId }),
      };
      mockCancellationModel.findOne.mockReturnValue(queryObj);

      const result = await service.getBookingCancellationRequest(
        bookingId.toString(),
        customerId.toString(),
      );
      expect(result).toBeDefined();
      expect(result?._id).toEqual(requestId);
    });
  });

  describe('getCancellationRequestById', () => {
    it('should throw BadRequestException for invalid id', async () => {
      await expect(
        service.getCancellationRequestById('invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if not found', async () => {
      const queryObj = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockCancellationModel.findById.mockReturnValue(queryObj);

      await expect(
        service.getCancellationRequestById(requestId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return populated cancellation request', async () => {
      const queryObj = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: requestId }),
      };
      mockCancellationModel.findById.mockReturnValue(queryObj);

      const result = await service.getCancellationRequestById(
        requestId.toString(),
      );
      expect(result._id).toEqual(requestId);
    });
  });

  describe('listCancellationRequests', () => {
    it('should return paginated items and total', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: requestId }]),
      };
      mockCancellationModel.find.mockReturnValue(mockQuery);
      mockCancellationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const res = await service.listCancellationRequests({
        page: 1,
        limit: 10,
      });
      expect(res.items.length).toBe(1);
      expect(res.total).toBe(1);
    });
  });

  describe('adminReviewCancellation', () => {
    it('should throw BadRequestException if id is invalid', async () => {
      await expect(
        service.adminReviewCancellation('bad', adminId.toString(), {
          decision: CancellationReviewStatus.REJECTED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockCancellationModel.findById.mockResolvedValue(null);

      await expect(
        service.adminReviewCancellation(
          requestId.toString(),
          adminId.toString(),
          {
            decision: CancellationReviewStatus.REJECTED,
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if request already reviewed', async () => {
      mockCancellationModel.findById.mockResolvedValue({
        _id: requestId,
        status: CancellationReviewStatus.APPROVED_FULL_REFUND,
      });

      await expect(
        service.adminReviewCancellation(
          requestId.toString(),
          adminId.toString(),
          {
            decision: CancellationReviewStatus.REJECTED,
          },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle REJECTED decision by unlocking booking', async () => {
      const mockBooking: any = {
        _id: bookingId,
        hasPendingWeatherAction: true,
        activeWeatherCancellationId: requestId,
        save: jest.fn().mockResolvedValue(true),
      };
      const mockRequest: any = {
        _id: requestId,
        bookingId,
        status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
        save: jest.fn().mockResolvedValue(true),
      };
      mockCancellationModel.findById.mockResolvedValue(mockRequest);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      const res = await service.adminReviewCancellation(
        requestId.toString(),
        adminId.toString(),
        {
          decision: CancellationReviewStatus.REJECTED,
          notes: 'Bằng chứng vé máy bay không trùng khớp họ tên',
        },
      );

      expect(res.status).toBe(CancellationReviewStatus.REJECTED);
      expect(mockBooking.hasPendingWeatherAction).toBe(false);
      expect(mockBooking.activeWeatherCancellationId).toBeNull();
      expect(mockBooking.save).toHaveBeenCalled();
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('should handle APPROVED_FULL_REFUND decision, cancel booking, and enqueue durable refund', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: true,
        activeWeatherCancellationId: requestId,
        pricingSummary: { grandTotal: 1500000 },
        paymentSummary: { totalPaid: 1500000 },
        save: jest.fn().mockResolvedValue(true),
      };
      const mockRequest: any = {
        _id: requestId,
        bookingId,
        status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
        save: jest.fn().mockResolvedValue(true),
      };
      mockCancellationModel.findById.mockResolvedValue(mockRequest);
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockPaymentModel.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { _id: new Types.ObjectId(), amount: 1500000, refundedAmount: 0 },
          ]),
      });

      const refundDocId = new Types.ObjectId();
      mockRefundRequestModel.create.mockResolvedValue({ _id: refundDocId });
      mockRefundOutboxService.enqueueRefund.mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const res = await service.adminReviewCancellation(
        requestId.toString(),
        adminId.toString(),
        {
          decision: CancellationReviewStatus.APPROVED_FULL_REFUND,
          notes: 'Chấp thuận hoàn toàn bộ do bão đổ bộ trực tiếp',
        },
      );

      expect(res.status).toBe(CancellationReviewStatus.APPROVED_FULL_REFUND);
      expect(mockBooking.status).toBe(BookingStatus.Cancelled);
      expect(mockBooking.hasPendingWeatherAction).toBe(false);
      expect(mockRefundOutboxService.enqueueRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId,
          amount: 1500000,
          sourceEventId: `refund:weather_cancel:${requestId.toString()}`,
        }),
      );
      expect(mockRequest.refundRequestId).toEqual(refundDocId);
    });

    it('should throw BadRequestException if partial refund amount exceeds available balance', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        pricingSummary: { grandTotal: 1000000 },
        paymentSummary: { totalPaid: 1000000 },
      };
      const mockRequest: any = {
        _id: requestId,
        bookingId,
        status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
      };
      mockCancellationModel.findById.mockResolvedValue(mockRequest);
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockPaymentModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ amount: 1000000 }]),
      });

      await expect(
        service.adminReviewCancellation(
          requestId.toString(),
          adminId.toString(),
          {
            decision: CancellationReviewStatus.APPROVED_PARTIAL_REFUND,
            approvedRefundAmount: 2000000, // exceeds 1,000,000
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle APPROVED_PARTIAL_REFUND with penalty calculation', async () => {
      const mockBooking: any = {
        _id: bookingId,
        customerId,
        status: BookingStatus.Confirmed,
        hasPendingWeatherAction: true,
        activeWeatherCancellationId: requestId,
        pricingSummary: { grandTotal: 1000000 },
        paymentSummary: { totalPaid: 1000000 },
        save: jest.fn().mockResolvedValue(true),
      };
      const mockRequest: any = {
        _id: requestId,
        bookingId,
        status: CancellationReviewStatus.PENDING_ADMIN_REVIEW,
        save: jest.fn().mockResolvedValue(true),
      };
      mockCancellationModel.findById.mockResolvedValue(mockRequest);
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      mockPaymentModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ amount: 1000000 }]),
      });
      mockRefundRequestModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
      });
      mockRefundOutboxService.enqueueRefund.mockResolvedValue({});

      const res = await service.adminReviewCancellation(
        requestId.toString(),
        adminId.toString(),
        {
          decision: CancellationReviewStatus.APPROVED_PARTIAL_REFUND,
          approvedRefundAmount: 700000,
          penaltyDeducted: 300000,
          notes: 'Khấu trừ 300.000đ chi phí chuẩn bị cổ phục',
        },
      );

      expect(res.status).toBe(CancellationReviewStatus.APPROVED_PARTIAL_REFUND);
      expect(res.reviewDecision?.approvedRefundAmount).toBe(700000);
      expect(res.reviewDecision?.penaltyDeducted).toBe(300000);
      expect(mockRefundOutboxService.enqueueRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId,
          amount: 700000,
        }),
      );
      expect(mockSlotLeaseService.releaseBookingLeases).toHaveBeenCalledWith(
        bookingId,
        'CANCELLED',
      );
    });
  });
});
