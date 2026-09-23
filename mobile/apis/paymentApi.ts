import httpClient from '@/apis/httpClient';
import type { BookingType } from '@/types/booking';

export interface PaymentHistoryItem { _id:string; paymentCode:string; bookingId:string|{_id:string;bookingCode?:string;bookingType?:BookingType}; amount:number; refundedAmount?:number; purpose:string; paymentMethod?:string; status:'PENDING'|'SUCCESS'|'FAILED'|'CANCELLED'; createdAt:string; }
export const paymentApi={history:()=>httpClient.get<never,PaymentHistoryItem[]>('/payments/history')};
