import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminReloadButton } from '../../../pages/admin/components/AdminReloadButton';
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

import type { AdminVerificationStatus } from '../types';

type ReviewReason = { value: string; label: string; instruction: string };

const changeReasons: ReviewReason[] = [
  { value: 'identity_front', label: 'CCCD mặt trước không đạt yêu cầu', instruction: 'Vui lòng tải lại CCCD mặt trước rõ nét, đủ 4 góc, không lóa hoặc mờ.' },
  { value: 'identity_back', label: 'CCCD mặt sau không đạt yêu cầu', instruction: 'Vui lòng tải lại CCCD mặt sau rõ nét, đủ 4 góc, không lóa hoặc mờ.' },
  { value: 'identity_mismatch', label: 'Thông tin CCCD cần đối chiếu lại', instruction: 'Vui lòng tải lại cả hai mặt CCCD của cùng một giấy tờ, rõ nét và không bị che khuất.' },
  { value: 'business_profile', label: 'Thông tin hồ sơ kinh doanh cần bổ sung', instruction: 'Vui lòng kiểm tra và cập nhật lại thương hiệu, người đại diện, số điện thoại hoặc địa chỉ.' },
  { value: 'portfolio', label: 'Hồ sơ năng lực/portfolio cần bổ sung', instruction: 'Vui lòng bổ sung hoặc tải lại portfolio để Admin có đủ thông tin đánh giá.' },
  { value: 'other', label: 'Yêu cầu khác', instruction: '' },
];

const rejectReasons: ReviewReason[] = [
  { value: 'identity_invalid', label: 'Giấy tờ định danh không hợp lệ', instruction: 'Giấy tờ không hợp lệ, không thể xác minh hoặc không thuộc người đại diện đã khai báo.' },
  { value: 'identity_inconsistent', label: 'Thông tin định danh không nhất quán', instruction: 'Thông tin trên giấy tờ và hồ sơ đăng ký không đủ điều kiện để xác thực.' },
  { value: 'business_ineligible', label: 'Chưa đáp ứng điều kiện trở thành đối tác', instruction: 'Hồ sơ hoặc năng lực cung cấp dịch vụ hiện chưa đáp ứng điều kiện tham gia nền tảng.' },
  { value: 'misleading_information', label: 'Thông tin khai báo không chính xác', instruction: 'Thông tin trong hồ sơ có dấu hiệu thiếu chính xác hoặc gây nhầm lẫn.' },
  { value: 'policy_violation', label: 'Không phù hợp chính sách nền tảng', instruction: 'Hồ sơ hoặc dịch vụ đăng ký không phù hợp với chính sách hoạt động của VibeHue.' },
  { value: 'other', label: 'Lý do khác', instruction: '' },
];

const changeRequestsFor = (value: string, note?: string): NonNullable<AdminReviewDecisionPayload['changeRequests']> => {
  const mappings: Record<string, { target: 'IDENTITY_CARD_FRONT' | 'IDENTITY_CARD_BACK' | 'BUSINESS_PROFILE' | 'PORTFOLIO' | 'OTHER'; action: 'REUPLOAD' | 'UPDATE_PROFILE' | 'PROVIDE_MORE_INFO'; reasonCode: string }> = {
    identity_front: { target: 'IDENTITY_CARD_FRONT', action: 'REUPLOAD', reasonCode: 'IMAGE_QUALITY' },
    identity_back: { target: 'IDENTITY_CARD_BACK', action: 'REUPLOAD', reasonCode: 'IMAGE_QUALITY' },
    identity_mismatch: { target: 'IDENTITY_CARD_FRONT', action: 'REUPLOAD', reasonCode: 'IDENTITY_MISMATCH' },
    business_profile: { target: 'BUSINESS_PROFILE', action: 'UPDATE_PROFILE', reasonCode: 'PROFILE_INCOMPLETE' },
    portfolio: { target: 'PORTFOLIO', action: 'PROVIDE_MORE_INFO', reasonCode: 'PORTFOLIO_INSUFFICIENT' },
    other: { target: 'OTHER', action: 'PROVIDE_MORE_INFO', reasonCode: 'OTHER' },
  };
  if (value === 'identity_mismatch') {
    return [
      { ...mappings.identity_mismatch, note },
      { target: 'IDENTITY_CARD_BACK', action: 'REUPLOAD', reasonCode: 'IDENTITY_MISMATCH', note },
    ];
  }
  return [{ ...(mappings[value] ?? mappings.other), note }];
};

const statusClass = (status: string) =>
  `admin-verification-status admin-verification-status--${status.toLowerCase()}`;

