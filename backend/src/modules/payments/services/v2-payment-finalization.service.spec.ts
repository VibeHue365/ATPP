import { Types } from 'mongoose';
import {
  V2PaymentFinalizationService,
  FinalizationReviewError,
} from './v2-payment-finalization.service';
import { PaymentRecoveryState } from '../schemas/payment-recovery.schema';
import { PaymentStatus } from '../schemas/payment.schema';
import { BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { ContractVersionState } from '../../contracts/schemas/contract-version.schema';
import { ContractConsentAction } from '../../contracts/schemas/contract-consent.schema';
import { hashContract } from '../../contracts/canonical-contract';
import { contractIntentKey } from './contract-payment-binding';

describe('V2PaymentFinalizationService unit tests', () => {
  const oid = () => new Types.ObjectId();

  let enabled = true;
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
  let mockSession: any;

  let service: V2PaymentFinalizationService;

  beforeEach(() => {
    enabled = true;
    mockSession = {
      withTransaction: jest.fn().mockImplementation(async (cb) => cb()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    mockBookings = {
      db: { startSession: jest.fn().mockResolvedValue(mockSession) },
      findById: jest.fn(),
      updateOne: jest.fn(),
    };
    mockItems = { find: jest.fn() };
    mockSchedules = { updateMany: jest.fn() };
    mockReservations = { countDocuments: jest.fn(), updateMany: jest.fn() };
    mockPayments = { findById: jest.fn(), find: jest.fn(), updateOne: jest.fn() };
    mockRecoveries = { find: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() };
    mockEscrows = { updateOne: jest.fn() };
    mockNotifications = { updateOne: jest.fn() };
    mockContracts = { findById: jest.fn() };
    mockVersions = { findById: jest.fn() };
    mockConsents = { findOne: jest.fn() };

    mockPhotoHolds = {
      confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }),
    };
    mockPromotions = {
      findRedemptionByBooking: jest.fn().mockResolvedValue(null),
      redeemVoucher: jest.fn().mockResolvedValue(undefined),
    };
    mockRecoveryService = {
      claim: jest.fn(),
      retry: jest.fn().mockResolvedValue(true),
      requireReviewClaimed: jest.fn().mockResolvedValue(true),
    };
    mockContractPolicy = {
      getContext: jest.fn(),
    };
    mockPreparation = {
      assertSourcesUnchanged: jest.fn().mockResolvedValue(undefined),
    };
    mockSnapshots = {
      build: jest.fn(),
    };
    mockTemplates = {
      getApproved: jest.fn().mockReturnValue({ templateId: 'v1', version: 1, text: 'Sample policy' }),
    };

    service = new V2PaymentFinalizationService(
      enabled,
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
    );
  });

  it('processDue returns 0 when CONTRACTS_V2_ENABLED is false', async () => {
    const disabledService = new V2PaymentFinalizationService(
      false,
      mockBookings, mockItems, mockSchedules, mockReservations, mockPayments,
      mockRecoveries, mockEscrows, mockNotifications, mockContracts, mockVersions,
      mockConsents, mockPhotoHolds, mockPromotions, mockRecoveryService,
      mockContractPolicy, mockPreparation, mockSnapshots, mockTemplates,
    );
    expect(await disabledService.processDue()).toBe(0);
    expect(mockRecoveries.find).not.toHaveBeenCalled();
  });

  it('processDue claims and processes each due recovery job', async () => {
    const p1 = oid();
    const p2 = oid();
    mockRecoveries.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ paymentId: p1 }, { paymentId: p2 }]),
        }),
      }),
    });

    mockRecoveryService.claim
      .mockResolvedValueOnce({ token: 'tok-1' })
      .mockResolvedValueOnce(null); // second was claimed concurrently

    jest.spyOn(service, 'finalize').mockResolvedValue(undefined);

    const processed = await service.processDue();
    expect(processed).toBe(1);
    expect(service.finalize).toHaveBeenCalledTimes(1);
    expect(service.finalize).toHaveBeenCalledWith(p1, 'tok-1');
  });

  it('marks REVIEW_REQUIRED when finalize encounters permanent FinalizationReviewError', async () => {
    const paymentId = oid();
    mockRecoveryService.claim.mockResolvedValueOnce({ token: 'tok-rev' });
    jest.spyOn(service, 'finalize').mockRejectedValue(new FinalizationReviewError('RECOVERY_LEASE_LOST'));

    // Test lease lost: skips
    const resLeaseLost = await service.processPayment(paymentId);
    expect(resLeaseLost).toBe(false);
    expect(mockRecoveryService.requireReviewClaimed).not.toHaveBeenCalled();

    // Test review error
    mockRecoveryService.claim.mockResolvedValueOnce({ token: 'tok-stale' });
    jest.spyOn(service, 'finalize').mockRejectedValue(new FinalizationReviewError('CONTRACT_BINDING_STALE'));

    const resReview = await service.processPayment(paymentId);
    expect(resReview).toBe(false);
    expect(mockRecoveryService.requireReviewClaimed).toHaveBeenCalledWith(paymentId, 'tok-stale', 'CONTRACT_BINDING_STALE');
    expect(mockPayments.updateOne).toHaveBeenCalledWith(
      { _id: paymentId },
      { $set: { needsManualReview: true } },
    );
  });

  it('retries when finalize encounters unexpected transient error', async () => {
    const paymentId = oid();
    mockRecoveryService.claim.mockResolvedValueOnce({ token: 'tok-transient' });
    jest.spyOn(service, 'finalize').mockRejectedValue(new Error('MongoNetworkTimeoutException'));

    const res = await service.processPayment(paymentId);
    expect(res).toBe(false);
    expect(mockRecoveryService.retry).toHaveBeenCalledWith(paymentId, 'tok-transient', 'FINALIZATION_RETRY');
  });

  it('successfully finalizes a valid booking and executes all side effects idempotently', async () => {
    const paymentId = oid();
    const bookingId = oid();
    const customerId = oid();
    const providerId = oid();
    const contractId = oid();
    const contractVersionId = oid();
    const token = 'valid-token';

    const template = { templateId: 'v1', version: 1, text: 'Template' };
    const snapshot = {
      booking: { bookingCode: 'V2-BOOK-001', customerId, bookingType: 'AODAI_RENTAL' },
      providerItems: [{ bookingItemId: oid(), productId: oid(), quantity: 1, unitPrice: 100 }],
      pricing: { grandTotal: 100, depositTotal: 50, amountDueNow: 150 },
    };
    const bookingFingerprint = hashContract({
      booking: snapshot.booking,
      providerItems: snapshot.providerItems,
      pricing: snapshot.pricing,
    });
    mockTemplates.getApproved.mockReturnValue(template);
    mockSnapshots.build.mockResolvedValue(snapshot);
    const contentHash = hashContract({ template, snapshot });

    const binding: any = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId,
      amount: 100,
      currency: 'VND',
      purpose: 'FULL_PAYMENT',
      bookingFingerprint,
      versions: [{ providerId, contractId, contractVersionId, contentHash, bookingFingerprint }],
    };
    const bindingKey = contractIntentKey(binding);

    // Job setup
    mockRecoveries.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          paymentId,
          bookingId,
          bindingKey,
          state: PaymentRecoveryState.Finalizing,
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 60000),
        }),
      }),
    });

    // Payment setup
    mockPayments.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: paymentId,
          bookingId,
          status: PaymentStatus.Success,
          contractBinding: binding,
          contractIntentKey: bindingKey,
        }),
      }),
    });

    // Booking setup
    mockPayments.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ amount: 100 }]),
        }),
      }),
    });

    mockItems.find.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: oid(), providerId }]),
      }),
    });
    mockReservations.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(1),
    });

    mockBookings.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: bookingId,
          bookingCode: 'V2-BOOK-001',
          customerId,
          contractFlowVersion: 2,
          status: BookingStatus.PendingPayment,
          paymentExpiryClaim: { phase: 'FINALIZING', paymentId },
          bookingType: BookingType.AoDaiRental,
          pricingSummary: { grandTotal: 100, depositTotal: 50 },
        }),
      }),
    });

    // Contract policy context
    mockContractPolicy.getContext.mockResolvedValue({
      rentalProviderIds: [providerId],
    });
    mockContracts.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ currentVersionId: contractVersionId }),
      }),
    });
    mockVersions.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          state: ContractVersionState.Accepted,
          contentHash,
          bookingFingerprint,
        }),
      }),
    });
    mockConsents.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          action: ContractConsentAction.Accept,
          contentHash,
          bookingFingerprint,
        }),
      }),
    });
    mockSnapshots.build.mockResolvedValue(snapshot);

    // Items and reservations
    const productItemId = oid();
    mockItems.find.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: productItemId, itemType: BookingItemType.Product, quantity: 1 },
        ]),
      }),
    });
    mockReservations.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(1),
    });

    // Successful payments query
    mockPayments.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ amount: 100 }]),
        }),
      }),
    });

    mockBookings.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockReservations.updateMany.mockResolvedValue({ modifiedCount: 1 });
    mockSchedules.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mockEscrows.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mockNotifications.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mockRecoveries.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await service.finalize(paymentId, token);

    // Assert booking confirmed
    expect(mockBookings.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: bookingId,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        'paymentExpiryClaim.phase': 'FINALIZING',
        'paymentExpiryClaim.paymentId': paymentId,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: BookingStatus.Confirmed,
          paymentExpiryClaim: null,
        }),
      }),
      expect.anything(),
    );

    // Assert reservations confirmed
    expect(mockReservations.updateMany).toHaveBeenCalledWith(
      { bookingId, status: 'TEMP_RESERVED' },
      { $set: { status: 'CONFIRMED' }, $unset: { expiresAt: 1 } },
      expect.anything(),
    );

    // Assert escrow upserted
    expect(mockEscrows.updateOne).toHaveBeenCalledWith(
      { bookingId },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          bookingId,
          totalAmountCollected: 100,
          damageDepositAmount: 50,
          status: 'HELD',
        }),
      }),
      expect.objectContaining({ upsert: true }),
    );

    // Assert recovery set to COMPLETED
    expect(mockRecoveries.updateOne).toHaveBeenCalledWith(
      { paymentId, state: PaymentRecoveryState.Finalizing, leaseToken: token },
      expect.objectContaining({
        $set: expect.objectContaining({
          state: PaymentRecoveryState.Completed,
          leaseToken: null,
          leaseUntil: null,
        }),
      }),
      expect.anything(),
    );
  });

  it('supports crash recovery when booking is already confirmed by prior run', async () => {
    const paymentId = oid();
    const bookingId = oid();
    const customerId = oid();
    const providerId = oid();
    const contractId = oid();
    const contractVersionId = oid();
    const token = 'crash-resume-token';

    const template = { templateId: 'v1', version: 1, text: 'Template' };
    const snapshot = {
      booking: { bookingCode: 'V2-BOOK-002', customerId, bookingType: 'AODAI_RENTAL' },
      providerItems: [{ bookingItemId: oid(), productId: oid(), quantity: 1, unitPrice: 100 }],
      pricing: { grandTotal: 100, depositTotal: 50, amountDueNow: 150 },
    };
    const bookingFingerprint = hashContract({
      booking: snapshot.booking,
      providerItems: snapshot.providerItems,
      pricing: snapshot.pricing,
    });
    mockTemplates.getApproved.mockReturnValue(template);
    mockSnapshots.build.mockResolvedValue(snapshot);
    const contentHash = hashContract({ template, snapshot });

    const binding: any = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId,
      amount: 100,
      currency: 'VND',
      purpose: 'FULL_PAYMENT',
      bookingFingerprint,
      versions: [{ providerId, contractId, contractVersionId, contentHash, bookingFingerprint }],
    };
    const bindingKey = contractIntentKey(binding);

    // Job setup
    mockRecoveries.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          paymentId,
          bookingId,
          bindingKey,
          state: PaymentRecoveryState.Finalizing,
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 60000),
        }),
      }),
    });

    mockPayments.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: paymentId,
          bookingId,
          status: PaymentStatus.Success,
          contractBinding: binding,
          contractIntentKey: bindingKey,
        }),
      }),
    });

    // Booking is already confirmed from the first run!
    mockPayments.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ amount: 100 }]),
        }),
      }),
    });

    mockItems.find.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: oid(), providerId }]),
      }),
    });
    mockReservations.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(1),
    });

    mockBookings.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: bookingId,
          bookingCode: 'V2-BOOK-002',
          customerId,
          contractFlowVersion: 2,
          status: BookingStatus.Confirmed,
          paymentExpiryClaim: null,
          finalizedPaymentId: paymentId,
          finalizedContractKey: bindingKey,
          bookingType: BookingType.AoDaiRental,
          pricingSummary: { grandTotal: 100, depositTotal: 50 },
        }),
      }),
    });

    mockContractPolicy.getContext.mockResolvedValue({
      rentalProviderIds: [providerId],
    });
    mockContracts.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ currentVersionId: contractVersionId }),
      }),
    });
    mockVersions.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          state: ContractVersionState.Accepted,
          contentHash,
          bookingFingerprint,
        }),
      }),
    });
    mockConsents.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          action: ContractConsentAction.Accept,
          contentHash,
          bookingFingerprint,
        }),
      }),
    });
    mockSnapshots.build.mockResolvedValue(snapshot);

    mockItems.find.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: oid(), itemType: BookingItemType.Product, quantity: 1 },
        ]),
      }),
    });
    mockReservations.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(1),
    });
    mockPayments.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ amount: 100 }]),
        }),
      }),
    });

    mockReservations.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mockSchedules.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mockEscrows.updateOne.mockResolvedValue({ upsertedCount: 0 });
    mockNotifications.updateOne.mockResolvedValue({ upsertedCount: 0 });
    mockRecoveries.updateOne.mockResolvedValue({ modifiedCount: 1 });

    // Should NOT throw BOOKING_CLAIM_INVALID
    await service.finalize(paymentId, token);

    // Bookings update was skipped because already confirmed
    expect(mockBookings.updateOne).not.toHaveBeenCalled();

    // Recovery completes cleanly
    expect(mockRecoveries.updateOne).toHaveBeenCalledWith(
      { paymentId, state: PaymentRecoveryState.Finalizing, leaseToken: token },
      expect.objectContaining({
        $set: expect.objectContaining({
          state: PaymentRecoveryState.Completed,
        }),
      }),
      expect.anything(),
    );
  });

  it('rejects finalization if booking was CONFIRMED by a different payment (enforcing payment ownership invariant)', async () => {
    const paymentId = oid();
    const otherPaymentId = oid();
    const bookingId = oid();
    const customerId = oid();
    const token = 'token-diff-payment';

    const binding: any = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId,
      amount: 100,
      currency: 'VND',
      purpose: 'FULL_PAYMENT',
      bookingFingerprint: 'fp-1',
      versions: [],
    };
    const bindingKey = contractIntentKey(binding);

    mockRecoveries.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          paymentId,
          bookingId,
          bindingKey,
          state: PaymentRecoveryState.Finalizing,
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 60000),
        }),
      }),
    });

    mockPayments.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: paymentId,
          bookingId,
          status: PaymentStatus.Success,
          contractBinding: binding,
          contractIntentKey: bindingKey,
        }),
      }),
    });

    // Booking confirmed by otherPaymentId!
    mockBookings.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: bookingId,
          bookingCode: 'V2-BOOK-003',
          customerId,
          contractFlowVersion: 2,
          status: BookingStatus.Confirmed,
          paymentExpiryClaim: null,
          finalizedPaymentId: otherPaymentId, // MISMATCH
          finalizedContractKey: bindingKey,
          bookingType: BookingType.AoDaiRental,
          pricingSummary: { grandTotal: 100, depositTotal: 50 },
        }),
      }),
    });

    await expect(service.finalize(paymentId, token)).rejects.toThrow('BOOKING_CLAIM_INVALID');
  });

  it('Phase 6: Decoupled PDF generation failure does NOT rollback payment transaction or affect Completed recovery state', async () => {
    const paymentId = oid();
    const token = 'lease-tok-pdf-test';
    const bookingId = oid();
    const customerId = oid();
    const providerId = oid();
    const contractId = oid();
    const contractVersionId = oid();

    const template = { templateId: 'v1', version: 1, text: 'Template' };
    const snapshot = {
      booking: { bookingCode: 'V2-BOOK-PDF-001', customerId, bookingType: 'AODAI_RENTAL' },
      providerItems: [{ bookingItemId: oid(), productId: oid(), quantity: 1, unitPrice: 100 }],
      pricing: { grandTotal: 100, depositTotal: 50, amountDueNow: 150 },
    };
    const bookingFingerprint = hashContract({
      booking: snapshot.booking,
      providerItems: snapshot.providerItems,
      pricing: snapshot.pricing,
    });
    mockTemplates.getApproved.mockReturnValue(template);
    mockSnapshots.build.mockResolvedValue(snapshot);
    const contentHash = hashContract({ template, snapshot });

    const binding: any = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId,
      amount: 100,
      currency: 'VND',
      purpose: 'FULL_PAYMENT',
      bookingFingerprint,
      versions: [{ providerId, contractId, contractVersionId, contentHash, bookingFingerprint }],
    };
    const bindingKey = contractIntentKey(binding);

    const mockEvidence = {
      generateAndStorePdf: jest.fn().mockRejectedValue(new Error('REMOTE_STORAGE_DOWN')),
    };

    const serviceWithEvidence = new V2PaymentFinalizationService(
      enabled,
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
      mockEvidence as any,
    );

    mockRecoveries.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          paymentId,
          bookingId,
          bindingKey,
          state: PaymentRecoveryState.Finalizing,
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 60000),
        }),
      }),
    });

    mockPayments.findById.mockImplementation(() => ({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: paymentId,
          bookingId,
          status: PaymentStatus.Success,
          contractBinding: binding,
          contractIntentKey: bindingKey,
        }),
      }),
      lean: jest.fn().mockResolvedValue({
        _id: paymentId,
        bookingId,
        status: PaymentStatus.Success,
        contractBinding: binding,
        contractIntentKey: bindingKey,
      }),
    }));

    mockPayments.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ amount: 100 }]),
        }),
      }),
    });

    mockItems.find.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: oid(), providerId }]),
      }),
    });
    mockReservations.countDocuments.mockReturnValue({
      session: jest.fn().mockResolvedValue(1),
    });

    mockBookings.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: bookingId,
          bookingCode: 'V2-BOOK-PDF-001',
          customerId,
          contractFlowVersion: 2,
          status: BookingStatus.Confirmed,
          paymentExpiryClaim: null,
          finalizedPaymentId: paymentId,
          finalizedContractKey: bindingKey,
          bookingType: BookingType.AoDaiRental,
          pricingSummary: { grandTotal: 100, depositTotal: 50 },
        }),
      }),
    });

    mockContractPolicy.getContext.mockResolvedValue({
      rentalProviderIds: [providerId],
    });
    mockContracts.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ currentVersionId: contractVersionId }),
      }),
    });
    mockVersions.findById.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: contractVersionId,
          contractId,
          state: ContractVersionState.Accepted,
          contentHash,
          bookingFingerprint,
        }),
      }),
    });
    mockConsents.findOne.mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          contractVersionId,
          action: ContractConsentAction.Accept,
          actorUserId: customerId,
          contentHash,
          bookingFingerprint,
        }),
      }),
    });

    mockBookings.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockEscrows.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mockNotifications.updateOne.mockResolvedValue({ upsertedCount: 1 });
    mockRecoveries.updateOne.mockResolvedValue({ modifiedCount: 1 });

    // Finalize should succeed cleanly despite PDF generation throwing!
    await expect(serviceWithEvidence.finalize(paymentId, token)).resolves.not.toThrow();

    // Verify recovery was marked Completed in transaction
    expect(mockRecoveries.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId, leaseToken: token }),
      expect.objectContaining({
        $set: expect.objectContaining({ state: PaymentRecoveryState.Completed }),
      }),
      expect.anything(),
    );

    // Verify evidence generation was attempted out-of-transaction
    expect(mockEvidence.generateAndStorePdf).toHaveBeenCalledWith(contractVersionId);
  });

  it('skips processDue when module is destroyed or application is shutting down', async () => {
    mockRecoveries.find.mockClear();

    service.onModuleDestroy();
    await expect(service.processDue()).resolves.toBe(0);
    expect(mockRecoveries.find).not.toHaveBeenCalled();

    const service2 = new V2PaymentFinalizationService(
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
    );
    service2.onApplicationShutdown();
    await expect(service2.processDue()).resolves.toBe(0);
    expect(mockRecoveries.find).not.toHaveBeenCalled();
  });

  it('skips processDue when mongoose connection is not ready (readyState !== 1)', async () => {
    mockRecoveries.find.mockClear();
    const disconnectedRecoveries = {
      ...mockRecoveries,
      db: { readyState: 0 },
    };
    const service3 = new V2PaymentFinalizationService(
      true,
      mockBookings,
      mockItems,
      mockSchedules,
      mockReservations,
      mockPayments,
      disconnectedRecoveries as any,
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
    );

    await expect(service3.processDue()).resolves.toBe(0);
    expect(mockRecoveries.find).not.toHaveBeenCalled();
  });
});
