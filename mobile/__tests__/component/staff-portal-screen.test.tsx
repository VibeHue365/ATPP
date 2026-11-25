import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockShowToast = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockCreateRoom = jest.fn();
const mockGetProfile = jest.fn();
const mockGetMySchedules = jest.fn();
const mockCheckIn = jest.fn();
const mockFinishShoot = jest.fn();
const mockAddBlockedSlot = jest.fn();
const mockRemoveBlockedSlot = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: any[]) => mockPush(...args),
    replace: (...args: any[]) => mockReplace(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'staff-u1', fullName: 'Nguyễn Minh Tuấn', roles: ['STAFF'] },
    logout: mockLogout,
  }),
}));

jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

jest.mock('@/apis/staffPortalApi', () => ({
  staffPortalApi: {
    getProfile: (...args: any[]) => mockGetProfile(...args),
    getMySchedules: (...args: any[]) => mockGetMySchedules(...args),
    checkIn: (...args: any[]) => mockCheckIn(...args),
    finishShoot: (...args: any[]) => mockFinishShoot(...args),
    addBlockedSlot: (...args: any[]) => mockAddBlockedSlot(...args),
    removeBlockedSlot: (...args: any[]) => mockRemoveBlockedSlot(...args),
  },
}));

jest.mock('@/apis/chatApi', () => ({
  chatApi: {
    createRoom: (...args: any[]) => mockCreateRoom(...args),
  },
}));

jest.mock('@/utils/geo', () => ({
  openExternalDirections: jest.fn(),
}));

import { StaffPortalScreen } from '@/app/staff/index';

