import { useMemo, useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Eye,
  Lock,
  X,
} from 'lucide-react';
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

  // CCCD (Customer Identity Card) states
  const [identityCard, setIdentityCard] = useState<{
    hasIdentityCard?: boolean;
    hasFrontImage?: boolean;
    hasBackImage?: boolean;
    idNumberMasked?: string | null;
    idNumber?: string | null;
    fullName?: string | null;
    capturedAt?: string | null;
    capturedBy?: string | null;
    frontUrl?: string | null;
    backUrl?: string | null;
  } | null>(null);
  const [frontCccdFile, setFrontCccdFile] = useState<File | null>(null);
  const [backCccdFile, setBackCccdFile] = useState<File | null>(null);
  const [cccdFullName, setCccdFullName] = useState('');
  const [cccdIdNumber, setCccdIdNumber] = useState('');
  const [isSavingCccd, setIsSavingCccd] = useState(false);
  const [isUploadingCccd, setIsUploadingCccd] = useState(false);
  const [showCccdViewer, setShowCccdViewer] = useState(false);
  const [activeCccdSide, setActiveCccdSide] = useState<'front' | 'back'>('front');
  const [frontBlobUrl, setFrontBlobUrl] = useState<string | null>(null);
  const [backBlobUrl, setBackBlobUrl] = useState<string | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);

  const isOperator = viewerRole === 'provider' || viewerRole === 'admin';
  const status = fulfillment?.status ?? 'PENDING';
  const hasPickupEvidence = Boolean(fulfillment?.pickupEvidence?.files?.length);
  const productName = typeof item.productId === 'object' ? item.productId?.name : undefined;
  const basePath = `/bookings/${bookingId}/items/${item._id}/rental`;

  const loadIdentityCard = async () => {
    try {
      const res: any = await httpClient.get(`/bookings/${bookingId}/customer-identity`);
      setIdentityCard(res);
      if (res?.fullName) setCccdFullName(res.fullName);
      if (res?.idNumber) setCccdIdNumber(res.idNumber);
    } catch {
      // Identity card optional / silent error
    }
  };

  useEffect(() => {
    loadIdentityCard();
  }, [bookingId]);

  useEffect(() => {
    if (!showCccdViewer) return;
    setIsLoadingBlob(true);
    let frontObjUrl: string | null = null;
    let backObjUrl: string | null = null;

    const loadImages = async () => {
      try {
        if (identityCard?.hasFrontImage) {
          const blob = await httpClient.getBlob(`/bookings/${bookingId}/customer-identity/image/front`);
          frontObjUrl = URL.createObjectURL(blob);
          setFrontBlobUrl(frontObjUrl);
        }
        if (identityCard?.hasBackImage) {
          const blob = await httpClient.getBlob(`/bookings/${bookingId}/customer-identity/image/back`);
          backObjUrl = URL.createObjectURL(blob);
          setBackBlobUrl(backObjUrl);
        }
      } catch (err) {
        console.warn('Failed to load CCCD image blob:', err);
      } finally {
        setIsLoadingBlob(false);
      }
    };

    void loadImages();

    return () => {
      if (frontObjUrl) URL.revokeObjectURL(frontObjUrl);
      if (backObjUrl) URL.revokeObjectURL(backObjUrl);
    };
  }, [showCccdViewer, bookingId, identityCard]);

  const handleSaveCccd = async () => {
    if (!frontCccdFile && !backCccdFile) {
      setMessage('Vui lòng chọn ít nhất ảnh mặt trước CCCD.');
      return;
    }
    setIsSavingCccd(true);
    setMessage(null);
    try {
      const formData = new FormData();
      if (frontCccdFile) formData.append('front', frontCccdFile);
      if (backCccdFile) formData.append('back', backCccdFile);
      if (cccdFullName) formData.append('fullName', cccdFullName);
      if (cccdIdNumber) formData.append('idNumber', cccdIdNumber);

      await httpClient.post(`/bookings/${bookingId}/customer-identity`, formData);
      await loadIdentityCard();
      setIsUploadingCccd(false);
      setFrontCccdFile(null);
      setBackCccdFile(null);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || err?.message || 'Không thể lưu CCCD.');
    } finally {
      setIsSavingCccd(false);
    }
  };
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
    if (action === 'pickup' && !identityCard?.hasIdentityCard) {
      setMessage('⚠️ Bắt buộc phải chụp/lưu ảnh CCCD khách thuê (Bước 1) tại quầy trước khi gửi ảnh bàn giao!');
      return;
    }
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
        <div className="rental-fulfillment__form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* PHẦN 1: CCCD KHÁCH THUÊ CHỤP TẠI QUẦY */}
          {identityCard?.hasIdentityCard && !isUploadingCccd ? (
            <div style={{ padding: '14px 16px', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, fontSize: '13px' }}>
                  <ShieldCheck size={18} />
                  <span>Đã có ảnh CCCD khách thuê (Bước 1 hoàn tất)</span>
                </div>
                <span style={{ fontSize: '11px', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  Private Vault
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#166534', lineHeight: 1.6, marginBottom: '10px' }}>
                <div><strong>Họ và tên:</strong> {identityCard.fullName || 'Khách thuê'}</div>
                <div><strong>Số CCCD:</strong> {identityCard.idNumberMasked || '*** (Đã mã hóa)'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCccdViewer(true)}
                  style={{ padding: '6px 12px', background: '#166534', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Eye size={13} /> Xem ảnh CCCD 2 mặt
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadingCccd(true)}
                  style={{ padding: '6px 12px', background: '#FFF', color: '#166534', border: '1px solid #86EFAC', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Camera size={13} /> Chụp lại tại quầy
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#FFFDF7', border: '1.5px dashed #F59E0B', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 700, fontSize: '13.5px', marginBottom: '8px' }}>
                <Camera size={18} />
                <span>Bước 1: Chụp / Tải ảnh CCCD khách tại quầy (Bắt buộc trước khi giao áo)</span>
              </div>
              <p style={{ fontSize: '12px', color: '#78350F', margin: '0 0 12px', lineHeight: 1.5 }}>
                Chụp rõ nét 2 mặt Căn cước công dân của khách tại quầy. Ảnh được lưu trữ bảo mật chỉ phục vụ đối soát giữa Shop, Khách và Ban Quản Trị TàGo theo Nghị định 13/2023/NĐ-CP.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: '#FFF', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                    Mặt trước CCCD *
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setFrontCccdFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '12px', width: '100%' }}
                  />
                  {frontCccdFile && <div style={{ color: '#059669', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>✓ {frontCccdFile.name}</div>}
                </div>
                <div style={{ background: '#FFF', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                    Mặt sau CCCD *
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setBackCccdFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '12px', width: '100%' }}
                  />
                  {backCccdFile && <div style={{ color: '#059669', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>✓ {backCccdFile.name}</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Họ và tên khách (tùy chọn)"
                  value={cccdFullName}
                  onChange={(e) => setCccdFullName(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
                <input
                  type="text"
                  placeholder="Số CCCD (12 số - tùy chọn)"
                  value={cccdIdNumber}
                  onChange={(e) => setCccdIdNumber(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSaveCccd}
                  disabled={isSavingCccd || (!frontCccdFile && !backCccdFile)}
                  style={{
                    padding: '8px 16px',
                    background: '#881337',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: (isSavingCccd || (!frontCccdFile && !backCccdFile)) ? 'not-allowed' : 'pointer',
                    opacity: (isSavingCccd || (!frontCccdFile && !backCccdFile)) ? 0.6 : 1,
                  }}
                >
                  {isSavingCccd ? 'Đang lưu CCCD...' : 'Lưu ảnh CCCD khách tại quầy'}
                </button>
                {identityCard?.hasIdentityCard && (
                  <button
                    type="button"
                    onClick={() => setIsUploadingCccd(false)}
                    style={{ padding: '8px 14px', background: '#E5E7EB', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PHẦN 2: ẢNH HIỆN TRẠNG ÁO DÀI LÚC BÀN GIAO */}
          <div style={{ padding: '14px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
            <label style={{ fontWeight: 700, fontSize: '13px', color: '#1F2937', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <ImagePlus size={16} /> Bước 2: Ảnh tình trạng áo dài lúc bàn giao <em>*</em>
            </label>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
            {files.length > 0 && <div style={{ fontSize: '11px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>✓ Đã chọn {files.length} ảnh bàn giao.</div>}
            <textarea
              value={conditionNote}
              onChange={(event) => setConditionNote(event.target.value)}
              maxLength={2000}
              placeholder="Ghi chú tình trạng áo dài (cổ áo, tà áo, phụ kiện đính kèm...)"
              style={{ marginTop: '10px' }}
            />
          </div>

          <button
            type="button"
            className="rental-fulfillment__action"
            disabled={busyAction !== null || !identityCard?.hasIdentityCard}
            onClick={() => void runAction('pickup')}
            title={!identityCard?.hasIdentityCard ? 'Vui lòng lưu ảnh CCCD khách thuê ở Bước 1 trước' : undefined}
            style={{
              opacity: !identityCard?.hasIdentityCard ? 0.6 : 1,
              cursor: !identityCard?.hasIdentityCard ? 'not-allowed' : 'pointer',
            }}
          >
            {busyAction ? <LoaderCircle className="is-spinning" size={16} /> : <PackageCheck size={16} />}
            Gửi ảnh bàn giao – chờ khách xác nhận
          </button>
        </div>
      )}

      {/* POPUP XEM CCCD 2 MẶT CÓ WATERMARK BẢO MẬT */}
      {showCccdViewer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowCccdViewer(false)}
        >
          <div
            style={{
              background: '#FFF',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} color="#881337" />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1F2937' }}>
                  Căn cước công dân khách thuê
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCccdViewer(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '12.5px', color: '#4B5563', marginBottom: '16px', lineHeight: 1.5, background: '#F9FAFB', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
              <div><strong>Khách hàng:</strong> {identityCard?.fullName || 'Khách thuê'}</div>
              <div><strong>Số CCCD:</strong> {identityCard?.idNumberMasked || '*** (Đã mã hóa)'}</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                🔒 Dữ liệu được mã hóa bảo mật. Chỉ hiển thị cho Shop sở hữu đơn và Quản trị viên TàGo theo Nghị định 13/2023/NĐ-CP.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setActiveCccdSide('front')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  background: activeCccdSide === 'front' ? '#881337' : '#E5E7EB',
                  color: activeCccdSide === 'front' ? '#FFF' : '#374151',
                }}
              >
                Mặt trước
              </button>
              <button
                type="button"
                onClick={() => setActiveCccdSide('back')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  background: activeCccdSide === 'back' ? '#881337' : '#E5E7EB',
                  color: activeCccdSide === 'back' ? '#FFF' : '#374151',
                }}
              >
                Mặt sau
              </button>
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '280px',
                background: '#1F2937',
                borderRadius: '10px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isLoadingBlob ? (
                <div style={{ color: '#9CA3AF', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <LoaderCircle className="is-spinning" size={18} /> Đang tải ảnh bảo mật...
                </div>
              ) : (activeCccdSide === 'front' ? frontBlobUrl : backBlobUrl) ? (
                <>
                  <img
                    src={(activeCccdSide === 'front' ? frontBlobUrl : backBlobUrl) || ''}
                    alt={`CCCD mặt ${activeCccdSide === 'front' ? 'trước' : 'sau'}`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  {/* WATERMARK BẢO VỆ */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      transform: 'rotate(-25deg)',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'rgba(255, 255, 255, 0.45)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      textAlign: 'center',
                      padding: '20px',
                      userSelect: 'none',
                    }}
                  >
                    ĐỐI SOÁT ĐƠN HÀNG #{bookingId.slice(-6).toUpperCase()} - SÀN TÀGO
                  </div>
                </>
              ) : (
                <div style={{ color: '#9CA3AF', fontSize: '13px' }}>
                  Chưa có ảnh mặt {activeCccdSide === 'front' ? 'trước' : 'sau'}
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowCccdViewer(false)}
                style={{ padding: '8px 20px', background: '#374151', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
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
