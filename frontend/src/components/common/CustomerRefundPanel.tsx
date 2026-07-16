import React, { useEffect, useState } from 'react';
import { CircleDollarSign, Clock3, Send, ShieldCheck } from 'lucide-react';
import { httpClient } from '../../services/httpClient';

type Eligibility = { eligible: boolean; reason?: string | null; capturedAmount?: number; completedRefundAmount?: number; reservedRefundAmount?: number; maximumRefundableAmount?: number; estimatedRefundAmount?: number };
type Refund = { _id: string; bookingId: string | { _id: string }; status: string; amount: number; approvedAmount?: number; processedAmount?: number; reason?: string; adminNotes?: string; failureReason?: string; createdAt: string; updatedAt?: string };

export const CustomerRefundPanel: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const [nextEligibility, mine] = await Promise.all([httpClient.get<Eligibility>(`/refunds/bookings/${bookingId}/eligibility`), httpClient.get<Refund[]>('/refunds/mine')]);
      setEligibility(nextEligibility);
      setRefunds(mine.filter((refund) => (typeof refund.bookingId === 'string' ? refund.bookingId : refund.bookingId?._id) === bookingId));
    } catch (err: any) { setError(err.message || 'Không thể tải thông tin hoàn tiền.'); }
  };
  useEffect(() => { void load(); }, [bookingId]);
  const active = refunds.some((refund) => ['PENDING', 'APPROVED', 'PROCESSING'].includes(refund.status));
  const submit = async () => {
    if (!eligibility?.eligible || !reason.trim() || submitting) return;
    setSubmitting(true); setError(null);
    try {
      await httpClient.post(`/refunds/bookings/${bookingId}`, { amount: eligibility.estimatedRefundAmount, reason: reason.trim() }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setReason(''); await load();
    } catch (err: any) { setError(err.message || 'Không thể gửi yêu cầu hoàn tiền.'); }
    finally { setSubmitting(false); }
  };
  const money = (value?: number) => (value || 0).toLocaleString('vi-VN') + 'đ';
  const label: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', PROCESSING: 'Đang xử lý', COMPLETED: 'Hoàn tiền thành công', REJECTED: 'Đã từ chối', FAILED: 'Xử lý thất bại' };
  return <section style={{ marginTop: 16, border: '1px solid #eadfce', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
    <div style={{ padding: '14px 16px', background: '#fff8ec', display: 'flex', alignItems: 'center', gap: 10 }}><CircleDollarSign size={20} color="#8b5a2b" /><div><strong>Hoàn tiền</strong><div style={{ color: '#715b45', fontSize: 12, marginTop: 2 }}>Theo dõi yêu cầu và kết quả hoàn tiền của đơn hàng</div></div></div>
    <div style={{ padding: 16 }}>{error && <div style={{ color: '#b42318', fontSize: 13, marginBottom: 12 }}>{error}</div>}{!eligibility ? <p style={{ margin: 0, color: '#667085' }}>Đang kiểm tra điều kiện hoàn tiền...</p> : <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}><div><small>Đã thanh toán</small><strong style={{ display: 'block' }}>{money(eligibility.capturedAmount)}</strong></div><div><small>Đã hoàn</small><strong style={{ display: 'block' }}>{money(eligibility.completedRefundAmount)}</strong></div><div><small>Có thể hoàn</small><strong style={{ display: 'block', color: '#087443' }}>{money(eligibility.maximumRefundableAmount)}</strong></div></div>{eligibility.eligible && !active ? <div><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do yêu cầu hoàn tiền" rows={3} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d0d5dd', borderRadius: 6, padding: 10, resize: 'vertical' }} /><button disabled={!reason.trim() || submitting} onClick={() => void submit()} style={{ marginTop: 10, background: '#176b3a', color: '#fff', border: 0, borderRadius: 6, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', opacity: !reason.trim() || submitting ? .6 : 1 }}><Send size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />{submitting ? 'Đang gửi...' : `Yêu cầu hoàn ${money(eligibility.estimatedRefundAmount)}`}</button></div> : <div style={{ color: eligibility.eligible ? '#8b5a2b' : '#667085', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={16} />{active ? 'Yêu cầu hoàn tiền đang được xử lý.' : eligibility.reason}</div>}{refunds.map((refund) => <div key={refund._id} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #eee' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{label[refund.status] || refund.status}</strong><span>{money(refund.processedAmount || refund.approvedAmount || refund.amount)}</span></div><div style={{ color: '#667085', fontSize: 12, marginTop: 5, display: 'flex', gap: 5, alignItems: 'center' }}><Clock3 size={13} />Gửi lúc {new Date(refund.createdAt).toLocaleString('vi-VN')}</div>{(refund.adminNotes || refund.failureReason) && <p style={{ margin: '7px 0 0', fontSize: 13 }}>{refund.failureReason || refund.adminNotes}</p>}</div>)}</>}</div>
  </section>;
};
