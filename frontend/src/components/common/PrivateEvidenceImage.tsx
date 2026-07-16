import { useEffect, useState, type CSSProperties } from 'react';
import { API_BASE_URL } from '../../config/env';
import { tokenStorage } from '../../services/tokenStorage';

interface PrivateEvidenceImageProps {
  reference: string;
  legacyUrl: string;
  alt: string;
  imageStyle?: CSSProperties;
  linkStyle?: CSSProperties;
}

const isPrivateEvidence = (reference: string) =>
  reference.startsWith('private://dispute-evidence-private/');

export function PrivateEvidenceImage({
  reference,
  legacyUrl,
  alt,
  imageStyle,
  linkStyle,
}: PrivateEvidenceImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const privateEvidence = isPrivateEvidence(reference);

  useEffect(() => {
    if (!privateEvidence) return;

    const controller = new AbortController();
    let nextObjectUrl: string | null = null;
    setObjectUrl(null);
    setFailed(false);

    const load = async () => {
      try {
        const token = tokenStorage.getAccessToken();
        const response = await fetch(
          `${API_BASE_URL}/api/disputes/incidents/evidence?ref=${encodeURIComponent(reference)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error('Cannot load private evidence');
        nextObjectUrl = URL.createObjectURL(await response.blob());
        setObjectUrl(nextObjectUrl);
      } catch (error) {
        if (!controller.signal.aborted) setFailed(true);
      }
    };

    void load();
    return () => {
      controller.abort();
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [privateEvidence, reference]);

  const source = privateEvidence ? objectUrl : legacyUrl;
  const openable = Boolean(source && !failed);

  return (
    <a
      href={source || undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (!openable) event.preventDefault();
      }}
      style={linkStyle}
      aria-label={alt}
    >
      {source ? (
        <img src={source} alt={alt} style={imageStyle} />
      ) : (
        <span style={{ ...imageStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#7A7A7A', background: '#F5F5F5' }}>
          {failed ? 'Không thể tải ảnh' : 'Đang tải…'}
        </span>
      )}
    </a>
  );
}