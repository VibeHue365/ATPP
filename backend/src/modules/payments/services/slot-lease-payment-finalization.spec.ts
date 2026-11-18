import { Types } from 'mongoose';
import {
  V2PaymentFinalizationService,
  FinalizationReviewError,
} from './v2-payment-finalization.service';
import { PaymentsService } from './payments.service';
import { BookingStatus, BookingType, PaymentStatus as BookingPaymentStatus } from '../../bookings/schemas/booking.schema';
import { BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { PaymentStatus } from '../schemas/payment.schema';
import { PaymentRecoveryState } from '../schemas/payment-recovery.schema';
import { SlotLeaseStatus, SlotLeasePurpose } from '../../bookings/schemas/inventory-slot-lease.schema';
import { TurnaroundStatus } from '../../bookings/schemas/rental-fulfillment.types';
import { ContractVersionState } from '../../contracts/schemas/contract-version.schema';
import { ContractConsentAction } from '../../contracts/schemas/contract-consent.schema';
import { hashContract } from '../../contracts/canonical-contract';
import { contractIntentKey } from './contract-payment-binding';

describe('Slot Lease Payment Finalization Unit Tests (V2 & Legacy)', () => {
  const paymentId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const contractId = new Types.ObjectId();
  const contractVersionId = new Types.ObjectId();
  const bookingItemId = new Types.ObjectId();
  const inventoryItemId = new Types.ObjectId();
  const token = 'valid-token';

  const defaultTemplate = { templateId: 'v1', version: 1, text: 'Template text' };
  const validSnapshot = {
    booking: { bookingId: bookingId.toString(), customerId: customerId.toString(), currency: 'VND' },
    providerItems: [{ providerId: providerId.toString(), items: [{ itemId: 'item1', price: 200000 }] }],
    pricing: { totalAmount: 200000, depositAmount: 0 },
  };
  const validFingerprint = hashContract({
    booking: validSnapshot.booking,
    providerItems: validSnapshot.providerItems,
    pricing: validSnapshot.pricing,
  });
  const validContentHash = hashContract({ template: defaultTemplate, snapshot: validSnapshot });

  const defaultBinding: any = {
    bindingVersion: 1,
    flowVersion: 2,
    bookingId,
    amount: 200000,
    currency: 'VND',
    purpose: 'FULL_PAYMENT',
    bookingFingerprint: validFingerprint,
    versions: [
      {
        providerId,
        contractId,
        contractVersionId,
        contentHash: validContentHash,
        bookingFingerprint: validFingerprint,
      },
    ],
  };
  const bindingKey = contractIntentKey(defaultBinding);

  describe('Part A: V2 Payment Finalization (V2PaymentFinalizationService)', () => {
    let service: V2PaymentFinalizationService;
    let mockSession: any;
    let mockBookings: any;
    let mockItems: any;
    let mockSchedules: any;
    let mockReservations: any;
    let mockPayments: any;
    let mockRecoveries: any;
    let mockEscrows: any;
    let mockNotifications: any;
    let mockContracts: any;
    let mockVersions: any;
    let mockConsents: any;
    let mockPhotoHolds: any;
    let mockPromotions: any;
    let mockRecoveryService: any;
    let mockContractPolicy: any;
    let mockPreparation: any;
    let mockSnapshots: any;
    let mockTemplates: any;
    let mockLeases: any;

    const setupHourlyBooking = (turnaroundSlots = 1, slotLeaseRequired = true) => {
      const now = new Date();
      const rentalFrom = new Date(now.getTime() + 24 * 3600 * 1000);
      const rentalTo = new Date(rentalFrom.getTime() + 2 * 3600 * 1000); // 2 hours = 1 slot

      const recoveryJob = {
        paymentId,
        bookingId,
        state: PaymentRecoveryState.Finalizing,
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 60_000),
        bindingKey,
      };

      const payment = {
        _id: paymentId,
        bookingId,
        status: PaymentStatus.Success,
        contractBinding: defaultBinding,
        contractIntentKey: bindingKey,
      };

      const booking = {
        _id: bookingId,
        customerId,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        paymentExpiryClaim: { phase: 'FINALIZING', paymentId },
        pricingSummary: { grandTotal: 200000, platformSubsidyAmount: 0 },
      };

      const hourlyProductItem = {
        _id: bookingItemId,
        bookingId,
        providerId,
        itemType: BookingItemType.Product,
        rentalType: 'HOURLY',
        rentalFrom,
        rentalTo,
        quantity: 1,
        slotLeaseRequired,
        rentalFulfillment: {
          slotLeaseRequired,
          turnaroundStatus: TurnaroundStatus.Scheduled,
          turnaroundSlotsSnapshot: turnaroundSlots,
        },
      };

      mockRecoveries.findOne.mockReturnValue({ session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(recoveryJob) }) });
      mockPayments.findById.mockReturnValue({
        session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(payment) }),
        lean: jest.fn().mockResolvedValue(payment),
      });
      mockBookings.findById.mockReturnValue({ session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(booking) }) });
      mockItems.find.mockReturnValue({ session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([hourlyProductItem]) }) });
      mockReservations.countDocuments.mockReturnValue({ session: jest.fn().mockResolvedValue(1) });
      mockPhotoHolds.confirmForBooking.mockResolvedValue({ confirmed: true });
      mockPayments.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ amount: 200000 }]),
          }),
        }),
      });

      return { booking, hourlyProductItem };
    };

    beforeEach(() => {
      mockSession = {
        withTransaction: jest.fn().mockImplementation((cb) => cb()),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      mockBookings = {
        db: {
          startSession: jest.fn().mockResolvedValue(mockSession),
          model: jest.fn(),
        },
        findById: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockItems = { find: jest.fn() };
      mockSchedules = { updateMany: jest.fn().mockResolvedValue({}) };
      mockReservations = { countDocuments: jest.fn(), updateMany: jest.fn().mockResolvedValue({}) };
      mockPayments = { findById: jest.fn(), find: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
      mockRecoveries = { findOne: jest.fn(), updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
      mockEscrows = { updateOne: jest.fn().mockResolvedValue({}) };
      mockNotifications = { updateOne: jest.fn().mockResolvedValue({}) };
      mockContracts = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ currentVersionId: contractVersionId }),
          }),
        }),
      };
      mockVersions = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              state: ContractVersionState.Accepted,
              contentHash: validContentHash,
              bookingFingerprint: validFingerprint,
            }),
          }),
        }),
      };
      mockConsents = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              contentHash: validContentHash,
              bookingFingerprint: validFingerprint,
            }),
          }),
        }),
      };
      mockPhotoHolds = { confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }) };
      mockPromotions = {
        findRedemptionByBooking: jest.fn().mockResolvedValue(null),
        redeemVoucher: jest.fn().mockResolvedValue(undefined),
      };
      mockRecoveryService = {
        claim: jest.fn().mockResolvedValue({ token }),
        requireReviewClaimed: jest.fn().mockResolvedValue(true),
        retry: jest.fn().mockResolvedValue(true),
      };
      mockContractPolicy = { getContext: jest.fn().mockResolvedValue({ rentalProviderIds: [providerId] }) };
      mockPreparation = { assertSourcesUnchanged: jest.fn().mockResolvedValue(undefined) };
      mockSnapshots = { build: jest.fn().mockResolvedValue(validSnapshot) };
      mockTemplates = { getApproved: jest.fn().mockReturnValue(defaultTemplate) };

      mockLeases = {
        find: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
        countDocuments: jest.fn().mockReturnValue({ session: jest.fn().mockResolvedValue(0) }),
      };

      service = new V2PaymentFinalizationService(
        true,
        mockBookings,
        mockItems,
        mockSchedules,
        mockReservations,
        mockPayments,
        mockRecoveries,
        mockEscrows,
        mockNotifications,
        mockContracts,
        mockVersions,
        mockConsents,
        mockPhotoHolds,
        mockPromotions,
        mockRecoveryService,
        mockContractPolicy,
        mockPreparation,
        mockSnapshots,
        mockTemplates,
        mockLeases,
        undefined, // contractEvidence
      );
    });

    it('Scenario 1: throws INVENTORY_SLOT_LEASE_MISSING when required leases are completely absent', async () => {
      setupHourlyBooking();
      // No leases found
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.finalize(paymentId, token)).rejects.toThrow(FinalizationReviewError);
      await expect(service.finalize(paymentId, token)).rejects.toThrow('INVENTORY_SLOT_LEASE_MISSING');
      expect(mockBookings.updateOne).not.toHaveBeenCalled();
    });

    it('Scenario 2: throws INVENTORY_SLOT_LEASE_INSUFFICIENT when partial leases are missing', async () => {
      setupHourlyBooking(1); // 1 rental slot + 1 turnaround slot = 2 required
      // Return only 1 active lease
      const partialLeases = [
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Temp,
          purpose: SlotLeasePurpose.Rental,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      ];
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(partialLeases),
        }),
      });

      await expect(service.finalize(paymentId, token)).rejects.toThrow(FinalizationReviewError);
      await expect(service.finalize(paymentId, token)).rejects.toThrow('INVENTORY_SLOT_LEASE_INSUFFICIENT');
      expect(mockBookings.updateOne).not.toHaveBeenCalled();
    });

    it('Scenario 3: throws INVENTORY_SLOT_LEASE_EXPIRED when a TEMP lease has expired', async () => {
      setupHourlyBooking(1);
      const expiredLeases = [
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Temp,
          expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        },
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Temp,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      ];
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(expiredLeases),
        }),
      });

      await expect(service.finalize(paymentId, token)).rejects.toThrow(FinalizationReviewError);
      await expect(service.finalize(paymentId, token)).rejects.toThrow('INVENTORY_SLOT_LEASE_EXPIRED');
      expect(mockBookings.updateOne).not.toHaveBeenCalled();
    });

    it('Scenario 4: throws INVENTORY_SLOT_LEASE_RELEASED when a lease was released concurrently', async () => {
      setupHourlyBooking(1);
      const releasedLeases = [
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Released,
          releasedAt: new Date(),
        },
      ];
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(releasedLeases),
        }),
      });

      await expect(service.finalize(paymentId, token)).rejects.toThrow(FinalizationReviewError);
      await expect(service.finalize(paymentId, token)).rejects.toThrow('INVENTORY_SLOT_LEASE_RELEASED');
      expect(mockBookings.updateOne).not.toHaveBeenCalled();
    });

    it('Scenario 5: full lease confirmation succeeds and confirms booking atomically', async () => {
      setupHourlyBooking(1); // 2 leases required
      const validLeases = [
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Temp,
          purpose: SlotLeasePurpose.Rental,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Temp,
          purpose: SlotLeasePurpose.Turnaround,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      ];
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(validLeases),
        }),
      });

      // After updateMany: 0 remaining TEMP, 2 confirmed
      mockLeases.countDocuments.mockImplementation((filter: any) => {
        if (filter.status === 'TEMP') return { session: jest.fn().mockResolvedValue(0) };
        if (filter.status === 'CONFIRMED') return { session: jest.fn().mockResolvedValue(2) };
        return { session: jest.fn().mockResolvedValue(0) };
      });

      await service.finalize(paymentId, token);

      expect(mockLeases.updateMany).toHaveBeenCalledWith(
        { bookingId, status: 'TEMP' },
        { $set: { status: 'CONFIRMED' }, $unset: { expiresAt: 1 } },
        { session: mockSession },
      );
      expect(mockBookings.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: bookingId }),
        expect.objectContaining({
          $set: expect.objectContaining({ status: BookingStatus.Confirmed }),
        }),
        { session: mockSession },
      );
    });

    it('Scenario 6: propagates model/database error and does not swallow it', async () => {
      setupHourlyBooking(1);
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('MongoDB replica connection lost')),
        }),
      });

      await expect(service.finalize(paymentId, token)).rejects.toThrow('MongoDB replica connection lost');
      expect(mockBookings.updateOne).not.toHaveBeenCalled();
    });

    it('Scenario 7: HOURLY booking with slotLeaseRequired=false does not check leases and confirms booking', async () => {
      setupHourlyBooking(1, false); // slotLeaseRequired = false
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.finalize(paymentId, token);

      expect(mockLeases.find).not.toHaveBeenCalled();
      expect(mockBookings.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: bookingId }),
        expect.objectContaining({
          $set: expect.objectContaining({ status: BookingStatus.Confirmed }),
        }),
        { session: mockSession },
      );
    });

    it('Scenario 8: turnaroundSlots=0 but slotLeaseRequired=true still enforces rental slot lease', async () => {
      setupHourlyBooking(0, true); // turnaroundSlots = 0, slotLeaseRequired = true => 1 rental lease required
      // If no lease -> throws missing error
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.finalize(paymentId, token)).rejects.toThrow('INVENTORY_SLOT_LEASE_MISSING');

      // Now provide 1 valid rental lease -> succeeds
      const rentalOnlyLeases = [
        {
          _id: new Types.ObjectId(),
          bookingId,
          bookingItemId,
          status: SlotLeaseStatus.Temp,
          purpose: SlotLeasePurpose.Rental,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      ];
      mockLeases.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(rentalOnlyLeases),
        }),
      });
      mockLeases.countDocuments.mockImplementation((filter: any) => {
        if (filter.status === 'TEMP') return { session: jest.fn().mockResolvedValue(0) };
        if (filter.status === 'CONFIRMED') return { session: jest.fn().mockResolvedValue(1) };
        return { session: jest.fn().mockResolvedValue(0) };
      });

      await service.finalize(paymentId, token);

      expect(mockLeases.updateMany).toHaveBeenCalledWith(
        { bookingId, status: 'TEMP' },
        { $set: { status: 'CONFIRMED' }, $unset: { expiresAt: 1 } },
        { session: mockSession },
      );
    });
  });

  describe('Part B: Legacy finalizeAfterPayment (PaymentsService)', () => {
    let paymentsService: PaymentsService;
    let mockBookingModel: any;
    let mockBookingItemModel: any;
    let mockReservationModel: any;
    let mockSlotLeaseModel: any;
    let mockPhotographyHoldService: any;
    let mockPromotionsService: any;
    let mockNotificationsService: any;
    let mockSession: any;

    const setupLegacyHourlyPayment = (turnaroundSlots = 1, slotLeaseRequired = true) => {
      const now = new Date();
      const rentalFrom = new Date(now.getTime() + 24 * 3600 * 1000);
      const rentalTo = new Date(rentalFrom.getTime() + 2 * 3600 * 1000); // 2 hours = 1 slot

      const paymentDoc: any = {
        _id: paymentId,
        bookingId,
        amount: 200000,
        status: PaymentStatus.Success,
      };

      const booking: any = {
        _id: bookingId,
        customerId,
        bookingCode: 'BK-LEGACY-1',
        status: BookingStatus.PendingPayment,
        bookingType: BookingType.Product,
        pricingSummary: { grandTotal: 200000, platformSubsidyAmount: 0 },
      };

      const hourlyProductItem: any = {
        _id: bookingItemId,
        bookingId,
        itemType: 'PRODUCT',
        rentalType: 'HOURLY',
        rentalFrom,
        rentalTo,
        quantity: 1,
        slotLeaseRequired,
        rentalFulfillment: {
          slotLeaseRequired,
          turnaroundStatus: 'SCHEDULED',
          turnaroundSlotsSnapshot: turnaroundSlots,
        },
      };

      mockBookingModel.findOneAndUpdate.mockImplementation((filter: any, update: any) => {
        if (update.$set?.status) {
          booking.status = update.$set.status;
        }
        if (update.$set?.['paymentSummary.paymentStatus']) {
          booking.paymentSummary = update.$set['paymentSummary.paymentStatus'];
        }
        return booking;
      });

      mockBookingModel.db.model.mockImplementation((name: string) => {
        if (name === 'Payment') {
          return {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([{ amount: 200000 }]),
                }),
              }),
            }),
          };
        }
        if (name === 'BookingItem') {
          return { find: jest.fn().mockResolvedValue([hourlyProductItem]) };
        }
        if (name === 'InventoryReservation') {
          return mockReservationModel;
        }
        if (name === 'InventorySlotLease') {
          return mockSlotLeaseModel;
        }
        return {};
      });

      return { paymentDoc, booking, hourlyProductItem };
    };

    beforeEach(() => {
      mockSession = {
        withTransaction: jest.fn().mockImplementation((cb) => cb()),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      mockReservationModel = {
        countDocuments: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockSlotLeaseModel = {
        find: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
        countDocuments: jest.fn().mockResolvedValue(0),
      };

      mockBookingModel = {
        db: {
          startSession: jest.fn().mockResolvedValue(mockSession),
          model: jest.fn(),
        },
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockPhotographyHoldService = {
        confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }),
      };

      mockPromotionsService = {
        redeemVoucher: jest.fn().mockResolvedValue(true),
        findRedemptionByBooking: jest.fn().mockResolvedValue(null),
      };

      mockNotificationsService = {
        createNotification: jest.fn().mockResolvedValue({}),
      };

      const mockEscrowRepository = {
        createOrUpdateEscrow: jest.fn().mockResolvedValue({}),
      };

      paymentsService = new PaymentsService(
        {} as any,
        mockBookingModel,
        mockEscrowRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockNotificationsService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockPhotographyHoldService,
        {} as any,
        mockPromotionsService,
        false,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('Scenario 1: marks paymentReviewRequired and keeps status PendingPayment when slot lease is completely missing', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1);
      mockSlotLeaseModel.find.mockResolvedValue([]); // No leases found

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('Thiếu slot lease bắt buộc'),
          }),
        }),
      );
      expect(booking.status).toBe(BookingStatus.PendingPayment);
    });

    it('Scenario 2: marks paymentReviewRequired and does NOT move to CONFIRMED when leases are insufficient', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1); // 2 leases required
      mockSlotLeaseModel.find.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          status: 'TEMP',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      ]); // only 1 returned

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('Không đủ số lượng slot lease dự kiến'),
          }),
        }),
      );
      expect(booking.status).toBe(BookingStatus.PendingPayment);
    });

    it('Scenario 3: marks paymentReviewRequired and does NOT move to CONFIRMED when TEMP lease expired', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1);
      mockSlotLeaseModel.find.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          status: 'TEMP',
          expiresAt: new Date(Date.now() - 10000), // Expired
        },
      ]);

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('hết hạn trước khi thanh toán hoàn tất'),
          }),
        }),
      );
      expect(booking.status).toBe(BookingStatus.PendingPayment);
    });

    it('Scenario 4: marks paymentReviewRequired and does NOT move to CONFIRMED when lease was released', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1);
      mockSlotLeaseModel.find.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      ]);

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('Slot lease đã bị hủy hoặc giải phóng'),
          }),
        }),
      );
      expect(booking.status).toBe(BookingStatus.PendingPayment);
    });

    it('Scenario 5: full lease confirmation succeeds and transitions booking to CONFIRMED', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1); // 2 required
      mockSlotLeaseModel.find.mockResolvedValue([
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      ]);
      mockSlotLeaseModel.countDocuments.mockImplementation((filter: any) => {
        if (filter.status === 'TEMP') return Promise.resolve(0);
        if (filter.status === 'CONFIRMED') return Promise.resolve(2);
        return Promise.resolve(0);
      });

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockSlotLeaseModel.updateMany).toHaveBeenCalledWith(
        { bookingId, status: 'TEMP' },
        { $set: { status: 'CONFIRMED' }, $unset: { expiresAt: 1 } },
        { session: mockSession },
      );
      expect(booking.status).toBe(BookingStatus.Confirmed);
    });

    it('Scenario 6: model/database error on lease confirmation aborts transition and sets paymentReviewRequired', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1);
      mockSlotLeaseModel.find.mockResolvedValue([
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      ]);
      mockSlotLeaseModel.updateMany.mockRejectedValue(new Error('DB write failure during slot lease confirm'));

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(booking.status).toBe(BookingStatus.PendingPayment);
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('Không thể xác nhận giữ chỗ hoặc trạng thái đơn hàng'),
          }),
        }),
      );
    });

    it('Scenario 7: HOURLY booking with slotLeaseRequired=false confirms payment without requiring slot leases', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1, false); // slotLeaseRequired = false
      mockSlotLeaseModel.find.mockResolvedValue([]); // No leases in DB

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockSlotLeaseModel.find).not.toHaveBeenCalled();
      expect(booking.status).toBe(BookingStatus.Confirmed);
      expect(mockBookingModel.updateOne).not.toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({ paymentReviewRequired: true }),
        }),
      );
    });

    it('Scenario 8: turnaroundSlots=0 but slotLeaseRequired=true still enforces rental slot lease', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(0, true); // turnaroundSlots = 0, slotLeaseRequired = true => 1 lease required
      mockSlotLeaseModel.find.mockResolvedValue([]); // Missing lease

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(booking.status).toBe(BookingStatus.PendingPayment);
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('Thiếu slot lease bắt buộc'),
          }),
        }),
      );

      // Now provide 1 valid lease -> succeeds and transitions to CONFIRMED
      mockSlotLeaseModel.find.mockResolvedValue([
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      ]);
      mockSlotLeaseModel.countDocuments.mockImplementation((filter: any) => {
        if (filter.status === 'TEMP') return Promise.resolve(0);
        if (filter.status === 'CONFIRMED') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(booking.status).toBe(BookingStatus.Confirmed);
    });

    it('Scenario 9: when slotLeaseRequired=true and session is unavailable, does NOT call reservation.updateMany, lease.updateMany, or transition to CONFIRMED, and sets paymentReviewRequired', async () => {
      const { paymentDoc, booking } = setupLegacyHourlyPayment(1, true);
      // Valid leases exist
      mockSlotLeaseModel.find.mockResolvedValue([
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
        { _id: new Types.ObjectId(), status: 'TEMP', expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      ]);
      // Session unavailable (e.g. standalone Mongo)
      mockBookingModel.db.startSession.mockResolvedValue(null);

      await paymentsService.finalizeAfterPayment(paymentDoc);

      expect(mockReservationModel.updateMany).not.toHaveBeenCalled();
      expect(mockSlotLeaseModel.updateMany).not.toHaveBeenCalled();
      expect(booking.status).toBe(BookingStatus.PendingPayment);
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentReviewRequired: true,
            paymentReviewReason: expect.stringContaining('Không thể tạo phiên giao dịch (session/transaction)'),
          }),
        }),
      );
    });
  });
});
