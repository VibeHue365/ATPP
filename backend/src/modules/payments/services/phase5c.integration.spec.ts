import { randomUUID } from 'node:crypto';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../../contracts/contract-test-target';
import { Booking, BookingSchema, BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItem, BookingItemSchema, BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleSchema } from '../../bookings/schemas/booking-schedule.schema';
import { InventoryReservation, InventoryReservationSchema, ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { BookingEscrow, BookingEscrowSchema, EscrowStatus } from '../schemas/booking-escrow.schema';
import { Notification, NotificationSchema } from '../../notifications/schemas/notification.schema';
import { Payment, PaymentPurpose, PaymentSchema, PaymentStatus } from '../schemas/payment.schema';
import { PaymentRecovery, PaymentRecoverySchema, PaymentRecoveryState } from '../schemas/payment-recovery.schema';
import { DigitalContract, DigitalContractSchema } from '../../bookings/schemas/digital-contract.schema';
import { ContractVersion, ContractVersionSchema, ContractVersionState } from '../../contracts/schemas/contract-version.schema';
import { ContractConsent, ContractConsentAction, ContractConsentSchema } from '../../contracts/schemas/contract-consent.schema';
import { PaymentRecoveryService } from './payment-recovery.service';
import { V2PaymentFinalizationService } from './v2-payment-finalization.service';
import { contractIntentKey } from './contract-payment-binding';
import { hashContract } from '../../contracts/canonical-contract';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)('Phase 5C: Final Payment & Contract Consistency Hardening', () => {
  let connection: Connection;
  let scratchName: string;

  let bookings: Model<Booking>;
  let bookingItems: Model<BookingItem>;
  let schedules: Model<BookingSchedule>;
  let reservations: Model<InventoryReservation>;
  let escrows: Model<BookingEscrow>;
  let notifications: Model<Notification>;
  let payments: Model<Payment>;
  let recoveries: Model<PaymentRecovery>;
  let contracts: Model<DigitalContract>;
  let versions: Model<ContractVersion>;
  let consents: Model<ContractConsent>;

  let recoveryService: PaymentRecoveryService;

  beforeAll(async () => {
    scratchName = `contract_phase5c_${oid().toHexString()}_test`;
    const uri = new URL(target!.uri);
    uri.pathname = `/${scratchName}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 8000,
    }).asPromise();

    const hello = await connection.db!.admin().command({ hello: 1 });
    if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
      throw new Error('Phase 5C requires the isolated test replica set');
    }

    bookings = connection.model(Booking.name, BookingSchema);
    bookingItems = connection.model(BookingItem.name, BookingItemSchema);
    schedules = connection.model(BookingSchedule.name, BookingScheduleSchema);
    reservations = connection.model(InventoryReservation.name, InventoryReservationSchema);
    escrows = connection.model(BookingEscrow.name, BookingEscrowSchema);
    notifications = connection.model(Notification.name, NotificationSchema);
    payments = connection.model(Payment.name, PaymentSchema);
    recoveries = connection.model(PaymentRecovery.name, PaymentRecoverySchema);
    contracts = connection.model(DigitalContract.name, DigitalContractSchema);
    versions = connection.model(ContractVersion.name, ContractVersionSchema);
    consents = connection.model(ContractConsent.name, ContractConsentSchema);

    await connection.db!.collection('payments').createIndex(
      { contractIntentKey: 1 },
      { unique: true, partialFilterExpression: { contractIntentKey: { $type: 'string' } } },
    );
    await connection.db!.collection('payment_recoveries').createIndex({ paymentId: 1 }, { unique: true });

    recoveryService = new PaymentRecoveryService(true, recoveries, payments, bookings);
  }, 30000);

  afterAll(async () => {
    if (!connection) return;
    if (scratchName.startsWith('contract_phase5c_') && scratchName.endsWith('_test')) {
      await connection.dropDatabase();
    }
    await connection.close();
  }, 30000);

  async function createFixture() {
    const customerId = oid();
    const providerId = oid();
    const bookingId = oid();
    const paymentId = oid();
    const contractId = oid();
    const contractVersionId = oid();
    const productItemId = oid();
    const productId = oid();

    const template = { templateId: 'v1', version: 1, text: 'VibeHue Contract Policy v1' };
    const snapshot = {
      booking: { bookingCode: `5C-${randomUUID()}`, customerId, bookingType: 'AODAI_RENTAL' },
      providerItems: [{
        bookingItemId: productItemId,
        productId,
        productTitle: 'Áo dài lụa Hà Đông',
        variantName: 'Đỏ / M',
        size: 'M',
        color: 'Đỏ',
        quantity: 1,
        unitPrice: 200000,
        depositAmount: 500000,
        rentalStartDate: new Date('2026-11-01T09:00:00Z'),
        rentalEndDate: new Date('2026-11-03T18:00:00Z'),
        rentalDays: 3,
      }],
      pricing: {
        grandTotal: 700000,
        depositTotal: 500000,
        voucherDiscountTotal: 0,
        comboDiscountTotal: 0,
        serviceFee: 0,
        amountDueNow: 700000,
      },
    };

    const bookingFingerprint = hashContract({
      booking: snapshot.booking,
      providerItems: snapshot.providerItems,
      pricing: snapshot.pricing,
    });
    const contentHash = hashContract({ template, snapshot });

    const binding = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId,
      amount: 700000,
      currency: 'VND',
      purpose: PaymentPurpose.FullPayment,
      bookingFingerprint,
      boundAt: new Date(),
      versions: [{ providerId, contractId, contractVersionId, contentHash, bookingFingerprint }],
    };
    const bindingKey = contractIntentKey(binding);

    await bookings.create({
      _id: bookingId,
      bookingCode: snapshot.booking.bookingCode,
      customerId,
      bookingType: BookingType.AoDaiRental,
      contractFlowVersion: 2,
      status: BookingStatus.PendingPayment,
      holdExpiresAt: new Date(Date.now() + 1800000),
      paymentExpiryClaim: {
        phase: 'FINALIZING',
        token: randomUUID(),
        claimedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60000),
        paymentId,
      },
      pricingSummary: { grandTotal: 700000, depositTotal: 500000, subTotal: 200000, discountAmount: 0, travelFee: 0, overtimeFee: 0, lateFee: 0, damageFee: 0 },
    });

    await bookingItems.create({
      _id: productItemId,
      bookingId,
      providerId,
      productId,
      priceVersionId: oid(),
      itemType: BookingItemType.Product,
      quantity: 1,
      unitPrice: 200000,
      depositAmount: 500000,
    });

    await connection.db!.collection('inventory_reservations').insertOne({
      bookingId,
      bookingItemId: productItemId,
      productId,
      inventoryItemId: oid(),
      reservedFrom: new Date(),
      reservedTo: new Date(Date.now() + 1800000),
      status: ReservationStatus.TempReserved,
      expiresAt: new Date(Date.now() + 1800000),
    });

    await contracts.create({
      _id: contractId,
      contractCode: `DC-${randomUUID()}`,
      bookingId,
      customerId,
      providerId,
      scope: 'AO_DAI_RENTAL',
      status: 'DRAFT',
      currentVersionId: contractVersionId,
    });

    await connection.db!.collection('contract_versions').insertOne({
      _id: contractVersionId,
      contractId,
      version: 1,
      templateVersion: 1,
      renderedText: 'Rendered contract terms',
      snapshot,
      state: ContractVersionState.Accepted,
      contentHash,
      bookingFingerprint,
    });

    await consents.create({
      contractId,
      contractVersionId,
      actorUserId: customerId,
      actorRole: 'CUSTOMER',
      action: ContractConsentAction.Accept,
      authenticationMethod: 'APP_SESSION',
      occurredAt: new Date(),
      contentHash,
      bookingFingerprint,
      idempotencyKey: `consent-${randomUUID()}`,
    });

    await payments.create({
      _id: paymentId,
      bookingId,
      paymentCode: `PAY5C-${paymentId.toHexString()}`,
      amount: 700000,
      purpose: PaymentPurpose.FullPayment,
      paymentMethod: 'PAYOS_SIMULATOR',
      status: PaymentStatus.Success,
      paidAt: new Date(),
      contractBinding: binding,
      contractIntentKey: bindingKey,
      payos: { orderCode: Math.floor(100000 + Math.random() * 900000) },
    });

    await recoveries.create({
      paymentId,
      bookingId,
      bindingKey,
      state: PaymentRecoveryState.FinalizationPending,
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    const mockPhotoHolds = { confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }) };
    const mockPromotions = {
      findRedemptionByBooking: jest.fn().mockResolvedValue(null),
      redeemVoucher: jest.fn().mockResolvedValue(undefined),
    };
    const mockContractPolicy = { getContext: jest.fn().mockResolvedValue({ rentalProviderIds: [providerId] }) };
    const mockPreparation = { assertSourcesUnchanged: jest.fn().mockResolvedValue(undefined) };
    const mockSnapshots = { build: jest.fn().mockResolvedValue(snapshot) };
    const mockTemplates = { getApproved: jest.fn().mockReturnValue(template) };

    const finalizer = new V2PaymentFinalizationService(
      true,
      bookings,
      bookingItems,
      schedules,
      reservations,
      payments,
      recoveries,
      escrows,
      notifications,
      contracts,
      versions,
      consents,
      mockPhotoHolds as any,
      mockPromotions as any,
      recoveryService,
      mockContractPolicy as any,
      mockPreparation as any,
      mockSnapshots as any,
      mockTemplates as any,
    );

    return {
      customerId,
      providerId,
      bookingId,
      paymentId,
      bindingKey,
      finalizer,
      mockPhotoHolds,
      mockPromotions,
      snapshot,
      template,
      mockSnapshots,
    };
  }

  it('enforces payment ownership: prevents Payment B from finalizing a booking confirmed by Payment A', async () => {
    const fixtureA = await createFixture();
    const claimA = await recoveryService.claim(fixtureA.paymentId);
    expect(claimA).not.toBeNull();
    await fixtureA.finalizer.finalize(fixtureA.paymentId, claimA!.token);

    // Verify booking is confirmed by Payment A
    const confirmedBooking = await bookings.findById(fixtureA.bookingId).lean();
    expect(confirmedBooking?.status).toBe(BookingStatus.Confirmed);
    expect(confirmedBooking?.finalizedPaymentId?.toString()).toBe(fixtureA.paymentId.toString());
    expect(confirmedBooking?.finalizedContractKey).toBe(fixtureA.bindingKey);

    // Now create a competing Payment B targeting the same booking
    const paymentBId = oid();
    const bindingB = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId: fixtureA.bookingId,
      amount: 700000,
      currency: 'VND',
      purpose: PaymentPurpose.FullPayment,
      bookingFingerprint: hashContract({ dummy: 'B-fp' }),
      boundAt: new Date(),
      versions: [{
        providerId: fixtureA.providerId,
        contractId: oid(),
        contractVersionId: oid(),
        contentHash: hashContract({ dummy: 'B-content' }),
        bookingFingerprint: hashContract({ dummy: 'B-fp' }),
      }],
    };
    const bindingBKey = contractIntentKey(bindingB);
    await payments.create({
      _id: paymentBId,
      bookingId: fixtureA.bookingId,
      paymentCode: `PAY5C-B-${paymentBId.toHexString()}`,
      amount: 700000,
      purpose: PaymentPurpose.FullPayment,
      paymentMethod: 'PAYOS_SIMULATOR',
      status: PaymentStatus.Success,
      paidAt: new Date(),
      contractBinding: bindingB,
      contractIntentKey: bindingBKey,
    });

    await recoveries.create({
      paymentId: paymentBId,
      bookingId: fixtureA.bookingId,
      bindingKey: bindingBKey,
      state: PaymentRecoveryState.FinalizationPending,
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    const claimB = await recoveryService.claim(paymentBId);
    expect(claimB).not.toBeNull();

    // Finalizing with Payment B MUST throw BOOKING_CLAIM_INVALID
    await expect(fixtureA.finalizer.finalize(paymentBId, claimB!.token)).rejects.toThrow('BOOKING_CLAIM_INVALID');

    // Persisted state: Booking still belongs to Payment A and was NOT mutated
    const bookingAfterB = await bookings.findById(fixtureA.bookingId).lean();
    expect(bookingAfterB?.finalizedPaymentId?.toString()).toBe(fixtureA.paymentId.toString());
    expect(bookingAfterB?.finalizedContractKey).toBe(fixtureA.bindingKey);
  });

  it('rejects stale lease token and ensures atomic mutual exclusion between concurrent workers', async () => {
    const fixture = await createFixture();

    // Two workers racing to claim the same recovery job
    const [claim1, claim2] = await Promise.all([
      recoveryService.claim(fixture.paymentId),
      recoveryService.claim(fixture.paymentId),
    ]);

    // Exactly one worker must win the claim
    const winners = [claim1, claim2].filter(Boolean);
    expect(winners.length).toBe(1);
    const validClaim = winners[0]!;

    // An invalid/stale lease token cannot finalize the job
    await expect(fixture.finalizer.finalize(fixture.paymentId, 'stale-lease-token')).rejects.toThrow('RECOVERY_LEASE_LOST');

    // The valid lease token succeeds
    await fixture.finalizer.finalize(fixture.paymentId, validClaim.token);

    const recoveryRecord = await recoveries.findOne({ paymentId: fixture.paymentId }).lean();
    expect(recoveryRecord?.state).toBe(PaymentRecoveryState.Completed);
  });

  it('rolls back completely if an error occurs during finalization side effects (e.g. photo hold failure)', async () => {
    const fixture = await createFixture();
    fixture.mockPhotoHolds.confirmForBooking.mockResolvedValueOnce({ confirmed: false });

    const claimed = await recoveryService.claim(fixture.paymentId);
    expect(claimed).not.toBeNull();

    await expect(fixture.finalizer.finalize(fixture.paymentId, claimed!.token)).rejects.toThrow('PHOTOGRAPHY_HOLD_MISSING');

    // Persisted state check: transaction was rolled back!
    const booking = await bookings.findById(fixture.bookingId).lean();
    expect(booking?.status).toBe(BookingStatus.PendingPayment);
    expect(booking?.finalizedPaymentId).toBeFalsy();

    const reservation = await reservations.findOne({ bookingId: fixture.bookingId }).lean();
    expect(reservation?.status).toBe(ReservationStatus.TempReserved);

    expect(await escrows.countDocuments({ bookingId: fixture.bookingId })).toBe(0);
    expect(await notifications.countDocuments({ 'metadata.paymentId': fixture.paymentId })).toBe(0);
  });

  it('re-executing finalization on an already-confirmed booking is strictly idempotent with zero duplicate side effects', async () => {
    const fixture = await createFixture();
    const claimed = await recoveryService.claim(fixture.paymentId);
    expect(claimed).not.toBeNull();

    // First finalization
    await fixture.finalizer.finalize(fixture.paymentId, claimed!.token);

    expect(await escrows.countDocuments({ bookingId: fixture.bookingId })).toBe(1);
    expect(await notifications.countDocuments({ 'metadata.paymentId': fixture.paymentId })).toBe(1);

    // Simulate crash after transaction commit: recovery record reset to Finalizing
    const retryToken = randomUUID();
    await recoveries.updateOne(
      { paymentId: fixture.paymentId },
      { $set: { state: PaymentRecoveryState.Finalizing, leaseToken: retryToken, leaseUntil: new Date(Date.now() + 60000) } },
    );

    // Run finalize again (retry)
    await fixture.finalizer.finalize(fixture.paymentId, retryToken);

    // Persisted checks: zero duplicates
    expect(await escrows.countDocuments({ bookingId: fixture.bookingId })).toBe(1);
    expect(await notifications.countDocuments({ 'metadata.paymentId': fixture.paymentId })).toBe(1);

    const finalRecovery = await recoveries.findOne({ paymentId: fixture.paymentId }).lean();
    expect(finalRecovery?.state).toBe(PaymentRecoveryState.Completed);
  });

  it('detects booking mutation after consent and flags payment for manual review instead of finalizing', async () => {
    const fixture = await createFixture();

    // Simulate booking mutation: rental item pricing changed
    const mutatedSnapshot = {
      ...fixture.snapshot,
      pricing: { ...fixture.snapshot.pricing, grandTotal: 999999 },
    };
    fixture.mockSnapshots.build.mockResolvedValueOnce(mutatedSnapshot);

    // Worker attempts to process payment
    const processed = await fixture.finalizer.processPayment(fixture.paymentId);
    expect(processed).toBe(false);

    // Persisted state: Payment flagged with needsManualReview = true, Recovery in REVIEW_REQUIRED
    const payment = await payments.findById(fixture.paymentId).lean();
    expect(payment?.needsManualReview).toBe(true);

    const recovery = await recoveries.findOne({ paymentId: fixture.paymentId }).lean();
    expect(recovery?.state).toBe(PaymentRecoveryState.ReviewRequired);
    expect(recovery?.lastErrorCode).toBe('CONTRACT_BINDING_STALE');

    // Booking was NOT finalized
    const booking = await bookings.findById(fixture.bookingId).lean();
    expect(booking?.status).toBe(BookingStatus.PendingPayment);
    expect(booking?.finalizedPaymentId).toBeFalsy();
  });
});
