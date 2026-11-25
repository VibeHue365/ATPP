import { payoutsApi } from '../api/providerDashboardApi';
import type { useProviderPayoutsState } from './useProviderPayoutsState';

type Dependencies = Pick<ReturnType<typeof useProviderPayoutsState>,
  'setPayouts' | 'setIsLoadingPayouts'
>;

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createPayoutActions({ setPayouts, setIsLoadingPayouts }: Dependencies) {
  const fetchWalletData = async () => {
    try {
      await payoutsApi.getWallet();
    } catch (err: any) {
      console.error('Không thể tải thông tin ví:', err);
    }
  };

  const fetchPayouts = async () => {
    setIsLoadingPayouts(true);
    try {
      let data: any[] = [];
      try {
        const res: any = await payoutsApi.listSettlements();
        if (res && Array.isArray(res.items)) {
          data = res.items;
        } else if (Array.isArray(res)) {
          data = res;
        }
      } catch (_e) {
        const res: any = await payoutsApi.listLegacyTransfers();
        if (Array.isArray(res)) data = res;
      }
      setPayouts(data);
      fetchWalletData();
    } catch (err: any) {
      console.error('Không thể tải lịch sử quyết toán:', err);
    } finally {
      setIsLoadingPayouts(false);
    }
  };

  return { fetchPayouts };
}
