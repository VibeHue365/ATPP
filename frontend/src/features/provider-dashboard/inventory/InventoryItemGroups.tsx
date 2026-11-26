import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { colorLabels, materialLabels } from '../constants';
import {
  groupInventoryItems, hasActiveFilter, ITEM_CATEGORIES, needsAction, NEED_ACTION_FILTER, type InventoryGroup, type InventoryItem,
} from './inventoryGrouping';
import { InventoryItemGrid } from './InventoryItemGrid';
import { InventoryItemTable } from './InventoryItemTable';
import type { useProviderInventoryState } from './useProviderInventoryState';
import './inventoryItemGroups.css';

type InventoryItemGroupsProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'inventoryItems' | 'invTotal' | 'invSearch' | 'setInvSearch' | 'invStatusFilter' | 'setInvStatusFilter' |
  'invConditionFilter' | 'setInvConditionFilter' | 'invSortBy' | 'setInvSortBy' | 'invPage' | 'setInvPage' |
  'variantBusy' | 'setEditInvItem' | 'setEditInvStatus' | 'setEditInvCondition' | 'setEditInvNotes' | 'setIsEditInventoryOpen'
> & {
  handleDeleteInventoryItem: (itemId: string) => Promise<void>;
  handleQuickUpdateStatus?: (itemId: string, newStatus: string, currentCondition?: string, currentNotes?: string) => Promise<void>;
  handleBulkMarkAvailable?: (items: InventoryItem[]) => Promise<void>;
};

/** Variants per page in the "Sản phẩm chi tiết" list. */
const GROUPS_PER_PAGE = 5;

/** Items per page inside one opened variant. */
const ITEMS_PER_PAGE = 10;

const groupTitleOf = (group: InventoryGroup) =>
  [
    group.productName,
    group.size,
    colorLabels[group.color] || group.color,
    group.material ? materialLabels[group.material] || group.material : '',
  ].filter(Boolean).join(' · ');

