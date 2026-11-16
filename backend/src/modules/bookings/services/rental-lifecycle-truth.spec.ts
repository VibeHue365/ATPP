import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus, BookingType } from '../schemas/booking.schema';
import { BookingItemType } from '../schemas/booking-item.schema';
import {
  RentalFulfillmentStatus,
  DepositSettlementStatus,
  RentalIssueStatus,
} from '../schemas/rental-fulfillment.types';
import { RentalFulfillmentWorkflowService } from './rental-fulfillment-workflow.service';
import { AdminStatsService } from '../../admin-stats/admin-stats.service';

const query = (value: unknown) => ({
  select: () => query(value),
  lean: () => ({ exec: async () => value }),
  exec: async () => value,
});

describe('Rental Lifecycle Single Source of Truth & Role Separation (Requirement E)', () => {
  describe('Requirement 1 & 2: Customer cannot bypass Admin / Provider via confirmCompleteByCustomer', () => {
    let bookingsService: any;
    let mockBookingModel: any;
    let mockBookingItemModel: any;
    let mockPaymentsService: any;
    const customerId = new Types.ObjectId().toString();
    const bookingId = new Types.ObjectId().toString();

    beforeEach(() => {
      mockPaymentsService = {
        settleBooking: jest.fn().mockResolvedValue({}),
      };
      mockBookingModel = {
        findById: jest.fn(),
      };
      mockBookingItemModel = {
        find: jest.fn(),
        updateMany: jest.fn(),
      };

      // Import BookingsService prototype methods to test
      const BookingsService = require('./bookings.service').BookingsService;
      bookingsService = Object.create(BookingsService.prototype);
      bookingsService.bookingModel = mockBookingModel;
      bookingsService.bookingItemModel = mockBookingItemModel;
      bookingsService.paymentsService = mockPaymentsService;
      bookingsService.notificationsService = {
        createNotification: jest.fn(),
        emitBookingUpdate: jest.fn(),
      };
      bookingsService.getCustomerIdStr = (b: any) =>
        (b.customerId?._id || b.customerId || '').toString();
    });

    it('1. Rejects (409) when item is RETURNED but deposit is PENDING_SETTLEMENT or charges are PROPOSED', async () => {
      const booking = {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.Returned,
        bookingType: BookingType.AoDaiRental,
      };
      mockBookingModel.findById.mockResolvedValue(booking);

      // Item has been returned but deposit is still pending settlement
      mockBookingItemModel.find.mockReturnValue({
        lean: () => ({
          exec: async () => [
            {
              _id: new Types.ObjectId(),
              bookingId: booking._id,
              itemType: BookingItemType.Product,
              rentalFulfillment: {
                status: RentalFulfillmentStatus.Returned,
                depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
                issueStatus: RentalIssueStatus.None,
              },
            },
          ],
        }),
      });

      await expect(
        bookingsService.confirmCompleteByCustomer(bookingId, customerId),
      ).rejects.toThrow(ConflictException);

      await expect(
        bookingsService.confirmCompleteByCustomer(bookingId, customerId),
      ).rejects.toThrow('Shop/Admin đang kiểm tra trang phục và tất toán cọc');

      expect(mockPaymentsService.settleBooking).not.toHaveBeenCalled();
    });

    it('2. Rejects (409) and prevents items in PICKED_UP or READY_FOR_PICKUP from becoming COMPLETED via confirm-complete', async () => {
      const booking = {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.PickedUp,
        bookingType: BookingType.AoDaiRental,
      };
      mockBookingModel.findById.mockResolvedValue(booking);

      mockBookingItemModel.find.mockReturnValue({
        lean: () => ({
          exec: async () => [
            {
              _id: new Types.ObjectId(),
              bookingId: booking._id,
              itemType: BookingItemType.Product,
              rentalFulfillment: {
                status: RentalFulfillmentStatus.PickedUp,
                depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
              },
            },
          ],
        }),
      });

      await expect(
        bookingsService.confirmCompleteByCustomer(bookingId, customerId),
      ).rejects.toThrow(BadRequestException);

      // Even if called with completeBooking directly by customer
      await expect(
        bookingsService.completeBooking(bookingId, customerId, ['CUSTOMER']),
      ).rejects.toThrow(ConflictException);

      expect(mockBookingItemModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 3: Generic PATCH status rejected for AoDaiRental lifecycle statuses', () => {
    let bookingsService: any;
    let mockBookingModel: any;
    let mockBookingItemModel: any;
    const bookingId = new Types.ObjectId().toString();

    beforeEach(() => {
      mockBookingModel = {
        findById: jest.fn(),
      };
      mockBookingItemModel = {
        exists: jest.fn().mockResolvedValue(true),
      };

      const BookingsService = require('./bookings.service').BookingsService;
      bookingsService = Object.create(BookingsService.prototype);
      bookingsService.bookingModel = mockBookingModel;
      bookingsService.bookingItemModel = mockBookingItemModel;
      bookingsService.providerModel = {
        find: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
      };
      bookingsService.getCustomerIdStr = () => 'cust-1';
    });

    it('3. Rejects generic status update to PICKUP_PENDING, PICKED_UP, RETURNED, COMPLETED for AoDaiRental', async () => {
      const booking = {
        _id: new Types.ObjectId(bookingId),
        bookingType: BookingType.AoDaiRental,
        status: BookingStatus.Confirmed,
        providerIds: [new Types.ObjectId()],
      };
      mockBookingModel.findById.mockResolvedValue(booking);

      for (const forbiddenStatus of [
        BookingStatus.PickupPending,
        BookingStatus.PickedUp,
        BookingStatus.ReturnPending,
        BookingStatus.Returned,
        BookingStatus.Completed,
      ]) {
        await expect(
          bookingsService.updateBookingStatus(
            bookingId,
            forbiddenStatus,
            'Test update',
            'prov-user-1',
            ['PROVIDER'],
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          bookingsService.updateBookingStatus(
            bookingId,
            forbiddenStatus,
            'Test update',
            'prov-user-1',
            ['PROVIDER'],
          ),
        ).rejects.toThrow('Đơn hàng thuê áo dài có quy trình bàn giao từng sản phẩm');
      }
    });
  });

  describe('Requirement 4 & 5: Shop cleaning-completed and condition / issue guards', () => {
    const bookingId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const providerUserId = new Types.ObjectId();
    const providerUser = { sub: providerUserId.toString(), roles: ['PROVIDER'] } as any;

    function buildWorkflowService(overrides?: {
      inventoryStatus?: string;
      conditionStatus?: string;
      issueStatus?: string;
      fulfillmentStatus?: RentalFulfillmentStatus;
    }) {
      const invStatus = overrides?.inventoryStatus ?? 'CLEANING';
      const condStatus = overrides?.conditionStatus ?? 'GOOD';
      const issueStatus = overrides?.issueStatus ?? RentalIssueStatus.None;
      const fulStatus = overrides?.fulfillmentStatus ?? RentalFulfillmentStatus.Returned;

      const inventoryItemModel = {
        find: jest.fn(() => query([{ _id: new Types.ObjectId(), status: invStatus, conditionStatus: condStatus }])),
        updateMany: jest.fn(() => ({
          exec: async () => ({ modifiedCount: invStatus === 'CLEANING' && !['LOCKED', 'RETIRED', 'MINOR_DAMAGE'].includes(condStatus) ? 1 : 0 }),
        })),
      };
      const reservationModel = {
        find: jest.fn(() => query([{ inventoryItemId: new Types.ObjectId() }])),
      };
      const bookingModel = {
        findById: jest.fn(() => query({ _id: bookingId, customerId, status: 'RETURNED', bookingType: BookingType.AoDaiRental })),
        findOneAndUpdate: jest.fn(() => query({ _id: bookingId })),
      };
      const itemModel = {
        findOne: jest.fn(() => query({
          _id: itemId,
          bookingId,
          providerId,
          itemType: 'PRODUCT',
          rentalFulfillment: { status: fulStatus, issueStatus },
        })),
        findById: jest.fn(() => query({
          _id: itemId,
          bookingId,
          providerId,
          itemType: 'PRODUCT',
          rentalFulfillment: { status: fulStatus, issueStatus },
        })),
        updateOne: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
        find: jest.fn(() => query([{ _id: itemId, rentalFulfillment: { status: fulStatus } }])),
        db: {
          model: jest.fn((name: string) => {
            if (name === 'InventoryItem') return inventoryItemModel;
            if (name === 'InventoryReservation') return reservationModel;
            return {};
          }),
        },
      };
      const providerModel = {
        findOne: jest.fn(() => query({ _id: providerId })),
      };

      const slotLeaseService = {
        reconcileTurnaroundLeases: jest.fn().mockResolvedValue(undefined),
      };
      const paymentsService = {
        settleBooking: jest.fn().mockResolvedValue(undefined),
      };
      const rentalDepositRefundCoordinator = {
        coordinate: jest.fn().mockResolvedValue(undefined),
      };

      return new RentalFulfillmentWorkflowService(
        bookingModel as any,
        itemModel as any,
        providerModel as any,
        {} as any,
        paymentsService as any,
        {} as any,
        rentalDepositRefundCoordinator as any,
        slotLeaseService as any,
      );
    }

    it('4. Shop can call cleaning-completed when valid; updates status CLEANING -> AVAILABLE', async () => {
      const workflow = buildWorkflowService({
        inventoryStatus: 'CLEANING',
        conditionStatus: 'GOOD',
        issueStatus: RentalIssueStatus.None,
        fulfillmentStatus: RentalFulfillmentStatus.Returned,
      });

      const res = await workflow.markCleaningCompleted(
        bookingId.toString(),
        itemId.toString(),
        providerUser,
        'Shop đã giặt sấy thơm tho',
      );

      expect(res).toBeDefined();
      expect(res.message).toBe('Xác nhận hoàn tất giặt ủi thành công');
    });

    it('5. Rejects (409) cleaning-completed when asset is LOCKED, MAINTENANCE, or issue is unresolved (REPORTED)', async () => {
      // 5a. Blocked due to LOCKED asset
      const lockedWorkflow = buildWorkflowService({
        inventoryStatus: 'CLEANING',
        conditionStatus: 'LOCKED',
      });
      await expect(
        lockedWorkflow.markCleaningCompleted(bookingId.toString(), itemId.toString(), providerUser),
      ).rejects.toThrow(ConflictException);

      // 5b. Blocked due to MAINTENANCE asset
      const maintenanceWorkflow = buildWorkflowService({
        inventoryStatus: 'MAINTENANCE',
        conditionStatus: 'GOOD',
      });
      await expect(
        maintenanceWorkflow.markCleaningCompleted(bookingId.toString(), itemId.toString(), providerUser),
      ).rejects.toThrow(ConflictException);

      // 5c. Blocked due to unresolved issue (REPORTED)
      const issueWorkflow = buildWorkflowService({
        inventoryStatus: 'CLEANING',
        conditionStatus: 'GOOD',
        issueStatus: RentalIssueStatus.Reported,
      });
      await expect(
        issueWorkflow.markCleaningCompleted(bookingId.toString(), itemId.toString(), providerUser),
      ).rejects.toThrow(ConflictException);
      await expect(
        issueWorkflow.markCleaningCompleted(bookingId.toString(), itemId.toString(), providerUser),
      ).rejects.toThrow('Không thể hoàn tất giặt ủi khi sự cố chưa được giải quyết');
    });
  });

  describe('Requirement 6: Admin direct status endpoint cannot bypass item lifecycle', () => {
    let adminStatsService: AdminStatsService;
    let mockBookingModel: any;
    let mockBookingItemModel: any;
    const bookingId = new Types.ObjectId().toString();

    beforeEach(() => {
      mockBookingModel = {
        findById: jest.fn(),
        findOne: jest.fn(),
      };
      mockBookingItemModel = {
        exists: jest.fn().mockResolvedValue(true),
      };

      adminStatsService = new AdminStatsService(
        {} as any,
        {} as any,
        {} as any,
        mockBookingModel as any,
        mockBookingItemModel as any,
        {} as any,
        {} as any,
      );
    });

    it('6. Admin direct status update rejects COMPLETED, PICKED_UP, RETURNED for rental bookings', async () => {
      const rentalBooking = {
        _id: new Types.ObjectId(bookingId),
        bookingType: BookingType.AoDaiRental,
        status: BookingStatus.Confirmed,
        save: jest.fn().mockResolvedValue({}),
      };
      mockBookingModel.findById.mockResolvedValue(rentalBooking);

      for (const directStatus of ['COMPLETED', 'PICKED_UP', 'RETURNED', 'PICKUP_PENDING', 'RETURN_PENDING']) {
        await expect(
          adminStatsService.updateBookingStatus(bookingId, directStatus, 'Admin override attempt'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          adminStatsService.updateBookingStatus(bookingId, directStatus, 'Admin override attempt'),
        ).rejects.toThrow('Không được gán trực tiếp trạng thái');
      }

      expect(rentalBooking.save).not.toHaveBeenCalled();
    });

    it('6b. Admin can update DISPUTED / CANCELLED with audit trail', async () => {
      const rentalBooking = {
        _id: new Types.ObjectId(bookingId),
        bookingType: BookingType.AoDaiRental,
        status: BookingStatus.Confirmed,
        statusTimeline: [],
        notes: [],
        save: jest.fn().mockResolvedValue({}),
      };
      mockBookingModel.findById.mockResolvedValue(rentalBooking);

      const res = await adminStatsService.updateBookingStatus(
        bookingId,
        BookingStatus.Disputed,
        'Khách báo tranh chấp cọc',
      );

      expect(res.success).toBe(true);
      expect(rentalBooking.status).toBe(BookingStatus.Disputed);
      expect(rentalBooking.statusTimeline.length).toBe(1);
      expect(rentalBooking.save).toHaveBeenCalled();
    });
  });

  describe('Comprehensive 10 Quality Criteria Verification', () => {
    let bookingsService: any;
    let rentalFulfillmentService: any;
    let coordinatorService: any;
    let mockBookingModel: any;
    let mockBookingItemModel: any;
    let mockRefundsWorkflow: any;

    const customerId = new Types.ObjectId().toString();
    const providerId = new Types.ObjectId().toString();
    const bookingId = new Types.ObjectId().toString();
    const itemIdA = new Types.ObjectId().toString();
    const itemIdB = new Types.ObjectId().toString();

    beforeEach(() => {
      mockBookingModel = {
        findById: jest.fn(),
        updateOne: jest.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) })),
      };
      mockBookingItemModel = {
        find: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        findOneAndUpdate: jest.fn(),
      };
      mockRefundsWorkflow = {
        createFromRentalSettlement: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          status: 'REQUESTED',
        }),
      };

      const BookingsService = require('./bookings.service').BookingsService;
      bookingsService = Object.create(BookingsService.prototype);
      bookingsService.bookingModel = mockBookingModel;
      bookingsService.bookingItemModel = mockBookingItemModel;
      bookingsService.providerModel = { find: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(providerId) }]) };
      bookingsService.notificationsService = { emitBookingUpdate: jest.fn() };
      bookingsService.getCustomerIdStr = (b: any) => (b.customerId?._id || b.customerId || '').toString();

      const RentalFulfillmentService = require('./rental-fulfillment.service').RentalFulfillmentService;
      rentalFulfillmentService = new RentalFulfillmentService(mockBookingItemModel);

      const CoordinatorService = require('./rental-deposit-refund-coordinator.service').RentalDepositRefundCoordinatorService;
      coordinatorService = new CoordinatorService(mockBookingModel, mockBookingItemModel, mockRefundsWorkflow);
    });

    it('Criteria 1: Customer return without evidence photos is rejected (400 BadRequest)', async () => {
      const booking = {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.PickedUp,
        bookingType: BookingType.AoDaiRental,
      };
      mockBookingModel.findById.mockResolvedValue(booking);

      await expect(
        bookingsService.customerReturn(bookingId, customerId, ['CUSTOMER'], 'note', []),
      ).rejects.toThrow(BadRequestException);

      await expect(
        bookingsService.customerReturn(bookingId, customerId, ['CUSTOMER'], 'note', undefined as any),
      ).rejects.toThrow('Bắt buộc tải lên ít nhất một ảnh bằng chứng tình trạng áo khi trả');
    });

    it('Criteria 2: Customer return for item A updates ONLY item A to CUSTOMER_RETURN_REQUESTED and does NOT modify item B', async () => {
      const booking = {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.PickedUp,
        statusTimeline: [],
        bookingType: BookingType.AoDaiRental,
        save: jest.fn().mockResolvedValue({}),
      };
      mockBookingModel.findById.mockResolvedValue(booking);

      const itemA = {
        _id: new Types.ObjectId(itemIdA),
        bookingId: booking._id,
        itemType: BookingItemType.Product,
        rentalFulfillment: { status: RentalFulfillmentStatus.PickedUp },
      };
      const itemB = {
        _id: new Types.ObjectId(itemIdB),
        bookingId: booking._id,
        itemType: BookingItemType.Product,
        rentalFulfillment: { status: RentalFulfillmentStatus.PickedUp },
      };
      mockBookingItemModel.find.mockReturnValue(query([itemA, itemB]));

      await bookingsService.customerReturn(
        bookingId,
        customerId,
        ['CUSTOMER'],
        'Trả áo A trước',
        ['photo-a.jpg'],
        itemIdA,
      );

      expect(mockBookingItemModel.updateOne).toHaveBeenCalledWith(
        { _id: itemA._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.status': RentalFulfillmentStatus.CustomerReturnRequested,
          }),
        }),
      );
      expect(mockBookingItemModel.updateOne).not.toHaveBeenCalledWith(
        { _id: itemB._id },
        expect.anything(),
      );
    });

    it('Criteria 3: Shop cannot mark returned when item is still in PICKED_UP status (409 Conflict)', async () => {
      mockBookingItemModel.findOne.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            rentalFulfillment: { status: RentalFulfillmentStatus.PickedUp },
          }),
        }),
      });

      await expect(
        rentalFulfillmentService.markReturned({
          itemId: itemIdA,
          actor: { id: providerId, role: 'PROVIDER' },
          evidence: { files: [{ fileId: 'f1', type: 'IMAGE', uploadedAt: new Date(), uploadedBy: { id: providerId, role: 'PROVIDER' } }] },
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        rentalFulfillmentService.markReturned({
          itemId: itemIdA,
          actor: { id: providerId, role: 'PROVIDER' },
          evidence: { files: [{ fileId: 'f1', type: 'IMAGE', uploadedAt: new Date(), uploadedBy: { id: providerId, role: 'PROVIDER' } }] },
        }),
      ).rejects.toThrow('Khách hàng chưa gửi yêu cầu trả áo');
    });

    it('Criteria 4: Shop cannot call confirm-no-incident when item is in CUSTOMER_RETURN_REQUESTED before received confirmation (409 Conflict)', async () => {
      mockBookingItemModel.findOne.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            rentalFulfillment: { status: RentalFulfillmentStatus.CustomerReturnRequested },
          }),
        }),
      });

      await expect(
        rentalFulfillmentService.confirmNoIncident({
          itemId: itemIdA,
          actor: { id: providerId, role: 'PROVIDER' },
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        rentalFulfillmentService.confirmNoIncident({
          itemId: itemIdA,
          actor: { id: providerId, role: 'PROVIDER' },
        }),
      ).rejects.toThrow('Áo dài chưa ở bước nhận lại để xác nhận kiểm tra');
    });

    it('Criteria 5: Shop confirms handover with evidence photos -> item transitions to RETURNED', async () => {
      mockBookingItemModel.findOne.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            depositAmount: 200000,
            quantity: 1,
            rentalFulfillment: { status: RentalFulfillmentStatus.CustomerReturnRequested },
          }),
        }),
      });

      mockBookingItemModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            rentalFulfillment: { status: RentalFulfillmentStatus.Returned },
          }),
        }),
      });

      const res = await rentalFulfillmentService.markReturned({
        itemId: itemIdA,
        actor: { id: providerId, role: 'PROVIDER' },
        evidence: { files: [{ fileId: 'shop-evidence-1.jpg', type: 'IMAGE', uploadedAt: new Date(), uploadedBy: { id: providerId, role: 'PROVIDER' } }] },
      });

      expect(res.rentalFulfillment.status).toBe(RentalFulfillmentStatus.Returned);
      expect(mockBookingItemModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: new Types.ObjectId(itemIdA),
          'rentalFulfillment.status': { $in: [RentalFulfillmentStatus.CustomerReturnRequested, RentalFulfillmentStatus.Returned] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.status': RentalFulfillmentStatus.Returned,
            'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PendingSettlement,
          }),
        }),
        expect.anything(),
      );
    });

    it('Criteria 6: markReturned keeps deposit in PENDING_SETTLEMENT, does NOT release deposit or create refund', async () => {
      mockBookingItemModel.findOne.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            depositAmount: 500000,
            quantity: 1,
            rentalFulfillment: {
              status: RentalFulfillmentStatus.CustomerReturnRequested,
              depositSettlementStatus: DepositSettlementStatus.Held,
            },
          }),
        }),
      });

      mockBookingItemModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            rentalFulfillment: {
              status: RentalFulfillmentStatus.Returned,
              depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
            },
          }),
        }),
      });

      await rentalFulfillmentService.markReturned({
        itemId: itemIdA,
        actor: { id: providerId, role: 'PROVIDER' },
        evidence: { files: [{ fileId: 'rec.jpg', type: 'IMAGE', uploadedAt: new Date(), uploadedBy: { id: providerId, role: 'PROVIDER' } }] },
      });

      expect(mockBookingItemModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PendingSettlement,
            'rentalFulfillment.depositRefundAmount': 0,
            'rentalFulfillment.depositDeductedAmount': 0,
          }),
        }),
        expect.anything(),
      );
      expect(mockRefundsWorkflow.createFromRentalSettlement).not.toHaveBeenCalled();
    });

    it('Criteria 7: confirmNoIncident sets deposit to FULLY_RELEASED, and coordinator creates refund exactly once', async () => {
      const depositAmt = 350000;
      mockBookingItemModel.findOne.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            depositAmount: depositAmt,
            quantity: 1,
            rentalFulfillment: {
              status: RentalFulfillmentStatus.Returned,
              depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
            },
          }),
        }),
      });

      mockBookingItemModel.findOneAndUpdate.mockReturnValue({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(itemIdA),
            rentalFulfillment: {
              status: RentalFulfillmentStatus.Returned,
              depositSettlementStatus: DepositSettlementStatus.FullyReleased,
              depositRefundAmount: depositAmt,
            },
          }),
        }),
      });

      const updated = await rentalFulfillmentService.confirmNoIncident({
        itemId: itemIdA,
        actor: { id: providerId, role: 'PROVIDER' },
        note: 'Đồ nguyên vẹn',
      });

      expect(updated.rentalFulfillment.depositSettlementStatus).toBe(DepositSettlementStatus.FullyReleased);

      mockBookingModel.findById.mockReturnValue(
        query({
          _id: new Types.ObjectId(bookingId),
          customerId: new Types.ObjectId(customerId),
          bookingType: BookingType.AoDaiRental,
          rentalDepositRefund: { status: 'PENDING' },
        }),
      );

      mockBookingItemModel.find.mockReturnValue(
        query([
          {
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            depositAmount: depositAmt,
            quantity: 1,
            rentalFulfillment: {
              status: RentalFulfillmentStatus.Returned,
              depositSettlementStatus: DepositSettlementStatus.FullyReleased,
              depositRefundAmount: depositAmt,
            },
          },
        ]),
      );

      const refundResult = await coordinatorService.coordinate(bookingId);
      expect(refundResult.status).toBe('REQUESTED');
      expect(mockRefundsWorkflow.createFromRentalSettlement).toHaveBeenCalledTimes(1);
      expect(mockRefundsWorkflow.createFromRentalSettlement).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId,
          amount: depositAmt,
        }),
      );
    });

    it('Criteria 8: Parallel/retry coordinator requests do not create duplicate refund requests', async () => {
      mockBookingModel.findById.mockReturnValue(
        query({
          _id: new Types.ObjectId(bookingId),
          customerId: new Types.ObjectId(customerId),
          bookingType: BookingType.AoDaiRental,
          rentalDepositRefund: {
            status: 'REQUESTED',
            amount: 300000,
            refundRequestId: new Types.ObjectId(),
          },
        }),
      );

      const result = await coordinatorService.coordinate(bookingId);
      expect(result.status).toBe('REQUESTED');
      expect(mockRefundsWorkflow.createFromRentalSettlement).not.toHaveBeenCalled();
    });

    it('Criteria 9: If any rental item is still in CLEANING / PENDING_SETTLEMENT, booking cannot complete', async () => {
      const booking = {
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.Returned,
        bookingType: BookingType.AoDaiRental,
      };
      mockBookingModel.findById.mockResolvedValue(booking);

      mockBookingItemModel.find.mockReturnValue({
        lean: () => ({
          exec: async () => [
            {
              _id: new Types.ObjectId(itemIdA),
              itemType: BookingItemType.Product,
              rentalFulfillment: {
                status: RentalFulfillmentStatus.Returned,
                depositSettlementStatus: DepositSettlementStatus.FullyReleased,
                issueStatus: RentalIssueStatus.None,
              },
            },
            {
              _id: new Types.ObjectId(itemIdB),
              itemType: BookingItemType.Product,
              rentalFulfillment: {
                status: RentalFulfillmentStatus.Returned,
                depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
                issueStatus: RentalIssueStatus.None,
              },
            },
          ],
        }),
      });

      await expect(
        bookingsService.confirmCompleteByCustomer(bookingId, customerId),
      ).rejects.toThrow(ConflictException);

      await expect(
        bookingsService.confirmCompleteByCustomer(bookingId, customerId),
      ).rejects.toThrow('Shop/Admin đang kiểm tra trang phục và tất toán cọc');
    });

    it('Criteria 10: Multi-item booking allows item A to be RETURNED while item B remains in PICKED_UP', async () => {
      mockBookingModel.findById.mockReturnValue(
        query({
          _id: new Types.ObjectId(bookingId),
          customerId: new Types.ObjectId(customerId),
          bookingType: BookingType.AoDaiRental,
          rentalDepositRefund: { status: 'PENDING' },
        }),
      );

      mockBookingItemModel.find.mockReturnValue(
        query([
          {
            _id: new Types.ObjectId(itemIdA),
            itemType: BookingItemType.Product,
            rentalFulfillment: {
              status: RentalFulfillmentStatus.Returned,
              depositSettlementStatus: DepositSettlementStatus.FullyReleased,
            },
          },
          {
            _id: new Types.ObjectId(itemIdB),
            itemType: BookingItemType.Product,
            rentalFulfillment: {
              status: RentalFulfillmentStatus.PickedUp,
              depositSettlementStatus: DepositSettlementStatus.Held,
            },
          },
        ]),
      );

      const coordRes = await coordinatorService.coordinate(bookingId);
      expect(coordRes.status).toBe('PENDING');
      expect(mockRefundsWorkflow.createFromRentalSettlement).not.toHaveBeenCalled();
    });
  });
});
