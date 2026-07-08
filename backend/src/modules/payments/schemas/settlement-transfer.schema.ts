import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SettlementTransferDocument = HydratedDocument<SettlementTransfer>;

export enum SettlementTransferStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
}

@Schema({ collection: 'settlement_transfers', timestamps: true })
export class SettlementTransfer {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amountSent: number;

  @Prop({
    type: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountHolder: { type: String, required: true },
    },
    required: true,
  })
  destinationBankAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };

  @Prop({
    type: String,
    enum: Object.values(SettlementTransferStatus),
    default: SettlementTransferStatus.Pending,
    index: true,
  })
  status: SettlementTransferStatus;

  @Prop({ type: String, unique: true, required: true, index: true })
  transactionReference: string;

  @Prop({ type: String, default: null })
  errorMessage?: string | null;
}

export const SettlementTransferSchema =
  SchemaFactory.createForClass(SettlementTransfer);
