import { httpClient } from '../../../services/httpClient';
import type { ProviderDocumentType } from '../../provider-verifications/types';
import type {
  AdminReviewDecisionPayload,
  AdminVerificationDetail,
  AdminVerificationSummary,
} from '../types';

type RawVerification = Partial<AdminVerificationSummary> & {
  _id?: string;
  businessName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  submittedAt?: string | null;
  requestedCapabilities?: AdminVerificationSummary['requestedCapabilities'];
};

function normalizeVerification(item: RawVerification): AdminVerificationSummary {
  const businessProfile = item.businessProfile ?? {
    businessName: item.businessName ?? undefined,
    ownerName: item.ownerName ?? undefined,
    phone: item.phone ?? undefined,
    email: item.email ?? undefined,
  };

  return {
    ...item,
    verificationId: item.verificationId || item._id || '',
    status: item.status || 'DRAFT',
    requestedCapabilities: Array.isArray(item.requestedCapabilities) ? item.requestedCapabilities : [],
    businessProfile,
    createdAt: item.createdAt || item.submittedAt || undefined,
  };
}

export interface AdminVerificationMetrics {
  total: number;
  submitted: number;
  underReview: number;
  needsChanges: number;
  approved: number;
  rejected: number;
}

export interface AdminVerificationListResult {
  items: AdminVerificationSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: AdminVerificationMetrics;
}

export const adminVerificationApi = {
  async list(params?: {
    status?: string;
    search?: string;
    capability?: string;
    province?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminVerificationListResult> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.capability) query.set('capability', params.capability);
    if (params?.province) query.set('province', params.province);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await httpClient.get<any>(`/admin/provider-verifications${qs}`);
    const rawItems = Array.isArray(response) ? response : response.items ?? [];
    return {
      items: rawItems.map(normalizeVerification),
      total: response.total ?? rawItems.length,
      page: response.page ?? 1,
      limit: response.limit ?? 8,
      totalPages: response.totalPages ?? 1,
      metrics: response.metrics ?? {
        total: rawItems.length,
        submitted: 0,
        underReview: 0,
        needsChanges: 0,
        approved: 0,
        rejected: 0,
      },
    };
  },

  async detail(verificationId: string): Promise<AdminVerificationDetail> {
    const response = await httpClient.get<RawVerification>(`/admin/provider-verifications/${verificationId}`);
    return normalizeVerification(response) as AdminVerificationDetail;
  },

  startReview(verificationId: string): Promise<void> {
    return httpClient.patch<void>(`/admin/provider-verifications/${verificationId}/start-review`, {});
  },

  approve(verificationId: string, payload: AdminReviewDecisionPayload): Promise<void> {
    return httpClient.patch<void>(`/admin/provider-verifications/${verificationId}/approve`, payload);
  },

  reject(verificationId: string, payload: AdminReviewDecisionPayload): Promise<void> {
    return httpClient.patch<void>(`/admin/provider-verifications/${verificationId}/reject`, payload);
  },

  requestChanges(verificationId: string, payload: AdminReviewDecisionPayload): Promise<void> {
    return httpClient.patch<void>(`/admin/provider-verifications/${verificationId}/request-changes`, payload);
  },

  addNote(verificationId: string, content: string): Promise<{ success: boolean; internalNotes: any[] }> {
    return httpClient.post<{ success: boolean; internalNotes: any[] }>(
      `/admin/provider-verifications/${verificationId}/notes`,
      { content },
    );
  },

  runOcr(verificationId: string, documentType: ProviderDocumentType): Promise<void> {
    return httpClient.post<void>(`/provider-verifications/${verificationId}/documents/${documentType}/ocr`);
  },
};