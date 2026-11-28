import { payoutsApi } from '../api/providerDashboardApi';
import type { useProviderPayoutsState } from './useProviderPayoutsState';
import {
  EMPTY_PROVIDER_SETTLEMENTS_SUMMARY,
  type ProviderSettlementItem,
  type ProviderSettlementsFilters,
  type ProviderSettlementsResponse,
  type ProviderSettlementsSummary,
} from './types';

type Dependencies = Pick<
  ReturnType<typeof useProviderPayoutsState>,
  | 'setPayouts'
  | 'setIsLoadingPayouts'
  | 'setPayoutsError'
  | 'setPayoutSummary'
  | 'setPayoutLifetimeSummary'
  | 'setPayoutPagination'
  | 'payoutFilters'
  | 'setPayoutFilters'
>;

function computeFallbackSummary(
  items: ProviderSettlementItem[],
): ProviderSettlementsSummary {
  const summary: ProviderSettlementsSummary = {
    totalGrossRevenue: 0,
    totalPlatformFee: 0,
    totalCompensation: 0,
    totalNetEarnings: 0,
    pending: { amount: 0, count: 0 },
    settled: { amount: 0, count: 0 },
    held: { amount: 0, count: 0 },
    cancelled: { amount: 0, count: 0 },
    activeCount: 0,
    totalCount: items.length,
  };

  for (const item of items) {
    const status = String(item.status || 'SETTLED').toUpperCase();
    const payable = Number(item.payableAmount ?? item.netAmount ?? item.amount ?? 0);
    const gross = Number(item.grossAmount ?? 0);
    const fee =
      Number(item.commissionAmount ?? 0) +
      Number(item.allocatedPlatformFee ?? item.fixedPlatformFee ?? 0);
    const comp = Number(item.compensationAmount ?? 0);

    if (status === 'CANCELLED') {
      summary.cancelled.count += 1;
      summary.cancelled.amount += Number(item.netAmount ?? payable);
      continue;
    }

    summary.totalGrossRevenue += gross;
    summary.totalPlatformFee += fee;
    summary.totalCompensation += comp;
    summary.totalNetEarnings += payable;
    summary.activeCount += 1;

    if (status === 'SETTLED') {
      summary.settled.count += 1;
      summary.settled.amount += payable;
    } else if (status === 'ON_HOLD') {
      summary.held.count += 1;
      summary.held.amount += payable;
    } else {
      summary.pending.count += 1;
      summary.pending.amount += payable;
    }
  }

  return summary;
}

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createPayoutActions({
  setPayouts,
  setIsLoadingPayouts,
  setPayoutsError,
  setPayoutSummary,
  setPayoutLifetimeSummary,
  setPayoutPagination,
  payoutFilters,
  setPayoutFilters,
}: Dependencies) {
  const fetchPayouts = async (
    overrides?: Partial<ProviderSettlementsFilters>,
  ) => {
    const nextFilters: ProviderSettlementsFilters = {
      ...payoutFilters,
      ...overrides,
    };
    if (overrides) {
      setPayoutFilters(nextFilters);
    }

    setIsLoadingPayouts(true);
    setPayoutsError(null);
    try {
      let items: ProviderSettlementItem[] = [];
      let response: ProviderSettlementsResponse | null = null;

      try {
        const res = await payoutsApi.listSettlements<
          ProviderSettlementsResponse | ProviderSettlementItem[]
        >({
          status: nextFilters.status || undefined,
          fromDate: nextFilters.fromDate || undefined,
          toDate: nextFilters.toDate || undefined,
          page: nextFilters.page,
          limit: nextFilters.limit,
        });
        if (res && !Array.isArray(res) && Array.isArray(res.items)) {
          response = res;
          items = res.items;
        } else if (Array.isArray(res)) {
          items = res;
        }
      } catch {
        const legacy = await payoutsApi.listLegacyTransfers<
          ProviderSettlementItem[]
        >();
        if (Array.isArray(legacy)) items = legacy;
      }

      setPayouts(items);

      const fallback =
        items.length > 0
          ? computeFallbackSummary(items)
          : EMPTY_PROVIDER_SETTLEMENTS_SUMMARY;
      const summary = response?.summary ?? fallback;
      const lifetime = response?.lifetimeSummary ?? response?.summary ?? fallback;

      setPayoutSummary(summary);
      setPayoutLifetimeSummary(lifetime);
      setPayoutPagination(
        response?.pagination ?? {
          page: nextFilters.page,
          limit: nextFilters.limit,
          total: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / nextFilters.limit)),
        },
      );
    } catch (err) {
      console.error('Không thể tải lịch sử quyết toán:', err);
      setPayoutsError('Không thể tải dữ liệu doanh thu và quyết toán.');
    } finally {
      setIsLoadingPayouts(false);
    }
  };

  return { fetchPayouts };
}
