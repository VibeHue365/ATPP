import { BookingStatus } from '../schemas/booking.schema';

/** Respect a persisted hold deadline; older bookings without one retain their existing cutoff. */
export function pendingBookingExpiryFilter(now: Date, legacyCutoff: Date) {
  return {
    status: BookingStatus.PendingPayment,
    $or: [
      { holdExpiresAt: { $lte: now } },
      { holdExpiresAt: null, createdAt: { $lt: legacyCutoff } },
    ],
  };
}
