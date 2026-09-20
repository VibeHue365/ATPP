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
  monthAvailability: (id: string, month: string, packageId: string) =>
    httpClient.get<never, MonthlyPhotographyAvailability>(`/api/photographers/${id}/availability/month${query({ month, packageId })}`),
  timeRanges: (id: string, date: string) =>
    httpClient.get<never, PhotographyTimeRanges>(`/api/photographers/${id}/availability${query({ date })}`),
  quote: (id: string, packageId: string, sessions: PhotographySessionPayload[]) =>
    httpClient.post<never, PhotographyQuote>(`/api/photographers/${id}/quote`, { packageId, sessions }),
};
