import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  StreamableFile,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import { ClientSession, Model, Types } from 'mongoose';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  AuditLog,
  AuditLogDocument,
} from '../../audit/schemas/audit-log.schema';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from '../../notifications/schemas/notification.schema';
import { PrivateStorageService } from '../../storage/services/private-storage.service';
import { User, UserDocument, ProviderStatus as UserProviderStatus } from '../../users/schemas/user.schema';
import { RefreshToken } from '../../auth/schemas/refresh-token.schema';
import {
  Provider,
  ProviderCapability,
  ProviderStatus,
} from '../schemas/provider.schema';
import {
  DocumentUploadStatus,
  OcrAssessment,
  OcrExecutionStatus,
  OcrStatus,
  ProviderChangeRequestAction,
  ProviderChangeRequestTarget,
  ProviderDocumentType,
  ProviderVerification,
  ProviderVerificationDocument,
  ProviderVerificationDocumentItem,
  ProviderVerificationDocumentVersion,
  VerificationReviewDecision,
  VerificationStatus,
  VerificationType,
} from '../schemas/provider-verification.schema';
import { ProviderOcrOutboxService } from './provider-ocr-outbox.service';
import {
  AcceptProviderVerificationConsentDto,
  AdminReviewDecisionDto,
  ProviderChangeRequestDto,
  CreateProviderVerificationDto,
  UpdateProviderVerificationDto,
} from '../dto/provider-verification.dto';

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface FileValidationResult {
  mimeType: string;
  extension: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface DocumentStreamResult {
  file: StreamableFile;
  mimeType: string;
  fileName: string;
}

interface TesseractOcrResult {
  text: string;
  confidence: number;
}

interface OcrHttpServiceResponse {
  text?: unknown;
  confidence?: unknown;
}

const execFileAsync = promisify(execFile);

const ACTIVE_VERIFICATION_STATUSES = [
  VerificationStatus.Draft,
  VerificationStatus.Submitted,
  VerificationStatus.UnderReview,
  VerificationStatus.NeedsChanges,
];

const EDITABLE_STATUSES = [
  VerificationStatus.Draft,
  VerificationStatus.NeedsChanges,
];

const REVIEWABLE_STATUSES = [
  VerificationStatus.Submitted,
  VerificationStatus.UnderReview,
];

const OCR_REQUIRED_TYPES = [
  ProviderDocumentType.IdentityCardFront,
  ProviderDocumentType.IdentityCardBack,
];

const OCR_OPTIONAL_TYPES = [
  ProviderDocumentType.BusinessLicense,
  ProviderDocumentType.TaxRegistration,
  ProviderDocumentType.ProfessionalCertificate,
];

@Injectable()
export class ProviderVerificationService {
  private readonly uploadLocks = new Map<string, Promise<unknown>>();

  constructor(
    @InjectModel(ProviderVerification.name)
    private readonly verificationModel: Model<ProviderVerification>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<Provider>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
    private readonly storageService: PrivateStorageService,
    private readonly configService: ConfigService,
    private readonly ocrOutboxService: ProviderOcrOutboxService,
  ) {}

  async createVerification(
    actor: AuthUser,
    dto: CreateProviderVerificationDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    this.requireRole(actor, 'CUSTOMER');
    const user = await this.loadUser(actor.sub);
    if (!user.auth.emailVerified) {
      throw new BadRequestException('Email must be verified');
    }

    const requestedCapabilities = this.validateCapabilities(
      dto.requestedCapabilities,
    );

    const existingProvider = await this.providerModel.findOne({
      userId: user._id,
      status: ProviderStatus.Active,
    });

    const verificationType = existingProvider
      ? VerificationType.AddCapability
      : VerificationType.NewProvider;

    if (existingProvider) {
      const existingCaps = existingProvider.capabilities || [];
      const hasDuplicateCap = requestedCapabilities.some((cap) =>
        existingCaps.includes(cap),
      );
      if (hasDuplicateCap) {
        throw new BadRequestException('Bạn đã sở hữu vai trò dịch vụ này rồi.');
      }
    }

    const duplicate = await this.verificationModel.findOne({
      userId: user._id,
      verificationType,
      status: { $in: ACTIVE_VERIFICATION_STATUSES },
    });
    if (duplicate) {
      throw new ConflictException('Active provider verification already exists');
    }

    const verification = await this.verificationModel.create({
      userId: user._id,
      verificationType,
      requestedCapabilities,
      status: VerificationStatus.Draft,
      documents: this.buildRequiredDocumentItems(requestedCapabilities),
      statusTimeline: [
        {
          fromStatus: null,
          toStatus: VerificationStatus.Draft,
          changedBy: user._id,
          changedAt: new Date(),
          reason: 'Provider verification created',
        },
      ],
    });

    await this.writeAudit(
      actor,
      'CREATE_PROVIDER_VERIFICATION',
      verification._id,
      {},
      { requestedCapabilities, verificationType },
      meta,
    );

    return {
      verificationId: verification._id,
      status: verification.status,
      requestedCapabilities: verification.requestedCapabilities,
      requiredDocuments: verification.documents
        .filter((document) => document.required)
        .map((document) => document.documentType),
    };
  }

  async getCurrentVerification(
    actor: AuthUser,
  ): Promise<Record<string, unknown> | null> {
    this.requireRole(actor, 'CUSTOMER');
    const verification = await this.verificationModel
      .findOne({
        userId: this.toObjectId(actor.sub),
        verificationType: {
          $in: [VerificationType.NewProvider, VerificationType.AddCapability],
        },
        status: { $in: ACTIVE_VERIFICATION_STATUSES },
      })
      .sort({ createdAt: -1 });

    return verification ? this.toDetailResponse(verification, false) : null;
  }

  async getVerification(
    actor: AuthUser,
    id: string,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadVerification(id);
    this.assertOwnerOrAdmin(actor, verification);
    return this.toDetailResponse(verification, this.isAdmin(actor));
  }

  async updateVerification(
    actor: AuthUser,
    id: string,
    dto: UpdateProviderVerificationDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadOwnedEditableVerification(actor, id);
    const oldCapabilities = [...verification.requestedCapabilities];

    if (dto.requestedCapabilities) {
      const nextCapabilities = this.validateCapabilities(
        dto.requestedCapabilities,
      );
      const hasUploadedDocument = verification.documents.some((document) =>
        document.versions.some(
          (version) => version.uploadStatus === DocumentUploadStatus.Uploaded,
        ),
      );
      if (hasUploadedDocument) {
        throw new ConflictException(
          'requestedCapabilities cannot change after document upload',
        );
      }

      verification.requestedCapabilities = nextCapabilities;
      verification.documents = this.buildRequiredDocumentItems(nextCapabilities);
    }

    if (dto.businessProfile) {
      verification.businessProfile = {
        ...verification.businessProfile,
        ...dto.businessProfile,
      };
    }
    if (dto.aodaiInfo) {
      verification.aodaiInfo = {
        ...verification.aodaiInfo,
        ...dto.aodaiInfo,
      };
    }
    if (dto.photographyInfo) {
      verification.photographyInfo = {
        ...verification.photographyInfo,
        ...dto.photographyInfo,
      };
    }

    verification.verificationRevision += 1;
    await verification.save();

    if (dto.requestedCapabilities) {
      await this.writeAudit(
        actor,
        'CHANGE_PROVIDER_VERIFICATION_CAPABILITIES',
        verification._id,
        { requestedCapabilities: oldCapabilities },
        { requestedCapabilities: verification.requestedCapabilities },
        meta,
      );
    }

    await this.writeAudit(
      actor,
      'UPDATE_PROVIDER_VERIFICATION',
      verification._id,
      {},
      { fields: Object.keys(dto) },
      meta,
    );

    return this.toDetailResponse(verification, false);
  }

  async acceptConsent(
    actor: AuthUser,
    id: string,
    dto: AcceptProviderVerificationConsentDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadOwnedEditableVerification(actor, id);
    verification.consent = {
      accepted: true,
      version: dto.version,
      acceptedAt: new Date(),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    };
    await verification.save();

    await this.writeAudit(
      actor,
      'ACCEPT_PROVIDER_VERIFICATION_CONSENT',
      verification._id,
      {},
      { version: dto.version },
      meta,
    );

    return {
      accepted: true,
      version: verification.consent.version,
      acceptedAt: verification.consent.acceptedAt,
    };
  }

  async uploadDocument(
    actor: AuthUser,
    id: string,
    documentType: ProviderDocumentType,
    file: Express.Multer.File | undefined,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    return this.withUploadLock(`${id}:${documentType}`, async () => {
      const verification = await this.loadOwnedEditableVerification(actor, id);
      if (!verification.consent?.accepted) {
        throw new BadRequestException('Consent not accepted');
      }

      const validation = this.validateFile(file);
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      const document = this.getOrCreateDocumentItem(
        verification,
        documentType,
      );
      const now = new Date();
      const previousCurrentVersion = document.currentVersion ?? 0;
      const nextVersionNo = previousCurrentVersion + 1;
      const bucket = this.providerDocumentBucket();
      const storageKey = this.buildStorageKey(
        verification._id.toString(),
        documentType,
        nextVersionNo,
        validation.extension,
      );

      for (const version of document.versions) {
        if (version.isCurrent) {
          version.isCurrent = false;
          version.replacedAt = now;
        }
      }

      // 1. Upload file to private storage (MinIO) first
      await this.storageService.uploadPrivateFile(
        bucket,
        storageKey,
        file.buffer,
        validation.mimeType,
      );

      // 2. Create version with Uploaded status and save to DB
      const newVersion: ProviderVerificationDocumentVersion = {
        versionNo: nextVersionNo,
        isCurrent: true,
        uploadStatus: DocumentUploadStatus.Uploaded,
        storageProvider: 'MINIO',
        bucket,
        storageKey,
        originalFileName: file.originalname,
        mimeType: validation.mimeType,
        size: file.size,
        checksum,
        fileValidation: {
          mimeType: validation.mimeType,
          imageWidth: validation.imageWidth,
          imageHeight: validation.imageHeight,
        },
        ocrStatus: OcrStatus.NotStarted,
        ocrConfidence: null,
        extractedFields: {},
        mismatchFlags: [],
        ocr: {
          executionStatus: OcrExecutionStatus.NotStarted,
          assessment: null,
          activeAttemptId: null,
          operationId: null,
          retryCount: 0,
          warningCodes: [],
          qualityIssues: [],
        },
        uploadedAt: new Date(),
        processedAt: null,
        replacedAt: null,
        deletedAt: null,
      };

      document.versions.push(newVersion);
      document.currentVersion = nextVersionNo;
      const currentVersion = document.versions.find((version) => version.versionNo === nextVersionNo && version.isCurrent);
      if (!currentVersion) throw new InternalServerErrorException('Unable to create document version');
      let ocrRequest: { attemptId: string; operationId: string } | null = null;
      const requiresOcr = this.ocrOutboxService.isEnabled() && this.isOcrApplicable(documentType);
      const persist = async (session?: ClientSession) => {
        if (requiresOcr) {
          ocrRequest = await this.ocrOutboxService.createRequest(
            verification._id,
            documentType,
            nextVersionNo,
            session,
          );
          currentVersion.ocr = {
            executionStatus: OcrExecutionStatus.NotStarted,
            assessment: null,
            activeAttemptId: ocrRequest.attemptId,
            operationId: ocrRequest.operationId,
            retryCount: 0,
            warningCodes: [],
            qualityIssues: [],
          };
        }
        verification.markModified('documents');
        await verification.save({ session });
      };
      if (requiresOcr) {
        const session = await this.verificationModel.db.startSession();
        try {
          await session.withTransaction(() => persist(session));
        } finally {
          await session.endSession();
        }
      } else {
        await persist();
      }
      await this.writeAudit(
        actor,
        'UPLOAD_PROVIDER_VERIFICATION_DOCUMENT',
        verification._id,
        {},
        { documentType, versionNo: nextVersionNo },
        meta,
      );
      await this.writeAudit(
        actor,
        'DOCUMENT_VERSION_CREATED',
        verification._id,
        {},
        { documentType, versionNo: nextVersionNo },
        meta,
      );

      return {
        documentType,
        versionNo: nextVersionNo,
        uploadStatus: DocumentUploadStatus.Uploaded,
        ocrStatus: OcrStatus.NotStarted,
        executionStatus: currentVersion.ocr?.executionStatus ?? null,
        operationId: currentVersion.ocr?.operationId ?? null,
      };
    });
  }

  async listDocuments(
    actor: AuthUser,
    id: string,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadVerification(id);
    this.assertOwnerOrAdmin(actor, verification);
    return {
      documents: verification.documents.map((document) =>
        this.toDocumentSummary(document, this.isAdmin(actor), false),
      ),
    };
  }

  async listDocumentVersions(
    actor: AuthUser,
    id: string,
    documentType: ProviderDocumentType,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadVerification(id);
    this.assertOwnerOrAdmin(actor, verification);
    const document = this.findDocumentItem(verification, documentType);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (this.isAdmin(actor)) {
      await this.writeAudit(
        actor,
        'VIEW_PROVIDER_VERIFICATION_VERSION_HISTORY',
        verification._id,
        {},
        { documentType },
        meta,
      );
    }

    return {
      documentType,
      versions: document.versions.map((version) =>
        this.toVersionSummary(version, this.isAdmin(actor)),
      ),
    };
  }

  async viewDocument(
    actor: AuthUser,
    id: string,
    documentType: ProviderDocumentType,
    meta: RequestMeta,
    versionNo?: number,
  ): Promise<DocumentStreamResult> {
    const verification = await this.loadVerification(id);
    if (!this.canAccessVerification(actor, verification)) {
      await this.writeAudit(
        actor,
        'FAILED_PROVIDER_VERIFICATION_DOCUMENT_ACCESS',
        verification._id,
        {},
        { documentType, versionNo },
        meta,
      );
      throw new ForbiddenException('Not owner or admin');
    }

    const version = this.getDocumentVersion(
      verification,
      documentType,
      versionNo,
    );
    if (version.uploadStatus !== DocumentUploadStatus.Uploaded) {
      throw new ConflictException('Document upload is not completed');
    }

    const stream = await this.storageService.readPrivateFile(
      version.bucket,
      version.storageKey,
    );

    await this.writeAudit(
      actor,
      'VIEW_PROVIDER_VERIFICATION_DOCUMENT',
      verification._id,
      {},
      { documentType, versionNo: version.versionNo },
      meta,
    );

    return {
      file: new StreamableFile(stream),
      mimeType: version.mimeType,
      fileName: version.originalFileName,
    };
  }

  async runOcr(
    actor: AuthUser,
    id: string,
    documentType: ProviderDocumentType,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadVerification(id);
    this.assertOwnerOrAdmin(actor, verification);
    if (
      !OCR_REQUIRED_TYPES.includes(documentType) &&
      !OCR_OPTIONAL_TYPES.includes(documentType)
    ) {
      throw new ConflictException('OCR not applicable for this document type');
    }

    const version = this.getDocumentVersion(verification, documentType);
    if (version.uploadStatus !== DocumentUploadStatus.Uploaded) {
      throw new ConflictException('Upload not completed');
    }

    await this.assertOcrRateLimit(actor, verification._id, documentType);
    if (this.ocrOutboxService.isEnabled()) {
      if (version.ocr?.executionStatus === OcrExecutionStatus.Processing) {
        throw new ConflictException('OCR is already processing for this document');
      }
      let request: { attemptId: string; operationId: string };
      const session = await this.verificationModel.db.startSession();
      try {
        request = await session.withTransaction(async () => {
          const queuedRequest = await this.ocrOutboxService.createRequest(
            verification._id,
            documentType,
            version.versionNo,
            session,
          );
          version.ocr = {
            executionStatus: OcrExecutionStatus.NotStarted,
            assessment: null,
            activeAttemptId: queuedRequest.attemptId,
            operationId: queuedRequest.operationId,
            retryCount: (version.ocr?.retryCount ?? 0) + 1,
            warningCodes: [],
            qualityIssues: [],
          };
          version.ocrStatus = OcrStatus.NotStarted;
          verification.markModified('documents');
          await verification.save({ session });
          return queuedRequest;
        });
      } finally {
        await session.endSession();
      }
      if (!request) throw new InternalServerErrorException('Unable to queue OCR request');
      await this.writeAudit(
        actor,
        'RUN_PROVIDER_VERIFICATION_OCR',
        verification._id,
        {},
        { documentType, versionNo: version.versionNo, stage: 'QUEUED', operationId: request.operationId },
        meta,
      );
      return {
        accepted: true,
        operationId: request.operationId,
        executionStatus: OcrExecutionStatus.NotStarted,
      };
    }
    await this.writeAudit(
      actor,
      'RUN_PROVIDER_VERIFICATION_OCR',
      verification._id,
      {},
      { documentType, versionNo: version.versionNo, stage: 'STARTED' },
      meta,
    );

    version.ocrStatus = OcrStatus.Processing;
    verification.markModified('documents');
    await verification.save();

    try {
      const ocrResult = await this.extractSafeOcrResult(
        version,
        verification,
        documentType,
      );

      version.ocrStatus = ocrResult.ocrStatus;
      version.ocrConfidence = ocrResult.ocrConfidence;
      version.extractedFields = ocrResult.extractedFields;
      version.mismatchFlags = ocrResult.mismatchFlags;
      version.processedAt = new Date();
      verification.markModified('documents');
      await verification.save();

      await this.writeAudit(
        actor,
        'PROVIDER_VERIFICATION_OCR_RESULT',
        verification._id,
        {},
        {
          documentType,
          versionNo: version.versionNo,
          ocrStatus: version.ocrStatus,
          mismatchFlags: version.mismatchFlags,
        },
        meta,
      );

      return {
        ocrStatus: version.ocrStatus,
        ocrConfidence: version.ocrConfidence,
        extractedFields: version.extractedFields,
        mismatchFlags: version.mismatchFlags,
      };
    } catch (error) {
      version.ocrStatus = OcrStatus.NotStarted;
      version.ocrConfidence = null;
      version.extractedFields = {};
      version.mismatchFlags = [];
      verification.markModified('documents');
      await verification.save();
      await this.writeAudit(
        actor,
        'PROVIDER_VERIFICATION_OCR_RESULT',
        verification._id,
        {},
        {
          documentType,
          versionNo: version.versionNo,
          ocrStatus: OcrStatus.NotStarted,
          errorCode: this.ocrErrorCode(error),
        },
        meta,
      );
      throw error;
    }
  }

  async submitVerification(
    actor: AuthUser,
    id: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const verification = await this.loadOwnedEditableVerification(actor, id);
    this.validateReadyForSubmitOrApproval(verification, 'submit');

    const previousStatus = verification.status;
    verification.status = VerificationStatus.Submitted;
    verification.submittedAt = new Date();
    this.addTimeline(
      verification,
      previousStatus,
      VerificationStatus.Submitted,
      actor.sub,
      'Submitted by customer',
    );
    await verification.save();

    await this.writeAudit(
      actor,
      'SUBMIT_PROVIDER_VERIFICATION',
      verification._id,
      { status: previousStatus },
      { status: verification.status },
      meta,
    );
    await this.notifyUser(
      verification.userId,
      'Hồ sơ đăng ký đối tác đã được gửi',
      'Hồ sơ đăng ký đối tác của bạn đã được gửi và đang chờ xét duyệt.',
      { verificationId: verification._id.toString() },
    );

    return {
      status: verification.status,
      submittedAt: verification.submittedAt,
    };
  }

  async adminList(actor: AuthUser): Promise<Record<string, unknown>> {
    this.requireAdmin(actor);
    const verifications = await this.verificationModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(100);

    return {
      items: verifications.map((verification) =>
        this.toListItemResponse(verification),
      ),
    };
  }

  async adminDetail(
    actor: AuthUser,
    id: string,
  ): Promise<Record<string, unknown>> {
    this.requireAdmin(actor);
    const verification = await this.loadVerification(id);
    return this.toDetailResponse(verification, true);
  }

  async adminStartReview(
    actor: AuthUser,
    id: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    this.requireAdmin(actor);
    const verification = await this.loadVerification(id);
    if (verification.status !== VerificationStatus.Submitted) {
      throw new ConflictException('Invalid verification status');
    }

    this.transitionStatus(
      verification,
      VerificationStatus.UnderReview,
      actor.sub,
      'Admin started review',
    );
    await verification.save();

    await this.writeAudit(
      actor,
      'START_PROVIDER_VERIFICATION_REVIEW',
      verification._id,
      { status: VerificationStatus.Submitted },
      { status: VerificationStatus.UnderReview },
      meta,
    );

    return { status: verification.status };
  }

  async adminApprove(
    actor: AuthUser,
    id: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    this.requireAdmin(actor);
    const verification = await this.loadVerification(id);
    this.assertReviewable(verification);
    this.validateReadyForSubmitOrApproval(verification, 'approve');

    const existingProvider = await this.providerModel.findOne({
      userId: verification.userId,
      status: ProviderStatus.Active,
    });

    let provider;
    const isUpgrade = verification.verificationType === VerificationType.AddCapability;

    if (isUpgrade) {
      if (!existingProvider) {
        throw new NotFoundException('Không tìm thấy tài khoản Provider hoạt động để nâng cấp vai trò.');
      }
      const nextCapabilities = Array.from(
        new Set([
          ...(existingProvider.capabilities || []),
          ...verification.requestedCapabilities,
        ]),
      );
      existingProvider.capabilities = nextCapabilities;

      if (verification.requestedCapabilities.includes(ProviderCapability.AoDaiRental)) {
        if (verification.aodaiInfo?.rentalPolicy) {
          existingProvider.policies = {
            ...existingProvider.policies,
            rentalPolicy: verification.aodaiInfo.rentalPolicy,
          };
        }
      }
      provider = await existingProvider.save();
    } else {
      if (existingProvider) {
        throw new ConflictException('User already has an active provider');
      }

      provider = await this.providerModel.create({
        userId: verification.userId,
        businessName:
          verification.businessProfile.businessName ??
          verification.aodaiInfo.shopName ??
          verification.photographyInfo.studioName ??
          'VibeHue Provider',
        capabilities: verification.requestedCapabilities,
        contact: {
          email: verification.businessProfile.email ?? '',
          phone: verification.businessProfile.phone ?? '',
        },
        address: {
          addressLine:
            verification.businessProfile.address ??
            verification.aodaiInfo.pickupAddress ??
            verification.photographyInfo.workingArea ??
            '',
          city: verification.businessProfile.province ?? null,
        },
        media: { images: [] },
        policies: {
          rentalPolicy: verification.aodaiInfo.rentalPolicy ?? null,
        },
        status: ProviderStatus.Active,
        approvedAt: new Date(),
        approvedBy: this.toObjectId(actor.sub),
        rating: { averageRating: 0, totalReviews: 0 },
      });
    }

    const previousStatus = verification.status;
    verification.status = VerificationStatus.Approved;
    verification.providerId = provider._id;
    verification.review = {
      reviewedBy: this.toObjectId(actor.sub),
      reviewedAt: new Date(),
      decision: VerificationReviewDecision.Approved,
      reason: dto.reason ?? null,
      note: dto.note ?? null,
    };
    this.addTimeline(
      verification,
      previousStatus,
      VerificationStatus.Approved,
      actor.sub,
      dto.reason ?? 'Approved by admin',
    );
    await verification.save();

    await this.userModel.findByIdAndUpdate(verification.userId, {
      $addToSet: { roles: 'PROVIDER' },
      $set: {
        defaultRole: 'PROVIDER',
        'provider.providerId': provider._id,
        'provider.providerStatus': UserProviderStatus.Active,
      },
    });

    await this.writeAudit(
      actor,
      'APPROVE_PROVIDER_VERIFICATION',
      verification._id,
      { status: previousStatus },
      { status: VerificationStatus.Approved },
      meta,
    );
    await this.writeAudit(
      actor,
      isUpgrade ? 'UPGRADE_PROVIDER_CAPABILITIES' : 'CREATE_PROVIDER_FROM_VERIFICATION',
      provider._id,
      {},
      { verificationId: verification._id, capabilities: provider.capabilities },
      meta,
      'providers',
    );
    await this.notifyUser(
      verification.userId,
      'Hồ sơ đăng ký đối tác đã được phê duyệt',
      'Hồ sơ đăng ký đối tác của bạn đã được phê duyệt. Bạn có thể bắt đầu quản lý dịch vụ.',
      { verificationId: verification._id.toString(), providerId: provider._id.toString() },
    );

    return {
      verification: { status: verification.status },
      provider: { id: provider._id, status: provider.status },
      user: { rolesAdded: ['PROVIDER'] },
    };
  }

  async adminReject(
    actor: AuthUser,
    id: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!dto.reason) {
      throw new BadRequestException('Reject reason is required');
    }
    return this.adminReviewTerminal(
      actor,
      id,
      VerificationStatus.Rejected,
      VerificationReviewDecision.Rejected,
      'REJECT_PROVIDER_VERIFICATION',
      dto,
      meta,
      'Hồ sơ đăng ký đối tác của bạn đã bị từ chối. Vui lòng xem lý do và gửi lại hồ sơ khi đã hoàn thiện.',
    );
  }

  async adminRequestChanges(
    actor: AuthUser,
    id: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!dto.reason && !dto.changeRequests?.length) {
      throw new BadRequestException('At least one change request is required');
    }
    if (!dto.reason && dto.changeRequests?.length) {
      dto.reason = this.changeRequestSummary(dto.changeRequests);
    }
    return this.adminReviewTerminal(
      actor,
      id,
      VerificationStatus.NeedsChanges,
      VerificationReviewDecision.NeedsChanges,
      'REQUEST_PROVIDER_VERIFICATION_CHANGES',
      dto,
      meta,
      'Hồ sơ đăng ký đối tác của bạn cần được bổ sung hoặc điều chỉnh. Vui lòng xem yêu cầu từ quản trị viên.',
    );
  }

  async adminSuspendProvider(
    actor: AuthUser,
    id: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.adminChangeProviderStatus(
      actor,
      id,
      ProviderStatus.Suspended,
      'SUSPEND_PROVIDER',
      dto,
      meta,
      'Tài khoản đối tác đã bị tạm ngưng',
      'Tài khoản đối tác của bạn đã bị tạm ngưng. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
    );
  }

  async adminUnsuspendProvider(
    actor: AuthUser,
    id: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.adminChangeProviderStatus(
      actor,
      id,
      ProviderStatus.Active,
      'UNSUSPEND_PROVIDER',
      dto,
      meta,
      'Tài khoản đối tác đã được kích hoạt lại',
      'Tài khoản đối tác của bạn đã được kích hoạt lại. Bạn có thể tiếp tục sử dụng các chức năng dành cho đối tác.',
    );
  }

  private async adminReviewTerminal(
    actor: AuthUser,
    id: string,
    nextStatus: VerificationStatus,
    decision: VerificationReviewDecision,
    auditAction: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
    notificationContent: string,
  ): Promise<Record<string, unknown>> {
    this.requireAdmin(actor);
    const verification = await this.loadVerification(id);
    this.assertReviewable(verification);

    const previousStatus = verification.status;
    const changeRequests =
      decision === VerificationReviewDecision.NeedsChanges
        ? this.normalizeChangeRequests(dto.changeRequests ?? [], verification)
        : [];
    verification.status = nextStatus;
    verification.review = {
      reviewedBy: this.toObjectId(actor.sub),
      reviewedAt: new Date(),
      decision,
      reason: dto.reason ?? null,
      note: dto.note ?? null,
      changeRequests,
    };
    this.addTimeline(
      verification,
      previousStatus,
      nextStatus,
      actor.sub,
      dto.reason ?? null,
    );
    await verification.save();

    await this.writeAudit(
      actor,
      auditAction,
      verification._id,
      { status: previousStatus },
      { status: nextStatus, reason: dto.reason, changeRequests },
      meta,
    );
    await this.notifyUser(
      verification.userId,
      nextStatus === VerificationStatus.Rejected
        ? 'Hồ sơ đăng ký đối tác bị từ chối'
        : 'Hồ sơ đăng ký đối tác cần bổ sung',
      notificationContent,
      { verificationId: verification._id.toString() },
    );

    return { status: verification.status, review: verification.review };
  }

  private hasUnresolvedRequiredReupload(
    verification: ProviderVerificationDocument,
  ): boolean {
    return (verification.review?.changeRequests ?? []).some((request) => {
      if (
        request.action !== ProviderChangeRequestAction.Reupload &&
        request.requestedRevision != null &&
        verification.verificationRevision <= request.requestedRevision
      ) {
        return true;
      }
      if (request.action !== ProviderChangeRequestAction.Reupload) return false;
      const documentType =
        request.target === ProviderChangeRequestTarget.IdentityCardFront
          ? ProviderDocumentType.IdentityCardFront
          : request.target === ProviderChangeRequestTarget.IdentityCardBack
            ? ProviderDocumentType.IdentityCardBack
            : null;
      if (!documentType || request.documentVersionNo == null) return false;
      const current = verification.documents
        .find((document) => document.documentType === documentType)
        ?.versions.find((version) => version.isCurrent);
      return !current || current.versionNo <= request.documentVersionNo;
    });
  }
  private normalizeChangeRequests(
    requests: ProviderChangeRequestDto[],
    verification: ProviderVerificationDocument,
  ) {
    const seen = new Set<string>();
    return requests.flatMap((request) => {
      const key = `${request.target}:${request.action}:${request.reasonCode}`;
      if (seen.has(key)) return [];
      seen.add(key);

      const documentType =
        request.target === ProviderChangeRequestTarget.IdentityCardFront
          ? ProviderDocumentType.IdentityCardFront
          : request.target === ProviderChangeRequestTarget.IdentityCardBack
            ? ProviderDocumentType.IdentityCardBack
            : null;
      const document = documentType
        ? verification.documents.find((item) => item.documentType === documentType)
        : null;
      const currentVersion = document?.versions.find((item) => item.isCurrent);

      return [{
        target: request.target,
        action: request.action,
        reasonCode: request.reasonCode,
        note: request.note?.trim() || null,
        documentVersionNo: currentVersion?.versionNo ?? null,
        requestedRevision: verification.verificationRevision,
      }];
    });
  }

  private changeRequestSummary(requests: ProviderChangeRequestDto[]): string {
    return requests
      .map((request) => request.note?.trim() || request.reasonCode)
      .filter(Boolean)
      .join('; ');
  }
  private async adminChangeProviderStatus(
    actor: AuthUser,
    id: string,
    nextStatus: ProviderStatus,
    auditAction: string,
    dto: AdminReviewDecisionDto,
    meta: RequestMeta,
    notificationTitle: string,
    notificationContent: string,
  ): Promise<Record<string, unknown>> {
    this.requireAdmin(actor);
    const provider = await this.providerModel.findById(this.toObjectId(id));
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    if (provider.status === nextStatus) {
      throw new ConflictException('Provider already has requested status');
    }

    const previousStatus = provider.status;
    provider.status = nextStatus;
    await provider.save();

    await this.userModel.findByIdAndUpdate(provider.userId, {
      $set: { 'provider.providerStatus': nextStatus },
    });

    // Status updated successfully. Do not revoke sessions so provider users can still access Customer functions.

    await this.writeAudit(
      actor,
      auditAction,
      provider._id,
      { status: previousStatus },
      { status: nextStatus, reason: dto.reason ?? null },
      meta,
      'providers',
    );
    await this.notifyUser(provider.userId, notificationTitle, notificationContent, {
      providerId: provider._id.toString(),
      reason: dto.reason ?? null,
    });

    return {
      providerId: provider._id,
      status: provider.status,
    };
  }

  private validateReadyForSubmitOrApproval(
    verification: ProviderVerificationDocument,
    action: 'submit' | 'approve',
  ): void {
    if (action === 'submit' && !EDITABLE_STATUSES.includes(verification.status)) {
      throw new ConflictException('Invalid verification status');
    }
    if (action === 'submit' && this.hasUnresolvedRequiredReupload(verification)) {
      throw new ConflictException('Upload a new version of each requested identity document before resubmitting');
    }    if (action === 'approve' && !REVIEWABLE_STATUSES.includes(verification.status)) {
      throw new ConflictException('Invalid verification status');
    }
    this.validateBusinessProfile(verification);
    if (!verification.consent?.accepted) {
      throw new BadRequestException('Consent not accepted');
    }

    const requiredDocs = this.requiredDocumentTypes(
      verification.requestedCapabilities,
    );
    for (const documentType of requiredDocs) {
      const version = this.getDocumentVersion(verification, documentType);
      if (version.uploadStatus !== DocumentUploadStatus.Uploaded) {
        throw new BadRequestException(`Required document ${documentType} is not uploaded`);
      }
    }
  }

  private validateBusinessProfile(
    verification: ProviderVerificationDocument,
  ): void {
    const requiredProfileFields: Array<keyof ProviderVerification['businessProfile']> = [
      'businessName',
      'ownerName',
      'phone',
      'email',
      'address',
      'province',
    ];
    for (const field of requiredProfileFields) {
      if (!verification.businessProfile?.[field]) {
        throw new BadRequestException(`Missing required field businessProfile.${field}`);
      }
    }
    if (
      verification.requestedCapabilities.includes(ProviderCapability.AoDaiRental)
    ) {
      for (const field of ['shopName', 'rentalPolicy', 'depositPolicy', 'pickupAddress', 'sizeSupport'] as const) {
        if (!verification.aodaiInfo?.[field]) {
          throw new BadRequestException(`Missing required field aodaiInfo.${field}`);
        }
      }
    }
    if (
      verification.requestedCapabilities.includes(ProviderCapability.Photography)
    ) {
      for (const field of ['studioName', 'workingArea'] as const) {
        if (!verification.photographyInfo?.[field]) {
          throw new BadRequestException(`Missing required field photographyInfo.${field}`);
        }
      }
    }
  }

  private validateCapabilities(
    capabilities: ProviderCapability[],
  ): ProviderCapability[] {
    const unique = [...new Set(capabilities)];
    if (unique.length !== capabilities.length) {
      throw new BadRequestException('requestedCapabilities must not contain duplicates');
    }
    if (unique.length === 0) {
      throw new BadRequestException('requestedCapabilities must not be empty');
    }
    for (const capability of unique) {
      if (!Object.values(ProviderCapability).includes(capability)) {
        throw new BadRequestException('Invalid requestedCapabilities');
      }
    }
    return unique;
  }

  private buildRequiredDocumentItems(
    capabilities: ProviderCapability[],
  ): ProviderVerificationDocumentItem[] {
    return this.requiredDocumentTypes(capabilities).map((documentType) => ({
      documentType,
      required: true,
      currentVersion: null,
      versions: [],
    }));
  }

  private requiredDocumentTypes(
    capabilities: ProviderCapability[],
  ): ProviderDocumentType[] {
    const required = new Set<ProviderDocumentType>([
      ProviderDocumentType.IdentityCardFront,
      ProviderDocumentType.IdentityCardBack,
    ]);
    if (capabilities.includes(ProviderCapability.AoDaiRental)) {
      required.add(ProviderDocumentType.ShopPhotoProof);
    }
    if (capabilities.includes(ProviderCapability.Photography)) {
      required.add(ProviderDocumentType.StudioPortfolioProof);
    }
    return [...required];
  }

  private getOrCreateDocumentItem(
    verification: ProviderVerificationDocument,
    documentType: ProviderDocumentType,
  ): ProviderVerificationDocumentItem {
    const supportedTypes = Object.values(ProviderDocumentType);
    if (!supportedTypes.includes(documentType)) {
      throw new BadRequestException('Unsupported document type');
    }
    let document = this.findDocumentItem(verification, documentType);
    if (!document) {
      document = {
        documentType,
        required: false,
        currentVersion: null,
        versions: [],
      };
      verification.documents.push(document);
    }
    return document;
  }

  private findDocumentItem(
    verification: ProviderVerificationDocument,
    documentType: ProviderDocumentType,
  ): ProviderVerificationDocumentItem | undefined {
    return verification.documents.find(
      (document) => document.documentType === documentType,
    );
  }

  private getDocumentVersion(
    verification: ProviderVerificationDocument,
    documentType: ProviderDocumentType,
    versionNo?: number,
  ): ProviderVerificationDocumentVersion {
    const document = this.findDocumentItem(verification, documentType);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    const version =
      versionNo === undefined
        ? document.versions.find((item) => item.isCurrent)
        : document.versions.find((item) => item.versionNo === versionNo);
    if (!version || version.uploadStatus === DocumentUploadStatus.Deleted) {
      throw new NotFoundException('Document version not found');
    }
    return version;
  }

  private validateFile(file: Express.Multer.File): FileValidationResult {
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must be 5MB or less');
    }
    const magic = file.buffer.subarray(0, 8);
    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8;
    const isPng =
      magic[0] === 0x89 &&
      magic[1] === 0x50 &&
      magic[2] === 0x4e &&
      magic[3] === 0x47;
    const isPdf =
      magic[0] === 0x25 &&
      magic[1] === 0x50 &&
      magic[2] === 0x44 &&
      magic[3] === 0x46;

    if (!isJpeg && !isPng && !isPdf) {
      throw new UnsupportedMediaTypeException('Only jpg, png, and pdf files are allowed');
    }

    if (isPdf) {
      return { mimeType: 'application/pdf', extension: '.pdf' };
    }

    const dimensions = isPng
      ? this.readPngDimensions(file.buffer)
      : this.readJpegDimensions(file.buffer);
    if (!dimensions) {
      throw new BadRequestException('Unable to read image dimensions');
    }
    return {
      mimeType: isPng ? 'image/png' : 'image/jpeg',
      extension: isPng ? '.png' : '.jpg',
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
    };
  }

  private readPngDimensions(
    buffer: Buffer,
  ): { width: number; height: number } | null {
    if (buffer.length < 24) {
      return null;
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  private readJpegDimensions(
    buffer: Buffer,
  ): { width: number; height: number } | null {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        return null;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
    return null;
  }

  private async extractSafeOcrResult(
    version: ProviderVerificationDocumentVersion,
    verification: ProviderVerificationDocument,
    documentType: ProviderDocumentType,
  ): Promise<{
    ocrStatus: OcrStatus;
    ocrConfidence: number;
    extractedFields: Record<string, unknown>;
    mismatchFlags: string[];
  }> {
    if (version.mimeType === 'application/pdf') {
      return {
        ocrStatus: OcrStatus.NeedsManualReview,
        ocrConfidence: 0,
        extractedFields: {
          fullName: verification.businessProfile.ownerName ?? null,
          idNumberMasked: null,
          idNumberHash: null,
        },
        mismatchFlags: ['PDF_OCR_REQUIRES_MANUAL_REVIEW'],
      };
    }

    const ocrResult = await this.runTesseractForVersion(version);
    const text = ocrResult.text.replace(/\s+/g, ' ').trim();
    const idNumber = text.match(/\b\d{9,12}\b/)?.[0] ?? null;
    const mismatchFlags: string[] = [];
    const ownerName = verification.businessProfile.ownerName;
    const ownerNameFound = Boolean(
      ownerName &&
        text &&
        this.normalizeForOcrComparison(text).includes(
          this.normalizeForOcrComparison(ownerName),
        ),
    );

    if (ownerName && text && !ownerNameFound) {
      mismatchFlags.push('OWNER_NAME_NOT_FOUND_IN_OCR_TEXT');
    }
    const confidence = ocrResult.confidence;
    let ocrStatus = OcrStatus.Passed;
    if (!text || (!idNumber && OCR_REQUIRED_TYPES.includes(documentType))) {
      ocrStatus = OcrStatus.Failed;
    } else if (confidence < 0.8) {
      ocrStatus = OcrStatus.LowConfidence;
    } else if (mismatchFlags.length > 0) {
      ocrStatus = OcrStatus.MismatchDetected;
    }

    return {
      ocrStatus,
      ocrConfidence: confidence,
      extractedFields: {
        fullName: ownerNameFound ? ownerName : null,
        idNumberMasked: idNumber ? this.maskIdNumber(idNumber) : null,
        idNumberHash: idNumber ? this.hashSensitiveValue(idNumber) : null,
      },
      mismatchFlags,
    };
  }

  private async runTesseractForVersion(
    version: ProviderVerificationDocumentVersion,
  ): Promise<TesseractOcrResult> {
    const tempDir = this.configService.get<string>(
      'OCR_TEMP_DIR',
      join(process.cwd(), 'private-storage', 'ocr-temp-files'),
    );
    await mkdir(tempDir, { recursive: true });

    const extension = this.extensionFromMimeType(version.mimeType);
    const inputPath = join(tempDir, `${randomUUID()}${extension}`);
    const outputBase = join(tempDir, randomUUID());
    const outputPath = `${outputBase}.tsv`;

    try {
      const stream = await this.storageService.readPrivateFile(
        version.bucket,
        version.storageKey,
      );
      const buffer = await this.streamToBuffer(stream);

      const httpOcrResult = await this.runRemoteOcrIfConfigured(
        buffer,
        version.mimeType,
        version.originalFileName,
      );
      if (httpOcrResult) {
        return httpOcrResult;
      }

      await writeFile(inputPath, buffer);

      await execFileAsync(
        this.configService.get<string>('TESSERACT_CMD', 'tesseract'),
        [
          inputPath,
          outputBase,
          '-l',
          this.configService.get<string>('TESSERACT_LANG', 'vie+eng'),
          '--psm',
          this.configService.get<string>('TESSERACT_PSM', '6'),
          'tsv',
        ],
        {
          timeout: this.readNumber('OCR_TIMEOUT_MS', 30000),
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        },
      );

      const tsv = await readFile(outputPath, 'utf8');
      return this.parseTesseractTsv(tsv);
    } catch (error) {
      if (this.isMissingTesseractError(error)) {
        throw new InternalServerErrorException(
          'Tesseract OCR is not installed or TESSERACT_CMD is invalid',
        );
      }
      throw new InternalServerErrorException('OCR processing failed');
    } finally {
      await rm(inputPath, { force: true }).catch(() => undefined);
      await rm(outputPath, { force: true }).catch(() => undefined);
    }
  }

  private async runRemoteOcrIfConfigured(
    buffer: Buffer,
    mimeType: string,
    originalFileName: string,
  ): Promise<TesseractOcrResult | null> {
    const serviceUrl = this.configService.get<string>('OCR_SERVICE_URL');
    if (!serviceUrl) {
      return null;
    }

    try {
      const formData = new FormData();
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      formData.append(
        'file',
        new Blob([arrayBuffer], { type: mimeType }),
        originalFileName || 'document',
      );

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.readNumber('OCR_TIMEOUT_MS', 30000),
      );
      let response: Response;
      try {
        response = await fetch(`${serviceUrl.replace(/\/$/, '')}/ocr`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`OCR service returned ${response.status}`);
      }

      const data = (await response.json()) as OcrHttpServiceResponse;
      return {
        text: typeof data.text === 'string' ? data.text : '',
        confidence:
          typeof data.confidence === 'number' && Number.isFinite(data.confidence)
            ? data.confidence
            : 0,
      };
    } catch {
      throw new InternalServerErrorException('Remote OCR service failed');
    }
  }

  private parseTesseractTsv(tsv: string): TesseractOcrResult {
    const lines = tsv.split(/\r?\n/).filter(Boolean);
    const words: string[] = [];
    const confidences: number[] = [];

    for (const line of lines.slice(1)) {
      const columns = line.split('\t');
      const confidence = Number(columns[10]);
      const text = columns[11]?.trim();
      if (text) {
        words.push(text);
      }
      if (Number.isFinite(confidence) && confidence >= 0) {
        confidences.push(confidence / 100);
      }
    }

    const averageConfidence =
      confidences.length > 0
        ? confidences.reduce((total, value) => total + value, 0) /
          confidences.length
        : 0;

    return {
      text: words.join(' '),
      confidence: Number(averageConfidence.toFixed(2)),
    };
  }

  private extensionFromMimeType(mimeType: string): string {
    if (mimeType === 'image/png') {
      return '.png';
    }
    if (mimeType === 'image/jpeg') {
      return '.jpg';
    }
    return '.bin';
  }

  private isMissingTesseractError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const maybeError = error as { code?: string };
    return maybeError.code === 'ENOENT';
  }

  private async assertOcrRateLimit(
    actor: AuthUser,
    verificationId: Types.ObjectId,
    documentType: ProviderDocumentType,
  ): Promise<void> {
    const now = Date.now();
    const [userRuns, documentRuns] = await Promise.all([
      this.auditLogModel.countDocuments({
        actorId: this.toObjectId(actor.sub),
        action: 'RUN_PROVIDER_VERIFICATION_OCR',
        createdAt: { $gte: new Date(now - 60 * 60 * 1000) },
      }),
      this.auditLogModel.countDocuments({
        resource: 'provider_verifications',
        resourceId: verificationId,
        action: 'RUN_PROVIDER_VERIFICATION_OCR',
        'newValues.documentType': documentType,
        createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
      }),
    ]);
    if (userRuns >= 5) {
      throw new HttpException('OCR rate limit exceeded for this user', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (documentRuns >= 3) {
      throw new HttpException('OCR rate limit exceeded for this document', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private normalizeForOcrComparison(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private ocrErrorCode(error: unknown): string {
    if (error instanceof InternalServerErrorException) {
      return 'OCR_SERVICE_UNAVAILABLE';
    }
    return 'OCR_PROCESSING_FAILED';
  }
  private toDetailResponse(
    verification: ProviderVerificationDocument,
    includeAdminData: boolean,
  ): Record<string, unknown> {
    const requiredDocuments = verification.documents
      .filter((document) => document.required)
      .map((document) => document.documentType);
    const missingDocuments = verification.documents
      .filter((document) => document.required)
      .filter((document) => {
        const current = document.versions.find((version) => version.isCurrent);
        return !current || current.uploadStatus !== DocumentUploadStatus.Uploaded;
      })
      .map((document) => document.documentType);

    return {
      verificationId: verification._id,
      status: verification.status,
      verificationType: verification.verificationType,
      verificationRevision: verification.verificationRevision,
      requestedCapabilities: verification.requestedCapabilities,
      businessProfile: verification.businessProfile,
      aodaiInfo: verification.aodaiInfo,
      photographyInfo: verification.photographyInfo,
      consent: {
        accepted: verification.consent?.accepted ?? false,
        version: verification.consent?.version ?? null,
        acceptedAt: verification.consent?.acceptedAt ?? null,
      },
      requiredDocuments,
      missingDocuments,
      documents: verification.documents.map((document) =>
        this.toDocumentSummary(document, includeAdminData, true),
      ),
      ocrWarnings: this.ocrWarnings(verification),
      review: verification.review,
      statusTimeline: verification.statusTimeline,
      createdAt: verification.get('createdAt'),
      updatedAt: verification.get('updatedAt'),
    };
  }

  private toListItemResponse(
    verification: ProviderVerificationDocument,
  ): Record<string, unknown> {
    return {
      verificationId: verification._id,
      userId: verification.userId,
      status: verification.status,
      verificationType: verification.verificationType,
      verificationRevision: verification.verificationRevision,
      requestedCapabilities: verification.requestedCapabilities,
      businessName: verification.businessProfile?.businessName ?? null,
      submittedAt: verification.submittedAt ?? null,
      createdAt: verification.get('createdAt'),
      updatedAt: verification.get('updatedAt'),
    };
  }

  private toDocumentSummary(
    document: ProviderVerificationDocumentItem,
    includeVersions: boolean,
    includeCurrentOnly: boolean,
  ): Record<string, unknown> {
    const current = document.versions.find((version) => version.isCurrent);
    return {
      documentType: document.documentType,
      required: document.required,
      currentVersion: document.currentVersion ?? null,
      current: current ? this.toVersionSummary(current, false) : null,
      versions: includeVersions || !includeCurrentOnly
        ? document.versions.map((version) => this.toVersionSummary(version, includeVersions))
        : undefined,
    };
  }

  private toVersionSummary(
    version: ProviderVerificationDocumentVersion,
    includeHistoryFields: boolean,
  ): Record<string, unknown> {
    return {
      versionNo: version.versionNo,
      isCurrent: version.isCurrent,
      uploadStatus: version.uploadStatus,
      originalFileName: version.originalFileName,
      mimeType: version.mimeType,
      size: version.size,
      checksum: includeHistoryFields ? version.checksum : undefined,
      fileValidation: version.fileValidation,
      ocrStatus: version.ocrStatus,
      ocrConfidence: version.ocrConfidence ?? null,
ocr: version.ocr
        ? {
            executionStatus: version.ocr.executionStatus,
            assessment: version.ocr.assessment ?? null,
            legacyStatus: version.ocrStatus,
            operationId: version.ocr.operationId ?? null,
            startedAt: version.ocr.startedAt ?? null,
            heartbeatAt: version.ocr.heartbeatAt ?? null,
            completedAt: version.ocr.completedAt ?? null,
            retryCount: version.ocr.retryCount,
            warningCodes: version.ocr.warningCodes,
            qualityIssues: version.ocr.qualityIssues,
            engine: version.ocr.engine ?? null,
            engineVersion: version.ocr.engineVersion ?? null,
            language: version.ocr.language ?? null,
            psmMode: version.ocr.psmMode ?? null,
            nextAction: this.ocrNextAction(version),
          }
        : null,
      extractedFields: version.extractedFields,
      mismatchFlags: version.mismatchFlags,
      uploadedAt: version.uploadedAt ?? null,
      processedAt: version.processedAt ?? null,
      replacedAt: includeHistoryFields ? version.replacedAt ?? null : undefined,
      deletedAt: includeHistoryFields ? version.deletedAt ?? null : undefined,
    };
  }

private isOcrApplicable(documentType: ProviderDocumentType): boolean {
    return OCR_REQUIRED_TYPES.includes(documentType) || OCR_OPTIONAL_TYPES.includes(documentType);
  }
  private ocrNextAction(version: ProviderVerificationDocumentVersion): string | null {
    const ocr = version.ocr;
    if (!ocr) return null;
    if (ocr.executionStatus === 'NOT_STARTED' || ocr.executionStatus === 'PROCESSING' || ocr.executionStatus === 'TIMEOUT') return 'WAIT_FOR_OCR';
    if (ocr.assessment === 'REUPLOAD_REQUIRED' || ocr.executionStatus === 'FAILED') return 'UPLOAD_AGAIN';
    return ocr.assessment === 'PASSED' ? 'READY_TO_SUBMIT' : 'SUBMIT_WITH_MANUAL_REVIEW';
  }
  private ocrWarnings(
    verification: ProviderVerificationDocument,
  ): Array<Record<string, unknown>> {
    const warningStatuses = [
      OcrStatus.LowConfidence,
      OcrStatus.MismatchDetected,
      OcrStatus.NeedsManualReview,
      OcrStatus.Failed,
    ];
    return verification.documents.flatMap((document) =>
      document.versions
        .filter((version) => version.isCurrent)
        .filter((version) => warningStatuses.includes(version.ocrStatus))
        .map((version) => ({
          documentType: document.documentType,
          ocrStatus: version.ocrStatus,
          mismatchFlags: version.mismatchFlags,
        })),
    );
  }

  private async loadOwnedEditableVerification(
    actor: AuthUser,
    id: string,
  ): Promise<ProviderVerificationDocument> {
    const verification = await this.loadVerification(id);
    this.assertOwner(actor, verification);
    if (!EDITABLE_STATUSES.includes(verification.status)) {
      throw new ConflictException('Invalid verification status');
    }
    return verification;
  }

  private async loadVerification(
    id: string,
  ): Promise<ProviderVerificationDocument> {
    const verification = await this.verificationModel.findById(this.toObjectId(id));
    if (!verification) {
      throw new NotFoundException('Provider verification not found');
    }
    await this.reconcilePendingUploads(verification);
    return verification;
  }

  private async reconcilePendingUploads(
    verification: ProviderVerificationDocument,
  ): Promise<void> {
    let changed = false;

    for (const document of verification.documents) {
      for (const version of document.versions) {
        if (version.uploadStatus !== DocumentUploadStatus.PendingUpload) {
          continue;
        }

        try {
          const exists = await this.storageService.exists(
            version.bucket,
            version.storageKey,
          );
          if (exists) {
            version.uploadStatus = DocumentUploadStatus.Uploaded;
            version.uploadedAt = version.uploadedAt ?? new Date();
            changed = true;
          }
        } catch {
          // Keep detail pages usable even when storage is temporarily unavailable.
        }
      }
    }

    if (changed) {
      verification.markModified('documents');
      await verification.save();
    }
  }

  private async loadUser(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(this.toObjectId(id));
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private assertReviewable(verification: ProviderVerificationDocument): void {
    if (!REVIEWABLE_STATUSES.includes(verification.status)) {
      throw new ConflictException('Invalid verification status');
    }
  }

  private assertOwner(actor: AuthUser, verification: ProviderVerificationDocument): void {
    if (verification.userId.toString() !== actor.sub) {
      throw new ForbiddenException('Not owner');
    }
  }

  private assertOwnerOrAdmin(
    actor: AuthUser,
    verification: ProviderVerificationDocument,
  ): void {
    if (!this.canAccessVerification(actor, verification)) {
      throw new ForbiddenException('Not owner or admin');
    }
  }

  private canAccessVerification(
    actor: AuthUser,
    verification: ProviderVerificationDocument,
  ): boolean {
    return this.isAdmin(actor) || verification.userId.toString() === actor.sub;
  }

  private isAdmin(actor: AuthUser): boolean {
    return actor.roles?.includes('ADMIN') ?? false;
  }

  private requireAdmin(actor: AuthUser): void {
    this.requireRole(actor, 'ADMIN');
  }

  private requireRole(actor: AuthUser, role: string): void {
    if (!actor.roles?.includes(role)) {
      throw new ForbiddenException(`${role} role is required`);
    }
  }

  private transitionStatus(
    verification: ProviderVerificationDocument,
    nextStatus: VerificationStatus,
    actorId: string,
    reason: string,
  ): void {
    const previousStatus = verification.status;
    verification.status = nextStatus;
    this.addTimeline(verification, previousStatus, nextStatus, actorId, reason);
  }

  private addTimeline(
    verification: ProviderVerificationDocument,
    fromStatus: VerificationStatus,
    toStatus: VerificationStatus,
    actorId: string,
    reason: string | null,
  ): void {
    verification.statusTimeline.push({
      fromStatus,
      toStatus,
      changedBy: this.toObjectId(actorId),
      changedAt: new Date(),
      reason,
    });
  }

  private providerDocumentBucket(): string {
    return this.configService.get<string>(
      'MINIO_PROVIDER_DOCUMENT_BUCKET',
      'provider-documents',
    );
  }

  private readNumber(key: string, defaultValue: number): number {
    const value = this.configService.get<string>(key);
    if (!value) {
      return defaultValue;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  private buildStorageKey(
    verificationId: string,
    documentType: ProviderDocumentType,
    versionNo: number,
    extension: string,
  ): string {
    const safeExtension = extension || '.bin';
    return `provider-verifications/${verificationId}/documents/${documentType}/v${versionNo}-${new Types.ObjectId().toString()}${safeExtension}`;
  }

  private async writeAudit(
    actor: AuthUser,
    action: string,
    resourceId: Types.ObjectId,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    meta: RequestMeta,
    resource = 'provider_verifications',
  ): Promise<AuditLogDocument> {
    return this.auditLogModel.create({
      actorId: this.toObjectId(actor.sub),
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  private async notifyUser(
    userId: Types.ObjectId,
    title: string,
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<NotificationDocument> {
    return this.notificationModel.create({
      userId,
      title,
      content,
      type: NotificationType.System,
      metadata,
    });
  }

  private async withUploadLock<T>(
    key: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.uploadLocks.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => next);
    this.uploadLocks.set(key, chained);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.uploadLocks.get(key) === chained) {
        this.uploadLocks.delete(key);
      }
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private maskIdNumber(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  }

  private hashSensitiveValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) {
      return id;
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID');
    }
    return new Types.ObjectId(id);
  }
}
