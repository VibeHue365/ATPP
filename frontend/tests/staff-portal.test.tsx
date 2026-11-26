import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffPortalPage } from '../src/pages/staff/StaffPortalPage';

const mocks = vi.hoisted(() => ({
  user: {
    id: 'staff-user-1',
    roles: ['STAFF'],
    fullName: 'Minh Khoa',
  } as any,
  isAuthenticated: true as boolean | undefined,
  navigate: vi.fn(),
  logout: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  requests: [] as Array<{ method: string; path: string; body?: unknown }>,
  blockedSlotsState: [] as Array<{
    _id: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
  }>,
  schedulesState: [
    {
      scheduleId: 'sch-1',
      bookingId: 'bk-1',
      bookingCode: 'TG-2026-888',
      bookingStatus: 'CONFIRMED',
      scheduleStatus: 'CONFIRMED',
      providerLocalDate: '2026-12-20',
      startsAt: '2026-12-20T01:00:00Z',
      endsAt: '2026-12-20T03:00:00Z',
      timeSlot: '08:00 - 10:00',
      locationAddress: 'Ngọ Môn, Huế',
      locationSnapshot: { address: 'Ngọ Môn, Huế', geo: null },
      packageName: 'Gói Đại Nội Classic',
      customer: {
        userId: 'cust-1',
        fullName: 'Nguyễn An',
        avatarUrl: null,
        phone: '0911222333',
      },
      customerNote: 'Mang theo nón lá',
      checkedInAt: null as string | null,
      shootFinishedAt: null as string | null,
      staffFieldNote: null as string | null,
      canCheckIn: true,
      canFinishShoot: false,
    },
  ],
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    isAuthenticated: mocks.isAuthenticated,
    logout: mocks.logout,
  }),
}));

vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mocks.toast,
}));

vi.mock('../src/services/chatService', () => ({
  chatService: {
    getOrCreateRoom: vi.fn().mockResolvedValue({ id: 'room-staff-cust-1' }),
  },
}));

