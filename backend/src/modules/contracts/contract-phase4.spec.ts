import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContractAccessService } from './contract-access.service';
import { ContractConsentService } from './contract-consent.service';
import { ContractReadService } from './contract-read.service';
import { ContractPreparationService } from './contract-preparation.service';
import { ProviderContractApprovalService } from './provider-contract-approval.service';
import { canonicalizeContract, hashContract } from './canonical-contract';
import {
  ContractApprovalMode,
  ContractScope,
} from '../bookings/schemas/digital-contract.schema';
import { ContractConsentAction } from './schemas/contract-consent.schema';
import { ContractVersionState } from './schemas/contract-version.schema';

const oid = () => new Types.ObjectId();
const lean = (value: unknown) => ({ lean: jest.fn().mockResolvedValue(value) });

describe('Phase 4 access', () => {
  const customerId = oid();
  const providerUserId = oid();
  const providerId = oid();
  const otherProviderId = oid();
  const booking = {
    _id: oid(),
    customerId,
    providerIds: [providerId, otherProviderId],
  };
  const providers = {
    findOne: jest
      .fn()
      .mockImplementation((filter: { userId: Types.ObjectId }) =>
        Promise.resolve(
          filter.userId.equals(providerUserId) ? { _id: providerId } : null,
        ),
      ),
  };
  const access = new ContractAccessService({
    db: { collection: () => providers },
  } as never);
  const user = (
    sub: Types.ObjectId,
    roles: string[] = [],
    permissions: string[] = [],
  ) => ({ sub: sub.toString(), roles, permissions, email: '', sessionId: '' });

  it('permits the booking customer and assigned provider, but not another user', async () => {
    await expect(
      access.assertBookingReader(user(customerId), booking as never),
    ).resolves.toMatchObject({ kind: 'CUSTOMER' });
    await expect(
      access.assertBookingReader(user(providerUserId), booking as never),
    ).resolves.toMatchObject({ kind: 'PROVIDER', providerId });
    await expect(
      access.assertBookingReader(user(oid()), booking as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not disclose another provider contract or grant admin access without permissions', async () => {
    await expect(
      access.assertContractReader(
        user(providerUserId),
        booking as never,
        otherProviderId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.assertBookingReader(
        user(oid(), ['ADMIN'], ['user:read']),
        booking as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.assertBookingReader(
        user(oid(), ['ADMIN'], ['user:read', 'provider:read']),
        booking as never,
      ),
    ).resolves.toMatchObject({ kind: 'ADMIN' });
  });
});

describe('Phase 4 customer decision', () => {
  const customerId = oid();
  const bookingId = oid();
  const providerId = oid();
  const contractId = oid();
  const versionId = oid();
  const acceptanceId = oid();
  const template = {
    version: 'v1',
    status: 'APPROVED',
    approvedAt: '2026-01-01',
  };
  const mechanism = { hash: 'm'.repeat(64) };
  const snapshot = {
    booking: { id: bookingId.toString() },
    providerItems: [],
    pricing: {},
    policies: {},
  };
  const renderedText = canonicalizeContract({ template, snapshot });
  const contentHash = hashContract({ template, snapshot });
  const bookingFingerprint = hashContract({
    booking: snapshot.booking,
    providerItems: snapshot.providerItems,
    pricing: snapshot.pricing,
  });
  const booking = {
    _id: bookingId,
    customerId,
    status: 'PENDING_PAYMENT',
    contractFlowVersion: 2,
  };
  const contract = {
    _id: contractId,
    bookingId,
    customerId,
    providerId,
    flowVersion: 2,
    scope: ContractScope.AoDaiRental,
    approvalMode: ContractApprovalMode.AutoAcceptance,
    currentVersionId: versionId,
  };
  const version = {
    _id: versionId,
    contractId,
    state: ContractVersionState.Offered,
    templateVersion: 'v1',
    providerAcceptanceId: acceptanceId,
    renderedText,
    contentHash,
    bookingFingerprint,
    expiresAt: new Date(Date.now() + 60000),
  };
  const acceptance = {
    _id: acceptanceId,
    mechanismHash: mechanism.hash,
    policyFingerprint: hashContract({}),
    acceptedAt: new Date('2026-01-01'),
  };
  const actor = {
    sub: customerId.toString(),
    roles: ['CUSTOMER'],
    permissions: [],
    email: '',
    sessionId: '',
  };
  const dto = (
    action: ContractConsentAction = ContractConsentAction.Accept,
  ) => ({
    contractVersionId: versionId.toString(),
    contentHash,
    bookingFingerprint,
    idempotencyKey: 'attempt-1',
    action,
  });

  function setup() {
    const state = {
      version: { ...version },
      consent: null as Record<string, unknown> | null,
      acceptance: { ...acceptance },
    };
    const contractFind = jest.fn().mockImplementation(() => ({
      ...lean(contract),
      session: jest.fn().mockResolvedValue(contract),
    }));
    const versionFind = jest.fn().mockImplementation(() => ({
      ...lean(state.version),
      session: jest.fn().mockResolvedValue(state.version),
    }));
    const consentFind = jest.fn().mockImplementation(() => ({
      ...lean(state.consent),
      session: jest.fn().mockResolvedValue(state.consent),
    }));
    const consentSave = jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
    ) {
      state.consent = { ...this };
      return Promise.resolve();
    });
    const ConsentModel = jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) => ({
        ...data,
        _id: oid(),
        save: consentSave,
      }));
    Object.assign(ConsentModel, { findOne: consentFind });
    const versionUpdate = jest
      .fn()
      .mockImplementation(
        (_filter, update: { $set: Record<string, unknown> }) => {
          Object.assign(state.version, update.$set);
          return Promise.resolve({ modifiedCount: 1 });
        },
      );
    const session = {
      withTransaction: jest
        .fn()
        .mockImplementation(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn(),
    };
    const connection = {
      startSession: jest.fn().mockResolvedValue(session),
      db: {
        collection: jest.fn().mockReturnValue({
          indexes: jest.fn().mockResolvedValue([
            { unique: true, key: { contractVersionId: 1, actorUserId: 1 } },
            { unique: true, key: { actorUserId: 1, idempotencyKey: 1 } },
          ]),
        }),
      },
    };
    const access = {
      booking: jest.fn().mockResolvedValue(booking),
      assertCustomer: jest.fn().mockImplementation((user: typeof actor) => {
        if (user.sub !== customerId.toString())
          throw new NotFoundException('CONTRACT_NOT_FOUND');
      }),
    };
    const policy = {
      getContext: jest.fn().mockResolvedValue({ booking }),
      requireAutoAcceptance: jest
        .fn()
        .mockImplementation(() => Promise.resolve(state.acceptance)),
    };
    const preparation = {
      assertLiveHold: jest.fn(),
      assertSourcesUnchanged: jest.fn(),
    };
    const snapshots = { build: jest.fn().mockResolvedValue(snapshot) };
    const templates = { getApproved: jest.fn().mockReturnValue(template) };
    const service = new ContractConsentService(
      true,
      connection as never,
      { findById: contractFind } as never,
      { findById: versionFind, updateOne: versionUpdate } as never,
      ConsentModel as never,
      access as never,
      policy as never,
      preparation as never,
      snapshots as never,
      templates as never,
      { getApproved: () => mechanism } as never,
    );
    return {
      service,
      state,
      connection,
      access,
      policy,
      preparation,
      versionUpdate,
      consentSave,
      consentFind,
      snapshots,
    };
  }

  it.each([ContractConsentAction.Accept, ContractConsentAction.Decline])(
    'records %s once and returns the same retry',
    async (action) => {
      const { service, state, connection, versionUpdate } = setup();
      const first = await service.decide(
        actor,
        contractId.toString(),
        dto(action),
      );
      expect(first.action).toBe(action);
      expect(first.formedAt).toBeNull();
      expect(first.effectiveAt).toBeNull();
      expect(state.version.state).toBe(
        action === ContractConsentAction.Accept
          ? ContractVersionState.Accepted
          : ContractVersionState.Declined,
      );
      expect(versionUpdate).toHaveBeenCalledTimes(1);
      const second = await service.decide(
        actor,
        contractId.toString(),
        dto(action),
      );
      expect(second).toEqual(first);
      expect(connection.startSession).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects opposite decision after decline', async () => {
    const { service } = setup();
    await service.decide(
      actor,
      contractId.toString(),
      dto(ContractConsentAction.Decline),
    );
    await expect(
      service.decide(actor, contractId.toString(), dto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a wrong customer, stale version, and stale fingerprint', async () => {
    const { service, state } = setup();
    await expect(
      service.decide(
        { ...actor, sub: oid().toString() },
        contractId.toString(),
        dto(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    state.version.bookingFingerprint = '0'.repeat(64);
    await expect(
      service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('CONTRACT_CONTENT_CHANGED');
    state.version.bookingFingerprint = bookingFingerprint;
    await expect(
      service.decide(actor, contractId.toString(), {
        ...dto(),
        contractVersionId: oid().toString(),
      }),
    ).rejects.toThrow('CONTRACT_VERSION_STALE');
  });

  it('rejects expiry, revoked provider approval, changed booking and policy', async () => {
    const a = setup();
    a.state.version.expiresAt = new Date(Date.now() - 1000);
    await expect(
      a.service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('CONTRACT_VERSION_EXPIRED');
    const b = setup();
    b.policy.requireAutoAcceptance.mockRejectedValue(
      new ConflictException('REVOKED'),
    );
    await expect(
      b.service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('REVOKED');
    const c = setup();
    c.snapshots.build.mockResolvedValue({
      ...snapshot,
      booking: { changed: true },
    });
    await expect(
      c.service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('BOOKING_FINGERPRINT_STALE');
    const d = setup();
    d.state.acceptance.policyFingerprint = '0'.repeat(64);
    await expect(
      d.service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('PROVIDER_POLICY_ACCEPTANCE_STALE');
  });

  it('rejects a booking whose hold expired and double accept during a transaction', async () => {
    const a = setup();
    a.preparation.assertLiveHold.mockRejectedValue(
      new ConflictException('HOLD_EXPIRED'),
    );
    await expect(
      a.service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('HOLD_EXPIRED');
    const b = setup();
    b.versionUpdate.mockResolvedValue({ modifiedCount: 0 });
    await expect(
      b.service.decide(actor, contractId.toString(), dto()),
    ).rejects.toThrow('CONTRACT_VERSION_STALE');
  });
});

describe('Phase 4 readiness', () => {
  it('reports one missing provider and a second provider awaiting consent', async () => {
    const bookingId = oid();
    const first = oid();
    const second = oid();
    const contractId = oid();
    const versionId = oid();
    const booking = {
      _id: bookingId,
      bookingType: 'COMBO',
      status: 'PENDING_PAYMENT',
      contractFlowVersion: 2,
      customerId: oid(),
    };
    const access = {
      booking: jest.fn().mockResolvedValue(booking),
      assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER' }),
    };
    const contracts = {
      findOne: jest
        .fn()
        .mockImplementation((filter: { providerId: Types.ObjectId }) =>
          lean(
            filter.providerId.equals(first)
              ? { _id: contractId, currentVersionId: versionId }
              : null,
          ),
        ),
    };
    const versions = {
      findById: jest.fn().mockReturnValue(
        lean({
          _id: versionId,
          contractId,
          version: 1,
          state: ContractVersionState.Offered,
        }),
      ),
    };
    const consents = { findOne: jest.fn().mockReturnValue(lean(null)) };
    const service = new ContractReadService(
      true,
      contracts as never,
      versions as never,
      consents as never,
      access as never,
      {
        getContext: jest
          .fn()
          .mockResolvedValue({ rentalProviderIds: [first, second] }),
      } as never,
      { getApproved: jest.fn().mockReturnValue({ version: 'v1' }) } as never,
      {} as never,
      {} as never,
    );
    const result = await service.readiness(
      { sub: booking.customerId.toString() } as never,
      bookingId.toString(),
    );
    expect(result).toMatchObject({
      requirement: 'REQUIRED',
      ready: false,
      providers: [
        { providerId: first.toString(), status: 'AWAITING_CUSTOMER' },
        { providerId: second.toString(), status: 'MISSING_CONTRACT' },
      ],
    });
  });

  it('does not expose document text when the reader fails authorization', async () => {
    const bookingId = oid();
    const providerId = oid();
    const contractId = oid();
    const versionId = oid();
    const contract = {
      _id: contractId,
      bookingId,
      providerId,
      currentVersionId: versionId,
    };
    const access = {
      booking: jest.fn().mockResolvedValue({ _id: bookingId }),
      assertContractReader: jest
        .fn()
        .mockRejectedValue(new NotFoundException('CONTRACT_NOT_FOUND')),
    };
    const versions = {
      findById: jest
        .fn()
        .mockReturnValue(
          lean({ _id: versionId, contractId, renderedText: 'SECRET' }),
        ),
    };
    const service = new ContractReadService(
      true,
      { findById: jest.fn().mockReturnValue(lean(contract)) } as never,
      versions as never,
      {} as never,
      access as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.get({ sub: oid().toString() } as never, contractId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(versions.findById).not.toHaveBeenCalled();
  });

  it('shows an already accepted version despite later provider revocation', async () => {
    const bookingId = oid();
    const providerId = oid();
    const contractId = oid();
    const versionId = oid();
    const customerId = oid();
    const booking = {
      _id: bookingId,
      bookingType: 'AODAI_RENTAL',
      status: 'PENDING_PAYMENT',
      contractFlowVersion: 2,
      customerId,
    };
    const template = { version: 'v1', status: 'APPROVED' };
    const snapshot = {
      booking: {},
      providerItems: [],
      pricing: {},
      policies: {},
    };
    const policy = {
      getContext: jest
        .fn()
        .mockResolvedValue({ booking, rentalProviderIds: [providerId] }),
      requireAutoAcceptance: jest.fn().mockRejectedValue(new Error('revoked')),
    };
    const service = new ContractReadService(
      true,
      {
        findOne: jest
          .fn()
          .mockReturnValue(
            lean({ _id: contractId, currentVersionId: versionId }),
          ),
      } as never,
      {
        findById: jest.fn().mockReturnValue(
          lean({
            _id: versionId,
            contractId,
            version: 1,
            state: ContractVersionState.Accepted,
            providerAcceptanceId: oid(),
            bookingFingerprint: hashContract({
              booking: snapshot.booking,
              providerItems: snapshot.providerItems,
              pricing: snapshot.pricing,
            }),
            contentHash: hashContract({ template, snapshot }),
          }),
        ),
      } as never,
      {
        findOne: jest
          .fn()
          .mockReturnValue(lean({ action: ContractConsentAction.Accept })),
      } as never,
      {
        booking: jest.fn().mockResolvedValue(booking),
        assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER' }),
      } as never,
      policy as never,
      { getApproved: jest.fn().mockReturnValue(template) } as never,
      { build: jest.fn().mockResolvedValue(snapshot) } as never,
      { assertLiveHold: jest.fn() } as never,
    );
    const result = await service.readiness(
      { sub: customerId.toString() } as never,
      bookingId.toString(),
    );
    expect(result).toMatchObject({
      ready: true,
      providers: [{ status: 'ACCEPTED' }],
    });
    expect(policy.requireAutoAcceptance).not.toHaveBeenCalled();
  });
});

describe('Phase 4 hold gate', () => {
  it('rejects a cancelled booking and an expired hold before consent', async () => {
    const preparation = new ContractPreparationService(
      true,
      { db: {} } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const providerId = oid();
    const base = {
      booking: {
        contractFlowVersion: 2,
        status: 'PENDING_PAYMENT',
        holdExpiresAt: new Date(Date.now() + 60000),
      },
      rentalItems: [],
    };
    await expect(
      preparation.assertLiveHold(
        { ...base, booking: { ...base.booking, status: 'CANCELLED' } } as never,
        providerId,
      ),
    ).rejects.toThrow('BOOKING_NOT_PREPARABLE');
    await expect(
      preparation.assertLiveHold(
        {
          ...base,
          booking: {
            ...base.booking,
            holdExpiresAt: new Date(Date.now() - 1000),
          },
        } as never,
        providerId,
      ),
    ).rejects.toThrow('BOOKING_NOT_PREPARABLE');
  });
});

describe('Phase 4 provider approval', () => {
  it('requires the owner and retains the accepted record after revocation', async () => {
    const providerId = oid();
    const userId = oid();
    const currentId = oid();
    const provider = {
      _id: providerId,
      status: 'ACTIVE',
      capabilities: ['AODAI_RENTAL'],
    };
    const current = {
      _id: currentId,
      providerId,
      status: 'ACTIVE',
      mechanismVersion: 'v1',
      templateVersion: 'v1',
    };
    const findOne = jest.fn().mockImplementation(() => ({
      ...lean(current),
      then: (resolve: (value: unknown) => void) => resolve(current),
    }));
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const service = new ProviderContractApprovalService(
      true,
      {} as never,
      { findOne, updateOne } as never,
      { ownProvider: jest.fn().mockResolvedValue(provider) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const user = { sub: userId.toString() } as never;
    expect(await service.status(user)).toMatchObject({
      providerId: providerId.toString(),
      active: { id: currentId.toString() },
    });
    expect(await service.revoke(user)).toMatchObject({ revoked: true });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: currentId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: expect.any(Date) as Date } },
    );
  });
});
