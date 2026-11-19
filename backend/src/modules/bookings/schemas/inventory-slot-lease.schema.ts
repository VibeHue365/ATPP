import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InventorySlotLeaseDocument = HydratedDocument<InventorySlotLease>;

export enum SlotLeasePurpose {
  Rental = 'RENTAL',
  Turnaround = 'TURNAROUND',
}

export enum SlotLeaseStatus {
  Temp = 'TEMP',
  Confirmed = 'CONFIRMED',
  Released = 'RELEASED',
}

@Schema({ collection: 'inventory_slot_leases', timestamps: true })
export class InventorySlotLease {
  @Prop({
    type: Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
    index: true,
  })
  inventoryItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'BookingItem',
    required: true,
    index: true,
  })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'InventoryReservation', default: null })
  reservationId?: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  dateStr: string; // "YYYY-MM-DD" in Asia/Ho_Chi_Minh

  @Prop({ type: Number, required: true, min: 1, max: 7 })
  slotIndex: number;

  @Prop({ type: String, enum: Object.values(SlotLeasePurpose), required: true })
  purpose: SlotLeasePurpose;

  @Prop({
    type: String,
    enum: Object.values(SlotLeaseStatus),
    required: true,
    index: true,
  })
  status: SlotLeaseStatus;

  @Prop({ type: Date, default: null, index: true })
  expiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  releasedAt?: Date | null;

  @Prop({ type: String, default: null })
  releaseReason?:
    | 'CANCELLED'
    | 'EXPIRED'
    | 'COMPLETED'
    | 'EARLY_READY'
    | 'RETURN_RESTRUCTURED'
    | null;
}

export const InventorySlotLeaseSchema =
  SchemaFactory.createForClass(InventorySlotLease);

InventorySlotLeaseSchema.index(
  { inventoryItemId: 1, dateStr: 1, slotIndex: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['TEMP', 'CONFIRMED'] } },
    name: 'inventory_slot_leases_item_date_slot_unique',
  },
);

InventorySlotLeaseSchema.index({ bookingId: 1, status: 1 });
InventorySlotLeaseSchema.index({ bookingItemId: 1, status: 1 });
InventorySlotLeaseSchema.index({ providerId: 1, dateStr: 1 });
