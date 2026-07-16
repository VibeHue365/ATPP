import { useCallback, useEffect, useState } from 'react';
import { adminReportedReviewsApi } from '../api/adminReportedReviewsApi';
import type { ReportedReview } from '../types';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải báo cáo review.';

export function useReportedReviews() {
  const [items, setItems] = useState<ReportedReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await adminReportedReviewsApi.list());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialReviews = async () => {
      try {
        const reviews = await adminReportedReviewsApi.list();
        if (active) setItems(reviews);
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialReviews();
    return () => {
      active = false;
    };
  }, []);

  return { error, items, loading, refresh };
}