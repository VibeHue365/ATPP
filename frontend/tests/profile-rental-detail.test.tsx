import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileRentalDetailPage } from '../src/features/profile/components/rental-detail/ProfileRentalDetailPage';
import { ProfilePage } from '../src/pages/dashboard/ProfilePage';

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { _id: 'user-1', fullName: 'Nguyen Van A', roles: ['CUSTOMER'] },
    logout: vi.fn(),
  }),
}));

vi.mock('../src/context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
    showLoading: vi.fn(),
    showValidationMessage: vi.fn(),
  },
}));

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

const mockBookingWithObjectAddress: any = {
  _id: '6735e123456789abcdef0123',
  bookingCode: 'B7318383185',
  status: 'PICKUP_PENDING',
  bookingType: 'PRODUCT',
  handoverPhotos: [
    'https://example.com/handover-1.jpg',
    '/uploads/handover-2.jpg',
  ],
  pricingSummary: {
    subTotal: 250000,
    serviceFee: 30000,
    depositTotal: 500000,
    grandTotal: 780000,
  },
  providerIds: [
    {
      _id: 'provider-1',
      businessName: 'Cửa hàng LUMÉ Huế',
      address: {
        addressLine: '15 Lê Lợi',
        ward: 'Phú Hội',
        city: 'TP. Huế',
      },
    },
  ],
  items: [
    {
      _id: 'item-1',
      itemType: 'PRODUCT',
      name: 'Ao dai rong',
      selectedSize: 'XL',
      selectedColor: 'RED',
      unitPrice: 250000,
      quantity: 1,
      depositAmount: 500000,
      shootDate: '2026-11-24',
      shootTimeSlot: '07:00-08:00',
      rentalFrom: '2026-11-24T00:00:00.000Z',
      rentalTo: '2026-11-24T11:00:00.000Z',
      pickupReturnLocationSnapshot: null,
      productId: {
        _id: 'prod-1',
        name: 'Ao dai rong',
        brand: 'LUMÉ',
        colors: ['RED', 'BLUE'],
        materials: ['Lụa gấm'],
        images: ['https://example.com/image.jpg'],
      },
    },
  ],
  createdAt: '2026-11-14T14:35:42.000Z',
};

describe('ProfileRentalDetailPage address object regression test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bookings') return Promise.resolve([mockBookingWithObjectAddress]);
      return Promise.resolve(null);
    });
    mockPost.mockResolvedValue({});
  });

  it('renders ProfileRentalDetailPage successfully with provider.address as object without crashing', () => {
    const { container } = render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
      />
    );

    expect(container).toBeDefined();
    expect(screen.getByText('B7318383185')).toBeDefined();
    expect(screen.getByText('Ao dai rong')).toBeDefined();
    expect(screen.getByText('15 Lê Lợi, Phú Hội, TP. Huế')).toBeDefined();
    expect(screen.getByText('Cửa hàng LUMÉ Huế')).toBeDefined();
    expect(screen.getByText('Lụa gấm')).toBeDefined();
  });

  // full ProfilePage with lazy parts: allow 5 s per step (the coverage run is several times slower)
  it('renders ProfilePage and navigates to detail view on click without white screen', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/profile?tab=schedule&category=rental']}>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ao dai rong')).toBeDefined();
    }, { timeout: 5000 });

    const detailBtn = screen.getByRole('button', { name: /Chi tiết/i });
    fireEvent.click(detailBtn);

    await waitFor(() => {
      expect(screen.getByText('Xem chi tiết')).toBeDefined();
    }, { timeout: 5000 });

    const viewDetailBtn = screen.getByText('Xem chi tiết');
    fireEvent.click(viewDetailBtn);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết lịch thuê')).toBeDefined();
      expect(screen.getByText('15 Lê Lợi, Phú Hội, TP. Huế')).toBeDefined();
    }, { timeout: 5000 });
  });
});

