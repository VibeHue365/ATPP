import { httpClient } from '../../../services/httpClient';
import type { Dispute, ResolvePayload } from '../types';

export const adminDisputesApi = {
  list: () => httpClient.get<Dispute[]>('/api/disputes/admin/disputed'),
  resolve: (bookingId: string, payload: ResolvePayload) =>
    httpClient.post<void>(`/api/disputes/admin/resolve/${bookingId}`, payload),
};