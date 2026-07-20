/*
 * Migrates legacy photography BookingItem.shootDate/shootTimeSlot values into
 * BookingSchedule v2 records. This command is dry-run by default.
 *
 * Usage:
 *   npm run migrate:photography-schedules:v2
 *   npm run migrate:photography-schedules:v2:apply
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const apply = process.argv.includes('--apply');
const timezone = 'Asia/Ho_Chi_Minh';

function toLocalDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function parseLegacyTimeSlot(timeSlot) {
  const match = /^\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/.exec(
    String(timeSlot || ''),
  );
  if (!match) return null;
  const startMinutes = toMinutes(match[1]);
  const endMinutes = toMinutes(match[2]);
  if (
    !Number.isInteger(startMinutes) ||
    !Number.isInteger(endMinutes) ||
    startMinutes < 0 ||
    startMinutes >= 24 * 60 ||
    endMinutes < 0 ||
    endMinutes >= 24 * 60 ||
    startMinutes >= endMinutes
  ) {
    return null;
  }
  return { start: match[1], end: match[2] };
}

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const bookingItems = db.collection('booking_items');
  const schedules = db.collection('booking_schedules');

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    examined: 0,
    eligible: 0,
    created: 0,
    skippedExisting: 0,
    invalid: [],
  };

  const cursor = bookingItems.find({
    itemType: 'PHOTOGRAPHY_PACKAGE',
    shootDate: { $ne: null },
    shootTimeSlot: { $ne: null },
  });

  for await (const item of cursor) {
    report.examined += 1;
    const slot = parseLegacyTimeSlot(item.shootTimeSlot);
    if (!slot || !item.providerId || !item.bookingId) {
      report.invalid.push({
        bookingItemId: item._id.toString(),
        reason: 'Thiếu provider/booking hoặc shootTimeSlot không hợp lệ.',
      });
      continue;
    }

    const exists = await schedules.findOne({
      bookingItemId: item._id,
      scheduleType: 'PHOTOSHOOT',
      startsAt: { $ne: null },
    });
    if (exists) {
      report.skippedExisting += 1;
      continue;
    }

    const localDate = toLocalDateKey(item.shootDate);
    const startsAt = new Date(`${localDate}T${slot.start}:00+07:00`);
    const endsAt = new Date(`${localDate}T${slot.end}:00+07:00`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      report.invalid.push({
        bookingItemId: item._id.toString(),
        reason: 'Không thể chuyển đổi ngày/giờ legacy.',
      });
      continue;
    }

    report.eligible += 1;
    if (!apply) continue;

    await schedules.insertOne({
      bookingId: item.bookingId,
      bookingItemId: item._id,
      providerId: item.providerId,
      scheduleType: 'PHOTOSHOOT',
      scheduledDate: item.shootDate,
      timeSlot: item.shootTimeSlot,
      startsAt,
      endsAt,
      providerLocalDate: localDate,
      status: 'SCHEDULED',
      includedDurationMinutes: toMinutes(slot.end) - toMinutes(slot.start),
      overtimeMinutes: 0,
      scheduleSchemaVersion: 2,
      migratedFromLegacyItemId: item._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    report.created += 1;
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
