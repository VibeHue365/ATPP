import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockShowToast = jest.fn();
const mockGetAvailableStaff = jest.fn();
const mockAssignStaff = jest.fn();
const mockGetSupervision = jest.fn();

jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

jest.mock('@/apis/staffApi', () => ({
  staffApi: {
    getAvailableStaffForSchedule: (...args: any[]) => mockGetAvailableStaff(...args),
    assignStaffToSchedule: (...args: any[]) => mockAssignStaff(...args),
    getStaffChatSupervision: (...args: any[]) => mockGetSupervision(...args),
  },
}));

import { OrderStaffAssignmentSection } from '@/components/provider/orders/OrderStaffAssignmentSection';

describe('OrderStaffAssignmentSection (Studio Owner dispatch & chat supervision)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads available staff and assigns selected photographer to unassigned schedule', async () => {
    const onUpdated = jest.fn();
    mockGetAvailableStaff.mockResolvedValue({
      scheduleId: 'sched-1',
      staff: [
        {
          staffId: 'st-1',
          name: 'Minh Tuấn',
          phone: '0905111222',
          specialty: 'Đại Nội',
          available: true,
          isCurrentAssigned: false,
        },
        {
          staffId: 'st-2',
          name: 'Hồng Ngọc',
          phone: '0905333444',
          specialty: 'Chùa Thiên Mụ',
          available: false,
          conflictReason: 'Đã kẹt lịch 09:00-11:00',
          isCurrentAssigned: false,
        },
      ],
    });
    mockAssignStaff.mockResolvedValue({ success: true });

    const order = {
      _id: 'bk-1',
      bookingCode: 'VH-101',
      status: 'CONFIRMED',
      photoshootSchedule: {
        _id: 'sched-1',
        scheduleType: 'PHOTOSHOOT',
        status: 'BOOKED',
      },
    };

    const view = await render(
      <OrderStaffAssignmentSection order={order} onOrderUpdated={onUpdated} />,
    );

    expect(
      view.getByText('Chưa phân công thợ chụp phụ trách cho ca này.'),
    ).toBeTruthy();

    await fireEvent.press(view.getByText('Phân công thợ'));

    await waitFor(() => {
      expect(mockGetAvailableStaff).toHaveBeenCalledWith('bk-1', 'sched-1');
      expect(view.getByText('Minh Tuấn')).toBeTruthy();
      expect(view.getByText('Bận: Đã kẹt lịch 09:00-11:00')).toBeTruthy();
    });

    await fireEvent.press(view.getByText('Xác nhận phân công'));

    await waitFor(() => {
      expect(mockAssignStaff).toHaveBeenCalledWith('bk-1', 'sched-1', {
        staffId: 'st-1',
        reason: undefined,
      });
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it('opens read-only Customer-Staff chat supervision modal for assigned schedule', async () => {
    mockGetSupervision.mockResolvedValue({
      bookingId: 'bk-2',
      bookingCode: 'VH-202',
      readOnly: true,
      roomId: 'room-88',
      staff: {
        staffId: 'st-1',
        name: 'Minh Tuấn',
        linkedUserId: 'u-staff-1',
      },
      customer: {
        userId: 'u-cust-1',
        fullName: 'Khách Mai Anh',
      },
      messages: [
        {
          _id: 'm1',
          senderId: 'u-cust-1',
          messageText: 'Anh ơi em đợi ở cổng Ngọ Môn nhé',
          createdAt: '2026-12-01T08:00:00.000Z',
        },
        {
          _id: 'm2',
          senderId: 'u-staff-1',
          messageText: 'Anh đang tới ngay, em chờ 5 phút nha',
          createdAt: '2026-12-01T08:01:00.000Z',
        },
      ],
    });

    const order = {
      _id: 'bk-2',
      bookingCode: 'VH-202',
      status: 'CONFIRMED',
      photoshootSchedule: {
        _id: 'sched-2',
        scheduleType: 'PHOTOSHOOT',
        status: 'BOOKED',
        assignedStaffId: 'st-1',
        assignedStaffSnapshot: {
          staffId: 'st-1',
          name: 'Minh Tuấn',
          specialty: 'Đại Nội',
        },
      },
    };

    const view = await render(<OrderStaffAssignmentSection order={order} />);

    expect(view.getByText('Minh Tuấn')).toBeTruthy();
    await fireEvent.press(view.getByText('Giám sát chat Khách ↔ Thợ'));

    await waitFor(() => {
      expect(mockGetSupervision).toHaveBeenCalledWith('bk-2', 'st-1');
      expect(
        view.getByText('Anh ơi em đợi ở cổng Ngọ Môn nhé'),
      ).toBeTruthy();
      expect(
        view.getByText('Anh đang tới ngay, em chờ 5 phút nha'),
      ).toBeTruthy();
      expect(
        view.getByText(
          'Chế độ chỉ đọc — tin nhắn của Khách và Thợ không bị đánh dấu đã đọc.',
        ),
      ).toBeTruthy();
    });
  });
});
