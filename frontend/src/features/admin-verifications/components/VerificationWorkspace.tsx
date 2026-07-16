import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Swal from 'sweetalert2';
import type { ProviderDocumentType } from '../../provider-verifications/types';
import {
  useAdminVerifications,
  type AdminVerificationActionResult,
} from '../hooks/useAdminVerifications';
import {
  currentDocumentVersion,
  documentLabels,
  ocrValue,
  type AdminReviewDecisionPayload,
  type AdminVerificationDetail,
} from '../types';
import { VerificationDocumentPreview } from './VerificationDocumentPreview';
import './verificationWorkspace.css';

const reviewPayload = (reason: string): AdminReviewDecisionPayload => ({ reason, note: reason });

const statusClass = (status: string) =>
  `admin-verification-status admin-verification-status--${status.toLowerCase()}`;

const ocrSupportedTypes = new Set<ProviderDocumentType>([
  'IDENTITY_CARD_FRONT',
  'IDENTITY_CARD_BACK',
  'BUSINESS_LICENSE',
  'TAX_REGISTRATION',
  'PROFESSIONAL_CERTIFICATE',
]);

type VerificationAction = (id: string) => Promise<AdminVerificationActionResult>;
type VerificationReviewAction = (
  id: string,
  payload: AdminReviewDecisionPayload,
) => Promise<AdminVerificationActionResult>;
type OcrAction = (
  id: string,
  type: ProviderDocumentType,
) => Promise<AdminVerificationActionResult>;

