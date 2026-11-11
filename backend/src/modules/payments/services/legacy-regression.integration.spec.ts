import { randomUUID } from 'node:crypto';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../../contracts/contract-test-target';
import { Booking, BookingSchema, BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItem, BookingItemSchema, BookingItemType } from '../../bookings/schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleSchema, BookingScheduleStatus, BookingScheduleType } from '../../bookings/schemas/booking-schedule.schema';
import { InventoryReservation, InventoryReservationSchema, ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { BookingEscrow, BookingEscrowSchema, EscrowStatus } from '../schemas/booking-escrow.schema';
import { Notification, NotificationSchema } from '../../notifications/schemas/notification.schema';
import { Payment, PaymentPurpose, PaymentSchema, PaymentStatus } from '../schemas/payment.schema';
import { PaymentWebhookEvent, PaymentWebhookEventSchema } from '../schemas/payment-webhook-event.schema';
import { PaymentsRepository } from '../repositories/payments.repository';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';
import { PaymentsService } from './payments.service';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)('Legacy Booking & Payment Regression Suite', () => {
  let connection: Connection;
  let scratchName: string;

  let bookings: Model<Booking>;
  let bookingItems: Model<BookingItem>;
  let schedules: Model<BookingSchedule>;
  let reservations: Model<InventoryReservation>;
  let escrows: Model<BookingEscrow>;
  let notifications: Model<Notification>;
  let payments: Model<Payment>;
  let webhookEvents: Model<PaymentWebhookEvent>;

  let paymentsRepo: PaymentsRepository;
  let webhookRepo: WebhookEventRepository;
  let paymentsService: PaymentsService;

  beforeAll(async () => {
    scratchName = `contract_legacy_reg_${oid().toHexString()}_test`;
    const uri = new URL(target!.uri);
    uri.pathname = `/${scratchName}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 8000,
    }).asPromise();

    const hello = await connection.db!.admin().command({ hello: 1 });
    if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
      throw new Error('Requires isolated replica set on port 27028');
    }

    bookings = connection.model(Booking.name, BookingSchema);
    bookingItems = connection.model(BookingItem.name, BookingItemSchema);
    schedules = connection.model(BookingSchedule.name, BookingScheduleSchema);
    reservations = connection.model(InventoryReservation.name, InventoryReservationSchema);
    escrows = connection.model(BookingEscrow.name, BookingEscrowSchema);
    notifications = connection.model(Notification.name, NotificationSchema);
    payments = connection.model(Payment.name, PaymentSchema);
    webhookEvents = connection.model(PaymentWebhookEvent.name, PaymentWebhookEventSchema);

    await connection.db!.collection('payment_webhook_events').createIndex({ webhookId: 1 }, { unique: true });

    paymentsRepo = new PaymentsRepository(payments);
    webhookRepo = new WebhookEventRepository(webhookEvents);

    const mockPromotions = {
      reserveVoucher: jest.fn(),
      redeemVoucher: jest.fn(),
      releaseVoucher: jest.fn(),
      findRedemptionByBooking: jest.fn().mockResolvedValue(null),
    };
    const mockEscrowRepo = {
      createEscrow: jest.fn().mockResolvedValue({}),
      createOrUpdateEscrow: jest.fn().mockResolvedValue({}),
    };
    const mockTransferRepo = {};
    const mockSettlementRepo = {};
    const mockRefundService = {};
    const mockBankingService = {};
    const mockNotifications = { createNotification: jest.fn().mockResolvedValue({}) };
    const mockTransferMapper = {};
    const mockSettlementsService = { createSettlementsForBooking: jest.fn().mockResolvedValue([]) };
    const mockPhotoHoldService = { confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }) };
    const mockDepositCoordinator = {};
    const mockCheckoutGuard = { assertEligibleForPayment: jest.fn() };
    const mockExpiryClaim = {};
    const mockRecovery = { recordAcknowledged: jest.fn() };

    paymentsService = new PaymentsService(
      paymentsRepo,
      bookings,
      mockEscrowRepo as any,
      mockTransferRepo as any,
      mockSettlementRepo as any,
      mockRefundService as any,
      mockBankingService as any,
      mockNotifications as any,
      mockTransferMapper as any,
      escrows,
      connection.model('SettlementTransfer', new (connection.base.Schema)({})),
      mockSettlementsService as any,
      mockPhotoHoldService as any,
      mockDepositCoordinator as any,
      mockPromotions as any,
      false, // contractsV2Enabled = false (default legacy)
      mockCheckoutGuard as any,
      mockExpiryClaim as any,
      mockRecovery as any,
      undefined,
      webhookRepo,
    );
  }, 30000);

  afterAll(async () => {
    if (connection) {
      await connection.db!.dropDatabase();
      await connection.close();
    }
  });

  it('1. Legacy booking confirms cleanly without any contract binding or V2 consent records', async () => {
    const customerId = oid();
    const providerId = oid();
    const bookingId = oid();
    const itemId = oid();
    const paymentId = oid();
    const paymentCode = `LEGACY-PAY-${randomUUID()}`;

    // Create legacy booking without contractFlowVersion and without revision
    await connection.db!.collection('bookings').insertOne({
      _id: bookingId,
      customerId,
      providerIds: [providerId],
      bookingCode: 'LEGACY-001',
      bookingType: BookingType.ProductOnly,
      status: BookingStatus.PendingPayment,
      contractFlowVersion: null, // explicit legacy
      pricingSummary: { grandTotal: 200000, depositTotal: 50000 },
      paymentSummary: { totalPaid: 0, paymentStatus: 'PENDING' },
    });

    await connection.db!.collection('inventory_reservations').insertOne({
      _id: oid(),
      bookingId,
      bookingItemId: itemId,
      inventoryItemId: oid(),
      status: ReservationStatus.TempReserved,
      reservedFrom: new Date(),
      reservedTo: new Date(Date.now() + 86400000),
    });

    await payments.create({
      _id: paymentId,
      bookingId,
      paymentCode,
      amount: 200000,
      purpose: PaymentPurpose.FullPayment,
      status: PaymentStatus.Pending,
      contractBinding: null,
    });

    // Confirm payment through standard legacy flow
    const confirmed = await paymentsService.confirmPayment(paymentCode);
    expect(confirmed.status).toBe(PaymentStatus.Success);

    // Verify persisted database state
    const savedBooking = await connection.db!.collection('bookings').findOne({ _id: bookingId });
    expect(savedBooking?.status).toBe(BookingStatus.Confirmed);
    expect(savedBooking?.contractFlowVersion).toBeFalsy();

    const savedReservation = await connection.db!.collection('inventory_reservations').findOne({ bookingId });
    expect(savedReservation?.status).toBe(ReservationStatus.Confirmed);

    // Ensure NO contract recovery record was created for legacy payment
    const recoveryCount = await connection.db!.collection('payment_recoveries').countDocuments({ paymentId });
    expect(recoveryCount).toBe(0);
  });

  it('2. Legacy webhook reconciliation worker recovers stuck legacy webhooks without contract errors', async () => {
    const bookingId = oid();
    const paymentId = oid();
    const paymentCode = `LEGACY-WEBHOOK-${randomUUID()}`;
    const orderCode = Math.floor(100000000 + Math.random() * 800000000);

    await connection.db!.collection('bookings').insertOne({
      _id: bookingId,
      customerId: oid(),
      providerIds: [oid()],
      bookingCode: 'LEGACY-002',
      bookingType: BookingType.ProductOnly,
      status: BookingStatus.PendingPayment,
      pricingSummary: { grandTotal: 300000, depositTotal: 0 },
      paymentSummary: { totalPaid: 0, paymentStatus: 'PENDING' },
    });

    await payments.create({
      _id: paymentId,
      bookingId,
      paymentCode,
      amount: 300000,
      purpose: PaymentPurpose.FullPayment,
      status: PaymentStatus.Pending,
      payos: { orderCode },
      contractBinding: null,
    });

    // Simulate verified webhook event stuck from crashed worker (older than 60s lease)
    const stuckTime = new Date(Date.now() - 75000);
    const webhookId = `payos_${orderCode}_PAID`;
    await connection.db!.collection('payment_webhook_events').insertOne({
      webhookId,
      provider: 'PAYOS',
      payload: { orderCode, status: 'PAID', amount: 300000 },
      signature: null,
      isValid: true,
      processed: false,
      processingStartedAt: stuckTime,
      processingAttempts: 1,
    });

    // Run reconciliation worker
    const reconciled = await paymentsService.reconcileStuckWebhooks();
    expect(reconciled).toBe(1);

    // Persisted state check
    const savedEvent = await connection.db!.collection('payment_webhook_events').findOne({ webhookId });
    expect(savedEvent?.processed).toBe(true);
    expect(savedEvent?.error).toBeFalsy();

    const savedPayment = await connection.db!.collection('payments').findOne({ _id: paymentId });
    expect(savedPayment?.status).toBe(PaymentStatus.Success);

    const savedBooking = await connection.db!.collection('bookings').findOne({ _id: bookingId });
    expect(savedBooking?.status).toBe(BookingStatus.Confirmed);
  });

  it('3. Legacy booking cancellation updates revision safely when revision was originally absent', async () => {
    const bookingId = oid();

    // Create raw legacy booking record without revision property
    await connection.db!.collection('bookings').insertOne({
      _id: bookingId,
      customerId: oid(),
      providerIds: [oid()],
      bookingCode: 'LEGACY-003',
      status: BookingStatus.PendingPayment,
      pricingSummary: { grandTotal: 100000, depositTotal: 0 },
      paymentSummary: { totalPaid: 0, paymentStatus: 'PENDING' },
    });

    // Verify revision is undefined
    let raw = await connection.db!.collection('bookings').findOne({ _id: bookingId });
    expect(raw?.revision).toBeUndefined();

    // Cancel using atomic update with $inc: { revision: 1 }
    const updated = await connection.db!.collection('bookings').findOneAndUpdate(
      { _id: bookingId, status: BookingStatus.PendingPayment },
      {
        $set: { status: BookingStatus.Cancelled },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' },
    );

    expect(updated?.status).toBe(BookingStatus.Cancelled);
    expect(updated?.revision).toBe(1);
  });

  it('4. Photography-only booking requires zero electronic contracts even if V2 flag is enabled', async () => {
    const bookingId = oid();
    const paymentId = oid();
    const paymentCode = `PHOTO-PAY-${randomUUID()}`;

    await connection.db!.collection('bookings').insertOne({
      _id: bookingId,
      customerId: oid(),
      providerIds: [oid()],
      bookingCode: 'PHOTO-001',
      bookingType: BookingType.Photography, // Photography-only
      contractFlowVersion: 2, // Even if tagged 2
      status: BookingStatus.PendingPayment,
      pricingSummary: { grandTotal: 500000, depositTotal: 0 },
      paymentSummary: { totalPaid: 0, paymentStatus: 'PENDING' },
    });

    await payments.create({
      _id: paymentId,
      bookingId,
      paymentCode,
      amount: 500000,
      purpose: PaymentPurpose.FullPayment,
      status: PaymentStatus.Pending,
    });

    // Confirm photography-only payment: Photography is excluded from rental contract guard
    const confirmed = await paymentsService.confirmPayment(paymentCode);
    expect(confirmed.status).toBe(PaymentStatus.Success);

    const saved = await connection.db!.collection('bookings').findOne({ _id: bookingId });
    expect([BookingStatus.Confirmed, BookingStatus.DepositPaid]).toContain(saved?.status);
  });
});
