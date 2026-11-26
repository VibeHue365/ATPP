import httpClient from '@/apis/httpClient';
import type {
  MonthlyPhotographyAvailability,
  Photographer,
  PhotographerConcept,
  PhotographerFilters,
  PhotographerPackageCategory,
  PhotographerPage,
  PhotographerReview,
  PhotographyQuote,
  PhotographySessionPayload,
  PhotographyTimeRanges,
} from '@/types/photographer';

const query = (params: object) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
};

export const photographerApi = {
  list: (filters: PhotographerFilters = {}) =>
    httpClient.get<never, PhotographerPage>(`/api/photographers${query(filters)}`),
  detail: (id: string) => httpClient.get<never, Photographer>(`/api/photographers/${id}`),
  concepts: () => httpClient.get<never, { data: PhotographerConcept[] }>('/api/photographers/concepts'),
  categories: () => httpClient.get<never, { data: PhotographerPackageCategory[] }>('/api/photographers/package-categories'),
  reviews: (id: string) => httpClient.get<never, PhotographerReview[]>(`/reviews/provider/${id}`),
  monthAvailability: (id: string, month: string, packageId: string, staffId?: string) =>
    httpClient.get<never, MonthlyPhotographyAvailability>(
      `/api/photographers/${id}/availability/month${query({ month, packageId, staffId })}`,
    ),
  timeRanges: (id: string, date: string) =>
    httpClient.get<never, PhotographyTimeRanges>(`/api/photographers/${id}/availability${query({ date })}`),
  busySchedule: (providerId: string) =>
    httpClient.get<
      never,
      {
        bookedDates: string[];
        bookedSlots: Array<{ date: string; timeSlot: string }>;
        totalActiveStaff?: number;
        maxConcurrentSessions?: number | null;
        maxDailySessions?: number | null;
        effectiveCapacity?: number;
        slotAvailability?: Array<{
          date: string;
          timeSlot: string;
          occupiedCount: number;
          capacity: number;
          remainingSlots: number;
        }>;
        dailyAvailability?: Array<{
          date: string;
          used: number;
          limit: number;
          remaining: number;
        }>;
      }
    >(`/api/bookings/busy-dates/provider/${encodeURIComponent(providerId)}`),
  quote: (
    id: string,
    packageId: string,
    sessions: PhotographySessionPayload[],
    preferredStaffId?: string,
  ) =>
    httpClient.post<never, PhotographyQuote>(`/api/photographers/${id}/quote`, {
      packageId,
      sessions,
      ...(preferredStaffId ? { preferredStaffId } : {}),
    }),
};
