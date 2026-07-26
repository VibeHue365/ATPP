import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SettlementRateType } from '../constants/settlement-rate-type.enum';
import { SettlementStatus } from '../constants/settlement-status.enum';

export type SettlementDocument = HydratedDocument<Settlement>;

export interface SettlementPolicySnapshot {
  policyCode: 'COMMISSION_POLICY';
  policyVersion: number;
  defaultCommissionRate: number;
  sameProviderComboCommissionRate: number;
  crossProviderComboCommissionRate: number;
  fixedPlatformFee: number;
  minCommissionAmount: number;
  appliedRateType: SettlementRateType;
}

export interface SettlementItemSnapshot {
  bookingItemId: Types.ObjectId;
  itemType: string;
  providerId: Types.ObjectId;
  itemName?: string | null;
  serviceAmount: number;
  providerDiscountAmount: number;
  platformDiscountAmount: number;
  depositAmount: number;
  commissionBaseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  allocatedPlatformFee: number;
  netAmount: number;
}

export interface SettlementPaymentSnapshot {
  paymentId?: Types.ObjectId | null;
  totalPaid: number;
  paymentStatus: string;
  paidAt?: Date | null;
}

@Schema({ collection: 'settlements', timestamps: true })
export class Settlement {
  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  settlementCode: string;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'BookingItem', default: [] })
  bookingItemIds: Types.ObjectId[];

  @Prop({ type: String, default: 'VND', enum: ['VND'] })
  currency: 'VND';

  @Prop({ type: Number, required: true, min: 0 })
  grossAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  commissionBaseAmount: number;

  @Prop({ type: Number, required: true, min: 0, max: 1 })
  commissionRate: number;

  @Prop({ type: Number, required: true, min: 0 })
  commissionAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  fixedPlatformFee: number;

  @Prop({ type: Number, required: true, min: 0 })
  allocatedPlatformFee: number;

  @Prop({ type: Number, required: true, min: 0 })
  netAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  refundAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  penaltyAmount: number;

  @Prop({ type: Number, required: true, min: 0 })
  payableAmount: number;

  @Prop({
    type: String,
    enum: Object.values(SettlementStatus),
    default: SettlementStatus.ReadyToSettle,
    index: true,
  })
  status: SettlementStatus;

  @Prop({ type: String, default: null, trim: true })
  holdReason?: string | null;

  @Prop({ type: Object, required: true })
  policySnapshot: SettlementPolicySnapshot;

  @Prop({ type: [Object], default: [] })
  itemSnapshots: SettlementItemSnapshot[];

  @Prop({ type: Object, default: null })
  paymentSnapshot?: SettlementPaymentSnapshot | null;

  @Prop({ type: String, default: null, trim: true })
  payoutReference?: string | null;

  @Prop({ type: String, default: null, trim: true })
  note?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  settledBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  settledAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SettlementSchema = SchemaFactory.createForClass(Settlement);

SettlementSchema.index({ bookingId: 1, providerId: 1 }, { unique: true });
SettlementSchema.index({ providerId: 1, status: 1, createdAt: -1 });
SettlementSchema.index({ bookingId: 1 });
SettlementSchema.index({ status: 1, createdAt: -1 });
SettlementSchema.index({ createdAt: -1 });
