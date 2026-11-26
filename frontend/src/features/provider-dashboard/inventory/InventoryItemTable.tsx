import { colorLabels } from '../constants';
import type { InventoryItem } from './inventoryGrouping';

type InventoryItemTableProps = {
  items: InventoryItem[];
  busy: boolean;
  updatingItemId: string | null;
  /** Rows that can be ticked for the bulk "Sẵn sàng" action; others get an empty cell. */
  canSelect: (item: InventoryItem) => boolean;
  isSelected: (itemId: string) => boolean;
  onToggleSelect: (itemId: string) => void;
  onStatusChange: (item: InventoryItem, newStatus: string) => void;
  onUnlock: (item: InventoryItem) => void;
  onOpenDetail: (item: InventoryItem) => void;
  onRetire: (item: InventoryItem) => void;
};

const th = (align: 'left' | 'center') => ({
  padding: '14px 18px', textAlign: align, fontWeight: 700, color: 'var(--color-text-secondary)',
}) as const;

const productNameOf = (item: InventoryItem) =>
  (item.productId && typeof item.productId === 'object' ? item.productId.name : '') || 'Sản phẩm lỗi';

/** Quality badge of one item (same look as the original table). */
export function InventoryConditionBadge({ item }: { item: InventoryItem }) {
  return (
    <span style={{
      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
      backgroundColor: item.conditionStatus === 'NEW' ? '#EEF2F6' : item.conditionStatus === 'GOOD' ? '#F0FDF4' : item.conditionStatus === 'MINOR_DAMAGE' ? '#FFFBEB' : item.conditionStatus === 'LOCKED' ? '#FEF2F2' : '#F4F4F5',
      color: item.conditionStatus === 'NEW' ? '#475569' : item.conditionStatus === 'GOOD' ? '#166534' : item.conditionStatus === 'MINOR_DAMAGE' ? '#B45309' : item.conditionStatus === 'LOCKED' ? '#991B1B' : '#71717A',
    }}>
      {item.conditionStatus === 'NEW' ? 'Mới (New)' : item.conditionStatus === 'GOOD' ? 'Tốt (Good)' : item.conditionStatus === 'MINOR_DAMAGE' ? 'Hỏng nhẹ' : item.conditionStatus === 'LOCKED' ? 'Khóa (Locked)' : 'Ngừng cho thuê'}
    </span>
  );
}

type InventoryStatusControlProps = {
  item: InventoryItem;
  disabled: boolean;
  isUpdating: boolean;
  onStatusChange: (item: InventoryItem, newStatus: string) => void;
  onUnlock: (item: InventoryItem) => void;
};

/** Status of one item: dropdown for Sẵn sàng / Đang giặt / Bảo trì, badges for rented/locked/retired. */
export function InventoryStatusControl({ item, disabled, isUpdating, onStatusChange, onUnlock }: InventoryStatusControlProps) {
  const isRetired = item.conditionStatus === 'RETIRED';
  const isLocked = item.conditionStatus === 'LOCKED';
  return isRetired ? (
      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#F4F4F5', color: '#71717A' }}>
        Đã ngừng cho thuê
      </span>
    ) : isLocked ? (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }} title="Hiện vật đang bị khóa nghiệp vụ">
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
          Đang khóa
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onUnlock(item)}
          title="Mở khóa hiện vật và đưa chất lượng về Tốt"
          style={{ padding: '5px 8px', border: '1px solid #A7F3D0', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', fontSize: '11px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
        >
          Mở khóa
        </button>
      </div>
    ) : item.status === 'RENTED' ? (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
        Đang thuê
      </div>
    ) : (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
        <select
          aria-label={`Trạng thái ${item.sku}`}
          disabled={disabled}
          value={item.status}
          onChange={(e) => onStatusChange(item, e.target.value)}
          title="Bấm để đổi nhanh trạng thái hiện vật"
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: isUpdating ? 'wait' : 'pointer',
            backgroundColor: item.status === 'AVAILABLE' ? '#ECFDF5' : item.status === 'CLEANING' ? '#FFF7ED' : '#FEF3C7',
            color: item.status === 'AVAILABLE' ? '#047857' : item.status === 'CLEANING' ? '#C2410C' : '#92400E',
            border: item.status === 'AVAILABLE' ? '1px solid #A7F3D0' : item.status === 'CLEANING' ? '1px solid #FED7AA' : '1px solid #FDE68A',
            boxShadow: 'var(--shadow-sm)',
            outline: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <option value="AVAILABLE" style={{ backgroundColor: 'white', color: '#047857', fontWeight: 600 }}>
            Sẵn sàng (Available)
          </option>
          <option value="CLEANING" style={{ backgroundColor: 'white', color: '#C2410C', fontWeight: 600 }}>
            Đang giặt (Cleaning)
          </option>
          <option value="MAINTENANCE" style={{ backgroundColor: 'white', color: '#92400E', fontWeight: 600 }}>
            Bảo trì (Maintenance)
          </option>
        </select>
        {isUpdating && (
          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontStyle: 'italic', fontWeight: 600 }}>
            ...
          </span>
        )}
      </div>
    );
}

