import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../config/env';
import { tokenStorage } from '../../../services/tokenStorage';
import type { ProviderDocumentType } from '../../provider-verifications/types';

interface Props {
  verificationId: string;
  documentType: ProviderDocumentType;
  versionNo: number;
  mimeType?: string;
}

export function VerificationDocumentPreview({ verificationId, documentType, versionNo, mimeType }: Props) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const token = tokenStorage.getAccessToken();
        const response = await fetch(
          `${API_BASE_URL}/admin/provider-verifications/${verificationId}/documents/${documentType}/versions/${versionNo}/view`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined, signal: controller.signal },
        );
        if (!response.ok) throw new Error('Không thể tải tài liệu.');
        objectUrl = URL.createObjectURL(await response.blob());
        setSource(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };

    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentType, verificationId, versionNo]);

  if (failed) return <p className="admin-verification-preview__message">Không thể tải tài liệu.</p>;
  if (!source) return <p className="admin-verification-preview__message">Đang tải tài liệu…</p>;
  if (mimeType === 'application/pdf') {
    return <iframe className="admin-verification-preview__frame" src={source} title="Tài liệu đối chiếu" />;
  }
  return <img className="admin-verification-preview__image" src={source} alt="Tài liệu đối chiếu" />;
}