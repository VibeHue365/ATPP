import React, { useCallback, useEffect, useState } from 'react';
import { AdminReloadButton } from './AdminReloadButton';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { Check, X, RefreshCw, Clock, Layers, Camera, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

interface Combo {
  _id: string;
  name: string;
  description?: string;
  status: 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'INACTIVE';
  providerId?: { _id?: string; businessName?: string };
  productId?: { _id?: string; name?: string; images?: string[]; basePrice?: number };
  photographyPackageId?: { _id?: string; name?: string; images?: string[]; price?: number };
  comboPrice?: number;
  discountPercent?: number;
  validFrom?: string;
  validTo?: string;
  maxUsage?: number;
  usedCount?: number;
  createdAt?: string;
}

export const ComboModerationManagement: React.FC = () => {
  const toast = useToast();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED'>('PENDING_REVIEW');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadCombos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await httpClient.get<Combo[]>('/combo-promotions/admin/all');
      setCombos(Array.isArray(res) ? res : []);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải danh sách combo');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadCombos();
  }, [loadCombos]);

  const handleModerate = async (combo: Combo, status: 'ACTIVE' | 'REJECTED') => {
    let reason = '';
    if (status === 'REJECTED') {
      const confirm = await Swal.fire({
        title: 'Từ chối Combo này?',
        text: `Nhập lý do từ chối combo "${combo.name}":`,
        input: 'text',
        inputPlaceholder: 'Lý do từ chối...',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận từ chối',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#EF4444',
      });
      if (!confirm.isConfirmed) return;
      reason = confirm.value || 'Không đủ điều kiện duyệt';
    } else {
      const confirm = await Swal.fire({
        title: 'Phê duyệt Combo',
        text: `Bạn có chắc chắn muốn công khai combo "${combo.name}" lên hệ thống?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Duyệt & Phê duyệt',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#10B981',
      });
      if (!confirm.isConfirmed) return;
    }

    setProcessingId(combo._id);
    try {
      await httpClient.patch(`/combo-promotions/admin/${combo._id}/moderation`, {
        status,
        reason: reason || undefined,
      });
      toast.success(status === 'ACTIVE' ? `Đã duyệt combo "${combo.name}"` : `Đã từ chối combo "${combo.name}"`);
      await loadCombos();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật trạng thái combo');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = combos.filter(c => c.status === 'PENDING_REVIEW').length;
  const activeCount = combos.filter(c => c.status === 'ACTIVE').length;
  const rejectedCount = combos.filter(c => c.status === 'REJECTED').length;

  const filteredCombos = combos.filter(c => {
    if (activeTab === 'ALL') return true;
    return c.status === activeTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Chờ duyệt</span>;
      case 'ACTIVE':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#D1FAE5', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> Đã duyệt</span>;
      case 'REJECTED':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={12} /> Đã từ chối</span>;
      default:
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, backgroundColor: '#F3F4F6', color: '#6B7280' }}>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '24px', fontWeight: 800, color: '#4A0E17', margin: 0 }}>
            Phê duyệt Combo Khuyến Mãi
          </h2>
          <p style={{ fontSize: '13.5px', color: '#7A7A7A', marginTop: '6px', marginBottom: 0 }}>
            Xem xét và phê duyệt các gói combo kết hợp (Thuê Áo dài + Thợ chụp ảnh) từ các nhà cung cấp trước khi hiển thị cho khách hàng.
          </p>
        </div>
        <AdminReloadButton onClick={() => void loadCombos()} isLoading={loading} label="Tải lại dữ liệu" />
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng số Combo</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#4A0E17', marginTop: '4px' }}>{combos.length}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #FEF3C7', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏳ Chờ phê duyệt</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #D1FAE5', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✓ Đã phê duyệt</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{activeCount}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #FEE2E2', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✕ Từ chối</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>{rejectedCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E8E2D5', paddingBottom: '2px' }}>
        {[
          { key: 'PENDING_REVIEW', label: `Chờ duyệt (${pendingCount})` },
          { key: 'ACTIVE', label: `Đã duyệt (${activeCount})` },
          { key: 'REJECTED', label: `Từ chối (${rejectedCount})` },
          { key: 'ALL', label: `Tất cả (${combos.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 18px', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #4A0E17' : '2px solid transparent',
              backgroundColor: 'transparent', fontSize: '13px', fontWeight: 700,
              color: activeTab === tab.key ? '#4A0E17' : '#7A7A7A', cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main List */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A', fontWeight: 600 }}>Đang tải danh sách combo...</div>
        ) : filteredCombos.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#7A7A7A' }}>
            <AlertCircle size={36} style={{ color: '#D1D5DB', marginBottom: '12px' }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>Không tìm thấy combo nào trong danh mục này.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {filteredCombos.map(combo => {
              const origProductPrice = combo.productId?.basePrice || 0;
              const origPackagePrice = combo.photographyPackageId?.price || 0;
              const originalTotal = origProductPrice + origPackagePrice;
              const finalPrice = combo.comboPrice ?? Math.round(originalTotal * (1 - (combo.discountPercent || 0) / 100));

              return (
                <div
                  key={combo._id}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #E8E2D5',
                    borderRadius: '12px', padding: '20px', backgroundColor: '#FAF6F0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ padding: '3px 10px', backgroundColor: '#4A0E17', color: 'white', borderRadius: '6px', fontWeight: 800, fontSize: '12px' }}>
                          -{combo.discountPercent}% OFF
                        </span>
                        <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#4A0E17', margin: 0 }}>{combo.name}</h4>
                        {getStatusBadge(combo.status)}
                      </div>
                      {combo.description && (
                        <p style={{ fontSize: '13px', color: '#7A7A7A', margin: '6px 0 0 0' }}>{combo.description}</p>
                      )}
                      <div style={{ fontSize: '12px', color: '#706E3B', fontWeight: 700, marginTop: '6px' }}>
                        Cung cấp bởi: {combo.providerId?.businessName || 'Nhà cung cấp đối tác'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: '#9CA3AF', textDecoration: 'line-through', fontWeight: 600 }}>
                        {originalTotal.toLocaleString('vi-VN')}đ
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#B91C1C' }}>
                        {finalPrice.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>

                  {/* Products Pair Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'white', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {combo.productId?.images?.[0] ? (
                          <img src={combo.productId.images[0]} alt={combo.productId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Layers size={20} style={{ color: '#4A0E17' }} />
                        )}
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase' }}>Sản phẩm Áo dài</span>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#2A2A2A' }}>{combo.productId?.name || 'Sản phẩm đã xóa'}</div>
                        <div style={{ fontSize: '12px', color: '#706E3B', fontWeight: 600 }}>Giá gốc: {origProductPrice.toLocaleString('vi-VN')}đ</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {combo.photographyPackageId?.images?.[0] ? (
                          <img src={combo.photographyPackageId.images[0]} alt={combo.photographyPackageId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Camera size={20} style={{ color: '#4A0E17' }} />
                        )}
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A7A', textTransform: 'uppercase' }}>Gói chụp ảnh</span>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#2A2A2A' }}>{combo.photographyPackageId?.name || 'Gói chụp đã xóa'}</div>
                        <div style={{ fontSize: '12px', color: '#706E3B', fontWeight: 600 }}>Giá gốc: {origPackagePrice.toLocaleString('vi-VN')}đ</div>
                      </div>
                    </div>
                  </div>

                  {/* Dates & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Thời gian hiệu lực: <strong>{combo.validFrom ? new Date(combo.validFrom).toLocaleDateString('vi-VN') : '—'}</strong> đến <strong>{combo.validTo ? new Date(combo.validTo).toLocaleDateString('vi-VN') : '—'}</strong>
                    </div>

                    {combo.status === 'PENDING_REVIEW' && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          disabled={processingId === combo._id}
                          onClick={() => void handleModerate(combo, 'REJECTED')}
                          style={{
                            padding: '8px 16px', backgroundColor: '#FEE2E2', color: '#DC2626',
                            border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '12.5px',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          <X size={14} /> Từ chối
                        </button>
                        <button
                          type="button"
                          disabled={processingId === combo._id}
                          onClick={() => void handleModerate(combo, 'ACTIVE')}
                          style={{
                            padding: '8px 16px', backgroundColor: '#10B981', color: 'white',
                            border: 'none', borderRadius: '6px', fontSize: '12.5px',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 2px 4px rgba(16,185,129,0.2)',
                          }}
                        >
                          <Check size={14} /> Duyệt Combo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComboModerationManagement;
