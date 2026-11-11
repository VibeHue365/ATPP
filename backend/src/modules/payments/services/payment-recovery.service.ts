import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { ClientSession, Model, Types } from 'mongoose';
import { CONTRACTS_V2_ENABLED } from '../../contracts/contracts.constants';
import { hashContract } from '../../contracts/canonical-contract';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import { Payment, PaymentStatus } from '../schemas/payment.schema';
import {
  PaymentRecovery,
  PaymentRecoveryState,
} from '../schemas/payment-recovery.schema';

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;

@Injectable()
export class PaymentRecoveryService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectModel(PaymentRecovery.name)
    private readonly recoveries: Model<PaymentRecovery>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
  ) {}

  async recordAcknowledged(
    paymentId: Types.ObjectId,
    bookingId: Types.ObjectId,
    bindingKey: string,
    session?: ClientSession,
  ) {
    await this.assertUniqueIndex();
    const now = new Date();
    const record = await this.recoveries.findOneAndUpdate(
      { paymentId },
      {
        $setOnInsert: {
          paymentId,
          bookingId,
          bindingKey,
          state: PaymentRecoveryState.FinalizationPending,
          attempts: 0,
          nextAttemptAt: now,
        },
      },
      { upsert: true, new: true, session },
    );
    if (
      !record?.bookingId.equals(bookingId) ||
      record.bindingKey !== bindingKey
    )
      throw new ConflictException('RECOVERY_IDEMPOTENCY_CONFLICT');
    return record;
  }

  async claim(paymentId: Types.ObjectId, now = new Date()) {
    const token = randomUUID();
    const record = await this.recoveries.findOneAndUpdate(
      {
        paymentId,
        attempts: { $lt: MAX_ATTEMPTS },
        $or: [
          {
            state: PaymentRecoveryState.FinalizationPending,
            nextAttemptAt: { $lte: now },
          },
          {
            state: PaymentRecoveryState.Finalizing,
            leaseUntil: { $lte: now },
          },
        ],
      },
      {
        $set: {
          state: PaymentRecoveryState.Finalizing,
          leaseToken: token,
          leaseUntil: new Date(now.getTime() + LEASE_MS),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    return record ? { record, token } : null;
  }

  async complete(paymentId: Types.ObjectId, token: string): Promise<boolean> {
    const changed = await this.recoveries.updateOne(
      {
        paymentId,
        state: PaymentRecoveryState.Finalizing,
        leaseToken: token,
      },
      {
        $set: {
          state: PaymentRecoveryState.Completed,
          completedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: null,
        },
      },
    );
    return changed.modifiedCount === 1;
  }

  async retry(
    paymentId: Types.ObjectId,
    token: string,
    errorCode: string,
  ): Promise<boolean> {
    if (!/^[A-Z0-9_]{1,64}$/.test(errorCode))
      throw new ConflictException('RECOVERY_ERROR_CODE_INVALID');
    const current = await this.recoveries
      .findOne({
        paymentId,
        state: PaymentRecoveryState.Finalizing,
        leaseToken: token,
      })
      .lean();
    if (!current) return false;
    const exhausted = current.attempts >= MAX_ATTEMPTS;
    const delay = Math.min(5_000 * 2 ** (current.attempts - 1), 300_000);
    const changed = await this.recoveries.updateOne(
      {
        paymentId,
        state: PaymentRecoveryState.Finalizing,
        leaseToken: token,
        attempts: current.attempts,
      },
      {
        $set: {
          state: exhausted
            ? PaymentRecoveryState.ReviewRequired
            : PaymentRecoveryState.FinalizationPending,
          nextAttemptAt: new Date(Date.now() + delay),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: errorCode,
        },
      },
    );
    return changed.modifiedCount === 1;
  }

  async requireReview(
    paymentId: Types.ObjectId,
    errorCode: string,
    session?: ClientSession,
  ) {
    if (!/^[A-Z0-9_]{1,64}$/.test(errorCode))
      throw new ConflictException('RECOVERY_ERROR_CODE_INVALID');
    return this.recoveries.updateOne(
      {
        paymentId,
        state: {
          $nin: [
            PaymentRecoveryState.Completed,
            PaymentRecoveryState.ReviewRequired,
          ],
        },
      },
      {
        $set: {
          state: PaymentRecoveryState.ReviewRequired,
          lastErrorCode: errorCode,
          leaseToken: null,
          leaseUntil: null,
        },
      },
      { session },
    );
  }

  async requireReviewClaimed(
    paymentId: Types.ObjectId,
    token: string,
    errorCode: string,
  ): Promise<boolean> {
    if (!/^[A-Z0-9_]{1,64}$/.test(errorCode))
      throw new ConflictException('RECOVERY_ERROR_CODE_INVALID');
    const changed = await this.recoveries.updateOne(
      {
        paymentId,
        state: PaymentRecoveryState.Finalizing,
        leaseToken: token,
      },
      {
        $set: {
          state: PaymentRecoveryState.ReviewRequired,
          lastErrorCode: errorCode,
          leaseToken: null,
          leaseUntil: null,
        },
      },
    );
    return changed.modifiedCount === 1;
  }

  /** Detects an acknowledged V2 payment even if the process crashed before enqueue. */
  @Interval(60_000)
  async reconcileMissing(): Promise<number> {
    if (!this.enabled) return 0;
    await this.assertUniqueIndex();
    const payments = await this.payments.aggregate<{
      _id: Types.ObjectId;
      bookingId: Types.ObjectId;
      contractIntentKey?: string | null;
    }>([
      {
        $match: {
          status: PaymentStatus.Success,
          'contractBinding.flowVersion': 2,
        },
      },
      {
        $lookup: {
          from: 'payment_recoveries',
          localField: '_id',
          foreignField: 'paymentId',
          as: 'recovery',
        },
      },
      { $match: { recovery: { $size: 0 } } },
      { $limit: 50 },
      { $project: { _id: 1, bookingId: 1, contractIntentKey: 1 } },
    ]);
    let created = 0;
    for (const payment of payments) {
      const key =
        payment.contractIntentKey ??
        hashContract({ unboundPaymentId: payment._id.toString() });
      await this.recordAcknowledged(payment._id, payment.bookingId, key);
      created++;
      if (!payment.contractIntentKey) {
        await this.requireReview(payment._id, 'PAYMENT_BINDING_MISSING');
        await this.payments.updateOne(
          { _id: payment._id },
          { $set: { needsManualReview: true } },
        );
        continue;
      }
      const booking = await this.bookings.findById(payment.bookingId).lean();
      if (
        !booking ||
        booking.status === BookingStatus.Cancelled ||
        (booking.status === BookingStatus.PendingPayment &&
          (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()))
      ) {
        await this.requireReview(payment._id, 'PAYMENT_AFTER_HOLD_EXPIRY');
        await this.payments.updateOne(
          { _id: payment._id },
          { $set: { needsManualReview: true } },
        );
      }
    }
    return created;
  }

  private async assertUniqueIndex() {
    try {
      const indexes = await this.recoveries.collection.indexes();
      if (
        !indexes.some(
          (index) =>
            index.unique &&
            JSON.stringify(index.key) === JSON.stringify({ paymentId: 1 }),
        )
      ) {
        await this.recoveries.collection.createIndex(
          { paymentId: 1 },
          { unique: true },
        );
      }
    } catch {
      // Index exists or in creation
    }
  }
}
