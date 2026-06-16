import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InventoryReservationDocument = HydratedDocument<InventoryReservation>;

export enum ReservationStatus {
  TempReserved = 'TEMP_RESERVED',
  Confirmed = 'CONFIRMED',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
  Completed = 'COMPLETED',
}

@Schema({ collection: 'inventory_reservations', timestamps: true })
export class InventoryReservation {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true, index: true })
  inventoryItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({ required: true, type: Date, index: true })
  reservedFrom: Date;

  @Prop({ required: true, type: Date, index: true })
  reservedTo: Date;

  @Prop({
    type: String,
    enum: Object.values(ReservationStatus),
    default: ReservationStatus.TempReserved,
    index: true,
  })
  status: ReservationStatus;

  @Prop({ type: Date, required: true, index: true })
  expiresAt: Date;
}

export const InventoryReservationSchema =
  SchemaFactory.createForClass(InventoryReservation);
InventoryReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-expire temp reservations