function VerificationDocuments({ detail, disabled, onRunOcr }: {
  detail: AdminVerificationDetail;
  disabled: boolean;
  onRunOcr: OcrAction;
}) {
  const [preview, setPreview] = useState<{
    type: ProviderDocumentType;
    versionNo: number;
    mimeType?: string;
  } | null>(null);

  return (
    <section className="admin-verification-documents">
      <h3>Tài liệu & kết quả OCR</h3>
      <div className="admin-verification-document-list">
        {(detail.documents ?? []).map((document) => {
          const version = currentDocumentVersion(document);
          const idNumber = ocrValue(version?.extractedFields?.idNumberMasked);
          const canRunOcr = ocrSupportedTypes.has(document.documentType);
          const canRetryOcr = version?.ocrStatus === 'NOT_STARTED' || version?.ocrStatus === 'OCR_FAILED';

          return (
            <article className="admin-verification-document" key={document.documentType}>
              <button
                className="admin-verification-document__select"
                type="button"
                disabled={!version}
                onClick={() => {
                  if (!version) return;
                  setPreview({
                    type: document.documentType,
                    versionNo: version.versionNo,
                    mimeType: version.mimeType,
                  });
                }}
              >
                <strong>{documentLabels[document.documentType]}</strong>
                <span>
                  {idNumber
                    ? `Số CCCD: ${idNumber}`
                    : version?.originalFileName ?? 'Chưa có tệp tải lên'}
                </span>
              </button>
              <div className="admin-verification-document__meta">
                <span className={statusClass(version?.ocrStatus ?? 'NOT_STARTED')}>
                  {version?.ocrStatus ?? 'NOT_STARTED'}
                </span>
                {canRunOcr && version && canRetryOcr && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onRunOcr(detail.verificationId, document.documentType)}
                  >
                    Chạy OCR
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {preview && (
        <div className="admin-verification-preview">
          <VerificationDocumentPreview
            key={`${preview.type}-${preview.versionNo}`}
            verificationId={detail.verificationId}
            documentType={preview.type}
            versionNo={preview.versionNo}
            mimeType={preview.mimeType}
          />
        </div>
      )}
    </section>
  );
}

function VerificationDetail({
  detail,
  isSaving,
  onApprove,
  onClose,
  onReject,
  onRequestChanges,
  onRunOcr,
  onStartReview,
}: {
  detail: AdminVerificationDetail;
  isSaving: boolean;
  onApprove: VerificationReviewAction;
  onClose: () => void;
  onReject: VerificationReviewAction;
  onRequestChanges: VerificationReviewAction;
  onRunOcr: OcrAction;
  onStartReview: VerificationAction;
}) {
  const [actionError, setActionError] = useState<string | null>(null);

  const execute = async (action: () => Promise<AdminVerificationActionResult>) => {
    setActionError(null);
    const result = await action();
    if (!result.ok) setActionError(result.message);
  };

  const askReason = async (title: string, fallback: string) => {
    const result = await Swal.fire({
      title,
      input: 'textarea',
      inputLabel: 'Lý do / nội dung phản hồi',
      inputValue: fallback,
      inputValidator: (value) => value.trim() ? undefined : 'Vui lòng nhập nội dung phản hồi.',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy',
    });

    return result.isConfirmed ? result.value.trim() : null;
  };

  const handleReviewAction = async (
    title: string,
    fallback: string,
    action: VerificationReviewAction,
  ) => {
    const reason = await askReason(title, fallback);
    if (reason) await execute(() => action(detail.verificationId, reviewPayload(reason)));
  };

  const isFinal = detail.status === 'APPROVED' || detail.status === 'REJECTED';

  return (
    <aside className="admin-verification-detail" aria-label="Chi tiết hồ sơ đối tác">
      <div className="admin-verification-detail__header">
        <div>
          <h2>{detail.businessProfile.businessName || 'Hồ sơ đối tác'}</h2>
          <p>{detail.businessProfile.ownerName || 'Chưa có chủ sở hữu'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết hồ sơ">×</button>
      </div>

      <dl className="admin-verification-detail__info">
        <div><dt>Email</dt><dd>{detail.businessProfile.email || '—'}</dd></div>
        <div><dt>Điện thoại</dt><dd>{detail.businessProfile.phone || '—'}</dd></div>
        <div><dt>Địa chỉ</dt><dd>{[detail.businessProfile.address, detail.businessProfile.province].filter(Boolean).join(', ') || '—'}</dd></div>
      </dl>

      {actionError && <p className="admin-verification-error" role="alert">{actionError}</p>}

      <VerificationDocuments detail={detail} disabled={isSaving} onRunOcr={onRunOcr} />

      <div className="admin-verification-actions">
        {detail.status === 'SUBMITTED' && (
          <button type="button" disabled={isSaving} onClick={() => void execute(() => onStartReview(detail.verificationId))}>
            Bắt đầu đánh giá
          </button>
        )}
        {!isFinal && (
          <button type="button" disabled={isSaving} onClick={() => void handleReviewAction('Phê duyệt hồ sơ', 'Hồ sơ hợp lệ.', onApprove)}>
            Phê duyệt
          </button>
        )}
        {!isFinal && (
          <button type="button" disabled={isSaving} onClick={() => void handleReviewAction('Yêu cầu chỉnh sửa', 'Vui lòng bổ sung thông tin.', onRequestChanges)}>
            Yêu cầu sửa
          </button>
        )}
        {!isFinal && (
          <button className="admin-verification-actions__danger" type="button" disabled={isSaving} onClick={() => void handleReviewAction('Từ chối hồ sơ', 'Hồ sơ không đạt yêu cầu.', onReject)}>
            Từ chối
          </button>
        )}
      </div>
    </aside>
  );
}

export function VerificationWorkspace() {
  const {
    approve,
    error,
    isLoading,
    isSaving,
    items,
    open,
    refresh,
    reject,
    requestChanges,
    runOcr,
    selected,
    setSelected,
    startReview,
  } = useAdminVerifications();
  const [query, setQuery] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    if (!normalizedQuery) return items;

    return items.filter((item) =>
      [item.businessProfile.businessName, item.businessProfile.ownerName, item.status]
        .some((value) => value?.toLocaleLowerCase('vi-VN').includes(normalizedQuery)),
    );
  }, [items, query]);

  return (
    <section className="admin-verification-workspace">
      <div className="admin-verification-workspace__controls">
        <label className="admin-verification-workspace__search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Tìm kiếm hồ sơ</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên thương hiệu, chủ sở hữu hoặc trạng thái…"
          />
        </label>
        <button type="button" onClick={() => void refresh()} disabled={isLoading}>Tải lại</button>
      </div>

      {error && <p className="admin-verification-error" role="alert">{error}</p>}

      <div className={`admin-verification-workspace__content ${selected ? 'has-detail' : ''}`}>
        <section className="admin-verification-list" aria-busy={isLoading}>
          <header className="admin-verification-list__header">
            <h2>Danh sách hồ sơ đăng ký chờ duyệt</h2>
          </header>
          <div className="admin-verification-list__labels" aria-hidden="true">
            <span>Tên đối tác</span><span>Dịch vụ đăng ký</span><span>Ngày gửi</span><span>Trạng thái</span>
          </div>
          {filteredItems.map((item) => {
            const isSelected = selected?.verificationId === item.verificationId;
            return (
              <button
                className={`admin-verification-list__item ${isSelected ? 'is-selected' : ''}`}
                key={item.verificationId}
                type="button"
                onClick={() => void open(item.verificationId)}
              >
                <span>
                  <strong>{item.businessProfile.businessName || 'Chưa đặt tên thương hiệu'}</strong>
                  <small>{item.businessProfile.phone || '—'} • {item.businessProfile.email || '—'}</small>
                </span>
                <span className="admin-verification-list__capabilities">
                  {(item.requestedCapabilities ?? []).map((capability) => <i key={capability}>{capability === 'PHOTOGRAPHY' ? 'CHỤP ẢNH' : capability === 'AODAI_RENTAL' ? 'CHO THUÊ' : capability}</i>)}
                </span>
                <span className="admin-verification-list__date">{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                <span className={statusClass(item.status)}>{item.status}</span>
              </button>
            );
          })}
          {!isLoading && filteredItems.length === 0 && <p className="admin-verification-list__empty">Chưa có hồ sơ phù hợp.</p>}
        </section>

        {selected && (
          <VerificationDetail
            key={selected.verificationId}
            detail={selected}
            isSaving={isSaving}
            onApprove={approve}
            onClose={() => setSelected(null)}
            onReject={reject}
            onRequestChanges={requestChanges}
            onRunOcr={runOcr}
            onStartReview={startReview}
          />
        )}
      </div>
    </section>
  );
}