describe('Mobile StaffPortalScreen (Isolated STAFF)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      staff: {
        _id: 'staff-1',
        name: 'Nguyễn Minh Tuấn',
        phone: '0905123456',
        specialty: 'Cổ phục Hoàng Thành',
        status: 'ACTIVE',
        blockedSlots: [],
      },
      studio: {
        _id: 'studio-1',
        ownerUserId: 'owner-u1',
        businessName: 'Studio Áo Dài Cố Đô',
        phone: '0909888777',
      },
      metrics: {
        todayShoots: 1,
        upcomingShoots: 2,
        completedThisMonth: 7,
      },
    });
    mockCreateRoom.mockResolvedValue({ id: 'room-77' });
    mockCheckIn.mockResolvedValue({ bookingStatus: 'IN_PROGRESS' });
    mockFinishShoot.mockResolvedValue({ bookingStatus: 'IN_PROGRESS' });
  });

  it('renders operational KPIs and schedules without exposing financial figures and runs check-in & chat', async () => {
    mockGetMySchedules.mockResolvedValue({
      staff: { _id: 'staff-1', name: 'Nguyễn Minh Tuấn' },
      studio: {
        _id: 'studio-1',
        ownerUserId: 'owner-u1',
        businessName: 'Studio Áo Dài Cố Đô',
      },
      items: [
        {
          scheduleId: 'sched-1',
          bookingId: 'bk-1',
          bookingCode: 'VH-2026-01',
          bookingStatus: 'CONFIRMED',
          scheduleStatus: 'BOOKED',
          providerLocalDate: '2026-12-01',
          startsAt: '2026-12-01T08:00:00.000Z',
          endsAt: '2026-12-01T10:00:00.000Z',
          timeSlot: '08:00-10:00',
          locationAddress: 'Đại Nội Huế',
          packageName: 'Gói Hoàng Thành VIP',
          customer: {
            userId: 'cust-u1',
            fullName: 'Trần Thảo Vy',
            phone: '0912345678',
          },
          customerNote: 'Mang theo quạt lụa',
          canCheckIn: true,
          canFinishShoot: false,
        },
      ],
    });

    const view = await render(<StaffPortalScreen />);

    await waitFor(() => {
      expect(view.getByText('Nguyễn Minh Tuấn')).toBeTruthy();
      expect(view.getByText('#VH-2026-01')).toBeTruthy();
      expect(view.getByText('Gói Hoàng Thành VIP')).toBeTruthy();
      expect(view.getByText('Trần Thảo Vy')).toBeTruthy();
    });

    // Strict Zero-Finance verification
    expect(view.queryByText(/doanh thu/i)).toBeNull();
    expect(view.queryByText(/tiền cọc/i)).toBeNull();
    expect(view.queryByText(/số dư ví/i)).toBeNull();

    // Open customer chat
    await fireEvent.press(view.getByText('Chat khách'));
    await waitFor(() => {
      expect(mockCreateRoom).toHaveBeenCalledWith('cust-u1');
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/chat/[id]',
        params: { id: 'room-77', name: 'Trần Thảo Vy' },
      });
    });

    // Check-in workflow
    await fireEvent.press(view.getByText('Check-in & Bắt đầu chụp'));
    await waitFor(() => {
      expect(view.getByText('Xác nhận Check-in & Bắt đầu chụp')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Xác nhận'));
    await waitFor(() => {
      expect(mockCheckIn).toHaveBeenCalledWith('sched-1', { note: undefined });
    });
  });

  it('executes finishShoot flow and preserves IN_PROGRESS handover notice', async () => {
    mockGetMySchedules.mockResolvedValue({
      staff: { _id: 'staff-1', name: 'Nguyễn Minh Tuấn' },
      studio: null,
      items: [
        {
          scheduleId: 'sched-2',
          bookingId: 'bk-2',
          bookingCode: 'VH-2026-02',
          bookingStatus: 'IN_PROGRESS',
          scheduleStatus: 'BOOKED',
          providerLocalDate: '2026-12-01',
          startsAt: '2026-12-01T14:00:00.000Z',
          endsAt: '2026-12-01T16:00:00.000Z',
          timeSlot: '14:00-16:00',
          locationAddress: 'Cung An Định',
          packageName: 'Gói Nàng Thơ',
          customer: {
            userId: 'cust-u2',
            fullName: 'Lê Bảo Ngọc',
          },
          checkedInAt: '2026-12-01T07:05:00.000Z',
          canCheckIn: false,
          canFinishShoot: true,
        },
      ],
    });

    const view = await render(<StaffPortalScreen />);

    await waitFor(() => {
      expect(view.getByText('Hoàn tất ca chụp')).toBeTruthy();
    });

    await fireEvent.press(view.getByText('Hoàn tất ca chụp'));
    await waitFor(() => {
      expect(view.getByText('Xác nhận Hoàn tất buổi chụp')).toBeTruthy();
    });
    await fireEvent.press(view.getByText('Xác nhận'));
    await waitFor(() => {
      expect(mockFinishShoot).toHaveBeenCalledWith('sched-2', { note: undefined });
    });
  });

  it('allows STAFF to self-register and remove blocked slots inside Lịch nghỉ tab', async () => {
    mockGetProfile.mockResolvedValue({
      staff: {
        _id: 'staff-1',
        name: 'Nguyễn Minh Tuấn',
        phone: '0905123456',
        specialty: 'Cổ phục Hoàng Thành',
        status: 'ACTIVE',
        blockedSlots: [
          {
            _id: 'blk-1',
            date: '2026-12-22',
            startTime: '08:00',
            endTime: '12:00',
            reason: 'Khám sức khỏe',
          },
        ],
      },
      studio: {
        _id: 'studio-1',
        ownerUserId: 'owner-u1',
        businessName: 'Studio Áo Dài Cố Đô',
      },
      metrics: { todayShoots: 0, upcomingShoots: 0, completedThisMonth: 0 },
    });
    mockGetMySchedules.mockResolvedValue({
      staff: { _id: 'staff-1', name: 'Nguyễn Minh Tuấn' },
      studio: null,
      items: [],
    });
    mockAddBlockedSlot.mockResolvedValue({
      _id: 'blk-2',
      date: '2026-12-25',
      startTime: null,
      endTime: null,
      reason: 'Nghỉ lễ',
    });
    mockRemoveBlockedSlot.mockResolvedValue({ removed: true, blockId: 'blk-1' });

    const view = await render(<StaffPortalScreen />);

    await waitFor(() => {
      expect(view.getByText('Lịch nghỉ (1)')).toBeTruthy();
    });

    await fireEvent.press(view.getByText('Lịch nghỉ (1)'));
    await waitFor(() => {
      expect(view.getByText('Báo lịch bận')).toBeTruthy();
      expect(view.getByText('Khám sức khỏe')).toBeTruthy();
    });

    // Remove existing blocked slot
    await fireEvent.press(view.getByText('Gỡ'));
    await waitFor(() => {
      expect(mockRemoveBlockedSlot).toHaveBeenCalledWith('blk-1');
    });

    // Open modal and add a new blocked slot
    await fireEvent.press(view.getByText('Báo lịch bận'));
    await waitFor(() => {
      expect(view.getByText('Đăng ký lịch bận / nghỉ phép')).toBeTruthy();
    });
    await fireEvent.changeText(
      view.getByPlaceholderText('2026-12-01'),
      '2026-12-25',
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('VD: Bận việc gia đình, bảo dưỡng thiết bị...'),
      'Nghỉ lễ',
    );
    await fireEvent.press(view.getByText('Xác nhận lịch bận'));

    await waitFor(() => {
      expect(mockAddBlockedSlot).toHaveBeenCalledWith({
        date: '2026-12-25',
        reason: 'Nghỉ lễ',
      });
    });
  });

  it('locks Check-in button and displays approval notice while booking is DEPOSIT_PAID', async () => {
    mockGetMySchedules.mockResolvedValue({
      staff: { _id: 'staff-1', name: 'Nguyễn Minh Tuấn' },
      studio: null,
      items: [
        {
          scheduleId: 'sched-wait',
          bookingId: 'bk-wait',
          bookingCode: 'BK-WAIT-01',
          bookingStatus: 'DEPOSIT_PAID',
          scheduleStatus: 'CONFIRMED',
          providerLocalDate: '2026-12-26',
          startsAt: '2026-12-26T02:00:00.000Z',
          endsAt: '2026-12-26T03:00:00.000Z',
          timeSlot: '09:00 - 10:00',
          locationAddress: 'Lăng Khải Định, Huế',
          packageName: 'Gói Chụp Nghệ Thuật',
          customer: {
            userId: 'cust-u1',
            fullName: 'Ding Le',
          },
          canCheckIn: false,
          checkInBlockedReason:
            'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.',
          canFinishShoot: false,
        },
      ],
    });

    const view = await render(<StaffPortalScreen />);

    await waitFor(() => {
      expect(view.getByText('Chờ Chủ Studio duyệt')).toBeTruthy();
      expect(
        view.getByText(
          'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.',
        ),
      ).toBeTruthy();
    });

    expect(view.queryByText('Check-in & Bắt đầu chụp')).toBeNull();
  });
});
