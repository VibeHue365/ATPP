import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProviderCapability } from './provider.schema';

export type ProviderVerificationDocument =
  HydratedDocument<ProviderVerification>;

export enum VerificationType {
  NewProvider = 'NEW_PROVIDER',
  AddCapability = 'ADD_CAPABILITY',
  UpdateDocuments = 'UPDATE_DOCUMENTS',
  ReactivationRequest = 'REACTIVATION_REQUEST',
}

export enum VerificationStatus {
  Draft = 'DRAFT',
  Submitted = 'SUBMITTED',
  UnderReview = 'UNDER_REVIEW',
  NeedsChanges = 'NEEDS_CHANGES',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Cancelled = 'CANCELLED',
}

export enum VerificationReviewDecision {
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  NeedsChanges = 'NEEDS_CHANGES',
}

export enum ProviderDocumentType {
  IdentityCardFront = 'IDENTITY_CARD_FRONT',
  IdentityCardBack = 'IDENTITY_CARD_BACK',
  Passport = 'PASSPORT',
  BusinessLicense = 'BUSINESS_LICENSE',
  TaxRegistration = 'TAX_REGISTRATION',
  ShopPhotoProof = 'SHOP_PHOTO_PROOF',
  StudioPortfolioProof = 'STUDIO_PORTFOLIO_PROOF',
  ProfessionalCertificate = 'PROFESSIONAL_CERTIFICATE',
}

export enum DocumentUploadStatus {
  PendingUpload = 'PENDING_UPLOAD',
  Uploaded = 'UPLOADED',
  UploadFailed = 'UPLOAD_FAILED',
  Deleted = 'DELETED',
}

export enum OcrStatus {
  NotStarted = 'NOT_STARTED',
  Processing = 'OCR_PROCESSING',
  Passed = 'OCR_PASSED',
  Failed = 'OCR_FAILED',
  LowConfidence = 'OCR_LOW_CONFIDENCE',
  MismatchDetected = 'MISMATCH_DETECTED',
  NeedsManualReview = 'NEEDS_MANUAL_REVIEW',
}

