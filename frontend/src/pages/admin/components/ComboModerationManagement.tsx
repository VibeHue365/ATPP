import { useCallback, useEffect, useState } from 'react';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';

type Combo = { _id: string; name: string; status: string; providerId?: { businessName?: string }; productId?: { name?: string }; photographyPackageId?: { name?: string }; comboPrice?: number; discountPercent?: number; createdAt?: string };

export default function ComboModerationManagement() {
  const toast = useToast();
  const [items, setItems] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await httpClient.get<Combo[]>('/combo-promotions/admin/all')); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể tải combo'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  const moderate = async (id: string, status: 'ACTIVE' | 'REJECTED') => {
    try { await httpClient.patch(`/combo-promotions/admin/${id}/moderation`, { status }); toast.success(status === 'ACTIVE' ? 'Đã duyệt combo' : 'Đã từ chối combo'); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể cập nhật combo'); }
  };
  return <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
    <h2 style={{ marginTop: 0 }}>Phê duyệt combo</h2>
    {loading ? <p>Đang tải...</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={{textAlign:'left'}}>Combo</th><th>Provider</th><th>Sản phẩm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {items.map((item) => <tr key={item._id} style={{ borderTop: '1px solid #eee' }}><td style={{padding:12}}><strong>{item.name}</strong><div>Giảm {item.discountPercent || 0}%</div></td><td style={{textAlign:'center'}}>{item.providerId?.businessName || '—'}</td><td style={{textAlign:'center'}}>{item.productId?.name || '—'} + {item.photographyPackageId?.name || '—'}</td><td style={{textAlign:'center'}}>{item.status}</td><td style={{textAlign:'center'}}>{item.status === 'PENDING_REVIEW' && <><button onClick={() => void moderate(item._id, 'ACTIVE')}>Duyệt</button> <button onClick={() => void moderate(item._id, 'REJECTED')}>Từ chối</button></>}</td></tr>)}
      {!items.length && <tr><td colSpan={5} style={{padding:24,textAlign:'center'}}>Chưa có combo.</td></tr>}
    </tbody></table>}
  </section>;
}