const verificationStatusLabels: Record<AdminVerificationStatus, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Mới gửi',
  UNDER_REVIEW: 'Đang đánh giá',
  NEEDS_CHANGES: 'Cần bổ sung',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

const ocrStatusLabels: Record<string, string> = {
  NOT_STARTED: 'Chưa chạy OCR',
  OCR_PROCESSING: 'Đang xử lý',
  OCR_PASSED: 'OCR đạt',
  OCR_FAILED: 'OCR thất bại',
  OCR_LOW_CONFIDENCE: 'Độ tin cậy thấp',
  MISMATCH_DETECTED: 'Cần đối chiếu',
  NEEDS_MANUAL_REVIEW: 'Cần kiểm tra thủ công',
};

const ocrStatusLabel = (status?: string) =>
  ocrStatusLabels[status ?? 'NOT_STARTED'] ?? status ?? 'Chưa chạy OCR';

const ocrSupportedTypes = new Set<ProviderDocumentType>([
  'IDENTITY_CARD_FRONT',
  'IDENTITY_CARD_BACK',
  'BUSINESS_LICENSE',
  'TAX_REGISTRATION',
  'PROFESSIONAL_CERTIFICATE',
]);

const ocrNextActionLabel = (action?: string | null) => {
  const labels: Record<string, string> = {
    WAIT_FOR_OCR: 'Đang chờ kết quả OCR',
    UPLOAD_AGAIN: 'Cần tải lại tài liệu',
    READY_TO_SUBMIT: 'Sẵn sàng để duyệt',
    SUBMIT_WITH_MANUAL_REVIEW: 'Cần đối chiếu thủ công',
  };
  return action ? labels[action] ?? action : null;
};

