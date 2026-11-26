import httpClient from '@/apis/httpClient';

export type ProviderStaffStatus = 'ACTIVE' | 'INACTIVE';

export interface ProviderStaffBlock {
  _id: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  createdAt?: string;
}

export interface ProviderStaffMetrics {
  completedShoots: number;
  completedThisMonth: number;
  upcomingShoots: number;
  todayShoots: number;
  inProgressNow: boolean;
  disputeCount: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface ProviderStaffAccountInfo {
  email: string;
  status: string;
}

export interface ProviderStaffItem {
  _id: string;
  providerId: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  specialty?: string | null;
  bio?: string | null;
  experienceYears?: number | null;
  internalNote?: string | null;
  status: ProviderStaffStatus;
  sortOrder: number;
  linkedUserId?: string | null;
  staffAccount?: ProviderStaffAccountInfo | null;
  blockedSlots: ProviderStaffBlock[];
  metrics: ProviderStaffMetrics;
  temporaryPassword?: string | null;
}

export interface ProviderStaffSummary {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  maxConcurrentSessions: number | null;
  maxDailySessions: number | null;
  effectiveCapacity: number;
  activeTodayCount: number;
  pendingAssignmentCount: number;
}

export interface ProviderStaffListResponse {
  summary: ProviderStaffSummary;
  items: ProviderStaffItem[];
}

export interface PublicProviderStaffMember {
  _id: string;
  name: string;
  avatarUrl?: string | null;
  specialty?: string | null;
  bio?: string | null;
  experienceYears?: number | null;
}

export interface PublicProviderStaffResponse {
  providerId: string;
  activeStaffCount: number;
  maxConcurrentSessions: number | null;
  maxDailySessions: number | null;
  effectiveCapacity: number;
  staff: PublicProviderStaffMember[];
}

export interface ScheduleAvailableStaffItem {
  staffId: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  specialty?: string | null;
  available: boolean;
  conflictReason?: string | null;
  isCurrentAssigned: boolean;
}

export interface ScheduleAvailableStaffResponse {
  scheduleId: string | null;
  dateKey?: string | null;
  timeSlot?: string | null;
  currentAssignedStaffId?: string | null;
  activeStaffCount?: number;
  staff: ScheduleAvailableStaffItem[];
}

export interface StaffChatSupervisionResponse {
  bookingId: string;
  bookingCode: string;
  readOnly: boolean;
  roomId: string | null;
  staff: {
    staffId: string;
    name: string;
    avatarUrl?: string | null;
    phone?: string | null;
    linkedUserId?: string | null;
  } | null;
  customer: {
    userId: string;
    fullName: string;
    avatarUrl?: string | null;
    phone?: string | null;
  } | null;
  messages: Array<{
    _id: string;
    senderId: string;
    messageText?: string;
    attachments?: string[];
    createdAt: string;
  }>;
  note?: string;
}

export const staffApi = {
  listMine: () =>
    httpClient.get<never, ProviderStaffListResponse>('/api/providers/me/staff'),

  listPublic: (providerId: string) =>
    httpClient.get<never, PublicProviderStaffResponse>(
      `/api/providers/${encodeURIComponent(providerId)}/staff`,
    ),

  create: (dto: {
    name: string;
    phone: string;
    avatarUrl?: string | null;
    specialty?: string | null;
    bio?: string | null;
    experienceYears?: number | null;
    internalNote?: string | null;
    sortOrder?: number;
    createAccount?: boolean;
    email?: string;
    password?: string;
  }) => httpClient.post<never, ProviderStaffItem>('/api/providers/me/staff', dto),

  update: (
    staffId: string,
    dto: {
      name?: string;
      phone?: string;
      avatarUrl?: string | null;
      specialty?: string | null;
      bio?: string | null;
      experienceYears?: number | null;
      internalNote?: string | null;
      sortOrder?: number;
    },
  ) =>
    httpClient.patch<never, ProviderStaffItem>(
      `/api/providers/me/staff/${encodeURIComponent(staffId)}`,
      dto,
    ),

  updateStatus: (staffId: string, status: ProviderStaffStatus) =>
    httpClient.patch<never, ProviderStaffItem>(
      `/api/providers/me/staff/${encodeURIComponent(staffId)}/status`,
      { status },
    ),

  updateCapacity: (dto: {
    maxConcurrentSessions?: number | null;
    maxDailySessions?: number | null;
  }) =>
    httpClient.patch<
      never,
      {
        activeStaffCount: number;
        maxConcurrentSessions: number | null;
        maxDailySessions: number | null;
        effectiveCapacity: number;
      }
    >('/api/providers/me/staff/capacity', dto),

  addBlock: (
    staffId: string,
    dto: {
      date: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    },
  ) =>
    httpClient.post<never, ProviderStaffBlock>(
      `/api/providers/me/staff/${encodeURIComponent(staffId)}/blocks`,
      dto,
    ),

  removeBlock: (staffId: string, blockId: string) =>
    httpClient.delete<never, { removed: boolean; blockId: string }>(
      `/api/providers/me/staff/${encodeURIComponent(staffId)}/blocks/${encodeURIComponent(blockId)}`,
    ),

  provisionAccount: (
    staffId: string,
    dto: { email: string; password?: string },
  ) =>
    httpClient.post<
      never,
      {
        staffId: string;
        linkedUserId: string;
        email: string;
        accountStatus: string;
        temporaryPassword: string | null;
      }
    >(`/api/providers/me/staff/${encodeURIComponent(staffId)}/account`, dto),

  resetPassword: (staffId: string, dto: { newPassword?: string } = {}) =>
    httpClient.post<
      never,
      {
        staffId: string;
        linkedUserId: string;
        passwordReset: boolean;
        temporaryPassword: string | null;
      }
    >(
      `/api/providers/me/staff/${encodeURIComponent(staffId)}/account/reset-password`,
      dto,
    ),

  toggleAccountLock: (
    staffId: string,
    dto: { locked: boolean; reason?: string },
  ) =>
    httpClient.patch<
      never,
      {
        staffId: string;
        linkedUserId: string;
        accountStatus: string;
      }
    >(
      `/api/providers/me/staff/${encodeURIComponent(staffId)}/account/lock`,
      dto,
    ),

  getAvailableStaffForBooking: (bookingId: string) =>
    httpClient.get<never, ScheduleAvailableStaffResponse>(
      `/api/bookings/${encodeURIComponent(bookingId)}/available-staff`,
    ),

  getAvailableStaffForSchedule: (bookingId: string, scheduleId: string) =>
    httpClient.get<never, ScheduleAvailableStaffResponse>(
      `/api/bookings/${encodeURIComponent(bookingId)}/schedules/${encodeURIComponent(scheduleId)}/available-staff`,
    ),

  assignStaffToSchedule: (
    bookingId: string,
    scheduleId: string,
    body: { staffId: string; reason?: string },
  ) =>
    httpClient.patch<never, any>(
      `/api/bookings/${encodeURIComponent(bookingId)}/schedules/${encodeURIComponent(scheduleId)}/assign-staff`,
      body,
    ),

  getStaffChatSupervision: (bookingId: string, staffId?: string) =>
    httpClient.get<never, StaffChatSupervisionResponse>(
      `/chat/bookings/${encodeURIComponent(bookingId)}/staff-messages${
        staffId ? `?staffId=${encodeURIComponent(staffId)}` : ''
      }`,
    ),
};
