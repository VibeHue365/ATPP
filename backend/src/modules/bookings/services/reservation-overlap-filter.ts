import { ReservationStatus } from '../../products/schemas/inventory-reservation.schema';

/**
 * Builds the MongoDB query condition for inventory reservation overlap checks.
 *
 * Rules:
 * 1. PRODUCT + HOURLY: Half-open interval [reservedFrom, reservedTo) vs [requestedStart, requestedEnd)
 *    reservedFrom: { $lt: requestedEnd }
 *    reservedTo:   { $gt: requestedStart }
 *    Two touching boundaries (e.g., 07:00-09:00 and 09:00-11:00) do NOT overlap when turnaroundSlots = 0.
 *
 * 2. DAILY: Inclusive interval [reservedFrom, reservedTo] vs [requestedStart, requestedEnd]
 *    reservedFrom: { $lte: requestedEnd }
 *    reservedTo:   { $gte: requestedStart }
 *
 * 3. Status filter:
 *    - CONFIRMED reservations always block.
 *    - TEMP_RESERVED reservations block only if not expired (expiresAt > now or unset).
 *    - Expired TEMP_RESERVED reservations do NOT block.
 */
export function buildReservationOverlapFilter(
  requestedStart: Date,
  requestedEnd: Date,
  isHourly: boolean,
  now: Date = new Date(),
) {
  const timeFilter = isHourly
    ? {
        reservedFrom: { $lt: requestedEnd },
        reservedTo: { $gt: requestedStart },
      }
    : {
        reservedFrom: { $lte: requestedEnd },
        reservedTo: { $gte: requestedStart },
      };

  return {
    ...timeFilter,
    $or: [
      { status: ReservationStatus.Confirmed },
      {
        status: ReservationStatus.TempReserved,
        $or: [
          { expiresAt: { $gt: now } },
          { expiresAt: { $exists: false } },
          { expiresAt: null },
        ],
      },
    ],
  };
}
