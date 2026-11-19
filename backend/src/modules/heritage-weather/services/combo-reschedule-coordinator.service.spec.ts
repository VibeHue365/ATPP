import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ComboRescheduleCoordinatorService } from './combo-reschedule-coordinator.service';
import {
  ProposalChangeType,
  ProposalStatus,
  WeatherProposal,
} from '../schemas/weather-proposal.schema';
import { Booking, BookingType } from '../../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemType,
} from '../../bookings/schemas/booking-item.schema';
import { BookingSchedule } from '../../bookings/schemas/booking-schedule.schema';
import {
  InventoryReservation,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import { RedisService } from '../../../common/redis/redis.service';
import { SlotLeaseStatus } from '../../bookings/schemas/inventory-slot-lease.schema';
import { InventorySlotLeaseService } from '../../bookings/services/inventory-slot-lease.service';
import { TimeSlotEngineService } from '../../bookings/services/time-slot-engine.service';
import { ProductBusyCacheService } from '../../bookings/services/product-busy-cache.service';

describe('ComboRescheduleCoordinatorService', () => {
  let service: ComboRescheduleCoordinatorService;

  const mockProposalModel: any = {
    findById: jest.fn(),
  };

  const mockBookingModel: any = {
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockBookingItemModel: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockBookingScheduleModel: any = {
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockInventoryReservationModel: any = {
    findOne: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockRedisService: any = {
    del: jest.fn(),
    set: jest.fn(),
  };

  const mockConfigService: any = {
    get: jest.fn().mockReturnValue('https://vibe-hue.vn'),
  };

  const mockSlotLeaseService: any = {
    acquireUpfrontBlockLease: jest.fn().mockResolvedValue([]),
  };

  const mockProductBusyCacheService: any = {
    invalidate: jest.fn(),
  };

  const photoProviderId = new Types.ObjectId();
  const shopProviderId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComboRescheduleCoordinatorService,
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
        {
          provide: getModelToken(InventoryReservation.name),
          useValue: mockInventoryReservationModel,
        },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: InventorySlotLeaseService, useValue: mockSlotLeaseService },
        TimeSlotEngineService,
        {
          provide: ProductBusyCacheService,
          useValue: mockProductBusyCacheService,
        },
      ],
    }).compile();

    service = module.get<ComboRescheduleCoordinatorService>(
      ComboRescheduleCoordinatorService,
    );
  });

  describe('isComboBooking', () => {
    it('should return true for BookingType.Combo', () => {
      const booking: any = {
        bookingType: BookingType.Combo,
        providerIds: [photoProviderId],
      };
      expect(service.isComboBooking(booking)).toBe(true);
    });

    it('should return true if providerIds has multiple providers', () => {
      const booking: any = {
        bookingType: BookingType.Photography,
        providerIds: [photoProviderId, shopProviderId],
      };
      expect(service.isComboBooking(booking)).toBe(true);
    });

    it('should return false for single provider non-combo booking', () => {
      const booking: any = {
        bookingType: BookingType.Photography,
        providerIds: [photoProviderId],
      };
      expect(service.isComboBooking(booking)).toBe(false);
    });
  });

  describe('calculateRentalDateShift (BR-COMBO-02)', () => {
    it('should translate rental window by exact day difference between original and new shoot date', () => {
      const origShoot = new Date('2026-11-15T00:00:00Z');
      const newShoot = new Date('2026-11-22T00:00:00Z'); // +7 days
      const origFrom = new Date('2026-11-13T09:00:00Z');
      const origTo = new Date('2026-11-16T18:00:00Z');

      const result = service.calculateRentalDateShift(
        origShoot,
        newShoot,
        origFrom,
        origTo,
      );

      expect(result.shiftDays).toBe(7);
      expect(result.newRentalFrom).toEqual(new Date('2026-11-20T09:00:00Z'));
      expect(result.newRentalTo).toEqual(new Date('2026-11-23T18:00:00Z'));
    });
  });

  describe('checkCostumeAvailability', () => {
    it('should return available: true when no conflicting reservations exist', async () => {
      const mockItem = {
        _id: new Types.ObjectId(),
        itemType: BookingItemType.Product,
      };
      mockBookingItemModel.find.mockResolvedValueOnce([mockItem]);

      const mockRes = {
        inventoryItemId: new Types.ObjectId(),
        bookingItemId: mockItem._id,
      };
      mockInventoryReservationModel.findOne
        .mockResolvedValueOnce(mockRes) // current reservation
        .mockResolvedValueOnce(null); // no conflict

      const result = await service.checkCostumeAvailability(
        bookingId,
        new Date('2026-11-20'),
        new Date('2026-11-23'),
      );

      expect(result.available).toBe(true);
      expect(result.conflictingItemIds).toHaveLength(0);
    });

    it('should return available: false when another booking reserved the same inventory item in the new window', async () => {
      const mockItem = {
        _id: new Types.ObjectId(),
        itemType: BookingItemType.Product,
      };
      mockBookingItemModel.find.mockResolvedValueOnce([mockItem]);

      const mockRes = {
        inventoryItemId: new Types.ObjectId(),
        bookingItemId: mockItem._id,
      };
      mockInventoryReservationModel.findOne
        .mockResolvedValueOnce(mockRes) // current reservation
        .mockResolvedValueOnce({ _id: new Types.ObjectId() }); // conflicting reservation found!

      const result = await service.checkCostumeAvailability(
        bookingId,
        new Date('2026-11-20'),
        new Date('2026-11-23'),
      );

      expect(result.available).toBe(false);
      expect(result.conflictingItemIds).toContain(mockItem._id.toString());
    });
  });

  describe('coordinateComboProposalResponse (All-or-Nothing State Machine)', () => {
    const futureDateStr = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const createBaseComboProposal = (overrides?: any) => ({
      _id: new Types.ObjectId(),
      bookingId,
      providerIds: [photoProviderId, shopProviderId],
      status: ProposalStatus.PENDING,
      additionalFeeDue: 0,
      changeType: ProposalChangeType.DATE_AND_SLOT,
      originalSchedule: { date: '2026-11-15', timeSlot: '14:00-16:00' },
      proposedSchedule: {
        date: futureDateStr,
        timeSlot: '14:00-16:00',
        spotName: 'Đại Nội Huế',
      },
      providerResponses: new Map(),
      temporaryHoldRef: 'hold:photographer:123',
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    });

    const mockBooking = {
      _id: bookingId,
      bookingType: BookingType.Combo,
      providerIds: [photoProviderId, shopProviderId],
    };

    it('TC-COM-01: should immediately reject entire proposal if any provider rejects (Photo approves, Shop rejects)', async () => {
      const proposal = createBaseComboProposal();
      // Photo has already approved
      proposal.providerResponses.set(photoProviderId.toString(), {
        decision: 'APPROVED',
        respondedAt: new Date(),
      });

      mockProposalModel.findById.mockResolvedValueOnce(proposal);
      mockBookingModel.findById.mockResolvedValueOnce(mockBooking);

      // Shop rejects
      const result = await service.coordinateComboProposalResponse(
        proposal._id.toString(),
        shopProviderId.toString(),
        'REJECTED',
        'Cổ phục kín lịch vào ngày mới',
      );

      expect(result.allDecided).toBe(true);
      expect(result.overallStatus).toBe(ProposalStatus.REJECTED);
      expect(proposal.status).toBe(ProposalStatus.REJECTED);
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

    it('should keep status PENDING when only first provider approves and second has not responded', async () => {
      const proposal = createBaseComboProposal();
      mockProposalModel.findById.mockResolvedValueOnce(proposal);
      mockBookingModel.findById.mockResolvedValueOnce(mockBooking);

      // Photo approves first
      const result = await service.coordinateComboProposalResponse(
        proposal._id.toString(),
        photoProviderId.toString(),
        'APPROVED',
      );

      expect(result.allDecided).toBe(false);
      expect(result.overallStatus).toBe(ProposalStatus.PENDING);
      expect(proposal.status).toBe(ProposalStatus.PENDING);
      expect(proposal.save).toHaveBeenCalled();
    });

    it('should UNANIMOUSLY APPROVE & APPLY combo changes when both providers approve (fee = 0)', async () => {
      const proposal = createBaseComboProposal();
      // Photo approved
      proposal.providerResponses.set(photoProviderId.toString(), {
        decision: 'APPROVED',
        respondedAt: new Date(),
      });

      mockProposalModel.findById.mockResolvedValueOnce(proposal);
      mockBookingModel.findById.mockResolvedValueOnce(mockBooking);

      // No rental items or available costume
      mockBookingItemModel.findOne.mockResolvedValueOnce(null);
      mockBookingItemModel.find.mockResolvedValueOnce([]);

      // Shop approves second -> UNANIMOUS!
      const result = await service.coordinateComboProposalResponse(
        proposal._id.toString(),
        shopProviderId.toString(),
        'APPROVED',
      );

      expect(result.allDecided).toBe(true);
      expect(result.overallStatus).toBe(ProposalStatus.APPLIED);
      expect(proposal.status).toBe(ProposalStatus.APPLIED);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'hold:photographer:123',
      );
      // Incremented weatherRescheduleCount exactly once for the combo
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        { $inc: { weatherRescheduleCount: 1 } },
      );
    });

    it('should reject combo proposal if both approve but costume inventory has conflict on new dates', async () => {
      const proposal = createBaseComboProposal();
      proposal.providerResponses.set(photoProviderId.toString(), {
        decision: 'APPROVED',
        respondedAt: new Date(),
      });

      mockProposalModel.findById.mockResolvedValueOnce(proposal);
      mockBookingModel.findById.mockResolvedValueOnce(mockBooking);

      // Rental item exists
      const mockItem = {
        _id: new Types.ObjectId(),
        itemType: BookingItemType.Product,
        rentalFrom: new Date('2026-11-13T09:00:00Z'),
        rentalTo: new Date('2026-11-16T18:00:00Z'),
      };
      mockBookingItemModel.findOne.mockResolvedValueOnce(mockItem);
      mockBookingItemModel.find.mockResolvedValueOnce([mockItem]);

      // Mock conflict in inventory
      mockInventoryReservationModel.findOne
        .mockResolvedValueOnce({
          inventoryItemId: new Types.ObjectId(),
          bookingItemId: mockItem._id,
        })
        .mockResolvedValueOnce({ _id: new Types.ObjectId() }); // Conflict!

      const result = await service.coordinateComboProposalResponse(
        proposal._id.toString(),
        shopProviderId.toString(),
        'APPROVED',
      );

      expect(result.allDecided).toBe(true);
      expect(result.overallStatus).toBe(ProposalStatus.REJECTED);
      expect(result.reason).toContain('khách hàng khác đặt thuê');
      expect(proposal.status).toBe(ProposalStatus.REJECTED);
    });

    it('should release old leases and acquire new InventorySlotLease for HOURLY slotLeaseRequired combo rental item', async () => {
      const invItemId = new Types.ObjectId();
      const rentalItemId = new Types.ObjectId();
      const rentalItem: any = {
        _id: rentalItemId,
        providerId: shopProviderId,
        inventoryItemId: invItemId,
        itemType: BookingItemType.Product,
        rentalType: 'HOURLY',
        slotLeaseRequired: true,
        rentalFrom: new Date('2026-11-15T02:00:00.000Z'), // 09:00 VN
        rentalTo: new Date('2026-11-15T04:00:00.000Z'), // 11:00 VN
      };
      const proposal: any = {
        _id: new Types.ObjectId(),
        bookingId,
        changeType: ProposalChangeType.BOTH,
        originalSchedule: {
          date: '2026-11-15',
          timeSlot: '09:00 - 11:00',
        },
        proposedSchedule: {
          date: '2026-11-16',
          timeSlot: '09:00 - 11:00',
          spotName: 'Đại Nội',
          spotId: new Types.ObjectId(),
        },
      };
      const comboBooking: any = {
        _id: bookingId,
        bookingType: BookingType.Combo,
      };

      mockBookingItemModel.find.mockResolvedValueOnce([rentalItem]);
      mockInventoryReservationModel.findOne.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        inventoryItemId: invItemId,
      });
      mockBookingScheduleModel.find.mockResolvedValueOnce([]);

      await service.applyComboProposalChanges(proposal, comboBooking);

      expect(
        mockSlotLeaseService.acquireUpfrontBlockLease,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryItemId: invItemId,
          bookingId,
          bookingItemId: rentalItemId,
          status: SlotLeaseStatus.Confirmed,
          rentalSlots: [{ dateStr: '2026-11-16', slotIndex: 2 }],
        }),
      );
      expect(mockProductBusyCacheService.invalidate).toHaveBeenCalled();
    });
  });
});
