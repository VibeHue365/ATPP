import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../config/env';
import { tokenStorage } from '../../../services/tokenStorage';

interface Props {
  bookingId: string;
  itemId: string;
  fileId: string;
  alt: string;
}

/** Evidence is fetched as an authenticated blob, never rendered from object storage directly. */
export const RentalEvidenceImage = ({ bookingId, itemId, fileId, alt }: Props) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    setObjectUrl(null);
    setFailed(false);
    const load = async () => {
      try {
        const token = tokenStorage.getAccessToken();
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/items/${itemId}/rental/evidence/${fileId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Cannot load rental evidence');
        url = URL.createObjectURL(await response.blob());
        setObjectUrl(url);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void load();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [bookingId, fileId, itemId]);

  if (objectUrl) return <a href={objectUrl} target="_blank" rel="noreferrer"><img className="rental-fulfillment__evidence-image" src={objectUrl} alt={alt} /></a>;
  return <span className="rental-fulfillment__evidence-placeholder">{failed ? 'Không tải được ảnh' : 'Đang tải ảnh…'}</span>;
};