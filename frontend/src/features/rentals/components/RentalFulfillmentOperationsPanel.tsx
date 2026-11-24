import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ImagePlus, LoaderCircle, PackageCheck, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { RentalEvidenceImage } from './RentalEvidenceImage';
import { RENTAL_FULFILLMENT_STATUS_META } from '../../../utils/bookingStatus';
import './RentalFulfillmentOperationsPanel.css';

type ViewerRole = 'customer' | 'provider' | 'admin';
type RentalItem = {
  _id: string;
  productId?: { name?: string } | string | null;
  inventoryItem?: {
    _id?: string;
    sku?: string;
    status?: string;
    conditionStatus?: string;
    operationalAvailableFrom?: string | null;
  } | null;
  rentalFulfillment?: {
    status?: string;
    pickupDueAt?: string | null;
    returnDueAt?: string | null;
    readyAt?: string | null;
    pickedUpAt?: string | null;
    returnedAt?: string | null;
    completedAt?: string | null;
    issueStatus?: string;
    depositSettlementStatus?: string;
    customerReturnEvidence?: { files?: string[]; returnedAt?: string; note?: string } | null;
    pickupEvidence?: { files?: Array<{ fileId: string }> } | null;
    returnEvidence?: { files?: Array<{ fileId: string }> } | null;
    inventoryStatus?: string;
    charges?: Partial<Record<'lateFee' | 'damageFee' | 'compensationAmount', { amount: number; status: string; reason: string }>>;
  } | null;
};

interface Props {
  bookingId: string;
  item: RentalItem;
  viewerRole: ViewerRole;
  onChanged: () => void;
}

const labelByStatus: Record<string, string> = {
  PENDING: RENTAL_FULFILLMENT_STATUS_META.PENDING.label,
  READY_FOR_PICKUP: RENTAL_FULFILLMENT_STATUS_META.READY_FOR_PICKUP.label,
  PICKED_UP: RENTAL_FULFILLMENT_STATUS_META.PICKED_UP.label,
  CUSTOMER_RETURN_REQUESTED: RENTAL_FULFILLMENT_STATUS_META.CUSTOMER_RETURN_REQUESTED.label,
  RETURNED: RENTAL_FULFILLMENT_STATUS_META.RETURNED.label,
  COMPLETED: RENTAL_FULFILLMENT_STATUS_META.COMPLETED.label,
  CANCELLED: RENTAL_FULFILLMENT_STATUS_META.CANCELLED.label,
};

const formatDateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