const verificationFilters: Array<{ value: 'ALL' | AdminVerificationStatus; label: string }> = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'SUBMITTED', label: 'Mới gửi' },
  { value: 'UNDER_REVIEW', label: 'Đang đánh giá' },
  { value: 'NEEDS_CHANGES', label: 'Cần bổ sung' },
  { value: 'APPROVED', label: 'Đã phê duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
];

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
          const confidence = typeof version?.ocrConfidence === 'number'
            ? `${Math.round(version.ocrConfidence * 100)}%`
            : null;
          const nextAction = ocrNextActionLabel(version?.ocr?.nextAction);

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
                  {ocrStatusLabel(version?.ocrStatus)}
                </span>
                {confidence && <small className='admin-verification-document__confidence'>Tin cậy: {confidence}</small>}
                {version?.mismatchFlags?.length ? (
                  <small className='admin-verification-document__warning'>
                    {version.mismatchFlags.length} cảnh báo cần đối chiếu
                  </small>
                ) : null}
                {nextAction && <small className='admin-verification-document__next-action'>{nextAction}</small>}
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

  const preferredChangeReason = () => {
    const versionFor = (type: ProviderDocumentType) => currentDocumentVersion(
      (detail.documents ?? []).find((document) => document.documentType === type) ?? { documentType: type, required: true },
    );
    const front = versionFor('IDENTITY_CARD_FRONT');
    const back = versionFor('IDENTITY_CARD_BACK');
    if (front?.ocrStatus === 'OCR_FAILED' || front?.mismatchFlags?.length) return 'identity_front';
    if (back?.ocrStatus === 'OCR_FAILED' || back?.ocrStatus === 'NOT_STARTED') return 'identity_back';
    return 'business_profile';
  };

  const askChangeRequest = async (): Promise<AdminReviewDecisionPayload | null> => {
    const defaultReason = preferredChangeReason();
    const options = changeReasons.map((reason) => `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F1EFEA;cursor:pointer">
        <input class="verification-change-option" type="checkbox" value="${reason.value}" ${reason.value === defaultReason ? 'checked' : ''} style="margin-top:3px" />
        <span><strong style="display:block;color:#2A2A2A">${reason.label}</strong><small style="display:block;margin-top:3px;color:#667085;line-height:1.45">${reason.instruction || 'Nhập nội dung cụ thể ở ô bên dưới.'}</small></span>
      </label>`).join('');
    const result = await Swal.fire({
      title: 'Yêu cầu chỉnh sửa',
      html: `<div style="text-align:left">
        <p style="margin:0 0 12px;color:#667085;font-size:13px;line-height:1.45">Chọn một hoặc nhiều hạng mục cần bổ sung. Đối tác sẽ nhận được hướng dẫn tương ứng.</p>
        <div style="border:1px solid #E8E2D5;border-radius:8px;padding:0 12px;max-height:310px;overflow:auto">${options}</div>
        <div id="verification-change-other-wrap" style="display:none"><label for="verification-change-other" style="display:block;margin:14px 0 6px;font-weight:700">Nội dung yêu cầu khác *</label><textarea id="verification-change-other" class="swal2-textarea" style="display:block;width:100%;margin:0;min-height:84px" placeholder="Mô tả rõ thông tin hoặc tài liệu cần bổ sung..."></textarea></div>
        <label for="verification-change-note" style="display:block;margin:14px 0 6px;font-weight:700">Ghi chú thêm <span style="font-weight:400;color:#667085">(không bắt buộc)</span></label><textarea id="verification-change-note" class="swal2-textarea" style="display:block;width:100%;margin:0;min-height:72px" placeholder="Thêm hướng dẫn nếu cần..."></textarea>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Gửi yêu cầu',
      cancelButtonText: 'Hủy',
      didOpen: () => {
        const toggleOther = () => {
          const checked = (document.querySelector('.verification-change-option[value="other"]') as HTMLInputElement | null)?.checked;
          const wrapper = document.getElementById('verification-change-other-wrap');
          if (wrapper) wrapper.style.display = checked ? 'block' : 'none';
        };
        document.querySelectorAll('.verification-change-option').forEach((option) => option.addEventListener('change', toggleOther));
        toggleOther();
      },
      preConfirm: () => {
        const values = Array.from(document.querySelectorAll('.verification-change-option:checked')).map((option) => (option as HTMLInputElement).value);
        const otherNote = (document.getElementById('verification-change-other') as HTMLTextAreaElement | null)?.value.trim() ?? '';
        const extraNote = (document.getElementById('verification-change-note') as HTMLTextAreaElement | null)?.value.trim() ?? '';
        const selected = changeReasons.filter((reason) => values.includes(reason.value));
        if (!selected.length || (values.includes('other') && !otherNote)) {
          Swal.showValidationMessage(values.includes('other') ? 'Vui lòng mô tả yêu cầu khác.' : 'Vui lòng chọn ít nhất một hạng mục.');
          return false;
        }
        return {
          reason: [...selected.map((reason) => reason.instruction || otherNote), extraNote].filter(Boolean).join('\n\n'),
          note: [...selected.map((reason) => reason.instruction || otherNote), extraNote].filter(Boolean).join('\n\n'),
          changeRequests: values.flatMap((value) => changeRequestsFor(value, value === 'other' ? otherNote : extraNote)),
        } satisfies AdminReviewDecisionPayload;
      },
    });
    return result.isConfirmed && result.value ? result.value : null;
  };

  const askRejectReason = async (): Promise<AdminReviewDecisionPayload | null> => {
    const options = rejectReasons.map((reason) => `<option value="${reason.value}">${reason.label}</option>`).join('');
    const result = await Swal.fire({
      title: 'Từ chối hồ sơ',
      html: `<div style="text-align:left"><label for="verification-reject-reason" style="display:block;margin-bottom:6px;font-weight:700">Lý do từ chối *</label><select id="verification-reject-reason" class="swal2-select" style="display:block;width:100%;margin:0">${options}</select><p id="verification-reject-hint" style="margin:8px 0 0;color:#667085;font-size:13px;line-height:1.45"></p><div id="verification-reject-other-wrap" style="display:none"><label for="verification-reject-other" style="display:block;margin:14px 0 6px;font-weight:700">Mô tả lý do khác *</label><textarea id="verification-reject-other" class="swal2-textarea" style="display:block;width:100%;margin:0;min-height:88px" placeholder="Nêu rõ lý do từ chối để đối tác có thể hiểu và cải thiện..."></textarea></div></div>`,
      showCancelButton: true,
      confirmButtonColor: '#8B1E2D',
      confirmButtonText: 'Từ chối hồ sơ',
      cancelButtonText: 'Hủy',
      didOpen: () => {
        const select = document.getElementById('verification-reject-reason') as HTMLSelectElement | null;
        const updateHint = () => {
          const selected = rejectReasons.find((reason) => reason.value === select?.value);
          const hint = document.getElementById('verification-reject-hint');
          const wrapper = document.getElementById('verification-reject-other-wrap');
          if (hint) hint.textContent = selected?.instruction ?? '';
          if (wrapper) wrapper.style.display = selected?.value === 'other' ? 'block' : 'none';
        };
        select?.addEventListener('change', updateHint);
        updateHint();
      },
      preConfirm: () => {
        const value = (document.getElementById('verification-reject-reason') as HTMLSelectElement | null)?.value;
        const selected = rejectReasons.find((reason) => reason.value === value);
        const otherNote = (document.getElementById('verification-reject-other') as HTMLTextAreaElement | null)?.value.trim() ?? '';
        if (!selected || (selected.value === 'other' && !otherNote)) {
          Swal.showValidationMessage(selected?.value === 'other' ? 'Vui lòng mô tả lý do khác.' : 'Vui lòng chọn lý do từ chối.');
          return false;
        }
        const reason = selected.value === 'other' ? otherNote : `${selected.label}. ${selected.instruction}`;
        return { reason, note: reason } satisfies AdminReviewDecisionPayload;
      },
    });
    return result.isConfirmed && result.value ? result.value : null;
  };

  const handleApprove = async () => {
    const result = await Swal.fire({
      title: 'Phê duyệt hồ sơ đối tác?',
      text: 'Hệ thống sẽ cấp quyền đối tác và tự gửi thông báo phê duyệt.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Phê duyệt hồ sơ',
      cancelButtonText: 'Quay lại',
    });

    if (result.isConfirmed) {
      await execute(() => onApprove(detail.verificationId, {}));
    }
  };
  const isReviewable = detail.status === 'SUBMITTED' || detail.status === 'UNDER_REVIEW';
  const attentionDocumentCount = (detail.documents ?? []).filter((document) => {
    const version = currentDocumentVersion(document);
    return version && ['OCR_FAILED', 'OCR_LOW_CONFIDENCE', 'MISMATCH_DETECTED', 'NEEDS_MANUAL_REVIEW'].includes(version.ocrStatus);
  }).length;
  const missingDocumentLabels = (detail.missingDocuments ?? [])
    .map((documentType) => documentLabels[documentType])
    .join(', ');

  return (
    <aside className="admin-verification-detail" aria-label="Chi tiết hồ sơ đối tác">
      <div className="admin-verification-detail__header">
        <div>
          <div className='admin-verification-detail__title'>
            <h2>{detail.businessProfile.businessName || 'Hồ sơ đối tác'}</h2>
            <span className={statusClass(detail.status)}>{verificationStatusLabels[detail.status]}</span>
          </div>
          <p>{detail.businessProfile.ownerName || 'Chưa có chủ sở hữu'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết hồ sơ">×</button>
      </div>

      <section className='admin-verification-review-summary' aria-label='Tóm tắt hồ sơ'>
        <div>
          <span>Tài liệu cần đối chiếu</span>
          <strong>{attentionDocumentCount}</strong>
        </div>
        <div>
          <span>Tài liệu còn thiếu</span>
          <strong>{detail.missingDocuments?.length ?? 0}</strong>
          {missingDocumentLabels && <small>{missingDocumentLabels}</small>}
        </div>
        <div>
          <span>Lần bổ sung</span>
          <strong>#{detail.verificationRevision ?? 1}</strong>
        </div>
      </section>

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
        {isReviewable && (
          <button type="button" disabled={isSaving} onClick={() => void handleApprove()}>
            Phê duyệt
          </button>
        )}
        {isReviewable && (
          <button type="button" disabled={isSaving} onClick={() => void askChangeRequest().then((payload) => payload && execute(() => onRequestChanges(detail.verificationId, payload)))}>
            Yêu cầu sửa
          </button>
        )}
        {isReviewable && (
          <button className="admin-verification-actions__danger" type="button" disabled={isSaving} onClick={() => void askRejectReason().then((payload) => payload && execute(() => onReject(detail.verificationId, payload)))}>
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

  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminVerificationStatus>('ALL');

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

  const visibleItems = useMemo(
    () => statusFilter === 'ALL'
      ? filteredItems
      : filteredItems.filter((item) => item.status === statusFilter),
    [filteredItems, statusFilter],
  );

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
        <label className='admin-verification-workspace__filter'>
          <span className='sr-only'>Lọc theo trạng thái</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | AdminVerificationStatus)}>
            {verificationFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
          </select>
        </label>
        <AdminReloadButton onClick={() => void refresh()} isLoading={isLoading} />
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
          {visibleItems.map((item) => {
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
                <span className={statusClass(item.status)}>{verificationStatusLabels[item.status]}</span>
              </button>
            );
          })}
          {isLoading && visibleItems.length === 0 && <p className='admin-verification-list__empty'>Đang tải hồ sơ...</p>}
          {!isLoading && visibleItems.length === 0 && <p className="admin-verification-list__empty">Chưa có hồ sơ phù hợp.</p>}
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
