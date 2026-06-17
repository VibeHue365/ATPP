import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingSettlementDocument = HydratedDocument<BookingSettlement>;

export enum CommissionCollectionMethod {
  MonthlyInvoice = 'MONTHLY_INVOICE',
  DirectDeduction = 'DIRECT_DEDUCTION',
}

export enum CommissionCollectionStatus {
  Pending = 'PENDING',
  CommissionPaid = 'COMMISSION_PAID',
  Adjusted = 'ADJUSTED',
  Cancelled = 'CANCELLED',
}

export enum SettlementStatus {
  Calculated = 'CALCULATED',
  Invoiced = 'INVOICED',
  CommissionPaid = 'COMMISSION_PAID',
  Adjusted = 'ADJUSTED',
  Cancelled = 'CANCELLED',
  Refunded = 'REFUNDED',
  Disputed = 'DISPUTED',
  Completed = 'COMPLETED',
}

export interface CommissionCollectionInfo {
  method: CommissionCollectionMethod;
  status: CommissionCollectionStatus;
  paymentId?: Types.ObjectId | null;
  dueAt?: Date | null;
  paidAt?: Date | null;
}

@Schema({ collection: 'booking_settlements', timestamps: true })
export class BookingSettlement {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  grossAmount: number;

  @Prop({ required: true, min: 0 })
  platformCommission: number;

  @Prop({ required: true, min: 0 })
  providerReceivable: number;

  @Prop({
    type: {
      method: {
        type: String,
        enum: Object.values(CommissionCollectionMethod),
        default: CommissionCollectionMethod.MonthlyInvoice,
      },
      status: {
        type: String,
        enum: Object.values(CommissionCollectionStatus),
        default: CommissionCollectionStatus.Pending,
      },
      paymentId: { type: Types.ObjectId, ref: 'Payment', default: null },
      dueAt: { type: Date, default: null },
      paidAt: { type: Date, default: null },
    },
    required: true,
  })
  commissionCollection: CommissionCollectionInfo;

  @Prop({
    type: String,
    enum: Object.values(SettlementStatus),
    default: SettlementStatus.Calculated,
    index: true,
  })
  settlementStatus: SettlementStatus;
}

export const BookingSettlementSchema =
  SchemaFactory.createForClass(BookingSettlement);
BookingSettlementSchema.index({ providerId: 1, settlementStatus: 1 });
