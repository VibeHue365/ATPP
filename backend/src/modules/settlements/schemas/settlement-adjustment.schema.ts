import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SettlementAdjustmentDocument = HydratedDocument<SettlementAdjustment>;

@Schema({ collection: 'settlement_adjustments', timestamps: true })
export class SettlementAdjustment {
  @Prop({ type: Types.ObjectId, ref: 'Settlement', required: true, index: true })
  settlementId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RefundRequest', required: true, index: true })
  refundRequestId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amount: number;

  @Prop({ required: true, min: 0, default: 0 })
  appliedAmount: number;

  @Prop({ type: String, enum: ['PENDING', 'APPLIED'], default: 'PENDING', index: true })
  status: 'PENDING' | 'APPLIED';

  @Prop({ type: String, default: null })
  reason?: string | null;
}

export const SettlementAdjustmentSchema = SchemaFactory.createForClass(SettlementAdjustment);
SettlementAdjustmentSchema.index({ settlementId: 1, refundRequestId: 1 }, { unique: true });
