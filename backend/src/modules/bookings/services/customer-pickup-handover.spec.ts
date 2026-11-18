import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';
import { RentalFulfillmentStatus, RentalInventoryStatus, RentalIssueStatus } from '../schemas/rental-fulfillment.types';

describe('BookingsService - Customer Pickup & Handover Contract Verification', () => {
  let service: any;
  let mockBookingModel: any;
  let mockBookingItemModel: any;
  let mockInventoryItemModel: any;
  let mockSettlementsService: any;
  let mockDisputeModel: any;
  let mockNotificationsService: any;
  let mockProviderModel: any;

  const customerId = new Types.ObjectId().toString();
  const otherCustomerId = new Types.ObjectId().toString();
  const providerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId().toString();

  let mockInventoryReservationModel: any;
  let mockDb: any;

  beforeEach(() => {
    mockDisputeModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };

    mockDb = {
      model: jest.fn().mockImplementation((name) => {
        if (name === 'Dispute') return mockDisputeModel;
        return null;
      }),
      startSession: jest.fn().mockResolvedValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      }),
    };

    mockBookingModel = {
      findById: jest.fn(),
      db: mockDb,
    };

    mockBookingItemModel = {
      find: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          itemType: BookingItemType.Product,
          inventoryItemId: new Types.ObjectId(),
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockInventoryItemModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockInventoryReservationModel = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockSettlementsService = {
      holdSettlementsForBooking: jest.fn().mockResolvedValue({}),
    };

    mockNotificationsService = {
      emitBookingUpdate: jest.fn(),
      createNotification: jest.fn().mockResolvedValue({}),
    };

    mockProviderModel = {
      findById: jest.fn().mockResolvedValue({
        _id: providerId,
        userId: new Types.ObjectId(),
      }),
    };

    // Instantiate service with minimum dependencies required for customer pickup actions
    service = {
      bookingModel: mockBookingModel,
      bookingItemModel: mockBookingItemModel,
      inventoryItemModel: mockInventoryItemModel,
      inventoryReservationModel: mockInventoryReservationModel,
      settlementsService: mockSettlementsService,
      notificationsService: mockNotificationsService,
      providerModel: mockProviderModel,
      getCustomerIdStr: (booking: any) => {
        if (!booking?.customerId) return '';
        return (booking.customerId._id || booking.customerId).toString();
      },
    };

    // Bind real implementation methods from BookingsService prototype
    const { BookingsService } = require('./bookings.service');
    service.allowEarlyRentalPickup = BookingsService.prototype.allowEarlyRentalPickup.bind(service);
    service.getBookingStakeholderUserIds = BookingsService.prototype.getBookingStakeholderUserIds.bind(service);
    service.customerConfirmPickup = BookingsService.prototype.customerConfirmPickup.bind(service);
    service.customerReportDamage = BookingsService.prototype.customerReportDamage.bind(service);
    service.customerRejectHandover = BookingsService.prototype.customerRejectHandover.bind(service);
  });

  const createMockBooking = (status: BookingStatus) => ({
    _id: new Types.ObjectId(bookingId),
    bookingCode: 'B-TEST-001',
    customerId: new Types.ObjectId(customerId),
    providerIds: [providerId],
    status,
    statusTimeline: [],
    handoverPhotos: [],
    save: jest.fn().mockResolvedValue(true),
  });

  describe('customerConfirmPickup', () => {
    it('throws NotFoundException if booking not found', async () => {
      mockBookingModel.findById.mockResolvedValue(null);
      await expect(
        service.customerConfirmPickup(bookingId, customerId)
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if called by user other than owning customer', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      await expect(
        service.customerConfirmPickup(bookingId, otherCustomerId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if booking is not in pickup pending status', async () => {
      const mockBooking = createMockBooking(BookingStatus.Confirmed);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      await expect(
        service.customerConfirmPickup(bookingId, customerId)
      ).rejects.toThrow(BadRequestException);
    });

    it('returns idempotent success if booking is already PickedUp', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickedUp);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      const result = await service.customerConfirmPickup(bookingId, customerId);
      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);
    });

    it('throws BadRequestException if confirming before pickup time window (earliestStart - 60m)', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);
      // Future rental: 2 hours from now
      const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      mockBookingItemModel.find.mockResolvedValueOnce([
        {
          _id: new Types.ObjectId(),
          itemType: BookingItemType.Product,
          inventoryItemId: new Types.ObjectId(),
          rentalFulfillment: { rentalFrom: futureStart },
        },
      ]);

      await expect(
        service.customerConfirmPickup(bookingId, customerId)
      ).rejects.toThrow('Chưa đến khung giờ nhận đồ');
    });

    it('successfully confirms pickup, updates status to PickedUp, and allows optional evidence photos', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      const result = await service.customerConfirmPickup(bookingId, customerId, ['https://img.com/p1.jpg']);

      expect(result.success).toBe(true);
      expect(mockBooking.status).toBe(BookingStatus.PickedUp);
      expect(mockBooking.handoverPhotos).toContain('https://img.com/p1.jpg');
      expect(mockBooking.save).toHaveBeenCalled();
      expect(mockBookingItemModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: mockBooking._id,
          itemType: BookingItemType.Product,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.status': RentalFulfillmentStatus.PickedUp,
          }),
        }),
        expect.anything()
      );
      expect(mockNotificationsService.emitBookingUpdate).toHaveBeenCalled();
    });
  });

  describe('customerReportDamage', () => {
    it('throws BadRequestException if no evidence photos provided', async () => {
      await expect(
        service.customerReportDamage(bookingId, customerId, 'Ao bi rach nhe', [])
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if called by unauthorized user', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      await expect(
        service.customerReportDamage(bookingId, otherCustomerId, 'Vết ố vàng', ['https://img.com/p1.jpg'])
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if booking is already PickedUp', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickedUp);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      await expect(
        service.customerReportDamage(bookingId, customerId, 'Vết ố vàng', ['https://img.com/p1.jpg'])
      ).rejects.toThrow(BadRequestException);
    });

    it('records pickupDamageReport, sets status to PickedUp, and allows rental to proceed', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      const result = await service.customerReportDamage(
        bookingId,
        customerId,
        'Cúc áo thứ 2 bị lỏng, gấu áo có vết ố nhẹ',
        ['https://img.com/damage1.jpg']
      );

      expect(result.success).toBe(true);
      expect(mockBooking.status).toBe(BookingStatus.PickedUp);
      expect(mockBooking.pickupDamageReport).toBeDefined();
      expect(mockBooking.pickupDamageReport.description).toBe('Cúc áo thứ 2 bị lỏng, gấu áo có vết ố nhẹ');
      expect(mockBooking.pickupDamageReport.evidencePhotos).toEqual(['https://img.com/damage1.jpg']);
      expect(mockBooking.save).toHaveBeenCalled();
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });
  });

  describe('customerRejectHandover', () => {
    it('throws BadRequestException if no evidence photos provided', async () => {
      await expect(
        service.customerRejectHandover(bookingId, customerId, 'Sai size khong vua', [])
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if called by unauthorized user', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      await expect(
        service.customerRejectHandover(bookingId, otherCustomerId, 'Sai mau', ['https://img.com/p1.jpg'])
      ).rejects.toThrow(ForbiddenException);
    });

    it('locks inventory items, sets status to Disputed, holds settlements, and creates dispute record', async () => {
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      const result = await service.customerRejectHandover(
        bookingId,
        customerId,
        'Ao bi rach ta truoc rat nang khong the mac duoc',
        ['https://img.com/tear.jpg']
      );

      expect(result.success).toBe(true);
      expect(mockBooking.status).toBe(BookingStatus.Disputed);
      expect(mockInventoryItemModel.updateMany).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            conditionStatus: 'LOCKED',
          }),
        }),
        expect.anything(),
      );
      expect(mockBookingItemModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: mockBooking._id }),
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.status': RentalFulfillmentStatus.Cancelled,
            'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Maintenance,
            'rentalFulfillment.issueStatus': RentalIssueStatus.Reported,
          }),
        }),
        expect.anything(),
      );
      expect(mockSettlementsService.holdSettlementsForBooking).toHaveBeenCalledWith(
        mockBooking._id.toString(),
        expect.stringContaining('Customer reject handover'),
        customerId,
        expect.anything(),
      );
      expect(mockDisputeModel.findOneAndUpdate).toHaveBeenCalledWith(
        { bookingId: mockBooking._id },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            status: 'OPEN',
            reason: expect.stringContaining('Khách hàng từ chối nhận đồ do lỗi nặng'),
            evidencePhotos: ['https://img.com/tear.jpg'],
          }),
        }),
        expect.objectContaining({ upsert: true, returnDocument: 'after' })
      );
    });

    it('locks inventory items even when bookingItem has no inventoryItemId but InventoryReservation has it (legacy order draft)', async () => {
      const legacyInvId = new Types.ObjectId();
      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      // bookingItem has NO inventoryItemId
      mockBookingItemModel.find.mockResolvedValueOnce([
        {
          _id: new Types.ObjectId(),
          itemType: BookingItemType.Product,
          inventoryItemId: null,
        },
      ]);

      // InventoryReservation DOES have inventoryItemId
      mockInventoryReservationModel.find.mockResolvedValueOnce([
        {
          _id: new Types.ObjectId(),
          inventoryItemId: legacyInvId,
        },
      ]);

      const result = await service.customerRejectHandover(
        bookingId,
        customerId,
        'Ao bi son rach',
        ['https://img.com/torn.jpg']
      );

      expect(result.success).toBe(true);
      expect(mockInventoryItemModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [legacyInvId] } },
        expect.objectContaining({
          $set: expect.objectContaining({
            conditionStatus: 'LOCKED',
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe('Multi-Collection Transaction Rollback & Failure-path Verification (Item 1 & 5)', () => {
    it('aborts transaction and rolls back when inventoryItem update fails in customerConfirmPickup', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      mockDb.startSession = jest.fn().mockResolvedValue(mockSession);

      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      mockInventoryItemModel.updateMany.mockRejectedValueOnce(
        new Error('DB Connection Dropped during inventory update')
      );

      await expect(
        service.customerConfirmPickup(bookingId, customerId)
      ).rejects.toThrow('DB Connection Dropped during inventory update');

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('aborts transaction and rolls back when dispute creation fails in customerRejectHandover', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      mockDb.startSession = jest.fn().mockResolvedValue(mockSession);

      const mockBooking = createMockBooking(BookingStatus.PickupPending);
      mockBookingModel.findById.mockResolvedValue(mockBooking);

      mockDisputeModel.findOneAndUpdate.mockRejectedValueOnce(
        new Error('Duplicate dispute key error')
      );

      await expect(
        service.customerRejectHandover(bookingId, customerId, 'Loi nut ao', ['https://img.com/p.jpg'])
      ).rejects.toThrow();

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
