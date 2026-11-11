import { randomUUID } from 'node:crypto';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../../contracts/contract-test-target';
import {
  Booking,
  BookingSchema,
  BookingStatus,
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
import { PaymentExpiryClaimService } from './payment-expiry-claim.service';
import { PaymentRecoveryService } from './payment-recovery.service';
import {
  freePaymentClaim,
  newPaymentClaim,
} from '../../bookings/services/payment-expiry-claim';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from '../repositories/payments.repository';
import { ContractPaymentBinding } from '../schemas/payment.schema';
import { contractIntentKey } from './contract-payment-binding';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)(
  'Phase 5B.1 isolated payment claim and recovery',
  () => {
    let connection: Connection;
    let scratchName: string;
    let bookings: Model<Booking>;
    let payments: Model<Payment>;
    let recoveries: Model<PaymentRecovery>;
    let claim: PaymentExpiryClaimService;
    let recovery: PaymentRecoveryService;

    beforeAll(async () => {
      scratchName = `contract_payment_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;
      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();
      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary)
        throw new Error('Phase 5B.1 requires the isolated test replica set');
      bookings = connection.model(Booking.name, BookingSchema);
      payments = connection.model(Payment.name, PaymentSchema);
      recoveries = connection.model(
        PaymentRecovery.name,
        PaymentRecoverySchema,
      );
      await connection.db!.collection('payments').createIndex(
        { contractIntentKey: 1 },
        {
          unique: true,
          partialFilterExpression: { contractIntentKey: { $type: 'string' } },
        },
      );
      await connection
        .db!.collection('payment_recoveries')
        .createIndex({ paymentId: 1 }, { unique: true });
      claim = new PaymentExpiryClaimService(bookings);
      recovery = new PaymentRecoveryService(
        true,
        recoveries,
        payments,
        bookings,
      );
    }, 30000);

    afterAll(async () => {
      if (!connection) return;
      if (
        scratchName.startsWith('contract_payment_') &&
        scratchName.endsWith('_test')
      )
        await connection.dropDatabase();
      await connection.close();
    }, 30000);

    async function seedBooking(holdExpiresAt: Date) {
      const bookingId = oid();
      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `P5-${randomUUID()}`,
        customerId: oid(),
        bookingType: 'AODAI_RENTAL',
        contractFlowVersion: 2,
        status: BookingStatus.PendingPayment,
        holdExpiresAt,
        paymentExpiryClaim: null,
        pricingSummary: { subTotal: 100, grandTotal: 100 },
      });
      return bookingId;
    }

    function paymentService(binding: ContractPaymentBinding, enabled = true) {
      const guard = {
        evaluate: jest.fn().mockResolvedValue({ binding, context: {} }),
        assertCurrent: jest.fn().mockResolvedValue(undefined),
      };
      const service = Object.assign(Object.create(PaymentsService.prototype), {
        bookingModel: bookings,
        paymentsRepository: new PaymentsRepository(payments),
        contractsV2Enabled: enabled,
        contractCheckoutGuard: guard,
        paymentExpiryClaim: claim,
        paymentRecovery: recovery,
      }) as PaymentsService;
      return { service, guard };
    }

    function bindingFor(
      bookingId: Types.ObjectId,
      amount: number,
    ): ContractPaymentBinding {
      const fingerprint = 'e'.repeat(64);
      return {
        bindingVersion: 1,
        flowVersion: 2,
        bookingId,
        amount,
        currency: 'VND',
        purpose: PaymentPurpose.FullPayment,
        bookingFingerprint: fingerprint,
        boundAt: new Date(),
        versions: [
          {
            contractId: oid(),
            contractVersionId: oid(),
            providerId: oid(),
            contentHash: fingerprint,
            bookingFingerprint: fingerprint,
          },
        ],
      };
    }

    it('binds and reuses one pending V2 link, rejecting a changed version', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const booking = await bookings.findById(bookingId).lean();
      const expected = bindingFor(bookingId, 100);
      const { service, guard } = paymentService(expected);
      const first = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      const retry = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(retry._id.toString()).toBe(first._id.toString());
      expect(first.contractIntentKey).toBe(contractIntentKey(expected));
      expect(await payments.countDocuments({ bookingId })).toBe(1);
      guard.evaluate.mockResolvedValue({
        binding: {
          ...expected,
          versions: [{ ...expected.versions[0], contractVersionId: oid() }],
        },
        context: {},
      });

      const second = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(second._id.toString()).not.toBe(first._id.toString());
      expect(second.contractIntentKey).not.toBe(first.contractIntentKey);

      // Verify first payment was superseded safely (status Cancelled, evidence/binding preserved)
      const firstReloaded = await payments.findById(first._id).lean();
      expect(firstReloaded?.status).toBe(PaymentStatus.Cancelled);
      expect(firstReloaded?.contractBinding).toBeDefined();
      expect(firstReloaded?.contractIntentKey).toBe(contractIntentKey(expected));

      // Verify second payment is pending with new key
      expect(second.status).toBe(PaymentStatus.Pending);
    });

    it('keeps concurrent create-link calls to one payment intent', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const booking = await bookings.findById(bookingId).lean();
      const { service } = paymentService(bindingFor(bookingId, 100));
      const outcomes = await Promise.allSettled([
        service.createPaymentLink(
          bookingId.toString(),
          PaymentPurpose.FullPayment,
          booking!.customerId.toString(),
        ),
        service.createPaymentLink(
          bookingId.toString(),
          PaymentPurpose.FullPayment,
          booking!.customerId.toString(),
        ),
      ]);
      expect(outcomes.some((item) => item.status === 'fulfilled')).toBe(true);
      expect(await payments.countDocuments({ bookingId })).toBe(1);
      const retry = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(retry._id.toString()).toBe(
        (await payments.findOne({ bookingId }))!._id.toString(),
      );
    });

    it('creates a bound zero-VND payment and durable recovery without bypassing consent guard', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      await bookings.updateOne(
        { _id: bookingId },
        { $set: { pricingSummary: { subTotal: 0, grandTotal: 0 } } },
      );
      const booking = await bookings.findById(bookingId).lean();
      const { service, guard } = paymentService(bindingFor(bookingId, 0));
      const payment = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(guard.evaluate).toHaveBeenCalledTimes(1);
      expect(payment.amount).toBe(0);
      expect(payment.status).toBe(PaymentStatus.Success);
      expect(
        (await recoveries.findOne({ paymentId: payment._id }).lean())?.state,
      ).toBe(PaymentRecoveryState.FinalizationPending);
      expect(
        (await bookings.findById(bookingId).lean())?.paymentExpiryClaim?.phase,
      ).toBe('FINALIZING');
      const retry = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(retry._id.toString()).toBe(payment._id.toString());
      expect(await payments.countDocuments({ bookingId })).toBe(1);
    });

    it('records a late V2 payment for review without reviving the cancelled booking', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const booking = await bookings.findById(bookingId).lean();
      const { service } = paymentService(bindingFor(bookingId, 100));
      const pending = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      await bookings.updateOne(
        { _id: bookingId },
        {
          $set: {
            status: BookingStatus.Cancelled,
            holdExpiresAt: new Date(Date.now() - 1000),
          },
        },
      );
      const paid = await service.confirmPayment(pending.paymentCode, { source: 'SIMULATOR' });
      expect(paid.status).toBe(PaymentStatus.Success);
      expect((await bookings.findById(bookingId).lean())?.status).toBe(
        BookingStatus.Cancelled,
      );
      expect(
        (await recoveries.findOne({ paymentId: paid._id }).lean())?.state,
      ).toBe(PaymentRecoveryState.ReviewRequired);
      await service.confirmPayment(pending.paymentCode);
      expect(await recoveries.countDocuments({ paymentId: paid._id })).toBe(1);
    });

    it('keeps legacy pending-link reuse independent of the V2 guard', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      await bookings.updateOne(
        { _id: bookingId },
        { $set: { contractFlowVersion: null } },
      );
      const booking = await bookings.findById(bookingId).lean();
      const pending = await payments.create({
        bookingId,
        paymentCode: `LEGACY-${randomUUID()}`,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Pending,
      });
      const { service, guard } = paymentService(
        bindingFor(bookingId, 100),
        false,
      );
      const reused = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(reused._id.toString()).toBe(pending._id.toString());
      expect(guard.evaluate).not.toHaveBeenCalled();
    });

    it('fails closed for V2 when the feature flag is OFF, while photography stays on legacy flow', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const booking = await bookings.findById(bookingId).lean();
      const { service, guard } = paymentService(
        bindingFor(bookingId, 100),
        false,
      );
      await expect(
        service.createPaymentLink(
          bookingId.toString(),
          PaymentPurpose.FullPayment,
          booking!.customerId.toString(),
        ),
      ).rejects.toThrow('CONTRACTS_V2_DISABLED');
      await bookings.updateOne(
        { _id: bookingId },
        { $set: { bookingType: 'PHOTOGRAPHY' } },
      );
      const pending = await payments.create({
        bookingId,
        paymentCode: `PHOTO-${randomUUID()}`,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Pending,
      });
      const reused = await service.createPaymentLink(
        bookingId.toString(),
        PaymentPurpose.FullPayment,
        booking!.customerId.toString(),
      );
      expect(reused._id.toString()).toBe(pending._id.toString());
      expect(guard.evaluate).not.toHaveBeenCalled();
    });

    it('serializes concurrent intent claims; only one payment intent commits', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const key = 'a'.repeat(64);
      const start = async () => {
        const session = await connection.startSession();
        const paymentId = oid();
        try {
          await session.withTransaction(async () => {
            await claim.claimIntent(bookingId, paymentId, session);
            await payments.create(
              [
                {
                  _id: paymentId,
                  bookingId,
                  paymentCode: `P5-${paymentId.toHexString()}`,
                  amount: 100,
                  purpose: PaymentPurpose.FullPayment,
                  status: PaymentStatus.Pending,
                  contractIntentKey: key,
                },
              ],
              { session },
            );
          });
        } finally {
          await session.endSession();
        }
      };
      const outcomes = await Promise.allSettled([start(), start()]);
      expect(
        outcomes.filter((item) => item.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(await payments.countDocuments({ bookingId })).toBe(1);
      expect(
        (await bookings.findById(bookingId).lean())?.paymentExpiryClaim?.phase,
      ).toBe('INTENT');
    });

    it('does not let expiry and payment finalization both win', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const paymentId = oid();
      const session = await connection.startSession();
      try {
        await session.withTransaction(async () => {
          await claim.claimFinalization(bookingId, paymentId, session);
        });
      } finally {
        await session.endSession();
      }
      await bookings.updateOne(
        { _id: bookingId },
        { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
      );
      const now = new Date();
      const expiry = await bookings.updateOne(
        {
          _id: bookingId,
          contractFlowVersion: 2,
          status: BookingStatus.PendingPayment,
          holdExpiresAt: { $lte: now },
          ...freePaymentClaim(now),
        },
        {
          $set: {
            status: BookingStatus.Cancelled,
            paymentExpiryClaim: newPaymentClaim(
              'EXPIRY',
              now,
              new Date(now.getTime() + 60000),
            ),
          },
        },
      );
      expect(expiry.modifiedCount).toBe(0);
      expect((await bookings.findById(bookingId).lean())?.status).toBe(
        BookingStatus.PendingPayment,
      );
      await expect(
        (async () => {
          const retrySession = await connection.startSession();
          try {
            await claim.claimFinalization(bookingId, paymentId, retrySession);
          } finally {
            await retrySession.endSession();
          }
        })(),
      ).rejects.toThrow('BOOKING_HOLD_EXPIRED');
    });

    it('serializes a payment acknowledgement racing the expiry transaction', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 800));
      const paymentId = oid();
      await payments.create({
        _id: paymentId,
        bookingId,
        paymentCode: `RACE-${paymentId.toHexString()}`,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Pending,
      });
      const paymentSession = await connection.startSession();
      paymentSession.startTransaction();
      try {
        await claim.claimFinalization(bookingId, paymentId, paymentSession);
        await payments.updateOne(
          { _id: paymentId, status: PaymentStatus.Pending },
          { $set: { status: PaymentStatus.Success } },
          { session: paymentSession },
        );
        await new Promise((resolve) => setTimeout(resolve, 950));
        const expiry = (async () => {
          for (let attempt = 0; attempt < 3; attempt++) {
            const session = await connection.startSession();
            try {
              let changed = 0;
              await session.withTransaction(async () => {
                if (
                  await payments
                    .exists({ bookingId, status: PaymentStatus.Success })
                    .session(session)
                )
                  return;
                const now = new Date();
                const result = await bookings.updateOne(
                  {
                    _id: bookingId,
                    status: BookingStatus.PendingPayment,
                    holdExpiresAt: { $lte: now },
                    ...freePaymentClaim(now),
                  },
                  { $set: { status: BookingStatus.Cancelled } },
                  { session },
                );
                changed = result.modifiedCount;
              });
              return changed;
            } catch (error) {
              if (
                attempt === 2 ||
                !(
                  error as { hasErrorLabel?: (label: string) => boolean }
                ).hasErrorLabel?.('TransientTransactionError')
              )
                throw error;
            } finally {
              await session.endSession();
            }
          }
          throw new Error('Expiry retry exhausted');
        })();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await paymentSession.commitTransaction();
        expect(await expiry).toBe(0);
        expect((await bookings.findById(bookingId).lean())?.status).toBe(
          BookingStatus.PendingPayment,
        );
        expect((await payments.findById(paymentId).lean())?.status).toBe(
          PaymentStatus.Success,
        );
      } finally {
        if (paymentSession.inTransaction())
          await paymentSession.abortTransaction();
        await paymentSession.endSession();
      }
    });
    it('keeps late money for review without reviving an expired booking', async () => {
      const bookingId = await seedBooking(new Date(Date.now() - 1000));
      const paymentId = oid();
      const now = new Date();
      await bookings.updateOne(
        {
          _id: bookingId,
          status: BookingStatus.PendingPayment,
          ...freePaymentClaim(now),
        },
        {
          $set: {
            status: BookingStatus.Cancelled,
            paymentExpiryClaim: newPaymentClaim(
              'EXPIRY',
              now,
              new Date(now.getTime() + 60000),
            ),
          },
        },
      );
      await payments.create({
        _id: paymentId,
        bookingId,
        paymentCode: `LATE-${paymentId.toHexString()}`,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Success,
        contractIntentKey: 'b'.repeat(64),
      });
      await recovery.recordAcknowledged(paymentId, bookingId, 'b'.repeat(64));
      await recovery.requireReview(paymentId, 'PAYMENT_AFTER_HOLD_EXPIRY');
      expect((await bookings.findById(bookingId).lean())?.status).toBe(
        BookingStatus.Cancelled,
      );
      expect((await recoveries.findOne({ paymentId }).lean())?.state).toBe(
        PaymentRecoveryState.ReviewRequired,
      );
    });

    it('deduplicates acknowledgement, leases work once, retries and completes idempotently', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const paymentId = oid();
      const key = 'c'.repeat(64);
      await Promise.all([
        recovery.recordAcknowledged(paymentId, bookingId, key),
        recovery.recordAcknowledged(paymentId, bookingId, key),
      ]);
      expect(await recoveries.countDocuments({ paymentId })).toBe(1);
      const [left, right] = await Promise.all([
        recovery.claim(paymentId),
        recovery.claim(paymentId),
      ]);
      expect([left, right].filter(Boolean)).toHaveLength(1);
      const owner = left ?? right;
      expect(
        await recovery.retry(paymentId, owner!.token, 'TRANSIENT_FINALIZATION'),
      ).toBe(true);
      const pending = await recoveries.findOne({ paymentId }).lean();
      expect(pending?.state).toBe(PaymentRecoveryState.FinalizationPending);
      expect(
        await recovery.claim(paymentId, new Date(Date.now() + 600000)),
      ).not.toBeNull();
      const finalClaim = await recoveries.findOne({ paymentId }).lean();
      expect(await recovery.complete(paymentId, finalClaim!.leaseToken!)).toBe(
        true,
      );
      expect(await recovery.complete(paymentId, finalClaim!.leaseToken!)).toBe(
        false,
      );
      expect((await recoveries.findOne({ paymentId }).lean())?.state).toBe(
        PaymentRecoveryState.Completed,
      );
    });

    it('reclaims an abandoned finalization lease without accepting the stale worker', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const paymentId = oid();
      await recovery.recordAcknowledged(paymentId, bookingId, 'e'.repeat(64));
      const first = await recovery.claim(paymentId);
      expect(first).not.toBeNull();
      const reclaimed = await recovery.claim(
        paymentId,
        new Date(Date.now() + 120000),
      );
      expect(reclaimed).not.toBeNull();
      expect(reclaimed!.token).not.toBe(first!.token);
      expect(await recovery.complete(paymentId, first!.token)).toBe(false);
      expect(await recovery.complete(paymentId, reclaimed!.token)).toBe(true);
      expect(await recoveries.countDocuments({ paymentId })).toBe(1);
    });

    it('reconciles a SUCCESS payment whose recovery record was never written', async () => {
      const bookingId = await seedBooking(new Date(Date.now() + 60000));
      const paymentId = oid();
      await connection.db!.collection('payments').insertOne({
        _id: paymentId,
        bookingId,
        paymentCode: `CRASH-${paymentId.toHexString()}`,
        amount: 100,
        purpose: PaymentPurpose.FullPayment,
        status: PaymentStatus.Success,
        contractIntentKey: 'd'.repeat(64),
        contractBinding: { flowVersion: 2 },
      });
      expect(await recovery.reconcileMissing()).toBeGreaterThanOrEqual(1);
      expect(await recoveries.countDocuments({ paymentId })).toBe(1);
      await recovery.reconcileMissing();
      expect(await recoveries.countDocuments({ paymentId })).toBe(1);
    });
  },
);
