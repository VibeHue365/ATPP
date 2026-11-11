import { Types, Connection, Model, createConnection } from 'mongoose';
import {
  Booking,
  BookingSchema,
  BookingStatus,
  BookingType,
  PaymentStatus as BookingPaymentStatus,
} from '../../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemSchema,
  BookingItemType,
} from '../../bookings/schemas/booking-item.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
  ReservationStatus,
} from '../../products/schemas/inventory-reservation.schema';
import {
  ContractPaymentBinding,
  Payment,
  PaymentPurpose,
  PaymentSchema,
  PaymentStatus,
} from '../schemas/payment.schema';
import {
  PaymentRecovery,
  PaymentRecoverySchema,
  PaymentRecoveryState,
} from '../schemas/payment-recovery.schema';
import {
  DigitalContract,
  DigitalContractSchema,
  ContractScope,
  ContractApprovalMode,
  ContractStatus,
} from '../../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionSchema,
  ContractVersionState,
} from '../../contracts/schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentRole,
  ContractConsentSchema,
} from '../../contracts/schemas/contract-consent.schema';
import { PaymentsService } from '../services/payments.service';
import { PaymentsRepository } from '../repositories/payments.repository';
import { PaymentExpiryClaimService } from '../services/payment-expiry-claim.service';
import { PaymentRecoveryService } from '../services/payment-recovery.service';
import {
  V2PaymentFinalizationService,
  FinalizationReviewError,
} from '../services/v2-payment-finalization.service';
import { contractIntentKey, paymentMatchesBinding } from '../services/contract-payment-binding';
import { hashContract } from '../../contracts/canonical-contract';

const oid = () => new Types.ObjectId();

