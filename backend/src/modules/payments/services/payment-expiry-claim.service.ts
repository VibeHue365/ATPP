import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Booking, BookingStatus } from '../../bookings/schemas/booking.schema';
import {
  freePaymentClaim,
  freePaymentClaimBranches,
  newPaymentClaim,
} from '../../bookings/services/payment-expiry-claim';

const CLAIM_LEASE_MS = 60_000;

@Injectable()
export class PaymentExpiryClaimService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
  ) {}

  async claimIntent(
    bookingId: Types.ObjectId,
    paymentId: Types.ObjectId,
    session: ClientSession,
  ) {
    const now = new Date();
    const booking = await this.bookings
      .findById(bookingId)
      .session(session)
      .lean();
    if (!booking?.holdExpiresAt && booking?.status === BookingStatus.PendingPayment) {
      const createdAtTime = (booking as any).createdAt
        ? new Date((booking as any).createdAt).getTime()
        : now.getTime();
      const holdWindowMs = 15 * 60 * 1000;
      if (now.getTime() - createdAtTime <= holdWindowMs) {
        booking.holdExpiresAt = new Date(createdAtTime + holdWindowMs);
        await this.bookings.updateOne(
          { _id: booking._id },
          { $set: { holdExpiresAt: booking.holdExpiresAt } },
          { session },
        );
      }
    }
    if (!booking?.holdExpiresAt || booking.holdExpiresAt <= now) {
      await this.rejectLostClaim(bookingId, session);
      throw new ConflictException('BOOKING_HOLD_EXPIRED');
    }
    const claim = newPaymentClaim(
      'INTENT',
      now,
      new Date(
        Math.min(
          now.getTime() + CLAIM_LEASE_MS,
          booking.holdExpiresAt.getTime(),
        ),
      ),
      paymentId,
    );
    const winner = await this.bookings.findOneAndUpdate(
      {
        _id: bookingId,
        contractFlowVersion: 2,
        status: BookingStatus.PendingPayment,
        holdExpiresAt: { $gt: now },
        ...freePaymentClaim(now),
      },
      { $set: { paymentExpiryClaim: claim } },
      { new: true, session },
    );
    if (!winner) await this.rejectLostClaim(bookingId, session);
    return claim;
  }

  async claimFinalization(
    bookingId: Types.ObjectId,
    paymentId: Types.ObjectId,
    session: ClientSession,
  ) {
    const now = new Date();
    const claim = newPaymentClaim(
      'FINALIZING',
      now,
      new Date(now.getTime() + CLAIM_LEASE_MS),
      paymentId,
    );
    const winner = await this.bookings.findOneAndUpdate(
      {
        _id: bookingId,
        contractFlowVersion: 2,
        status: BookingStatus.PendingPayment,
        holdExpiresAt: { $gt: now },
        $or: [
          ...freePaymentClaimBranches(now),
          {
            'paymentExpiryClaim.phase': 'INTENT',
            'paymentExpiryClaim.paymentId': paymentId,
          },
        ],
      },
      { $set: { paymentExpiryClaim: claim } },
      { new: true, session },
    );
    if (!winner) await this.rejectLostClaim(bookingId, session);
    return claim;
  }

  async releaseFinalization(
    bookingId: Types.ObjectId,
    token: string,
  ): Promise<boolean> {
    const changed = await this.bookings.updateOne(
      {
        _id: bookingId,
        'paymentExpiryClaim.phase': 'FINALIZING',
        'paymentExpiryClaim.token': token,
      },
      { $set: { paymentExpiryClaim: null } },
    );
    return changed.modifiedCount === 1;
  }

  private async rejectLostClaim(
    bookingId: Types.ObjectId,
    session: ClientSession,
  ): Promise<never> {
    const current = await this.bookings
      .findById(bookingId)
      .session(session)
      .lean();
    if (!current) throw new NotFoundException('BOOKING_NOT_FOUND');
    throw new ConflictException(
      current.status !== BookingStatus.PendingPayment
        ? 'BOOKING_CLOSED'
        : !current.holdExpiresAt || current.holdExpiresAt <= new Date()
          ? 'BOOKING_HOLD_EXPIRED'
          : 'PAYMENT_EXPIRY_CLAIM_BUSY',
    );
  }
}
