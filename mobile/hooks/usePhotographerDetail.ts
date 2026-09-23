import { useCallback, useEffect, useState } from 'react';
import { photographerApi } from '@/apis/photographerApi';
import type { Photographer, PhotographerReview } from '@/types/photographer';
import { getApiErrorMessage } from '@/utils/apiError';

export function usePhotographerDetail(id?: string) {
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [reviews, setReviews] = useState<PhotographerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [detail, reviewList] = await Promise.all([
        photographerApi.detail(id),
        photographerApi.reviews(id).catch(() => []),
      ]);
      setPhotographer(detail);
      setReviews(reviewList ?? []);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể tải thông tin gói chụp'));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  return { photographer, reviews, loading, error, reload: load };
}
