import {
  Injectable,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { ContractScope } from '../bookings/schemas/digital-contract.schema';
import {
  ProviderAcceptanceStatus,
  ProviderContractAcceptance,
} from './schemas/provider-contract-acceptance.schema';
import {
  BookingSource,
  RentalItemSource,
  contractDb,
  contractObjectId,
  sameContractId,
} from './contract-source.types';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractMechanismService } from './contract-mechanism.service';
import { ContractTemplateService } from './contract-template';
import { hashContract } from './canonical-contract';

export type ShopContractParticipationStatus =
  | 'LEGACY'
  | 'CONTRACT_ACTIVE'
  | 'CONTRACT_SUSPENDED';

export interface ShopParticipationResult {
  status: ShopContractParticipationStatus;
  reason?: string;
  acceptance?: any;
}

export interface RentalContractContext {
  booking: BookingSource;
  rentalItems: RentalItemSource[];
  rentalProviderIds: Types.ObjectId[];
}

@Injectable()
export class ContractPolicyService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProviderContractAcceptance.name)
    private readonly acceptanceModel: Model<ProviderContractAcceptance>,
    @Optional() private readonly snapshots?: ContractSnapshotService,
    @Optional() private readonly mechanism?: ContractMechanismService,
    @Optional() private readonly templates?: ContractTemplateService,
  ) {}

  async getContext(bookingId: string): Promise<RentalContractContext> {
    const db = contractDb(this.connection);
    const booking = (await db.collection('bookings').findOne({
      _id: contractObjectId(bookingId),
    })) as BookingSource | null;
    if (!booking) throw new UnprocessableEntityException('BOOKING_NOT_FOUND');
    if (booking.bookingType === 'PHOTOGRAPHY')
      return { booking, rentalItems: [], rentalProviderIds: [] };
    if (!['AODAI_RENTAL', 'COMBO'].includes(booking.bookingType))
      throw new UnprocessableEntityException('BOOKING_TYPE_UNSUPPORTED');
    if (!Array.isArray(booking.providerIds))
      throw new UnprocessableEntityException('BOOKING_PROVIDERS_MISSING');

    const rentalItems = (await db
      .collection('booking_items')
      .find({
        bookingId: booking._id,
        itemType: 'PRODUCT',
      })
      .toArray()) as unknown as RentalItemSource[];
    if (!rentalItems.length)
      throw new UnprocessableEntityException('RENTAL_ITEMS_MISSING');
    const providers = new Map<string, Types.ObjectId>();
    for (const item of rentalItems) {
      if (
        !item.productId ||
        !booking.providerIds.some((id) => sameContractId(id, item.providerId))
      )
        throw new UnprocessableEntityException('RENTAL_ITEM_PROVIDER_INVALID');
      providers.set(item.providerId.toString(), item.providerId);
    }
    return {
      booking,
      rentalItems,
      rentalProviderIds: [...providers.values()].sort((a, b) =>
        a.toString().localeCompare(b.toString()),
      ),
    };
  }

  async requireAutoAcceptance(
    providerId: Types.ObjectId,
    templateVersion: string,
    session?: ClientSession,
  ) {
    const query = this.acceptanceModel.findOne({
      providerId,
      scope: ContractScope.AoDaiRental,
      status: ProviderAcceptanceStatus.Active,
      templateVersion,
      acceptedAt: { $lte: new Date() },
    });
    if (session) query.session(session);
    const acceptance = await query.lean();
    if (
      !acceptance ||
      !acceptance.mechanismHash ||
      !acceptance.policyFingerprint
    )
      throw new UnprocessableEntityException(
        'PROVIDER_AUTO_ACCEPTANCE_MISSING',
      );
    const provider = await contractDb(this.connection)
      .collection('providers')
      .findOne(
        { _id: providerId },
        { projection: { userId: 1, status: 1, capabilities: 1 }, session },
      );
    const status = String(provider?.status || '').toUpperCase();
    const caps = Array.isArray(provider?.capabilities)
      ? provider.capabilities.map((c: string) => String(c).toUpperCase())
      : [];
    const isRental = caps.includes('AODAI_RENTAL') || caps.includes('RENTAL');

    if (
      !provider ||
      status !== 'ACTIVE' ||
      !isRental ||
      String(provider.userId) !== String(acceptance.acceptedByUserId)
    )
      throw new UnprocessableEntityException(
        'PROVIDER_AUTO_ACCEPTANCE_INVALID',
      );
    return acceptance;
  }

  async getProviderContractParticipationStatus(
    providerId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ShopParticipationResult> {
    const query = this.acceptanceModel.find({
      providerId,
      scope: ContractScope.AoDaiRental,
    });
    if (session) query.session(session);
    const records = await query.lean();

    // 1. If provider never had any acceptance record for AoDaiRental -> LEGACY
    if (!records || records.length === 0) {
      return { status: 'LEGACY' };
    }

    // 2. Provider has participated. Look for an ACTIVE acceptance.
    const active = records.find(
      (r) =>
        r.status === ProviderAcceptanceStatus.Active &&
        (!r.revokedAt || new Date(r.revokedAt) > new Date()) &&
        new Date(r.acceptedAt) <= new Date(),
    );

    if (!active) {
      return { status: 'CONTRACT_SUSPENDED', reason: 'REVOKED' };
    }

    // 3. Provider must be ACTIVE and have rental capabilities
    const provider = await contractDb(this.connection)
      .collection('providers')
      .findOne(
        { _id: providerId },
        { projection: { userId: 1, status: 1, capabilities: 1 }, session },
      );
    const providerStatus = String(provider?.status || '').toUpperCase();
    const caps = Array.isArray(provider?.capabilities)
      ? provider.capabilities.map((c: string) => String(c).toUpperCase())
      : [];
    const isRental = caps.includes('AODAI_RENTAL') || caps.includes('RENTAL');

    if (!provider || providerStatus !== 'ACTIVE' || !isRental) {
      return {
        status: 'CONTRACT_SUSPENDED',
        reason: 'PROVIDER_INACTIVE_OR_NOT_RENTAL',
        acceptance: active,
      };
    }

    if (String(provider.userId) !== String(active.acceptedByUserId)) {
      return {
        status: 'CONTRACT_SUSPENDED',
        reason: 'ACCEPTOR_MISMATCH',
        acceptance: active,
      };
    }

    // 4. Verify template version
    if (this.templates && typeof this.templates.getApproved === 'function') {
      try {
        const approvedTemplate = this.templates.getApproved();
        if (
          approvedTemplate &&
          active.templateVersion !== approvedTemplate.version
        ) {
          return {
            status: 'CONTRACT_SUSPENDED',
            reason: 'TEMPLATE_STALE',
            acceptance: active,
          };
        }
      } catch {
        return {
          status: 'CONTRACT_SUSPENDED',
          reason: 'TEMPLATE_NOT_APPROVED',
          acceptance: active,
        };
      }
    }

    // 5. Verify mechanism hash
    if (this.mechanism && typeof this.mechanism.getApproved === 'function') {
      try {
        const approvedMech = this.mechanism.getApproved();
        if (
          approvedMech &&
          (active.mechanismHash !== approvedMech.hash ||
            active.mechanismVersion !== approvedMech.version)
        ) {
          return {
            status: 'CONTRACT_SUSPENDED',
            reason: 'MECHANISM_CHANGED',
            acceptance: active,
          };
        }
      } catch {
        return {
          status: 'CONTRACT_SUSPENDED',
          reason: 'MECHANISM_NOT_APPROVED',
          acceptance: active,
        };
      }
    }

    // 6. Verify policy fingerprint
    if (
      this.snapshots &&
      typeof this.snapshots.currentPoliciesForProvider === 'function'
    ) {
      try {
        const policies =
          await this.snapshots.currentPoliciesForProvider(providerId);
        if (!policies || policies.isLegacyFallback) {
          return {
            status: 'CONTRACT_SUSPENDED',
            reason: 'POLICY_NOT_APPROVED',
            acceptance: active,
          };
        }
        const fingerprint = hashContract(policies);
        if (active.policyFingerprint !== fingerprint) {
          return {
            status: 'CONTRACT_SUSPENDED',
            reason: 'POLICY_STALE',
            acceptance: active,
          };
        }
      } catch {
        return {
          status: 'CONTRACT_SUSPENDED',
          reason: 'POLICY_ERROR',
          acceptance: active,
        };
      }
    }

    return { status: 'CONTRACT_ACTIVE', acceptance: active };
  }
}
