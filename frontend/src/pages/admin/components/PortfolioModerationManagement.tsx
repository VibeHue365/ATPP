import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';

type Status = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
interface Item { _id: string; title: string; description?: string; images: string[]; moderationStatus: Status; moderationReason?: string; providerId?: { businessName?: string } }

export const PortfolioModerationManagement: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>('PENDING_REVIEW');
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { setItems(await httpClient.get<Item[]>(`/admin/portfolio-items/moderation?status=${status}`)); } catch (err: any) { toast.error(err.message || 'Khong the tai portfolio moderation'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [status]);
  const action = async (item: Item, next: 'APPROVED' | 'REJECTED' | 'HIDDEN') => {
    const reasonRequired = next !== 'APPROVED';
    const result = await Swal.fire({ title: next === 'APPROVED' ? 'Duyet portfolio?' : next === 'REJECTED' ? 'Tu choi portfolio?' : 'An portfolio?', input: reasonRequired ? 'textarea' : undefined, inputLabel: reasonRequired ? 'Ly do *' : undefined, showCancelButton: true, confirmButtonText: 'Xac nhan', inputValidator: (value: string) => reasonRequired && !value?.trim() ? 'Vui long nhap ly do' : undefined });
    if (!result.isConfirmed) return;
    setActionId(item._id);
    try { await httpClient.patch(`/admin/portfolio-items/${item._id}/moderation`, { action: next, ...(reasonRequired ? { reason: result.value.trim() } : {}) }); toast.success('Da cap nhat portfolio'); await load(); }
    catch (err: any) { toast.error(err.message || 'Khong the xu ly portfolio'); await load(); }
    finally { setActionId(null); }
  };
  return <section style={{ marginTop: '28px' }}><h3 style={{ color: '#4A0E17' }}>PORTFOLIO</h3><select value={status} onChange={(e) => setStatus(e.target.value as Status)}><option value="PENDING_REVIEW">Cho kiem duyet</option><option value="APPROVED">Da duyet</option><option value="REJECTED">Tu choi</option><option value="HIDDEN">Da an</option></select>{loading ? <p>Dang tai...</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px', marginTop: '12px' }}>{items.map((item) => <article key={item._id} style={{ border: '1px solid #E8E2D5', borderRadius: '8px', overflow: 'hidden', background: 'white' }}><img src={item.images[0]} alt={item.title} style={{ width: '100%', height: '150px', objectFit: 'cover' }} /><div style={{ padding: '12px' }}><strong>{item.title}</strong><p style={{ fontSize: '12px' }}>{item.providerId?.businessName || 'Nha cung cap'}</p><p style={{ fontSize: '12px' }}>{item.description || ''}</p>{item.moderationReason && <p style={{ color: '#991B1B', fontSize: '12px' }}>{item.moderationReason}</p>}{item.moderationStatus === 'PENDING_REVIEW' && <><button disabled={actionId === item._id} onClick={() => void action(item, 'APPROVED')}>Duyet</button><button disabled={actionId === item._id} onClick={() => void action(item, 'REJECTED')}>Tu choi</button></>}{item.moderationStatus === 'APPROVED' && <button disabled={actionId === item._id} onClick={() => void action(item, 'HIDDEN')}>An</button>}</div></article>)}</div>}</section>;
};
