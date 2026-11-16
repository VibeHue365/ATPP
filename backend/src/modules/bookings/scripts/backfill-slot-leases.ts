import { Types } from 'mongoose';
import {
  TimeSlotEngineService,
  ShopScheduleConfig,
} from '../services/time-slot-engine.service';

export interface BackfillOptions {
  dryRun?: boolean;
  providerId?: string;
  logger?: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface BackfillConflict {
  providerId: string;
  inventoryItemId: string;
  dateStr: string;
  slotIndex: number;
  conflictingBookingItemIds: string[];
}

export interface BackfillResult {
  providersScanned: number;
  providersMigrated: number;
  providersSkippedWithConflicts: number;
  leasesInserted: number;
  conflicts: BackfillConflict[];
}

/**
 * Full lifecycle of active bookings that may hold an hourly product rental lease.
 * Covers PENDING_PAYMENT, DEPOSIT_PAID, CONFIRMED, PICKUP_PENDING, PICKED_UP, RETURN_PENDING, RETURNED,
 * plus COMBO_PHOTOS_APPROVED (where photography is done but aodai rental is ongoing).
 */
export const ACTIVE_BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'DEPOSIT_PAID',
  'CONFIRMED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'RETURN_PENDING',
  'RETURNED',
  'IN_PROGRESS',
  'AWAITING_REVIEW',
  'COMBO_PHOTOS_APPROVED',
  'DISPUTED',
];

const TERMINAL_FULFILLMENT_STATUSES = ['COMPLETED', 'CANCELLED'];
const ACTIVE_TURNAROUND_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'RELEASING', 'BLOCKED'];

const timeSlotEngine = new TimeSlotEngineService();

function toVnDateStr(date: Date): string {
  const s = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  return s.split('T')[0];
}

/**
 * Idempotent backfill script to migrate active hourly bookings to InventorySlotLease.
 * Uses exact MongoDB collection names: booking_items, inventory_reservations, inventory_slot_leases.
 * Performs preflight conflict checking per provider before creating leases and setting useSlotLeases = true.
 * Executes writes strictly inside a MongoDB transaction in apply mode. If sessions/transactions are unavailable,
 * throws immediately and performs no writes.
 */
