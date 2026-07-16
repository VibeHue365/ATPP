import { Types } from 'mongoose';

export interface PaymentAccountDoc {
  bankName?: string;
  accountNumberMasked?: string;
  accountHolder?: string;
  isDefault?: boolean;
}

export interface ProviderDoc {
  _id: Types.ObjectId;
  paymentAccounts?: PaymentAccountDoc[];
}

export interface RefundResult {
  status: string;
  amount: number;
  orderCode: number;
  refundId?: string;
}

export interface TransferResult {
  success: boolean;
  bankTxnId?: string;
  error?: string;
}
