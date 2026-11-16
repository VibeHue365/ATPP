import { useEffect, useState } from 'react';
import { httpClient } from '../../../services/httpClient';

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
        let blob: Blob | null = null;
        for (let attempt = 0; attempt < 3 && !controller.signal.aborted; attempt += 1) {
          try {
            blob = await httpClient.getBlob(
              `/bookings/${bookingId}/items/${itemId}/rental/evidence/${fileId}`,
              { signal: controller.signal },
            );
            break;
          } catch (error: any) {
            const status = error?.status || error?.response?.status;
            if (status !== 429 || attempt === 2) throw error;
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(resolve, 350 * (attempt + 1));
              controller.signal.addEventListener('abort', () => {
                window.clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              }, { once: true });
            });
          }
        }
        if (!blob) throw new Error('Evidence image unavailable');
        url = URL.createObjectURL(blob);
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