/** "Sản phẩm chi tiết" sub-tab: every physical áo dài, grouped by variant. */
export function InventoryItemGroups({
  inventoryItems, invTotal, invSearch, setInvSearch, invStatusFilter, setInvStatusFilter,
  invConditionFilter, setInvConditionFilter, invSortBy, setInvSortBy, invPage, setInvPage,
  variantBusy, setEditInvItem, setEditInvStatus, setEditInvCondition, setEditInvNotes, setIsEditInventoryOpen,
  handleDeleteInventoryItem, handleQuickUpdateStatus, handleBulkMarkAvailable,
}: InventoryItemGroupsProps) {
  // Groups opened by hand when no search/status filter is active.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // While searching or filtering by status every matching group starts open; this tracks the ones closed by hand.
  const [filterCollapsed, setFilterCollapsed] = useState<{ key: string; groups: Set<string> }>(() => ({ key: '', groups: new Set() }));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Page shown inside each opened variant; resets to page 1 whenever the filters change.
  // Each opened variant shows the seat map by default; "Bảng" switches it to the original table.
  const [tableViews, setTableViews] = useState<Set<string>>(() => new Set());
  // Variants where the seat map is in "Chọn nhiều" (multi-select) mode.
  const [selectModes, setSelectModes] = useState<Set<string>>(() => new Set());
  const [groupPages, setGroupPages] = useState<{ key: string; pages: Record<string, number> }>(() => ({ key: '', pages: {} }));

  const items = inventoryItems as InventoryItem[];
  const filters = useMemo(
    () => ({ search: invSearch, status: invStatusFilter, condition: invConditionFilter, sortBy: invSortBy }),
    [invSearch, invStatusFilter, invConditionFilter, invSortBy],
  );
  const groups = useMemo(() => groupInventoryItems(items, filters), [items, filters]);

  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, invPage), totalPages);
  const pagedGroups = groups.slice((currentPage - 1) * GROUPS_PER_PAGE, currentPage * GROUPS_PER_PAGE);

  // Searching or filtering by status opens every matching variant so results are visible at once.
  const autoExpandKey = invSearch.trim() || invStatusFilter ? `${invSearch.trim()}|${invStatusFilter}` : '';
  const isGroupOpen = (groupKey: string) =>
    autoExpandKey
      ? !(filterCollapsed.key === autoExpandKey && filterCollapsed.groups.has(groupKey))
      : expanded.has(groupKey);

  const filtersKey = `${invSearch.trim()}|${invStatusFilter}|${invConditionFilter}|${invSortBy}`;
  const groupPageOf = (groupKey: string) => (groupPages.key === filtersKey ? groupPages.pages[groupKey] : undefined) || 1;
  const setGroupPage = (groupKey: string, page: number) =>
    setGroupPages((prev) => ({
      key: filtersKey,
      pages: { ...(prev.key === filtersKey ? prev.pages : {}), [groupKey]: page },
    }));

  // Only rows that still need washing/maintenance can stay selected after a refresh.
  const selectedItems = useMemo(
    () => (items || []).filter((item) => selected.has(item._id) && needsAction(item)),
    [items, selected],
  );

  const resetPage = () => setInvPage(1);

  const toggleKey = (prev: Set<string>, key: string) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const toggleGroup = (key: string) => {
    if (autoExpandKey) {
      setFilterCollapsed((prev) => ({
        key: autoExpandKey,
        groups: toggleKey(prev.key === autoExpandKey ? prev.groups : new Set(), key),
      }));
    } else {
      setExpanded((prev) => toggleKey(prev, key));
    }
  };

  const toggleSelected = (itemId: string) => setSelected((prev) => toggleKey(prev, itemId));

  const setSelectedIds = (itemIds: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      itemIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });

  const canSelectItem = (item: InventoryItem) => Boolean(handleBulkMarkAvailable) && needsAction(item);

  const setGroupSelection = (group: InventoryGroup, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      group.items.filter(needsAction).forEach((item) => (checked ? next.add(item._id) : next.delete(item._id)));
      return next;
    });

  const changeStatus = async (item: InventoryItem, newStatus: string) => {
    if (!handleQuickUpdateStatus || item.status === newStatus || updatingItemId) return;
    try {
      setUpdatingItemId(item._id);
      await handleQuickUpdateStatus(item._id, newStatus, item.conditionStatus, item.notes);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    } catch {
      // Toast notification is already handled in handleQuickUpdateStatus
    } finally {
      setUpdatingItemId(null);
    }
  };

  const unlockItem = async (item: InventoryItem) => {
    if (!handleQuickUpdateStatus || updatingItemId) return;
    try {
      setUpdatingItemId(item._id);
      // Keep the operational status and restore GOOD quality; clear the old LOCKED_UNTIL note.
      await handleQuickUpdateStatus(item._id, item.status || 'AVAILABLE', 'GOOD', '');
    } catch {
      // Toast notification is already handled by handleQuickUpdateStatus
    } finally {
      setUpdatingItemId(null);
    }
  };

  const openDetail = (item: InventoryItem) => {
    setEditInvItem(item);
    setEditInvStatus(item.status || 'AVAILABLE');
    setEditInvCondition(item.conditionStatus || 'GOOD');
    setEditInvNotes(item.notes || '');
    setIsEditInventoryOpen(true);
  };

  const retireItem = (item: InventoryItem) => {
    void handleDeleteInventoryItem(item._id);
  };

  const markSelectedAvailable = async () => {
    if (!handleBulkMarkAvailable || selectedItems.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await handleBulkMarkAvailable(selectedItems);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  const busy = variantBusy || bulkBusy;
  const filtering = hasActiveFilter(filters);

  return (
    <div className="inv-detail">
      <div className="inv-detail-head">
        <h3>DANH SÁCH CHI TIẾT HIỆN VẬT ÁO DÀI</h3>
        <p>
          Hiện vật được gom theo biến thể. Bấm vào một biến thể để xem sơ đồ từng chiếc theo màu trạng thái; bấm vào một ô để đổi trạng thái hoặc xem chi tiết.
        </p>
      </div>

      <div className="inv-filters">
        <label className="inv-filter inv-filter-search">
          <span>Tìm kiếm hiện vật</span>
          <input
            type="text"
            placeholder="Tìm theo SKU hoặc tên áo dài..."
            value={invSearch}
            onChange={(e) => { setInvSearch(e.target.value); resetPage(); }}
          />
        </label>
        <label className="inv-filter">
          <span>Trạng thái hoạt động</span>
          <select value={invStatusFilter} onChange={(e) => { setInvStatusFilter(e.target.value); resetPage(); }}>
            <option value="">Tất cả trạng thái</option>
            <option value={NEED_ACTION_FILTER}>Cần xử lý (Giặt + Bảo trì)</option>
            <option value="AVAILABLE">Sẵn sàng (Available)</option>
            <option value="RENTED">Đang thuê (Rented)</option>
            <option value="CLEANING">Đang giặt (Cleaning)</option>
            <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
          </select>
        </label>
        <label className="inv-filter inv-filter-wide">
          <span>Tình trạng chất lượng</span>
          <select value={invConditionFilter} onChange={(e) => { setInvConditionFilter(e.target.value); resetPage(); }}>
            <option value="">Tất cả (ẩn áo ngừng cho thuê)</option>
            <option value="NEW">Mới (New)</option>
            <option value="GOOD">Tốt (Good)</option>
            <option value="MINOR_DAMAGE">Hỏng nhẹ</option>
            <option value="LOCKED">Đang khóa (Locked)</option>
            <option value="RETIRED">Đã ngừng cho thuê</option>
          </select>
        </label>
        <label className="inv-filter">
          <span>Sắp xếp theo</span>
          <select value={invSortBy} onChange={(e) => { setInvSortBy(e.target.value); resetPage(); }}>
            <option value="need_action">Cần xử lý trước</option>
            <option value="name_asc">Tên áo A – Z</option>
            <option value="newest">Mới nhập</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </label>
      </div>

      {invTotal > (items || []).length && (
        <div className="inv-note">
          Đang hiển thị {(items || []).length} / {invTotal} hiện vật mới nhập nhất.
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="inv-bulk-bar" role="region" aria-label="Thao tác hàng loạt">
          <span>Đã chọn <strong>{selectedItems.length}</strong> hiện vật đang giặt / bảo trì</span>
          <div>
            <button type="button" className="inv-btn inv-btn-primary" disabled={busy || !handleBulkMarkAvailable} onClick={markSelectedAvailable}>
              {bulkBusy ? 'Đang cập nhật...' : `Chuyển ${selectedItems.length} hiện vật sang Sẵn sàng`}
            </button>
            <button type="button" className="inv-btn" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="inv-empty">
          {filtering ? 'Không tìm thấy hiện vật nào phù hợp với bộ lọc hiện tại.' : 'Chưa có hiện vật áo dài nào trong kho.'}
        </div>
      ) : (
        <div className="inv-groups">
          {pagedGroups.map((group) => {
            const isOpen = isGroupOpen(group.key);
            const selectableInGroup = group.items.filter(needsAction);
            const allSelected = selectableInGroup.length > 0 && selectableInGroup.every((item) => selected.has(item._id));
            const countLabel =
              group.items.length === group.totalCount ? `${group.totalCount} cái` : `${group.items.length} / ${group.totalCount} cái`;

            return (
              <section key={group.key} className={`inv-group${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="inv-group-head"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.key)}
                >
                  <ChevronRight size={16} className="inv-group-chevron" aria-hidden="true" />
                  <span className="inv-group-title">{groupTitleOf(group)}</span>
                  <span className="inv-statusbar" aria-hidden="true">
                    {ITEM_CATEGORIES.filter((c) => group.counts[c.key] > 0).map((c) => (
                      <i key={c.key} className={`is-${c.key}`} style={{ flexGrow: group.counts[c.key] }} />
                    ))}
                  </span>
                  <span className="inv-statuscounts">
                    {ITEM_CATEGORIES.filter((c) => group.counts[c.key] > 0).map((c) => (
                      <span key={c.key} className={`is-${c.key}`}>{group.counts[c.key]} {c.short}</span>
                    ))}
                  </span>
                  <span className="inv-group-count">{countLabel}</span>
                </button>

                {isOpen && (() => {
                  const pageCount = Math.max(1, Math.ceil(group.items.length / ITEMS_PER_PAGE));
                  const page = Math.min(groupPageOf(group.key), pageCount);
                  const pageItems = group.items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
                  const showTable = tableViews.has(group.key);
                  const selectMode = !showTable && selectModes.has(group.key);
                  return (
                    <div className="inv-group-body">
                      <div className="inv-group-toolbar">
                        <div className="inv-view-toggle" role="group" aria-label="Kiểu hiển thị">
                          <button
                            type="button"
                            className={!showTable ? 'is-active' : ''}
                            aria-pressed={!showTable}
                            onClick={() => setTableViews((prev) => { const next = new Set(prev); next.delete(group.key); return next; })}
                          >
                            Sơ đồ
                          </button>
                          <button
                            type="button"
                            className={showTable ? 'is-active' : ''}
                            aria-pressed={showTable}
                            onClick={() => setTableViews((prev) => new Set(prev).add(group.key))}
                          >
                            Bảng
                          </button>
                        </div>
                        <div className="inv-group-toolbar-actions">
                          {!showTable && selectableInGroup.length > 0 && handleBulkMarkAvailable && (
                            <button
                              type="button"
                              className={`inv-btn${selectMode ? ' inv-btn-primary' : ''}`}
                              aria-pressed={selectMode}
                              onClick={() => setSelectModes((prev) => toggleKey(prev, group.key))}
                            >
                              {selectMode ? 'Xong chọn' : 'Chọn nhiều'}
                            </button>
                          )}
                        </div>
                      </div>

                      {!showTable ? (
                        <InventoryItemGrid
                          group={group}
                          busy={busy}
                          updatingItemId={updatingItemId}
                          selectMode={selectMode}
                          canSelect={canSelectItem}
                          isSelected={(itemId) => selected.has(itemId)}
                          onToggleSelect={toggleSelected}
                          onSetSelected={setSelectedIds}
                          onStatusChange={changeStatus}
                          onUnlock={unlockItem}
                          onOpenDetail={openDetail}
                          onRetire={retireItem}
                        />
                      ) : (<>
                      {selectableInGroup.length > 0 && handleBulkMarkAvailable && (
                        <label className="inv-select-all">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => setGroupSelection(group, e.target.checked)}
                          />
                          Chọn tất cả áo cần xử lý ({selectableInGroup.length})
                        </label>
                      )}

                      <InventoryItemTable
                        items={pageItems}
                        busy={busy}
                        updatingItemId={updatingItemId}
                        canSelect={canSelectItem}
                        isSelected={(itemId) => selected.has(itemId)}
                        onToggleSelect={toggleSelected}
                        onStatusChange={changeStatus}
                        onUnlock={unlockItem}
                        onOpenDetail={openDetail}
                        onRetire={retireItem}
                      />

                      {pageCount > 1 && (
                        <div className="inv-pagination inv-group-pagination">
                          <span>
                            Hiển thị {(page - 1) * ITEMS_PER_PAGE + 1}–{(page - 1) * ITEMS_PER_PAGE + pageItems.length} trên {group.items.length} hiện vật
                          </span>
                          <div>
                            <button type="button" className="inv-btn" disabled={page <= 1} onClick={() => setGroupPage(group.key, page - 1)}>
                              Trang trước
                            </button>
                            <span className="inv-page-indicator">{page} / {pageCount}</span>
                            <button type="button" className="inv-btn" disabled={page >= pageCount} onClick={() => setGroupPage(group.key, page + 1)}>
                              Trang sau
                            </button>
                          </div>
                        </div>
                      )}
                      </>)}
                    </div>
                  );
                })()}
              </section>
            );
          })}
        </div>
      )}

      {groups.length > GROUPS_PER_PAGE && (
        <div className="inv-pagination">
          <span>Hiển thị {pagedGroups.length} trên tổng số {groups.length} biến thể</span>
          <div>
            <button type="button" className="inv-btn" disabled={currentPage <= 1} onClick={() => setInvPage(Math.max(1, currentPage - 1))}>
              Trang trước
            </button>
            <span className="inv-page-indicator">{currentPage} / {totalPages}</span>
            <button type="button" className="inv-btn" disabled={currentPage >= totalPages} onClick={() => setInvPage(Math.min(totalPages, currentPage + 1))}>
              Trang sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
