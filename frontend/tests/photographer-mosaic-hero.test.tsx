import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotographerPackageDetailLayout } from '../src/features/photographers/components/PhotographerPackageDetailLayout';
import type { PhotographerPackageDetailLayoutProps } from '../src/features/photographers/types/photographer-package-detail.types';
import type {
  PhotographerDetails,
  PhotographerPackage,
} from '../src/features/photographers/types/photographer.types';

vi.mock(
  '../src/features/photographers/components/PhotographerPackageBookingCard',
  () => ({
    PhotographerPackageBookingCard: () => (
      <div data-testid="booking-card-stub" />
    ),
  }),
);

vi.mock(
  '../src/features/photographers/components/PhotographyDurationControl',
  () => ({
    PhotographyDurationControl: () => <div data-testid="duration-stub" />,
  }),
);

vi.mock(
  '../src/features/photographers/components/PhotographyMultiSessionDialog',
  () => ({
    PhotographyMultiSessionDialog: () => null,
  }),
);

const LONG_DESCRIPTION =
  'Được tư vấn lựa chọn mẫu áo dài/cổ phục và phụ kiện đi kèm phù hợp nhất. Nhận toàn bộ file ảnh gốc ngay sau buổi chụp và file ảnh chỉnh sửa kĩ lưỡng.';

function makePackage(images: string[]): PhotographerPackage {
  return {
    _id: 'pkg-1',
    name: 'Chụp Ảnh Áo Dài Nghệ Thuật - Nét Đẹp Huế Xưa',
    price: 1200000,
    durationHours: 2,
    includedDurationMinutes: 120,
    editedPhotosCount: 25,
    deliveryDays: 3,
    maxPeople: 2,
    description: LONG_DESCRIPTION,
    images,
  };
}

function makePhotographer(opts: {
  pkgImages?: string[];
  portfolioItemImages?: string[];
  legacyPortfolio?: string[];
  coverImage?: string;
}): PhotographerDetails {
  const pkg = makePackage(opts.pkgImages ?? []);
  return {
    id: 'prov-1',
    _id: 'prov-1',
    providerId: 'prov-1',
    businessName: 'Áo Dài Cổ Phong Vibe',
    quote: 'Trao đổi trước để photographer hiểu rõ concept và mong muốn của bạn.',
    rating: { averageRating: 5, totalReviews: 4 },
    address: { city: 'Huế' },
    media: { coverUrl: opts.coverImage, images: [] },
    policies: {},
    equipment: ['Sony A7IV'],
    portfolio: opts.legacyPortfolio ?? [],
    portfolioItems: (opts.portfolioItemImages ?? []).length
      ? [
          {
            _id: 'port-1',
            title: 'Bộ ảnh Đại Nội',
            images: opts.portfolioItemImages ?? [],
          },
        ]
      : [],
    packages: [pkg],
    coverImage: opts.coverImage,
  };
}

function buildProps(
  photographer: PhotographerDetails,
  onImageClick = vi.fn(),
): PhotographerPackageDetailLayoutProps {
  const pkg = photographer.packages[0] ?? null;
  return {
    photographer,
    packages: photographer.packages,
    selectedPackage: pkg,
    selectedDate: '',
    startTime: '',
    endTime: '',
    durationMinutes: 120,
    selectedTimeSlot: '',
    quote: null,
    quoteError: null,
    isQuoteLoading: false,
    selectedLocation: null,
    locationError: null,
    selectedConcept: '',
    customRequest: '',
    referenceFile: null,
    bookingMode: 'SINGLE',
    multiSessions: [],
    agreeTerms: false,
    isFavorite: false,
    isBusy: false,
    isBooking: false,
    canAddToCart: false,
    reviews: [],
    reviewsLoading: false,
    calendarDate: new Date('2026-11-27T00:00:00Z'),
    calendarDays: [],
    isCalendarLoading: false,
    slots: [],
    isSlotBusy: () => false,
    includedDurationMinutes: 120,
    overtimeIncrementMinutes: 30,
    maxOvertimeMinutes: 240,
    canIncreaseDuration: false,
    isNextDurationQuoteLoading: false,
    increaseUnavailableReason: '',
    onToggleFavorite: vi.fn(),
    onSelectPackage: vi.fn(),
    onPreviousMonth: vi.fn(),
    onNextMonth: vi.fn(),
    onPreviewDate: vi.fn(),
    onConfirmSchedule: vi.fn(),
    onCancelSchedule: vi.fn(),
    onDecreaseDuration: vi.fn(),
    onIncreaseDuration: vi.fn(),
    onLocationChange: vi.fn(),
    onConceptChange: vi.fn(),
    onRequestChange: vi.fn(),
    onReferenceFileChange: vi.fn(),
    onAgreeTermsChange: vi.fn(),
    onBookNow: vi.fn(),
    onAddToCart: vi.fn(),
    onImageClick,
    lightbox: null,
    onStartMultiSession: vi.fn(),
    onBackToSingle: vi.fn(),
    onAddSession: vi.fn(),
    onGenerateRange: vi.fn(),
    onUpdateSession: vi.fn(),
    onRemoveSession: vi.fn(),
  };
}

