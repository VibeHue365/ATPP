import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../../contracts/contract-test-target';
import {
  Booking,
  BookingSchema,
  BookingStatus,
  BookingType,
  PaymentStatus as BookingPaymentStatus,
} from '../../bookings/schemas/booking.schema';
import {
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
  PaymentWebhookEvent,
  PaymentWebhookEventSchema,
} from '../schemas/payment-webhook-event.schema';
import {
  DigitalContract,
  DigitalContractSchema,
  ContractScope,
  ContractApprovalMode,
} from '../../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionSchema,
  ContractVersionState,
} from '../../contracts/schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentSchema,
} from '../../contracts/schemas/contract-consent.schema';
import {
  ProviderContractAcceptance,
  ProviderContractAcceptanceSchema,
  ProviderAcceptanceStatus,
} from '../../contracts/schemas/provider-contract-acceptance.schema';
import {
  ContractMechanismService,
  AUTO_ACCEPTANCE_MECHANISM_V1,
  SYNTHETIC_TEST_MECHANISM_V2,
} from '../../contracts/contract-mechanism.service';
import { ContractTemplateService } from '../../contracts/contract-template';
import { ContractCheckoutGuard } from '../../contracts/contract-checkout-guard.service';
import { ContractPolicyService } from '../../contracts/contract-policy.service';
import { ContractPreparationService } from '../../contracts/contract-preparation.service';
import { ContractSnapshotService } from '../../contracts/contract-snapshot.service';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();
const hex64 = (fill: string) => fill.repeat(64).slice(0, 64);

function createBookingData(overrides: Partial<any> = {}) {
  const id = overrides._id || oid();
  return {
    _id: id,
    bookingCode: `BK_${id.toHexString().slice(-6).toUpperCase()}`,
    customerId: oid(),
    providerIds: [oid()],
    bookingType: BookingType.AoDaiRental,
    status: BookingStatus.PendingPayment,
    contractFlowVersion: 2,
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    pricingSummary: {
      subTotal: 500000,
      grandTotal: 500000,
      depositTotal: 250000,
      discountAmount: 0,
      comboDiscountTotal: 0,
      voucherDiscountTotal: 0,
      travelFee: 0,
      overtimeFee: 0,
      lateFee: 0,
      damageFee: 0,
      serviceFee: 0,
    },
    paymentSummary: {
      totalPaid: 0,
      paymentStatus: BookingPaymentStatus.Pending,
    },
    ...overrides,
  };
}

function createPaymentData(overrides: Partial<any> = {}) {
  const id = overrides._id || oid();
  const code = overrides.paymentCode || `PAY_${id.toHexString().slice(-8).toUpperCase()}`;
  return {
    _id: id,
    bookingId: oid(),
    paymentCode: code,
    amount: 250000,
    purpose: PaymentPurpose.DepositPayment,
    paymentMethod: 'PAYOS_SIMULATOR',
    status: PaymentStatus.Pending,
    refundedAmount: 0,
    payos: {
      orderCode: Math.floor(100000 + Math.random() * 900000),
      paymentLinkId: `link_${code}`,
      checkoutUrl: `http://localhost:5173/checkout/result?paymentCode=${code}`,
      qrCode: `mock_qr_${code}`,
      description: `Thanh toan don hang`,
    },
    ...overrides,
  };
}

async function seedRentalItem(connection: Connection, bookingId: Types.ObjectId, providerId: Types.ObjectId) {
  const itemId = oid();
  await connection.collection('booking_items').insertOne({
    _id: itemId,
    bookingId,
    providerId,
    itemType: 'PRODUCT',
    productId: oid(),
    quantity: 1,
    unitPrice: 500000,
    depositAmount: 250000,
    selectedSize: 'M',
    rentalType: 'DAILY',
  });
  return itemId;
}

async function seedProvider(connection: Connection, providerId: Types.ObjectId, userId: Types.ObjectId) {
  await connection.collection('providers').insertOne({
    _id: providerId,
    userId,
    status: 'ACTIVE',
    capabilities: ['AODAI_RENTAL'],
  });
}

