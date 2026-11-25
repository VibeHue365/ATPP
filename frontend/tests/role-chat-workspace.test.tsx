// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatMessage, ChatRoom } from '../src/types/chat.types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/dashboard/chat', state: null as unknown },
  user: {
    id: 'user-current',
    email: 'user@tagohue.vn',
    fullName: 'Người Dùng Test',
    isEmailVerified: true,
    roles: ['CUSTOMER'],
    createdAt: '2026-11-20T00:00:00Z',
  },
  isAuthenticated: true,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  rooms: [] as ChatRoom[],
  messages: [] as ChatMessage[],
  getOrCreateRoomResult: {
    id: 'room-staff-cust-1',
    otherParticipant: null,
    lastMessage: null,
    lastMessageAt: null,
  } as ChatRoom,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    isAuthenticated: mocks.isAuthenticated,
    logout: vi.fn(),
  }),
}));

vi.mock('../src/context/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false,
  }),
}));

vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => mocks.toast,
}));

vi.mock('../src/services/chatService', () => ({
  chatService: {
    getRooms: vi.fn(async () => mocks.rooms),
    getMessages: vi.fn(async () => mocks.messages),
    getAvailablePartners: vi.fn(async () => []),
    getOrCreateRoom: vi.fn(async () => mocks.getOrCreateRoomResult),
    sendMessage: vi.fn(),
    uploadChatImage: vi.fn(),
  },
}));

vi.mock('../src/features/staff-portal/staffPortalApi', () => ({
  staffPortalApi: {
    getProfile: vi.fn(async () => ({
      staff: {
        _id: 'staff-1',
        name: 'Nguyễn Minh Tuấn',
        phone: '0905111001',
        specialty: 'Cổ phục Hoàng Thành',
        status: 'ACTIVE',
        blockedSlots: [],
      },
      studio: {
        _id: 'provider-1',
        ownerUserId: 'owner-user-1',
        businessName: 'Cố Đô Studio',
      },
      metrics: {
        todayShoots: 1,
        upcomingShoots: 2,
        completedThisMonth: 5,
      },
    })),
    getMySchedules: vi.fn(async () => []),
  },
}));

import { RoleChatWorkspace } from '../src/features/chat/RoleChatWorkspace';
import { ChatPage } from '../src/pages/chat/ChatPage';
import { StaffPortalPage } from '../src/pages/staff/StaffPortalPage';