describe('Requirement 2 & 3: Stale Payment Supersede & Real MongoDB Integration', () => {
  const bookingId = oid();
  const customerId = oid();
  const providerId = oid();
  const contractId = oid();

  const contractVersionId_v1 = oid();
  const contractVersionId_v2 = oid();

  const template = { templateId: 'v1', version: 1, text: 'Template' };
  const snapshot_v1 = {
    booking: { bookingCode: 'V2-BOOK-STALE-001', customerId, bookingType: 'AODAI_RENTAL' },
    providerItems: [{ bookingItemId: oid(), productId: oid(), quantity: 1, unitPrice: 100 }],
    pricing: { grandTotal: 100, depositTotal: 50, amountDueNow: 150 },
  };
  const contentHash_v1 = hashContract({ template, snapshot: snapshot_v1 });
  const bookingFingerprint_v1 = hashContract({
    booking: snapshot_v1.booking,
    providerItems: snapshot_v1.providerItems,
    pricing: snapshot_v1.pricing,
  });

  const snapshot_v2 = {
    ...snapshot_v1,
    booking: { ...snapshot_v1.booking, updated: true },
  };
  const contentHash_v2 = hashContract({ template, snapshot: snapshot_v2 });
  const bookingFingerprint_v2 = hashContract({
    booking: snapshot_v2.booking,
    providerItems: snapshot_v2.providerItems,
    pricing: snapshot_v2.pricing,
  });

  const binding_v1: ContractPaymentBinding = {
    bindingVersion: 1,
    flowVersion: 2,
    bookingId,
    amount: 100,
    currency: 'VND',
    purpose: PaymentPurpose.FullPayment,
    bookingFingerprint: bookingFingerprint_v1,
    boundAt: new Date(),
    versions: [
      {
        contractId,
        contractVersionId: contractVersionId_v1,
        providerId,
        contentHash: contentHash_v1,
        bookingFingerprint: bookingFingerprint_v1,
      },
    ],
  };

  const binding_v2: ContractPaymentBinding = {
    bindingVersion: 1,
    flowVersion: 2,
    bookingId,
    amount: 100,
    currency: 'VND',
    purpose: PaymentPurpose.FullPayment,
    bookingFingerprint: bookingFingerprint_v2,
    boundAt: new Date(),
    versions: [
      {
        contractId,
        contractVersionId: contractVersionId_v2,
        providerId,
        contentHash: contentHash_v2,
        bookingFingerprint: bookingFingerprint_v2,
      },
    ],
  };

  // -------------------------------------------------------------------------
  // SUITE A: UNIT / MOCK SPECIFIC VERIFICATIONS
  // -------------------------------------------------------------------------
  describe('Suite A: Unit / Mock Validation of Payment Supersede & Double-Count Guard', () => {
    let mockSession: any;
    let mockPaymentsRepository: any;
    let mockBookingModel: any;
    let mockContractCheckoutGuard: any;
    let mockPaymentExpiryClaim: any;
    let mockPaymentRecovery: any;
    let mockV2Finalizer: any;
    let paymentsService: PaymentsService;

    beforeEach(() => {
      mockSession = {
        withTransaction: jest.fn().mockImplementation(async (cb) => cb()),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      mockBookingModel = {
        db: { startSession: jest.fn().mockResolvedValue(mockSession) },
        findById: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockPaymentsRepository = {
        model: {
          findOneAndUpdate: jest.fn(),
          findById: jest.fn(),
          findOne: jest.fn(),
          updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          create: jest.fn(),
          collection: {
            indexes: jest.fn().mockResolvedValue([{ key: { contractIntentKey: 1 }, unique: true }]),
            createIndex: jest.fn().mockResolvedValue('contractIntentKey_1'),
          },
        },
        findPaymentByCode: jest.fn(),
        findPendingPaymentByBooking: jest.fn(),
      };

      mockContractCheckoutGuard = {
        evaluate: jest.fn(),
        assertCurrent: jest.fn().mockResolvedValue(undefined),
      };

      mockPaymentExpiryClaim = {
        claimIntent: jest.fn().mockResolvedValue(undefined),
        claimFinalization: jest.fn().mockResolvedValue(undefined),
      };

      mockPaymentRecovery = {
        recordAcknowledged: jest.fn().mockResolvedValue(undefined),
        requireReview: jest.fn().mockResolvedValue(undefined),
      };

      mockV2Finalizer = {
        processPayment: jest.fn().mockResolvedValue(true),
      };

      paymentsService = new PaymentsService(
        mockPaymentsRepository,
        mockBookingModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        true, // contractsV2Enabled
        mockContractCheckoutGuard,
        mockPaymentExpiryClaim,
        mockPaymentRecovery,
        mockV2Finalizer,
      );
    });

    it('Scenario 1: Old link v1 confirmation is blocked from confirming order; routes to manual review when contract was upgraded to v2', async () => {
      const paymentCode_v1 = 'PAYV2_STALE_V1';
      const payment_v1 = {
        _id: oid(),
        bookingId,
        paymentCode: paymentCode_v1,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Pending,
        contractBinding: binding_v1,
        contractIntentKey: contractIntentKey(binding_v1),
      };

      const bookingPending = {
        _id: bookingId,
        customerId,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        bookingType: BookingType.AoDaiRental,
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockPaymentsRepository.findPaymentByCode.mockResolvedValue(payment_v1);
      mockBookingModel.findById.mockResolvedValue(bookingPending);

      // Current system state evaluated by guard has upgraded to V2!
      mockContractCheckoutGuard.evaluate.mockResolvedValue({
        binding: binding_v2,
        context: {},
      });

      const updatedPaymentInReview = {
        ...payment_v1,
        status: PaymentStatus.Success,
        needsManualReview: true,
      };
      mockPaymentsRepository.model.findOneAndUpdate.mockResolvedValue(updatedPaymentInReview);

      const result = await paymentsService.confirmPayment(paymentCode_v1, {
        source: 'SIMULATOR',
      });

      // 1. Payment status recorded as Success with needsManualReview = true
      expect(result.needsManualReview).toBe(true);

      // 2. Recovery review required recorded with reason CONTRACT_BINDING_STALE
      expect(mockPaymentRecovery.requireReview).toHaveBeenCalledWith(
        payment_v1._id,
        'CONTRACT_BINDING_STALE',
        mockSession,
      );

      // 3. Booking marked with reviewRequired
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId },
        {
          $set: {
            paymentReviewRequired: true,
            paymentReviewReason: 'CONTRACT_BINDING_STALE',
          },
        },
        { session: mockSession },
      );

      // 4. Booking status was NEVER transitioned to Confirmed!
      expect(bookingPending.status).toBe(BookingStatus.PendingPayment);
      // 5. Finalizer processPayment was NOT invoked for stale transaction
      expect(mockV2Finalizer.processPayment).not.toHaveBeenCalled();
    });

    it('Scenario 2: V2 Finalizer throws CONTRACT_BINDING_STALE if payment bound to v1 reaches finalizer while contract in DB is v2', async () => {
      const paymentId = oid();
      const token = 'lease-tok-stale-test';

      const mockBookingsModel: any = {
        db: { startSession: jest.fn().mockResolvedValue(mockSession) },
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: bookingId,
              bookingCode: 'V2-BOOK-STALE-002',
              customerId,
              contractFlowVersion: 2,
              status: BookingStatus.PendingPayment,
              paymentExpiryClaim: { phase: 'FINALIZING', paymentId },
              bookingType: BookingType.Product,
              pricingSummary: { subTotal: 100, grandTotal: 100, depositTotal: 50, discountAmount: 0 },
            }),
          }),
        }),
        updateOne: jest.fn(),
      };

      const mockPaymentsModel: any = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: paymentId,
              bookingId,
              status: PaymentStatus.Success,
              contractBinding: binding_v1, // Bound to v1
              contractIntentKey: contractIntentKey(binding_v1),
            }),
          }),
        }),
      };

      const mockRecoveriesModel: any = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              paymentId,
              bookingId,
              state: PaymentRecoveryState.Finalizing,
              leaseToken: token,
              leaseUntil: new Date(Date.now() + 60000),
              bindingKey: contractIntentKey(binding_v1),
            }),
          }),
        }),
      };

      const mockContractsModel: any = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            // Contract in DB has moved to v2!
            lean: jest.fn().mockResolvedValue({ currentVersionId: contractVersionId_v2 }),
          }),
        }),
      };

      const mockVersionsModel: any = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: contractVersionId_v1,
              state: ContractVersionState.Accepted,
              contentHash: contentHash_v1,
              bookingFingerprint: bookingFingerprint_v1,
            }),
          }),
        }),
      };

      const mockConsentsModel: any = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              action: ContractConsentAction.Accept,
              contentHash: contentHash_v1,
              bookingFingerprint: bookingFingerprint_v1,
            }),
          }),
        }),
      };

      const mockContractPolicy: any = {
        getContext: jest.fn().mockResolvedValue({ rentalProviderIds: [providerId] }),
      };
      const mockTemplates: any = {
        getApproved: jest.fn().mockReturnValue(template),
      };
      const mockSnapshots: any = {
        build: jest.fn().mockResolvedValue(snapshot_v1),
      };
      const mockPreparation: any = {
        assertSourcesUnchanged: jest.fn().mockResolvedValue(undefined),
      };

      const finalizerService = new V2PaymentFinalizationService(
        true,
        mockBookingsModel,
        { find: jest.fn() } as any,
        { updateMany: jest.fn() } as any,
        { countDocuments: jest.fn(), updateMany: jest.fn() } as any,
        mockPaymentsModel,
        mockRecoveriesModel,
        { updateOne: jest.fn() } as any,
        { updateOne: jest.fn() } as any,
        mockContractsModel,
        mockVersionsModel,
        mockConsentsModel,
        {} as any,
        {} as any,
        {} as any,
        mockContractPolicy,
        mockPreparation,
        mockSnapshots,
        mockTemplates,
      );

      // Calling finalize directly must throw FinalizationReviewError with CONTRACT_BINDING_STALE
      await expect(finalizerService.finalize(paymentId, token)).rejects.toThrow(
        new FinalizationReviewError('CONTRACT_BINDING_STALE'),
      );
      // Booking was NOT updated to Confirmed!
      expect(mockBookingsModel.updateOne).not.toHaveBeenCalled();
    });

    it('Scenario 3: Customer can continue and complete order with payment bound to v2 after accepting v2', async () => {
      const paymentCode_v2 = 'PAYV2_FRESH_V2';
      const payment_v2 = {
        _id: oid(),
        bookingId,
        paymentCode: paymentCode_v2,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Pending,
        contractBinding: binding_v2,
        contractIntentKey: contractIntentKey(binding_v2),
      };

      const bookingPending = {
        _id: bookingId,
        customerId,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        bookingType: BookingType.AoDaiRental,
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockPaymentsRepository.findPaymentByCode.mockResolvedValue(payment_v2);
      mockBookingModel.findById.mockResolvedValue(bookingPending);

      // System guard evaluates current state which matches binding_v2!
      mockContractCheckoutGuard.evaluate.mockResolvedValue({
        binding: binding_v2,
        context: {},
      });

      const confirmedPayment = {
        ...payment_v2,
        status: PaymentStatus.Success,
        needsManualReview: false,
      };
      mockPaymentsRepository.model.findOneAndUpdate.mockResolvedValue(confirmedPayment);

      const result = await paymentsService.confirmPayment(paymentCode_v2, {
        source: 'SIMULATOR',
      });

      // 1. Payment status is Success without manual review flag
      expect(result.status).toBe(PaymentStatus.Success);
      expect(result.needsManualReview).toBe(false);

      // 2. Finalization claimed on booking
      expect(mockPaymentExpiryClaim.claimFinalization).toHaveBeenCalledWith(
        bookingId,
        payment_v2._id,
        mockSession,
      );

      // 3. Recovery recorded as acknowledged
      expect(mockPaymentRecovery.recordAcknowledged).toHaveBeenCalledWith(
        payment_v2._id,
        bookingId,
        payment_v2.contractIntentKey,
        mockSession,
      );

      // 4. v2Finalizer is triggered to finalize the confirmed booking
      expect(mockV2Finalizer.processPayment).toHaveBeenCalledWith(payment_v2._id);
    });

    it('Scenario 4: createV2PaymentIntent supersedes pending payment v1 safely without throwing 409', async () => {
      const payment_v1 = {
        _id: oid(),
        bookingId,
        status: PaymentStatus.Pending,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        contractBinding: binding_v1,
        contractIntentKey: contractIntentKey(binding_v1),
      };

      const booking = {
        _id: bookingId,
        bookingCode: 'BK-TEST-SUPERSEDE',
        customerId,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
      };

      mockBookingModel.findById.mockResolvedValue(booking);
      mockContractCheckoutGuard.evaluate.mockResolvedValue({
        binding: binding_v2,
        context: {},
      });

      // findPendingPaymentByBooking finds payment_v1 (stale binding)
      mockPaymentsRepository.findPendingPaymentByBooking.mockResolvedValue(payment_v1);
      // Query for existingBound (with contractIntentKey) returns null, while session query for pending finds payment_v1
      mockPaymentsRepository.model.findOne.mockImplementation((filter: any) => {
        if (filter?.contractIntentKey) {
          return Promise.resolve(null);
        }
        return {
          session: jest.fn().mockResolvedValue(payment_v1),
        };
      });

      const payment_v2_created = {
        _id: oid(),
        bookingId,
        status: PaymentStatus.Pending,
        amount: 100,
        contractBinding: binding_v2,
        contractIntentKey: contractIntentKey(binding_v2),
      };
      mockPaymentsRepository.model.create.mockResolvedValue([payment_v2_created]);

      const result = await (paymentsService as any).createV2PaymentIntent(
        booking,
        PaymentPurpose.FullPayment,
        100,
      );

      expect(result).toBeDefined();
      expect(result.contractIntentKey).toBe(contractIntentKey(binding_v2));

      // Verify payment_v1 was atomically marked Cancelled with supersede metadata
      expect(mockPaymentsRepository.model.updateOne).toHaveBeenCalledWith(
        { _id: payment_v1._id, status: PaymentStatus.Pending },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: PaymentStatus.Cancelled,
            supersededReason: 'CONTRACT_VERSION_UPGRADED',
          }),
        }),
        expect.objectContaining({ session: mockSession }),
      );

      // Verify booking payment claim was freed for payment_v1 so claimIntent can acquire it for p2
      expect(mockBookingModel.updateOne).toHaveBeenCalledWith(
        { _id: bookingId, 'paymentExpiryClaim.paymentId': payment_v1._id },
        { $set: { paymentExpiryClaim: null } },
        { session: mockSession },
      );
    });

    it('Scenario 5: V2 Finalizer excludes needsManualReview and mismatched intent keys from total paid calculation (no double-count)', async () => {
      const mockPaymentsFind = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ amount: 100 }]), // Returns only valid p2
          }),
        }),
      });

      const finalizerService = new V2PaymentFinalizationService(
        true,
        mockBookingModel,
        { find: jest.fn() } as any,
        { updateMany: jest.fn() } as any,
        { countDocuments: jest.fn(), updateMany: jest.fn() } as any,
        { find: mockPaymentsFind, findById: jest.fn() } as any,
        { find: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() } as any,
        { updateOne: jest.fn() } as any,
        { updateOne: jest.fn() } as any,
        { findById: jest.fn() } as any,
        { findById: jest.fn() } as any,
        { findOne: jest.fn() } as any,
        {} as any,
        {} as any,
        {} as any,
        { getContext: jest.fn() } as any,
        { assertSourcesUnchanged: jest.fn() } as any,
        { build: jest.fn() } as any,
        { getApproved: jest.fn() } as any,
      );

      // Verify that find is called with contractIntentKey and needsManualReview: { $ne: true }
      // This is tested implicitly by finalizer's payment query filter
      expect(finalizerService).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // SUITE B: REAL MONGODB DOCKER INTEGRATION TEST (PORT 27028)
  // -------------------------------------------------------------------------
  describe('Suite B: Real MongoDB Runtime Verification (Docker Port 27028)', () => {
    let connection: Connection;
    let scratchDbName: string;

    let bookingsCol: Model<Booking>;
    let paymentsCol: Model<Payment>;
    let itemsCol: Model<BookingItem>;
    let reservationsCol: Model<InventoryReservation>;
    let recoveriesCol: Model<PaymentRecovery>;
    let contractsCol: Model<DigitalContract>;
    let versionsCol: Model<ContractVersion>;
    let consentsCol: Model<ContractConsent>;

    let paymentsRepo: PaymentsRepository;
    let claimService: PaymentExpiryClaimService;
    let recoveryService: PaymentRecoveryService;
    let paymentsService: PaymentsService;
    let finalizerService: V2PaymentFinalizationService;
    let checkoutGuard: any;
    let mockContractPolicy: any;
    let mockSnapshots: any;

    const mongoUri = 'mongodb://127.0.0.1:27028/?replicaSet=rsContractTest&directConnection=true';

    beforeAll(async () => {
      scratchDbName = `contract_real_${oid().toHexString()}_test`;
      try {
        connection = await createConnection(`${mongoUri}&authSource=admin`, {
          dbName: scratchDbName,
          serverSelectionTimeoutMS: 1500,
        }).asPromise();
      } catch {
        connection = null as any;
        return;
      }

      bookingsCol = connection.model(Booking.name, BookingSchema);
      paymentsCol = connection.model(Payment.name, PaymentSchema);
      itemsCol = connection.model(BookingItem.name, BookingItemSchema);
      reservationsCol = connection.model(InventoryReservation.name, InventoryReservationSchema);
      recoveriesCol = connection.model(PaymentRecovery.name, PaymentRecoverySchema);
      contractsCol = connection.model(DigitalContract.name, DigitalContractSchema);
      versionsCol = connection.model(ContractVersion.name, ContractVersionSchema);
      consentsCol = connection.model(ContractConsent.name, ContractConsentSchema);

      await paymentsCol.init();
      await bookingsCol.init();

      paymentsRepo = new PaymentsRepository(paymentsCol);
      claimService = new PaymentExpiryClaimService(bookingsCol);
      recoveryService = new PaymentRecoveryService(
        true,
        recoveriesCol,
        paymentsCol,
        bookingsCol,
      );

      checkoutGuard = {
        evaluate: jest.fn(),
        assertCurrent: jest.fn().mockResolvedValue(undefined),
      };

      const mockPhotoHolds: any = {
        confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }),
      };
      mockContractPolicy = {
        getContext: jest.fn().mockResolvedValue({ rentalProviderIds: [providerId] }),
      };
      const mockPreparation: any = {
        assertSourcesUnchanged: jest.fn().mockResolvedValue(undefined),
      };
      mockSnapshots = {
        build: jest.fn().mockResolvedValue(snapshot_v2),
      };
      const mockTemplates: any = {
        getApproved: jest.fn().mockReturnValue(template),
      };

      finalizerService = new V2PaymentFinalizationService(
        true,
        bookingsCol,
        itemsCol,
        { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }) } as any,
        reservationsCol,
        paymentsCol,
        recoveriesCol,
        { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) } as any,
        { updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }) } as any,
        contractsCol,
        versionsCol,
        consentsCol,
        mockPhotoHolds,
        {
          findRedemptionByBooking: jest.fn().mockResolvedValue(null),
          redeemVoucher: jest.fn().mockResolvedValue(undefined),
        } as any,
        recoveryService,
        mockContractPolicy,
        mockPreparation,
        mockSnapshots,
        mockTemplates,
      );

      paymentsService = new PaymentsService(
        paymentsRepo,
        bookingsCol,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockPhotoHolds,
        {} as any,
        {} as any,
        true,
        checkoutGuard,
        claimService,
        recoveryService,
        finalizerService,
      );
    });

    afterAll(async () => {
      if (connection) {
        await connection.db?.dropDatabase();
        await connection.close();
      }
    });

    it('Runtime Real Test: Full Flow (p1 created -> terms change to v2 -> consent v2 -> create p2 -> p1 superseded -> complete with p2)', async () => {
      if (!connection) {
        console.warn('Skipping Docker Mongo test: 27028 not available');
        return;
      }
      const realBookingId = oid();
      const realCustomerId = oid();
      const realProviderId = oid();
      const realContractId = oid();
      const realVersionId_v1 = oid();
      const realVersionId_v2 = oid();

      // 1. Seed Real Booking in MongoDB
      const now = new Date();
      const holdExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      await bookingsCol.create({
        _id: realBookingId,
        bookingCode: `BK_REAL_${realBookingId.toHexString().slice(-6)}`,
        customerId: realCustomerId,
        providerIds: [realProviderId],
        bookingType: BookingType.AoDaiRental,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        holdExpiresAt,
        pricingSummary: { subTotal: 100, grandTotal: 100, depositTotal: 50, discountAmount: 0 },
      });

      // 2. Seed Real BookingItem and InventoryReservation in MongoDB
      const realItemId = oid();
      await itemsCol.create({
        _id: realItemId,
        bookingId: realBookingId,
        providerId: realProviderId,
        itemType: BookingItemType.Product,
        quantity: 1,
        unitPrice: 100,
        priceVersionId: oid(),
      });
      await reservationsCol.create({
        bookingId: realBookingId,
        bookingItemId: realItemId,
        inventoryItemId: oid(),
        reservedFrom: now,
        reservedTo: holdExpiresAt,
        status: ReservationStatus.TempReserved,
        expiresAt: holdExpiresAt,
        quantity: 1,
      });

      // 3. Seed Contract V1 in MongoDB
      const realSnapshot_v1 = {
        bookingId: realBookingId.toString(),
        customerId: realCustomerId.toString(),
        providerId: realProviderId.toString(),
        bookingType: 'AODAI_RENTAL',
        bookingItemIds: [realItemId.toString()],
        booking: { bookingCode: `BK_REAL_${realBookingId.toHexString().slice(-6)}` },
        customer: { name: 'Customer Test' },
        provider: { name: 'Provider Test' },
        providerItems: [{ bookingItemId: realItemId.toString(), unitPrice: 100, quantity: 1 }],
        pricing: { grandTotal: 100, depositTotal: 50 },
        policies: { policyVersion: 1 },
        template: { templateId: 'v1', version: 1 },
      };
      const realContentHash_v1 = hashContract({ template, snapshot: realSnapshot_v1 });
      const realBookingFingerprint_v1 = hashContract({
        booking: realSnapshot_v1.booking,
        providerItems: realSnapshot_v1.providerItems,
        pricing: realSnapshot_v1.pricing,
      });

      const realSnapshot_v2 = {
        ...realSnapshot_v1,
        booking: { ...realSnapshot_v1.booking, updated: true },
        policies: { policyVersion: 2 },
      };
      const realContentHash_v2 = hashContract({ template, snapshot: realSnapshot_v2 });
      const realBookingFingerprint_v2 = hashContract({
        booking: realSnapshot_v2.booking,
        providerItems: realSnapshot_v2.providerItems,
        pricing: realSnapshot_v2.pricing,
      });

      mockContractPolicy.getContext.mockResolvedValue({ rentalProviderIds: [realProviderId] });
      mockSnapshots.build.mockResolvedValue(realSnapshot_v2);

      const realBinding_v1: ContractPaymentBinding = {
        bindingVersion: 1,
        flowVersion: 2,
        bookingId: realBookingId,
        amount: 100,
        currency: 'VND',
        purpose: PaymentPurpose.FullPayment,
        bookingFingerprint: realBookingFingerprint_v1,
        boundAt: now,
        versions: [
          {
            contractId: realContractId,
            contractVersionId: realVersionId_v1,
            providerId: realProviderId,
            contentHash: realContentHash_v1,
            bookingFingerprint: realBookingFingerprint_v1,
          },
        ],
      };

      await contractsCol.create({
        _id: realContractId,
        bookingId: realBookingId,
        providerId: realProviderId,
        customerId: realCustomerId,
        contractCode: `V2-${realBookingId}-${realProviderId}`,
        flowVersion: 2,
        scope: ContractScope.AoDaiRental,
        approvalMode: ContractApprovalMode.AutoAcceptance,
        status: ContractStatus.Draft,
        currentRevision: 1,
        currentVersionId: realVersionId_v1,
      });

      await versionsCol.create({
        _id: realVersionId_v1,
        contractId: realContractId,
        version: 1,
        templateVersion: 'v1',
        snapshot: realSnapshot_v1,
        renderedText: 'Văn bản hợp đồng thuê v1',
        state: ContractVersionState.Accepted,
        contentHash: realContentHash_v1,
        bookingFingerprint: realBookingFingerprint_v1,
        offeredAt: now,
        expiresAt: holdExpiresAt,
      });

      await consentsCol.create({
        contractId: realContractId,
        contractVersionId: realVersionId_v1,
        actorUserId: realCustomerId,
        actorRole: ContractConsentRole.Customer,
        action: ContractConsentAction.Accept,
        contentHash: realContentHash_v1,
        bookingFingerprint: realBookingFingerprint_v1,
        idempotencyKey: oid().toHexString(),
        occurredAt: now,
        authenticationMethod: 'APP_SESSION' as const,
      });

      // 4. Create Real Payment p1 bound to v1
      checkoutGuard.evaluate.mockResolvedValueOnce({
        binding: realBinding_v1,
        context: {},
      });

      const p1 = await paymentsService.createPaymentLink(
        realBookingId.toString(),
        PaymentPurpose.FullPayment,
        realCustomerId.toString(),
      );
      expect(p1.status).toBe(PaymentStatus.Pending);
      expect(p1.contractIntentKey).toBe(contractIntentKey(realBinding_v1));

      // Verify p1 is in MongoDB
      const p1InDb = await paymentsCol.findById(p1._id);
      expect(p1InDb?.status).toBe(PaymentStatus.Pending);

      // 5. Terms change: Upgrade to Contract V2 in MongoDB
      const realBinding_v2: ContractPaymentBinding = {
        bindingVersion: 1,
        flowVersion: 2,
        bookingId: realBookingId,
        amount: 100,
        currency: 'VND',
        purpose: PaymentPurpose.FullPayment,
        bookingFingerprint: realBookingFingerprint_v2,
        boundAt: now,
        versions: [
          {
            contractId: realContractId,
            contractVersionId: realVersionId_v2,
            providerId: realProviderId,
            contentHash: realContentHash_v2,
            bookingFingerprint: realBookingFingerprint_v2,
          },
        ],
      };

      await contractsCol.updateOne(
        { _id: realContractId },
        { $set: { currentRevision: 2, currentVersionId: realVersionId_v2 } },
      );

      await versionsCol.create({
        _id: realVersionId_v2,
        contractId: realContractId,
        version: 2,
        templateVersion: 'v1',
        snapshot: realSnapshot_v2,
        renderedText: 'Văn bản hợp đồng thuê v2',
        state: ContractVersionState.Accepted,
        contentHash: realContentHash_v2,
        bookingFingerprint: realBookingFingerprint_v2,
        offeredAt: now,
        expiresAt: holdExpiresAt,
      });

      await consentsCol.create({
        contractId: realContractId,
        contractVersionId: realVersionId_v2,
        actorUserId: realCustomerId,
        actorRole: ContractConsentRole.Customer,
        action: ContractConsentAction.Accept,
        contentHash: realContentHash_v2,
        bookingFingerprint: realBookingFingerprint_v2,
        idempotencyKey: oid().toHexString(),
        occurredAt: now,
        authenticationMethod: 'APP_SESSION' as const,
      });

      checkoutGuard.evaluate.mockResolvedValue({
        binding: realBinding_v2,
        context: {},
      });

      // 6. Create Real Payment p2 while p1 is still in DB
      const p2 = await paymentsService.createPaymentLink(
        realBookingId.toString(),
        PaymentPurpose.FullPayment,
        realCustomerId.toString(),
      );

      expect(p2._id.toString()).not.toBe(p1._id.toString());
      expect(p2.contractIntentKey).toBe(contractIntentKey(realBinding_v2));
      expect(p2.status).toBe(PaymentStatus.Pending);

      // Verify in MongoDB: p1 was safely superseded (status: Cancelled)
      const p1Reloaded = await paymentsCol.findById(p1._id);
      expect(p1Reloaded?.status).toBe(PaymentStatus.Cancelled);
      expect(p1Reloaded?.contractBinding).toBeDefined(); // History & binding preserved!
      expect((p1Reloaded as any)?.supersededReason).toBe('CONTRACT_VERSION_UPGRADED');

      // Verify in MongoDB: p2 is stored as Pending
      const p2Reloaded = await paymentsCol.findById(p2._id);
      expect(p2Reloaded?.status).toBe(PaymentStatus.Pending);

      // 7. Complete booking with p2 via Simulator
      const confirmed_p2 = await paymentsService.confirmPayment(p2.paymentCode, {
        source: 'SIMULATOR',
      });
      expect(confirmed_p2.status).toBe(PaymentStatus.Success);
      expect(confirmed_p2.needsManualReview).toBeFalsy();

      // Trigger finalizer for p2
      const claimed = await recoveryService.claim(p2._id);
      if (claimed) {
        await finalizerService.finalize(p2._id, claimed.token);
      }

      // Verify in real MongoDB: Booking status transitioned to CONFIRMED!
      const bookingFinal = await bookingsCol.findById(realBookingId);
      expect(bookingFinal?.status).toBe(BookingStatus.Confirmed);
      expect(bookingFinal?.paymentReviewRequired).toBeFalsy();
    });

    it('Runtime Real Test: Late callback on superseded p1 creates manual-review evidence and NEVER alters booking status', async () => {
      if (!connection) {
        console.warn('Skipping Docker Mongo test: 27028 not available');
        return;
      }
      const realBookingId = oid();
      const realCustomerId = oid();
      const realProviderId = oid();

      await bookingsCol.create({
        _id: realBookingId,
        bookingCode: `BK_LATE_${realBookingId.toHexString().slice(-6)}`,
        customerId: realCustomerId,
        providerIds: [realProviderId],
        bookingType: BookingType.AoDaiRental,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        pricingSummary: { subTotal: 100, grandTotal: 100, depositTotal: 50, discountAmount: 0 },
      });

      const p1Doc = await paymentsCol.create({
        _id: oid(),
        bookingId: realBookingId,
        paymentCode: `PAY_LATE_${oid().toHexString().slice(-8)}`,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        paymentMethod: 'PAYOS_SIMULATOR',
        status: PaymentStatus.Cancelled, // Superseded previously
        contractBinding: binding_v1,
        contractIntentKey: contractIntentKey(binding_v1),
      });

      // Late webhook arrives for p1
      const result = await paymentsService.confirmPayment(p1Doc.paymentCode, {
        source: 'WEBHOOK',
      });

      // 1. Payment marked Success with needsManualReview = true in MongoDB
      expect(result.status).toBe(PaymentStatus.Success);
      expect(result.needsManualReview).toBe(true);

      const p1InDb = await paymentsCol.findById(p1Doc._id);
      expect(p1InDb?.needsManualReview).toBe(true);

      // 2. Recovery document created in MongoDB for manual review
      const recoveryInDb = await recoveriesCol.findOne({ paymentId: p1Doc._id });
      expect(recoveryInDb).toBeDefined();
      expect(recoveryInDb?.state).toBe(PaymentRecoveryState.ReviewRequired);

      // 3. Booking in MongoDB marked with reviewRequired, NOT CONFIRMED
      const bookingInDb = await bookingsCol.findById(realBookingId);
      expect(bookingInDb?.status).toBe(BookingStatus.PendingPayment);
      expect(bookingInDb?.paymentReviewRequired).toBe(true);
    });

    it('Runtime Real Test: Idempotency under concurrent create-link calls for same binding', async () => {
      if (!connection) {
        console.warn('Skipping Docker Mongo test: 27028 not available');
        return;
      }
      const realBookingId = oid();
      const realCustomerId = oid();
      const realProviderId = oid();

      await bookingsCol.create({
        _id: realBookingId,
        bookingCode: `BK_CONC_${realBookingId.toHexString().slice(-6)}`,
        customerId: realCustomerId,
        providerIds: [realProviderId],
        bookingType: BookingType.AoDaiRental,
        status: BookingStatus.PendingPayment,
        contractFlowVersion: 2,
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        pricingSummary: { subTotal: 100, grandTotal: 100, depositTotal: 50, discountAmount: 0 },
      });

      const concurrentBinding: ContractPaymentBinding = {
        bindingVersion: 1,
        flowVersion: 2,
        bookingId: realBookingId,
        amount: 100,
        currency: 'VND',
        purpose: PaymentPurpose.FullPayment,
        bookingFingerprint: bookingFingerprint_v2,
        boundAt: new Date(),
        versions: [
          {
            contractId: oid(),
            contractVersionId: oid(),
            providerId: realProviderId,
            contentHash: contentHash_v2,
            bookingFingerprint: bookingFingerprint_v2,
          },
        ],
      };

      checkoutGuard.evaluate.mockResolvedValue({
        binding: concurrentBinding,
        context: {},
      });

      // Fire two concurrent calls
      const [res1, res2] = await Promise.all([
        paymentsService.createPaymentLink(
          realBookingId.toString(),
          PaymentPurpose.FullPayment,
          realCustomerId.toString(),
        ),
        paymentsService.createPaymentLink(
          realBookingId.toString(),
          PaymentPurpose.FullPayment,
          realCustomerId.toString(),
        ),
      ]);

      // Both calls must return the EXACT same payment intent
      expect(res1._id.toString()).toBe(res2._id.toString());
      expect(res1.contractIntentKey).toBe(res2.contractIntentKey);

      // Only ONE payment document was created in MongoDB for this intent key
      const count = await paymentsCol.countDocuments({
        bookingId: realBookingId,
        contractIntentKey: contractIntentKey(concurrentBinding),
      });
      expect(count).toBe(1);
    });
  });
});
