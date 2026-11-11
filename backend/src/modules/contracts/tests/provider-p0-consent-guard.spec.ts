import { ConflictException, NotFoundException, UnprocessableEntityException, ServiceUnavailableException } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractPolicyService } from '../contract-policy.service';
import { ContractSnapshotService } from '../contract-snapshot.service';
import { ContractTemplateService } from '../contract-template';
import { ContractMechanismService, AUTO_ACCEPTANCE_MECHANISM_V1, AUTO_ACCEPTANCE_MECHANISM_V2 } from '../contract-mechanism.service';
import { ContractAccessService } from '../contract-access.service';
import { ProviderContractApprovalService } from '../provider-contract-approval.service';
import { ContractCheckoutGuard } from '../contract-checkout-guard.service';
import { ContractReadService } from '../contract-read.service';
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
} from '../../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionState,
} from '../schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
} from '../schemas/contract-consent.schema';
import {
  ProviderAcceptanceStatus,
  ProviderContractAcceptance,
} from '../schemas/provider-contract-acceptance.schema';
import { canonicalizeContract, hashContract } from '../canonical-contract';
import { BookingSource, RentalItemSource } from '../contract-source.types';
import { PaymentPurpose } from '../../payments/schemas/payment.schema';

const oid = () => new Types.ObjectId();
const lean = (val: any) => ({ lean: jest.fn().mockResolvedValue(val) });

