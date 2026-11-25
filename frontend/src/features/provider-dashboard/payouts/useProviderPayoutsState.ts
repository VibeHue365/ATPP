
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderPayoutsState() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState<boolean>(false);

  return { payouts, setPayouts, isLoadingPayouts, setIsLoadingPayouts };
}
