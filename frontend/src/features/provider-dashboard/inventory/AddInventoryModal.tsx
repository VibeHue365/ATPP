import type { FormEvent } from 'react';
import type { useProductWizardState } from '../collections/useProductWizardState';
import { colorLabels, colorsOptions, colorSwatches, materialLabels, materialsOptions, sizesOptions } from '../constants';
import type { useProviderInventoryState } from './useProviderInventoryState';

type AddInventoryModalProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'setIsAddInventoryOpen' | 'addInvProductId' | 'setAddInvProductId' | 'myProductsList' | 'addInvSize' | 'setAddInvSize' | 'addInvColor' | 'setAddInvColor' | 'addInvMaterial' | 'setAddInvMaterial' | 'addInvQuantity' | 'setAddInvQuantity' | 'addInvCondition' | 'setAddInvCondition' | 'addInvNotes' | 'setAddInvNotes'
> &
  Pick<ReturnType<typeof useProductWizardState>,
    'editingProduct'
  > &
{
  handleCreateInventoryItem: (e: FormEvent<Element>) => Promise<void>;
};

export function AddInventoryModal({
  handleCreateInventoryItem, setIsAddInventoryOpen, addInvProductId, setAddInvProductId, editingProduct,
  myProductsList, addInvSize, setAddInvSize, addInvColor, setAddInvColor, addInvMaterial,
  setAddInvMaterial, addInvQuantity, setAddInvQuantity, addInvCondition, setAddInvCondition,
  addInvNotes, setAddInvNotes,
}: AddInventoryModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={handleCreateInventoryItem} style={{ width: '100%', maxWidth: '480px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>NHẬP THÊM HÀNG VÀO KHO</h4>
          <button type="button" onClick={() => setIsAddInventoryOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Chọn sản phẩm */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SẢN PHẨM *</label>
            <select
              value={addInvProductId}
              onChange={(e) => setAddInvProductId(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
              required
            >
              <option value="">-- Chọn áo dài của shop --</option>
              {editingProduct && !myProductsList.some((prod: any) => prod._id === editingProduct._id) && (
                <option value={editingProduct._id}>{editingProduct.name}</option>
              )}
              {myProductsList.map((prod: any) => (
                <option key={prod._id} value={prod._id}>{prod.name}</option>
              ))}
            </select>
          </div>

          {/* Kích cỡ & Màu sắc — chọn nhanh bằng nút, không dùng dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>KÍCH CỠ (SIZE) *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {sizesOptions.map(sz => {
                const isSelected = addInvSize === sz;
                return (
                  <button key={sz} type="button" onClick={() => setAddInvSize(sz)} style={{ padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)', backgroundColor: isSelected ? 'var(--color-primary-trans)' : 'white', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU SẮC *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {colorsOptions.map(c => {
                const isSelected = addInvColor === c;
                return (
                  <button key={c} type="button" onClick={() => setAddInvColor(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)', backgroundColor: isSelected ? 'var(--color-primary-trans)' : 'white', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colorSwatches[c] || '#ccc', border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block' }} />
                    {colorLabels[c] || c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chất liệu (đồng bộ với biến thể sản phẩm) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHẤT LIỆU *</label>
            <select
              value={addInvMaterial}
              onChange={(e) => setAddInvMaterial(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
              required
            >
              <option value="" disabled>— Chọn chất liệu —</option>
              {materialsOptions.map(m => (<option key={m} value={m}>{materialLabels[m] || m}</option>))}
            </select>
          </div>

          {/* Số lượng & Chất lượng ban đầu */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SỐ LƯỢNG NHẬP KHO *</label>
              <input
                type="number"
                value={addInvQuantity}
                onChange={(e) => setAddInvQuantity(Number(e.target.value))}
                min={1}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px' }}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÌNH TRẠNG CHẤT LƯỢNG *</label>
              <select
                value={addInvCondition}
                onChange={(e) => setAddInvCondition(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px', backgroundColor: 'white' }}
                required
              >
                <option value="NEW">Mới (New)</option>
                <option value="GOOD">Tốt (Good)</option>
                <option value="MINOR_DAMAGE">Hỏng nhẹ (Minor Damage)</option>
              </select>
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GHI CHÚ KHO</label>
            <input
              type="text"
              value={addInvNotes}
              onChange={(e) => setAddInvNotes(e.target.value)}
              placeholder="Nhập ghi chú hoặc mã lô hàng..."
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none', fontSize: '13.5px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsAddInventoryOpen(false)}
              style={{ padding: '10px 18px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'white', cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}
            >
              Thêm vào kho
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
