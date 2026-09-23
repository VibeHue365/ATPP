import { useCallback, useEffect, useRef, useState } from 'react';
import { adminReportedReviewsApi } from '../api/adminReportedReviewsApi';
import type { ReportedReview, ReportMetrics } from '../types';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải báo cáo review.';

export function useReportedReviews() {
  const requestId = useRef(0);
  const [items, setItems] = useState<ReportedReview[]>([]);
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const res = await adminReportedReviewsApi.list();
      if (currentRequestId === requestId.current) {
        if (Array.isArray(res)) {
          setItems(res);
        } else if (res && typeof res === 'object') {
          const payload = res as any;
          setItems(Array.isArray(payload.reviews) ? payload.reviews : []);
          if (payload.metrics) setMetrics(payload.metrics);
        }
      }
    } catch (requestError) {
      if (currentRequestId === requestId.current) setError(getErrorMessage(requestError));
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, items, metrics, loading, refresh };
}
