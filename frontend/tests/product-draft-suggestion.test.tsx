// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDraftSuggestion } from '../src/features/provider-dashboard/collections/ProductDraftSuggestion';

// Plain function, not vi.fn(): Vitest 5 reports a vi.fn's rejected promise as
// unhandled even when the component catches it.
let draftImpl: (...args: unknown[]) => Promise<unknown>;
const draftCalls: unknown[][] = [];
vi.mock('../src/features/provider-dashboard/api/providerDashboardApi', () => ({
  productsApi: {
    draftFromPhotos: (...args: unknown[]) => {
      draftCalls.push(args);
      return draftImpl(...args);
    },
  },
}));

const COLORS = [
  { key: 'RED', label: 'Đỏ', swatch: '#881337' },
  { key: 'GOLD', label: 'Vàng', swatch: '#F59E0B' },
  { key: 'WHITE', label: 'Trắng', swatch: '#FFFFFF' },
];
const PHOTOS = ['https://res.cloudinary.com/v/1.jpg', 'https://res.cloudinary.com/v/2.jpg', 'https://res.cloudinary.com/v/3.jpg', 'https://res.cloudinary.com/v/4.jpg'];
const SUCCESS = {
  status: 'SUCCESS',
  attributes: [
    { group: 'color', key: 'RED', label: 'đỏ', confidence: 0.92, on_cover: true },
    { group: 'color', key: 'GOLD', label: 'vàng', confidence: 0.95, on_cover: false },
    { group: 'pattern', key: 'EMBROIDERED', label: 'thêu hoa', confidence: 0.81, on_cover: true },
  ],
  name: 'Áo dài đỏ thêu hoa',
  description: 'Mẫu áo dài màu đỏ, điểm xuyết họa tiết thêu hoa tinh tế.',
  colors: ['RED', 'GOLD'],
};

// The panel remembers the last suggestion per photo set (module level), so each test
// uses its own photo URLs.
let photoSet = 0;
const freshPhotos = () => {
  photoSet += 1;
  return PHOTOS.map((url) => `${url}?set=${photoSet}`);
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof ProductDraftSuggestion>> = {}) {
  const props = {
    imageUrls: freshPhotos(),
    colorOptions: COLORS,
    selectedColors: ['RED'],
    onApplyName: vi.fn(),
    onApplyDescription: vi.fn(),
    onSelectColors: vi.fn(),
    ...overrides,
  };
  const view = render(<ProductDraftSuggestion {...props} />);
  return { ...props, ...view };
}

describe('ProductDraftSuggestion (UC-C10 name/description from photos)', () => {
  beforeEach(() => {
    draftCalls.length = 0;
    draftImpl = async () => SUCCESS;
  });

  it('is disabled until a photo is uploaded', () => {
    renderPanel({ imageUrls: [] });
    expect((screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends the cover and the next two photos, then shows what it recognised', async () => {
    const { imageUrls } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));

    expect(await screen.findByText('Áo dài đỏ thêu hoa')).toBeTruthy();
    expect(draftCalls).toEqual([[{ imageUrls: imageUrls.slice(0, 3) }]]);
    expect(screen.getByText('thêu hoa').closest('.pdraft-chip')?.textContent).toContain('81%');
  });

  it('only fills a field when the provider chooses to', async () => {
    const { onApplyName, onApplyDescription } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    await screen.findByText('Áo dài đỏ thêu hoa');
    expect(onApplyName).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Dùng tên này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng mô tả này' }));

    expect(onApplyName).toHaveBeenCalledWith('Áo dài đỏ thêu hoa');
    expect(onApplyDescription).toHaveBeenCalledWith(SUCCESS.description);
    expect(screen.getAllByText('Đã dùng')).toHaveLength(2);
  });

  it('adds only the suggested colours that are not selected yet, in one call', async () => {
    const { onSelectColors } = renderPanel({ selectedColors: ['RED'] });
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    await screen.findByText('Áo dài đỏ thêu hoa');

    fireEvent.click(screen.getByRole('button', { name: 'Chọn các màu này' }));

    expect(onSelectColors).toHaveBeenCalledWith(['GOLD']);
  });

  it('explains when the cover is not an Ao Dai or the AI is unavailable', async () => {
    draftImpl = async () => ({ status: 'NOT_AO_DAI', attributes: [], name: '', description: '', colors: [] });
    const { rerender } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    expect(await screen.findByText(/Ảnh bìa có vẻ không phải áo dài/)).toBeTruthy();

    draftImpl = async () => ({ status: 'UNAVAILABLE', attributes: [], name: '', description: '', colors: [] });
    rerender(<ProductDraftSuggestion imageUrls={PHOTOS.slice(1)} colorOptions={COLORS} selectedColors={[]} onApplyName={vi.fn()} onApplyDescription={vi.fn()} onSelectColors={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    expect(await screen.findByText(/tạm không khả dụng/)).toBeTruthy();
  });

  it('reports a failed request', async () => {
    draftImpl = async () => {
      throw new Error('Ảnh gợi ý phải là ảnh đã tải lên hệ thống.');
    };
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    expect(await screen.findByText('Ảnh gợi ý phải là ảnh đã tải lên hệ thống.')).toBeTruthy();
  });

  it('drops an old suggestion when the photos change', async () => {
    const { rerender, imageUrls } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    await screen.findByText('Áo dài đỏ thêu hoa');

    rerender(<ProductDraftSuggestion imageUrls={imageUrls.slice(1)} colorOptions={COLORS} selectedColors={[]} onApplyName={vi.fn()} onApplyDescription={vi.fn()} onSelectColors={vi.fn()} />);

    expect(screen.queryByText('Áo dài đỏ thêu hoa')).toBeNull();
  });

  it('keeps the suggestion when the wizard remounts step 1 with the same photos', async () => {
    const { unmount, imageUrls } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Gợi ý tên & mô tả từ ảnh/ }));
    await screen.findByText('Áo dài đỏ thêu hoa');
    unmount(); // step 1 → step 2

    render(<ProductDraftSuggestion imageUrls={imageUrls} colorOptions={COLORS} selectedColors={[]} onApplyName={vi.fn()} onApplyDescription={vi.fn()} onSelectColors={vi.fn()} />);

    expect(screen.getByText('Áo dài đỏ thêu hoa')).toBeTruthy();
    expect(draftCalls).toHaveLength(1);
  });
});
