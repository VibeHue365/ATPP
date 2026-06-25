export type ProviderCapability = 'AODAI_RENTAL' | 'PHOTOGRAPHY';

export type VerificationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CHANGES'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ProviderDocumentType =
  | 'IDENTITY_CARD_FRONT'
  | 'IDENTITY_CARD_BACK'
  | 'PASSPORT'
  | 'BUSINESS_LICENSE'
  | 'TAX_REGISTRATION'
  | 'SHOP_PHOTO_PROOF'
  | 'STUDIO_PORTFOLIO_PROOF'
  | 'PROFESSIONAL_CERTIFICATE';

export type DocumentUploadStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'UPLOAD_FAILED'
  | 'DELETED';

export type OcrStatus =
  | 'NOT_STARTED'
  | 'OCR_PROCESSING'
  | 'OCR_PASSED'
  | 'OCR_FAILED'
  | 'OCR_LOW_CONFIDENCE'
  | 'MISMATCH_DETECTED'
  | 'NEEDS_MANUAL_REVIEW';

export interface ProviderVerificationVersionSummary {
  versionNo: number;
  isCurrent: boolean;
  uploadStatus: DocumentUploadStatus;
  originalFileName?: string;
  mimeType?: string;
  size?: number;
  ocrStatus: OcrStatus;
  ocrConfidence?: number | null;
  extractedFields?: Record<string, unknown>;
  mismatchFlags?: string[];
  uploadedAt?: string | null;
  processedAt?: string | null;
}

export interface ProviderVerificationDocumentSummary {
  documentType: ProviderDocumentType;
  required: boolean;
  currentVersion?: number | null;
  current?: ProviderVerificationVersionSummary | null;
}

export interface ProviderBusinessProfile {
  businessName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  province?: string;
  description?: string;
}

export interface AodaiInfo {
  shopName?: string;
  rentalPolicy?: string;
  depositPolicy?: string;
  pickupAddress?: string;
  sizeSupport?: string;
}

export interface PhotographyInfo {
  studioName?: string;
  workingArea?: string;
  photographyStyles?: string[];
  portfolioUrls?: string[];
}

export interface ProviderVerificationDetail {
  verificationId: string;
  status: VerificationStatus;
  verificationType: string;
  requestedCapabilities: ProviderCapability[];
  businessProfile: ProviderBusinessProfile;
  aodaiInfo: AodaiInfo;
  photographyInfo: PhotographyInfo;
  consent: {
    accepted: boolean;
    version?: string | null;
    acceptedAt?: string | null;
  };
  requiredDocuments: ProviderDocumentType[];
  missingDocuments: ProviderDocumentType[];
  documents: ProviderVerificationDocumentSummary[];
  ocrWarnings: Array<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  review?: {
    decision?: string | null;
    reason?: string | null;
    note?: string | null;
    reviewedAt?: string | null;
  };
}

export interface CreateProviderVerificationResponse {
  verificationId: string;
  status: VerificationStatus;
  requestedCapabilities: ProviderCapability[];
  requiredDocuments: ProviderDocumentType[];
}
