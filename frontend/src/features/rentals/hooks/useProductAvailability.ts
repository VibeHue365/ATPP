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
    const controller = new AbortController();
    setState('checking');
    const timer = window.setTimeout(() => {
      const request = async () => {
        try {
          return await checkProductAvailability(input.productId!, input.size!, input.color!, input.rentalFrom!, input.rentalTo!, input.quantity, input.rentalType, input.startTime, input.endTime, controller.signal);
        } catch (error: any) {
          // Do not retry 429s: retrying a rate-limited request compounds the
          // burst. Only transient server failures are retried once.
          if (![500, 502, 503, 504].includes(error?.status) || controller.signal.aborted) throw error;
          await new Promise<void>((resolve, reject) => {
            const retryTimer = window.setTimeout(resolve, 500);
            controller.signal.addEventListener('abort', () => {
              window.clearTimeout(retryTimer);
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
          return checkProductAvailability(input.productId!, input.size!, input.color!, input.rentalFrom!, input.rentalTo!, input.quantity, input.rentalType, input.startTime, input.endTime, controller.signal);
        }
      };
      request()
        .then((next) => { if (active) { setResult(next); setState(next.available ? 'available' : 'unavailable'); } })
        .catch((error: any) => {
          // A request from an older date/variant must never overwrite the
          // current selection. Aborted requests are expected during typing.
          if (!active || controller.signal.aborted || error?.name === 'AbortError') return;
          setResult(null);
          setState('error');
        });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [input.productId, input.size, input.color, input.rentalFrom, input.rentalTo, input.quantity, input.rentalType, input.startTime, input.endTime]);

  return { state, result };
};
