import { UnprocessableEntityException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractTierEvaluator } from '../contract-tier-evaluator';
import { hashContract } from '../canonical-contract';
import { ProviderContractMode } from '../schemas/provider-contract-config.schema';

describe('Phase 2B: ContractPreparationService Tier & Risk Integration Suite', () => {
  let service: ContractPreparationService;
  let mockConnection: any;
  let mockContractsModel: any;
  let mockVersionsModel: any;
  let mockPolicyService: any;
  let mockSnapshotService: any;
  let mockTemplateService: any;
  let mockConfigService: any;
  let tierEvaluator: ContractTierEvaluator;

  const bookingId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const contractId = new Types.ObjectId();
  const versionId = new Types.ObjectId();

  const mockContext = {
    booking: {
      _id: bookingId,
      customerId,
      status: 'PENDING_PAYMENT',
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
    rentalProviderIds: [providerId],
    rentalItems: [
      {
        _id: new Types.ObjectId(),
        bookingId,
        providerId,
        itemType: 'AODAI_RENTAL',
        unitPrice: 80000,
        depositAmount: 40000,
        quantity: 1,
        replacementValue: 400000,
        rentalFrom: new Date(),
        rentalTo: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    ],
  };

  const mockPolicies = {
    providerDamageCompensation: {
      incidentNotificationHours: 24,
      disputeResolutionTerms: 'Thỏa thuận hòa giải',
      minorDamage: { method: 'FIXED_FEE', fixedFeeAmount: 50000 },
      moderateDamage: { method: 'FIXED_FEE', fixedFeeAmount: 100000 },
      severeDamage: { method: 'FIXED_FEE', fixedFeeAmount: 200000 },
      totalLoss: { method: 'FIXED_FEE', fixedFeeAmount: 400000 },
    },
    garmentCare: { allowIroning: false },
    lateReturn: { gracePeriodHours: 2 },
  };

  const mockSnapshot = {
    bookingId: bookingId.toString(),
    customerId: customerId.toString(),
    providerId: providerId.toString(),
    bookingType: 'AODAI_RENTAL',
    bookingItemIds: ['item-1'],
    booking: { bookingCode: 'BK-001' },
    customer: { fullName: 'Customer A' },
    provider: { storeName: 'Tiệm Áo Dài A' },
    providerItems: [{ productName: 'Áo dài', quantity: 1, unitPrice: 80000 }],
    pricing: { rentalFee: 80000, depositAmount: 40000, totalAmount: 120000 },
    policies: mockPolicies,
    template: { version: 'ao-dai-rental-v2' },
  };

  const mockTemplate = {
    version: 'ao-dai-rental-v2',
    status: 'APPROVED',
    title: 'Hợp đồng thuê áo dài',
    sections: [
      { id: 'parties', heading: 'Các bên', source: 'customer/provider' },
    ],
  };

  const mockAcceptance = {
    _id: new Types.ObjectId(),
    policyFingerprint: hashContract(mockPolicies),
    mechanismHash: 'mech-hash-1',
    templateVersion: 'ao-dai-rental-v2',
  };

  beforeEach(() => {
    process.env.CONTRACTS_TIERED_ENABLED = 'true';
    process.env.PLATFORM_RISK_RULES_APPROVED = 'true';
    process.env.PLATFORM_RISK_RULES_VERSION = 'risk-rules-v1.0';

    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb()),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
      db: {
        collection: jest.fn().mockImplementation((name: string) => ({
          createIndex: jest.fn(),
          dropIndex: jest.fn(),
          listIndexes: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
          indexes: jest.fn().mockResolvedValue(
            name === 'digital_contracts'
              ? [{ key: { bookingId: 1, providerId: 1, scope: 1 }, unique: true }]
              : name === 'contract_versions'
              ? [{ key: { contractId: 1, version: 1 }, unique: true }]
              : name === 'provider_contract_acceptances'
              ? [{ key: { providerId: 1, scope: 1 }, unique: true, partialFilterExpression: { status: 'ACTIVE' } }]
              : []
          ),
          findOne: jest.fn().mockImplementation((query: any) => {
            if (name === 'bookings') {
              return {
                ...mockContext.booking,
                contractFlowVersion: 2,
              };
            }
            if (name === 'booking_items') {
              const item = mockContext.rentalItems.find((i: any) => i._id.toString() === query._id.toString());
              return item ? { ...item } : null;
            }
            return null;
          }),
          countDocuments: jest.fn().mockResolvedValue(1),
          insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock' }),
          updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        })),
      },
    };

    mockContractsModel = jest.fn().mockImplementation((data) => ({
      ...data,
      _id: contractId,
      id: contractId.toString(),
      save: jest.fn().mockResolvedValue(this),
    }));
    mockContractsModel.findOne = jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(null),
    });

    mockVersionsModel = jest.fn().mockImplementation((data) => ({
      ...data,
      _id: versionId,
      id: versionId.toString(),
      save: jest.fn().mockResolvedValue(this),
    }));
    mockVersionsModel.findById = jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(null),
    });
    mockVersionsModel.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    mockPolicyService = {
      getContext: jest.fn().mockResolvedValue(mockContext),
      requireAutoAcceptance: jest.fn().mockResolvedValue(mockAcceptance),
    };

    mockSnapshotService = {
      build: jest.fn().mockResolvedValue(mockSnapshot),
    };

    mockTemplateService = {
      getApproved: jest.fn().mockReturnValue(mockTemplate),
    };

    mockConfigService = {
      getConfigForProvider: jest.fn().mockResolvedValue({
        providerId,
        contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
        orderThresholdAmount: 500000, // 500k threshold
        version: 1,
      }),
    };

    tierEvaluator = new ContractTierEvaluator();

    service = new ContractPreparationService(
      true, // enabled
      mockConnection,
      mockContractsModel,
      mockVersionsModel,
      mockPolicyService,
      mockSnapshotService,
      mockTemplateService,
      mockConfigService,
      tierEvaluator,
    );
  });

  afterAll(() => {
    delete process.env.CONTRACTS_TIERED_ENABLED;
    delete process.env.PLATFORM_RISK_RULES_APPROVED;
    delete process.env.PLATFORM_RISK_RULES_VERSION;
  });

  it('determines QUICK presentationMode when order amount (120k) < shop threshold (500k)', async () => {
    const outcome = await service.prepare(
      bookingId.toString(),
      providerId.toString(),
    );

    expect(outcome.presentationMode).toBe('QUICK');
    expect(outcome.version).toBe(1);
    expect(mockVersionsModel).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationMode: 'QUICK',
        appliedRule: 'ORDER_AMOUNT_BELOW_PROVIDER_THRESHOLD',
        configVersion: 1,
        riskRulesVersion: 'risk-rules-v1.0',
      }),
    );
  });

  it('determines DETAILED presentationMode when order amount exceeds threshold', async () => {
    mockConfigService.getConfigForProvider.mockResolvedValueOnce({
      providerId,
      contractMode: ProviderContractMode.CUSTOM_ORDER_THRESHOLD,
      orderThresholdAmount: 100000, // Threshold 100k < Effective amount 120k
      version: 2,
    });

    const outcome = await service.prepare(
      bookingId.toString(),
      providerId.toString(),
    );

    expect(outcome.presentationMode).toBe('DETAILED');
    expect(mockVersionsModel).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationMode: 'DETAILED',
        appliedRule: 'ORDER_AMOUNT_EXCEEDS_PROVIDER_THRESHOLD',
      }),
    );
  });

  it('falls back to DETAILED when CONTRACTS_TIERED_ENABLED is false', async () => {
    process.env.CONTRACTS_TIERED_ENABLED = 'false';

    const outcome = await service.prepare(
      bookingId.toString(),
      providerId.toString(),
    );

    expect(outcome.presentationMode).toBe('DETAILED');
    expect(mockVersionsModel).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationMode: 'DETAILED',
        appliedRule: 'TIERED_CONTRACTS_FEATURE_FLAG_DISABLED',
      }),
    );
  });

  it('falls back to DETAILED when PLATFORM_RISK_RULES_APPROVED is false', async () => {
    process.env.PLATFORM_RISK_RULES_APPROVED = 'false';

    const outcome = await service.prepare(
      bookingId.toString(),
      providerId.toString(),
    );

    expect(outcome.presentationMode).toBe('DETAILED');
    expect(mockVersionsModel).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationMode: 'DETAILED',
        appliedRule: 'PLATFORM_RISK_RULES_UNAPPROVED',
      }),
    );
  });

  it('falls back to DETAILED when provider has no saved configuration (null)', async () => {
    mockConfigService.getConfigForProvider.mockResolvedValueOnce(null);

    const outcome = await service.prepare(
      bookingId.toString(),
      providerId.toString(),
    );

    expect(outcome.presentationMode).toBe('DETAILED');
    expect(mockVersionsModel).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationMode: 'DETAILED',
        appliedRule: 'UNCONFIGURED_LEGACY_PROVIDER_DEFAULT',
      }),
    );
  });

  it('throws CONTRACT_ELIGIBILITY_FAILED when policy requires replacementValue and product lacks it', async () => {
    // Policy requires replacement value (% of asset)
    const percentPolicy = {
      ...mockPolicies,
      providerDamageCompensation: {
        minorDamage: { method: 'PERCENTAGE_ON_ASSET', percentageOfAsset: 20 },
      },
    };
    mockSnapshotService.build.mockResolvedValueOnce({
      ...mockSnapshot,
      policies: percentPolicy,
    });
    mockPolicyService.requireAutoAcceptance.mockResolvedValue({
      ...mockAcceptance,
      policyFingerprint: hashContract(percentPolicy),
    });

    // Item lacks valid replacementValue
    mockPolicyService.getContext.mockResolvedValueOnce({
      ...mockContext,
      rentalItems: [
        {
          ...mockContext.rentalItems[0],
          replacementValue: null, // MISSING
        },
      ],
    });

    await expect(
      service.prepare(bookingId.toString(), providerId.toString()),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  describe('Requirement 2: Real prepare() logic on declined contract & terms modification', () => {
    it('Case A: Terms unchanged -> prepare() reuses version 1, preserves DECLINED state and does not create new version', async () => {
      // Calculate exact expected hashes for current snapshot & template
      const currentContentHash = hashContract({ template: mockTemplate, snapshot: mockSnapshot });
      const currentBookingFingerprint = hashContract({
        booking: mockSnapshot.booking,
        providerItems: mockSnapshot.providerItems,
        pricing: mockSnapshot.pricing,
      });

      const existingContract = {
        _id: contractId,
        id: contractId.toString(),
        currentVersionId: versionId,
        currentRevision: 1,
        flowVersion: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      const existingVersionV1 = {
        _id: versionId,
        id: versionId.toString(),
        version: 1,
        contentHash: currentContentHash,
        bookingFingerprint: currentBookingFingerprint,
        presentationMode: 'QUICK',
        state: 'DECLINED', // Customer had declined v1!
      };

      mockContractsModel.findOne = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(existingContract),
      });
      mockVersionsModel.findById = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(existingVersionV1),
      });

      const outcome = await service.prepare(bookingId.toString(), providerId.toString());

      expect(outcome.reused).toBe(true);
      expect(outcome.versionId).toBe(versionId.toString());
      expect(outcome.version).toBe(1);
      // Ensure mockVersionsModel constructor was NOT called to create a new version
      expect(mockVersionsModel).not.toHaveBeenCalled();
      // Ensure existing version state was NOT altered
      expect(existingVersionV1.state).toBe('DECLINED');
    });

    it('Case B: Terms changed -> prepare() creates v2, increments revision, and keeps v1 DECLINED without overwriting', async () => {
      const oldContentHash = 'old_stale_hash_from_v1';
      const currentBookingFingerprint = hashContract({
        booking: mockSnapshot.booking,
        providerItems: mockSnapshot.providerItems,
        pricing: mockSnapshot.pricing,
      });

      const existingContract = {
        _id: contractId,
        id: contractId.toString(),
        currentVersionId: versionId,
        currentRevision: 1,
        flowVersion: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      const existingVersionV1 = {
        _id: versionId,
        id: versionId.toString(),
        version: 1,
        contentHash: oldContentHash, // Differing content hash because policy/terms changed!
        bookingFingerprint: currentBookingFingerprint,
        presentationMode: 'QUICK',
        state: 'DECLINED', // Customer declined v1!
      };

      mockContractsModel.findOne = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(existingContract),
      });
      mockVersionsModel.findById = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(existingVersionV1),
      });

      const newVersionId = new Types.ObjectId();
      const mockSavedNewVersion = {
        _id: newVersionId,
        id: newVersionId.toString(),
        version: 2,
        state: 'OFFERED',
        save: jest.fn().mockResolvedValue(true),
      };
      mockVersionsModel.mockImplementation((data) => ({
        ...data,
        ...mockSavedNewVersion,
      }));

      const outcome = await service.prepare(bookingId.toString(), providerId.toString());

      expect(outcome.reused).toBe(false);
      expect(outcome.version).toBe(2);
      expect(mockVersionsModel).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          state: 'OFFERED',
        }),
      );
      // Verify v1 was NOT marked superseded because query only supersedes DRAFT or OFFERED
      expect(mockVersionsModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: versionId,
          state: { $in: ['DRAFT', 'OFFERED'] },
        }),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});
