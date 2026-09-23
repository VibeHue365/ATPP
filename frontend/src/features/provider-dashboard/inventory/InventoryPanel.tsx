import { colorLabels, materialLabels } from '../constants';
import type { useProviderInventoryState } from './useProviderInventoryState';

type InventoryPanelProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'inventorySummary' | 'invSummaryPage' | 'invSearch' | 'setInvSearch' | 'invStatusFilter' | 'setInvStatusFilter' | 'invConditionFilter' | 'setInvConditionFilter' | 'invSortBy' | 'setInvSortBy' | 'isLoadingInventory' | 'variantBusy' | 'setVariantEditRow' | 'setVariantEditQty' | 'setInvSummaryPage' | 'inventoryItems' | 'setEditInvItem' | 'setEditInvStatus' | 'setEditInvCondition' | 'setEditInvNotes' | 'setIsEditInventoryOpen' | 'invTotal' | 'invLimit' | 'invPage' | 'setInvPage'
> &
{
  handleRemoveVariant: (row: any) => Promise<void>;
  handleDeleteInventoryItem: (itemId: string) => Promise<void>;
};

export function InventoryPanel({
  inventorySummary, invSummaryPage, invSearch, setInvSearch, invStatusFilter, setInvStatusFilter,
  invConditionFilter, setInvConditionFilter, invSortBy, setInvSortBy, isLoadingInventory, variantBusy,
  setVariantEditRow, setVariantEditQty, handleRemoveVariant, setInvSummaryPage, inventoryItems,
  setEditInvItem, setEditInvStatus, setEditInvCondition, setEditInvNotes, setIsEditInventoryOpen,
  handleDeleteInventoryItem, invTotal, invLimit, invPage, setInvPage,
}: InventoryPanelProps) {

  const invSummaryLimit = 8;
  const invSummaryTotalPages = Math.max(1, Math.ceil(inventorySummary.length / invSummaryLimit));
  const invSummaryCurrent = Math.min(invSummaryPage, invSummaryTotalPages);
  const pagedSummary = inventorySummary.slice((invSummaryCurrent - 1) * invSummaryLimit, invSummaryCurrent * invSummaryLimit);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Search, Filter, Sort Controls */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)' }}>
        {/* Search bar */}
        <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Tìm kiếm hiện vật</label>
          <input
            type="text"
            placeholder="Tìm theo SKU hoặc tên áo dài..."
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Trạng thái hoạt động</label>
          <select
            value={invStatusFilter}
            onChange={(e) => setInvStatusFilter(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="AVAILABLE">Sẵn sàng (Available)</option>
            <option value="RENTED">Đang thuê (Rented)</option>
            <option value="CLEANING">Đang giặt (Cleaning)</option>
            <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
          </select>
        </div>

        {/* Condition Filter */}
        <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Tình trạng chất lượng</label>
          <select
            value={invConditionFilter}
            onChange={(e) => setInvConditionFilter(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="">Tất cả chất lượng</option>
            <option value="NEW">Mới (New)</option>
            <option value="GOOD">Tốt (Good)</option>
            <option value="MINOR_DAMAGE">Hỏng nhẹ</option>
            <option value="LOCKED">Đang khóa (Locked)</option>
            <option value="RETIRED">Đã thanh lý (Retired)</option>
          </select>
        </div>

        {/* Sort */}
        <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Sắp xếp theo</label>
          <select
            value={invSortBy}
            onChange={(e) => setInvSortBy(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="newest">Mới nhất (Nhập sau)</option>
            <option value="oldest">Cũ nhất (Nhập trước)</option>
            <option value="sku_asc">Mã SKU: A - Z</option>
            <option value="sku_desc">Mã SKU: Z - A</option>
          </select>
        </div>
      </div>

      {isLoadingInventory ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          Đang tải dữ liệu kho áo dài...
        </div>
      ) : (
        <>
          {/* 1. SUMMARY VIEW */}
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
              TỒN KHO THEO BIẾN THỂ — TẤT CẢ SẢN PHẨM
            </h3>
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

          {/* 2. DETAIL VIEW */}
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-light-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--color-primary-dark)', margin: '0 0 16px 0', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '8px', textTransform: 'uppercase' }}>
              DANH SÁCH CHI TIẾT HIỆN VẬT ÁO DÀI
            </h3>
            {inventoryItems.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chưa có chiếc áo dài nào trong kho. Tạo áo dài mới ở tab "Sản phẩm", hoặc mở Sửa sản phẩm → bước 2 để nhập thêm hàng.</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>SKU</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TÊN SẢN PHẨM</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>KÍCH CỠ</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>MÀU</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>CHẤT LƯỢNG</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TRẠNG THÁI</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>GHI CHÚ</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item: any) => {
                        const isRetired = item.conditionStatus === 'RETIRED';
                        return (
                          <tr key={item._id} style={{ borderBottom: '1px solid var(--color-light-border)', opacity: isRetired ? 0.6 : 1 }}>
                            <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.sku}</td>
                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>{item.productId?.name || 'Sản phẩm lỗi'}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{item.size}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{item.color}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                backgroundColor: item.conditionStatus === 'NEW' ? '#EEF2F6' : item.conditionStatus === 'GOOD' ? '#F0FDF4' : item.conditionStatus === 'MINOR_DAMAGE' ? '#FFFBEB' : item.conditionStatus === 'LOCKED' ? '#FEF2F2' : '#F4F4F5',
                                color: item.conditionStatus === 'NEW' ? '#475569' : item.conditionStatus === 'GOOD' ? '#166534' : item.conditionStatus === 'MINOR_DAMAGE' ? '#B45309' : item.conditionStatus === 'LOCKED' ? '#991B1B' : '#71717A'
                              }}>
                                {item.conditionStatus === 'NEW' ? 'Mới (New)' : item.conditionStatus === 'GOOD' ? 'Tốt (Good)' : item.conditionStatus === 'MINOR_DAMAGE' ? 'Hỏng nhẹ' : item.conditionStatus === 'LOCKED' ? 'Khóa (Locked)' : 'Thanh lý (Retired)'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                backgroundColor: item.status === 'AVAILABLE' ? '#ECFDF5' : item.status === 'RENTED' ? '#EFF6FF' : '#FFF7ED',
                                color: item.status === 'AVAILABLE' ? '#047857' : item.status === 'RENTED' ? '#1D4ED8' : '#C2410C'
                              }}>
                                {item.status === 'AVAILABLE' ? 'Sẵn sàng' : item.status === 'RENTED' ? 'Đang thuê' : item.status === 'CLEANING' ? 'Đang giặt' : 'Bảo trì'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{item.notes || '—'}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              {!isRetired && (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button
                                    disabled={variantBusy}
                                    onClick={() => {
                                      setEditInvItem(item);
                                      setEditInvStatus(item.status);
                                      setEditInvCondition(item.conditionStatus);
                                      setEditInvNotes(item.notes || '');
                                      setIsEditInventoryOpen(true);
                                    }}
                                    style={{
                                      padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '4px',
                                      backgroundColor: 'white', cursor: variantBusy ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px',
                                      color: 'var(--color-primary)', opacity: variantBusy ? 0.5 : 1
                                    }}
                                  >
                                    Cập nhật
                                  </button>
                                  <button
                                    disabled={variantBusy}
                                    onClick={() => handleDeleteInventoryItem(item._id)}
                                    style={{
                                      padding: '6px 12px', border: 'none', borderRadius: '4px',
                                      backgroundColor: '#FEE2E2', cursor: variantBusy ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px',
                                      color: '#991B1B', opacity: variantBusy ? 0.5 : 1
                                    }}
                                  >
                                    Thanh lý
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Inventory pagination controls */}
                {invTotal > invLimit && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-light-bg)', border: '1px solid var(--color-light-border)', borderRadius: '8px', padding: '14px 20px', marginTop: '16px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Hiển thị {inventoryItems.length} trên tổng số {invTotal} hiện vật
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        disabled={invPage <= 1}
                        onClick={() => setInvPage(p => Math.max(1, p - 1))}
                        style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invPage > 1 ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                      >
                        Trang trước
                      </button>
                      <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: 'white' }}>
                        {invPage} / {Math.ceil(invTotal / invLimit)}
                      </span>
                      <button
                        disabled={invPage >= Math.ceil(invTotal / invLimit)}
                        onClick={() => setInvPage(p => p + 1)}
                        style={{ padding: '6px 10px', border: '1px solid var(--color-light-border)', borderRadius: '4px', background: 'white', cursor: invPage < Math.ceil(invTotal / invLimit) ? 'pointer' : 'not-allowed', color: 'var(--color-text-secondary)' }}
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </>)}
          </div>
        </>
      )}
    </div>
  );

}
