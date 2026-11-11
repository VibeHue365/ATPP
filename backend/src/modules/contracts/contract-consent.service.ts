import { createHash } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
} from '../bookings/schemas/digital-contract.schema';
import { canonicalizeContract, hashContract } from './canonical-contract';
import { ContractAccessService } from './contract-access.service';
import { ContractPolicyService } from './contract-policy.service';
import { ContractPreparationService } from './contract-preparation.service';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractTemplateService } from './contract-template';
import { ContractMechanismService } from './contract-mechanism.service';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import { ContractConsentDto } from './dto/contract-consent.dto';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentRole,
} from './schemas/contract-consent.schema';
import {
  ContractVersion,
  ContractVersionState,
} from './schemas/contract-version.schema';
import { contractDb, contractObjectId } from './contract-source.types';

export interface ConsentRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ContractConsentService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(DigitalContract.name)
    private readonly contracts: Model<DigitalContract>,
    @InjectModel(ContractVersion.name)
    private readonly versions: Model<ContractVersion>,
    @InjectModel(ContractConsent.name)
    private readonly consents: Model<ContractConsent>,
    private readonly access: ContractAccessService,
    private readonly policy: ContractPolicyService,
    private readonly preparation: ContractPreparationService,
    private readonly snapshots: ContractSnapshotService,
    private readonly templates: ContractTemplateService,
    private readonly mechanism: ContractMechanismService,
  ) {}

  async decide(
    user: AuthUser,
    contractId: string,
    dto: ContractConsentDto,
    meta: ConsentRequestMeta = {},
  ) {
    if (!this.enabled)
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const actorUserId = contractObjectId(user.sub);
    const contract = await this.contracts
      .findById(contractObjectId(contractId))
      .lean();
    if (
      !contract ||
      contract.flowVersion !== 2 ||
      contract.scope !== ContractScope.AoDaiRental ||
      contract.approvalMode !== ContractApprovalMode.AutoAcceptance
    )
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    const booking = await this.access.booking(contract.bookingId.toString());
    this.access.assertCustomer(user, booking);
    if (contract.customerId.toString() !== actorUserId.toString())
      throw new NotFoundException('CONTRACT_NOT_FOUND');
    if (booking.status === 'CANCELLED')
      throw new ConflictException('BOOKING_ALREADY_CANCELLED');
    if (booking.status !== 'PENDING_PAYMENT')
      throw new ConflictException('BOOKING_NOT_ACCEPTABLE');
    const versionId = contractObjectId(dto.contractVersionId);
    if (!contract.currentVersionId?.equals(versionId))
      throw new ConflictException('CONTRACT_VERSION_STALE');
    const version = await this.versions.findById(versionId).lean();
    if (!version || version.contractId.toString() !== contract._id.toString())
      throw new ConflictException('CONTRACT_VERSION_STALE');
    if (
      dto.contentHash !== version.contentHash ||
      dto.bookingFingerprint !== version.bookingFingerprint
    )
      throw new ConflictException('CONTRACT_CONTENT_CHANGED');

    const previous = await this.consents
      .findOne({ contractVersionId: versionId, actorUserId })
      .lean();
    if (previous) return this.resolveRetry(previous, dto);
    const reusedKey = await this.consents
      .findOne({ actorUserId, idempotencyKey: dto.idempotencyKey })
      .lean();
    if (reusedKey)
      throw new ConflictException('CONSENT_IDEMPOTENCY_KEY_REUSED');
    if (version.state !== ContractVersionState.Offered)
      throw new ConflictException('CONTRACT_VERSION_NOT_OFFERED');
    if (version.expiresAt && version.expiresAt <= new Date())
      throw new ConflictException('CONTRACT_VERSION_EXPIRED');
    const template = this.templates.getApproved();
    const mechanism = this.mechanism.getApproved();
    if (template.version !== version.templateVersion)
      throw new ConflictException('CONTRACT_TEMPLATE_CHANGED');
    const renderedHash = createHash('sha256')
      .update(version.renderedText, 'utf8')
      .digest('hex');
    if (renderedHash !== version.contentHash)
      throw new ConflictException('CONTRACT_RENDERED_CONTENT_MISMATCH');
    const context = await this.policy.getContext(booking._id.toString());
    await this.preparation.assertLiveHold(context, contract.providerId);
    const acceptance = await this.policy.requireAutoAcceptance(
      contract.providerId,
      template.version,
    );
    if (
      !version.providerAcceptanceId?.equals(acceptance._id) ||
      acceptance.mechanismHash !== mechanism.hash ||
      acceptance.acceptedAt > new Date()
    )
      throw new ConflictException('PROVIDER_ACCEPTANCE_CHANGED');
    const snapshot = await this.snapshots.build(
      context,
      contract.providerId,
      template,
    );
    if (acceptance.policyFingerprint !== hashContract(snapshot.policies))
      throw new ConflictException('PROVIDER_POLICY_ACCEPTANCE_STALE');
    const liveBookingFingerprint = hashContract({
      booking: snapshot.booking,
      providerItems: snapshot.providerItems,
      pricing: snapshot.pricing,
    });
    if (liveBookingFingerprint !== version.bookingFingerprint)
      throw new ConflictException('BOOKING_FINGERPRINT_STALE');
    if (
      hashContract({ template, snapshot }) !== version.contentHash ||
      canonicalizeContract({ template, snapshot }) !== version.renderedText
    )
      throw new ConflictException('CONTRACT_CONTENT_STALE');
    await this.assertConsentIndexes();

    const session = await this.connection.startSession();
    try {
      let result: ReturnType<ContractConsentService['response']> | undefined;
      await session.withTransaction(async () => {
        await this.preparation.assertSourcesUnchanged(
          context,
          contract.providerId,
          session,
        );
        await this.preparation.assertLiveHold(
          context,
          contract.providerId,
          session,
        );
        const active = await this.policy.requireAutoAcceptance(
          contract.providerId,
          template.version,
          session,
        );
        if (!active._id.equals(acceptance._id))
          throw new ConflictException('PROVIDER_ACCEPTANCE_CHANGED');
        if (
          active.mechanismHash !== mechanism.hash ||
          active.policyFingerprint !== acceptance.policyFingerprint
        )
          throw new ConflictException('PROVIDER_ACCEPTANCE_CHANGED');
        const currentContract = await this.contracts
          .findById(contract._id)
          .session(session);
        const currentVersion = await this.versions
          .findById(versionId)
          .session(session);
        if (
          !currentContract?.currentVersionId?.equals(versionId) ||
          (currentVersion?.state !== ContractVersionState.Offered &&
            currentVersion?.state !== ContractVersionState.Draft) ||
          (currentVersion.expiresAt && currentVersion.expiresAt <= new Date())
        )
          throw new ConflictException('CONTRACT_VERSION_STALE');
        const existing = await this.consents
          .findOne({ contractVersionId: versionId, actorUserId })
          .session(session);
        if (existing) {
          result = this.resolveRetry(existing, dto);
          return;
        }
        const now = new Date();
        const consent = new this.consents({
          contractId: contract._id,
          contractVersionId: versionId,
          actorUserId,
          actorRole: ContractConsentRole.Customer,
          action: dto.action,
          contentHash: version.contentHash,
          bookingFingerprint: version.bookingFingerprint,
          idempotencyKey: dto.idempotencyKey,
          occurredAt: now,
          authenticationMethod: 'APP_SESSION',
          ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
          userAgent: meta.userAgent?.slice(0, 512) ?? null,
          presentationMode: (version as any).presentationMode || 'DETAILED',
        });
        await consent.save({ session });
        const update =
          dto.action === ContractConsentAction.Accept
            ? { state: ContractVersionState.Accepted, customerAcceptedAt: now }
            : { state: ContractVersionState.Declined };
        const changed = await this.versions.updateOne(
          {
            _id: versionId,
            state: ContractVersionState.Offered,
            contentHash: version.contentHash,
            bookingFingerprint: version.bookingFingerprint,
          },
          { $set: update },
          { session },
        );
        if (changed.modifiedCount !== 1)
          throw new ConflictException('CONTRACT_VERSION_STALE');
        result = this.response(consent);
      });
      if (!result)
        throw new ServiceUnavailableException('CONTRACT_CONSENT_ABORTED');
      return result;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const winner = await this.consents
        .findOne({ contractVersionId: versionId, actorUserId })
        .lean();
      if (winner) return this.resolveRetry(winner, dto);
      throw new ConflictException('CONSENT_IDEMPOTENCY_KEY_REUSED');
    } finally {
      await session.endSession();
    }
  }

  private resolveRetry(
    consent: Pick<
      ContractConsent,
      | 'action'
      | 'idempotencyKey'
      | 'contentHash'
      | 'bookingFingerprint'
      | 'occurredAt'
    > & { _id: Types.ObjectId },
    dto: ContractConsentDto,
  ) {
    if (
      consent.action !== dto.action ||
      consent.idempotencyKey !== dto.idempotencyKey ||
      consent.contentHash !== dto.contentHash ||
      consent.bookingFingerprint !== dto.bookingFingerprint
    )
      throw new ConflictException('CONTRACT_CONSENT_ALREADY_DECIDED');
    return this.response(consent);
  }

  private response(
    consent: Pick<ContractConsent, 'action' | 'occurredAt'> & {
      _id: Types.ObjectId;
    },
  ) {
    return {
      consentId: consent._id.toString(),
      action: consent.action,
      decidedAt: consent.occurredAt,
      formedAt: null,
      effectiveAt: null,
    };
  }

  private async assertConsentIndexes() {
    const col = contractDb(this.connection).collection('contract_consents');
    let indexes = await col.indexes();
    let hasDecision = indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) ===
          JSON.stringify({ contractVersionId: 1, actorUserId: 1 }),
    );
    let hasKey = indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) ===
          JSON.stringify({ actorUserId: 1, idempotencyKey: 1 }),
    );

    if (!hasDecision && typeof col.createIndex === 'function') {
      try {
        await col.createIndex(
          { contractVersionId: 1, actorUserId: 1 },
          { unique: true, name: 'contract_consent_actor_version_unique' },
        );
        hasDecision = true;
      } catch {}
    }

    if (!hasKey && typeof col.createIndex === 'function') {
      try {
        await col.createIndex(
          { actorUserId: 1, idempotencyKey: 1 },
          { unique: true, name: 'contract_consent_idempotency_unique' },
        );
        hasKey = true;
      } catch {}
    }

    if (!hasDecision || !hasKey) {
      indexes = await col.indexes();
      hasDecision = indexes.some(
        (index) =>
          index.unique &&
          JSON.stringify(index.key) ===
            JSON.stringify({ contractVersionId: 1, actorUserId: 1 }),
      );
      hasKey = indexes.some(
        (index) =>
          index.unique &&
          JSON.stringify(index.key) ===
            JSON.stringify({ actorUserId: 1, idempotencyKey: 1 }),
      );
    }

    if (!hasDecision || !hasKey)
      throw new ServiceUnavailableException(
        'CONTRACT_INDEX_MIGRATION_REQUIRED',
      );
  }
}
