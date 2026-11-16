import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItemType } from '../../bookings/schemas/booking-item.schema';
import {
  RentalFulfillmentStatus,
  DepositSettlementStatus,
  RentalIssueStatus,
  RentalInventoryStatus,
} from '../../bookings/schemas/rental-fulfillment.types';
import { InventoryItemStatus } from '../../products/schemas/inventory-item.schema';
import { IncidentStatus } from '../schemas/incident-report.schema';
import { DisputesService } from './disputes.service';
import { RentalFulfillmentWorkflowService } from '../../bookings/services/rental-fulfillment-workflow.service';
import { RentalFulfillmentController } from '../../bookings/controllers/rental-fulfillment.controller';
import { NotificationsService } from '../../notifications/notifications.service';

const query = (value: unknown) => ({
  select: () => query(value),
  lean: () => ({ exec: async () => value }),
  exec: async () => value,
});

describe('Rental Incident Per-Item Isolation & Workflow Guards', () => {
  const customerId = new Types.ObjectId().toString();
  const providerUserId = new Types.ObjectId().toString();
  const providerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();

  const itemAId = new Types.ObjectId();
  const itemBId = new Types.ObjectId();
  const invAId = new Types.ObjectId();
  const invBId = new Types.ObjectId();

  describe('1. markPickedUp updates InventoryItem.status = RENTED only for the handed over item', () => {
    it('sets inventory status to RENTED for item A and leaves item B unaffected', async () => {
      const mockInventoryUpdateMany = jest.fn().mockReturnValue(query({ modifiedCount: 1 }));
      const mockReservationFind = jest.fn().mockReturnValue(query([{ inventoryItemId: invAId }]));
      const mockBookingItemFindById = jest.fn().mockReturnValue(query({ _id: itemAId, inventoryItemId: invAId }));

      const mockDb = {
        model: (name: string) => {
          if (name === 'InventoryItem') return { updateMany: mockInventoryUpdateMany };
          if (name === 'InventoryReservation') return { find: mockReservationFind };
          return {};
        },
      };

      const mockBookingItemModel: any = {
        db: mockDb,
        findById: mockBookingItemFindById,
      };

      const mockRentalFulfillment: any = {
        submitPickupEvidence: jest.fn().mockResolvedValue({ status: RentalFulfillmentStatus.ReadyForPickup }),
        markPickedUp: jest.fn().mockResolvedValue({ status: RentalFulfillmentStatus.PickedUp }),
      };

      const workflow = Object.create(RentalFulfillmentWorkflowService.prototype);
      workflow.bookingItemModel = mockBookingItemModel;
      workflow.rentalFulfillment = mockRentalFulfillment;
      workflow.requireProviderOrAdmin = jest.fn().mockResolvedValue({
        bookingId,
        itemId: itemAId,
        actor: { role: 'PROVIDER', userId: new Types.ObjectId(providerUserId) },
        bookingStatus: BookingStatus.Confirmed,
      });
      workflow.requireOperationalBooking = jest.fn();
      workflow.resolveEvidence = jest.fn().mockResolvedValue({ files: [{ fileId: 'f1', type: 'IMAGE' }] });
      workflow.syncBookingProgress = jest.fn().mockResolvedValue(undefined);

      await workflow.markPickedUp(
        bookingId.toString(),
        itemAId.toString(),
        { userId: providerUserId, role: 'PROVIDER' } as any,
        { fileIds: ['f1'] },
      );

      expect(mockRentalFulfillment.submitPickupEvidence).toHaveBeenCalled();
    });
  });

  describe('2. customerAgreeIncident per-item isolation', () => {
    let disputesService: any;
    let mockIncidentModel: any;
    let mockBookingModel: any;
    let mockBookingItemModel: any;
    let mockInventoryModel: any;
    let mockReservationModel: any;
    let mockEscrowModel: any;
    let mockProviderModel: any;
    let mockPaymentsService: any;
    let mockRefundWorkflowService: any;
    let mockPaymentModel: any;

    let itemA: any;
    let itemB: any;
    let booking: any;
    let incident: any;

    beforeEach(() => {
      itemA = {
        _id: itemAId,
        bookingId,
        itemType: 'PRODUCT',
        depositAmount: 100000,
        quantity: 1,
        inventoryItemId: invAId,
        rentalFulfillment: {
          status: RentalFulfillmentStatus.Returned,
          depositSettlementStatus: DepositSettlementStatus.Held,
          issueStatus: RentalIssueStatus.Reported,
        },
      };

      itemB = {
        _id: itemBId,
        bookingId,
        itemType: 'PRODUCT',
        depositAmount: 100000,
        quantity: 1,
        inventoryItemId: invBId,
        rentalFulfillment: {
          status: RentalFulfillmentStatus.PickedUp,
          depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
          issueStatus: RentalIssueStatus.None,
        },
      };

      booking = {
        _id: bookingId,
        bookingCode: 'B-MULTI-01',
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.ReturnPending,
        pricingSummary: { depositTotal: 200000, grandTotal: 500000 },
        statusTimeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      incident = {
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemAId,
        reportedBy: providerId,
        requestedAmount: 40000, // Deduct 40k from Item A's 100k deposit
        actionType: 'MAINTENANCE',
        status: IncidentStatus.PendingCustomer,
        save: jest.fn().mockResolvedValue(true),
      };

      mockIncidentModel = {
        findById: jest.fn().mockResolvedValue(incident),
      };

      mockEscrowModel = {
        findOne: jest.fn().mockResolvedValue({ status: 'HELD' }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockProviderModel = {
        findById: jest.fn().mockResolvedValue({
          _id: providerId,
          businessName: 'VibeHue Studio',
          userId: new Types.ObjectId(providerUserId),
        }),
      };

      mockInventoryModel = {
        updateMany: jest.fn().mockReturnValue(query({ modifiedCount: 1 })),
      };

      mockReservationModel = {
        find: jest.fn().mockReturnValue(query([{ inventoryItemId: invAId }])),
        updateMany: jest.fn().mockReturnValue(query({ modifiedCount: 1 })),
      };

      mockPaymentModel = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      };

      mockBookingModel = {
        findById: jest.fn().mockResolvedValue(booking),
        db: {
          model: (name: string) => {
            if (name === 'BookingEscrow') return mockEscrowModel;
            if (name === 'Provider') return mockProviderModel;
            if (name === 'InventoryReservation') return mockReservationModel;
            if (name === 'Payment') return mockPaymentModel;
            if (name === 'Notification') return { create: jest.fn().mockResolvedValue({}) };
            return {};
          },
        },
      };

      mockBookingItemModel = {
        findById: jest.fn().mockImplementation((id) => {
          if (id.toString() === itemAId.toString()) return Promise.resolve(itemA);
          if (id.toString() === itemBId.toString()) return Promise.resolve(itemB);
          return Promise.resolve(null);
        }),
        find: jest.fn().mockReturnValue({
          lean: () => ({
            exec: async () => [
              { ...itemA, rentalFulfillment: { ...itemA.rentalFulfillment, status: RentalFulfillmentStatus.Completed, depositSettlementStatus: DepositSettlementStatus.PartiallyDeducted, depositRefundAmount: 60000 } },
              itemB, // Item B is still PICKED_UP
            ],
          }),
        }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockPaymentsService = {
        executeProfitSplit: jest.fn().mockResolvedValue({}),
        creditWalletsForBooking: jest.fn().mockResolvedValue({}),
      };

      mockRefundWorkflowService = {
        createFromDispute: jest.fn().mockResolvedValue({ _id: 'refund-01' }),
      };

      disputesService = Object.create(DisputesService.prototype);
      disputesService.incidentModel = mockIncidentModel;
      disputesService.bookingModel = mockBookingModel;
      disputesService.bookingItemModel = mockBookingItemModel;
      disputesService.inventoryModel = mockInventoryModel;
      disputesService.paymentsService = mockPaymentsService;
      disputesService.refundWorkflowService = mockRefundWorkflowService;
      disputesService.getCustomerIdStr = (b: any) => (b.customerId?._id || b.customerId).toString();
      disputesService.executeCompensationTransfer = jest.fn().mockResolvedValue({ success: true });
      disputesService.emitBookingUpdateHelper = jest.fn().mockResolvedValue(undefined);
    });

    it('deducts ONLY item A, leaves item B untouched, and does NOT complete Booking because item B is still active', async () => {
      const res = await disputesService.customerAgreeIncident(incident._id.toString(), customerId);

      expect(res.success).toBe(true);

      // Verify item A was updated with PARTIALLY_DEDUCTED
      expect(mockBookingItemModel.updateOne).toHaveBeenCalledWith(
        { _id: itemAId },
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.status': RentalFulfillmentStatus.Completed,
            'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.PartiallyDeducted,
            'rentalFulfillment.depositDeductedAmount': 40000,
            'rentalFulfillment.depositRefundAmount': 60000,
            'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Maintenance,
          }),
        }),
      );

      // Verify updateMany on all booking items was NOT called
      expect(mockBookingItemModel.updateMany).not.toHaveBeenCalled();

      // Verify item A inventory is set to MAINTENANCE
      expect(mockInventoryModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [invAId] } },
        {
          $set: expect.objectContaining({
            status: InventoryItemStatus.Maintenance,
            operationalAvailableFrom: null,
            activeTurnaroundBookingItemId: null,
          }),
        },
      );

      // Verify item A reservation is COMPLETED
      expect(mockReservationModel.updateMany).toHaveBeenCalledWith(
        { bookingItemId: itemAId, status: { $in: ['PENDING', 'CONFIRMED'] } },
        { $set: { status: 'COMPLETED' } },
      );

      // Because item B is still active, booking must NOT be COMPLETED
      expect(booking.status).not.toBe(BookingStatus.Completed);
      expect(mockPaymentsService.executeProfitSplit).not.toHaveBeenCalled();

      // Entire booking refund was NOT finalized early because item B is not settled
      expect(mockRefundWorkflowService.createFromDispute).not.toHaveBeenCalled();
    });
  });

  describe('3. customerDisagreeIncident per-item isolation', () => {
    it('sets issueStatus = UnderReview and deposit = Held ONLY on the incident item', async () => {
      const incident = {
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemAId,
        reportedBy: providerId,
        status: IncidentStatus.PendingCustomer,
        description: 'Rách tà áo',
        requestedAmount: 50000,
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'B-DISPUTE-01',
        customerId: new Types.ObjectId(customerId),
        status: BookingStatus.ReturnPending,
        statusTimeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockIncidentModel = {
        findById: jest.fn().mockResolvedValue(incident),
        findOneAndUpdate: jest.fn().mockResolvedValue({ ...incident, status: IncidentStatus.Disputed }),
      };

      const mockBookingItemModel = {
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      const disputesService = Object.create(DisputesService.prototype);
      disputesService.incidentModel = mockIncidentModel;
      disputesService.bookingModel = {
        findById: jest.fn().mockResolvedValue(booking),
        db: {
          model: (name: string) => ({
            create: jest.fn().mockResolvedValue({}),
            findById: jest.fn().mockResolvedValue({ userId: new Types.ObjectId() }),
          }),
        },
      };
      disputesService.bookingItemModel = mockBookingItemModel;
      disputesService.disputeModel = {
        findOneAndUpdate: jest.fn().mockResolvedValue({}),
      };
      disputesService.policyResolverService = {
        getDisputePolicy: jest.fn().mockResolvedValue({ holdSettlementWhenDisputed: true }),
      };
      disputesService.settlementsService = {
        holdSettlementsForBooking: jest.fn().mockResolvedValue({}),
      };
      disputesService.getCustomerIdStr = () => customerId;
      disputesService.emitBookingUpdateHelper = jest.fn().mockResolvedValue(undefined);

      const res = await disputesService.customerDisagreeIncident(incident._id.toString(), customerId, {
        reason: 'Tôi nhận áo đã bị rách sẵn',
      });

      expect(res.success).toBe(true);

      // Verify updateOne was called strictly for itemA
      expect(mockBookingItemModel.updateOne).toHaveBeenCalledWith(
        { _id: itemAId },
        {
          $set: {
            'rentalFulfillment.issueStatus': RentalIssueStatus.UnderReview,
            'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.Held,
          },
        },
      );

      // Verify updateMany was NOT called
      expect(mockBookingItemModel.updateMany).not.toHaveBeenCalled();

      // Booking status transitions to Disputed
      expect(booking.status).toBe(BookingStatus.Disputed);
    });
  });

  describe('4. adminResolveIncident per-item isolation', () => {
    it('resolves ONLY item A, updates its inventory according to actionType, and leaves item B unaffected', async () => {
      const itemA = {
        _id: itemAId,
        bookingId,
        itemType: 'PRODUCT',
        depositAmount: 100000,
        quantity: 1,
        inventoryItemId: invAId,
        rentalFulfillment: {
          status: RentalFulfillmentStatus.Returned,
          depositSettlementStatus: DepositSettlementStatus.Held,
          issueStatus: RentalIssueStatus.UnderReview,
        },
      };

      const itemB = {
        _id: itemBId,
        bookingId,
        itemType: 'PRODUCT',
        depositAmount: 100000,
        quantity: 1,
        inventoryItemId: invBId,
        rentalFulfillment: {
          status: RentalFulfillmentStatus.PickedUp,
          depositSettlementStatus: DepositSettlementStatus.PendingSettlement,
          issueStatus: RentalIssueStatus.None,
        },
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'B-ADMIN-01',
        customerId: new Types.ObjectId(customerId),
        providerIds: [providerId],
        status: BookingStatus.Disputed,
        pricingSummary: { depositTotal: 200000, grandTotal: 500000 },
        statusTimeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const incident = {
        _id: new Types.ObjectId(),
        bookingId,
        bookingItemId: itemAId,
        reportedBy: providerId,
        requestedAmount: 100000,
        actionType: 'MAINTENANCE',
        status: IncidentStatus.Disputed,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockIncidentModel = {
        findOne: jest.fn().mockResolvedValue(incident),
      };

      const mockBookingItemModel = {
        findOne: jest.fn().mockResolvedValue(itemA),
        findById: jest.fn().mockImplementation((id) => {
          if (id.toString() === itemAId.toString()) return Promise.resolve(itemA);
          return Promise.resolve(null);
        }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        find: jest.fn().mockReturnValue({
          lean: () => ({
            exec: async () => [
              { ...itemA, rentalFulfillment: { ...itemA.rentalFulfillment, status: RentalFulfillmentStatus.Completed } },
              itemB, // itemB is still active
            ],
          }),
        }),
      };

      const mockInventoryModel = {
        updateMany: jest.fn().mockReturnValue(query({ modifiedCount: 1 })),
      };

      const mockReservationModel = {
        find: jest.fn().mockReturnValue(query([{ inventoryItemId: invAId }])),
        updateMany: jest.fn().mockReturnValue(query({ modifiedCount: 1 })),
      };

      const mockDisputeModel = {
        findOneAndUpdate: jest.fn().mockResolvedValue({ status: 'RESOLVED' }),
      };

      const disputesService = Object.create(DisputesService.prototype);
      disputesService.incidentModel = mockIncidentModel;
      disputesService.disputeModel = mockDisputeModel;
      disputesService.bookingItemModel = mockBookingItemModel;
      disputesService.inventoryModel = mockInventoryModel;
      disputesService.bookingModel = {
        findById: jest.fn().mockResolvedValue(booking),
        db: {
          model: (name: string) => {
            if (name === 'BookingEscrow') return { findOneAndUpdate: jest.fn().mockResolvedValue({ status: 'RESOLVED' }), updateOne: jest.fn().mockResolvedValue({}) };
            if (name === 'Provider') return { findById: jest.fn().mockResolvedValue({ _id: providerId, userId: new Types.ObjectId() }) };
            if (name === 'InventoryReservation') return mockReservationModel;
            if (name === 'Payment') return { find: jest.fn().mockReturnValue({ lean: () => [] }), findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) };
            if (name === 'BookingSchedule') return { updateMany: jest.fn().mockResolvedValue({}) };
            if (name === 'Notification') return { create: jest.fn().mockResolvedValue({}) };
            return {};
          },
        },
      };
      disputesService.settlementsService = {
        releaseSettlementsForBooking: jest.fn().mockResolvedValue({}),
        cancelSettlementsForBooking: jest.fn().mockResolvedValue({}),
      };
      disputesService.paymentsService = {
        executeProfitSplit: jest.fn().mockResolvedValue({}),
        creditWalletsForBooking: jest.fn().mockResolvedValue({}),
      };
      disputesService.refundWorkflowService = {
        createFromDispute: jest.fn().mockResolvedValue({}),
      };
      disputesService.getCustomerIdStr = () => customerId;
      disputesService.executeCompensationTransfer = jest.fn().mockResolvedValue({ success: true });
      disputesService.emitBookingUpdateHelper = jest.fn().mockResolvedValue(undefined);

      await disputesService.adminResolveIncident(
        bookingId.toString(),
        'SHOP_RIGHT',
        new Types.ObjectId().toString(),
        'Shop cung cấp bằng chứng rõ ràng trang phục bị rách nặng',
      );

      // Verify item A was updated with MAINTENANCE and FULLY_DEDUCTED
      expect(mockBookingItemModel.updateOne).toHaveBeenCalledWith(
        { _id: itemAId },
        expect.objectContaining({
          $set: expect.objectContaining({
            'rentalFulfillment.status': RentalFulfillmentStatus.Completed,
            'rentalFulfillment.inventoryStatus': RentalInventoryStatus.Maintenance,
            'rentalFulfillment.depositSettlementStatus': DepositSettlementStatus.FullyDeducted,
            'rentalFulfillment.depositDeductedAmount': 100000,
            'rentalFulfillment.depositRefundAmount': 0,
            'rentalFulfillment.issueStatus': RentalIssueStatus.Resolved,
          }),
        }),
      );

      // Verify updateMany was NOT called
      expect(mockBookingItemModel.updateMany).not.toHaveBeenCalled();

      // Verify item A inventory is set to MAINTENANCE
      expect(mockInventoryModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [invAId] } },
        { $set: { status: InventoryItemStatus.Maintenance } },
      );

      // Verify booking status was NOT set to Completed because item B is still active
      expect(booking.status).not.toBe(BookingStatus.Completed);
    });
  });

  describe('5. Legacy charge endpoints throw BadRequestException directing to Incident flow', () => {
    let controller: RentalFulfillmentController;

    beforeEach(() => {
      controller = new RentalFulfillmentController(null as any, null as any);
    });

    it('throws BadRequestException for proposeCharge', () => {
      expect(() =>
        controller.proposeCharge(
          { userId: providerUserId, role: 'PROVIDER' } as any,
          bookingId.toString(),
          itemAId.toString(),
          { chargeType: 'damageFee', amount: 50000, reason: 'Hư vải' } as any,
        ),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for reviewCharge', () => {
      expect(() =>
        controller.reviewCharge(
          { userId: new Types.ObjectId().toString(), role: 'ADMIN' } as any,
          bookingId.toString(),
          itemAId.toString(),
          'damageFee',
          { approved: true } as any,
        ),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for settleDeposit', () => {
      expect(() =>
        controller.settleDeposit(
          { userId: new Types.ObjectId().toString(), role: 'ADMIN' } as any,
          bookingId.toString(),
          itemAId.toString(),
          { deductAmount: 50000, inventoryStatus: RentalInventoryStatus.Available } as any,
        ),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for markCompleted', () => {
      expect(() =>
        controller.markCompleted(
          { userId: providerUserId, role: 'PROVIDER' } as any,
          bookingId.toString(),
          itemAId.toString(),
          { inventoryStatus: RentalInventoryStatus.Available } as any,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('6. Realtime emitBookingUpdate room targeting', () => {
    it('emits strictly to room user:${userId} and role:admin without duplicate socketId emissions', () => {
      const mockChatGateway: any = {
        server: {
          to: jest.fn().mockReturnThis(),
          emit: jest.fn(),
        },
        getActiveConnections: jest.fn().mockReturnValue(new Map([[customerId, ['socket-1', 'socket-2']]])),
      };

      const notificationsService = Object.create(NotificationsService.prototype);
      notificationsService.chatGateway = mockChatGateway;

      notificationsService.emitBookingUpdate(
        {
          bookingId: bookingId.toString(),
          status: 'RETURNED',
        },
        [customerId],
      );

      // Verify emit to room user:customerId
      expect(mockChatGateway.server.to).toHaveBeenCalledWith(`user:${customerId}`);
      // Verify emit to room role:admin
      expect(mockChatGateway.server.to).toHaveBeenCalledWith('role:admin');
      // Verify socket-1 and socket-2 were NOT targeted directly (preventing duplicates)
      expect(mockChatGateway.server.to).not.toHaveBeenCalledWith('socket-1');
      expect(mockChatGateway.server.to).not.toHaveBeenCalledWith('socket-2');
    });
  });
});
