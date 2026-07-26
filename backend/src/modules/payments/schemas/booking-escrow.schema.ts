import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingEscrowDocument = HydratedDocument<BookingEscrow>;

export enum EscrowStatus {
  Held = 'HELD',
  Settled = 'SETTLED',
  Refunded = 'REFUNDED',
  Disputed = 'DISPUTED',
  DisputedResolved = 'DISPUTED_RESOLVED',
}

@Schema({ collection: 'booking_escrows', timestamps: true })
export class BookingEscrow {
  @Prop({
    type: Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
    index: true,
  })
  bookingId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  totalAmountCollected: number;

  @Prop({ type: Number, required: true, min: 0 })
  damageDepositAmount: number;

  @Prop({
    type: String,
    enum: Object.values(EscrowStatus),
    default: EscrowStatus.Held,
    index: true,
  })
  status: EscrowStatus;
}

export const BookingEscrowSchema = SchemaFactory.createForClass(BookingEscrow);
