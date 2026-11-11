import { Connection, Model, Types } from 'mongoose';
import { ContractPolicyService } from './contract-policy.service';
import { ContractSnapshotService } from './contract-snapshot.service';
import { ContractPreparationService } from './contract-preparation.service';
import { ContractTemplateService, ContractTemplate } from './contract-template';
import { BookingSource, RentalItemSource } from './contract-source.types';
import { canonicalizeContract, hashContract } from './canonical-contract';
import { ProviderContractAcceptance } from './schemas/provider-contract-acceptance.schema';
import { PolicyResolverService } from '../system-policies/services/policy-resolver.service';
import { DigitalContract } from '../bookings/schemas/digital-contract.schema';
import { ContractVersion } from './schemas/contract-version.schema';

const bookingId = new Types.ObjectId();
const rentalProviderId = new Types.ObjectId();
const photoProviderId = new Types.ObjectId();
const customerId = new Types.ObjectId();
const productId = new Types.ObjectId();
const itemId = new Types.ObjectId();
const now = new Date('2026-10-27T10:00:00.000Z');

function booking(overrides: Partial<BookingSource> = {}): BookingSource {
  return {
    _id: bookingId,
    bookingCode: 'B-001',
    bookingType: 'COMBO',
    status: 'PENDING_PAYMENT',
    contractFlowVersion: 2,
    customerId,
    providerIds: [rentalProviderId, photoProviderId],
    pricingSummary: {
      discountAmount: 0,
      comboDiscountTotal: 0,
      voucherDiscountTotal: 0,
      travelFee: 0,
      overtimeFee: 0,
      lateFee: 0,
      damageFee: 0,
      serviceFee: 0,
    },
    updatedAt: now,
    ...overrides,
  };
}

function item(overrides: Partial<RentalItemSource> = {}): RentalItemSource {
  return {
    _id: itemId,
    bookingId,
    providerId: rentalProviderId,
    itemType: 'PRODUCT',
    productId,
    priceVersionId: new Types.ObjectId(),
    unitPrice: 100000,
    depositAmount: 50000,
    quantity: 1,
    selectedSize: 'M',
    rentalFrom: new Date('2026-11-01'),
    rentalTo: new Date('2026-11-03'),
    pickupReturnLocationSnapshot: { address: 'Store' },
    updatedAt: now,
    ...overrides,
  };
}

const approvedTemplate: ContractTemplate = {
  version: 'test-approved-v1',
  status: 'APPROVED',
  approvedAt: now.toISOString(),
  title: 'Test contract',
  sections: [],
};

