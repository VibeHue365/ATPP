import type { FormEvent } from 'react';
import { variantLabelOf } from './inventoryHelpers';
import type { useProviderInventoryState } from './useProviderInventoryState';

type VariantQuantityModalProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'variantEditRow' | 'variantEditQty' | 'setVariantEditQty' | 'setVariantEditRow' | 'variantBusy'
> &
{
  handleAdjustVariantQuantity: (e: FormEvent<Element>) => Promise<void>;
};

export function VariantQuantityModal({
  handleAdjustVariantQuantity, variantEditRow, variantEditQty, setVariantEditQty, setVariantEditRow,
  variantBusy,
}: VariantQuantityModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <form onSubmit={handleAdjustVariantQuantity} style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-light-border)' }}>
          <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>SỬA SỐ LƯỢNG BIẾN THỂ</h4>
          <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
            {variantEditRow.productName} — <b>{variantLabelOf(variantEditRow)}</b>
          </p>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '12px 16px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hiện có trong kho</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{variantEditRow.total} chiếc</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>ĐỔI THÀNH *</label>
            <input
              type="number"
              min={0}
              max={100}
              value={variantEditQty}
              onChange={(e) => setVariantEditQty(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none' }}
              required
            />
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Tăng lên thì hệ thống nhập thêm hiện vật mới. Giảm xuống thì thanh lý bớt, ưu tiên hàng hỏng và hàng đang bảo trì — chiếc nào đang có lịch thuê sẽ được giữ lại và báo cho bạn.
              {' '}Đặt <b>0</b> nghĩa là <b>hết hàng</b>: khách vẫn thấy biến thể này nhưng không đặt được, sau này nhập thêm là bán lại bình thường.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setVariantEditRow(null)}
              disabled={variantBusy}
              style={{ padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer' }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={variantBusy}
              style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer', opacity: variantBusy ? 0.6 : 1 }}
            >
              {variantBusy ? 'Đang lưu...' : 'Lưu số lượng'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
