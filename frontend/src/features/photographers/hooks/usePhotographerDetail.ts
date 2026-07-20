import { useCallback, useEffect, useState } from 'react';
import { photographersApi } from '../api/photographers.api';
import { toPhotographerDetails } from '../mappers/photographer.mapper';
import type { PhotographerDetails } from '../types/photographer.types';

interface UsePhotographerDetailResult {
  photographer: PhotographerDetails | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const usePhotographerDetail = (id?: string): UsePhotographerDetailResult => {
  const [photographer, setPhotographer] = useState<PhotographerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setPhotographer(null);
      setError('Không tìm thấy nhiếp ảnh gia.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await photographersApi.getById(id);
      setPhotographer(toPhotographerDetails(response));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Không thể tải thông tin nhiếp ảnh gia.';
      setError(message);
      setPhotographer(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { photographer, isLoading, error, reload };
};