export interface ProviderVerificationConsent {
  accepted: boolean;
  version?: string | null;
  acceptedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ProviderVerificationBusinessProfile {
  businessName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  province?: string | null;
  description?: string | null;
}

export interface ProviderVerificationAodaiInfo {
  shopName?: string | null;
  rentalPolicy?: string | null;
  depositPolicy?: string | null;
  pickupAddress?: string | null;
  sizeSupport?: string | null;
}

export interface ProviderVerificationPhotographyInfo {
  studioName?: string | null;
  workingArea?: string | null;
  photographyStyles?: string[];
  portfolioUrls?: string[];
}

export interface ProviderVerificationDocumentVersion {
  versionNo: number;
  isCurrent: boolean;
  uploadStatus: DocumentUploadStatus;
  storageProvider: string;
  bucket: string;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  checksum: string;
  fileValidation: Record<string, unknown>;
  ocrStatus: OcrStatus;
  ocrConfidence?: number | null;
  extractedFields: Record<string, unknown>;
  mismatchFlags: string[];
  uploadedAt?: Date | null;
  processedAt?: Date | null;
  replacedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface ProviderVerificationDocumentItem {
  documentType: ProviderDocumentType;
  required: boolean;
  currentVersion?: number | null;
  versions: ProviderVerificationDocumentVersion[];
}

export interface ProviderVerificationReview {
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  decision?: VerificationReviewDecision | null;
  reason?: string | null;
  note?: string | null;
}

export interface ProviderVerificationStatusTimeline {
  fromStatus?: VerificationStatus | null;
  toStatus: VerificationStatus;
  changedBy?: Types.ObjectId | null;
  changedAt: Date;
  reason?: string | null;
}

@Schema({ collection: 'provider_verifications', timestamps: true })
export class ProviderVerification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', default: null, index: true })
  providerId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(VerificationType),
    default: VerificationType.NewProvider,
    index: true,
  })
  verificationType: VerificationType;

  @Prop({
    type: [String],
    enum: Object.values(ProviderCapability),
    default: [],
    index: true,
  })
  requestedCapabilities: ProviderCapability[];

  @Prop({
    type: String,
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.Draft,
    index: true,
  })
  status: VerificationStatus;

  @Prop({
    type: {
      businessName: { type: String, default: null, trim: true },
      ownerName: { type: String, default: null, trim: true },
      phone: { type: String, default: null, trim: true },
      email: { type: String, default: null, trim: true, lowercase: true },
      address: { type: String, default: null, trim: true },
      province: { type: String, default: null, trim: true },
      description: { type: String, default: null, trim: true },
    },
    default: {},
  })
  businessProfile: ProviderVerificationBusinessProfile;

  @Prop({
    type: {
      shopName: { type: String, default: null, trim: true },
      rentalPolicy: { type: String, default: null, trim: true },
      depositPolicy: { type: String, default: null, trim: true },
      pickupAddress: { type: String, default: null, trim: true },
      sizeSupport: { type: String, default: null, trim: true },
    },
    default: {},
  })
  aodaiInfo: ProviderVerificationAodaiInfo;

  @Prop({
    type: {
      studioName: { type: String, default: null, trim: true },
      workingArea: { type: String, default: null, trim: true },
      photographyStyles: { type: [String], default: [] },
      portfolioUrls: { type: [String], default: [] },
    },
    default: {},
  })
  photographyInfo: ProviderVerificationPhotographyInfo;

  @Prop({
    type: {
      accepted: { type: Boolean, default: false },
      version: { type: String, default: null },
      acceptedAt: { type: Date, default: null },
      ipAddress: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
    default: { accepted: false },
  })
  consent: ProviderVerificationConsent;

  @Prop({
    type: [
      {
        _id: false,
        documentType: {
          type: String,
          enum: Object.values(ProviderDocumentType),
          required: true,
        },
        required: { type: Boolean, default: true },
        currentVersion: { type: Number, default: null },
        versions: {
          type: [
            {
              _id: false,
              versionNo: { type: Number, required: true },
              isCurrent: { type: Boolean, default: true },
              uploadStatus: {
                type: String,
                enum: Object.values(DocumentUploadStatus),
                default: DocumentUploadStatus.PendingUpload,
              },
              storageProvider: { type: String, required: true },
              bucket: { type: String, required: true },
              storageKey: { type: String, required: true },
              originalFileName: { type: String, required: true },
              mimeType: { type: String, required: true },
              size: { type: Number, required: true },
              checksum: { type: String, required: true },
              fileValidation: { type: Object, default: {} },
              ocrStatus: {
                type: String,
                enum: Object.values(OcrStatus),
                default: OcrStatus.NotStarted,
              },
              ocrConfidence: { type: Number, default: null },
              extractedFields: { type: Object, default: {} },
              mismatchFlags: { type: [String], default: [] },
              uploadedAt: { type: Date, default: null },
              processedAt: { type: Date, default: null },
              replacedAt: { type: Date, default: null },
              deletedAt: { type: Date, default: null },
            },
          ],
          default: [],
        },
      },
    ],
    default: [],
  })
  documents: ProviderVerificationDocumentItem[];

  @Prop({
    type: {
      reviewedBy: { type: Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      decision: {
        type: String,
        enum: Object.values(VerificationReviewDecision),
        default: null,
      },
      reason: { type: String, default: null, trim: true },
      note: { type: String, default: null, trim: true },
    },
    default: {},
  })
  review: ProviderVerificationReview;

  @Prop({
    type: [
      {
        _id: false,
        fromStatus: {
          type: String,
          enum: Object.values(VerificationStatus),
          default: null,
        },
        toStatus: {
          type: String,
          enum: Object.values(VerificationStatus),
          required: true,
        },
        changedBy: { type: Types.ObjectId, ref: 'User', default: null },
        changedAt: { type: Date, default: Date.now },
        reason: { type: String, default: null, trim: true },
      },
    ],
    default: [],
  })
  statusTimeline: ProviderVerificationStatusTimeline[];

  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;
}

export const ProviderVerificationSchema =
  SchemaFactory.createForClass(ProviderVerification);

ProviderVerificationSchema.index({
  userId: 1,
  verificationType: 1,
  status: 1,
});
ProviderVerificationSchema.index({ status: 1, createdAt: -1 });
ProviderVerificationSchema.index({ requestedCapabilities: 1 });
