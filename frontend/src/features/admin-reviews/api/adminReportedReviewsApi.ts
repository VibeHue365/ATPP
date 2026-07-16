import { httpClient } from '../../../services/httpClient';
import type { ReportAction, ReportedReview } from '../types';

export const adminReportedReviewsApi = {
  list: () => httpClient.get<ReportedReview[]>('/reviews/admin/reported'),
  handle: (id: string, action: ReportAction, reason: string) =>
    httpClient.post<void>(`/reviews/${id}/handle-report`, { action, reason }),
};