export async function runBackfillSlotLeases(
  db: any,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const logger = options.logger || console;
  const isDryRun = options.dryRun !== false;

  const result: BackfillResult = {
    providersScanned: 0,
    providersMigrated: 0,
    providersSkippedWithConflicts: 0,
    leasesInserted: 0,
    conflicts: [],
  };

  const providerFilter: Record<string, any> = {};
  if (options.providerId) {
    providerFilter._id = new Types.ObjectId(options.providerId);
  }

  const providers = await db.collection('providers').find(providerFilter).toArray();
  result.providersScanned = providers.length;

  for (const provider of providers) {
    const provIdStr = provider._id.toString();
    const turnaroundSlotsCount = provider.rentalSettings?.turnaroundSlots ?? 1;

    // Load provider schedule for turnaround rollover
    let scheduleConfig: ShopScheduleConfig | undefined = undefined;
    try {
      const schedules = await db
        .collection('provider_schedules')
        .find({
          providerId: provider._id,
          $or: [{ capability: null }, { capability: 'AODAI_RENTAL' }],
        })
        .toArray();

      if (schedules && schedules.length > 0) {
        const recurringSchedules = schedules.filter(
          (s: any) => s.scheduleType === 'RECURRING' && typeof s.dayOfWeek === 'number',
        );
        let weeklyOffDays: number[] | undefined = undefined;
        if (recurringSchedules.length > 0) {
          const workingDays = new Set(recurringSchedules.map((s: any) => s.dayOfWeek));
          weeklyOffDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !workingDays.has(d));
        }

        const offDays: string[] = [];
        for (const s of schedules) {
          if (s.scheduleType === 'SPECIFIC_DATE' && Array.isArray(s.offDays)) {
            for (const d of s.offDays) {
              offDays.push(toVnDateStr(new Date(d)));
            }
          }
        }

        scheduleConfig = {
          weeklyOffDays,
          offDays: offDays.length > 0 ? offDays : undefined,
        };
      }
    } catch {
      scheduleConfig = undefined;
    }

    // 1. Find all candidate hourly product items for this provider
    const candidateBookingItems = await db
      .collection('booking_items')
      .find({
        providerId: provider._id,
        itemType: 'PRODUCT',
        rentalType: 'HOURLY',
      })
      .toArray();

    const activeBookingItems: any[] = [];
    const activeBookingMap = new Map<string, any>();

    for (const item of candidateBookingItems) {
      let booking = activeBookingMap.get(item.bookingId.toString());
      if (!booking) {
        booking = await db.collection('bookings').findOne({ _id: item.bookingId });
        if (booking) {
          activeBookingMap.set(item.bookingId.toString(), booking);
        }
      }

      if (!booking) continue;

      let isActive = false;

      // Priority 1: Check BookingItem.rentalFulfillment
      if (item.rentalFulfillment) {
        const fStatus = item.rentalFulfillment.status;
        const tStatus = item.rentalFulfillment.turnaroundStatus;

        if (TERMINAL_FULFILLMENT_STATUSES.includes(fStatus)) {
          // If turnaround is still scheduled or in progress, item lease is still active
          if (ACTIVE_TURNAROUND_STATUSES.includes(tStatus)) {
            isActive = true;
          } else {
            isActive = false;
          }
        } else {
          // In progress rental (PENDING, READY_FOR_PICKUP, PICKED_UP, RETURNED)
          isActive = true;
        }
      } else {
        // Priority 2: Legacy items - check active reservation in inventory_reservations
        const res = await db.collection('inventory_reservations').findOne({
          bookingItemId: item._id,
          status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
        });

        if (res) {
          isActive = true;
        } else if (ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
          // COMBO_PHOTOS_APPROVED: if product rental is not completed, it is active
          if (booking.status === 'COMBO_PHOTOS_APPROVED') {
            isActive = true;
          } else if (!['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status)) {
            isActive = true;
          }
        }
      }

      if (isActive) {
        activeBookingItems.push(item);
      }
    }

    // Helper to start transaction in apply mode
    const startApplySession = async () => {
      let session: any = null;
      if (typeof db.startSession === 'function') {
        session = await db.startSession();
      } else if (typeof db.client?.startSession === 'function') {
        session = await db.client.startSession();
      }

      if (!session || typeof session.startTransaction !== 'function') {
        throw new Error(
          `[Backfill] MongoDB session and transaction support are strictly required in apply mode for provider ${provIdStr}. Non-atomic writes are disallowed.`,
        );
      }

      try {
        session.startTransaction();
      } catch (err: any) {
        throw new Error(
          `[Backfill] Failed to start MongoDB transaction for provider ${provIdStr}: ${err.message}. Aborting backfill.`,
        );
      }

      return session;
    };

    if (activeBookingItems.length === 0) {
      if (!isDryRun && !provider.useSlotLeases) {
        const session = await startApplySession();
        try {
          await db.collection('providers').updateOne(
            { _id: provider._id },
            { $set: { useSlotLeases: true } },
            { session },
          );
          await session.commitTransaction();
          result.providersMigrated++;
        } catch (err: any) {
          await session.abortTransaction();
          logger.error(`[Backfill] Failed to enable useSlotLeases for provider ${provIdStr}: ${err.message}`);
          throw err;
        } finally {
          await session.endSession();
        }
      }
      continue;
    }

    // Resolve inventoryItemId if needed via 'inventory_reservations'
    let unresolvableItemFound = false;
    for (const item of activeBookingItems) {
      if (!item.inventoryItemId) {
        const res = await db.collection('inventory_reservations').findOne({
          bookingItemId: item._id,
          status: { $in: ['TEMP_RESERVED', 'CONFIRMED'] },
        });
        if (res?.inventoryItemId) {
          item.inventoryItemId = res.inventoryItemId;
        } else {
          logger.warn(
            `[Backfill] Booking item ${item._id} for provider ${provIdStr} has no inventoryItemId and no reservation. Cannot backfill.`,
          );
          unresolvableItemFound = true;
        }
      }
    }

    // If any active booking item cannot be resolved to an inventory item, DO NOT enable useSlotLeases!
    if (unresolvableItemFound) {
      logger.warn(
        `[Backfill] Provider ${provIdStr} has unresolvable booking items. Skipping backfill and keeping useSlotLeases = false.`,
      );
      result.providersSkippedWithConflicts++;
      continue;
    }

    // Preload any existing leases in inventory_slot_leases for these inventory items to detect conflicts with DB
    const distinctItemIds: Types.ObjectId[] = Array.from(
      new Set<string>(activeBookingItems.map((i: any) => i.inventoryItemId.toString())),
    ).map((id: string) => new Types.ObjectId(id));

    let existingLeasesInDb: any[] = [];
    try {
      existingLeasesInDb = await db
        .collection('inventory_slot_leases')
        .find({
          inventoryItemId: { $in: distinctItemIds },
          status: { $in: ['TEMP', 'CONFIRMED'] },
        })
        .toArray();
    } catch {
      existingLeasesInDb = [];
    }

    // 3. Preflight conflict detection
    const slotUsageMap = new Map<string, string[]>(); // key -> bookingItemIds[]
    // Populate usage map with existing leases in DB
    for (const el of existingLeasesInDb) {
      const elKey = `${el.inventoryItemId.toString()}:${el.dateStr}:${el.slotIndex}`;
      const current = slotUsageMap.get(elKey) || [];
      const elBookingItemId = el.bookingItemId?.toString();
      if (elBookingItemId && !current.includes(elBookingItemId)) {
        current.push(elBookingItemId);
      }
      slotUsageMap.set(elKey, current);
    }

    const plannedLeases: Array<{
      inventoryItemId: any;
      bookingId: any;
      bookingItemId: any;
      dateStr: string;
      slotIndex: number;
      purpose: 'RENTAL' | 'TURNAROUND';
      status: 'TEMP' | 'CONFIRMED';
    }> = [];

    let providerHasConflict = false;

    for (const item of activeBookingItems) {
      const shootDate = item.shootDate ? new Date(item.shootDate) : new Date();
      const dateStr = toVnDateStr(shootDate);
      const booking = activeBookingMap.get(item.bookingId.toString());
      const leaseStatus = booking?.status === 'PENDING_PAYMENT' ? 'TEMP' : 'CONFIRMED';

      // Parse time slot and duration (multiple of 2 hours, boundary hours 07, 09, 11, etc.)
      let startSlot = 1;
      let rentalSlotCount = 1;
      const rawSlot = item.shootTimeSlot || (item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : '07:00-09:00');
      try {
        const parsed = timeSlotEngine.parseAndValidateTimeSlot(rawSlot);
        startSlot = parsed.startSlotIndex;
        rentalSlotCount = parsed.rentalSlotCount;
      } catch (err: any) {
        logger.warn(
          `[Backfill] Booking item ${item._id} has invalid time slot "${rawSlot}": ${err.message}. Skipping provider.`,
        );
        providerHasConflict = true;
        break;
      }

      // Calculate exact rental and turnaround blocks using TimeSlotEngine
      const upfrontBlock = timeSlotEngine.calculateUpfrontBlock(
        dateStr,
        startSlot,
        rentalSlotCount,
        turnaroundSlotsCount,
        scheduleConfig,
      );

      // Check and plan rental leases
      for (const rSlot of upfrontBlock.rentalSlots) {
        const rKey = `${item.inventoryItemId.toString()}:${rSlot.dateStr}:${rSlot.slotIndex}`;
        const existingUsers = slotUsageMap.get(rKey) || [];
        if (existingUsers.length > 0 && !existingUsers.includes(item._id.toString())) {
          providerHasConflict = true;
          result.conflicts.push({
            providerId: provIdStr,
            inventoryItemId: item.inventoryItemId.toString(),
            dateStr: rSlot.dateStr,
            slotIndex: rSlot.slotIndex,
            conflictingBookingItemIds: [...existingUsers, item._id.toString()],
          });
        }
        if (!existingUsers.includes(item._id.toString())) {
          existingUsers.push(item._id.toString());
        }
        slotUsageMap.set(rKey, existingUsers);

        plannedLeases.push({
          inventoryItemId: item.inventoryItemId,
          bookingId: item.bookingId,
          bookingItemId: item._id,
          dateStr: rSlot.dateStr,
          slotIndex: rSlot.slotIndex,
          purpose: 'RENTAL',
          status: leaseStatus,
        });
      }

      // Check and plan turnaround leases
      for (const tSlot of upfrontBlock.turnaroundSlots) {
        const tKey = `${item.inventoryItemId.toString()}:${tSlot.dateStr}:${tSlot.slotIndex}`;
        const existingUsers = slotUsageMap.get(tKey) || [];
        if (existingUsers.length > 0 && !existingUsers.includes(item._id.toString())) {
          providerHasConflict = true;
          result.conflicts.push({
            providerId: provIdStr,
            inventoryItemId: item.inventoryItemId.toString(),
            dateStr: tSlot.dateStr,
            slotIndex: tSlot.slotIndex,
            conflictingBookingItemIds: [...existingUsers, item._id.toString()],
          });
        }
        if (!existingUsers.includes(item._id.toString())) {
          existingUsers.push(item._id.toString());
        }
        slotUsageMap.set(tKey, existingUsers);

        plannedLeases.push({
          inventoryItemId: item.inventoryItemId,
          bookingId: item.bookingId,
          bookingItemId: item._id,
          dateStr: tSlot.dateStr,
          slotIndex: tSlot.slotIndex,
          purpose: 'TURNAROUND',
          status: leaseStatus,
        });
      }
    }

    if (providerHasConflict) {
      logger.warn(
        `[Backfill] Provider ${provIdStr} has slot collisions among active bookings or existing leases. Skipping lease backfill and keeping useSlotLeases = false.`,
      );
      result.providersSkippedWithConflicts++;
      continue;
    }

    // 4. Perform idempotent upsert of leases strictly inside a transaction
    if (!isDryRun) {
      const session = await startApplySession();

      try {
        let insertedInThisBatch = 0;
        for (const lease of plannedLeases) {
          const updateRes = await db.collection('inventory_slot_leases').updateOne(
            {
              inventoryItemId: lease.inventoryItemId,
              bookingItemId: lease.bookingItemId,
              dateStr: lease.dateStr,
              slotIndex: lease.slotIndex,
              purpose: lease.purpose,
            },
            {
              $setOnInsert: {
                providerId: provider._id,
                bookingId: lease.bookingId,
                status: lease.status,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true, session },
          );
          if (updateRes.upsertedCount > 0) {
            insertedInThisBatch++;
          }
        }

        const migratedBookingItemIds = Array.from(
          new Set<string>(plannedLeases.map((l: any) => l.bookingItemId.toString())),
        ).map((id: string) => new Types.ObjectId(id));

        // 1. Always set top-level slotLeaseRequired = true for all migrated booking items
        await db.collection('booking_items').updateMany(
          { _id: { $in: migratedBookingItemIds } },
          {
            $set: {
              slotLeaseRequired: true,
            },
          },
          { session },
        );

        // 2. Only update nested rentalFulfillment.slotLeaseRequired if rentalFulfillment actually exists and is an object
        await db.collection('booking_items').updateMany(
          {
            _id: { $in: migratedBookingItemIds },
            rentalFulfillment: { $type: 'object', $ne: null },
          },
          {
            $set: {
              'rentalFulfillment.slotLeaseRequired': true,
            },
          },
          { session },
        );

        await db.collection('providers').updateOne(
          { _id: provider._id },
          { $set: { useSlotLeases: true } },
          { session },
        );

        await session.commitTransaction();
        result.leasesInserted += insertedInThisBatch;
        result.providersMigrated++;
        logger.log(`[Backfill] Provider ${provIdStr} migrated successfully with ${plannedLeases.length} leases.`);
      } catch (err: any) {
        await session.abortTransaction();
        logger.error(`[Backfill] Error during provider ${provIdStr} migration, rolled back: ${err.message}`);
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      logger.log(`[Backfill Dry-Run] Provider ${provIdStr} would be migrated with ${plannedLeases.length} leases.`);
    }
  }

  return result;
}

// CLI runner: defaults to dry-run unless --apply or --commit is passed
if (require.main === module) {
  (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('dotenv').config();
    } catch {}

    const args = process.argv.slice(2);
    const isApply = args.some((a) => a.includes('apply') || a.includes('commit'));
    const providerArg = args.find((a) => a.includes('providerId'));
    let providerId: string | undefined = undefined;
    if (providerArg) {
      if (providerArg.includes('=')) {
        providerId = providerArg.split('=')[1]?.trim();
      } else {
        const idx = args.indexOf(providerArg);
        if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
          providerId = args[idx + 1]?.trim();
        }
      }
    }

    console.log(`[Backfill CLI] Starting slot leases backfill. Mode: ${isApply ? 'APPLY (LIVE)' : 'DRY RUN (DEFAULT)'}`);
    if (providerId) {
      console.log(`[Backfill CLI] Target providerId: ${providerId}`);
    }

    const mongooseModule = await import('mongoose');
    const mongoose = (mongooseModule as any).default || mongooseModule;
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vibehue';
    console.log(`[Backfill CLI] Connecting to MongoDB: ${mongoUri.replace(/:([^:@]{3,})@/, ':****@')}`);

    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    try {
      const res = await runBackfillSlotLeases(db, {
        dryRun: !isApply,
        providerId,
      });
      console.log('[Backfill CLI] Finished. Summary:', JSON.stringify(res, null, 2));
    } catch (err) {
      console.error('[Backfill CLI] Fatal error:', err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
