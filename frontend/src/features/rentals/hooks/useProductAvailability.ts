import { useEffect, useState } from 'react';
import { checkProductAvailability, type ProductAvailabilityResult } from '../services/productAvailabilityService';

export type AvailabilityState = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export interface AvailabilityInput {
  productId?: string;
  size?: string;
  color?: string;
  rentalFrom?: string;
  rentalTo?: string;
  quantity: number;
  rentalType?: 'DAILY' | 'HOURLY';
  startTime?: string;
  endTime?: string;
}

export const useProductAvailability = (input: AvailabilityInput) => {
  const [state, setState] = useState<AvailabilityState>('idle');
  const [result, setResult] = useState<ProductAvailabilityResult | null>(null);

  useEffect(() => {
    const ready = input.productId && input.size && input.color && input.rentalFrom && input.rentalTo && (input.rentalType !== 'HOURLY' || (input.startTime && input.endTime));
    if (!ready) { setState('idle'); setResult(null); return; }
    let active = true;
    setState('checking');
    const timer = window.setTimeout(() => {
      checkProductAvailability(input.productId!, input.size!, input.color!, input.rentalFrom!, input.rentalTo!, input.quantity, input.rentalType, input.startTime, input.endTime)
        .then((next) => { if (active) { setResult(next); setState(next.available ? 'available' : 'unavailable'); } })
        .catch(() => { if (active) { setResult(null); setState('error'); } });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [input.productId, input.size, input.color, input.rentalFrom, input.rentalTo, input.quantity, input.rentalType, input.startTime, input.endTime]);

  return { state, result };
};
