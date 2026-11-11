import { createHash } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
} from '../bookings/schemas/digital-contract.schema';
import {
  ContractPaymentBinding,
  PaymentPurpose,
} from '../payments/schemas/payment.schema';
import { hashContract } from './canonical-contract';
import { ContractMechanismService } from './contract-mechanism.service';
import {
  ContractPolicyService,
  RentalContractContext,
} from './contract-policy.service';
import { ContractPreparationService } from './contract-preparation.service';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractTemplateService } from './contract-template';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import {
  ContractConsent,
  ContractConsentAction,
} from './schemas/contract-consent.schema';
import {
  ContractVersion,
  ContractVersionState,
} from './schemas/contract-version.schema';

export interface CheckoutDecision {
  binding: ContractPaymentBinding | null;
  context: RentalContractContext | null;
}

/** Server-side V2 check. No frontend readiness flag or client fingerprint is accepted. */
@Injectable()
export class ContractCheckoutGuard {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectModel(DigitalContract.name)
    private readonly contracts: Model<DigitalContract>,
    @InjectModel(ContractVersion.name)
    private readonly versions: Model<ContractVersion>,
    @InjectModel(ContractConsent.name)
    private readonly consents: Model<ContractConsent>,
    private readonly policy: ContractPolicyService,
    private readonly snapshots: ContractSnapshotService,
    private readonly preparation: ContractPreparationService,
    private readonly templates: ContractTemplateService,
    private readonly mechanism: ContractMechanismService,
  ) {}

  async evaluate(
    bookingId: string,
    amount: number,
    purpose: PaymentPurpose,
  ): Promise<CheckoutDecision> {
    const context = await this.policy.getContext(bookingId);
    const { booking } = context;
    if (
      booking.contractFlowVersion !== 2 ||
      booking.bookingType === 'PHOTOGRAPHY'
    )
      return { binding: null, context: null };
    if (!this.enabled)
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const now = new Date();
    if (!booking.holdExpiresAt && booking.status === 'PENDING_PAYMENT') {
      const createdAtTime = (booking as any).createdAt
        ? new Date((booking as any).createdAt).getTime()
        : now.getTime();
      const holdWindowMs = 15 * 60 * 1000;
      if (now.getTime() - createdAtTime <= holdWindowMs) {
        booking.holdExpiresAt = new Date(createdAtTime + holdWindowMs);
        await this.contracts.db.collection('bookings').updateOne(
          { _id: booking._id },
          { $set: { holdExpiresAt: booking.holdExpiresAt } },
        );
      }
    }
    if (
      booking.status !== 'PENDING_PAYMENT' ||
      !booking.holdExpiresAt ||
      booking.holdExpiresAt <= now
    )
      throw new ConflictException('BOOKING_HOLD_EXPIRED');
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new ConflictException('PAYMENT_AMOUNT_INVALID');
    if (!context.rentalProviderIds.length)
      throw new ConflictException('RENTAL_ITEMS_MISSING');

    const template = this.templates.getApproved();
    const mechanism = this.mechanism.getApproved();
    const versions: ContractPaymentBinding['versions'] = [];
    const fingerprints: string[] = [];
    for (const providerId of context.rentalProviderIds) {
      await this.preparation.assertLiveHold(context, providerId);
      const contract = await this.contracts
        .findOne({
          bookingId: booking._id,
          providerId,
          scope: ContractScope.AoDaiRental,
          flowVersion: 2,
          approvalMode: ContractApprovalMode.AutoAcceptance,
        })
        .lean();
      if (
        !contract?.currentVersionId ||
        !contract.customerId.equals(booking.customerId)
      )
        throw new ConflictException('CONTRACT_MISSING');
      const version = await this.versions
        .findById(contract.currentVersionId)
        .lean();
      if (
        !version ||
        !version.contractId.equals(contract._id) ||
        version.state !== ContractVersionState.Accepted ||
        version.templateVersion !== template.version
      )
        throw new ConflictException('CONTRACT_VERSION_NOT_ACCEPTED');
      const consent = await this.consents
        .findOne({
          contractVersionId: version._id,
          actorUserId: booking.customerId,
          action: ContractConsentAction.Accept,
          contentHash: version.contentHash,
          bookingFingerprint: version.bookingFingerprint,
        })
        .lean();
      if (!consent || !consent.contractId.equals(contract._id))
        throw new ConflictException('CONTRACT_CONSENT_MISSING');
      const acceptance = await this.policy.requireAutoAcceptance(
        providerId,
        template.version,
      );
      if (
        !version.providerAcceptanceId?.equals(acceptance._id) ||
        acceptance.mechanismHash !== mechanism.hash ||
        acceptance.mechanismVersion !== mechanism.version
      )
        throw new ConflictException('PROVIDER_ACCEPTANCE_STALE');
      const snapshot = await this.snapshots.build(
        context,
        providerId,
        template,
      );
      const fingerprint = hashContract({
        booking: snapshot.booking,
        providerItems: snapshot.providerItems,
        pricing: snapshot.pricing,
      });
      if (
        fingerprint !== version.bookingFingerprint ||
        hashContract({ template, snapshot }) !== version.contentHash ||
        createHash('sha256').update(version.renderedText).digest('hex') !==
          version.contentHash ||
        acceptance.policyFingerprint !== hashContract(snapshot.policies)
      )
        throw new ConflictException('CONTRACT_SNAPSHOT_STALE');
      versions.push({
        contractId: contract._id,
        contractVersionId: version._id,
        providerId,
        contentHash: version.contentHash,
        bookingFingerprint: fingerprint,
      });
      fingerprints.push(`${providerId.toString()}:${fingerprint}`);
    }
    const binding: ContractPaymentBinding = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId: booking._id,
      amount,
      currency: 'VND',
      purpose,
      bookingFingerprint: hashContract(fingerprints),
      boundAt: new Date(),
      versions,
    };
    return { binding, context };
  }

  async assertCurrent(
    decision: CheckoutDecision,
    session: ClientSession,
  ): Promise<void> {
    if (!decision.binding || !decision.context) return;
    const { context, binding } = decision;
    for (const row of binding.versions) {
      await this.preparation.assertSourcesUnchanged(
        context,
        row.providerId,
        session,
      );
      await this.preparation.assertLiveHold(context, row.providerId, session);
      const acceptance = await this.policy.requireAutoAcceptance(
        row.providerId,
        this.templates.getApproved().version,
        session,
      );
      const contract = await this.contracts
        .findById(row.contractId)
        .session(session)
        .lean();
      const version = await this.versions
        .findById(row.contractVersionId)
        .session(session)
        .lean();
      const consent = await this.consents
        .findOne({
          contractVersionId: row.contractVersionId,
          actorUserId: context.booking.customerId,
          action: ContractConsentAction.Accept,
        })
        .session(session)
        .lean();
      if (
        !contract?.currentVersionId?.equals(row.contractVersionId) ||
        version?.state !== ContractVersionState.Accepted ||
        version.contentHash !== row.contentHash ||
        version.bookingFingerprint !== row.bookingFingerprint ||
        !version.providerAcceptanceId?.equals(acceptance._id) ||
        !consent ||
        consent.contentHash !== row.contentHash ||
        consent.bookingFingerprint !== row.bookingFingerprint
      )
        throw new ConflictException('CONTRACT_BINDING_STALE');
    }
  }
}
