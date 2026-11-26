import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffManagementPanel } from '../src/features/provider-dashboard/staff/StaffManagementPanel';

const mocks = vi.hoisted(() => ({
  requests: [] as Array<{ method: string; path: string; body?: unknown }>,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  staffListResponse: {
    summary: {
      totalStaff: 2,
      activeStaff: 2,
      inactiveStaff: 0,
      maxConcurrentSessions: 2,
      maxDailySessions: 6,
      effectiveCapacity: 2,
      activeTodayCount: 1,
      pendingAssignmentCount: 1,
    },
    items: [
      {
        _id: 'staff-1',
        providerId: 'prov-1',
        name: 'Minh Khoa',
        phone: '0901112222',
        avatarUrl: null,
        specialty: 'Áo dài Đại Nội',
        bio: 'Chụp tự nhiên',
        experienceYears: 5,
        internalNote: null,
        status: 'ACTIVE',
        sortOrder: 0,
        linkedUserId: 'user-staff-1',
        staffAccount: {
          email: 'khoa.staff@studio.vn',
          status: 'ACTIVE',
        },
        blockedSlots: [],
        metrics: {
          completedShoots: 12,
          completedThisMonth: 4,
          upcomingShoots: 2,
          todayShoots: 1,
          inProgressNow: false,
          disputeCount: 0,
          averageRating: 4.9,
          reviewCount: 8,
        },
      },
      {
        _id: 'staff-2',
        providerId: 'prov-1',
        name: 'Quốc Bảo',
        phone: '0903334444',
        avatarUrl: null,
        specialty: 'Ngoại cảnh Hoàng Thành',
        bio: null,
        experienceYears: 3,
        internalNote: null,
        status: 'ACTIVE',
        sortOrder: 1,
        linkedUserId: null,
        staffAccount: null,
        blockedSlots: [],
        metrics: {
          completedShoots: 6,
          completedThisMonth: 2,
          upcomingShoots: 1,
          todayShoots: 0,
          inProgressNow: false,
          disputeCount: 0,
          averageRating: null,
          reviewCount: 0,
        },
      },
    ],
  },
}));

