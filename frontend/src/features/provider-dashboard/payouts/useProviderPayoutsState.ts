import { useState } from 'react';
import {
  EMPTY_PROVIDER_SETTLEMENTS_SUMMARY,
  type ProviderSettlementItem,
  type ProviderSettlementsFilters,
  type ProviderSettlementsPagination,
  type ProviderSettlementsSummary,
} from './types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderPayoutsState() {
  const [payouts, setPayouts] = useState<ProviderSettlementItem[]>([]);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState<boolean>(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutSummary, setPayoutSummary] = useState<ProviderSettlementsSummary>(
    EMPTY_PROVIDER_SETTLEMENTS_SUMMARY,
  );
  const [payoutLifetimeSummary, setPayoutLifetimeSummary] =
    useState<ProviderSettlementsSummary>(EMPTY_PROVIDER_SETTLEMENTS_SUMMARY);
  const [payoutPagination, setPayoutPagination] =
    useState<ProviderSettlementsPagination>({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
  const [payoutFilters, setPayoutFilters] =
    useState<ProviderSettlementsFilters>({
      status: '',
      fromDate: '',
      toDate: '',
      page: 1,
      limit: 20,
    });

  return {
    payouts,
    setPayouts,
    isLoadingPayouts,
    setIsLoadingPayouts,
    payoutsError,
    setPayoutsError,
    payoutSummary,
    setPayoutSummary,
    payoutLifetimeSummary,
    setPayoutLifetimeSummary,
    payoutPagination,
    setPayoutPagination,
    payoutFilters,
    setPayoutFilters,
  };
}