describe('Customer Pickup Inspection and Reporting Workflow Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/bookings') return Promise.resolve([mockBookingWithObjectAddress]);
      return Promise.resolve(null);
    });
    mockPost.mockResolvedValue({});
  });

  it('1. PICKUP_PENDING with handoverPhotos displays shop photos and all 3 action buttons', () => {
    render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
      />
    );

    // Inspection header and instructions
    expect(screen.getByText('Kiểm tra áo khi nhận')).toBeDefined();
    expect(screen.getByText(/Vui lòng so sánh ảnh shop cung cấp/i)).toBeDefined();

    // 2 shop handover photos
    expect(screen.getByText(/Ảnh bàn giao từ Shop \(2 ảnh\):/i)).toBeDefined();
    const handoverImgs = screen.getAllByAltText(/Ảnh shop bàn giao/i);
    expect(handoverImgs.length).toBe(2);

    // 3 action buttons in inspection area or bottom bar
    expect(screen.getAllByText(/Áo đúng tình trạng/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Có vấn đề nhưng vẫn nhận/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Từ chối nhận áo/i).length).toBeGreaterThan(0);
  });

  it('2. READY_FOR_PICKUP without handoverPhotos hides inspection area and shows waiting notice', () => {
    const readyBooking = {
      ...mockBookingWithObjectAddress,
      status: 'READY_FOR_PICKUP',
      handoverPhotos: [],
    };

    render(
      <ProfileRentalDetailPage
        booking={readyBooking}
        onBack={() => {}}
      />
    );

    expect(screen.queryByText('Kiểm tra áo khi nhận')).toBeNull();
    expect(screen.getByText(/Cửa hàng đang chuẩn bị bàn giao áo dài/i)).toBeDefined();
    expect(screen.getByText(/Chụp \/ Tải CCCD \(2 mặt\)/i)).toBeDefined();
  });

  it('3. Confirm pickup flow calls customer-confirm-pickup and triggers refresh', async () => {
    const onRefreshBooking = vi.fn();
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/customer-confirm-pickup')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({});
    });

    render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
        onRefreshBooking={onRefreshBooking}
      />
    );

    // Click confirm pickup button
    const confirmButtons = screen.getAllByText(/Áo đúng tình trạng/i);
    fireEvent.click(confirmButtons[0]);

    // Modal appears with title
    await waitFor(() => {
      expect(screen.getByText('Xác nhận đã nhận áo')).toBeDefined();
      expect(screen.getByText(/Bạn xác nhận đã kiểm tra áo và phụ kiện/i)).toBeDefined();
    });

    // Submit confirm
    const submitBtn = screen.getByRole('button', { name: 'Xác nhận nhận áo' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        `/bookings/${mockBookingWithObjectAddress._id}/customer-confirm-pickup`,
        { evidencePhotos: undefined }
      );
      expect(onRefreshBooking).toHaveBeenCalled();
    });
  });

  it('4. Report damage flow validates required description and photos, then calls customer-report-damage', async () => {
    const onRefreshBooking = vi.fn();
    mockPost.mockImplementation((url: string) => {
      if (url === '/bookings/upload-reference') {
        return Promise.resolve({ url: 'https://example.com/uploaded-evidence.jpg' });
      }
      if (url.includes('/customer-report-damage')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({});
    });

    render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
        onRefreshBooking={onRefreshBooking}
      />
    );

    // Open damage report modal
    const damageButtons = screen.getAllByText(/Có vấn đề nhưng vẫn nhận/i);
    fireEvent.click(damageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Báo cáo tình trạng có sẵn khi nhận áo')).toBeDefined();
      expect(screen.getByText(/Báo cáo được ghi nhận là tình trạng có sẵn trước khi thuê/i)).toBeDefined();
    });

    // 4a. Validation: submit empty form
    const submitBtn = screen.getByRole('button', { name: 'Gửi báo cáo & Nhận đồ' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Vui lòng nhập mô tả chi tiết lỗi/i)).toBeDefined();
    });

    // 4b. Validation: enter text but no photos
    const textarea = document.getElementById('pickup-report-desc') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Áo bị sờn chỉ ở gấu tà sau' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/bắt buộc phải có ít nhất 1 hình ảnh/i)).toBeDefined();
    });

    // 4c. Upload photo and submit
    const fileInput = document.getElementById('pickup-modal-file-upload') as HTMLInputElement;
    const testFile = new File(['dummy image content'], 'stain.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Submit now passes
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/bookings/upload-reference', expect.any(FormData));
      expect(mockPost).toHaveBeenCalledWith(
        `/bookings/${mockBookingWithObjectAddress._id}/customer-report-damage`,
        {
          description: 'Áo bị sờn chỉ ở gấu tà sau',
          evidencePhotos: ['https://example.com/uploaded-evidence.jpg'],
        }
      );
      expect(onRefreshBooking).toHaveBeenCalled();
    });
  });

  it('5. Reject handover flow validates required reason and photos, then calls customer-reject-handover', async () => {
    const onRefreshBooking = vi.fn();
    mockPost.mockImplementation((url: string) => {
      if (url === '/bookings/upload-reference') {
        return Promise.resolve({ url: 'https://example.com/reject-proof.jpg' });
      }
      if (url.includes('/customer-reject-handover')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({});
    });

    render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
        onRefreshBooking={onRefreshBooking}
      />
    );

    // Open reject handover modal
    const rejectButtons = screen.getAllByText(/Từ chối nhận áo/i);
    fireEvent.click(rejectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Từ chối nhận áo & Chuyển tranh chấp')).toBeDefined();
      expect(screen.getByText(/Đơn sẽ được chuyển sang quy trình tranh chấp để Admin đối soát/i)).toBeDefined();
    });

    // 5a. Validation: empty reason
    const submitBtn = screen.getByRole('button', { name: 'Từ chối nhận & Mở tranh chấp' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Vui lòng nhập lý do từ chối/i)).toBeDefined();
    });

    // 5b. Validation: reason with 0 photos
    const textarea = document.getElementById('pickup-report-desc') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Giao nhầm sai hoàn toàn mẫu áo đã đặt' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/bắt buộc phải có ít nhất 1 hình ảnh/i)).toBeDefined();
    });

    // 5c. Upload photo and submit
    const fileInput = document.getElementById('pickup-modal-file-upload') as HTMLInputElement;
    const testFile = new File(['wrong sample'], 'wrong.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/bookings/upload-reference', expect.any(FormData));
      expect(mockPost).toHaveBeenCalledWith(
        `/bookings/${mockBookingWithObjectAddress._id}/customer-reject-handover`,
        {
          reason: 'Giao nhầm sai hoàn toàn mẫu áo đã đặt',
          evidencePhotos: ['https://example.com/reject-proof.jpg'],
        }
      );
      expect(onRefreshBooking).toHaveBeenCalled();
    });
  });

  it('6. Photo upload error stops submission and displays user-friendly error message', async () => {
    mockPost.mockImplementation((url: string) => {
      if (url === '/bookings/upload-reference') {
        return Promise.reject(new Error('Network upload failed'));
      }
      return Promise.resolve({});
    });

    render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
      />
    );

    const damageButtons = screen.getAllByText(/Có vấn đề nhưng vẫn nhận/i);
    fireEvent.click(damageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Báo cáo tình trạng có sẵn khi nhận áo')).toBeDefined();
    });

    const textarea = document.getElementById('pickup-report-desc') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Bị rách chỉ' } });

    const fileInput = document.getElementById('pickup-modal-file-upload') as HTMLInputElement;
    const testFile = new File(['stain data'], 'stain.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const submitBtn = screen.getByRole('button', { name: 'Gửi báo cáo & Nhận đồ' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải lên ảnh "stain.png"/i)).toBeDefined();
    });

    // customer-report-damage MUST NOT have been called
    expect(mockPost).not.toHaveBeenCalledWith(
      expect.stringContaining('/customer-report-damage'),
      expect.anything()
    );
  });

  it('7. When status is PICKED_UP, RETURNED, COMPLETED, CANCELLED, or DISPUTED, pickup actions are hidden', () => {
    const hiddenStatuses = ['PICKED_UP', 'RETURN_PENDING', 'RETURNED', 'COMPLETED', 'CANCELLED', 'DISPUTED'];

    for (const status of hiddenStatuses) {
      const { unmount } = render(
        <ProfileRentalDetailPage
          booking={{
            ...mockBookingWithObjectAddress,
            status,
          }}
          onBack={() => {}}
        />
      );

      // Inspection card must not be present
      expect(screen.queryByText('Kiểm tra áo khi nhận')).toBeNull();
      // The 3 pickup actions must not be present
      expect(screen.queryByText(/Áo đúng tình trạng/i)).toBeNull();
      expect(screen.queryByText(/Có vấn đề nhưng vẫn nhận/i)).toBeNull();
      expect(screen.queryByText(/Từ chối nhận áo/i)).toBeNull();

      unmount();
    }
  });

  it('8. Displays read-only pickupDamageReport card when report is already present', () => {
    const bookingWithDamageReport = {
      ...mockBookingWithObjectAddress,
      status: 'PICKED_UP',
      pickupDamageReport: {
        reportedAt: '2026-11-24T07:15:00.000Z',
        description: 'Vết ố mờ ở viền cổ áo và sờn chỉ tay trái',
        evidencePhotos: [
          'https://example.com/damage-collar.jpg',
          '/uploads/damage-sleeve.jpg',
        ],
      },
    };

    render(
      <ProfileRentalDetailPage
        booking={bookingWithDamageReport}
        onBack={() => {}}
      />
    );

    // Damage report card is rendered
    expect(screen.getByText('Tình Trạng Có Sẵn Được Ghi Nhận Khi Nhận Áo')).toBeDefined();
    expect(screen.getByText(/"Vết ố mờ ở viền cổ áo và sờn chỉ tay trái"/i)).toBeDefined();
    expect(screen.getByText(/Hình ảnh hiện trạng bạn đã chụp \(2 ảnh\):/i)).toBeDefined();

    // 2 evidence photos
    const evidenceImages = screen.getAllByAltText(/Ảnh bằng chứng/i);
    expect(evidenceImages.length).toBe(2);

    // Cannot submit duplicate damage report
    expect(screen.queryByText('Kiểm tra áo khi nhận')).toBeNull();
  });

  it('9. Correctly resolves absolute and relative image URLs for handover photos and damage evidence', () => {
    const bookingWithMixedPhotos = {
      ...mockBookingWithObjectAddress,
      handoverPhotos: [
        'https://res.cloudinary.com/demo/image/upload/dress.jpg',
        '/uploads/local-handover.jpg',
      ],
      pickupDamageReport: {
        reportedAt: '2026-11-24T07:15:00.000Z',
        description: 'Áo có vết bẩn',
        evidencePhotos: [
          'https://res.cloudinary.com/demo/image/upload/evidence.jpg',
          '/uploads/local-damage.jpg',
        ],
      },
    };

    render(
      <ProfileRentalDetailPage
        booking={bookingWithMixedPhotos}
        onBack={() => {}}
      />
    );

    const handoverImgs = screen.getAllByAltText(/Ảnh shop bàn giao/i) as HTMLImageElement[];
    expect(handoverImgs[0].src).toBe('https://res.cloudinary.com/demo/image/upload/dress.jpg');
    expect(handoverImgs[1].src).toContain('/uploads/local-handover.jpg');

    const damageImgs = screen.getAllByAltText(/Ảnh bằng chứng/i) as HTMLImageElement[];
    expect(damageImgs[0].src).toBe('https://res.cloudinary.com/demo/image/upload/evidence.jpg');
    expect(damageImgs[1].src).toContain('/uploads/local-damage.jpg');
  });

  it('10. Prevents double-submit while submission is in-flight', async () => {
    let resolvePost: any;
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/customer-confirm-pickup')) {
        return new Promise((resolve) => {
          resolvePost = resolve;
        });
      }
      return Promise.resolve({});
    });

    render(
      <ProfileRentalDetailPage
        booking={mockBookingWithObjectAddress}
        onBack={() => {}}
      />
    );

    const confirmButtons = screen.getAllByText(/Áo đúng tình trạng/i);
    fireEvent.click(confirmButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận đã nhận áo')).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận nhận áo' });
    fireEvent.click(submitBtn);

    // During in-flight request, submit button is disabled
    await waitFor(() => {
      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('Đang xử lý yêu cầu...')).toBeDefined();
    });

    // Secondary click attempt
    fireEvent.click(submitBtn);

    // Only 1 call was dispatched
    expect(mockPost).toHaveBeenCalledTimes(1);

    // Resolve the promise
    resolvePost({ success: true });
  });

  it('11. When status is PICKED_UP, neither "Gia hạn thời gian" nor "Đổi lịch hẹn" is displayed', () => {
    render(
      <ProfileRentalDetailPage
        booking={{
          ...mockBookingWithObjectAddress,
          status: 'PICKED_UP',
        }}
        onBack={() => {}}
      />
    );

    expect(screen.queryByText(/Gia hạn/i)).toBeNull();
    expect(screen.queryByText(/Đổi hoặc gia hạn/i)).toBeNull();
    expect(screen.queryByText(/Đổi lịch hẹn/i)).toBeNull();
  });

  it('12. When status is CONFIRMED and >=24h ahead, "Đổi lịch hẹn" is shown in header and "Gia hạn thời gian" is absent', () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    render(
      <ProfileRentalDetailPage
        booking={{
          ...mockBookingWithObjectAddress,
          status: 'CONFIRMED',
          rentalFrom: futureDate,
          // the page reads the pickup date from the item first; the fixture item date (24/11/2026) is now in the past
          items: [
            {
              ...mockBookingWithObjectAddress.items[0],
              rentalFrom: futureDate,
              shootDate: null,
            },
          ],
        }}
        onBack={() => {}}
      />
    );

    expect(screen.getByText('Đổi lịch hẹn')).toBeDefined();
    expect(screen.queryByText(/Gia hạn/i)).toBeNull();
  });

  it('13. When status is CONFIRMED but <24h ahead, "Đổi lịch hẹn" is safely hidden', () => {
    const nearDate = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    render(
      <ProfileRentalDetailPage
        booking={{
          ...mockBookingWithObjectAddress,
          status: 'CONFIRMED',
          items: [
            {
              ...mockBookingWithObjectAddress.items[0],
              rentalFrom: nearDate,
              shootDate: null,
            },
          ],
        }}
        onBack={() => {}}
      />
    );

    expect(screen.queryByText('Đổi lịch hẹn')).toBeNull();
    expect(screen.queryByText(/Gia hạn/i)).toBeNull();
  });

  it('14. When status is PENDING_PAYMENT or WAITING_PAYMENT, "Tiếp tục thanh toán" button is displayed', () => {
    const onContinuePayment = vi.fn();
    const { unmount } = render(
      <ProfileRentalDetailPage
        booking={{
          ...mockBookingWithObjectAddress,
          status: 'PENDING_PAYMENT',
        }}
        onBack={() => {}}
        onContinuePayment={onContinuePayment}
      />
    );

    const payBtn = screen.getByText('Tiếp tục thanh toán');
    expect(payBtn).toBeDefined();
    fireEvent.click(payBtn);
    expect(onContinuePayment).toHaveBeenCalledTimes(1);

    unmount();

    // Also verify WAITING_PAYMENT
    render(
      <ProfileRentalDetailPage
        booking={{
          ...mockBookingWithObjectAddress,
          status: 'WAITING_PAYMENT',
        }}
        onBack={() => {}}
      />
    );
    expect(screen.getByText('Tiếp tục thanh toán')).toBeDefined();
  });
});
