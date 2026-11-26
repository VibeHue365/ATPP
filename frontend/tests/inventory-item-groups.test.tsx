import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InventoryPanel } from '../src/features/provider-dashboard/inventory/InventoryPanel';
import {
  groupInventoryItems,
  NEED_ACTION_FILTER,
  type InventoryItem,
} from '../src/features/provider-dashboard/inventory/inventoryGrouping';

const BLACK = { _id: 'p-black', name: 'Áo dài đen' };
const RED = { _id: 'p-red', name: 'Áo dài đỏ' };

const item = (overrides: Partial<InventoryItem> & { _id: string }): InventoryItem => ({
  sku: overrides._id.toUpperCase(),
  productId: BLACK,
  size: 'M',
  color: 'BLACK',
  material: 'SILK',
  status: 'AVAILABLE',
  conditionStatus: 'GOOD',
  notes: '',
  createdAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const ITEMS: InventoryItem[] = [
  item({ _id: 'black-001', createdAt: '2026-11-01T00:00:00.000Z' }),
  item({ _id: 'black-002', status: 'RENTED', createdAt: '2026-11-02T00:00:00.000Z' }),
  item({ _id: 'black-003', status: 'CLEANING', createdAt: '2026-11-03T00:00:00.000Z' }),
  item({ _id: 'black-004', conditionStatus: 'RETIRED', createdAt: '2026-11-04T00:00:00.000Z' }),
  item({ _id: 'red-001', productId: RED, color: 'RED', createdAt: '2026-11-05T00:00:00.000Z' }),
  item({ _id: 'red-002', productId: RED, color: 'RED', status: 'MAINTENANCE', createdAt: '2026-11-06T00:00:00.000Z' }),
  item({ _id: 'red-003', productId: RED, color: 'RED', status: 'CLEANING', createdAt: '2026-11-07T00:00:00.000Z' }),
  item({ _id: 'red-004', productId: RED, color: 'RED', status: 'CLEANING', conditionStatus: 'LOCKED', createdAt: '2026-11-08T00:00:00.000Z' }),
];

const filters = (overrides: Partial<{ search: string; status: string; condition: string; sortBy: string }> = {}) => ({
  search: '',
  status: '',
  condition: '',
  sortBy: 'need_action',
  ...overrides,
});

describe('groupInventoryItems', () => {
  it('groups items by variant, hides retired items and puts items needing action first', () => {
    const groups = groupInventoryItems(ITEMS, filters());

    expect(groups.map((g) => g.productName)).toEqual(['Áo dài đỏ', 'Áo dài đen']);
    const [red, black] = groups;
    expect(red.needActionCount).toBe(2);
    expect(red.items.map((i) => i._id)).toEqual(['red-002', 'red-003', 'red-004', 'red-001']);
    expect(black.totalCount).toBe(3);
    expect(black.items.map((i) => i._id)).toEqual(['black-003', 'black-002', 'black-001']);
  });

  it('"Cần xử lý" keeps only washing/maintenance items that are not locked', () => {
    const groups = groupInventoryItems(ITEMS, filters({ status: NEED_ACTION_FILTER }));
    expect(groups.flatMap((g) => g.items.map((i) => i._id)).sort()).toEqual(['black-003', 'red-002', 'red-003']);
    expect(groups.find((g) => g.productName === 'Áo dài đen')?.totalCount).toBe(3);
  });

  it('shows retired items only when "Đã ngừng cho thuê" is selected', () => {
    const groups = groupInventoryItems(ITEMS, filters({ condition: 'RETIRED' }));
    expect(groups.flatMap((g) => g.items.map((i) => i._id))).toEqual(['black-004']);
  });

  it('searches SKU and product name without accents', () => {
    expect(groupInventoryItems(ITEMS, filters({ search: 'ao dai do' })).map((g) => g.productName)).toEqual(['Áo dài đỏ']);
    expect(groupInventoryItems(ITEMS, filters({ search: 'black-002' })).flatMap((g) => g.items.map((i) => i._id))).toEqual(['black-002']);
  });

  it('sorts groups by name and items by import date when asked', () => {
    expect(groupInventoryItems(ITEMS, filters({ sortBy: 'name_asc' })).map((g) => g.productName)).toEqual(['Áo dài đen', 'Áo dài đỏ']);
    const newest = groupInventoryItems(ITEMS, filters({ sortBy: 'newest' }));
    expect(newest[0].productName).toBe('Áo dài đỏ');
    expect(newest[0].items[0]._id).toBe('red-004');
    const oldest = groupInventoryItems(ITEMS, filters({ sortBy: 'oldest' }));
    expect(oldest[0].items.map((i) => i._id)).toEqual(['black-001', 'black-002', 'black-003']);
  });
});

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    inventorySummary: [
      { productId: 'p-black', productName: 'Áo dài đen', size: 'M', color: 'BLACK', material: 'SILK', total: 3, available: 1, bookedAhead: 0, rented: 1, maintenance: 1 },
    ],
    invSummaryPage: 1,
    setInvSummaryPage: vi.fn(),
    invSearch: '',
    setInvSearch: vi.fn(),
    invStatusFilter: '',
    setInvStatusFilter: vi.fn(),
    invConditionFilter: '',
    setInvConditionFilter: vi.fn(),
    invSortBy: 'need_action',
    setInvSortBy: vi.fn(),
    isLoadingInventory: false,
    variantBusy: false,
    setVariantEditRow: vi.fn(),
    setVariantEditQty: vi.fn(),
    handleRemoveVariant: vi.fn(),
    inventoryItems: ITEMS,
    setEditInvItem: vi.fn(),
    setEditInvStatus: vi.fn(),
    setEditInvCondition: vi.fn(),
    setEditInvNotes: vi.fn(),
    setIsEditInventoryOpen: vi.fn(),
    handleDeleteInventoryItem: vi.fn().mockResolvedValue(undefined),
    handleQuickUpdateStatus: vi.fn().mockResolvedValue(undefined),
    handleBulkMarkAvailable: vi.fn().mockResolvedValue(undefined),
    invTotal: ITEMS.length,
    invLimit: 10,
    invPage: 1,
    setInvPage: vi.fn(),
    ...overrides,
  };
  render(<InventoryPanel {...(props as React.ComponentProps<typeof InventoryPanel>)} />);
  return props;
}

const openDetailTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Sản phẩm chi tiết' }));
const groupHeader = (name: RegExp) => screen.getByRole('button', { name });
const rowOf = (sku: string) => screen.getByText(sku).closest('tr') as HTMLElement;
const seat = (sku: string) => screen.getByRole('button', { name: new RegExp(`^${sku} — `) });
const seatLabels = () => Array.from(document.querySelectorAll('.inv-seat')).map((el) => el.textContent);
const showTable = () => fireEvent.click(screen.getByRole('button', { name: 'Bảng' }));
const visibleSkus = () =>
  Array.from(document.querySelectorAll('.inv-item-row')).map((row) => within(row as HTMLElement).getByText(/^[A-Z]+-\d+$/).textContent);

describe('InventoryPanel sub-tabs', () => {
  afterEach(cleanup);

  it('opens on "Tất cả sản phẩm" with the unchanged variant summary table', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Tất cả sản phẩm' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('TỒN KHO THEO BIẾN THỂ — TẤT CẢ SẢN PHẨM')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sửa số lượng' })).toBeDefined();
    expect(screen.queryByText('DANH SÁCH CHI TIẾT HIỆN VẬT ÁO DÀI')).toBeNull();
  });

  it('lists every variant collapsed with a status bar and per-status counts', () => {
    renderPanel();
    openDetailTab();

    const red = groupHeader(/Áo dài đỏ · M · Đỏ/);
    expect(red.getAttribute('aria-expanded')).toBe('false');
    expect(within(red).getByText('4 cái')).toBeDefined();
    for (const label of ['1 sẵn sàng', '1 giặt', '1 bảo trì', '1 khóa']) {
      expect(within(red).getByText(label)).toBeDefined();
    }
    expect(red.querySelectorAll('.inv-statusbar i')).toHaveLength(4);
    const black = groupHeader(/Áo dài đen · M · Đen/);
    expect(within(black).getByText('3 cái')).toBeDefined();
    expect(within(black).getByText('1 thuê')).toBeDefined();
    expect(document.querySelector('.inv-seat')).toBeNull();
  });

  it('collapses an opened variant when its header is clicked again', () => {
    renderPanel();
    openDetailTab();
    const red = () => groupHeader(/Áo dài đỏ · M · Đỏ/);

    fireEvent.click(red());
    expect(red().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(red());
    expect(red().getAttribute('aria-expanded')).toBe('false');

    expect(document.querySelector('.inv-seat')).toBeNull();
  });

  it('opens a variant as a seat map ordered by SKU, coloured by status', () => {
    renderPanel();
    openDetailTab();
    fireEvent.click(groupHeader(/Áo dài đỏ · M · Đỏ/));

    expect(seatLabels()).toEqual(['001', '002', '003', '004']);
    expect(seat('RED-001').className).toContain('is-available');
    expect(seat('RED-002').className).toContain('is-maintenance');
    expect(seat('RED-003').className).toContain('is-cleaning');
    expect(seat('RED-004').className).toContain('is-locked');

    fireEvent.click(screen.getByRole('button', { name: /^Đang giặt 1$/ }));
    expect(seat('RED-001').className).toContain('is-dimmed');
    expect(seat('RED-003').className).not.toContain('is-dimmed');
  });

  it('clicking a square shows its status control and actions', async () => {
    const props = renderPanel();
    openDetailTab();
    fireEvent.click(groupHeader(/Áo dài đỏ · M · Đỏ/));

    fireEvent.click(seat('RED-003'));
    const panel = screen.getByRole('region', { name: 'Hiện vật RED-003' });
    fireEvent.change(within(panel).getByLabelText('Trạng thái RED-003'), { target: { value: 'AVAILABLE' } });
    await waitFor(() =>
      expect(props.handleQuickUpdateStatus).toHaveBeenCalledWith('red-003', 'AVAILABLE', 'GOOD', ''),
    );

    fireEvent.click(seat('RED-004'));
    const locked = screen.getByRole('region', { name: 'Hiện vật RED-004' });
    expect(within(locked).getByRole('button', { name: 'Mở khóa' })).toBeDefined();
    fireEvent.click(within(locked).getByRole('button', { name: 'Ngừng cho thuê' }));
    expect(props.handleDeleteInventoryItem).toHaveBeenCalledWith('red-004');
  });

  it('"Bảng" shows the original table columns with items needing action first', async () => {
    const props = renderPanel();
    openDetailTab();
    fireEvent.click(groupHeader(/Áo dài đỏ · M · Đỏ/));
    showTable();

    for (const column of ['SKU', 'TÊN SẢN PHẨM', 'KÍCH CỠ', 'MÀU', 'CHẤT LƯỢNG', 'TRẠNG THÁI', 'GHI CHÚ', 'THAO TÁC']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeDefined();
    }
    expect(visibleSkus()).toEqual(['RED-002', 'RED-003', 'RED-004', 'RED-001']);
    expect(within(rowOf('RED-004')).getByRole('button', { name: 'Mở khóa' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Trạng thái RED-003'), { target: { value: 'AVAILABLE' } });
    await waitFor(() =>
      expect(props.handleQuickUpdateStatus).toHaveBeenCalledWith('red-003', 'AVAILABLE', 'GOOD', ''),
    );

    fireEvent.click(within(rowOf('RED-001')).getByRole('button', { name: 'Ngừng cho thuê' }));
    expect(props.handleDeleteInventoryItem).toHaveBeenCalledWith('red-001');
  });

  it('table view pages a large variant 10 items at a time', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item({ _id: `black-${String(i + 1).padStart(3, '0')}`, status: i < 3 ? 'CLEANING' : 'AVAILABLE' }),
    );
    renderPanel({ inventoryItems: many, invTotal: many.length });
    openDetailTab();
    fireEvent.click(groupHeader(/Áo dài đen · M · Đen/));
    expect(seatLabels()).toHaveLength(25);
    showTable();

    expect(visibleSkus()).toHaveLength(10);
    expect(visibleSkus().slice(0, 3)).toEqual(['BLACK-001', 'BLACK-002', 'BLACK-003']);
    expect(screen.getByText('Hiển thị 1–10 trên 25 hiện vật')).toBeDefined();
    expect(screen.getByText('1 / 3')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('2 / 3')).toBeDefined();
    expect(visibleSkus()[0]).toBe('BLACK-011');
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(visibleSkus()).toHaveLength(5);
  });

  it('"Chọn nhiều" picks washing/maintenance squares and marks them available in one action', async () => {
    const props = renderPanel();
    openDetailTab();
    fireEvent.click(groupHeader(/Áo dài đỏ · M · Đỏ/));

    fireEvent.click(screen.getByRole('button', { name: 'Chọn nhiều' }));
    fireEvent.click(seat('RED-001'));
    fireEvent.click(seat('RED-004'));
    fireEvent.click(seat('RED-002'));
    fireEvent.click(screen.getByRole('button', { name: /^Đang giặt 1$/ }));
    expect(screen.queryByRole('region', { name: /^Hiện vật / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển 2 hiện vật sang Sẵn sàng' }));

    await waitFor(() => expect(props.handleBulkMarkAvailable).toHaveBeenCalledTimes(1));
    const sent = (props.handleBulkMarkAvailable as ReturnType<typeof vi.fn>).mock.calls[0][0] as InventoryItem[];
    expect(sent.map((i) => i._id).sort()).toEqual(['red-002', 'red-003']);
  });

  it('pages the variant list 5 variants at a time', () => {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const many = sizes.map((size, i) => item({ _id: `v-${i + 1}`, size }));
    const props = renderPanel({ inventoryItems: many, invTotal: many.length, invSortBy: 'name_asc' });
    openDetailTab();

    expect(document.querySelectorAll('.inv-group')).toHaveLength(5);
    expect(screen.getByText('Hiển thị 5 trên tổng số 7 biến thể')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(props.setInvPage).toHaveBeenCalledWith(2);
  });

  it('opens matching variants automatically while searching', () => {
    renderPanel({ invSearch: 'black-003' });
    openDetailTab();
    expect(groupHeader(/Áo dài đen · M · Đen/).getAttribute('aria-expanded')).toBe('true');
    expect(seat('BLACK-003')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^BLACK-001 — / })).toBeNull();
  });
});
