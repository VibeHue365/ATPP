import httpClient from '@/apis/httpClient';

export interface RefundEligibility {
  eligible:boolean;
  reason?:string|null;
  capturedAmount?:number;
  completedRefundAmount?:number;
  reservedRefundAmount?:number;
  maximumRefundableAmount?:number;
  estimatedRefundAmount?:number;
}

export interface CustomerRefund {
  _id:string;
  bookingId:string|{_id:string};
  status:'PENDING'|'APPROVED'|'PROCESSING'|'COMPLETED'|'REJECTED'|'FAILED'|string;
  amount:number;
  approvedAmount?:number;
  processedAmount?:number;
  reason?:string;
  adminNotes?:string;
  failureReason?:string;
  createdAt:string;
  updatedAt?:string;
}

const createIdempotencyKey=()=>`mobile-refund-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

export const refundApi={
  eligibility:(bookingId:string)=>httpClient.get<never,RefundEligibility>(`/refunds/bookings/${bookingId}/eligibility`),
  mine:()=>httpClient.get<never,CustomerRefund[]>('/refunds/mine'),
  create:(bookingId:string,amount:number|undefined,reason:string)=>httpClient.post<never,CustomerRefund>(`/refunds/bookings/${bookingId}`,{amount,reason},{headers:{'Idempotency-Key':createIdempotencyKey()}}),
};
