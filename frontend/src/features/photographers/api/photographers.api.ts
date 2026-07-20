import { httpClient } from '../../../services/httpClient';
import type {
  PhotographerApiResponse,
  PhotographerConcept,
  PhotographerDiscoveryParams,
  PhotographerDiscoveryResponse,
  PhotographyQuote,
} from '../types/photographer.types';

const buildQuery = (params: PhotographerDiscoveryParams = {}): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const value = search.toString();
  return value ? `?${value}` : '';
};

export const photographersApi = {
  getAll: (params: PhotographerDiscoveryParams = {}) =>
    httpClient.get<PhotographerDiscoveryResponse>(`/api/photographers${buildQuery(params)}`),
  getConcepts: () => httpClient.get<{ data: PhotographerConcept[] }>('/api/photographers/concepts'),
  getById: (id: string) => httpClient.get<PhotographerApiResponse>(`/api/photographers/${id}`),
  quote: (
    providerId: string,
    payload: {
      packageId: string;
      sessions: Array<{
        clientId: string;
        startsAt: string;
        endsAt: string;
        locationAddress?: string;
      }>;
    },
  ) => httpClient.post<PhotographyQuote>(`/api/photographers/${providerId}/quote`, payload),
};