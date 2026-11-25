import {
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  InventorySlotLease,
  InventorySlotLeaseDocument,
  SlotLeasePurpose,
  SlotLeaseStatus,
} from '../schemas/inventory-slot-lease.schema';
import { TimeSlotEngineService } from './time-slot-engine.service';
import { ProductBusyCacheService } from './product-busy-cache.service';

export interface AcquireUpfrontBlockInput {
  inventoryItemId: Types.ObjectId;
  providerId: Types.ObjectId;
  bookingId: Types.ObjectId;
  bookingItemId: Types.ObjectId;
  reservationId?: Types.ObjectId | null;
  rentalSlots: { dateStr: string; slotIndex: number }[];
  turnaroundSlots: { dateStr: string; slotIndex: number }[];
  status?: SlotLeaseStatus; // Default: TEMP
  expiresAt?: Date | null;
}

@Injectable()
export class InventorySlotLeaseService {
  private readonly logger = new Logger(InventorySlotLeaseService.name);

  constructor(
    @InjectModel(InventorySlotLease.name)
    private readonly leaseModel: Model<InventorySlotLeaseDocument>,
    private readonly timeEngine: TimeSlotEngineService,
    @Optional()
    private readonly productBusyCacheService?: ProductBusyCacheService,
  ) {}