export const RentalFulfillmentOperationsPanel = ({ bookingId, item, viewerRole, onChanged }: Props) => {
  const fulfillment = item.rentalFulfillment;
  const [files, setFiles] = useState<File[]>([]);
  const [conditionNote, setConditionNote] = useState('');
  const [busyAction, setBusyAction] = useState<'ready' | 'pickup' | 'return' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentActionType, setIncidentActionType] = useState<'CLEANING' | 'MAINTENANCE' | 'OTHER'>('MAINTENANCE');
  const [incidentAmount, setIncidentAmount] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentFiles, setIncidentFiles] = useState<File[]>([]);
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const isOperator = viewerRole === 'provider' || viewerRole === 'admin';
  const status = fulfillment?.status ?? 'PENDING';
  const hasPickupEvidence = Boolean(fulfillment?.pickupEvidence?.files?.length);
  const productName = typeof item.productId === 'object' ? item.productId?.name : undefined;
  const basePath = `/bookings/${bookingId}/items/${item._id}/rental`;
  const timeline = useMemo(() => [
    { key: 'PENDING', label: 'Chuẩn bị' },
    { key: 'READY_FOR_PICKUP', label: 'Sẵn sàng' },
    { key: 'PICKED_UP', label: 'Đã giao' },
    { key: 'CUSTOMER_RETURN_REQUESTED', label: 'Khách trả' },
    { key: 'RETURNED', label: 'Đã nhận lại' },
    { key: 'COMPLETED', label: 'Hoàn tất' },
  ], []);
  const currentIndex = Math.max(0, timeline.findIndex((step) => step.key === status));

  if (!fulfillment) return null;

  const uploadEvidence = async () => {
    if (!files.length) throw new Error('Cần chọn ít nhất một ảnh tình trạng áo dài.');
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const uploaded = await httpClient.post<{ files: Array<{ fileId: string }> }>(`${basePath}/evidence`, formData);
    return uploaded.files.map((file) => file.fileId);
  };

  const runAction = async (action: 'ready' | 'pickup' | 'return') => {
    setBusyAction(action);
    setMessage(null);
    try {
      if (action === 'ready') {
        await httpClient.post(`${basePath}/ready`, {});
      } else {
        const fileIds = await uploadEvidence();
        await httpClient.post(`${basePath}/${action === 'pickup' ? 'picked-up' : 'returned'}`, {
          fileIds,
          conditionNote: conditionNote.trim() || undefined,
        });
        setFiles([]);
        setConditionNote('');
      }
      onChanged();
    } catch (error: any) {
      setMessage(error?.message || 'Không thể cập nhật bàn giao áo dài.');
    } finally {
      setBusyAction(null);
    }
  };

  const confirmNoIncident = async () => {
    const isConfirmed = window.confirm(
      'Xác nhận trang phục nguyên vẹn, không có hư hỏng hay sự cố phát sinh?\nTiền cọc sẽ được hoàn trả đầy đủ cho khách hàng và trang phục chuyển sang quy trình giặt ủi.'
    );
    if (!isConfirmed) return;

    setReviewing('confirm-no-incident');
    setMessage(null);
    try {
      await httpClient.post(`${basePath}/confirm-no-incident`, {});
      onChanged();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Không thể xác nhận.');
    } finally {
      setReviewing(null);
    }
  };

  const submitIncident = async () => {
    const amount = Number(incidentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Vui lòng nhập số tiền yêu cầu đền bù hợp lệ.');
      return;
    }
    if (!incidentDescription.trim()) {
      setMessage('Vui lòng nhập mô tả sự cố hư hỏng.');
      return;
    }
    if (incidentFiles.length === 0) {
      setMessage('Bắt buộc phải tải lên ít nhất một ảnh bằng chứng hỏng đồ.');
      return;
    }

    setIsSubmittingIncident(true);
    setMessage(null);
    try {
      const formData = new FormData();
      incidentFiles.forEach((f) => formData.append('images', f));
      const uploadRes = await httpClient.post<{ urls: string[] }>('/api/disputes/incidents/evidence', formData);
      const evidencePhotos = uploadRes.urls || [];

      await httpClient.post('/api/disputes/incidents', {
        bookingId,
        bookingItemId: item._id,
        actionType: incidentActionType,
        requestedAmount: amount,
        description: incidentDescription.trim(),
        evidencePhotos,
      });

      setShowIncidentForm(false);
      setIncidentAmount('');
      setIncidentDescription('');
      setIncidentFiles([]);
      onChanged();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Không thể tạo yêu cầu đền bù.');
    } finally {
      setIsSubmittingIncident(false);
    }
  };
  const isSettled = ['FULLY_RELEASED', 'PARTIALLY_DEDUCTED', 'FULLY_DEDUCTED'].includes(fulfillment.depositSettlementStatus || '');
  const [isCleaningCompleting, setIsCleaningCompleting] = useState(false);

  const handleCleaningCompleted = async () => {
    const isConfirmed = window.confirm(
      'Xác nhận đã giặt ủi xong trang phục này sớm hơn dự kiến?\nTrang phục sẽ chuyển sang trạng thái SẴN SÀNG (AVAILABLE) và giải phóng các khung giờ đệm còn lại.'
    );
    if (!isConfirmed) return;

    setIsCleaningCompleting(true);
    setMessage(null);
    try {
      await httpClient.post(`${basePath}/cleaning-completed`, {
        note: 'Hoàn tất giặt ủi sớm từ bảng vận hành',
      });
      onChanged();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Không thể hoàn tất giặt ủi.');
    } finally {
      setIsCleaningCompleting(false);
    }
  };

  const inv = item.inventoryItem;
  const isCleaning =
    inv?.status === 'CLEANING' ||
    fulfillment.inventoryStatus === 'CLEANING' ||
    (status === 'RETURNED' && isSettled);
  const isConditionGood = !['LOCKED', 'RETIRED', 'MAINTENANCE', 'MINOR_DAMAGE'].includes(inv?.conditionStatus || '');
  const isNotMaintenance = inv?.status !== 'MAINTENANCE';
  const hasNoUnresolvedIssue = !fulfillment.issueStatus || fulfillment.issueStatus === 'NONE' || fulfillment.issueStatus === 'RESOLVED';
  const canEarlyClean =
    isOperator &&
    (status === 'RETURNED' || status === 'COMPLETED') &&
    isCleaning &&
    isConditionGood &&
    isNotMaintenance &&
    hasNoUnresolvedIssue;

  return (
    <section className="rental-fulfillment" aria-label={`Vận hành ${productName || 'áo dài'}`}>
      <div className="rental-fulfillment__header">
        <div>
          <div className="rental-fulfillment__eyebrow"><PackageCheck size={16} /> Vận hành từng áo dài</div>
          <strong>{productName || 'Áo dài thuê'}</strong>
        </div>
        <span className={`rental-fulfillment__status rental-fulfillment__status--${status.toLowerCase()}`}>{labelByStatus[status] || status}</span>
      </div>

      <div className="rental-fulfillment__timeline">
        {timeline.map((step, index) => (
          <div key={step.key} className={`rental-fulfillment__step ${index <= currentIndex ? 'is-done' : ''} ${index === currentIndex ? 'is-current' : ''}`}>
            <span>{index + 1}</span><small>{step.label}</small>
          </div>
        ))}
      </div>

      <div className="rental-fulfillment__facts">
        <span><Clock3 size={14} /> Hạn nhận: {formatDateTime(fulfillment.pickupDueAt)}</span>
        <span><RotateCcw size={14} /> Hạn trả: {formatDateTime(fulfillment.returnDueAt)}</span>
      </div>

      {fulfillment.customerReturnEvidence && (
        <div style={{ padding: '12px 14px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', margin: '10px 0' }}>
          <strong style={{ fontSize: '12.5px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PackageCheck size={15} /> Ảnh &amp; ghi chú trả áo từ khách hàng
          </strong>
          {fulfillment.customerReturnEvidence.note && (
            <p style={{ margin: '4px 0 8px 0', fontSize: '12px', color: '#15803D' }}>
              &ldquo;{fulfillment.customerReturnEvidence.note}&rdquo;
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            {fulfillment.customerReturnEvidence.files?.map((url: string, idx: number) => (
              <img
                key={idx}
                src={url}
                alt={`Ảnh trả đồ ${idx + 1}`}
                style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86EFAC' }}
              />
            ))}
          </div>
        </div>
      )}

      {(fulfillment.pickedUpAt || fulfillment.returnedAt) && (
        <div className="rental-fulfillment__evidence-summary">
          {fulfillment.pickedUpAt && <span><ShieldCheck size={14} /> Đã giao lúc {formatDateTime(fulfillment.pickedUpAt)} · {fulfillment.pickupEvidence?.files?.length || 0} ảnh private</span>}
          {fulfillment.returnedAt && <span><ShieldCheck size={14} /> Đã nhận lại lúc {formatDateTime(fulfillment.returnedAt)} · {fulfillment.returnEvidence?.files?.length || 0} ảnh private</span>}
          <div className="rental-fulfillment__evidence-images">
            {fulfillment.pickupEvidence?.files?.map((file, index) => <RentalEvidenceImage key={`pickup-${file.fileId}`} bookingId={bookingId} itemId={item._id} fileId={file.fileId} alt={`Ảnh bàn giao áo dài ${index + 1}`} />)}
            {fulfillment.returnEvidence?.files?.map((file, index) => <RentalEvidenceImage key={`return-${file.fileId}`} bookingId={bookingId} itemId={item._id} fileId={file.fileId} alt={`Ảnh nhận lại áo dài ${index + 1}`} />)}
          </div>
        </div>
      )}

      {isOperator && status === 'PENDING' && (
        <button type="button" className="rental-fulfillment__action" disabled={busyAction !== null} onClick={() => void runAction('ready')}>
          {busyAction === 'ready' ? <LoaderCircle className="is-spinning" size={16} /> : <CheckCircle2 size={16} />} Đánh dấu sẵn sàng nhận áo
        </button>
      )}

      {isOperator && status === 'READY_FOR_PICKUP' && !hasPickupEvidence && (
        <div className="rental-fulfillment__form">
          <label>
            <ImagePlus size={15} /> Ảnh tình trạng áo dài lúc bàn giao <em>*</em>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
          </label>
          {files.length > 0 && <small>Đã chọn {files.length} ảnh. Ảnh chỉ hiển thị cho khách, shop sở hữu item và Admin.</small>}
          <textarea value={conditionNote} onChange={(event) => setConditionNote(event.target.value)} maxLength={2000} placeholder="Ghi chú tình trạng áo dài (không bắt buộc)" />
          <button type="button" className="rental-fulfillment__action" disabled={busyAction !== null} onClick={() => void runAction('pickup')}>
            {busyAction ? <LoaderCircle className="is-spinning" size={16} /> : <PackageCheck size={16} />}
            Gửi ảnh bàn giao – chờ khách xác nhận
          </button>
        </div>
      )}

      {isOperator && status === 'READY_FOR_PICKUP' && hasPickupEvidence && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', color: '#92400E', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock3 size={16} />
          <span>Đã gửi ảnh bàn giao. Đang chờ khách đối soát và xác nhận nhận áo.</span>
        </div>
      )}

      {isOperator && status === 'PICKED_UP' && (
        <div style={{ padding: '12px 16px', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', color: '#0369A1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock3 size={16} />
          <span>Khách đang trải nghiệm trang phục. Chờ khách gửi yêu cầu trả áo kèm hình ảnh bằng chứng.</span>
        </div>
      )}

      {isOperator && status === 'CUSTOMER_RETURN_REQUESTED' && (
        <div className="rental-fulfillment__form" style={{ border: '1.5px solid #FCD34D', backgroundColor: '#FFFDF9' }}>
          <strong style={{ fontSize: '13px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={15} /> Xác nhận thực nhận áo dài từ khách
          </strong>
          <label>
            <ImagePlus size={15} /> Ảnh thực nhận áo dài lúc kiểm đồ <em>*</em>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
          </label>
          {files.length > 0 && <small>Đã chọn {files.length} ảnh. Bắt buộc có ít nhất 1 ảnh thực nhận làm bằng chứng đối soát.</small>}
          <textarea value={conditionNote} onChange={(event) => setConditionNote(event.target.value)} maxLength={2000} placeholder="Ghi chú tình trạng khi nhận lại áo (không bắt buộc)" />
          <button type="button" className="rental-fulfillment__action" disabled={busyAction !== null} onClick={() => void runAction('return')}>
            {busyAction ? <LoaderCircle className="is-spinning" size={16} /> : <RotateCcw size={16} />}
            Xác nhận đã nhận áo &amp; kiểm tra
          </button>
        </div>
      )}

      {viewerRole === 'provider' && status === 'RETURNED' && !isSettled && hasNoUnresolvedIssue && (
        <div className="rental-fulfillment__inspection-actions" style={{ padding: '16px', backgroundColor: '#FDFBF7', border: '1.5px solid #FCD34D', borderRadius: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <strong style={{ fontSize: '13.5px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> Kiểm tra đồ sau khi nhận lại
          </strong>
          <p style={{ margin: 0, fontSize: '12px', color: '#78350F', lineHeight: 1.5 }}>
            Vui lòng kiểm tra kỹ hiện trạng áo dài và phụ kiện đối soát với ảnh bàn giao ban đầu. Chọn một trong 2 hình thức xử lý dưới đây:
          </p>

          {!showIncidentForm ? (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="rental-fulfillment__action"
                disabled={reviewing !== null}
                onClick={() => void confirmNoIncident()}
                style={{ backgroundColor: '#059669', color: '#FFFFFF', flex: 1, minWidth: '180px' }}
              >
                {reviewing === 'confirm-no-incident' ? <LoaderCircle className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}
                ✓ Không có sự cố (Hoàn cọc)
              </button>

              <button
                type="button"
                className="rental-fulfillment__action"
                onClick={() => setShowIncidentForm(true)}
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF', flex: 1, minWidth: '180px' }}
              >
                <AlertTriangle size={16} />
                ⚠️ Yêu cầu đền bù sự cố
              </button>
            </div>
          ) : (
            <div className="rental-fulfillment__form" style={{ marginTop: '8px' }}>
              <strong>Báo cáo sự cố &amp; yêu cầu đền bù (Gửi khách hàng duyệt)</strong>
              <label>
                Loại sự cố:
                <select value={incidentActionType} onChange={(e) => setIncidentActionType(e.target.value as any)}>
                  <option value="MAINTENANCE">Bảo trì / Sửa chữa / Rách vải</option>
                  <option value="CLEANING">Giặt ủi đặc biệt / Tẩy vết bẩn cứng đầu</option>
                  <option value="OTHER">Hư hỏng khác / Mất phụ kiện</option>
                </select>
              </label>

              <label>
                Số tiền yêu cầu đền bù (VNĐ):
                <input
                  type="number"
                  min="1"
                  value={incidentAmount}
                  onChange={(e) => setIncidentAmount(e.target.value)}
                  placeholder="Nhập số tiền khấu trừ từ cọc..."
                />
              </label>

              <label>
                Mô tả chi tiết sự cố:
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Nêu rõ vị trí rách, vết ố, phụ kiện bị thiếu..."
                  rows={2}
                />
              </label>

              <label>
                <ImagePlus size={15} /> Ảnh bằng chứng hỏng đồ (Bắt buộc):
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setIncidentFiles(Array.from(e.target.files || []).slice(0, 5))}
                />
              </label>
              {incidentFiles.length > 0 && <small>Đã chọn {incidentFiles.length} ảnh bằng chứng.</small>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  style={{ backgroundColor: '#7D736B', color: '#FFFFFF' }}
                  className="rental-fulfillment__action"
                  onClick={() => setShowIncidentForm(false)}
                  disabled={isSubmittingIncident}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="rental-fulfillment__action"
                  disabled={isSubmittingIncident}
                  onClick={() => void submitIncident()}
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                >
                  {isSubmittingIncident ? <LoaderCircle className="is-spinning" size={16} /> : <AlertTriangle size={16} />}
                  Gửi yêu cầu đền bù cho khách
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewerRole === 'provider' && status === 'RETURNED' && !isSettled && !hasNoUnresolvedIssue && (
        <div style={{ padding: '14px 16px', backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock3 size={18} color="#D97706" />
          <div style={{ fontSize: '13px', color: '#92400E' }}>
            <strong>Đã gửi yêu cầu đền bù sự cố</strong>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#B45309' }}>
              Đang chờ khách hàng phản hồi (Đồng ý đền bù hoặc Khiếu nại lên Admin).
            </p>
          </div>
        </div>
      )}

      {canEarlyClean && (
        <button
          type="button"
          className="rental-fulfillment__action rental-fulfillment__action--cleaning"
          disabled={isCleaningCompleting}
          onClick={() => void handleCleaningCompleted()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            fontWeight: 700,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: isCleaningCompleting ? 'not-allowed' : 'pointer',
            marginTop: '8px',
          }}
        >
          {isCleaningCompleting ? (
            <LoaderCircle className="is-spinning" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>Hoàn tất giặt ủi – mở lịch sớm</span>
        </button>
      )}
      {message && <p className="rental-fulfillment__error" role="alert">{message}</p>}
      {!isOperator && <p className="rental-fulfillment__notice">Bạn có thể theo dõi tiến trình. Shop chịu trách nhiệm xác nhận giao và nhận lại áo.</p>}
    </section>
  );
};