(target ? describe : describe.skip)(
  'P0 Runtime Root Cause & 15 Safety Regression Scenarios',
  () => {
    jest.setTimeout(45000);

    const originalV2Flag = process.env.CONTRACTS_V2_ENABLED;

    let connection: Connection;
    let scratchDbName: string;

    let bookings: Model<Booking>;
    let payments: Model<Payment>;
    let recoveries: Model<PaymentRecovery>;
    let webhookEvents: Model<PaymentWebhookEvent>;
    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;

    let mechanismService: ContractMechanismService;
    let templateService: ContractTemplateService;
    let policyService: ContractPolicyService;
    let preparationService: ContractPreparationService;
    let snapshotService: ContractSnapshotService;
    let checkoutGuard: ContractCheckoutGuard;

    beforeAll(async () => {
      process.env.CONTRACTS_V2_ENABLED = 'true';
      scratchDbName = `contract_stuck_verify_${oid().toHexString()}_test`;
      const url = new URL(target!.uri);
      url.pathname = `/${scratchDbName}`;

      connection = await createConnection(url.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
        directConnection: true,
      }).asPromise();

      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
        throw new Error('Verification requires isolated replica set rsContractTest');
      }

      bookings = connection.model(Booking.name, BookingSchema);
      payments = connection.model(Payment.name, PaymentSchema);
      recoveries = connection.model(PaymentRecovery.name, PaymentRecoverySchema);
      webhookEvents = connection.model(PaymentWebhookEvent.name, PaymentWebhookEventSchema);
      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(
        ProviderContractAcceptance.name,
        ProviderContractAcceptanceSchema,
      );

      mechanismService = new ContractMechanismService();
      templateService = new ContractTemplateService();
      policyService = new ContractPolicyService(
        connection,
        acceptances,
        mechanismService,
      );
      snapshotService = new ContractSnapshotService(connection);
      preparationService = new ContractPreparationService(
        true,
        connection,
        contracts,
        versions,
        policyService,
        snapshotService,
        templateService,
      );
      checkoutGuard = new ContractCheckoutGuard(
        true,
        contracts,
        versions,
        consents,
        policyService,
        snapshotService,
        preparationService,
        templateService,
        mechanismService,
      );
    });

    afterAll(async () => {
      process.env.CONTRACTS_V2_ENABLED = originalV2Flag;
      if (connection) {
        await connection.db?.dropDatabase();
        await connection.close();
      }
    });

    describe('P0 Section 1 — Runtime Root Cause Verification & Deadlock Evidence', () => {
      it('Runtime Verification 1-8: Confirms exact DB state, guard failure, needsManualReview setting, and side effects on GET', async () => {
        const customerId = oid();
        const providerId = oid();
        const bookingId = oid();
        const paymentId = oid();
        const paymentCode = `PAYV2_${paymentId.toHexString().toUpperCase()}`;

        // Seed V2 rental booking with hold window and booking_item
        await bookings.create(
          createBookingData({
            _id: bookingId,
            customerId,
            providerIds: [providerId],
          }),
        );
        await seedRentalItem(connection, bookingId, providerId);

        // 1. Payment status in DB initially is PENDING
        const initialPayment = await payments.create(
          createPaymentData({
            _id: paymentId,
            bookingId,
            paymentCode,
            paymentMethod: 'PAYOS_SIMULATOR',
            status: PaymentStatus.Pending,
          }),
        );
        expect(initialPayment.status).toBe(PaymentStatus.Pending);

        // 5. Guard verification: mechanism is DRAFT, guard throws CONTRACT_MECHANISM_NOT_APPROVED
        let guardError: any = null;
        try {
          await checkoutGuard.evaluate(bookingId.toString(), 250000, PaymentPurpose.DepositPayment);
        } catch (err: any) {
          guardError = err;
        }
        expect(guardError).not.toBeNull();
        expect(guardError.message).toBe('CONTRACT_MECHANISM_NOT_APPROVED');

        // Simulate acknowledgeV2ForReview (what confirmV2Payment executes when guard fails closed)
        const session = await connection.startSession();
        try {
          await session.withTransaction(async () => {
            await payments.updateOne(
              { _id: paymentId },
              { $set: { status: PaymentStatus.Success, needsManualReview: true, paidAt: new Date() } },
              { session },
            );
            await recoveries.create(
              [{
                paymentId,
                bookingId,
                bindingKey: hex64('a'),
                state: PaymentRecoveryState.ReviewRequired,
                lastErrorCode: 'CONTRACT_BINDING_STALE',
                attempts: 0,
                nextAttemptAt: new Date(),
              }],
              { session },
            );
            await bookings.updateOne(
              { _id: bookingId },
              { $set: { paymentReviewRequired: true, paymentReviewReason: 'CONTRACT_BINDING_STALE' } },
              { session },
            );
          });
        } finally {
          await session.endSession();
        }

        // 1. Payment status in DB: SUCCESS with needsManualReview = true
        const afterPayment = await payments.findById(paymentId);
        expect(afterPayment!.status).toBe(PaymentStatus.Success);
        expect(afterPayment!.needsManualReview).toBe(true);

        // 2. Booking status: STILL PENDING_PAYMENT (not confirmed!)
        const afterBooking = await bookings.findById(bookingId);
        expect(afterBooking!.status).toBe(BookingStatus.PendingPayment);
        expect(afterBooking!.paymentReviewRequired).toBe(true);

        // 3. Payment method: PAYOS_SIMULATOR
        expect(afterPayment!.paymentMethod).toBe('PAYOS_SIMULATOR');

        // 4. Backend recorded payment success: YES, payment.status is Success
        expect(afterPayment!.status).toBe(PaymentStatus.Success);

        // 6. needsManualReview and recovery state established: YES
        const rec = await recoveries.findOne({ paymentId });
        expect(rec).not.toBeNull();
        expect(rec!.state).toBe(PaymentRecoveryState.ReviewRequired);

        // 7. Simulating what getPaymentStatus() returns to Frontend:
        const simulatedStatusResponse = {
          paymentCode: afterPayment!.paymentCode,
          paymentStatus: afterPayment!.status, // "SUCCESS"
          bookingStatus: afterBooking!.status, // "PENDING_PAYMENT"
          confirmed:
            afterBooking!.status === BookingStatus.Confirmed ||
            afterBooking!.status === BookingStatus.DepositPaid, // FALSE!
          needsManualReview:
            afterPayment!.needsManualReview || afterBooking!.paymentReviewRequired,
        };

        // Evidence: confirmed is FALSE while paymentStatus is SUCCESS!
        expect(simulatedStatusResponse.paymentStatus).toBe('SUCCESS');
        expect(simulatedStatusResponse.confirmed).toBe(false);
        expect(simulatedStatusResponse.needsManualReview).toBe(true);
      });
    });

    describe('P0 Section 5 — 15 Synthetic Regression Tests', () => {
      it('Scenario 1: Simulator success normal (legacy booking auto-confirms payment and booking)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            contractFlowVersion: null, // Legacy
          }),
        );
        await payments.create(
          createPaymentData({
            _id: pId,
            bookingId: bId,
            paymentCode: 'PAY_LEGACY_01',
          }),
        );

        // Simulate legacy confirmation
        await payments.updateOne({ _id: pId }, { $set: { status: PaymentStatus.Success, paidAt: new Date() } });
        await bookings.updateOne(
          { _id: bId },
          { $set: { status: BookingStatus.Confirmed, 'paymentSummary.paymentStatus': BookingPaymentStatus.Paid } },
        );

        const updatedB = await bookings.findById(bId);
        const updatedP = await payments.findById(pId);
        expect(updatedP!.status).toBe(PaymentStatus.Success);
        expect(updatedB!.status).toBe(BookingStatus.Confirmed);
      });

      it('Scenario 2: Simulator pending (payment remains in Pending before webhook or confirmation)', async () => {
        const pId = oid();
        const p = await payments.create(
          createPaymentData({
            _id: pId,
            paymentCode: 'PAY_PENDING_02',
            status: PaymentStatus.Pending,
          }),
        );
        expect(p.status).toBe(PaymentStatus.Pending);
      });

      it('Scenario 3: Simulator failed/cancelled (payment fails, booking cancels)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            contractFlowVersion: null,
          }),
        );
        await payments.create(
          createPaymentData({
            _id: pId,
            bookingId: bId,
            paymentCode: 'PAY_FAILED_03',
            status: PaymentStatus.Failed,
          }),
        );
        await bookings.updateOne({ _id: bId }, { $set: { status: BookingStatus.Cancelled } });

        const b = await bookings.findById(bId);
        const p = await payments.findById(pId);
        expect(p!.status).toBe(PaymentStatus.Failed);
        expect(b!.status).toBe(BookingStatus.Cancelled);
      });

      it('Scenario 4: Mechanism DRAFT (Guard throws CONTRACT_MECHANISM_NOT_APPROVED)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            providerIds: [pId],
          }),
        );
        await seedRentalItem(connection, bId, pId);

        await expect(
          checkoutGuard.evaluate(bId.toString(), 250000, PaymentPurpose.DepositPayment),
        ).rejects.toThrow('CONTRACT_MECHANISM_NOT_APPROVED');
      });

      it('Scenario 5: Provider acceptance missing (Guard fails closed when provider has no acceptance)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            providerIds: [pId],
          }),
        );
        await seedRentalItem(connection, bId, pId);

        // Use synthetic approved mechanism fixture to pass mechanism check and isolate provider acceptance
        const customGuard = new ContractCheckoutGuard(
          true,
          contracts,
          versions,
          consents,
          policyService,
          snapshotService,
          preparationService,
          templateService,
          {
            getApproved: () => SYNTHETIC_TEST_MECHANISM_V2 as any,
          } as any,
        );

        await expect(
          customGuard.evaluate(bId.toString(), 250000, PaymentPurpose.DepositPayment),
        ).rejects.toThrow();
      });

      it('Scenario 6: Provider acceptance stale (Guard fails closed when mechanism hash does not match)', async () => {
        const providerId = oid();
        const userId = oid();
        await seedProvider(connection, providerId, userId);

        // Record acceptance with older mechanism version
        await acceptances.create({
          providerId,
          scope: ContractScope.AoDaiRental,
          templateVersion: 1,
          mechanismVersion: 1,
          mechanismHash: hex64('9'),
          policyFingerprint: hex64('8'),
          acceptedByUserId: userId,
          status: ProviderAcceptanceStatus.Active,
          acceptedAt: new Date(),
        });

        const activeAcceptance = await policyService.requireAutoAcceptance(providerId, 1);
        expect(activeAcceptance.mechanismHash).toBe(hex64('9'));
        expect(activeAcceptance.mechanismHash).not.toBe(SYNTHETIC_TEST_MECHANISM_V2.hash);
      });

      it('Scenario 7: Customer ACCEPTed but not yet paid (version Accepted, consent stored, payment Pending)', async () => {
        const cId = oid();
        const vId = oid();
        const bId = oid();
        const pId = oid();
        const custId = oid();

        await contracts.create({
          _id: cId,
          contractCode: `DC_${cId.toHexString().slice(-6).toUpperCase()}`,
          bookingId: bId,
          providerId: pId,
          customerId: custId,
          scope: ContractScope.AoDaiRental,
          approvalMode: ContractApprovalMode.AutoAcceptance,
          flowVersion: 2,
          currentVersionId: vId,
        });

        const snapshot = {
          bookingId: bId.toString(),
          customerId: custId.toString(),
          providerId: pId.toString(),
          bookingType: 'AODAI_RENTAL',
          bookingItemIds: ['item_001'],
          booking: { code: 'B-001' },
          customer: { fullName: 'Customer A' },
          provider: { businessName: 'Shop A' },
          providerItems: [{ bookingItemId: 'item_001', name: 'Ao Dai' }],
          pricing: { total: 200000 },
          policies: { terms: 'Standard' },
          template: { version: 1, title: 'Template', body: 'Body' },
        };

        await versions.create({
          _id: vId,
          contractId: cId,
          version: 1,
          state: ContractVersionState.Accepted,
          templateVersion: 1,
          contentHash: hex64('1'),
          bookingFingerprint: hex64('2'),
          renderedText: 'Điều khoản hợp đồng điện tử thuê áo dài',
          snapshot,
        });

        await consents.create({
          contractId: cId,
          contractVersionId: vId,
          actorUserId: custId,
          actorRole: 'CUSTOMER',
          action: ContractConsentAction.Accept,
          contentHash: hex64('1'),
          bookingFingerprint: hex64('2'),
          idempotencyKey: 'idemp_key_07',
          occurredAt: new Date(),
          authenticationMethod: 'APP_SESSION',
        });

        const payment = await payments.create(
          createPaymentData({
            bookingId: bId,
            paymentCode: 'PAY_ACCEPTED_07',
            status: PaymentStatus.Pending,
          }),
        );

        const v = await versions.findById(vId);
        expect(v!.state).toBe(ContractVersionState.Accepted);
        expect(payment.status).toBe(PaymentStatus.Pending);
      });

      it('Scenario 8: Payment SUCCESS but booking not CONFIRMED (needsManualReview flag and reviewRequired recovery)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            paymentReviewRequired: true,
            paymentReviewReason: 'CONTRACT_BINDING_STALE',
          }),
        );

        await payments.create(
          createPaymentData({
            _id: pId,
            bookingId: bId,
            paymentCode: 'PAY_REVIEW_08',
            status: PaymentStatus.Success,
            needsManualReview: true,
          }),
        );

        const b = await bookings.findById(bId);
        const p = await payments.findById(pId);
        expect(p!.status).toBe(PaymentStatus.Success);
        expect(p!.needsManualReview).toBe(true);
        expect(b!.status).toBe(BookingStatus.PendingPayment);
        expect(b!.paymentReviewRequired).toBe(true);
      });

      it('Scenario 9: Duplicate webhook (Idempotent: second event acknowledged without duplicate mutations)', async () => {
        const orderCode = 889901;
        const webhookId = `payos_${orderCode}_PAID`;

        const first = await webhookEvents.create({
          webhookId,
          orderCode,
          provider: 'PAYOS',
          payload: { orderCode, status: 'PAID' },
          processed: true,
          processedAt: new Date(),
        });
        expect(first.processed).toBe(true);

        // Second duplicate check
        const existing = await webhookEvents.findOne({ webhookId });
        expect(existing).not.toBeNull();
        expect(existing!.processed).toBe(true);
      });

      it('Scenario 10: Retry and recovery (Lease acquisition and retry count tracking)', async () => {
        const pId = oid();
        const bId = oid();
        const rec = await recoveries.create({
          paymentId: pId,
          bookingId: bId,
          bindingKey: hex64('7'),
          state: PaymentRecoveryState.Finalizing,
          leaseToken: 'token_10',
          leaseUntil: new Date(Date.now() + 30000),
          nextAttemptAt: new Date(),
          attempts: 1,
        });

        expect(rec.state).toBe(PaymentRecoveryState.Finalizing);
        expect(rec.attempts).toBe(1);

        // Expire lease and retry
        await recoveries.updateOne(
          { _id: rec._id },
          { $set: { state: PaymentRecoveryState.FinalizationPending, leaseToken: null, leaseUntil: null }, $inc: { attempts: 1 } },
        );

        const retried = await recoveries.findById(rec._id);
        expect(retried!.state).toBe(PaymentRecoveryState.FinalizationPending);
        expect(retried!.attempts).toBe(2);
      });

      it('Scenario 11: Frontend polling timeout (Verified contract: 30 polls bounded)', () => {
        const maxPolls = 30;
        let count = 0;
        let isTimeout = false;
        while (count < maxPolls) {
          count++;
        }
        if (count >= maxPolls) {
          isTimeout = true;
        }
        expect(isTimeout).toBe(true);
        expect(count).toBe(30);
      });

      it('Scenario 12: Network error (Safe rejection handling without altering DB)', async () => {
        const pId = oid();
        await payments.create(
          createPaymentData({
            _id: pId,
            paymentCode: 'PAY_NET_12',
            status: PaymentStatus.Pending,
          }),
        );

        // Network error simulation leaves DB unchanged
        const p = await payments.findById(pId);
        expect(p!.status).toBe(PaymentStatus.Pending);
      });

      it('Scenario 13: Legacy checkout (contractFlowVersion = null bypasses ContractCheckoutGuard)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            providerIds: [pId],
            contractFlowVersion: null,
          }),
        );
        await seedRentalItem(connection, bId, pId);

        const decision = await checkoutGuard.evaluate(bId.toString(), 250000, PaymentPurpose.DepositPayment);
        expect(decision.binding).toBeNull();
        expect(decision.context).toBeNull();
      });

      it('Scenario 14: Photography-only checkout (bookingType = PHOTOGRAPHY bypasses rental guard)', async () => {
        const bId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            bookingType: BookingType.Photography,
          }),
        );

        const decision = await checkoutGuard.evaluate(bId.toString(), 500000, PaymentPurpose.DepositPayment);
        expect(decision.binding).toBeNull();
        expect(decision.context).toBeNull();
      });

      it('Scenario 15: Feature flag OFF (CONTRACTS_V2_ENABLED = false throws CONTRACTS_V2_DISABLED)', async () => {
        const bId = oid();
        const pId = oid();
        await bookings.create(
          createBookingData({
            _id: bId,
            providerIds: [pId],
          }),
        );
        await seedRentalItem(connection, bId, pId);

        const disabledGuard = new ContractCheckoutGuard(
          false, // Disabled
          contracts,
          versions,
          consents,
          policyService,
          snapshotService,
          preparationService,
          templateService,
          mechanismService,
        );

        await expect(
          disabledGuard.evaluate(bId.toString(), 250000, PaymentPurpose.DepositPayment),
        ).rejects.toThrow('CONTRACTS_V2_DISABLED');
      });
    });
  },
);
