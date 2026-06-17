import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RentalHandoverDocument = HydratedDocument<RentalHandover>;

export enum HandoverType {
  Pickup = 'PICKUP',
  Return = 'RETURN',
}

export enum HandoverStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Disputed = 'DISPUTED',
}

export interface DepositDeductionInfo {
  depositAmount: number;
  deductionAmount: number;
  refundableAmount: number;
  deductionReasons: string[];
}

@Schema({ collection: 'rental_handovers', timestamps: true })
export class RentalHandover {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true, index: true })
  inventoryItemId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(HandoverType),
    required: true,
    index: true,
  })
  handoverType: HandoverType;

  @Prop({ required: true, type: Date, default: Date.now })
  actualTime: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  handledBy: Types.ObjectId; // Staff or Provider who handled the handover

  @Prop({ type: [String], default: [] })
  conditionPhotos: string[];

  @Prop({ type: String, default: null, trim: true })
  conditionNotes?: string | null;

  @Prop({ type: [String], default: [] })
  accessoriesHanded: string[];

  @Prop({ type: Number, default: 0, min: 0 })
  lateReturnFee: number;

  @Prop({ type: Number, default: 0, min: 0 })
  damageFee: number;

  @Prop({ type: Number, default: 0, min: 0 })
  missingAccessoriesFee: number;

  @Prop({
    type: {
      depositAmount: { type: Number, required: true, min: 0 },
      deductionAmount: { type: Number, default: 0, min: 0 },
      refundableAmount: { type: Number, required: true, min: 0 },
      deductionReasons: { type: [String], default: [] },
    },
    required: true,
  })
  depositDeduction: DepositDeductionInfo;

  @Prop({
    type: String,
    enum: Object.values(HandoverStatus),
    default: HandoverStatus.Pending,
    index: true,
  })
  status: HandoverStatus;
}

export const RentalHandoverSchema = SchemaFactory.createForClass(RentalHandover);
RentalHandoverSchema.index({ bookingId: 1, handoverType: 1 });