describe('Phase 3 contract policy, snapshot and canonicalization', () => {
  it('selects only rental-item providers from a combo, not every Booking.providerId', async () => {
    const findItems = jest
      .fn()
      .mockReturnValue({ toArray: jest.fn().mockResolvedValue([item()]) });
    const database = {
      collection: jest.fn((name: string) =>
        name === 'bookings'
          ? { findOne: jest.fn().mockResolvedValue(booking()) }
          : { find: findItems },
      ),
    };
    const service = new ContractPolicyService(
      { db: database } as unknown as Connection,
      {} as Model<ProviderContractAcceptance>,
    );
    const context = await service.getContext(bookingId.toString());
    expect(context.rentalProviderIds.map(String)).toEqual([
      rentalProviderId.toString(),
    ]);
    expect(context.rentalItems).toHaveLength(1);
    expect(findItems).toHaveBeenCalledWith({
      bookingId,
      itemType: 'PRODUCT',
    });
  });

  it('never treats a photography-only booking as a rental contract', async () => {
    const database = {
      collection: jest.fn().mockReturnValue({
        findOne: jest
          .fn()
          .mockResolvedValue(booking({ bookingType: 'PHOTOGRAPHY' })),
      }),
    };
    const service = new ContractPolicyService(
      { db: database } as unknown as Connection,
      {} as Model<ProviderContractAcceptance>,
    );
    expect(
      (await service.getContext(bookingId.toString())).rentalProviderIds,
    ).toHaveLength(0);
  });

  it('requires a separate rental contract for each provider with a product item', async () => {
    const secondRentalItem = item({
      _id: new Types.ObjectId(),
      providerId: photoProviderId,
    });
    const database = {
      collection: jest.fn((name: string) =>
        name === 'bookings'
          ? { findOne: jest.fn().mockResolvedValue(booking()) }
          : {
              find: jest.fn().mockReturnValue({
                toArray: jest
                  .fn()
                  .mockResolvedValue([item(), secondRentalItem]),
              }),
            },
      ),
    };
    const service = new ContractPolicyService(
      { db: database } as unknown as Connection,
      {} as Model<ProviderContractAcceptance>,
    );
    const context = await service.getContext(bookingId.toString());
    expect(context.rentalProviderIds.map(String).sort()).toEqual(
      [rentalProviderId.toString(), photoProviderId.toString()].sort(),
    );
  });

  it('accepts provider preapproval only when it belongs to the active rental provider', async () => {
    const ownerId = new Types.ObjectId();
    const acceptance = {
      _id: new Types.ObjectId(),
      acceptedByUserId: ownerId,
      mechanismHash: 'a'.repeat(64),
      policyFingerprint: 'b'.repeat(64),
    };
    const findOneAcceptance = jest
      .fn()
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(acceptance) });
    const findOneProvider = jest.fn().mockResolvedValue({
      userId: new Types.ObjectId(),
      status: 'ACTIVE',
      capabilities: ['AODAI_RENTAL'],
    });
    const service = new ContractPolicyService(
      {
        db: {
          collection: jest.fn().mockReturnValue({ findOne: findOneProvider }),
        },
      } as unknown as Connection,
      {
        findOne: findOneAcceptance,
      } as unknown as Model<ProviderContractAcceptance>,
    );
    await expect(
      service.requireAutoAcceptance(rentalProviderId, approvedTemplate.version),
    ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_INVALID');
    findOneProvider.mockResolvedValue({
      userId: ownerId,
      status: 'ACTIVE',
      capabilities: ['AODAI_RENTAL'],
    });
    await expect(
      service.requireAutoAcceptance(rentalProviderId, approvedTemplate.version),
    ).resolves.toMatchObject({ acceptedByUserId: ownerId });
    expect(findOneAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: rentalProviderId,
        templateVersion: approvedTemplate.version,
        status: 'ACTIVE',
      }),
    );
  });

  it('blocks ambiguous booking-level allocation in a combo', async () => {
    const context = {
      booking: booking({
        pricingSummary: {
          ...booking().pricingSummary,
          voucherDiscountTotal: 10000,
        },
      }),
      rentalItems: [item()],
      rentalProviderIds: [rentalProviderId],
    };
    const service = new ContractSnapshotService(
      { db: {} } as Connection,
      {} as PolicyResolverService,
    );
    await expect(
      service.build(context, rentalProviderId, approvedTemplate),
    ).rejects.toThrow('CONTRACT_PRICING_ALLOCATION_UNDEFINED');
  });

  it('captures backend item, parties and policy versions without assigning global combo totals', async () => {
    const collections: Record<string, unknown> = {
      users: {
        _id: customerId,
        profile: { fullName: 'Customer' },
        auth: { email: 'c@example.test' },
      },
      providers: {
        _id: rentalProviderId,
        businessName: 'Store',
        contact: { phone: '123' },
        address: { addressLine: 'Store' },
        policies: {
          rentalPolicy: 'Provider rental terms',
          cancellationPolicy: 'Provider cancellation terms',
        },
      },
      products: {
        _id: productId,
        providerId: rentalProviderId,
        name: 'Ao dai',
        slug: 'ao-dai',
      },
    };
    const database = {
      collection: jest.fn((name: string) => ({
        findOne: jest.fn().mockResolvedValue(collections[name]),
      })),
    };
    const policyResolver = {
      clearCache: jest.fn(),
      getActivePolicyByCode: jest.fn((code: string) =>
        Promise.resolve({ code, version: 3, value: { rule: 'approved' } }),
      ),
    };
    const service = new ContractSnapshotService(
      { db: database } as unknown as Connection,
      policyResolver as unknown as PolicyResolverService,
    );
    const snapshot = await service.build(
      {
        booking: booking(),
        rentalItems: [item()],
        rentalProviderIds: [rentalProviderId],
      },
      rentalProviderId,
      approvedTemplate,
    );
    expect(snapshot.providerItems[0]).toMatchObject({
      productName: 'Ao dai',
      size: 'M',
      depositAmount: 50000,
    });
    expect(snapshot.pricing).toMatchObject({
      allocation: 'PROVIDER_ITEMS_ONLY',
      bookingSummary: null,
    });
    expect(
      (snapshot.policies.cancellation as { version: number }).version,
    ).toBe(3);
  });

  it('hashes canonical content independently of object key order and changes on meaningful edits', () => {
    expect(canonicalizeContract({ b: 2, a: { z: 1, c: 3 } })).toBe(
      canonicalizeContract({ a: { c: 3, z: 1 }, b: 2 }),
    );
    expect(hashContract({ booking: { size: 'M' } })).not.toBe(
      hashContract({ booking: { size: 'L' } }),
    );
    expect(() => canonicalizeContract({ amount: Number.NaN })).toThrow();
  });

  it('keeps the v1 template draft and rejects issuance', () => {
    const templates = new ContractTemplateService();
    expect(templates.getDraft()).toMatchObject({
      status: 'DRAFT',
      approvedAt: null,
    });
    expect(() => templates.getApproved()).toThrow(
      'CONTRACT_TEMPLATE_NOT_APPROVED',
    );
  });

  it('stops preparation before writes when flag is off or old unique index remains', async () => {
    const startSession = jest.fn();
    const database = {
      collection: jest.fn((name: string) => ({
        countDocuments: jest.fn().mockResolvedValue(1),
        findOne: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(name === 'bookings' ? context.booking : item()),
          ),
        indexes: jest
          .fn()
          .mockResolvedValue(
            name === 'digital_contracts'
              ? [{ key: { bookingId: 1 }, unique: true }]
              : [{ key: { contractId: 1, version: 1 }, unique: true }],
          ),
      })),
    };
    const connection = { db: database, startSession } as unknown as Connection;
    const context = {
      booking: booking({ bookingType: 'AODAI_RENTAL' }),
      rentalItems: [item()],
      rentalProviderIds: [rentalProviderId],
    };
    const snapshot = {
      booking: {},
      providerItems: [],
      pricing: {},
      policies: {},
      template: {},
    };
    const policy = {
      getContext: jest.fn().mockResolvedValue(context),
      requireAutoAcceptance: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        policyFingerprint: hashContract(snapshot.policies),
      }),
    };
    const snapshots = { build: jest.fn().mockResolvedValue(snapshot) };
    const templates = {
      getApproved: jest.fn().mockReturnValue(approvedTemplate),
    };
    const construct = (enabled: boolean) =>
      new ContractPreparationService(
        enabled,
        connection,
        {} as Model<DigitalContract>,
        {} as Model<ContractVersion>,
        policy as unknown as ContractPolicyService,
        snapshots as unknown as ContractSnapshotService,
        templates as unknown as ContractTemplateService,
      );
    await expect(
      construct(false).prepare(
        bookingId.toString(),
        rentalProviderId.toString(),
      ),
    ).rejects.toThrow('CONTRACTS_V2_DISABLED');
    await expect(
      construct(true).prepare(
        bookingId.toString(),
        rentalProviderId.toString(),
      ),
    ).rejects.toThrow('CONTRACT_INDEX_MIGRATION_REQUIRED');
    expect(startSession).not.toHaveBeenCalled();
  });

  it('prepares one immutable version per booking state and reuses the same version on retry', async () => {
    const currentBooking = booking({ bookingType: 'AODAI_RENTAL' });
    const currentItem = item();
    const store: { contract: FakeContract | null } = { contract: null };
    const savedVersions: FakeVersion[] = [];
    class FakeContract {
      _id = new Types.ObjectId();
      id = this._id.toString();
      flowVersion = 2;
      currentVersionId: Types.ObjectId | null = null;
      currentRevision = 0;
      constructor(fields: Partial<FakeContract>) {
        Object.assign(this, fields);
      }
      save() {
        store.contract = this;
        return Promise.resolve();
      }
      static findOne() {
        return { session: () => Promise.resolve(store.contract) };
      }
    }
    class FakeVersion {
      _id = new Types.ObjectId();
      id = this._id.toString();
      contentHash = '';
      bookingFingerprint = '';
      version = 0;
      snapshot: Record<string, unknown> = {};
      constructor(fields: Partial<FakeVersion>) {
        Object.assign(this, fields);
      }
      save() {
        savedVersions.push(this);
        return Promise.resolve();
      }
      static findById(id: Types.ObjectId) {
        return {
          session: () =>
            Promise.resolve(
              savedVersions.find((row) => row._id.equals(id)) ?? null,
            ),
        };
      }
      static updateOne() {
        return Promise.resolve({ modifiedCount: 1 });
      }
    }
    const db = {
      collection: jest.fn((name: string) => ({
        indexes: jest.fn().mockResolvedValue(
          name === 'digital_contracts'
            ? [
                {
                  key: { bookingId: 1, providerId: 1, scope: 1 },
                  unique: true,
                },
              ]
            : name === 'contract_versions'
              ? [{ key: { contractId: 1, version: 1 }, unique: true }]
              : [
                  {
                    key: { providerId: 1, scope: 1 },
                    unique: true,
                    partialFilterExpression: { status: 'ACTIVE' },
                  },
                ],
        ),
        countDocuments: jest.fn().mockResolvedValue(1),
        findOne: jest
          .fn()
          .mockResolvedValue(
            name === 'bookings' ? currentBooking : currentItem,
          ),
      })),
    };
    const session = {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: jest.fn(),
    };
    const connection = {
      db,
      startSession: jest.fn().mockResolvedValue(session),
    } as unknown as Connection;
    const context = {
      booking: currentBooking,
      rentalItems: [currentItem],
      rentalProviderIds: [rentalProviderId],
    };
    const policy = {
      getContext: jest.fn().mockResolvedValue(context),
      requireAutoAcceptance: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        policyFingerprint: hashContract({}),
      }),
    };
    let snapshot = {
      booking: { code: 'B-001' },
      providerItems: [{ size: 'M' }],
      pricing: {},
      policies: {},
      template: {},
    };
    const snapshots = { build: jest.fn(() => Promise.resolve(snapshot)) };
    const templates = {
      getApproved: jest.fn().mockReturnValue(approvedTemplate),
    };
    const service = new ContractPreparationService(
      true,
      connection,
      FakeContract as unknown as Model<DigitalContract>,
      FakeVersion as unknown as Model<ContractVersion>,
      policy as unknown as ContractPolicyService,
      snapshots as unknown as ContractSnapshotService,
      templates as unknown as ContractTemplateService,
    );
    const first = await service.prepare(
      bookingId.toString(),
      rentalProviderId.toString(),
    );
    const retry = await service.prepare(
      bookingId.toString(),
      rentalProviderId.toString(),
    );
    expect(first).toMatchObject({ version: 1, reused: false });
    expect(retry).toMatchObject({
      versionId: first.versionId,
      version: 1,
      reused: true,
    });
    expect(savedVersions).toHaveLength(1);
    snapshot = { ...snapshot, providerItems: [{ size: 'L' }] };
    const updated = await service.prepare(
      bookingId.toString(),
      rentalProviderId.toString(),
    );
    expect(updated).toMatchObject({
      contractId: first.contractId,
      version: 2,
      reused: false,
    });
    expect(savedVersions).toHaveLength(2);
    expect(savedVersions[0].snapshot.providerItems).toEqual([{ size: 'M' }]);
    expect(store.contract?.currentRevision).toBe(2);
  });
});
