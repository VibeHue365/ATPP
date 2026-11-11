import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrivateStorageService } from '../storage/services/private-storage.service';
import { DigitalContract } from '../bookings/schemas/digital-contract.schema';
import {
  ContractDocumentMetadata,
  ContractDocumentStatus,
  ContractVersion,
  ContractVersionState,
} from './schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
} from './schemas/contract-consent.schema';
import { ContractAccessService } from './contract-access.service';
import { ContractPdfGenerator } from './contract-pdf-generator';
import { contractObjectId } from './contract-source.types';

export interface ContractEvidenceSummary {
  contractId: string;
  contractCode: string;
  versionId: string;
  versionNumber: number;
  contentHash: string;
  bookingFingerprint: string;
  documentStatus: ContractDocumentStatus;
  pdfSha256?: string | null;
  storageProvider?: string | null;
  storageKey?: string | null;
  generatedAt?: Date | null;
  customerConsent?: {
    consentedAt: Date;
    authMethod: string;
    userId: string;
  } | null;
  integrityVerified: boolean;
}

@Injectable()
export class ContractEvidenceService {
  private readonly logger = new Logger(ContractEvidenceService.name);
  private readonly BUCKET_NAME = 'contracts';

  constructor(
    @InjectModel(DigitalContract.name)
    private readonly contracts: Model<DigitalContract>,
    @InjectModel(ContractVersion.name)
    private readonly versions: Model<ContractVersion>,
    @InjectModel(ContractConsent.name)
    private readonly consents: Model<ContractConsent>,
    private readonly storage: PrivateStorageService,
    private readonly access: ContractAccessService,
  ) {}

  /**
   * Generates and stores an immutable PDF document for an accepted or effective ContractVersion.
   * Fully idempotent: returns existing document if already generated and persisted.
   */
  /**
   * Generates and stores an immutable PDF document for an accepted or effective ContractVersion.
   * Fully idempotent with atomic CAS claim lease: prevents concurrent duplicate generation and protects READY documents.
   */
  async generateAndStorePdf(
    versionId: string | Types.ObjectId,
    options?: { force?: boolean },
  ): Promise<ContractDocumentMetadata> {
    const vId =
      typeof versionId === 'string' ? contractObjectId(versionId) : versionId;
    const version = await this.versions.findById(vId);
    if (!version) {
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    }

    // Idempotency: Return existing document if already generated and file exists in storage
    if (
      !options?.force &&
      version.document?.status === ContractDocumentStatus.Ready &&
      version.document?.storageKey &&
      version.document?.bucket
    ) {
      const exists = await this.storage.exists(
        version.document.bucket,
        version.document.storageKey,
      );
      if (exists) {
        return version.document;
      }
    }

    // Atomic CAS Claim: Acquire GENERATING lease
    const claimToken = randomUUID();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + 60_000); // 60-second recovery lease

    const claimed = await this.versions.findOneAndUpdate(
      {
        _id: vId,
        $or: [
          {
            'document.status': {
              $in: [
                ContractDocumentStatus.Pending,
                ContractDocumentStatus.Failed,
              ],
            },
          },
          {
            'document.status': ContractDocumentStatus.Generating,
            'document.leaseExpiresAt': { $lt: now },
          },
          ...(options?.force
            ? [{ 'document.status': ContractDocumentStatus.Ready }]
            : []),
        ],
      },
      {
        $set: {
          'document.status': ContractDocumentStatus.Generating,
          'document.claimToken': claimToken,
          'document.leaseExpiresAt': leaseExpiresAt,
        },
      },
      { returnDocument: 'after' },
    );

