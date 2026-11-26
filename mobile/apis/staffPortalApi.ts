import httpClient from '@/apis/httpClient';

export interface StaffPortalProfileResponse {
  staff: {
    _id: string;
    name: string;
    phone: string;
    avatarUrl?: string | null;
    specialty?: string | null;
    bio?: string | null;
    experienceYears?: number | null;
    status: string;
    blockedSlots: Array<{
      _id: string;
      date: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }>;
  };
  studio: {
    _id: string;
    ownerUserId?: string | null;
    businessName: string;
    phone?: string | null;
    address?: {
      addressLine?: string | null;
      ward?: string | null;
      district?: string | null;
      city?: string | null;
    } | null;
    logoUrl?: string | null;
  } | null;
  metrics: {
    todayShoots: number;
    upcomingShoots: number;
    completedThisMonth: number;
  };
}

export interface StaffScheduleItem {
  scheduleId: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  scheduleStatus: string;
  providerLocalDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timeSlot: string | null;
  locationAddress: string | null;
  locationSnapshot?: {
    address?: string | null;
    geo?: { type?: string; coordinates?: [number, number] } | null;
  } | null;
  packageName: string;
  customer: {
    userId: string | null;
    fullName: string;
    avatarUrl?: string | null;
    phone?: string | null;
  } | null;
  customerNote?: string | null;
  scheduleNotes?: string | null;
  checkedInAt?: string | null;
  checkInPhotoUrl?: string | null;
  shootFinishedAt?: string | null;
  staffFieldNote?: string | null;
  canCheckIn: boolean;
  checkInBlockedReason?: string | null;
  canFinishShoot: boolean;
}

export interface StaffMySchedulesResponse {
  staff: {
    _id: string;
    name: string;
    avatarUrl?: string | null;
  };
  studio: {
    _id: string;
    ownerUserId?: string | null;
    businessName: string;
  } | null;
  items: StaffScheduleItem[];
}

export interface StaffCheckInResponse {
  scheduleId: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  checkedInAt: string;
  checkInPhotoUrl: string | null;
  staffFieldNote: string | null;
}

export interface StaffBlockedSlotItem {
  _id: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  createdAt?: string;
}

export interface StaffFinishShootResponse {
  scheduleId: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  checkedInAt: string | null;
  checkInPhotoUrl?: string | null;
  shootFinishedAt: string;
  staffFieldNote: string | null;
}

export const staffPortalApi = {
  getProfile: () =>
    httpClient.get<never, StaffPortalProfileResponse>('/api/staff/profile'),

  getMySchedules: (
    params: {
      scope?: 'today' | 'upcoming' | 'completed' | 'all';
      from?: string;
      to?: string;
    } = {},
  ) => {
    const search = new URLSearchParams();
    if (params.scope) search.set('scope', params.scope);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    const qs = search.toString();
    return httpClient.get<never, StaffMySchedulesResponse>(
      `/api/staff/my-schedules${qs ? `?${qs}` : ''}`,
    );
  },

  uploadCheckInPhoto: (formData: FormData) =>
    httpClient.post<never, { url: string }>(
      '/api/staff/check-in-photo',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  checkIn: (
    scheduleId: string,
    dto: { photoUrl: string; note?: string; latitude?: number; longitude?: number },
  ) =>
    httpClient.post<never, StaffCheckInResponse>(
      `/api/staff/schedules/${encodeURIComponent(scheduleId)}/check-in`,
      dto,
    ),

  finishShoot: (scheduleId: string, dto: { note?: string } = {}) =>
    httpClient.post<never, StaffFinishShootResponse>(
      `/api/staff/schedules/${encodeURIComponent(scheduleId)}/finish-shoot`,
      dto,
    ),

  addBlockedSlot: (dto: {
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
  }) =>
    httpClient.post<never, StaffBlockedSlotItem>('/api/staff/blocked-slots', dto),

  removeBlockedSlot: (blockId: string) =>
    httpClient.delete<never, { removed: boolean; blockId: string }>(
      `/api/staff/blocked-slots/${encodeURIComponent(blockId)}`,
    ),
};