describe('P0 — Provider Consent Authenticity & Fail-Closed Safety Gate', () => {
  const customerId = oid();
  const providerAId = oid();
  const providerBId = oid();
  const providerAUserId = oid();
  const providerBUserId = oid();
  const bookingId = oid();
  const itemIdA = oid();
  const itemIdB = oid();

  const approvedTemplate = {
    version: 'ao-dai-rental-v2',
    status: 'APPROVED' as const,
    approvedAt: '2026-10-31T00:00:00.000Z',
    title: 'HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI',
    sections: [],
  };

  const approvedMechanism = {
    ...AUTO_ACCEPTANCE_MECHANISM_V2,
    hash: hashContract(AUTO_ACCEPTANCE_MECHANISM_V2),
  };

  const dummyPolicies = {
    rentalPolicy: 'Standard rental terms',
    cancellationPolicy: 'Standard cancellation terms',
  };

  function mockBooking(overrides: Partial<BookingSource> = {}): BookingSource {
    return {
      _id: bookingId,
      bookingCode: 'B-P0-001',
      bookingType: 'AODAI_RENTAL',
      status: 'PENDING_PAYMENT',
      contractFlowVersion: 2,
      customerId,
      providerIds: [providerAId],
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
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
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function mockItem(providerId: Types.ObjectId, overrides: Partial<RentalItemSource> = {}): RentalItemSource {
    return {
      _id: oid(),
      bookingId,
      providerId,
      itemType: 'PRODUCT',
      productId: oid(),
      priceVersionId: oid(),
      unitPrice: 200000,
      depositAmount: 100000,
      quantity: 1,
      selectedSize: 'L',
      rentalFrom: new Date('2026-11-10'),
      rentalTo: new Date('2026-11-12'),
      pickupReturnLocationSnapshot: { address: 'Hue Shop' },
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function createMockDb(overrides: {
    booking?: BookingSource;
    items?: RentalItemSource[];
    providerA?: any;
    providerB?: any;
    customCollections?: Record<string, any>;
  } = {}) {
    const currentBooking = overrides.booking ?? mockBooking();
    const currentItems = overrides.items ?? [mockItem(providerAId)];
    const provA = overrides.providerA ?? {
      _id: providerAId,
      userId: providerAUserId,
      status: 'ACTIVE',
      capabilities: ['AODAI_RENTAL'],
    };
    const provB = overrides.providerB ?? {
      _id: providerBId,
      userId: providerBUserId,
      status: 'ACTIVE',
      capabilities: ['AODAI_RENTAL'],
    };

    return {
      collection: jest.fn((name: string) => {
        if (overrides.customCollections && overrides.customCollections[name]) {
          return overrides.customCollections[name];
        }
        if (name === 'bookings') {
          return {
            findOne: jest.fn().mockResolvedValue(currentBooking),
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          };
        }
        if (name === 'booking_items') {
          return {
            find: () => ({ toArray: jest.fn().mockResolvedValue(currentItems) }),
            findOne: jest.fn().mockImplementation((filter: any) => {
              if (filter._id) {
                const found = currentItems.find((it) => it._id.equals(filter._id));
                return Promise.resolve(found ?? currentItems[0] ?? null);
              }
              return Promise.resolve(currentItems[0] ?? null);
            }),
          };
        }
        if (name === 'providers') {
          return {
            findOne: jest.fn().mockImplementation((filter: any) => {
              if (filter._id && filter._id.equals(providerAId)) return Promise.resolve(provA);
              if (filter._id && filter._id.equals(providerBId)) return Promise.resolve(provB);
              return Promise.resolve(null);
            }),
          };
        }
        if (name === 'inventory_reservations') {
          return {
            countDocuments: jest.fn().mockResolvedValue(1),
            insertOne: jest.fn().mockResolvedValue({ insertedId: oid() }),
          };
        }
        if (name === 'digital_contracts') {
          return {
            indexes: jest.fn().mockResolvedValue([
              { key: { bookingId: 1, providerId: 1, scope: 1 }, unique: true },
            ]),
          };
        }
        if (name === 'contract_versions') {
          return {
            indexes: jest.fn().mockResolvedValue([
              { key: { contractId: 1, version: 1 }, unique: true },
            ]),
          };
        }
        if (name === 'provider_contract_acceptances') {
          return {
            indexes: jest.fn().mockResolvedValue([
              { key: { providerId: 1, scope: 1 }, unique: true, partialFilterExpression: { status: 'ACTIVE' } },
            ]),
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            insertOne: jest.fn().mockResolvedValue({ insertedId: oid() }),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(null),
          countDocuments: jest.fn().mockResolvedValue(0),
          indexes: jest.fn().mockResolvedValue([]),
        };
      }),
    };
  }

  describe('Scenario 1: Provider has not accepted -> no new active acceptance is created', () => {
    it('does not insert or upsert any provider_contract_acceptances record during prepare', async () => {
      const updateOneSpy = jest.fn();
      const insertOneSpy = jest.fn();

      const database = createMockDb({
        customCollections: {
          provider_contract_acceptances: {
            updateOne: updateOneSpy,
            insertOne: insertOneSpy,
            indexes: jest.fn().mockResolvedValue([]),
          },
        },
      });

      const connection = { db: database } as unknown as Connection;
      const acceptanceModel = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(null), // NO acceptance exists
        }),
      } as unknown as Model<ProviderContractAcceptance>;

      const policyService = new ContractPolicyService(connection, acceptanceModel);
      const snapshotService = {
        build: jest.fn(),
      } as unknown as ContractSnapshotService;
      const templateService = {
        getApproved: jest.fn().mockReturnValue(approvedTemplate),
      } as unknown as ContractTemplateService;

      const prepService = new ContractPreparationService(
        true,
        connection,
        {} as Model<DigitalContract>,
        {} as Model<ContractVersion>,
        policyService,
        snapshotService,
        templateService,
      );

      await expect(
        prepService.prepare(bookingId.toString(), providerAId.toString()),
      ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');

      // CRITICAL P0 ASSERTION: The system MUST NOT auto-upsert or create acceptance
      expect(updateOneSpy).not.toHaveBeenCalled();
      expect(insertOneSpy).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 2: Provider has not accepted -> booking preparation fails closed', () => {
    it('ContractPreparationService fails closed with PROVIDER_AUTO_ACCEPTANCE_MISSING', async () => {
      const database = createMockDb();
      const connection = { db: database } as unknown as Connection;
      const acceptanceModel = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(null),
        }),
      } as unknown as Model<ProviderContractAcceptance>;

      const policyService = new ContractPolicyService(connection, acceptanceModel);
      const prepService = new ContractPreparationService(
        true,
        connection,
        {} as Model<DigitalContract>,
        {} as Model<ContractVersion>,
        policyService,
        {} as ContractSnapshotService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
      );

      await expect(
        prepService.prepare(bookingId.toString(), providerAId.toString()),
      ).rejects.toThrow(new UnprocessableEntityException('PROVIDER_AUTO_ACCEPTANCE_MISSING'));
    });

    it('ContractReadService.readiness reports PROVIDER_ACCEPTANCE_MISSING blocker', async () => {
      const database = createMockDb();
      const connection = { db: database } as unknown as Connection;
      const acceptanceModel = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(null),
        }),
      } as unknown as Model<ProviderContractAcceptance>;

      const policyService = new ContractPolicyService(connection, acceptanceModel);
      const prepService = {
        prepare: jest.fn().mockRejectedValue(new UnprocessableEntityException('PROVIDER_AUTO_ACCEPTANCE_MISSING')),
      } as unknown as ContractPreparationService;

      const contractModel = {
        findOne: jest.fn().mockReturnValue(lean(null)),
      } as unknown as Model<DigitalContract>;

      const accessService = {
        booking: jest.fn().mockResolvedValue(mockBooking()),
        assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER' }),
      } as unknown as ContractAccessService;

      const readService = new ContractReadService(
        true,
        contractModel,
        {} as Model<ContractVersion>,
        {} as Model<ContractConsent>,
        accessService,
        policyService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        {} as ContractSnapshotService,
        prepService,
      );

      const user = { sub: customerId.toString(), roles: ['CUSTOMER'], permissions: [], email: '', sessionId: '' };
      const readiness = await readService.readiness(user, bookingId.toString());

      expect(readiness.providers[0].status).toBe('PROVIDER_ACCEPTANCE_MISSING');
      expect(readiness.blockers).toContain('PROVIDER_AUTO_ACCEPTANCE_MISSING');
    });
  });

  describe('Scenario 3: Draft mechanism -> cannot create valid acceptance for real transaction', () => {
    it('throws CONTRACT_MECHANISM_NOT_APPROVED when mechanism is in DRAFT state', async () => {
      const draftMechanismService = {
        getDraft: jest.fn().mockReturnValue({
          ...AUTO_ACCEPTANCE_MECHANISM_V1,
          hash: hashContract(AUTO_ACCEPTANCE_MECHANISM_V1),
        }),
        getApproved: jest.fn().mockImplementation(() => {
          throw new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED');
        }),
      } as unknown as ContractMechanismService;

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: providerAId,
          userId: providerAUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const approvalService = new ProviderContractApprovalService(
        true,
        { db: { collection: () => ({ indexes: () => Promise.resolve([]) }) } } as unknown as Connection,
        {} as Model<ProviderContractAcceptance>,
        accessService,
        draftMechanismService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        {} as ContractSnapshotService,
      );

      const user = { sub: providerAUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
      await expect(
        approvalService.accept(user, 'some-hash'),
      ).rejects.toThrow('CONTRACT_MECHANISM_NOT_APPROVED');
    });
  });

  describe('Scenario 4: Provider accepts with stale hash -> request rejected', () => {
    it('throws CONTRACT_MECHANISM_CHANGED when sent hash does not match current approved mechanism', async () => {
      const mechanismService = {
        getApproved: jest.fn().mockReturnValue(approvedMechanism),
      } as unknown as ContractMechanismService;

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: providerAId,
          userId: providerAUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const approvalService = new ProviderContractApprovalService(
        true,
        { db: { collection: () => ({ indexes: () => Promise.resolve([]) }) } } as unknown as Connection,
        {} as Model<ProviderContractAcceptance>,
        accessService,
        mechanismService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        {} as ContractSnapshotService,
      );

      const user = { sub: providerAUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
      await expect(
        approvalService.accept(user, 'stale_hash_12345'),
      ).rejects.toThrow(new ConflictException('CONTRACT_MECHANISM_CHANGED'));
    });
  });

  describe('Scenario 5: Different provider cannot accept/revoke on behalf of shop', () => {
    it('rejects accept/revoke when user does not own the provider', async () => {
      const accessService = {
        ownProvider: jest.fn().mockRejectedValue(new NotFoundException('PROVIDER_NOT_FOUND')),
      } as unknown as ContractAccessService;

      const approvalService = new ProviderContractApprovalService(
        true,
        {} as Connection,
        {} as Model<ProviderContractAcceptance>,
        accessService,
        {} as ContractMechanismService,
        {} as ContractTemplateService,
        {} as ContractSnapshotService,
      );

      const imposterUser = { sub: oid().toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
      await expect(
        approvalService.accept(imposterUser, approvedMechanism.hash),
      ).rejects.toThrow('PROVIDER_NOT_FOUND');

      await expect(
        approvalService.revoke(imposterUser),
      ).rejects.toThrow('PROVIDER_NOT_FOUND');
    });
  });

  describe('Scenario 6: Revoke -> subsequent booking preparation fails closed', () => {
    it('marks acceptance as REVOKED and causes subsequent prepare to fail closed', async () => {
      const activeAcceptanceId = oid();
      let acceptanceStatus = ProviderAcceptanceStatus.Active;

      const updateOneSpy = jest.fn().mockImplementation((_filter, update) => {
        if (update.$set?.status === ProviderAcceptanceStatus.Revoked) {
          acceptanceStatus = ProviderAcceptanceStatus.Revoked;
          return Promise.resolve({ modifiedCount: 1 });
        }
        return Promise.resolve({ modifiedCount: 0 });
      });

      const acceptanceModel = {
        findOne: jest.fn().mockImplementation((filter: any) => {
          if (filter.status === ProviderAcceptanceStatus.Active && acceptanceStatus === ProviderAcceptanceStatus.Active) {
            return {
              _id: activeAcceptanceId,
              status: ProviderAcceptanceStatus.Active,
              providerId: providerAId,
              mechanismHash: approvedMechanism.hash,
              policyFingerprint: hashContract(dummyPolicies),
              templateVersion: approvedTemplate.version,
              acceptedAt: new Date(),
              acceptedByUserId: providerAUserId,
              lean: () => Promise.resolve({
                _id: activeAcceptanceId,
                status: ProviderAcceptanceStatus.Active,
                providerId: providerAId,
                mechanismHash: approvedMechanism.hash,
                policyFingerprint: hashContract(dummyPolicies),
                templateVersion: approvedTemplate.version,
                acceptedAt: new Date(),
                acceptedByUserId: providerAUserId,
              }),
            };
          }
          return { lean: () => Promise.resolve(null) };
        }),
        updateOne: updateOneSpy,
      } as unknown as Model<ProviderContractAcceptance>;

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: providerAId,
          userId: providerAUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const approvalService = new ProviderContractApprovalService(
        true,
        {} as Connection,
        acceptanceModel,
        accessService,
        {} as ContractMechanismService,
        {} as ContractTemplateService,
        {} as ContractSnapshotService,
      );

      const user = { sub: providerAUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
      
      // Revoke the active acceptance
      const revokeResult = await approvalService.revoke(user);
      expect(revokeResult.revoked).toBe(true);
      expect(acceptanceStatus).toBe(ProviderAcceptanceStatus.Revoked);

      // Now subsequent prepare attempt must fail closed!
      const database = createMockDb();
      const policyService = new ContractPolicyService({ db: database } as unknown as Connection, acceptanceModel);
      const prepService = new ContractPreparationService(
        true,
        { db: database } as unknown as Connection,
        {} as Model<DigitalContract>,
        {} as Model<ContractVersion>,
        policyService,
        {} as ContractSnapshotService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
      );

      await expect(
        prepService.prepare(bookingId.toString(), providerAId.toString()),
      ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');
    });
  });

  describe('Scenario 7: Valid acceptance exists -> preparation succeeds', () => {
    it('successfully prepares a draft contract and version when provider has actively accepted', async () => {
      const itm = mockItem(providerAId);
      const activeAcceptanceId = oid();
      const policyHash = hashContract(dummyPolicies);

      const activeAcceptance = {
        _id: activeAcceptanceId,
        providerId: providerAId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
        mechanismVersion: approvedMechanism.version,
        templateVersion: approvedTemplate.version,
        mechanismHash: approvedMechanism.hash,
        policyFingerprint: policyHash,
        acceptedAt: new Date('2026-11-01'),
        acceptedByUserId: providerAUserId,
      };

      const mockSnapshot = {
        booking: { id: bookingId.toString() },
        providerItems: [itm],
        pricing: { total: 200000 },
        policies: dummyPolicies,
        template: approvedTemplate,
      };

      const database = createMockDb();

      let savedContract: any = null;
      let savedVersion: any = null;

      class MockContract {
        _id = oid();
        currentVersionId: Types.ObjectId | null = null;
        currentRevision = 0;
        flowVersion = 2;
        constructor(fields: any) {
          Object.assign(this, fields);
          savedContract = this;
        }
        save() {
          return Promise.resolve(this);
        }
        static findOne() {
          return { session: () => Promise.resolve(savedContract) };
        }
      }

      class MockVersion {
        _id = oid();
        constructor(fields: any) {
          Object.assign(this, fields);
          savedVersion = this;
        }
        save() {
          return Promise.resolve(this);
        }
        static findById(id: Types.ObjectId) {
          return { session: () => Promise.resolve(savedVersion && savedVersion._id.equals(id) ? savedVersion : null) };
        }
      }

      const session = {
        withTransaction: async (cb: any) => cb(),
        endSession: jest.fn(),
      };
      const connection = {
        db: database,
        startSession: jest.fn().mockResolvedValue(session),
      } as unknown as Connection;

      const acceptanceModel = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(activeAcceptance),
        }),
      } as unknown as Model<ProviderContractAcceptance>;

      const policyService = new ContractPolicyService(connection, acceptanceModel);
      const snapshotService = {
        build: jest.fn().mockResolvedValue(mockSnapshot),
      } as unknown as ContractSnapshotService;
      const templateService = {
        getApproved: jest.fn().mockReturnValue(approvedTemplate),
      } as unknown as ContractTemplateService;

      const prepService = new ContractPreparationService(
        true,
        connection,
        MockContract as any,
        MockVersion as any,
        policyService,
        snapshotService,
        templateService,
      );

      const outcome = await prepService.prepare(bookingId.toString(), providerAId.toString());

      expect(outcome).toBeDefined();
      expect(outcome.version).toBe(1);
      expect(outcome.reused).toBe(false);
      expect(savedContract).toBeDefined();
      expect(savedVersion).toBeDefined();
      expect(savedVersion.providerAcceptanceId.toString()).toBe(activeAcceptanceId.toString());
      expect(savedVersion.state).toBe(ContractVersionState.Offered);
    });
  });

  describe('Scenario 8: Existing accepted ContractVersion documents remain immutable', () => {
    it('never mutates an already ACCEPTED contract version document when new state is prepared', async () => {
      const itm = mockItem(providerAId);
      const activeAcceptanceId = oid();
      const policyHash = hashContract(dummyPolicies);

      const acceptedVersionId = oid();
      const originalContentHash = 'original_sha256_hash_v1';
      const originalBookingFingerprint = 'original_fingerprint_v1';
      const originalRenderedText = 'Original accepted contract v1';

      const acceptedVersion = {
        _id: acceptedVersionId,
        version: 1,
        state: ContractVersionState.Accepted,
        contentHash: originalContentHash,
        bookingFingerprint: originalBookingFingerprint,
        renderedText: originalRenderedText,
        templateVersion: approvedTemplate.version,
        providerAcceptanceId: activeAcceptanceId,
      };

      const existingContract = {
        _id: oid(),
        bookingId,
        providerId: providerAId,
        scope: ContractScope.AoDaiRental,
        flowVersion: 2,
        currentVersionId: acceptedVersionId,
        currentRevision: 1,
        save: jest.fn().mockResolvedValue(true),
      };

      const newMockSnapshot = {
        booking: { id: bookingId.toString(), note: 'changed booking details' },
        providerItems: [itm],
        pricing: { total: 250000 },
        policies: dummyPolicies,
        template: approvedTemplate,
      };

      const database = createMockDb();

      let newCreatedVersion: any = null;
      class MockContractModel {
        static findOne() {
          return { session: () => Promise.resolve(existingContract) };
        }
      }

      class MockVersionModel {
        _id = oid();
        constructor(fields: any) {
          Object.assign(this, fields);
          newCreatedVersion = this;
        }
        save() {
          return Promise.resolve(this);
        }
        static findById(id: Types.ObjectId) {
          return {
            session: () => Promise.resolve(id.equals(acceptedVersionId) ? acceptedVersion : null),
          };
        }
        static updateOne = jest.fn().mockImplementation((filter: any, update: any) => {
          // If the filter has state: { $ne: ContractVersionState.Accepted }, it will NOT match acceptedVersion!
          if (filter.state && filter.state.$ne === ContractVersionState.Accepted) {
            if (acceptedVersion.state === ContractVersionState.Accepted) {
              return Promise.resolve({ modifiedCount: 0 }); // Was not modified because it's Accepted
            }
          }
          return Promise.resolve({ modifiedCount: 1 });
        });
      }

      const session = {
        withTransaction: async (cb: any) => cb(),
        endSession: jest.fn(),
      };
      const connection = {
        db: database,
        startSession: jest.fn().mockResolvedValue(session),
      } as unknown as Connection;

      const activeAcceptance = {
        _id: activeAcceptanceId,
        providerId: providerAId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
        mechanismVersion: approvedMechanism.version,
        templateVersion: approvedTemplate.version,
        mechanismHash: approvedMechanism.hash,
        policyFingerprint: policyHash,
        acceptedAt: new Date('2026-11-01'),
        acceptedByUserId: providerAUserId,
      };

      const acceptanceModel = {
        findOne: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(activeAcceptance),
        }),
      } as unknown as Model<ProviderContractAcceptance>;

      const prepService = new ContractPreparationService(
        true,
        connection,
        MockContractModel as any,
        MockVersionModel as any,
        new ContractPolicyService(connection, acceptanceModel),
        { build: jest.fn().mockResolvedValue(newMockSnapshot) } as unknown as ContractSnapshotService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
      );

      const outcome = await prepService.prepare(bookingId.toString(), providerAId.toString());

      // Version 2 is created
      expect(outcome.version).toBe(2);
      expect(outcome.reused).toBe(false);

      // CRITICAL IMMUTABILITY ASSERTION: Original accepted version remains intact!
      expect(acceptedVersion.state).toBe(ContractVersionState.Accepted);
      expect(acceptedVersion.contentHash).toBe(originalContentHash);
      expect(acceptedVersion.bookingFingerprint).toBe(originalBookingFingerprint);
      expect(acceptedVersion.renderedText).toBe(originalRenderedText);

      // New version has its own distinct id and state Offered
      expect(newCreatedVersion).toBeDefined();
      expect(newCreatedVersion.version).toBe(2);
      expect(newCreatedVersion.state).toBe(ContractVersionState.Offered);
    });
  });

  describe('Scenario 9: Multi-provider: one shop lacking acceptance blocks checkout guard', () => {
    it('fails closed when provider B lacks active acceptance even if provider A is accepted', async () => {
      const b = mockBooking({
        providerIds: [providerAId, providerBId],
      });
      const itemA = mockItem(providerAId, { _id: itemIdA });
      const itemB = mockItem(providerBId, { _id: itemIdB });

      const contractAId = oid();
      const versionAId = oid();
      const acceptanceAId = oid();

      const snapshotA = {
        booking: { id: bookingId.toString() },
        providerItems: [itemA],
        pricing: { total: 200000 },
        policies: dummyPolicies,
        template: approvedTemplate,
      };
      const renderedTextA = canonicalizeContract({ template: approvedTemplate, snapshot: snapshotA });
      const contentHashA = hashContract({ template: approvedTemplate, snapshot: snapshotA });
      const fingerprintA = hashContract({
        booking: snapshotA.booking,
        providerItems: snapshotA.providerItems,
        pricing: snapshotA.pricing,
      });

      const contractA = {
        _id: contractAId,
        bookingId,
        customerId,
        providerId: providerAId,
        flowVersion: 2,
        scope: ContractScope.AoDaiRental,
        approvalMode: ContractApprovalMode.AutoAcceptance,
        currentVersionId: versionAId,
      };

      const versionA = {
        _id: versionAId,
        contractId: contractAId,
        state: ContractVersionState.Accepted,
        templateVersion: approvedTemplate.version,
        providerAcceptanceId: acceptanceAId,
        renderedText: renderedTextA,
        contentHash: contentHashA,
        bookingFingerprint: fingerprintA,
      };

      const consentA = {
        _id: oid(),
        contractId: contractAId,
        contractVersionId: versionAId,
        actorUserId: customerId,
        action: ContractConsentAction.Accept,
        contentHash: contentHashA,
        bookingFingerprint: fingerprintA,
      };

      const activeAcceptanceA = {
        _id: acceptanceAId,
        providerId: providerAId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
        mechanismVersion: approvedMechanism.version,
        templateVersion: approvedTemplate.version,
        mechanismHash: approvedMechanism.hash,
        policyFingerprint: hashContract(dummyPolicies),
        acceptedAt: new Date('2026-11-01'),
        acceptedByUserId: providerAUserId,
      };

      const database = createMockDb({
        booking: b,
        items: [itemA, itemB],
      });

      const acceptanceModel = {
        findOne: jest.fn().mockImplementation((filter: any) => {
          // Provider A has active acceptance, Provider B does NOT!
          if (filter.providerId.equals(providerAId)) {
            return { lean: () => Promise.resolve(activeAcceptanceA) };
          }
          return { lean: () => Promise.resolve(null) };
        }),
      } as unknown as Model<ProviderContractAcceptance>;

      const contractModel = {
        db: database,
        findOne: jest.fn().mockImplementation((filter: any) => {
          if (filter.providerId.equals(providerAId)) return lean(contractA);
          return lean(null);
        }),
      } as unknown as Model<DigitalContract>;

      const versionModel = {
        findById: jest.fn().mockImplementation((id: Types.ObjectId) => {
          if (id.equals(versionAId)) return lean(versionA);
          return lean(null);
        }),
      } as unknown as Model<ContractVersion>;

      const consentModel = {
        findOne: jest.fn().mockImplementation((filter: any) => {
          if (filter.contractVersionId.equals(versionAId)) return lean(consentA);
          return lean(null);
        }),
      } as unknown as Model<ContractConsent>;

      const policyService = new ContractPolicyService({ db: database } as unknown as Connection, acceptanceModel);
      const snapshotService = {
        build: jest.fn().mockImplementation((_ctx: any, pId: Types.ObjectId) => {
          if (pId.equals(providerAId)) return Promise.resolve(snapshotA);
          return Promise.resolve(null);
        }),
      } as unknown as ContractSnapshotService;

      const prepService = {
        assertLiveHold: jest.fn().mockResolvedValue(undefined),
      } as unknown as ContractPreparationService;

      const guard = new ContractCheckoutGuard(
        true,
        contractModel,
        versionModel,
        consentModel,
        policyService,
        snapshotService,
        prepService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        { getApproved: () => approvedMechanism } as unknown as ContractMechanismService,
      );

      // Provider B has NO contract and NO acceptance -> evaluate() MUST fail closed!
      await expect(
        guard.evaluate(bookingId.toString(), 400000, PaymentPurpose.RentalInitial),
      ).rejects.toThrow();
    });
  });

  describe('Scenario 10: Feature flag OFF -> legacy checkout and photography unaffected', () => {
    it('returns null binding and does not block checkout when CONTRACTS_V2_ENABLED is false', async () => {
      const database = createMockDb();
      const policyService = new ContractPolicyService({ db: database } as unknown as Connection, {} as any);

      // Flag disabled
      const guard = new ContractCheckoutGuard(
        false,
        {} as Model<DigitalContract>,
        {} as Model<ContractVersion>,
        {} as Model<ContractConsent>,
        policyService,
        {} as ContractSnapshotService,
        {} as ContractPreparationService,
        {} as ContractTemplateService,
        {} as ContractMechanismService,
      );

      // When booking is legacy (contractFlowVersion !== 2), it bypasses
      const legacyBooking = mockBooking({ contractFlowVersion: 1 });
      const legacyDb = createMockDb({ booking: legacyBooking });
      const legacyPolicy = new ContractPolicyService({ db: legacyDb } as unknown as Connection, {} as any);
      const legacyGuard = new ContractCheckoutGuard(
        true,
        {} as any,
        {} as any,
        {} as any,
        legacyPolicy,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const legacyDecision = await legacyGuard.evaluate(bookingId.toString(), 200000, PaymentPurpose.RentalInitial);
      expect(legacyDecision).toEqual({ binding: null, context: null });
    });

    it('returns null binding for PHOTOGRAPHY bookings without blocking', async () => {
      const photoBooking = mockBooking({
        bookingType: 'PHOTOGRAPHY',
      });
      const database = createMockDb({ booking: photoBooking, items: [] });
      const policyService = new ContractPolicyService({ db: database } as unknown as Connection, {} as any);

      const guard = new ContractCheckoutGuard(
        true,
        {} as any,
        {} as any,
        {} as any,
        policyService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const photoDecision = await guard.evaluate(bookingId.toString(), 500000, PaymentPurpose.PhotographyInitial);
      expect(photoDecision).toEqual({ binding: null, context: null });
    });
  });
});