  /**
   * Check if a MongoDB duplicate key error (11000) was specifically caused by the slot lease unique index.
   */
  isSlotConflictError(error: any): boolean {
    if (!error || error.code !== 11000) return false;
    const keyPattern = error.keyPattern || {};
    if (
      keyPattern.inventoryItemId &&
      keyPattern.dateStr &&
      keyPattern.slotIndex
    ) {
      return true;
    }
    const message = error.message || '';
    if (
      message.includes('inventory_slot_leases_item_date_slot_unique') ||
      (message.includes('inventoryItemId') && message.includes('slotIndex'))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Acquire upfront block leases (RENTAL + TURNAROUND) for a booking item atomically.
   * Throws ConflictException (409) if any slot is already leased by an active lease.
   */
  async acquireUpfrontBlockLease(
    input: AcquireUpfrontBlockInput,
    session?: ClientSession,
  ): Promise<InventorySlotLeaseDocument[]> {
    const now = new Date();
    const status = input.status || SlotLeaseStatus.Temp;
    const allSlots = [
      ...input.rentalSlots.map((s) => ({
        ...s,
        purpose: SlotLeasePurpose.Rental,
      })),
      ...input.turnaroundSlots.map((s) => ({
        ...s,
        purpose: SlotLeasePurpose.Turnaround,
      })),
    ];

    if (allSlots.length === 0) return [];

    // 1. Purge expired TEMP leases for these specific slots in the same session
    const slotConditions = allSlots.map((s) => ({
      inventoryItemId: input.inventoryItemId,
      dateStr: s.dateStr,
      slotIndex: s.slotIndex,
      status: SlotLeaseStatus.Temp,
      expiresAt: { $lte: now },
    }));

    if (slotConditions.length > 0) {
      await this.leaseModel
        .updateMany(
          { $or: slotConditions },
          {
            $set: {
              status: SlotLeaseStatus.Released,
              releasedAt: now,
              releaseReason: 'EXPIRED',
            },
          },
          { session },
        )
        .exec();
    }

    // 2. Prepare documents for insertion
    const docs = allSlots.map((slot) => ({
      inventoryItemId: input.inventoryItemId,
      providerId: input.providerId,
      bookingId: input.bookingId,
      bookingItemId: input.bookingItemId,
      reservationId: input.reservationId || null,
      dateStr: slot.dateStr,
      slotIndex: slot.slotIndex,
      purpose: slot.purpose,
      status,
      expiresAt:
        status === SlotLeaseStatus.Temp ? input.expiresAt || null : null,
    }));

    try {
      const created = await this.leaseModel.insertMany(docs, { session });
      return created;
    } catch (error: any) {
      if (this.isSlotConflictError(error)) {
        this.logger.warn(
          `Slot collision detected for item ${input.inventoryItemId} on requested slots. Error 11000 caught.`,
        );
        throw new ConflictException(
          'Một hoặc nhiều khung giờ đã được giữ chỗ bởi khách hàng khác. Vui lòng chọn khung giờ khác.',
        );
      }
      throw error;
    }
  }

  /**
   * Confirm all TEMP leases for a booking once payment succeeds.
   */
  async confirmBookingLeases(
    bookingId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<number> {
    const id =
      typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId;
    const res = await this.leaseModel
      .updateMany(
        { bookingId: id, status: SlotLeaseStatus.Temp },
        {
          $set: {
            status: SlotLeaseStatus.Confirmed,
            expiresAt: null,
          },
        },
        { session },
      )
      .exec();
    if (res.modifiedCount > 0) {
      this.productBusyCacheService?.invalidate();
    }
    return res.modifiedCount;
  }

  /**
   * Release all leases for a booking (e.g. on cancellation or payment timeout).
   */
  async releaseBookingLeases(
    bookingId: Types.ObjectId | string,
    reason: 'CANCELLED' | 'EXPIRED' | 'COMPLETED',
    session?: ClientSession,
  ): Promise<number> {
    const id =
      typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId;
    const res = await this.leaseModel
      .updateMany(
        {
          bookingId: id,
          status: { $in: [SlotLeaseStatus.Temp, SlotLeaseStatus.Confirmed] },
        },
        {
          $set: {
            status: SlotLeaseStatus.Released,
            releasedAt: new Date(),
            releaseReason: reason,
          },
        },
        { session },
      )
      .exec();
    if (res.modifiedCount > 0) {
      this.productBusyCacheService?.invalidate();
    }
    return res.modifiedCount;
  }

  /**
   * Reconcile turnaround leases upon return or early-ready.
   * Releases any TURNAROUND lease where leaseStart >= availableFrom.
   */
  async reconcileTurnaroundLeases(
    bookingItemId: Types.ObjectId | string,
    availableFrom: Date,
    session?: ClientSession,
  ): Promise<number> {
    const bItemId =
      typeof bookingItemId === 'string'
        ? new Types.ObjectId(bookingItemId)
        : bookingItemId;
    const activeTurnaroundLeases = await this.leaseModel
      .find({
        bookingItemId: bItemId,
        purpose: SlotLeasePurpose.Turnaround,
        status: SlotLeaseStatus.Confirmed,
      })
      .session(session || null)
      .exec();

    const leasesToRelease: Types.ObjectId[] = [];

    for (const lease of activeTurnaroundLeases) {
      const slotAlloc = this.timeEngine.getSlotAllocation(
        lease.dateStr,
        lease.slotIndex,
      );
      // Boundary condition: leaseStart >= availableFrom
      if (slotAlloc.start.getTime() >= availableFrom.getTime()) {
        leasesToRelease.push(lease._id);
      }
    }

    if (leasesToRelease.length > 0) {
      const res = await this.leaseModel
        .updateMany(
          { _id: { $in: leasesToRelease } },
          {
            $set: {
              status: SlotLeaseStatus.Released,
              releasedAt: new Date(),
              releaseReason: 'RETURN_RESTRUCTURED',
            },
          },
          { session },
        )
        .exec();
      if (res.modifiedCount > 0) {
        this.productBusyCacheService?.invalidate();
      }
      return res.modifiedCount;
    }

    return 0;
  }

  /**
   * Expire hold leases whose expiresAt has passed.
   */
  async expireHoldLeases(
    now: Date = new Date(),
    session?: ClientSession,
  ): Promise<number> {
    const res = await this.leaseModel
      .updateMany(
        { status: SlotLeaseStatus.Temp, expiresAt: { $lte: now } },
        {
          $set: {
            status: SlotLeaseStatus.Released,
            releasedAt: new Date(),
            releaseReason: 'EXPIRED',
          },
        },
        { session },
      )
      .exec();
    if (res.modifiedCount > 0) {
      this.productBusyCacheService?.invalidate();
    }
    return res.modifiedCount;
  }

  /**
   * Check if any active lease exists for a given inventory item and slot.
   */
  async isSlotBusy(
    inventoryItemId: Types.ObjectId | string,
    dateStr: string,
    slotIndex: number,
  ): Promise<boolean> {
    const itemId =
      typeof inventoryItemId === 'string'
        ? new Types.ObjectId(inventoryItemId)
        : inventoryItemId;
    const now = new Date();
    const existing = await this.leaseModel
      .findOne({
        inventoryItemId: itemId,
        dateStr,
        slotIndex,
        $or: [
          { status: SlotLeaseStatus.Confirmed },
          { status: SlotLeaseStatus.Temp, expiresAt: { $gt: now } },
        ],
      })
      .select({ _id: 1 })
      .lean()
      .exec();

    return !!existing;
  }
}
