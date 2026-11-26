import { colorLabels, materialLabels } from '../constants';
import type { useProviderInventoryState } from './useProviderInventoryState';

type InventorySummaryTableProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'inventorySummary' | 'invSummaryPage' | 'setInvSummaryPage' | 'variantBusy' | 'setVariantEditRow' | 'setVariantEditQty'
> & {
  handleRemoveVariant: (row: any) => Promise<void>;
};

/** "Tất cả sản phẩm" sub-tab: stock per variant (unchanged from the original combined panel). */
export function InventorySummaryTable({
  inventorySummary, invSummaryPage, setInvSummaryPage, variantBusy, setVariantEditRow, setVariantEditQty,
  handleRemoveVariant,
}: InventorySummaryTableProps) {
  const invSummaryLimit = 8;
  const invSummaryTotalPages = Math.max(1, Math.ceil(inventorySummary.length / invSummaryLimit));
  const invSummaryCurrent = Math.min(invSummaryPage, invSummaryTotalPages);
  const pagedSummary = inventorySummary.slice((invSummaryCurrent - 1) * invSummaryLimit, invSummaryCurrent * invSummaryLimit);

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: 0, textTransform: 'uppercase' }}>
            TỒN KHO THEO BIẾN THỂ — TẤT CẢ SẢN PHẨM
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
            Tổng hợp số lượng hiện vật theo kích cỡ, màu sắc và trạng thái khả dụng.
          </p>
        </div>
      </div>

      {inventorySummary.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chưa có biến thể áo dài nào trong kho.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN SẢN PHẨM</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>KÍCH CỠ</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU SẮC</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHẤT LIỆU</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TỔNG KHO</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>KHẢ DỤNG</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#D97706' }}>ĐÃ ĐẶT TRƯỚC</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>ĐANG THUÊ</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>GIẶT / BẢO TRÌ</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {pagedSummary.map((item, idx) => (
                  <tr key={`${item.productId}-${item.size}-${item.color}-${item.material || ''}-${idx}`} style={{ borderBottom: '1px solid var(--color-light-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.productName}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{item.size}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{colorLabels[item.color] || item.color}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{materialLabels[item.material] || item.material || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                      {item.total > 0 ? item.total : (
                        <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 800, backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                          HẾT HÀNG
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>{item.available}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#D97706' }}>{item.bookedAhead || 0}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>{item.rented}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>{item.maintenance}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          disabled={variantBusy}
                          onClick={() => { setVariantEditRow(item); setVariantEditQty(String(item.total)); }}
                          style={{
                            padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '4px',
                            backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer',
                            fontWeight: 700, fontSize: '11px', color: 'var(--color-primary)', opacity: variantBusy ? 0.5 : 1
                          }}
                        >
                          Sửa số lượng
                        </button>
                        <button
                          disabled={variantBusy}
                          onClick={() => handleRemoveVariant(item)}
                          style={{
                            padding: '6px 12px', border: '1px solid #FECACA', borderRadius: '4px',
                            backgroundColor: '#FEF2F2', cursor: variantBusy ? 'not-allowed' : 'pointer',
                            fontWeight: 700, fontSize: '11px', color: '#DC2626', opacity: variantBusy ? 0.5 : 1
                          }}
                        >
                          Xoá biến thể
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inventorySummary.length > invSummaryLimit && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '14px 20px', marginTop: '16px', fontSize: '13px' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Hiển thị {pagedSummary.length} trên tổng số {inventorySummary.length} biến thể
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  disabled={invSummaryCurrent <= 1}
                  onClick={() => setInvSummaryPage(p => Math.max(1, p - 1))}
                  style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invSummaryCurrent > 1 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                >
                  Trang trước
                </button>
                <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white' }}>
                  {invSummaryCurrent} / {invSummaryTotalPages}
                </span>
                <button
                  disabled={invSummaryCurrent >= invSummaryTotalPages}
                  onClick={() => setInvSummaryPage(p => Math.min(invSummaryTotalPages, p + 1))}
                  style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invSummaryCurrent < invSummaryTotalPages ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
