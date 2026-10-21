import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../config/env';
import { tokenStorage } from '../../../services/tokenStorage';

interface Props {
  bookingId: string;
  itemId: string;
  fileId: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  asLink?: boolean;
  onPreview?: (url: string) => void;
}

/** Evidence is fetched as an authenticated blob, never rendered from object storage directly. */
export const RentalEvidenceImage = ({ bookingId, itemId, fileId, alt, style, className, asLink = true, onPreview }: Props) => {
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

  if (objectUrl) {
    const imgEl = (
      <img
        className={className || 'rental-fulfillment__evidence-image'}
        src={objectUrl}
        alt={alt}
        style={style}
      />
    );
    if (onPreview) {
      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onPreview(objectUrl);
          }}
          style={{ width: '100%', height: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Bấm để xem ảnh phóng to"
        >
          {imgEl}
        </div>
      );
    }
    if (!asLink) return imgEl;
    return (
      <a href={objectUrl} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
        {imgEl}
      </a>
    );
  }
  return <span className="rental-fulfillment__evidence-placeholder" style={style}>{failed ? 'Không tải được ảnh' : 'Đang tải ảnh…'}</span>;
};