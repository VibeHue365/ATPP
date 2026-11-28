export type ProviderSettlementStatus =
  | 'READY_TO_SETTLE'
  | 'SETTLED'
  | 'ON_HOLD'
  | 'CANCELLED';

export interface ProviderSettlementItem {
  _id: string;
  id?: string;
  settlementCode?: string;
  bookingId?:
    | string
    | {
        _id?: string;
        id?: string;
        bookingCode?: string;
        status?: string;
        completedAt?: string;
        createdAt?: string;
      };
  bookingCode?: string;
  grossAmount?: number;
  commissionRate?: number;
  commissionAmount?: number;
  allocatedPlatformFee?: number;
  fixedPlatformFee?: number;
  netAmount?: number;
  refundAmount?: number;
  penaltyAmount?: number;
  compensationAmount?: number;
  payableAmount?: number;
  amount?: number;
  status?: ProviderSettlementStatus | string;
  holdReason?: string | null;
  payoutReference?: string | null;
  note?: string | null;
  settledAt?: string | null;
  createdAt?: string;
  date?: string;
}

export interface SettlementSummaryBucket {
  amount: number;
  count: number;
}

export interface ProviderSettlementsSummary {
  totalGrossRevenue: number;
  totalPlatformFee: number;
  totalCompensation: number;
  totalNetEarnings: number;
  pending: SettlementSummaryBucket;
  settled: SettlementSummaryBucket;
  held: SettlementSummaryBucket;
  cancelled: SettlementSummaryBucket;
  activeCount: number;
  totalCount: number;
}

export interface ProviderSettlementsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProviderSettlementsFilters {
  status: string;
  fromDate: string;
  toDate: string;
  page: number;
  limit: number;
}

export interface ProviderSettlementsResponse {
  items: ProviderSettlementItem[];
  pagination?: ProviderSettlementsPagination;
  summary?: ProviderSettlementsSummary;
  lifetimeSummary?: ProviderSettlementsSummary;
}

export const EMPTY_PROVIDER_SETTLEMENTS_SUMMARY: ProviderSettlementsSummary = {
  totalGrossRevenue: 0,
  totalPlatformFee: 0,
  totalCompensation: 0,
  totalNetEarnings: 0,
  pending: { amount: 0, count: 0 },
  settled: { amount: 0, count: 0 },
  held: { amount: 0, count: 0 },
  cancelled: { amount: 0, count: 0 },
  activeCount: 0,
  totalCount: 0,
};
