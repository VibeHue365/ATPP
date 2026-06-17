import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DisputeDocument = HydratedDocument<Dispute>;

export enum DisputeStatus {
  Open = 'OPEN',
  UnderReview = 'UNDER_REVIEW',
  Resolved = 'RESOLVED',
  Cancelled = 'CANCELLED',
}

export enum DisputeDecision {
  CustomerFullRefund = 'CUSTOMER_FULL_REFUND',
  ProviderFullPay = 'PROVIDER_FULL_PAY',
  MutualAgreement = 'MUTUAL_AGREEMENT',
}

export enum FaultParty {
  Provider = 'PROVIDER',
  Customer = 'CUSTOMER',
  None = 'NONE',
}

export enum ObligationStatus {
  PendingProof = 'PENDING_PROOF',
  Completed = 'COMPLETED',
  Overdue = 'OVERDUE',
}

export interface DisputeAdminDecision {
  decision: DisputeDecision;
  faultParty: FaultParty;
  refundAmount: number;
  compensationAmount: number;
  penaltyAmount: number;
  decisionNote?: string | null;
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
}

export interface DisputeObligation {
  responsibleParty: FaultParty;
  actionRequired: string;
  amount: number;
  dueAt?: Date | null;
  status: ObligationStatus;
}

@Schema({ collection: 'disputes', timestamps: true })
export class Dispute {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BookingItem', required: true, index: true })
  bookingItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  openedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  againstProviderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RentalHandover', default: null, index: true })
  handoverId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'RefundRequest', default: null, index: true })
  refundRequestId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: [String], default: [] })
  evidencePhotos: string[];

  @Prop({
    type: String,
    enum: Object.values(DisputeStatus),
    default: DisputeStatus.Open,
    index: true,
  })
  status: DisputeStatus;

  @Prop({
    type: {
      decision: { type: String, enum: Object.values(DisputeDecision), required: true },
      faultParty: { type: String, enum: Object.values(FaultParty), required: true },
      refundAmount: { type: Number, default: 0, min: 0 },
      compensationAmount: { type: Number, default: 0, min: 0 },
      penaltyAmount: { type: Number, default: 0, min: 0 },
      decisionNote: { type: String, default: null },
      decidedBy: { type: Types.ObjectId, ref: 'User', default: null },
      decidedAt: { type: Date, default: null },
    },
    default: null,
  })
  adminDecision?: DisputeAdminDecision | null;

  @Prop({
    type: {
      responsibleParty: { type: String, enum: Object.values(FaultParty), required: true },
      actionRequired: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      dueAt: { type: Date, default: null },
      status: {
        type: String,
        enum: Object.values(ObligationStatus),
        default: ObligationStatus.PendingProof,
      },
    },
    default: null,
  })
  obligation?: DisputeObligation | null;
}

export const DisputeSchema = SchemaFactory.createForClass(Dispute);
