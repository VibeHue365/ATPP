import type { FormEvent } from 'react';
import type { useProviderInventoryState } from './useProviderInventoryState';

type EditInventoryModalProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'editInvItem' | 'setIsEditInventoryOpen' | 'editInvStatus' | 'setEditInvStatus' | 'editInvCondition' | 'setEditInvCondition' | 'editInvNotes' | 'setEditInvNotes'
> &
{
  handleUpdateInventoryItem: (e: FormEvent<Element>) => Promise<void>;
};

export function EditInventoryModal({
  handleUpdateInventoryItem, editInvItem, setIsEditInventoryOpen, editInvStatus, setEditInvStatus,
  editInvCondition, setEditInvCondition, editInvNotes, setEditInvNotes,
}: EditInventoryModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={handleUpdateInventoryItem} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>CẬP NHẬT HIỆN VẬT: {editInvItem.sku}</h4>
          <button type="button" onClick={() => setIsEditInventoryOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Thông tin cố định */}
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-light-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
            <strong>Sản phẩm:</strong> {editInvItem.productId?.name} <br />
            <strong>Kích cỡ / Màu sắc:</strong> {editInvItem.size} / {editInvItem.color}
          </div>

          {/* Chọn trạng thái (AVAILABLE, CLEANING, MAINTENANCE) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TRẠNG THÁI HOẠT ĐỘNG *</label>
            {editInvItem.status === 'RENTED' ? (
              <div style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: '13.5px', fontWeight: 700 }}>
                ĐANG CHO THUÊ (Hệ thống tự động khóa)
              </div>
            ) : (
              <select
                value={editInvStatus}
                onChange={(e) => setEditInvStatus(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                required
              >
                <option value="AVAILABLE">Sẵn sàng (Available)</option>
                <option value="CLEANING">Đang giặt ủi (Cleaning)</option>
                <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
              </select>
            )}
          </div>

          {/* Chọn chất lượng (NEW, GOOD, MINOR_DAMAGE, LOCKED, RETIRED) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÌNH TRẠNG CHẤT LƯỢNG *</label>
            <select
              value={editInvCondition}
              onChange={(e) => setEditInvCondition(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
              required
            >
              <option value="NEW">Mới (New)</option>
              <option value="GOOD">Tốt (Good)</option>
              <option value="MINOR_DAMAGE">Hỏng nhẹ (Minor Damage)</option>
              <option value="LOCKED">Khóa tạm thời (Locked)</option>
              {/* Cố ý bỏ "Thanh lý" ở đây — thanh lý phải đi qua nút Thanh lý để được kiểm tra lịch thuê */}
            </select>
          </div>

          {/* Ghi chú */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GHI CHÚ CHI TIẾT</label>
            <textarea
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '13.5px', outline: 'none', resize: 'none', height: '60px', fontFamily: 'inherit' }}
              placeholder="Mô tả sự cố hoặc tình trạng hiện tại..."
              value={editInvNotes}
              onChange={(e) => setEditInvNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsEditInventoryOpen(false)}
              style={{ padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
            >
              Lưu thay đổi
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