describe('PhotographerPackageDetailLayout (Option 1 Photo Mosaic Gallery)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a clean 5-tile mosaic without overflowing text or dev tag when studio has 6 photos', () => {
    const onImageClick = vi.fn();
    const photos = [
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/4.jpg',
      'https://cdn.example.com/5.jpg',
      'https://cdn.example.com/6.jpg',
    ];
    const photographer = makePhotographer({
      pkgImages: photos.slice(0, 2),
      portfolioItemImages: photos.slice(2),
    });

    const { container } = render(
      <MemoryRouter>
        <PhotographerPackageDetailLayout {...buildProps(photographer, onImageClick)} />
      </MemoryRouter>,
    );

    const gallery = screen.getByLabelText('Bộ ảnh gói chụp');
    const mosaic = gallery.querySelector('.ppd-mosaic--five');
    expect(mosaic).toBeTruthy();

    const tiles = gallery.querySelectorAll('.ppd-mosaic-tile');
    expect(tiles).toHaveLength(5);

    expect(screen.queryByText('Nội dung từ package')).toBeNull();
    expect(within(gallery).queryByText(LONG_DESCRIPTION)).toBeNull();

    const overviewSection = container.querySelector('#ppd-overview');
    expect(overviewSection?.textContent).toContain(LONG_DESCRIPTION);

    fireEvent.click(tiles[1]);
    expect(onImageClick).toHaveBeenCalledWith('https://cdn.example.com/2.jpg');

    const viewAllBtn = screen.getByRole('button', { name: /Xem tất cả 6 ảnh/i });
    fireEvent.click(viewAllBtn);
    expect(onImageClick).toHaveBeenCalledWith('https://cdn.example.com/1.jpg');
  });

  it('adapts mosaic layout cleanly for 3 photos, 1 photo, and 0 photos', () => {
    const threePhotos = makePhotographer({
      pkgImages: ['https://cdn.example.com/a.jpg'],
      portfolioItemImages: [
        'https://cdn.example.com/b.jpg',
        'https://cdn.example.com/c.jpg',
      ],
    });
    const { rerender } = render(
      <MemoryRouter>
        <PhotographerPackageDetailLayout {...buildProps(threePhotos)} />
      </MemoryRouter>,
    );

    let gallery = screen.getByLabelText('Bộ ảnh gói chụp');
    expect(gallery.querySelector('.ppd-mosaic--three')).toBeTruthy();
    expect(gallery.querySelectorAll('.ppd-mosaic-tile')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Xem tất cả 3 ảnh/i })).toBeTruthy();

    const onePhoto = makePhotographer({
      pkgImages: ['https://cdn.example.com/only.jpg'],
    });
    rerender(
      <MemoryRouter>
        <PhotographerPackageDetailLayout {...buildProps(onePhoto)} />
      </MemoryRouter>,
    );
    gallery = screen.getByLabelText('Bộ ảnh gói chụp');
    expect(gallery.querySelector('.ppd-mosaic--single')).toBeTruthy();
    expect(gallery.querySelectorAll('.ppd-mosaic-tile')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Xem tất cả/i })).toBeNull();

    const zeroPhotos = makePhotographer({});
    rerender(
      <MemoryRouter>
        <PhotographerPackageDetailLayout {...buildProps(zeroPhotos)} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText('Studio đang cập nhật bộ ảnh cho gói này'),
    ).toBeTruthy();
  });
});
