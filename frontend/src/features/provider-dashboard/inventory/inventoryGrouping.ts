/**
 * Client-side filtering and variant grouping for the "Sản phẩm chi tiết" inventory tab.
 * Items are loaded once (all pages) so a variant is never split across server pages.
 */

export const NEED_ACTION_FILTER = 'NEED_ACTION';

/** Shape of an inventory item as returned by GET /inventory (productId is populated with its name). */
export type InventoryItem = {
  _id: string;
  sku?: string;
  productId?: string | { _id?: string; name?: string } | null;
  size?: string;
  color?: string;
  material?: string | null;
  status?: string;
  conditionStatus?: string;
  notes?: string;
  createdAt?: string | Date;
};

export type InventorySortKey = 'need_action' | 'name_asc' | 'newest' | 'oldest';

export type InventoryFilters = {
  search: string;
  status: string;
  condition: string;
  sortBy: string;
};

export type InventoryGroup = {
  key: string;
  productName: string;
  size: string;
  color: string;
  material: string;
  /** Items shown under the current filters, already sorted. */
  items: InventoryItem[];
  /** All items of the variant in the current quality scope (retired hidden unless filtered). */
  totalCount: number;
  needActionCount: number;
  /** How many items of the variant are in each state (same scope as totalCount). */
  counts: Record<ItemCategory, number>;
};

/** One colour per square on the variant map. */
export type ItemCategory = 'available' | 'cleaning' | 'maintenance' | 'rented' | 'locked' | 'retired';

export const ITEM_CATEGORIES: Array<{ key: ItemCategory; label: string; short: string }> = [
  { key: 'available', label: 'Sẵn sàng', short: 'sẵn sàng' },
  { key: 'cleaning', label: 'Đang giặt', short: 'giặt' },
  { key: 'maintenance', label: 'Bảo trì', short: 'bảo trì' },
  { key: 'rented', label: 'Đang thuê', short: 'thuê' },
  { key: 'locked', label: 'Đang khóa', short: 'khóa' },
  { key: 'retired', label: 'Đã ngừng cho thuê', short: 'ngừng cho thuê' },
];

const emptyCounts = (): Record<ItemCategory, number> => ({
  available: 0, cleaning: 0, maintenance: 0, rented: 0, locked: 0, retired: 0,
});

const isRetired = (item: InventoryItem) => item?.conditionStatus === 'RETIRED';
const isLocked = (item: InventoryItem) => item?.conditionStatus === 'LOCKED';

export const categoryOf = (item: InventoryItem): ItemCategory => {
  if (isRetired(item)) return 'retired';
  if (isLocked(item)) return 'locked';
  if (item?.status === 'RENTED') return 'rented';
  if (item?.status === 'CLEANING') return 'cleaning';
  if (item?.status === 'MAINTENANCE') return 'maintenance';
  return 'available';
};

/** Short label for a square: the running number at the end of the SKU (e.g. "031"). */
export const skuShortOf = (item: InventoryItem) => {
  const sku = String(item?.sku || '');
  const last = sku.split('-').pop() || sku;
  return last.length <= 4 ? last : last.slice(-4);
};

/** Washing or maintenance that the shop still has to finish by hand. */
export const needsAction = (item: InventoryItem) =>
  !isRetired(item) && !isLocked(item) && (item?.status === 'CLEANING' || item?.status === 'MAINTENANCE');

const productNameOf = (item: InventoryItem) =>
  (item?.productId && typeof item.productId === 'object' ? item.productId.name : '') || 'Sản phẩm lỗi';

const productIdOf = (item: InventoryItem) => {
  const ref = item?.productId;
  return String((ref && typeof ref === 'object' ? ref._id : ref) ?? '');
};

export const groupKeyOf = (item: InventoryItem) =>
  [productIdOf(item), item?.size || '', item?.color || '', item?.material || ''].join('|');

/** Lower rank = shown higher inside a group. */
const itemRank = (item: InventoryItem) => {
  if (isRetired(item)) return 4;
  if (needsAction(item)) return 0;
  if (isLocked(item) || item?.conditionStatus === 'MINOR_DAMAGE') return 1;
  if (item?.status === 'RENTED') return 2;
  return 3;
};

const timeOf = (item: InventoryItem) => {
  const t = new Date(item?.createdAt ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const inQualityScope = (item: InventoryItem, condition: string) =>
  condition ? item?.conditionStatus === condition : !isRetired(item);

const matchesFilters = (item: InventoryItem, filters: InventoryFilters) => {
  if (!inQualityScope(item, filters.condition)) return false;

  if (filters.status === NEED_ACTION_FILTER) {
    if (!needsAction(item)) return false;
  } else if (filters.status && item?.status !== filters.status) {
    return false;
  }

  const query = normalize(filters.search || '');
  if (query) {
    const haystack = normalize(`${item?.sku || ''} ${productNameOf(item)}`);
    if (!haystack.includes(query)) return false;
  }
  return true;
};

const compareItems = (sortBy: string) => (a: InventoryItem, b: InventoryItem) => {
  if (sortBy === 'newest') return timeOf(b) - timeOf(a);
  if (sortBy === 'oldest') return timeOf(a) - timeOf(b);
  return itemRank(a) - itemRank(b) || String(a?.sku || '').localeCompare(String(b?.sku || ''));
};

const compareGroups = (sortBy: string) => (a: InventoryGroup, b: InventoryGroup) => {
  const byName =
    a.productName.localeCompare(b.productName, 'vi') ||
    a.size.localeCompare(b.size) ||
    a.color.localeCompare(b.color);
  if (sortBy === 'name_asc') return byName;
  if (sortBy === 'newest') return Math.max(...b.items.map(timeOf)) - Math.max(...a.items.map(timeOf)) || byName;
  if (sortBy === 'oldest') return Math.min(...a.items.map(timeOf)) - Math.min(...b.items.map(timeOf)) || byName;
  return b.needActionCount - a.needActionCount || byName;
};

export function groupInventoryItems(allItems: InventoryItem[], filters: InventoryFilters): InventoryGroup[] {
  const groups = new Map<string, InventoryGroup>();

  for (const item of allItems || []) {
    if (!inQualityScope(item, filters.condition)) continue;
    const key = groupKeyOf(item);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        productName: productNameOf(item),
        size: item?.size || '',
        color: item?.color || '',
        material: item?.material || '',
        items: [],
        totalCount: 0,
        needActionCount: 0,
        counts: emptyCounts(),
      };
      groups.set(key, group);
    }
    group.totalCount += 1;
    if (needsAction(item)) group.needActionCount += 1;
    group.counts[categoryOf(item)] += 1;
    if (matchesFilters(item, filters)) group.items.push(item);
  }

  const sortItems = compareItems(filters.sortBy);
  return Array.from(groups.values())
    .filter((group) => group.items.length > 0)
    .map((group) => ({ ...group, items: [...group.items].sort(sortItems) }))
    .sort(compareGroups(filters.sortBy));
}

export const hasActiveFilter = (filters: InventoryFilters) =>
  Boolean(filters.search.trim() || filters.status || filters.condition);