vi.mock('../src/services/httpClient', () => {
  async function request(method: string, path: string, body?: unknown) {
    mocks.requests.push({ method, path, ...(body === undefined ? {} : { body }) });

    if (method === 'GET' && path === '/api/staff/profile') {
      return {
        staff: {
          _id: 'staff-1',
          name: 'Minh Khoa',
          phone: '0901112222',
          specialty: 'Áo dài Đại Nội',
          status: 'ACTIVE',
          blockedSlots: mocks.blockedSlotsState,
        },
        studio: {
          _id: 'prov-1',
          ownerUserId: 'owner-1',
          businessName: 'Hue Heritage Studio',
        },
        metrics: {
          todayShoots: 1,
          upcomingShoots: 2,
          completedThisMonth: 5,
        },
      };
    }

    if (method === 'GET' && path.startsWith('/api/staff/my-schedules')) {
      return {
        staff: { _id: 'staff-1', name: 'Minh Khoa' },
        studio: { _id: 'prov-1', businessName: 'Hue Heritage Studio' },
        items: mocks.schedulesState,
      };
    }

    if (method === 'POST' && path === '/api/staff/check-in-photo') {
      return { url: 'https://cdn.test/staff-checkins/arrival.jpg' };
    }

    if (method === 'POST' && path === '/api/staff/schedules/sch-1/check-in') {
      const payload = (body || {}) as Record<string, any>;
      mocks.schedulesState = mocks.schedulesState.map((s) =>
        s.scheduleId === 'sch-1'
          ? {
              ...s,
              bookingStatus: 'IN_PROGRESS',
              checkedInAt: '2026-12-20T01:05:00Z',
              checkInPhotoUrl: payload.photoUrl ?? null,
              canCheckIn: false,
              canFinishShoot: true,
            }
          : s,
      );
      return {
        scheduleId: 'sch-1',
        bookingId: 'bk-1',
        bookingCode: 'TG-2026-888',
        bookingStatus: 'IN_PROGRESS',
        checkedInAt: '2026-12-20T01:05:00Z',
        checkInPhotoUrl: payload.photoUrl ?? null,
        staffFieldNote: null,
      };
    }

    if (method === 'POST' && path === '/api/staff/schedules/sch-1/finish-shoot') {
      mocks.schedulesState = mocks.schedulesState.map((s) =>
        s.scheduleId === 'sch-1'
          ? {
              ...s,
              bookingStatus: 'IN_PROGRESS',
              shootFinishedAt: '2026-12-20T03:00:00Z',
              canCheckIn: false,
              canFinishShoot: false,
            }
          : s,
      );
      return {
        scheduleId: 'sch-1',
        bookingId: 'bk-1',
        bookingCode: 'TG-2026-888',
        bookingStatus: 'IN_PROGRESS',
        shootFinishedAt: '2026-12-20T03:00:00Z',
      };
    }

    if (method === 'POST' && path === '/api/staff/blocked-slots') {
      const payload = (body || {}) as Record<string, any>;
      const created = {
        _id: `blk-${mocks.blockedSlotsState.length + 1}`,
        date: payload.date,
        startTime: payload.startTime ?? null,
        endTime: payload.endTime ?? null,
        reason: payload.reason ?? null,
      };
      mocks.blockedSlotsState = [...mocks.blockedSlotsState, created];
      return created;
    }

    if (method === 'DELETE' && path.startsWith('/api/staff/blocked-slots/')) {
      const id = path.split('/').pop();
      mocks.blockedSlotsState = mocks.blockedSlotsState.filter((b) => b._id !== id);
      return { removed: true, blockId: id };
    }

    return {};
  }

  return {
    httpClient: {
      get: (path: string) => request('GET', path),
      post: (path: string, body?: unknown) => request('POST', path, body),
      delete: (path: string) => request('DELETE', path),
    },
  };
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requests = [];
  mocks.blockedSlotsState = [];
  mocks.isAuthenticated = true;
  mocks.user = {
    id: 'staff-user-1',
    roles: ['STAFF'],
    fullName: 'Minh Khoa',
  };
  mocks.schedulesState = [
    {
      scheduleId: 'sch-1',
      bookingId: 'bk-1',
      bookingCode: 'TG-2026-888',
      bookingStatus: 'CONFIRMED',
      scheduleStatus: 'CONFIRMED',
      providerLocalDate: '2026-12-20',
      startsAt: '2026-12-20T01:00:00Z',
      endsAt: '2026-12-20T03:00:00Z',
      timeSlot: '08:00 - 10:00',
      locationAddress: 'Ngọ Môn, Huế',
      locationSnapshot: { address: 'Ngọ Môn, Huế', geo: null },
      packageName: 'Gói Đại Nội Classic',
      customer: {
        userId: 'cust-1',
        fullName: 'Nguyễn An',
        avatarUrl: null,
        phone: '0911222333',
      },
      customerNote: 'Mang theo nón lá',
      checkedInAt: null,
      shootFinishedAt: null,
      staffFieldNote: null,
      canCheckIn: true,
      canFinishShoot: false,
    },
  ];
});

