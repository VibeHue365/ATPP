// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scaleToFit, validateSearchImage } from '../src/features/rentals/visual-search/prepareSearchImage';
import { VisualSearchModal } from '../src/features/rentals/visual-search/VisualSearchModal';

// A plain function instead of vi.fn(): Vitest 5 tracks a vi.fn's rejected promise and
// reports it as unhandled even though the modal catches it.
let searchImpl: (...args: unknown[]) => Promise<unknown>;
const searchCalls: unknown[][] = [];
vi.mock('../src/features/rentals/visual-search/visualSearchApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchAoDaiByImage: (...args: unknown[]) => {
    searchCalls.push(args);
    return searchImpl(...args);
  },
}));
vi.mock('../src/features/rentals/visual-search/prepareSearchImage', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prepareSearchImage: vi.fn().mockResolvedValue({
    base64: 'small-jpeg',
    mimeType: 'image/jpeg',
    previewUrl: 'data:image/jpeg;base64,small-jpeg',
  }),
}));

const photo = (type = 'image/jpeg', size = 1024) =>
  new File([new Uint8Array(size)], 'ao-dai.jpg', { type });

function openModalAndUpload(file: File) {
  render(
    <MemoryRouter>
      <VisualSearchModal isOpen onClose={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByTestId('visual-search-input'), { target: { files: [file] } });
}

describe('Visual search image preparation (VIB-93)', () => {
  it('accepts JPEG, PNG and WebP up to 10MB only', () => {
    expect(validateSearchImage(photo('image/jpeg'))).toBeNull();
    expect(validateSearchImage(photo('image/webp'))).toBeNull();
    expect(validateSearchImage(photo('image/gif'))).toMatch(/JPG, PNG hoặc WebP/);
    expect(validateSearchImage(photo('image/png', 11 * 1024 * 1024))).toMatch(/10MB/);
  });

  it('shrinks large photos to 512px on the longest side and keeps small ones', () => {
    expect(scaleToFit(2000, 1000)).toEqual({ width: 512, height: 256 });
    expect(scaleToFit(300, 400)).toEqual({ width: 300, height: 400 });
  });
});

describe('VisualSearchModal (VIB-93)', () => {
  beforeEach(() => {
    searchCalls.length = 0;
  });

  it('sends the resized photo and labels results by similarity', async () => {
    searchImpl = async () => ({
      message: null,
      items: [
        {
          _id: 'p1',
          name: 'Áo dài đỏ thêu phượng',
          basePrice: 300000,
          images: ['https://cdn/p1.jpg'],
          providerId: { businessName: 'Huế Áo Dài Studio' },
          activeCampaign: { occasion: 'Tết', type: 'SURCHARGE', discountPercent: 20, endDate: '2027-01-02' },
          visualScore: 0.91,
        },
        { _id: 'p2', name: 'Áo dài hồng', basePrice: 200000, images: [], visualScore: 0.7 },
      ],
    });

    openModalAndUpload(photo());

    expect(await screen.findByText('Rất giống 91%')).toBeTruthy();
    expect(screen.getByText('Tương tự 70%')).toBeTruthy();
    expect(screen.getByText('+20%')).toBeTruthy();
    expect(screen.getByText('Huế Áo Dài Studio')).toBeTruthy();
    expect(screen.getByText('Áo dài đỏ thêu phượng').closest('a')?.getAttribute('href')).toBe('/rentals/p1');
    expect(searchCalls).toEqual([['small-jpeg', 'image/jpeg']]);
  });

  it('shows the no-match message when the photo has no Ao Dai', async () => {
    searchImpl = async () => ({ items: [], message: 'Không tìm thấy áo dài phù hợp trong ảnh.' });

    openModalAndUpload(photo());

    expect(await screen.findByText('Không tìm thấy áo dài phù hợp trong ảnh.')).toBeTruthy();
  });

  it('rejects unsupported files without calling the server', () => {
    openModalAndUpload(photo('image/gif'));

    expect(screen.getByText(/JPG, PNG hoặc WebP/)).toBeTruthy();
    expect(searchCalls).toEqual([]);
  });

  it('reports a failed search', async () => {
    searchImpl = async () => {
      throw new Error('Too many requests. Please try again later.');
    };

    openModalAndUpload(photo());

    expect(await screen.findByText('Too many requests. Please try again later.')).toBeTruthy();
  });
});
