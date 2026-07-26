import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ImagePlus, LoaderCircle, PackageCheck, RotateCcw, ShieldCheck, DollarSign, Wrench } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { RentalEvidenceImage } from './RentalEvidenceImage';
import './RentalFulfillmentOperationsPanel.css';

type ViewerRole = 'customer' | 'provider' | 'admin';
type RentalItem = {
  _id: string;
  productId?: { name?: string } | string | null;
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
  PENDING: 'Chờ shop chuẩn bị',
  READY_FOR_PICKUP: 'Sẵn sàng nhận áo',
  PICKED_UP: 'Khách đang thuê',
  RETURNED: 'Đã nhận lại, chờ tất toán',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
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
  const [chargeType, setChargeType] = useState<'lateFee' | 'damageFee' | 'compensationAmount'>('damageFee');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [settlementDeduct, setSettlementDeduct] = useState('0');
  const [finalInventoryStatus, setFinalInventoryStatus] = useState('AVAILABLE');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const isOperator = viewerRole === 'provider' || viewerRole === 'admin';
  const status = fulfillment?.status ?? 'PENDING';
  const productName = typeof item.productId === 'object' ? item.productId?.name : undefined;
  const basePath = `/bookings/${bookingId}/items/${item._id}/rental`;
  const timeline = useMemo(() => [
    { key: 'PENDING', label: 'Chuẩn bị' },
    { key: 'READY_FOR_PICKUP', label: 'Sẵn sàng' },
    { key: 'PICKED_UP', label: 'Đã giao' },
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

  const proposeCharge = async () => {
    const amount = Number(chargeAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !chargeReason.trim()) {
      setMessage('Nhập số tiền và lý do trước khi đề xuất phí.');
      return;
    }
    setReviewing('propose'); setMessage(null);
    try {
      await httpClient.post(`${basePath}/charges`, { chargeType, amount, reason: chargeReason.trim() });
      setChargeAmount(''); setChargeReason(''); onChanged();
    } catch (error: any) { setMessage(error?.message || 'Không thể đề xuất phí.'); } finally { setReviewing(null); }
  };

  const reviewCharge = async (type: 'lateFee' | 'damageFee' | 'compensationAmount', approved: boolean) => {
    setReviewing(`${type}-${approved}`); setMessage(null);
    try { await httpClient.post(`${basePath}/charges/${type}/review`, { approved }); onChanged(); }
    catch (error: any) { setMessage(error?.message || 'Không thể xử lý đề xuất phí.'); } finally { setReviewing(null); }
  };

  const settleDeposit = async () => {
    const deductAmount = Number(settlementDeduct);
    if (!Number.isFinite(deductAmount) || deductAmount < 0) { setMessage('Số tiền khấu trừ không hợp lệ.'); return; }
    setReviewing('settle'); setMessage(null);
    try { await httpClient.post(`${basePath}/deposit/settle`, { deductAmount, inventoryStatus: finalInventoryStatus }); onChanged(); }
    catch (error: any) { setMessage(error?.message || 'Không thể tất toán cọc.'); } finally { setReviewing(null); }
  };

  const completeRental = async () => {
    setReviewing('complete'); setMessage(null);
    const validStatuses = ['AVAILABLE', 'MAINTENANCE', 'DAMAGED', 'LOST'];
    const targetStatus = fulfillment.inventoryStatus && validStatuses.includes(fulfillment.inventoryStatus)
      ? fulfillment.inventoryStatus
      : 'AVAILABLE';
    try { await httpClient.post(`${basePath}/complete`, { inventoryStatus: targetStatus }); onChanged(); }
    catch (error: any) { setMessage(error?.message || 'Không thể hoàn tất áo dài.'); } finally { setReviewing(null); }
  };
  const canComplete = fulfillment.issueStatus === 'NONE' || fulfillment.issueStatus === 'RESOLVED';
  const isSettled = ['FULLY_RELEASED', 'PARTIALLY_DEDUCTED', 'FULLY_DEDUCTED'].includes(fulfillment.depositSettlementStatus || '');

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

      {isOperator && (status === 'READY_FOR_PICKUP' || status === 'PICKED_UP') && (
        <div className="rental-fulfillment__form">
          <label>
            <ImagePlus size={15} /> Ảnh tình trạng áo dài <em>*</em>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
          </label>
          {files.length > 0 && <small>Đã chọn {files.length} ảnh. Ảnh chỉ hiển thị cho khách, shop sở hữu item và Admin.</small>}
          <textarea value={conditionNote} onChange={(event) => setConditionNote(event.target.value)} maxLength={2000} placeholder="Ghi chú tình trạng áo dài (không bắt buộc)" />
          <button type="button" className="rental-fulfillment__action" disabled={busyAction !== null} onClick={() => void runAction(status === 'READY_FOR_PICKUP' ? 'pickup' : 'return')}>
            {busyAction ? <LoaderCircle className="is-spinning" size={16} /> : status === 'READY_FOR_PICKUP' ? <PackageCheck size={16} /> : <RotateCcw size={16} />}
            {status === 'READY_FOR_PICKUP' ? 'Xác nhận đã giao áo' : 'Xác nhận đã nhận lại áo'}
          </button>
        </div>
      )}

      {viewerRole === 'provider' && status === 'RETURNED' && !isSettled && (
        <div className="rental-fulfillment__form rental-fulfillment__form--fee">
          <strong><DollarSign size={15} /> Đề xuất phí (cần Admin duyệt)</strong>
          <select value={chargeType} onChange={(event) => setChargeType(event.target.value as typeof chargeType)}>
            <option value="damageFee">Phí hư hỏng</option><option value="lateFee">Phí trả trễ</option><option value="compensationAmount">Bồi thường khác</option>
          </select>
          <input type="number" min="1" value={chargeAmount} onChange={(event) => setChargeAmount(event.target.value)} placeholder="Số tiền đề xuất" />
          <textarea value={chargeReason} onChange={(event) => setChargeReason(event.target.value)} maxLength={1000} placeholder="Lý do và tình trạng kiểm tra" />
          <button type="button" className="rental-fulfillment__action" disabled={reviewing !== null} onClick={() => void proposeCharge()}>{reviewing === 'propose' ? <LoaderCircle className="is-spinning" size={16} /> : <DollarSign size={16} />} Gửi Admin duyệt</button>
        </div>
      )}

      {viewerRole === 'admin' && status === 'RETURNED' && !isSettled && (
        <div className="rental-fulfillment__form rental-fulfillment__form--fee">
          <strong><DollarSign size={15} /> Admin: duyệt phí và tất toán cọc</strong>
          {Object.entries(fulfillment.charges || {}).map(([type, charge]) => charge && (
            <div className="rental-fulfillment__charge" key={type}><span><b>{type === 'damageFee' ? 'Hư hỏng' : type === 'lateFee' ? 'Trả trễ' : 'Bồi thường'}:</b> {charge.amount.toLocaleString('vi-VN')}đ — {charge.reason}</span><em>{charge.status}</em>
              {charge.status === 'PROPOSED' && <span className="rental-fulfillment__charge-actions"><button type="button" disabled={reviewing !== null} onClick={() => void reviewCharge(type as any, true)}>Duyệt</button><button type="button" disabled={reviewing !== null} onClick={() => void reviewCharge(type as any, false)}>Từ chối</button></span>}
            </div>
          ))}
          <label>Khấu trừ từ cọc<input type="number" min="0" value={settlementDeduct} onChange={(event) => setSettlementDeduct(event.target.value)} /></label>
          <label><Wrench size={15} /> Tình trạng tồn kho cuối<select value={finalInventoryStatus} onChange={(event) => setFinalInventoryStatus(event.target.value)}><option value="AVAILABLE">Sẵn sàng cho thuê</option><option value="MAINTENANCE">Bảo trì</option><option value="DAMAGED">Hư hỏng</option><option value="LOST">Thất lạc</option></select></label>
          <button type="button" className="rental-fulfillment__action" disabled={reviewing !== null} onClick={() => void settleDeposit()}>{reviewing === 'settle' ? <LoaderCircle className="is-spinning" size={16} /> : <CheckCircle2 size={16} />} Chốt cọc và tồn kho</button>
        </div>
      )}

      {isOperator && status === 'RETURNED' && (
        <p className="rental-fulfillment__notice">
          {canComplete && isSettled ? 'Cọc và tồn kho đã được chốt. Có thể hoàn tất item.' : 'Chờ Admin xử lý tiền cọc và kiểm tra kho trước khi hoàn tất. Không thể bỏ qua bước này.'}
        </p>
      )}
      {isOperator && status === 'RETURNED' && canComplete && isSettled && (
        <button type="button" className="rental-fulfillment__action" disabled={reviewing !== null} onClick={() => void completeRental()}>{reviewing === 'complete' ? <LoaderCircle className="is-spinning" size={16} /> : <CheckCircle2 size={16} />} Hoàn tất áo dài</button>
      )}
      {message && <p className="rental-fulfillment__error" role="alert">{message}</p>}
      {!isOperator && <p className="rental-fulfillment__notice">Bạn có thể theo dõi tiến trình. Shop chịu trách nhiệm xác nhận giao và nhận lại áo.</p>}
    </section>
  );
};