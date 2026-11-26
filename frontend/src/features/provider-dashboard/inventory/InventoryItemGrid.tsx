import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  categoryOf, ITEM_CATEGORIES, skuShortOf, type InventoryGroup, type InventoryItem, type ItemCategory,
} from './inventoryGrouping';
import { InventoryConditionBadge, InventoryStatusControl } from './InventoryItemTable';

type InventoryItemGridProps = {
  group: InventoryGroup;
  busy: boolean;
  updatingItemId: string | null;
  selectMode: boolean;
  canSelect: (item: InventoryItem) => boolean;
  isSelected: (itemId: string) => boolean;
  onToggleSelect: (itemId: string) => void;
  onSetSelected: (itemIds: string[], checked: boolean) => void;
  onStatusChange: (item: InventoryItem, newStatus: string) => void;
  onUnlock: (item: InventoryItem) => void;
  onOpenDetail: (item: InventoryItem) => void;
  onRetire: (item: InventoryItem) => void;
};

const bySku = (a: InventoryItem, b: InventoryItem) =>
  String(a.sku || '').localeCompare(String(b.sku || ''), undefined, { numeric: true });

const labelOf = (category: ItemCategory) => ITEM_CATEGORIES.find((c) => c.key === category)?.label || category;

/** Seat-map view of one variant: one coloured square per physical áo dài. */
export function InventoryItemGrid({
  group, busy, updatingItemId, selectMode, canSelect, isSelected, onToggleSelect, onSetSelected,
  onStatusChange, onUnlock, onOpenDetail, onRetire,
}: InventoryItemGridProps) {
  const [highlight, setHighlight] = useState<ItemCategory | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const items = useMemo(() => [...group.items].sort(bySku), [group.items]);
  const counts = useMemo(() => {
    const result = new Map<ItemCategory, InventoryItem[]>();
    for (const item of items) {
      const key = categoryOf(item);
      result.set(key, [...(result.get(key) || []), item]);
    }
    return result;
  }, [items]);

  const activeItem = selectMode ? undefined : items.find((item) => item._id === activeId);

  const onLegendClick = (category: ItemCategory) => {
    const members = counts.get(category) || [];
    const selectable = members.filter(canSelect);
    if (selectMode && selectable.length > 0) {
      const allSelected = selectable.every((item) => isSelected(item._id));
      onSetSelected(selectable.map((item) => item._id), !allSelected);
      return;
    }
    setHighlight((prev) => (prev === category ? null : category));
  };

  const onSeatClick = (item: InventoryItem) => {
    if (selectMode) {
      if (canSelect(item)) onToggleSelect(item._id);
      return;
    }
    setActiveId((prev) => (prev === item._id ? null : item._id));
  };

  return (
    <div className="inv-map-wrap">
      <div className="inv-legend" aria-label="Chú thích trạng thái">
        {ITEM_CATEGORIES.filter((category) => counts.has(category.key)).map((category) => (
          <button
            key={category.key}
            type="button"
            className={`inv-legend-chip is-${category.key}${highlight === category.key ? ' is-on' : ''}`}
            aria-pressed={highlight === category.key}
            title={selectMode ? 'Chọn / bỏ chọn tất cả ô màu này' : 'Làm nổi bật các ô màu này'}
            onClick={() => onLegendClick(category.key)}
          >
            <i aria-hidden="true" />
            {category.label} <strong>{counts.get(category.key)?.length}</strong>
          </button>
        ))}
        {selectMode && (
          <span className="inv-legend-hint">Bấm vào ô màu cam / vàng (đang giặt, bảo trì) để chọn.</span>
        )}
      </div>

      <div className={`inv-map${selectMode ? ' is-selecting' : ''}`} role="group" aria-label="Sơ đồ hiện vật">
        {items.map((item) => {
          const category = categoryOf(item);
          const selectable = canSelect(item);
          const selected = selectMode && isSelected(item._id);
          const dimmed = (highlight && highlight !== category) || (selectMode && !selectable);
          const classes = [
            'inv-seat',
            `is-${category}`,
            dimmed ? 'is-dimmed' : '',
            selected ? 'is-selected' : '',
            activeItem?._id === item._id ? 'is-active' : '',
            updatingItemId === item._id ? 'is-updating' : '',
            item.conditionStatus === 'MINOR_DAMAGE' ? 'is-damaged' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={item._id}
              type="button"
              className={classes}
              title={`${item.sku} — ${labelOf(category)}${item.conditionStatus === 'MINOR_DAMAGE' ? ' (hỏng nhẹ)' : ''}`}
              aria-label={`${item.sku} — ${labelOf(category)}`}
              aria-pressed={selectMode ? selected : activeItem?._id === item._id}
              onClick={() => onSeatClick(item)}
            >
              {skuShortOf(item)}
            </button>
          );
        })}
      </div>

      {activeItem && (
        <div className="inv-seat-panel" role="region" aria-label={`Hiện vật ${activeItem.sku}`}>
          <div className="inv-seat-panel-main">
            <strong className="inv-seat-panel-sku">{activeItem.sku}</strong>
            <InventoryConditionBadge item={activeItem} />
            <InventoryStatusControl
              item={activeItem}
              disabled={busy || updatingItemId === activeItem._id}
              isUpdating={updatingItemId === activeItem._id}
              onStatusChange={onStatusChange}
              onUnlock={onUnlock}
            />
            {activeItem.conditionStatus !== 'RETIRED' && (
              <span className="inv-seat-panel-actions">
                <button type="button" className="inv-btn" disabled={busy} onClick={() => onOpenDetail(activeItem)}>
                  Chi tiết
                </button>
                <button type="button" className="inv-btn inv-btn-danger" disabled={busy} onClick={() => onRetire(activeItem)}>
                  Ngừng cho thuê
                </button>
              </span>
            )}
            <button type="button" className="inv-seat-panel-close" aria-label="Đóng" onClick={() => setActiveId(null)}>
              <X size={16} />
            </button>
          </div>
          <p className="inv-seat-panel-note">
            <span>Ghi chú:</span> {activeItem.notes || '—'}
          </p>
        </div>
      )}
    </div>
  );
}
