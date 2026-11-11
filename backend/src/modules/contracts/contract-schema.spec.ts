import { model, Types } from 'mongoose';
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
  DigitalContractSchema,
} from '../bookings/schemas/digital-contract.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import {
  Payment,
  PaymentPurpose,
  PaymentSchema,
} from '../payments/schemas/payment.schema';
import {
  ContractVersion,
  ContractVersionSchema,
} from './schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentSchema,
} from './schemas/contract-consent.schema';
import {
  ProviderContractAcceptance,
  ProviderContractAcceptanceSchema,
} from './schemas/provider-contract-acceptance.schema';

import {
  classifyLegacyContract,
  assertTestApplyTarget,
  fingerprintContracts,
} from '../../../scripts/migrate-contract-v2';
const hash = 'a'.repeat(64);

describe('Phase 2 contract schema and legacy compatibility', () => {
  const ContractModel = model(DigitalContract.name, DigitalContractSchema);
  const VersionModel = model(ContractVersion.name, ContractVersionSchema);
  const ConsentModel = model(ContractConsent.name, ContractConsentSchema);
  const ProviderAcceptanceModel = model(
    ProviderContractAcceptance.name,
    ProviderContractAcceptanceSchema,
  );
  const PaymentModel = model(Payment.name, PaymentSchema);
  const BookingModel = model(Booking.name, BookingSchema);

  it('keeps index creation disabled for every contract model', () => {
    for (const schema of [
      DigitalContractSchema,
      ContractVersionSchema,
      ContractConsentSchema,
      ProviderContractAcceptanceSchema,
    ]) {
      expect(schema.options.autoIndex).toBe(false);
    }
    const indexes = DigitalContractSchema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { bookingId: 1, providerId: 1, scope: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );
    expect(
      indexes.some(
        ([key, options]) =>
          key.bookingId === 1 &&
          Object.keys(key).length === 1 &&
          options.unique,
      ),
    ).toBe(false);
    expect(ContractVersionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { contractId: 1, version: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );
    expect(ContractConsentSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { contractVersionId: 1, actorUserId: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );
    expect(ProviderContractAcceptanceSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { providerId: 1, scope: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: 'ACTIVE' },
          }),
        ],
      ]),
    );
  });

  it('reads a historical signed document without requiring new fields or fabricating consent', async () => {
    const legacy = new ContractModel({
      bookingId: new Types.ObjectId(),
      providerId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      contractCode: 'LEGACY-001',
      contractTerms: 'Previously signed terms',
      policySnapshot: {
        cancellationPolicy: 'Existing',
        refundPolicy: 'Existing',
        lateFeeRate: 0,
        damagePolicy: 'Existing',
      },
      signatures: [
        { signedBy: new Types.ObjectId(), signedAt: new Date('2026-01-01') },
      ],
      status: 'SIGNED',
    });
    await expect(legacy.validate()).resolves.toBeUndefined();
    expect(legacy.flowVersion).toBeNull();
    expect(legacy.scope).toBeNull();
    expect(legacy.signatures).toHaveLength(1);
    legacy.flowVersion = 1;
    legacy.scope = ContractScope.AoDaiRental;
    await expect(legacy.validate()).resolves.toBeUndefined();
  });

  it('requires explicit scope and mode for new contracts, without legacy terms', async () => {
    const v2 = new ContractModel({
      bookingId: new Types.ObjectId(),
      providerId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      contractCode: 'V2-001',
      flowVersion: 2,
    });
    await expect(v2.validate()).rejects.toThrow();
    v2.scope = ContractScope.AoDaiRental;
    v2.approvalMode = ContractApprovalMode.AutoAcceptance;
    await expect(v2.validate()).resolves.toBeUndefined();
    expect(v2.contractTerms).toBeNull();
  });

  it('validates version hashes and numbers', async () => {
    const version = new VersionModel({
      contractId: new Types.ObjectId(),
      version: 1,
      templateVersion: 'v1',
      snapshot: {
        bookingId: 'b',
        customerId: 'c',
        providerId: 'p',
        bookingType: 'AODAI_RENTAL',
        bookingItemIds: ['i'],
        booking: {},
        customer: {},
        provider: {},
        providerItems: [{}],
        pricing: {},
        policies: {},
        template: {},
      },
      contentHash: hash,
      bookingFingerprint: hash,
      renderedText: 'Exact contract terms for this version',
    });
    await expect(version.validate()).resolves.toBeUndefined();
    version.contentHash = 'invalid';
    await expect(version.validate()).rejects.toThrow();
    version.contentHash = hash;
    version.snapshot = { ...version.snapshot, bookingItemIds: [] };
    await expect(version.validate()).rejects.toThrow();
  });

  it('leaves legacy bookings and payments outside the new flow by default', () => {
    expect(new BookingModel().contractFlowVersion).toBeNull();
    expect(new PaymentModel().contractBinding).toBeNull();
  });

  it('accepts distinct providers for one booking and validates consent evidence', async () => {
    const bookingId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const providers = [new Types.ObjectId(), new Types.ObjectId()];
    for (const providerId of providers) {
      const contract = new ContractModel({
        bookingId,
        providerId,
        customerId,
        contractCode: `V2-${providerId.toString()}`,
        flowVersion: 2,
        scope: ContractScope.AoDaiRental,
        approvalMode: ContractApprovalMode.AutoAcceptance,
      });
      await expect(contract.validate()).resolves.toBeUndefined();
    }
    const consent = new ConsentModel({
      contractId: new Types.ObjectId(),
      contractVersionId: new Types.ObjectId(),
      actorUserId: customerId,
      actorRole: 'CUSTOMER',
      action: 'ACCEPT',
      contentHash: hash,
      bookingFingerprint: hash,
      idempotencyKey: 'accept-once',
      occurredAt: new Date(),
      authenticationMethod: 'APP_SESSION',
    });
    await expect(consent.validate()).resolves.toBeUndefined();
    consent.contentHash = 'wrong';
    await expect(consent.validate()).rejects.toThrow();
    const preacceptance = new ProviderAcceptanceModel({
      providerId: providers[0],
      acceptedByUserId: new Types.ObjectId(),
      scope: ContractScope.AoDaiRental,
      mechanismVersion: 'v1',
      templateVersion: 'v1',
      mechanismHash: hash,
      policyFingerprint: hash,
      acceptedAt: new Date(),
    });
    await expect(preacceptance.validate()).resolves.toBeUndefined();
  });

  it('requires at least one pinned contract version when a payment binding is present', async () => {
    const payment = new PaymentModel({
      bookingId: new Types.ObjectId(),
      paymentCode: 'PHASE2-001',
      amount: 0,
      purpose: PaymentPurpose.FullPayment,
      contractBinding: {
        bindingVersion: 1,
        flowVersion: 2,
        bookingId: new Types.ObjectId(),
        amount: 0,
        currency: 'VND',
        purpose: PaymentPurpose.FullPayment,
        bookingFingerprint: hash,
        boundAt: new Date(),
        versions: [],
      },
    });
    await expect(payment.validate()).rejects.toThrow();
    payment.contractBinding = {
      bindingVersion: 1,
      flowVersion: 2,
      bookingId: payment.bookingId,
      amount: payment.amount,
      currency: 'VND',
      purpose: payment.purpose,
      bookingFingerprint: hash,
      boundAt: new Date(),
      versions: [
        {
          contractId: new Types.ObjectId(),
          contractVersionId: new Types.ObjectId(),
          providerId: new Types.ObjectId(),
          contentHash: hash,
          bookingFingerprint: hash,
        },
      ],
    };
    await expect(payment.validate()).resolves.toBeUndefined();
  });

  it('plans the existing signed rental contract once and then becomes idempotent', () => {
    const bookingId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const contract = {
      _id: new Types.ObjectId(),
      bookingId,
      providerId,
      customerId,
      contractCode: 'LEGACY-001',
      status: 'SIGNED',
    };
    const booking = {
      _id: bookingId,
      bookingType: 'AODAI_RENTAL',
      customerId,
      providerIds: [providerId],
      contractId: contract._id,
    };
    expect(classifyLegacyContract(contract, booking, 1)).toBe('MARK_LEGACY');
    expect(
      classifyLegacyContract(
        { ...contract, scope: 'AO_DAI_RENTAL', flowVersion: 1 },
        booking,
        1,
      ),
    ).toBe('LEGACY_ALREADY_MARKED');
    expect(() => classifyLegacyContract(contract, booking, 0)).toThrow(
      'no rental item',
    );
    expect(() =>
      classifyLegacyContract(contract, { ...booking, providerIds: [] }, 1),
    ).toThrow('provider');
    const secondProvider = new Types.ObjectId();
    expect(
      classifyLegacyContract(
        {
          ...contract,
          providerId: secondProvider,
          flowVersion: 2,
          scope: ContractScope.AoDaiRental,
          approvalMode: ContractApprovalMode.AutoAcceptance,
        },
        { ...booking, providerIds: [providerId, secondProvider] },
        1,
      ),
    ).toBe('V2_UNCHANGED');
  });

  it('refuses an apply command against the configured application database', () => {
    const uri = 'mongodb://127.0.0.1:27017/vibehue';
    expect(() =>
      assertTestApplyTarget(
        uri,
        'vibehue',
        ['--allow-test-write', '--test-db=vibehue'],
        uri,
      ),
    ).toThrow();
    expect(() =>
      assertTestApplyTarget(
        'mongodb://127.0.0.1:27017/contracts_test',
        'contracts_test',
        ['--allow-test-write', '--test-db=contracts_test'],
        uri,
      ),
    ).not.toThrow();
  });

  it('keeps the dry-run fingerprint stable across result order and changes it after migration', () => {
    const rows = [
      { _id: '1', bookingId: 'b1', providerId: 'p1', status: 'SIGNED' },
      { _id: '2', bookingId: 'b2', providerId: 'p2', status: 'DRAFT' },
    ];
    expect(fingerprintContracts(rows)).toBe(
      fingerprintContracts([...rows].reverse()),
    );
    expect(fingerprintContracts(rows)).not.toBe(
      fingerprintContracts([
        { ...rows[0], scope: ContractScope.AoDaiRental },
        rows[1],
      ]),
    );
  });
});
