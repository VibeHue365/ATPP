import type { ProviderCapability, ProviderDocumentType, OcrStatus } from '../provider-verifications/types';

export type AdminVerificationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CHANGES'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface OcrFieldValue {
  value: string | null;
  confidence?: number | null;
}

export interface AdminVerificationDocumentVersion {
  versionNo: number;
  isCurrent: boolean;
  mimeType?: string;
  originalFileName?: string;
  uploadStatus: string;
  ocrStatus: OcrStatus;
  ocrConfidence?: number | null;
  extractedFields?: Record<string, unknown>;
  mismatchFlags?: string[];
}

export interface AdminVerificationDocument {
  documentType: ProviderDocumentType;
  required: boolean;
  current?: AdminVerificationDocumentVersion | null;
  versions?: AdminVerificationDocumentVersion[];
}

export interface AdminVerificationSummary {
  verificationId: string;
  status: AdminVerificationStatus;
  requestedCapabilities: ProviderCapability[];
  businessProfile: {
    businessName?: string;
    ownerName?: string;
    phone?: string;
    email?: string;
  };
  documents?: AdminVerificationDocument[];
  createdAt?: string;
}

export interface AdminVerificationDetail extends AdminVerificationSummary {
  businessProfile: AdminVerificationSummary['businessProfile'] & {
    address?: string;
    province?: string;
    description?: string;
  };
  verificationRevision?: number;
  missingDocuments?: ProviderDocumentType[];
  review?: {
    decision?: string | null;
    reason?: string | null;
    note?: string | null;
  };
}

export interface AdminReviewDecisionPayload {
  reason: string;
  note: string;
  changeRequests?: Array<{
    target: 'IDENTITY_CARD_FRONT' | 'IDENTITY_CARD_BACK' | 'BUSINESS_PROFILE' | 'PORTFOLIO' | 'OTHER';
    action: 'REUPLOAD' | 'UPDATE_PROFILE' | 'PROVIDE_MORE_INFO';
    reasonCode: string;
    note?: string;
  }>;
}

export const documentLabels: Record<ProviderDocumentType, string> = {
  IDENTITY_CARD_FRONT: 'CCCD mặt trước',
  IDENTITY_CARD_BACK: 'CCCD mặt sau',
  PASSPORT: 'Hộ chiếu',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  TAX_REGISTRATION: 'Giấy đăng ký thuế',
  SHOP_PHOTO_PROOF: 'Ảnh cửa hàng',
  STUDIO_PORTFOLIO_PROOF: 'Hồ sơ năng lực',
  PROFESSIONAL_CERTIFICATE: 'Chứng chỉ hành nghề',
};

export function currentDocumentVersion(document: AdminVerificationDocument): AdminVerificationDocumentVersion | null {
  return document.current ?? document.versions?.find((version) => version.isCurrent) ?? document.versions?.[0] ?? null;
}

export function ocrValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'value' in value) {
    const nested = (value as OcrFieldValue).value;
    return typeof nested === 'string' ? nested : null;
  }
  return null;
}