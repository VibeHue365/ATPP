import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ContractScope } from '../bookings/schemas/digital-contract.schema';
import { ContractAccessService } from './contract-access.service';
import { ContractMechanismService } from './contract-mechanism.service';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractTemplateService } from './contract-template';
import { CONTRACTS_V2_ENABLED } from './contracts.constants';
import { hashContract } from './canonical-contract';
import { contractDb, contractObjectId } from './contract-source.types';
import {
  ProviderAcceptanceStatus,
  ProviderContractAcceptance,
} from './schemas/provider-contract-acceptance.schema';

@Injectable()
export class ProviderContractApprovalService {
  constructor(
    @Inject(CONTRACTS_V2_ENABLED) private readonly enabled: boolean,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProviderContractAcceptance.name)
    private readonly acceptances: Model<ProviderContractAcceptance>,
    private readonly access: ContractAccessService,
    private readonly mechanism: ContractMechanismService,
    private readonly templates: ContractTemplateService,
    private readonly snapshots: ContractSnapshotService,
  ) {}

  mechanismForProvider(user: AuthUser) {
    return this.access.ownProvider(user).then(() => this.mechanism.getDraft());
  }

  async status(user: AuthUser) {
    const provider = await this.access.ownProvider(user);
    const active = await this.acceptances
      .findOne({
        providerId: provider._id,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
      })
      .lean();

    let latestRevoked = null;
    if (!active) {
      latestRevoked = await this.acceptances
        .findOne({
          providerId: provider._id,
          scope: ContractScope.AoDaiRental,
          status: ProviderAcceptanceStatus.Revoked,
        })
        .sort({ updatedAt: -1 })
        .lean();
    }

    let isStale = false;
    let staleReason: string | null = null;
    if (active) {
      try {
        const currentPolicies = await this.snapshots.currentPoliciesForProvider(provider._id);
        const currentPolicyFingerprint = hashContract(currentPolicies);
        if (active.policyFingerprint !== currentPolicyFingerprint) {
          isStale = true;
          staleReason = 'POLICY_CHANGED';
        }
      } catch {}
    }

    const calculatedStatus: 'ACTIVE' | 'REVOKED' | 'STALE' | 'NOT_ACCEPTED' = active
      ? isStale
        ? 'STALE'
        : 'ACTIVE'
      : latestRevoked
      ? 'REVOKED'
      : 'NOT_ACCEPTED';

    return {
      providerId: provider._id.toString(),
      scope: ContractScope.AoDaiRental,
      status: calculatedStatus,
      isStale,
      staleReason,
      active: active
        ? {
            id: active._id.toString(),
            mechanismVersion: active.mechanismVersion,
            templateVersion: active.templateVersion,
            acceptedAt: active.acceptedAt,
            policyFingerprint: active.policyFingerprint,
          }
        : null,
      revoked: latestRevoked
        ? {
            id: latestRevoked._id.toString(),
            revokedAt: latestRevoked.revokedAt,
          }
        : null,
    };
  }

  async accept(user: AuthUser, expectedMechanismHash: string) {
    if (!this.enabled)
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const provider = await this.requireActiveRentalProvider(user);
    const mechanism = this.mechanism.getApproved();
    const template = this.templates.getApproved();
    if (expectedMechanismHash !== mechanism.hash)
      throw new ConflictException('CONTRACT_MECHANISM_CHANGED');
    const policyFingerprint = hashContract(
      await this.snapshots.currentPoliciesForProvider(provider._id),
    );
    await this.requireAcceptanceIndex();
    const filter = {
      providerId: provider._id,
      scope: ContractScope.AoDaiRental,
      status: ProviderAcceptanceStatus.Active,
    };
    const existing = await this.acceptances.findOne(filter).lean();
    if (existing) {
      if (
        existing.mechanismHash === mechanism.hash &&
        existing.policyFingerprint === policyFingerprint &&
        existing.templateVersion === template.version
      ) {
        return { acceptanceId: existing._id.toString(), reused: true };
      }
      // When policy, mechanism or template changes, archive stale active acceptance to allow re-acceptance
      await this.acceptances.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: ProviderAcceptanceStatus.Revoked,
            revokedAt: new Date(),
          },
        },
      );
    }
    try {
      const created = await this.acceptances.create({
        providerId: provider._id,
        acceptedByUserId: contractObjectId(user.sub),
        scope: ContractScope.AoDaiRental,
        mechanismVersion: mechanism.version,
        templateVersion: template.version,
        mechanismHash: mechanism.hash,
        policyFingerprint,
        acceptedAt: new Date(),
        status: ProviderAcceptanceStatus.Active,
      });
      return { acceptanceId: created.id, reused: false };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const winner = await this.acceptances.findOne(filter).lean();
      if (
        winner &&
        winner.mechanismHash === mechanism.hash &&
        winner.policyFingerprint === policyFingerprint &&
        winner.templateVersion === template.version
      )
        return { acceptanceId: winner._id.toString(), reused: true };
      throw new ConflictException('PROVIDER_ACCEPTANCE_ALREADY_ACTIVE');
    }
  }

  async revoke(user: AuthUser) {
    if (!this.enabled)
      throw new ServiceUnavailableException('CONTRACTS_V2_DISABLED');
    const provider = await this.requireActiveRentalProvider(user);
    const current = await this.acceptances.findOne({
      providerId: provider._id,
      scope: ContractScope.AoDaiRental,
      status: ProviderAcceptanceStatus.Active,
    });
    if (!current) return { revoked: false, alreadyRevoked: true };
    const result = await this.acceptances.updateOne(
      { _id: current._id, status: ProviderAcceptanceStatus.Active },
      {
        $set: {
          status: ProviderAcceptanceStatus.Revoked,
          revokedAt: new Date(),
        },
      },
    );
    return {
      revoked: result.modifiedCount === 1,
      alreadyRevoked: result.modifiedCount === 0,
    };
  }

  private async requireActiveRentalProvider(user: AuthUser) {
    const provider = await this.access.ownProvider(user);
    const status = String(provider.status || '').toUpperCase();
    const caps = Array.isArray(provider.capabilities)
      ? provider.capabilities.map((c: string) => String(c).toUpperCase())
      : [];
    const isRental = caps.includes('AODAI_RENTAL') || caps.includes('RENTAL');

    if (status !== 'ACTIVE' || !isRental)
      throw new UnprocessableEntityException('PROVIDER_RENTAL_NOT_ACTIVE');
    return provider;
  }

  private async requireAcceptanceIndex() {
    const col = contractDb(this.connection).collection('provider_contract_acceptances');
    let indexes = await col.indexes();
    let ready = indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.key) ===
          JSON.stringify({ providerId: 1, scope: 1 }) &&
        JSON.stringify(index.partialFilterExpression) ===
          JSON.stringify({ status: 'ACTIVE' }),
    );
    if (!ready && typeof col.createIndex === 'function') {
      try {
        await col.createIndex(
          { providerId: 1, scope: 1 },
          {
            unique: true,
            partialFilterExpression: { status: 'ACTIVE' },
          },
        );
        ready = true;
      } catch {}
    }
    if (!ready) {
      indexes = await col.indexes();
      ready = indexes.some(
        (index) =>
          index.unique &&
          JSON.stringify(index.key) ===
            JSON.stringify({ providerId: 1, scope: 1 }) &&
          JSON.stringify(index.partialFilterExpression) ===
            JSON.stringify({ status: 'ACTIVE' }),
      );
    }
    if (!ready)
      throw new ServiceUnavailableException(
        'CONTRACT_INDEX_MIGRATION_REQUIRED',
      );
  }
}
