import { httpClient } from '../../../services/httpClient';
import type { ProviderDocumentType } from '../../provider-verifications/types';
import type {
  AdminReviewDecisionPayload,
  AdminVerificationDetail,
  AdminVerificationSummary,
} from '../types';

interface ListResponse {
  items?: RawVerification[];
}

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

export const adminVerificationApi = {
  async list(): Promise<AdminVerificationSummary[]> {
    const response = await httpClient.get<RawVerification[] | ListResponse>('/admin/provider-verifications');
    const items = Array.isArray(response) ? response : response.items ?? [];
    return items.map(normalizeVerification);
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

  runOcr(verificationId: string, documentType: ProviderDocumentType): Promise<void> {
    return httpClient.post<void>(`/provider-verifications/${verificationId}/documents/${documentType}/ocr`);
  },
};