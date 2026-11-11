import { randomUUID } from 'node:crypto';
import type { QueryFilter } from 'mongoose';
import { Booking } from '../schemas/booking.schema';

export type BookingPaymentClaim = NonNullable<Booking['paymentExpiryClaim']>;

export function freePaymentClaimBranches(now: Date): QueryFilter<Booking>[] {
  return [
    { paymentExpiryClaim: null },
    { 'paymentExpiryClaim.leaseUntil': { $lte: now } },
  ];
}

export function freePaymentClaim(now: Date): QueryFilter<Booking> {
  return { $or: freePaymentClaimBranches(now) };
}

export function newPaymentClaim(
  phase: BookingPaymentClaim['phase'],
  now: Date,
  leaseUntil: Date,
  paymentId?: BookingPaymentClaim['paymentId'],
): BookingPaymentClaim {
  return {
    phase,
    token: randomUUID(),
    claimedAt: now,
    leaseUntil,
    paymentId: paymentId ?? null,
  };
}
