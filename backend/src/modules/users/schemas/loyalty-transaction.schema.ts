import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoyaltyTransactionDocument = HydratedDocument<LoyaltyTransaction>;

export enum LoyaltyTransactionType {
  Earned = 'EARNED',
  Redeemed = 'REDEEMED',
  Refunded = 'REFUNDED',
  Adjusted = 'ADJUSTED',
}

export enum LoyaltyTransactionStatus {
  Completed = 'COMPLETED',
  Pending = 'PENDING',
  Cancelled = 'CANCELLED',
}

@Schema({ collection: 'loyalty_transactions', timestamps: true })
export class LoyaltyTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', default: null, index: true })
  bookingId?: Types.ObjectId | null;

  @Prop({ required: true })
  pointsChange: number;

  @Prop({
    type: String,
    enum: Object.values(LoyaltyTransactionType),
    required: true,
    index: true,
  })
  transactionType: LoyaltyTransactionType;

  @Prop({ type: String, required: true, trim: true })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(LoyaltyTransactionStatus),
    default: LoyaltyTransactionStatus.Completed,
    index: true,
  })
  status: LoyaltyTransactionStatus;
}

export const LoyaltyTransactionSchema =
  SchemaFactory.createForClass(LoyaltyTransaction);