/** The original per-item table (same columns and controls), rendered for one page of one variant. */
export function InventoryItemTable({
  items, busy, updatingItemId, canSelect, isSelected, onToggleSelect, onStatusChange, onUnlock, onOpenDetail, onRetire,
}: InventoryItemTableProps) {
  const showSelectColumn = items.some(canSelect);

  return (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-light-border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-light-bg)', borderBottom: '1px solid var(--color-light-border)' }}>
            {showSelectColumn && <th style={{ ...th('center'), width: '36px', padding: '14px 6px 14px 14px' }} aria-label="Chọn" />}
            <th style={th('left')}>SKU</th>
            <th style={th('left')}>TÊN SẢN PHẨM</th>
            <th style={th('center')}>KÍCH CỠ</th>
            <th style={th('center')}>MÀU</th>
            <th style={th('center')}>CHẤT LƯỢNG</th>
            <th style={th('center')}>TRẠNG THÁI</th>
            <th style={th('left')}>GHI CHÚ</th>
            <th style={th('center')}>THAO TÁC</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isRetired = item.conditionStatus === 'RETIRED';
            const isUpdatingThis = updatingItemId === item._id;
            const disabled = busy || isUpdatingThis;

            return (
              <tr key={item._id} className="inv-item-row" style={{ borderBottom: '1px solid var(--color-light-border)', opacity: isRetired ? 0.6 : 1 }}>
                {showSelectColumn && (
                  <td style={{ padding: '14px 6px 14px 14px', textAlign: 'center' }}>
                    {canSelect(item) && (
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${item.sku}`}
                        checked={isSelected(item._id)}
                        onChange={() => onToggleSelect(item._id)}
                      />
                    )}
                  </td>
                )}
                <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.sku}</td>
                <td style={{ padding: '14px 18px', fontWeight: 700 }}>{productNameOf(item)}</td>
                <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 600 }}>{item.size}</td>
                <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 600 }}>{colorLabels[item.color || ''] || item.color}</td>
                <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                  <InventoryConditionBadge item={item} />
                </td>

                {/* CỘT TRẠNG THÁI: DROPDOWN CHỌN TRỰC TIẾP */}
                <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                  <InventoryStatusControl
                    item={item}
                    disabled={disabled}
                    isUpdating={isUpdatingThis}
                    onStatusChange={onStatusChange}
                    onUnlock={onUnlock}
                  />
                </td>

                <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes || ''}>
                  {item.notes || '—'}
                </td>

                {/* CỘT THAO TÁC */}
                <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                  {!isRetired && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        disabled={disabled}
                        onClick={() => onOpenDetail(item)}
                        title="Sửa tình trạng chất lượng và ghi chú hiện vật"
                        style={{
                          padding: '6px 12px', border: '1px solid var(--color-light-border)', borderRadius: '4px',
                          backgroundColor: 'white', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px',
                          color: 'var(--color-primary)', opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        Chi tiết
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => onRetire(item)}
                        title="Ngừng cho thuê áo này"
                        style={{
                          padding: '6px 12px', border: 'none', borderRadius: '4px',
                          backgroundColor: '#FEE2E2', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '11px',
                          color: '#991B1B', opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        Ngừng cho thuê
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
  );
}
