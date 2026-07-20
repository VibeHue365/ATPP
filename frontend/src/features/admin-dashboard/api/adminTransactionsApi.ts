import { httpClient } from '../../../services/httpClient';
export interface AdminTransaction { id:string; bookingId:string; bookingCode:string; providerName:string; amount:number; date:string; bank:string; account:string; status:'PAID'|'PENDING'|'FAILED'; }
export interface TransactionPage { items:AdminTransaction[]; page:number; totalPages:number; total:number; limit:number; }
export const adminTransactionsApi={list:(page:number)=>httpClient.get<TransactionPage>(`/admin/stats/transactions?page=${page}&limit=10`)};