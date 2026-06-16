import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DigitalContractDocument = HydratedDocument<DigitalContract>;

export enum ContractStatus {
  Draft = 'DRAFT',
  Signed = 'SIGNED',
  Void = 'VOID',
}

export interface ContractPolicySnapshot {
  cancellationPolicy: string;
  refundPolicy: string;
  lateFeeRate: number; // e.g. percent per hour/day or fixed rate
  damagePolicy: string;
}

export interface ContractSignature {
  signedBy: Types.ObjectId;
  signedAt: Date;
  ipAddress?: string | null;
  signatureUrl?: string | null;
}

@Schema({ collection: 'digital_contracts', timestamps: true })
export class DigitalContract {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  contractCode: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  contractTerms: string;

  @Prop({
    type: {
      cancellationPolicy: { type: String, required: true },
      refundPolicy: { type: String, required: true },
      lateFeeRate: { type: Number, required: true, min: 0 },
      damagePolicy: { type: String, required: true },
    },
    required: true,
  })
  policySnapshot: ContractPolicySnapshot;

  @Prop({
    type: [
      {
        _id: false,
        signedBy: { type: Types.ObjectId, ref: 'User', required: true },
        signedAt: { type: Date, default: Date.now },
        ipAddress: { type: String, default: null },
        signatureUrl: { type: String, default: null },
      },
    ],
    default: [],
  })
  signatures: ContractSignature[];

  @Prop({
    type: String,
    enum: Object.values(ContractStatus),
    default: ContractStatus.Draft,
    index: true,
  })
  status: ContractStatus;
}

export const DigitalContractSchema = SchemaFactory.createForClass(DigitalContract);
