import { useState } from 'react';
import Swal from 'sweetalert2';
import { PrivateEvidenceImage } from '../../../components/common/PrivateEvidenceImage';
import { API_BASE_URL } from '../../../config/env';
import { adminDisputesApi } from '../api/adminDisputesApi';
import { useDisputes } from '../hooks/useDisputes';
import type { Dispute, DisputeDecision, ResolvePayload } from '../types';
import './disputesPanel.css';

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

const decisionLabels: Record<DisputeDecision, string> = {
  SHOP_RIGHT: 'Đối tác đúng',
  CUSTOMER_RIGHT: 'Khách hàng đúng',
  SPLIT: 'Chia trách nhiệm',
};

const getDepositTotal = (dispute: Dispute) => dispute.bookingId?.pricingSummary?.depositTotal ?? 0;

const evidenceUrl = (reference: string) =>
  reference.startsWith('http://') || reference.startsWith('https://')
    ? reference
    : `${API_BASE_URL}${reference}`;

export function DisputesPanel() {
  const { error, items, loading, refresh, setError } = useDisputes();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<DisputeDecision>('SHOP_RIGHT');
  const [refundAmount, setRefundAmount] = useState(0);
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);

  const selectDispute = (dispute: Dispute) => {
    setSelected(dispute);
    setError(null);
    setNotes('');
    setDecision('SHOP_RIGHT');
    setRefundAmount(0);
    setCompensationAmount(0);
  };

  const resolve = async () => {
    if (!selected?.bookingId?._id) {
      setError('Không xác định được booking để xử lý.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setError('Vui lòng nhập ghi chú quyết định.');
      return;
    }

    const depositTotal = getDepositTotal(selected);
    const splitTotal = refundAmount + compensationAmount;
    const hasValidSplit =
      Number.isInteger(refundAmount)
      && Number.isInteger(compensationAmount)
      && refundAmount >= 0
      && compensationAmount >= 0
      && splitTotal <= depositTotal;

    if (decision === 'SPLIT' && !hasValidSplit) {
      setError('Khoản hoàn và bồi thường phải là số nguyên không âm; tổng không được vượt tiền cọc.');
      return;
    }

    const payload: ResolvePayload = {
      decision,
      notes: trimmedNotes,
      ...(decision === 'SPLIT' ? { refundAmount, compensationAmount } : {}),
    };

    const result = await Swal.fire({
      title: 'Xác nhận phán quyết?',
      text: decision === 'SPLIT'
        ? `${decisionLabels[decision]}. Hoàn khách ${formatCurrency(refundAmount)}, bồi thường đối tác ${formatCurrency(compensationAmount)}.`
        : `${decisionLabels[decision]}. Hệ thống sẽ tính khoản hoàn/bồi thường theo chính sách.` ,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận xử lý',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    setIsResolving(true);
    setError(null);
    try {
      await adminDisputesApi.resolve(selected.bookingId._id, payload);
      setSelected(null);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể xử lý tranh chấp.');
    } finally {
      setIsResolving(false);
    }
  };

  const depositTotal = selected ? getDepositTotal(selected) : 0;

  return (
    <section className="admin-disputes">
      <div className="admin-disputes__toolbar"><button type="button" onClick={() => void refresh()} disabled={loading}>Tải lại</button></div>

      {error && <p className="admin-disputes__error" role="alert">{error}</p>}

      <div className="admin-disputes__grid">
        <div className="admin-disputes__list" aria-busy={loading}><header><h3>Danh sách tranh chấp cần xử lý</h3></header>
          {items.map((item) => (
            <button
              key={item._id}
              type="button"
              className={selected?._id === item._id ? 'is-active' : ''}
              onClick={() => selectDispute(item)}
            >
              <strong>{item.bookingId?.bookingCode ?? 'N/A'}</strong>
              <span>{item.productId?.name ?? item.bookingItemId?.name ?? 'Sản phẩm'}</span>
              <small>Yêu cầu: {formatCurrency(item.requestedAmount)}</small>
            </button>
          ))}
          {!loading && !items.length && <p>Không có tranh chấp cần xử lý.</p>}
        </div>

        {selected && (
          <aside className="admin-disputes__detail">
            <div>
              <h3>{selected.bookingId?.bookingCode ?? 'Tranh chấp'}</h3>
              <p>{selected.description || 'Không có mô tả bổ sung.'}</p>
            </div>
            <dl className="admin-disputes__summary">
              <div><dt>Đối tác báo cáo</dt><dd>{selected.reportedBy?.businessName || selected.reportedBy?.profile?.fullName || 'Đối tác'}</dd></div>
              <div><dt>Khách hàng</dt><dd>{selected.bookingId?.customerId?.profile?.fullName || 'Khách hàng'}</dd></div>
              <div><dt>Sản phẩm</dt><dd>{selected.productId?.name || selected.bookingItemId?.name || 'Sản phẩm'}</dd></div>
              <div><dt>Tiền cọc</dt><dd>{formatCurrency(depositTotal)}</dd></div>
              <div><dt>Khoản yêu cầu</dt><dd>{formatCurrency(selected.requestedAmount)}</dd></div>
            </dl>

            {selected.evidencePhotos?.length ? (
              <section className='admin-disputes__evidence' aria-label='Bằng chứng sự cố'>
                <h4>Bằng chứng sự cố</h4>
                <div>
                  {selected.evidencePhotos.map((reference, index) => (
                    <PrivateEvidenceImage
                      key={reference}
                      reference={reference}
                      legacyUrl={evidenceUrl(reference)}
                      alt={`Bằng chứng ${index + 1}`}
                      linkStyle={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e8e2d5' }}
                      imageStyle={{ width: '72px', height: '72px', objectFit: 'cover' }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <label>
              Quyết định
              <select value={decision} onChange={(event) => setDecision(event.target.value as DisputeDecision)}>
                {Object.entries(decisionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            {decision === 'SPLIT' && (
              <div className="admin-disputes__split">
                <label>
                  Hoàn khách
                  <input type="number" min="0" step="1" value={refundAmount} onChange={(event) => setRefundAmount(Number(event.target.value))} />
                </label>
                <label>
                  Bồi thường đối tác
                  <input type="number" min="0" step="1" value={compensationAmount} onChange={(event) => setCompensationAmount(Number(event.target.value))} />
                </label>
                <small>Tổng: {formatCurrency(refundAmount + compensationAmount)} / {formatCurrency(depositTotal)}</small>
              </div>
            )}

            <label>
              Ghi chú quyết định
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Nêu căn cứ và quyết định xử lý" />
            </label>

            <button type="button" disabled={isResolving} onClick={() => void resolve()}>
              {isResolving ? 'Đang xử lý…' : 'Xác nhận xử lý'}
            </button>
          </aside>
        )}
      </div>
    </section>
  );
}