describe('StaffPortalPage (Phase 3 Isolated Staff View)', () => {
  it('renders assigned operational schedules without any financial or price UI and runs check-in + finish shoot', async () => {
    render(<StaffPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('TG-2026-888')).toBeTruthy();
      expect(screen.getByText('Gói Đại Nội Classic')).toBeTruthy();
      expect(screen.getByText('Ngọ Môn, Huế')).toBeTruthy();
      expect(screen.getByText('Nguyễn An')).toBeTruthy();
    });

    // Zero financial leakage on Staff portal
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('Ví');
    expect(bodyText).not.toContain('Doanh thu');
    expect(bodyText).not.toContain('Đặt cọc');
    expect(bodyText).not.toContain('Tổng tiền');

    // Step 1: Check-in requires arrival photo (no note textarea)
    fireEvent.click(screen.getByRole('button', { name: /Check-in bắt đầu chụp/i }));
    expect(screen.queryByPlaceholderText(/Ghi chú tại điểm hẹn/i)).toBeNull();
    const confirmCheckInBtn = screen.getByRole('button', {
      name: /Xác nhận Check-in/i,
    }) as HTMLButtonElement;
    expect(confirmCheckInBtn.disabled).toBe(true);

    const fileInput = screen.getByLabelText(/Tải ảnh xác nhận check-in/i);
    const fakePhoto = new File(['fake-jpeg'], 'arrival.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [fakePhoto] } });
    expect(confirmCheckInBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(confirmCheckInBtn);
    });

    const uploadReq = mocks.requests.find(
      (r) => r.method === 'POST' && r.path === '/api/staff/check-in-photo',
    );
    expect(uploadReq).toBeTruthy();

    const checkInReq = mocks.requests.find(
      (r) =>
        r.method === 'POST' && r.path === '/api/staff/schedules/sch-1/check-in',
    );
    expect(checkInReq).toBeTruthy();
    expect(checkInReq?.body).toEqual({
      photoUrl: 'https://cdn.test/staff-checkins/arrival.jpg',
    });

    // Step 2: Check-out becomes available (direct confirm without note required)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Check-out · Báo đã chụp xong/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Ảnh check-in/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Check-out · Báo đã chụp xong/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận Check-out/i }));
    });

    const finishReq = mocks.requests.find(
      (r) =>
        r.method === 'POST' &&
        r.path === '/api/staff/schedules/sch-1/finish-shoot',
    );
    expect(finishReq).toBeTruthy();
    expect(finishReq?.body).toEqual({});
  });

  it('redirects non-STAFF users (e.g. PROVIDER) away from /staff', async () => {
    mocks.user = {
      id: 'owner-1',
      roles: ['PROVIDER'],
      profile: { fullName: 'Chủ Studio' },
    };

    render(<StaffPortalPage />);

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalled();
      expect(mocks.navigate).toHaveBeenCalledWith('/provider/dashboard', {
        replace: true,
      });
    });
  });

  it('lets STAFF self-register and cancel busy blocked slots with zero financial strings', async () => {
    render(<StaffPortalPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Báo lịch bận/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Báo lịch bận/i }));
    await waitFor(() => {
      expect(screen.getByText('Đăng ký lịch bận / nghỉ phép')).toBeTruthy();
    });

    // Switch to time range mode & fill reason
    fireEvent.click(screen.getByRole('button', { name: 'Theo khung giờ' }));
    fireEvent.change(
      screen.getByPlaceholderText(/VD: Bận việc gia đình/i),
      { target: { value: 'Bảo dưỡng máy ảnh' } },
    );

    const modalBody = document.body.textContent || '';
    expect(modalBody).not.toContain('Ví');
    expect(modalBody).not.toContain('Doanh thu');
    expect(modalBody).not.toContain('Đặt cọc');
    expect(modalBody).not.toContain('Tổng tiền');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận lịch bận/i }));
    });

    const addReq = mocks.requests.find(
      (r) => r.method === 'POST' && r.path === '/api/staff/blocked-slots',
    );
    expect(addReq).toBeTruthy();
    expect(addReq?.body).toMatchObject({
      startTime: '08:00',
      endTime: '12:00',
      reason: 'Bảo dưỡng máy ảnh',
    });

    await waitFor(() => {
      expect(screen.getByText(/Bảo dưỡng máy ảnh/i)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hủy lịch bận/i }));
    });

    const delReq = mocks.requests.find(
      (r) => r.method === 'DELETE' && r.path === '/api/staff/blocked-slots/blk-1',
    );
    expect(delReq).toBeTruthy();
  });

  it('hides check-in button and shows approval waiting notice while booking is DEPOSIT_PAID', async () => {
    mocks.schedulesState = [
      {
        ...mocks.schedulesState[0],
        bookingCode: 'BK-WAIT-99',
        bookingStatus: 'DEPOSIT_PAID',
        canCheckIn: false,
        canFinishShoot: false,
        checkInBlockedReason:
          'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.',
      } as any,
    ];

    render(<StaffPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('BK-WAIT-99')).toBeTruthy();
      expect(screen.getByText('Chờ Chủ Studio duyệt')).toBeTruthy();
      expect(
        screen.getByText(
          'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.',
        ),
      ).toBeTruthy();
    });

    expect(
      screen.queryByRole('button', { name: /Check-in bắt đầu chụp/i }),
    ).toBeNull();

    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('Ví');
    expect(bodyText).not.toContain('Doanh thu');
    expect(bodyText).not.toContain('Đặt cọc');
    expect(bodyText).not.toContain('Tổng tiền');
  });
});