    // If claim was not acquired, another worker is actively generating or already published READY
    if (!claimed) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const refreshed = await this.versions.findById(vId);
        if (refreshed?.document?.status === ContractDocumentStatus.Ready) {
          return refreshed.document;
        }
        if (refreshed?.document?.status !== ContractDocumentStatus.Generating) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      const finalCheck = await this.versions.findById(vId);
      return finalCheck?.document || version.document;
    }

    const contract = await this.contracts.findById(version.contractId);
    if (!contract) {
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    }

    // Find accepted customer consent
    const customerConsent = await this.consents.findOne({
      contractVersionId: version._id,
      action: ContractConsentAction.Accept,
    });

    try {
      // Generate PDF buffer from stored immutable version
      const { buffer, sha256 } = await ContractPdfGenerator.generate({
        contractCode: contract.contractCode,
        versionNumber: version.version,
        versionId: version._id.toString(),
        contentHash: version.contentHash,
        bookingFingerprint: version.bookingFingerprint,
        renderedText: version.renderedText,
        snapshot: version.snapshot,
        consent: customerConsent
          ? {
              customerConsentAt: customerConsent.occurredAt,
              customerAuthMethod: customerConsent.authenticationMethod,
              customerUserId: customerConsent.actorUserId.toString(),
              providerAcceptanceRegulation:
                'AUTO_ACCEPTANCE_REGULATION_AO_DAI_RENTAL',
            }
          : null,
      });

      const storageKey = `contracts/${contract._id.toString()}/${version._id.toString()}/${version.contentHash}.pdf`;
      const uploadResult = await this.storage.uploadPrivateFile(
        this.BUCKET_NAME,
        storageKey,
        buffer,
        'application/pdf',
      );

      const documentMetadata: ContractDocumentMetadata = {
        status: ContractDocumentStatus.Ready,
        storageProvider: uploadResult.storageProvider,
        bucket: uploadResult.bucket,
        storageKey: uploadResult.storageKey,
        sha256,
        generatedAt: new Date(),
        retryCount: claimed.document?.retryCount || 0,
        lastError: null,
        claimToken: null,
        leaseExpiresAt: null,
      };

      // Atomic commit to READY matching active claimToken
      const committed = await this.versions.findOneAndUpdate(
        {
          _id: version._id,
          'document.claimToken': claimToken,
        },
        { $set: { document: documentMetadata } },
        { returnDocument: 'after' },
      );

      if (!committed) {
        this.logger.warn(
          `Claim lease expired during upload for contract version ${version._id.toString()}. Did not overwrite.`,
        );
      } else {
        this.logger.log(
          `Generated and stored contract PDF for version ${version._id.toString()} (SHA-256: ${sha256}).`,
        );
      }

      return documentMetadata;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to generate or upload PDF for contract version ${version._id.toString()}: ${errorMsg}`,
        errorStack,
      );

      const failedMetadata: ContractDocumentMetadata = {
        status: ContractDocumentStatus.Failed,
        storageProvider: version.document?.storageProvider ?? null,
        bucket: version.document?.bucket ?? null,
        storageKey: version.document?.storageKey ?? null,
        sha256: version.document?.sha256 ?? null,
        generatedAt: version.document?.generatedAt ?? null,
        retryCount: (claimed.document?.retryCount || 0) + 1,
        lastError: errorMsg || 'PDF_GENERATION_FAILED',
        claimToken: null,
        leaseExpiresAt: null,
      };

      await this.versions.updateOne(
        { _id: version._id, 'document.claimToken': claimToken },
        { $set: { document: failedMetadata } },
      );

      throw error;
    }
  }

  /**
   * Retrieves the readable PDF stream with authorization check.
   * Generates the PDF on-demand if not already ready.
   */
  async getPdfStream(
    user: AuthUser,
    contractId: string,
    versionId?: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    sha256: string;
    contentHash: string;
  }> {
    const contract = await this.contracts
      .findById(contractObjectId(contractId))
      .lean();
    if (!contract) {
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    }

    const booking = await this.access.booking(contract.bookingId.toString());
    await this.access.assertContractReader(user, booking, contract.providerId);

    const targetVersionId = versionId
      ? contractObjectId(versionId)
      : contract.currentVersionId;
    if (!targetVersionId) {
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    }

    let version = await this.versions.findById(targetVersionId);
    if (!version || version.contractId.toString() !== contract._id.toString()) {
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    }

    const customerConsent = await this.consents
      .findOne({
        contractVersionId: version._id,
        action: ContractConsentAction.Accept,
      })
      .lean();

    const isOfficial = Boolean(
      customerConsent || version.state === ContractVersionState.Accepted,
    );

    // 1. If document is already READY in storage:
    // Check if it was generated before customer consented (i.e. was a draft that needs upgrading to signed evidence)
    const isStaleDraft = Boolean(
      customerConsent &&
        version.document?.generatedAt &&
        customerConsent.occurredAt &&
        version.document.generatedAt < customerConsent.occurredAt,
    );

    if (
      !isStaleDraft &&
      version.document?.status === ContractDocumentStatus.Ready &&
      version.document?.storageKey &&
      version.document?.bucket
    ) {
      const stream = await this.storage.readPrivateFile(
        version.document.bucket,
        version.document.storageKey,
      );
      const filename = `${contract.contractCode}-v${version.version}.pdf`;
      return {
        stream,
        filename,
        sha256: version.document.sha256 || '',
        contentHash: version.contentHash,
      };
    }

    // 2. Official document is NOT ready or is a stale draft that needs official regeneration:
    if (isOfficial) {
      await this.generateAndStorePdf(version._id, { force: isStaleDraft });
      version = await this.versions.findById(targetVersionId);

      if (
        version?.document?.status !== ContractDocumentStatus.Ready ||
        !version?.document?.storageKey ||
        !version?.document?.bucket
      ) {
        throw new UnprocessableEntityException('CONTRACT_PDF_NOT_READY');
      }

      const stream = await this.storage.readPrivateFile(
        version.document.bucket,
        version.document.storageKey,
      );

      const filename = `${contract.contractCode}-v${version.version}.pdf`;
      return {
        stream,
        filename,
        sha256: version.document.sha256 || '',
        contentHash: version.contentHash,
      };
    }

    // 3. Customer has NOT consented yet: generate ephemeral draft preview on-the-fly
    // without marking the document READY in database.
    const { buffer, sha256 } = await ContractPdfGenerator.generate({
      contractCode: contract.contractCode,
      versionNumber: version.version,
      versionId: version._id.toString(),
      contentHash: version.contentHash,
      bookingFingerprint: version.bookingFingerprint,
      renderedText: version.renderedText,
      snapshot: version.snapshot,
      consent: null,
    });

    const filename = `${contract.contractCode}-v${version.version}-draft-preview.pdf`;
    return {
      stream: Readable.from(buffer),
      filename,
      sha256,
      contentHash: version.contentHash,
    };
  }

  /**
   * Gets immutable evidence metadata for legal verification.
   */
  async getEvidence(
    user: AuthUser,
    contractId: string,
    versionId?: string,
  ): Promise<ContractEvidenceSummary> {
    const contract = await this.contracts
      .findById(contractObjectId(contractId))
      .lean();
    if (!contract) {
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    }

    const booking = await this.access.booking(contract.bookingId.toString());
    await this.access.assertContractReader(user, booking, contract.providerId);

    const targetVersionId = versionId
      ? contractObjectId(versionId)
      : contract.currentVersionId;
    if (!targetVersionId) {
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    }

    const version = await this.versions.findById(targetVersionId).lean();
    if (!version || version.contractId.toString() !== contract._id.toString()) {
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    }

    const customerConsent = await this.consents
      .findOne({
        contractVersionId: version._id,
        action: ContractConsentAction.Accept,
      })
      .lean();

    const integrityVerified = Boolean(
      version.document?.status === ContractDocumentStatus.Ready &&
      version.document?.sha256 &&
      version.contentHash,
    );

    return {
      contractId: contract._id.toString(),
      contractCode: contract.contractCode,
      versionId: version._id.toString(),
      versionNumber: version.version,
      contentHash: version.contentHash,
      bookingFingerprint: version.bookingFingerprint,
      documentStatus:
        version.document?.status || ContractDocumentStatus.Pending,
      pdfSha256: version.document?.sha256 ?? null,
      storageProvider: version.document?.storageProvider ?? null,
      storageKey: version.document?.storageKey ?? null,
      generatedAt: version.document?.generatedAt ?? null,
      customerConsent: customerConsent
        ? {
            consentedAt: customerConsent.occurredAt,
            authMethod: customerConsent.authenticationMethod,
            userId: customerConsent.actorUserId.toString(),
          }
        : null,
      integrityVerified,
    };
  }

  /**
   * Verifies the SHA-256 integrity of the stored PDF file against the metadata record.
   */
  async verifyIntegrity(versionId: string | Types.ObjectId): Promise<{
    valid: boolean;
    storedSha256: string;
    actualSha256: string;
    contentHashMatchesConsent?: boolean;
  }> {
    const vId =
      typeof versionId === 'string' ? contractObjectId(versionId) : versionId;
    const version = await this.versions.findById(vId).lean();
    if (!version) {
      throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
    }

    if (
      version.document?.status !== ContractDocumentStatus.Ready ||
      !version.document?.storageKey ||
      !version.document?.bucket ||
      !version.document?.sha256
    ) {
      throw new UnprocessableEntityException('CONTRACT_PDF_NOT_READY');
    }

    const stream = await this.storage.readPrivateFile(
      version.document.bucket,
      version.document.storageKey,
    );

    const customerConsent = await this.consents
      .findOne({
        contractVersionId: version._id,
        action: ContractConsentAction.Accept,
      })
      .lean();

    const actualSha256 = await new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      stream.on('data', (chunk: Buffer | string) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });

    const storedSha256 = version.document.sha256;
    const shaValid = storedSha256 === actualSha256;
    const contentHashMatchesConsent = customerConsent
      ? customerConsent.contentHash === version.contentHash
      : true;

    return {
      valid: shaValid && contentHashMatchesConsent,
      storedSha256,
      actualSha256,
      contentHashMatchesConsent,
    };
  }

  /**
   * Durable background recovery worker for contract PDF evidence.
   * Scans for FAILED documents or expired GENERATING leases with exponential backoff.
   * Completely independent of PaymentRecovery; never alters bookings or payments.
   */
  async recoverFailedPdfs(options?: {
    batchSize?: number;
    maxRetries?: number;
  }): Promise<{ scanned: number; recovered: number; failed: number }> {
    const batchSize = options?.batchSize || 20;
    const maxRetries = options?.maxRetries || 5;
    const now = new Date();

    const candidates = await this.versions
      .find({
        state: {
          $in: [ContractVersionState.Accepted, ContractVersionState.Effective],
        },
        $or: [
          {
            'document.status': ContractDocumentStatus.Failed,
            'document.retryCount': { $lt: maxRetries },
          },
          {
            'document.status': ContractDocumentStatus.Generating,
            'document.leaseExpiresAt': { $lt: now },
          },
        ],
      })
      .limit(batchSize)
      .lean();

    let recovered = 0;
    let failed = 0;

    for (const candidate of candidates) {
      // Exponential backoff: delay = 2^retryCount * 5 seconds
      const retryCount = candidate.document?.retryCount || 0;
      const delayMs = Math.min(Math.pow(2, retryCount) * 5_000, 300_000);
      const candidateMeta = candidate as unknown as { updatedAt?: Date };
      const lastAttempt =
        candidate.document?.generatedAt ||
        candidateMeta.updatedAt ||
        new Date(0);
      if (now.getTime() - new Date(lastAttempt).getTime() < delayMs) {
        continue;
      }

      try {
        await this.generateAndStorePdf(candidate._id);
        recovered++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Durable recovery retry failed for version ${candidate._id.toString()}: ${errMsg}`,
        );
        failed++;
      }
    }

    return { scanned: candidates.length, recovered, failed };
  }
}
