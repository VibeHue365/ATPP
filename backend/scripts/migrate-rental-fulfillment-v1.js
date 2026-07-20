/*
 * Migrates legacy Ao Dai booking items into the per-physical-unit fulfillment model.
 * Dry-run is the default. Only records with complete, trustworthy source data are changed.
 *
 * npm run migrate:rental-fulfillment:v1
 * npm run migrate:rental-fulfillment:v1:apply
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const apply = process.argv.includes('--apply');
const now = new Date();
const safeBookingStatuses = new Set(['DRAFT', 'PENDING_PAYMENT', 'DEPOSIT_PAID', 'CONFIRMED', 'PICKUP_PENDING']);
const legacyClosedStatuses = new Set(['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']);

function isValidDate(value) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function fulfillment(item) {
  return {
    status: 'PENDING',
    pickupDueAt: isValidDate(item.rentalFrom) ? new Date(item.rentalFrom) : null,
    returnDueAt: new Date(item.rentalTo),
    readyAt: null,
    pickedUpAt: null,
    returnedAt: null,
    completedAt: null,
    cancelledAt: null,
    pickupEvidence: null,
    returnEvidence: null,
    pickupConditionNote: null,
    returnConditionNote: null,
    issueStatus: 'NONE',
    inventoryStatus: 'RESERVED',
    depositSettlementStatus: 'HELD',
    depositDeductedAmount: 0,
    depositRefundAmount: 0,
    charges: {},
    history: [{ action: 'MIGRATED_FROM_LEGACY', actor: { id: 'SYSTEM', role: 'SYSTEM' }, occurredAt: now, note: 'Migrated from legacy rental booking item.' }],
  };
}

function migration(status, reasons) {
  return { version: 1, status, reasons, migratedAt: now };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const items = db.collection('booking_items');
  const bookings = db.collection('bookings');
  const reservations = db.collection('inventory_reservations');
  const report = { mode: apply ? 'apply' : 'dry-run', examined: 0, migratedItems: 0, splitLegacyItems: 0, alreadyModern: 0, needsAdminReview: [], legacyReadOnly: [] };

  const cursor = items.find({ itemType: 'PRODUCT', $or: [{ rentalFulfillment: null }, { rentalFulfillment: { $exists: false } }] });
  for await (const item of cursor) {
    report.examined += 1;
    const booking = await bookings.findOne({ _id: item.bookingId });
    if (!booking) {
      report.needsAdminReview.push({ bookingItemId: String(item._id), reason: 'BOOKING_NOT_FOUND' });
      continue;
    }
    if (legacyClosedStatuses.has(booking.status)) {
      report.legacyReadOnly.push({ bookingItemId: String(item._id), reason: `LEGACY_${booking.status}` });
      if (apply) await items.updateOne({ _id: item._id, rentalFulfillment: { $exists: false } }, { $set: { rentalMigration: migration('LEGACY_READ_ONLY', [`BOOKING_${booking.status}`]) } });
      continue;
    }
    if (!safeBookingStatuses.has(booking.status)) {
      report.needsAdminReview.push({ bookingItemId: String(item._id), reason: `BOOKING_STATUS_${booking.status}_CANNOT_INFER_EVIDENCE` });
      if (apply) await items.updateOne({ _id: item._id, rentalFulfillment: { $exists: false } }, { $set: { rentalMigration: migration('NEEDS_ADMIN_REVIEW', [`BOOKING_STATUS_${booking.status}_CANNOT_INFER_EVIDENCE`]) } });
      continue;
    }
    const reasons = [];
    const quantity = Math.max(Number(item.quantity || 1), 1);
    if (!item.pickupReturnLocationSnapshot?.address) reasons.push('MISSING_PICKUP_RETURN_SNAPSHOT');
    if (!isValidDate(item.rentalTo)) reasons.push('MISSING_RETURN_DUE_AT');
    const unitReservations = await reservations.find({ bookingItemId: item._id, status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] } }).toArray();
    const uniqueInventory = new Set(unitReservations.map((reservation) => String(reservation.inventoryItemId)));
    if (unitReservations.length !== quantity || uniqueInventory.size !== quantity) reasons.push('PHYSICAL_INVENTORY_RESERVATIONS_DO_NOT_MATCH_QUANTITY');
    if (reasons.length) {
      report.needsAdminReview.push({ bookingItemId: String(item._id), reasons });
      if (apply) await items.updateOne({ _id: item._id, rentalFulfillment: { $exists: false } }, { $set: { rentalMigration: migration('NEEDS_ADMIN_REVIEW', reasons) } });
      continue;
    }

    report.migratedItems += quantity;
    if (quantity > 1) report.splitLegacyItems += 1;
    if (!apply) continue;

    const unitDiscount = Math.floor((item.comboDiscountAmount || 0) / quantity);
    const residual = (item.comboDiscountAmount || 0) - unitDiscount * quantity;
    const unitItems = [];
    for (let index = 0; index < quantity; index += 1) {
      const reservation = unitReservations[index];
      const unit = {
        ...item,
        _id: index === 0 ? item._id : new mongoose.Types.ObjectId(),
        quantity: 1,
        inventoryItemId: reservation.inventoryItemId,
        comboDiscountAmount: unitDiscount + (index === quantity - 1 ? residual : 0),
        rentalFulfillment: fulfillment(item),
        rentalMigration: migration('MIGRATED', []),
        updatedAt: now,
      };
      unitItems.push(unit);
    }
    const first = unitItems[0];
    const changed = await items.updateOne(
      { _id: item._id, rentalFulfillment: { $exists: false } },
      { $set: { quantity: 1, inventoryItemId: first.inventoryItemId, comboDiscountAmount: first.comboDiscountAmount, rentalFulfillment: first.rentalFulfillment, rentalMigration: first.rentalMigration, updatedAt: now } },
    );
    if (changed.matchedCount !== 1) {
      report.needsAdminReview.push({ bookingItemId: String(item._id), reason: 'CONCURRENTLY_CHANGED_DURING_MIGRATION' });
      continue;
    }
    for (let index = 1; index < unitItems.length; index += 1) {
      const clone = { ...unitItems[index] };
      delete clone.createdAt;
      await items.insertOne(clone);
      await reservations.updateOne({ _id: unitReservations[index]._id, bookingItemId: item._id }, { $set: { bookingItemId: clone._id } });
    }
  }
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });