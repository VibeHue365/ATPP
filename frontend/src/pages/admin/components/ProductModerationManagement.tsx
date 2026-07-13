import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { API_BASE_URL } from '../../../config/env';

type ModerationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'HIDDEN';

interface ProductItem {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  basePrice: number;
  depositAmount: number;
  status: string;
  moderationStatus: ModerationStatus;
  moderationReason?: string | null;
  updatedAt: string;
  categoryId?: { name?: string };
  providerId?: { businessName?: string; userId?: { profile?: { fullName?: string } } };
}

const labels: Record<ModerationStatus, string> = {
  PENDING_REVIEW: 'Chờ kiểm duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  HIDDEN: 'Đã ẩn',
};

const fallbackImage = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800';
const resolveImageUrl = (url?: string) => !url || url.startsWith('http') ? url || fallbackImage : `${API_BASE_URL}${url}`;

export const ProductModerationManagement: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<ProductItem[]>([]);
  const [status, setStatus] = useState<ModerationStatus>('PENDING_REVIEW');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductItem | null>(null);

  const fetchQueue = async (nextStatus = status) => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpClient.get<ProductItem[]>(`/admin/products/moderation?status=${nextStatus}`);
      setItems(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải hàng đợi kiểm duyệt';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, [status]);

  const moderate = async (item: ProductItem, action: 'APPROVED' | 'REJECTED' | 'HIDDEN') => {
    const requiresReason = action !== 'APPROVED';
    const result = await Swal.fire({
      title: action === 'APPROVED' ? 'Duyệt sản phẩm?' : action === 'REJECTED' ? 'Từ chối sản phẩm?' : 'Ẩn sản phẩm?',
      input: requiresReason ? 'textarea' : undefined,
      inputLabel: requiresReason ? 'Lý do *' : undefined,
      inputPlaceholder: requiresReason ? 'Nhập lý do để nhà cung cấp có thể xử lý...' : undefined,
      showCancelButton: true,
      confirmButtonText: action === 'APPROVED' ? 'Duyệt' : action === 'REJECTED' ? 'Từ chối' : 'Ẩn',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: action === 'APPROVED' ? '#166534' : '#991B1B',
      inputValidator: (value: string) => requiresReason && !value?.trim() ? 'Vui lòng nhập lý do' : undefined,
    });

    if (!result.isConfirmed) return;

    setActionId(item._id);
    try {
      await httpClient.patch(`/admin/products/${item._id}/moderation`, {
        action,
        ...(requiresReason ? { reason: result.value.trim() } : {}),
      });
      toast.success('Đã cập nhật trạng thái kiểm duyệt');
      await fetchQueue();
      if (preview?._id === item._id) setPreview(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể xử lý sản phẩm';
      toast.error(message);
      await fetchQueue();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '12px', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid #E8E2D5' }}>
        <div><h3 style={{ margin: 0, color: '#4A0E17', fontSize: '16px' }}>Hàng đợi sản phẩm</h3><p style={{ margin: '5px 0 0', color: '#7A7A7A', fontSize: '13px' }}>Kiểm tra nội dung và quyết định hiển thị sản phẩm.</p></div>
        <div style={{ display: 'flex', gap: '8px' }}><select aria-label="Lọc trạng thái kiểm duyệt" value={status} onChange={(event) => setStatus(event.target.value as ModerationStatus)} style={{ padding: '9px 12px', border: '1px solid #E8E2D5', borderRadius: '6px', background: 'white', fontWeight: 700 }}>
          {(Object.keys(labels) as ModerationStatus[]).map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select><button onClick={() => void fetchQueue()} disabled={loading} title="Tải lại hàng đợi" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #E8E2D5', borderRadius: '6px', padding: '8px 12px', background: 'white', cursor: 'pointer', fontWeight: 700 }}><RefreshCw size={15} /> Tải lại</button></div>
      </div>

      {error ? (
        <div style={{ padding: '36px', textAlign: 'center', border: '1px solid #FECACA', color: '#991B1B', background: '#FEF2F2', borderRadius: '8px' }}>
          <p>{error}</p><button onClick={() => void fetchQueue()} style={{ border: 'none', background: '#991B1B', color: 'white', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>Thử lại</button>
        </div>
      ) : loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#7A7A7A' }}>Đang tải hàng đợi kiểm duyệt...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#7A7A7A', border: '1px solid #E8E2D5', borderRadius: '8px' }}>Không có sản phẩm nào ở trạng thái này.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '16px' }}>
          {items.map((item) => (
            <article key={item._id} style={{ border: '1px solid #E8E2D5', borderRadius: '8px', background: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '180px', background: '#FAF6F0', position: 'relative' }}><img src={resolveImageUrl(item.images?.[0])} onError={(event) => { event.currentTarget.src = fallbackImage; }} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><span style={{ position: 'absolute', top: '10px', right: '10px', padding: '5px 8px', borderRadius: '4px', color: item.moderationStatus === 'APPROVED' ? '#166534' : item.moderationStatus === 'PENDING_REVIEW' ? '#92400E' : '#991B1B', background: 'white', fontSize: '11px', fontWeight: 800 }}>{labels[item.moderationStatus]}</span></div>
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '9px', flex: 1 }}>
                <strong style={{ color: '#2A2A2A', lineHeight: 1.4 }}>{item.name}</strong>
                <span style={{ fontSize: '12px', color: '#7A7A7A' }}>{item.providerId?.businessName || item.providerId?.userId?.profile?.fullName || 'Nhà cung cấp'} · {item.categoryId?.name || 'Chưa phân loại'}</span>
                <span style={{ fontSize: '12px', color: '#4A0E17', fontWeight: 700 }}>{item.basePrice.toLocaleString('vi-VN')}đ/ngày <span style={{ color: '#7A7A7A', fontWeight: 500 }}>· Cọc {item.depositAmount.toLocaleString('vi-VN')}đ</span></span>
                {item.moderationReason && <span style={{ fontSize: '12px', color: '#991B1B', background: '#FEF2F2', padding: '7px', borderRadius: '4px' }}>Lý do: {item.moderationReason}</span>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button onClick={() => setPreview(item)} title="Xem nội dung" style={{ padding: '7px', border: '1px solid #E8E2D5', borderRadius: '5px', background: 'white', cursor: 'pointer' }}><Eye size={15} /></button>
                  {item.moderationStatus === 'PENDING_REVIEW' && <><button disabled={actionId === item._id} onClick={() => void moderate(item, 'APPROVED')} style={{ flex: 1, border: 'none', borderRadius: '5px', color: 'white', background: '#166534', fontWeight: 700, cursor: 'pointer' }}><Check size={14} /> Duyệt</button><button disabled={actionId === item._id} onClick={() => void moderate(item, 'REJECTED')} style={{ flex: 1, border: 'none', borderRadius: '5px', color: 'white', background: '#991B1B', fontWeight: 700, cursor: 'pointer' }}>Từ chối</button></>}
                  {item.moderationStatus === 'APPROVED' && <button disabled={actionId === item._id} onClick={() => void moderate(item, 'HIDDEN')} style={{ flex: 1, border: 'none', borderRadius: '5px', color: 'white', background: '#991B1B', fontWeight: 700, cursor: 'pointer' }}><EyeOff size={14} /> Ẩn</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'white', borderRadius: '8px', padding: '20px', position: 'relative' }}>
          <button onClick={() => setPreview(null)} title="Đóng" style={{ position: 'absolute', right: '14px', top: '14px', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
          <h3 style={{ marginTop: 0, paddingRight: '30px' }}>{preview.name}</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{preview.description || 'Không có mô tả'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>{preview.images?.map((image) => <img key={image} src={resolveImageUrl(image)} onError={(event) => { event.currentTarget.src = fallbackImage; }} alt="Nội dung sản phẩm" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '5px' }} />)}</div>
        </div>
      </div>}
    </div>
  );
};