describe('RoleChatWorkspace & Role-Aware Web Chat', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    mocks.user = {
      id: 'user-current',
      email: 'user@tagohue.vn',
      fullName: 'Người Dùng Test',
      isEmailVerified: true,
      roles: ['CUSTOMER'],
      createdAt: '2026-11-20T00:00:00Z',
    };
    mocks.messages = [];
    mocks.rooms = [
      {
        id: 'room-1',
        roomCategory: 'CUSTOMER_TO_STAFF',
        isPinned: false,
        bookingContext: {
          bookingId: 'bk-1',
          bookingCode: '5BEC4A',
          bookingType: 'PHOTOGRAPHY',
          status: 'CONFIRMED',
          serviceLabel: 'Lịch chụp ảnh',
          shootDate: '2026-11-28T08:00:00Z',
          timeSlot: '08:00 - 11:00',
          locationAddress: 'Ngọ Môn, Đại Nội Huế',
        },
        otherParticipant: {
          id: 'staff-user-1',
          fullName: 'Nguyễn Minh Tuấn',
          avatarUrl: null,
          participantRole: 'STAFF',
          roleBadge: 'Thợ chụp phụ trách',
          studioName: 'Cố Đô Studio',
          staffSpecialty: 'Cổ phục Hoàng Thành',
        },
        lastMessage: {
          id: 'msg-1',
          messageText: 'Hẹn bạn tại cổng Ngọ Môn nhé',
          senderId: 'staff-user-1',
          isRead: false,
          createdAt: '2026-11-25T10:00:00Z',
        },
        lastMessageAt: '2026-11-25T10:00:00Z',
        unreadCount: 1,
      },
    ];
  });

  it('renders customer mode UI with Vietnamese filters, booking context, quick replies, and no hanna avatar', async () => {
    const { container } = render(
      <RoleChatWorkspace mode="customer" initialRoomId="room-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Tin nhắn của tôi')).toBeTruthy();
      expect(screen.getAllByText('Nguyễn Minh Tuấn').length).toBeGreaterThan(0);
    });

    expect(screen.getByRole('tab', { name: 'Tất cả' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Studio / Tiệm Áo Dài' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Thợ chụp phụ trách' })).toBeTruthy();
    expect(screen.getByText(/Đơn #5BEC4A/)).toBeTruthy();
    expect(screen.getByText(/Ngọ Môn, Đại Nội Huế/)).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Điểm hẹn & giờ chụp chính xác ở đâu vậy ạ?',
      }),
    ).toBeTruthy();

    expect(container.querySelector('img[src="/avatar_hanna.webp"]')).toBeNull();
  });

  it('renders provider mode UI with Studio inbox header, team filter tabs, and provider quick replies', async () => {
    mocks.user.roles = ['PROVIDER'];
    mocks.rooms = [
      {
        id: 'room-owner-staff',
        roomCategory: 'OWNER_TO_STAFF',
        otherParticipant: {
          id: 'staff-user-1',
          fullName: 'Nguyễn Minh Tuấn',
          avatarUrl: null,
          participantRole: 'STAFF',
          roleBadge: 'Thợ chụp Studio',
        },
        lastMessage: null,
        lastMessageAt: '2026-11-25T10:00:00Z',
        unreadCount: 0,
      },
    ];

    render(<RoleChatWorkspace mode="provider" initialRoomId="room-owner-staff" />);

    await waitFor(() => {
      expect(screen.getByText('Hộp thư Studio')).toBeTruthy();
    });

    expect(screen.getByRole('tab', { name: 'Tất cả' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Khách hàng' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Đội ngũ Thợ chụp' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Nhờ bạn kiểm tra lại địa điểm & khung giờ ca chụp hôm nay',
      }),
    ).toBeTruthy();
  });

  it('renders staff mode UI with pinned Studio Owner room, staff filters, quick replies, and zero financial strings', async () => {
    mocks.user.roles = ['STAFF'];
    mocks.rooms = [
      {
        id: 'room-owner',
        roomCategory: 'STAFF_TO_OWNER',
        isPinned: true,
        otherParticipant: {
          id: 'owner-user-1',
          fullName: 'Cố Đô Studio',
          avatarUrl: null,
          participantRole: 'PROVIDER',
          roleBadge: 'Chủ Studio',
        },
        lastMessage: null,
        lastMessageAt: '2026-11-25T09:00:00Z',
        unreadCount: 0,
      },
    ];

    render(
      <RoleChatWorkspace
        mode="staff"
        initialRoomId="room-owner"
        studioOwnerUserId="owner-user-1"
        studioOwnerName="Cố Đô Studio"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Trao đổi công việc')).toBeTruthy();
    });

    expect(screen.getByRole('tab', { name: 'Tất cả' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Chủ Studio' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Khách chụp' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Mình đã có mặt tại điểm chụp rồi ạ',
      }),
    ).toBeTruthy();

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('Ví');
    expect(bodyText).not.toContain('Doanh thu');
    expect(bodyText).not.toContain('Đặt cọc');
    expect(bodyText).not.toContain('Tổng tiền');
  });

  it('redirects pure STAFF users away from Customer ChatPage to /staff?tab=chat', async () => {
    mocks.user.roles = ['STAFF'];
    mocks.location.state = { activeRoomId: 'room-99' };

    render(<ChatPage />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(
        '/staff?tab=chat&roomId=room-99',
        { replace: true },
      );
    });
  });

  it('keeps StaffPortalPage inside /staff when switching to Tin nhắn tab without navigating to /dashboard/chat', async () => {
    mocks.user.roles = ['STAFF'];
    mocks.rooms = [];

    render(<StaffPortalPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tin nhắn/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tin nhắn/i }));

    await waitFor(() => {
      expect(screen.getByText('Trao đổi công việc')).toBeTruthy();
      expect(screen.getByText(/Nhắn Chủ Studio/i)).toBeTruthy();
    });

    expect(mocks.navigate).not.toHaveBeenCalled();

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('Ví');
    expect(bodyText).not.toContain('Doanh thu');
    expect(bodyText).not.toContain('Đặt cọc');
    expect(bodyText).not.toContain('Tổng tiền');
  });
});