vi.mock('../src/services/httpClient', () => {
  async function request(method: string, path: string, body?: unknown) {
    mocks.requests.push({ method, path, ...(body === undefined ? {} : { body }) });

    if (method === 'GET' && path === '/api/providers/me/staff') {
      return mocks.staffListResponse;
    }
    if (method === 'PATCH' && path === '/api/providers/me/staff/capacity') {
      return {
        activeStaffCount: 2,
        maxConcurrentSessions: 1,
        maxDailySessions: 4,
        effectiveCapacity: 1,
      };
    }
    if (method === 'POST' && path === '/api/providers/me/staff') {
      return {
        _id: 'staff-3',
        name: 'Lan Anh',
        linkedUserId: 'user-staff-3',
        staffAccount: {
          email: 'lananh@studio.vn',
          status: 'ACTIVE',
        },
        temporaryPassword: 'TempPass9988',
      };
    }
    if (method === 'POST' && path.endsWith('/blocks')) {
      return {
        _id: 'blk-1',
        date: '2026-12-25',
        startTime: null,
        endTime: null,
        reason: 'Nghỉ lễ',
      };
    }
    return {};
  }

  return {
    httpClient: {
      get: (path: string) => request('GET', path),
      post: (path: string, body?: unknown) => request('POST', path, body),
      patch: (path: string, body?: unknown) => request('PATCH', path, body),
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
});

describe('StaffManagementPanel (Phase 3 Studio Owner UI)', () => {
  it('loads 4 KPIs & staff roster and updates studio concurrency capacity', async () => {
    render(<StaffManagementPanel toast={mocks.toast} />);

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeTruthy();
      expect(screen.getByText('2 ca / khung giờ')).toBeTruthy();
      expect(screen.getByText('Minh Khoa')).toBeTruthy();
      expect(screen.getByText('Quốc Bảo')).toBeTruthy();
      expect(screen.getByText('TK STAFF: khoa.staff@studio.vn')).toBeTruthy();
    });

    const maxConcInput = screen.getByLabelText(/Số ca đồng thời tối đa/i) as HTMLInputElement;
    fireEvent.change(maxConcInput, { target: { value: '1' } });
    const maxDailyInput = screen.getByLabelText(/Giới hạn tối đa ca/i) as HTMLInputElement;
    fireEvent.change(maxDailyInput, { target: { value: '4' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Lưu sức chứa/i }));
    });

    const patchCall = mocks.requests.find(
      (r) => r.method === 'PATCH' && r.path === '/api/providers/me/staff/capacity',
    );
    expect(patchCall).toBeTruthy();
    expect(patchCall?.body).toEqual({
      maxConcurrentSessions: 1,
      maxDailySessions: 4,
    });
    expect(mocks.toast.success).toHaveBeenCalled();

    // Switch to Auto mode (2A) and verify maxConcurrentSessions: null is submitted
    fireEvent.click(screen.getByRole('radio', { name: /Tự động theo số thợ rảnh/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Lưu sức chứa/i }));
    });
    const autoPatchCall = [...mocks.requests]
      .reverse()
      .find(
        (r) => r.method === 'PATCH' && r.path === '/api/providers/me/staff/capacity',
      );
    expect(autoPatchCall?.body).toEqual({
      maxConcurrentSessions: null,
      maxDailySessions: 6,
    });

    // Verify amber misconfiguration warning appears when activeStaff >= 2 and daily limit <= activeStaff
    const dailyInputAgain = screen.getByLabelText(/Giới hạn tối đa ca/i) as HTMLInputElement;
    fireEvent.change(dailyInputAgain, { target: { value: '2' } });
    expect(screen.getByRole('status').textContent).toMatch(/TỔNG số ca của cả ngày/i);

    // Toggle daily limit OFF -> hides input and submits maxDailySessions: null
    fireEvent.click(
      screen.getByLabelText(/Bật giới hạn tổng số ca chụp trong 1 ngày/i),
    );
    expect(screen.queryByLabelText(/Giới hạn tối đa ca/i)).toBeNull();
    expect(screen.getByText(/Không giới hạn tổng ca\/ngày/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Lưu sức chứa/i }));
    });
    const unlimitedPatchCall = [...mocks.requests]
      .reverse()
      .find(
        (r) => r.method === 'PATCH' && r.path === '/api/providers/me/staff/capacity',
      );
    expect(unlimitedPatchCall?.body).toEqual({
      maxConcurrentSessions: 2,
      maxDailySessions: null,
    });
  });

  it('creates a new staff member with STAFF account and displays the one-time temporary password modal', async () => {
    render(<StaffManagementPanel toast={mocks.toast} />);

    await waitFor(() => {
      expect(screen.getByText('Minh Khoa')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Thêm thợ chụp mới/i }));

    fireEvent.change(screen.getByLabelText(/Họ và tên \*/i), {
      target: { value: 'Lan Anh' },
    });
    fireEvent.change(screen.getByLabelText(/Số điện thoại liên hệ \*/i), {
      target: { value: '0908889999' },
    });
    fireEvent.click(
      screen.getByLabelText(/Cấp luôn tài khoản đăng nhập riêng/i),
    );
    fireEvent.change(screen.getByLabelText(/Email đăng nhập STAFF \*/i), {
      target: { value: 'lananh@studio.vn' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Thêm thợ chụp$/i }));
    });

    const createCall = mocks.requests.find(
      (r) => r.method === 'POST' && r.path === '/api/providers/me/staff',
    );
    expect(createCall).toBeTruthy();
    expect(createCall?.body).toMatchObject({
      name: 'Lan Anh',
      phone: '0908889999',
      createAccount: true,
      email: 'lananh@studio.vn',
    });

    await waitFor(() => {
      const credsBox = screen.getByTestId('generated-staff-creds');
      expect(credsBox.textContent).toContain('lananh@studio.vn');
      expect(credsBox.textContent).toContain('TempPass9988');
    });
  });

  it('opens off-day modal and submits a blocked slot for a photographer', async () => {
    render(<StaffManagementPanel toast={mocks.toast} />);

    await waitFor(() => {
      expect(screen.getByText('Minh Khoa')).toBeTruthy();
    });

    const blockButtons = screen.getAllByRole('button', { name: /Lịch nghỉ/i });
    fireEvent.click(blockButtons[0]);

    fireEvent.change(screen.getByLabelText(/Ngày nghỉ \*/i), {
      target: { value: '2026-12-25' },
    });
    fireEvent.change(screen.getByLabelText(/Lý do/i), {
      target: { value: 'Nghỉ lễ' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Thêm lịch nghỉ$/i }));
    });

    const blockCall = mocks.requests.find(
      (r) =>
        r.method === 'POST' &&
        r.path === '/api/providers/me/staff/staff-1/blocks',
    );
    expect(blockCall).toBeTruthy();
    expect(blockCall?.body).toEqual({
      date: '2026-12-25',
      reason: 'Nghỉ lễ',
    });
  });
});
