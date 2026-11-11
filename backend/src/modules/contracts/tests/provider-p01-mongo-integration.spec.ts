import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../contract-test-target';
import { ContractAccessService } from '../contract-access.service';
import { ContractPolicyService } from '../contract-policy.service';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractReadService } from '../contract-read.service';
import { ContractCheckoutGuard } from '../contract-checkout-guard.service';
import { ProviderContractApprovalService } from '../provider-contract-approval.service';
import { ContractTemplateService } from '../contract-template';
import { ContractMechanismService, AUTO_ACCEPTANCE_MECHANISM_V2 } from '../contract-mechanism.service';
import { hashContract, canonicalizeContract } from '../canonical-contract';
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
  DigitalContractSchema,
} from '../../bookings/schemas/digital-contract.schema';
import {
  ContractVersion,
  ContractVersionSchema,
  ContractVersionState,
} from '../schemas/contract-version.schema';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentSchema,
} from '../schemas/contract-consent.schema';
import {
  ProviderAcceptanceStatus,
  ProviderContractAcceptance,
  ProviderContractAcceptanceSchema,
} from '../schemas/provider-contract-acceptance.schema';
import { Booking, BookingSchema } from '../../bookings/schemas/booking.schema';
import { PaymentPurpose } from '../../payments/schemas/payment.schema';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)(
  'P0.1 — MongoDB Replica Set Integration Verification (Port 27028)',
  () => {
    jest.setTimeout(45000);

    let connection: Connection;
    let scratchDbName: string;

    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;

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

    const templateService = {
      getDraft: () => approvedTemplate,
      getApproved: () => approvedTemplate,
    } as unknown as ContractTemplateService;

    const mechanismService = {
      getDraft: () => approvedMechanism,
      getApproved: () => approvedMechanism,
    } as unknown as ContractMechanismService;

    beforeAll(async () => {
      scratchDbName = `contract_p01_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchDbName}`;

      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      }).asPromise();

      // Preflight: Ensure connection is to primary replica set rsContractTest
      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
        throw new Error('Integration tests require isolated primary replica set rsContractTest');
      }

      // Initialize models on scratch connection
      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(
        ProviderContractAcceptance.name,
        ProviderContractAcceptanceSchema,
      );

      // Create indexes required for contracts v2
      await connection.db!.collection('digital_contracts').createIndex(
        { bookingId: 1, providerId: 1, scope: 1 },
        { unique: true, name: 'booking_provider_scope_unique' },
      );
      await connection.db!.collection('contract_versions').createIndex(
        { contractId: 1, version: 1 },
        { unique: true },
      );
      await connection.db!.collection('contract_consents').createIndex(
        { contractVersionId: 1, actorUserId: 1 },
        { unique: true },
      );
      await connection.db!.collection('provider_contract_acceptances').createIndex(
        { providerId: 1, scope: 1 },
        { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
      );
    });

    afterAll(async () => {
      if (connection) {
        if (scratchDbName.startsWith('contract_p01_') && scratchDbName.endsWith('_test')) {
          await connection.dropDatabase();
        }
        await connection.close();
      }
    });

    function createValidSnapshot(
      bId: Types.ObjectId,
      cId: Types.ObjectId,
      pId: Types.ObjectId,
      itemIds: Types.ObjectId[],
      policies: Record<string, unknown>,
      overrides: Record<string, any> = {},
    ) {
      return {
        bookingId: bId.toString(),
        customerId: cId.toString(),
        providerId: pId.toString(),
        bookingType: 'AODAI_RENTAL',
        bookingItemIds: itemIds.map((id) => id.toString()),
        booking: { code: 'B-001', note: 'test booking', ...(overrides.booking || {}) },
        customer: { fullName: 'Customer A' },
        provider: { businessName: 'Ao Dai Shop A' },
        providerItems: itemIds.map((id) => ({
          bookingItemId: id.toString(),
          productName: 'Ao Dai Premium',
          size: 'M',
          unitPrice: 150000,
          quantity: 1,
        })),
        pricing: { rentalFee: 150000, depositFee: 100000, total: 250000, ...(overrides.pricing || {}) },
        policies: overrides.policies || policies,
        template: approvedTemplate,
      };
    }

    function buildHarness(options: { contractsV2Enabled?: boolean } = {}) {
      const enabled = options.contractsV2Enabled ?? true;
      const access = new ContractAccessService(connection);
      const policy = new ContractPolicyService(connection, acceptances);

      const snapshotMap = new Map<string, Record<string, unknown>>();
      const snapshotService = {
        build: jest.fn((_ctx: any, providerId: Types.ObjectId) => {
          const snap = snapshotMap.get(providerId.toString());
          if (snap) return Promise.resolve(snap);
          return Promise.resolve(
            createValidSnapshot(oid(), oid(), providerId, [oid()], { rentalPolicy: 'Standard terms' }),
          );
        }),
        currentPoliciesForProvider: jest.fn((providerId: Types.ObjectId) => {
          return connection.db!.collection('providers').findOne({ _id: providerId }).then((p) => p?.policies || {});
        }),
      };

      const prep = new ContractPreparationService(
        enabled,
        connection,
        contracts,
        versions,
        policy,
        snapshotService as any,
        templateService,
      );

      const read = new ContractReadService(
        enabled,
        contracts,
        versions,
        consents,
        access,
        policy,
        templateService,
        snapshotService as any,
        prep,
      );

      const approval = new ProviderContractApprovalService(
        enabled,
        connection,
        acceptances,
        access,
        mechanismService,
        templateService,
        snapshotService as any,
      );

      const guard = new ContractCheckoutGuard(
        enabled,
        contracts,
        versions,
        consents,
        policy,
        snapshotService as any,
        prep,
        templateService,
        mechanismService,
      );

      return {
        access,
        policy,
        prep,
        read,
        approval,
        guard,
        snapshotService,
        snapshotMap,
      };
    }

    async function seedScenario(overrides: {
      providerPolicies?: Record<string, unknown>;
      numProviders?: number;
    } = {}) {
      const customerId = oid();
      const customerUserId = customerId;
      const bookingId = oid();

      const providerUserA = oid();
      const providerAId = oid();
      const policiesA = overrides.providerPolicies ?? {
        rentalPolicy: 'Standard rental policy A',
        cancellationPolicy: 'Standard cancellation policy A',
      };

      await connection.db!.collection('users').insertOne({
        _id: customerUserId,
        roles: ['CUSTOMER'],
        auth: { email: 'customer@vibehue.test' },
      });

      await connection.db!.collection('users').insertOne({
        _id: providerUserA,
        roles: ['PROVIDER'],
        auth: { email: 'providerA@vibehue.test' },
      });

      await connection.db!.collection('providers').insertOne({
        _id: providerAId,
        userId: providerUserA,
        businessName: 'Ao Dai Hue Studio A',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
        policies: policiesA,
      });

      const providerIds = [providerAId];
      let providerUserB: Types.ObjectId | null = null;
      let providerBId: Types.ObjectId | null = null;
      let itemBId: Types.ObjectId | null = null;

      if (overrides.numProviders === 2) {
        providerUserB = oid();
        providerBId = oid();

        await connection.db!.collection('users').insertOne({
          _id: providerUserB,
          roles: ['PROVIDER'],
          auth: { email: 'providerB@vibehue.test' },
        });

        await connection.db!.collection('providers').insertOne({
          _id: providerBId,
          userId: providerUserB,
          businessName: 'Ao Dai Studio B',
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
          policies: { rentalPolicy: 'Terms B' },
        });
        providerIds.push(providerBId);
      }

      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `B-${oid().toHexString().slice(0, 8).toUpperCase()}`,
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
        customerId,
        providerIds,
        holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        pricingSummary: { discountAmount: 0 },
        updatedAt: new Date(),
      });

      const itemAId = oid();
      await connection.db!.collection('booking_items').insertOne({
        _id: itemAId,
        bookingId,
        providerId: providerAId,
        itemType: 'PRODUCT',
        productId: oid(),
        priceVersionId: oid(),
        unitPrice: 150000,
        depositAmount: 100000,
        quantity: 1,
        selectedSize: 'M',
        rentalFrom: new Date('2026-11-10'),
        rentalTo: new Date('2026-11-12'),
        pickupReturnLocationSnapshot: { address: '123 Hue St' },
        updatedAt: new Date(),
      });

      await connection.db!.collection('inventory_reservations').insertOne({
        _id: oid(),
        bookingId,
        bookingItemId: itemAId,
        status: 'TEMP_RESERVED',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      if (providerBId) {
        itemBId = oid();
        await connection.db!.collection('booking_items').insertOne({
          _id: itemBId,
          bookingId,
          providerId: providerBId,
          itemType: 'PRODUCT',
          productId: oid(),
          priceVersionId: oid(),
          unitPrice: 200000,
          depositAmount: 150000,
          quantity: 1,
          selectedSize: 'L',
          rentalFrom: new Date('2026-11-10'),
          rentalTo: new Date('2026-11-12'),
          pickupReturnLocationSnapshot: { address: '456 Hue St' },
          updatedAt: new Date(),
        });

        await connection.db!.collection('inventory_reservations').insertOne({
          _id: oid(),
          bookingId,
          bookingItemId: itemBId,
          status: 'TEMP_RESERVED',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        });
      }

      return {
        customerId,
        customerUserId,
        bookingId,
        providerAId,
        providerUserA,
        itemAId,
        providerBId,
        providerUserB,
        itemBId,
        policiesA,
      };
    }

    // --- TEST SCENARIO 1 & 2 ---
    it('1 & 2. Provider lacks acceptance -> readiness fail-closed and NO ACTIVE record is created in MongoDB', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();
      const customerUser = {
        sub: seed.customerUserId.toString(),
        roles: ['CUSTOMER'],
        permissions: [],
        email: '',
        sessionId: '',
      };

      // 1. Calling readiness when provider has not accepted
      const readiness = await harness.read.readiness(customerUser, seed.bookingId.toString());

      expect(readiness.providers[0].status).toBe('PROVIDER_ACCEPTANCE_MISSING');
      expect(readiness.blockers).toContain('PROVIDER_AUTO_ACCEPTANCE_MISSING');

      // 2. CRITICAL AUDIT: In real MongoDB, collection provider_contract_acceptances MUST REMAIN EMPTY!
      const countInDb = await connection.db!.collection('provider_contract_acceptances').countDocuments({
        providerId: seed.providerAId,
      });
      expect(countInDb).toBe(0);
    });

    // --- TEST SCENARIO 3 ---
    it('3. Provider has valid acceptance via authenticated consent path -> prepare succeeds in MongoDB', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();
      const providerUser = {
        sub: seed.providerUserA.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: '',
        sessionId: '',
      };

      // Authenticated acceptance call by actual shop owner
      const acceptResult = await harness.approval.accept(providerUser, approvedMechanism.hash);
      expect(acceptResult.acceptanceId).toBeDefined();

      // Verify active acceptance document in MongoDB
      const acceptanceDoc = await connection.db!.collection('provider_contract_acceptances').findOne({
        _id: new Types.ObjectId(acceptResult.acceptanceId),
      });
      expect(acceptanceDoc).toBeDefined();
      expect(acceptanceDoc.status).toBe('ACTIVE');
      expect(acceptanceDoc.acceptedByUserId.toString()).toBe(seed.providerUserA.toString());
      expect(acceptanceDoc.policyFingerprint).toBe(hashContract(seed.policiesA));

      // Customer prepares contract
      const snapshot = createValidSnapshot(
        seed.bookingId,
        seed.customerId,
        seed.providerAId,
        [seed.itemAId],
        seed.policiesA,
      );
      harness.snapshotMap.set(seed.providerAId.toString(), snapshot);

      const prepareResult = await harness.prep.prepare(seed.bookingId.toString(), seed.providerAId.toString());
      expect(prepareResult.version).toBe(1);
      expect(prepareResult.reused).toBe(false);

      // Verify contract version in MongoDB
      const versionDoc = await connection.db!.collection('contract_versions').findOne({
        _id: new Types.ObjectId(prepareResult.versionId),
      });
      expect(versionDoc.state).toBe(ContractVersionState.Offered);
      expect(versionDoc.providerAcceptanceId.toString()).toBe(acceptResult.acceptanceId);
    });

    // --- TEST SCENARIO 4 ---
    it('4. Policy fingerprint changed -> system returns stale, does not update old record in MongoDB', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();
      const providerUser = {
        sub: seed.providerUserA.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: '',
        sessionId: '',
      };

      // Provider accepts initial policy
      const acceptResult = await harness.approval.accept(providerUser, approvedMechanism.hash);
      const initialFingerprint = hashContract(seed.policiesA);

      // Shop silently alters rental policies in MongoDB
      const mutatedPolicies = {
        ...seed.policiesA,
        lateFeePolicy: 'Surprise high late fee 500k',
      };
      await connection.db!.collection('providers').updateOne(
        { _id: seed.providerAId },
        { $set: { policies: mutatedPolicies } },
      );

      const newSnapshot = createValidSnapshot(
        seed.bookingId,
        seed.customerId,
        seed.providerAId,
        [seed.itemAId],
        mutatedPolicies,
      );
      harness.snapshotMap.set(seed.providerAId.toString(), newSnapshot);

      // Prepare must fail closed with PROVIDER_POLICY_ACCEPTANCE_STALE!
      await expect(
        harness.prep.prepare(seed.bookingId.toString(), seed.providerAId.toString()),
      ).rejects.toThrow('PROVIDER_POLICY_ACCEPTANCE_STALE');

      // CRITICAL AUDIT: MongoDB acceptance record MUST NOT be silently updated!
      const currentAcceptance = await connection.db!.collection('provider_contract_acceptances').findOne({
        _id: new Types.ObjectId(acceptResult.acceptanceId),
      });
      expect(currentAcceptance.policyFingerprint).toBe(initialFingerprint);
      expect(currentAcceptance.policyFingerprint).not.toBe(hashContract(mutatedPolicies));
    });

    // --- TEST SCENARIO 5 ---
    it('5. Revoke -> blocks new bookings according to rules', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();
      const providerUser = {
        sub: seed.providerUserA.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: '',
        sessionId: '',
      };

      await harness.approval.accept(providerUser, approvedMechanism.hash);

      // Shop revokes consent
      const revokeRes = await harness.approval.revoke(providerUser);
      expect(revokeRes.revoked).toBe(true);

      const acceptanceInDb = await connection.db!.collection('provider_contract_acceptances').findOne({
        providerId: seed.providerAId,
      });
      expect(acceptanceInDb.status).toBe(ProviderAcceptanceStatus.Revoked);
      expect(acceptanceInDb.revokedAt).toBeDefined();

      // Subsequent prepare attempt must fail closed!
      await expect(
        harness.prep.prepare(seed.bookingId.toString(), seed.providerAId.toString()),
      ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');
    });

    // --- TEST SCENARIO 6 ---
    it('6. Other provider cannot accept on behalf of a shop', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();

      const imposterUserId = oid();
      await connection.db!.collection('users').insertOne({
        _id: imposterUserId,
        roles: ['PROVIDER'],
        auth: { email: 'imposter@vibehue.test' },
      });

      const imposterUser = {
        sub: imposterUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: '',
        sessionId: '',
      };

      await expect(
        harness.approval.accept(imposterUser, approvedMechanism.hash),
      ).rejects.toThrow('PROVIDER_NOT_FOUND');

      const count = await connection.db!.collection('provider_contract_acceptances').countDocuments({
        acceptedByUserId: imposterUserId,
      });
      expect(count).toBe(0);
    });

    // --- TEST SCENARIO 7 ---
    it('7. Concurrent requests do not produce duplicate ACTIVE records in MongoDB', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();
      const providerUser = {
        sub: seed.providerUserA.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: '',
        sessionId: '',
      };

      // Execute 5 concurrent accept calls simultaneously
      const results = await Promise.all([
        harness.approval.accept(providerUser, approvedMechanism.hash),
        harness.approval.accept(providerUser, approvedMechanism.hash),
        harness.approval.accept(providerUser, approvedMechanism.hash),
        harness.approval.accept(providerUser, approvedMechanism.hash),
        harness.approval.accept(providerUser, approvedMechanism.hash),
      ]);

      expect(results).toHaveLength(5);

      // Unique partial index on MongoDB ensures exactly 1 ACTIVE record exists!
      const activeCount = await connection.db!.collection('provider_contract_acceptances').countDocuments({
        providerId: seed.providerAId,
        status: ProviderAcceptanceStatus.Active,
      });
      expect(activeCount).toBe(1);
    });

    // --- TEST SCENARIO 8 ---
    it('8. Multi-provider with 1 shop lacking acceptance -> blocks checkout in MongoDB', async () => {
      const seed = await seedScenario({ numProviders: 2 });
      const harness = buildHarness();

      // Provider A accepts
      await harness.approval.accept(
        { sub: seed.providerUserA.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' },
        approvedMechanism.hash,
      );

      // Provider B does NOT accept!
      const snapshotA = createValidSnapshot(
        seed.bookingId,
        seed.customerId,
        seed.providerAId,
        [seed.itemAId],
        seed.policiesA,
      );
      harness.snapshotMap.set(seed.providerAId.toString(), snapshotA);

      // Prepare contract for A and customer accepts A
      const prepA = await harness.prep.prepare(seed.bookingId.toString(), seed.providerAId.toString());
      const contractA = await connection.db!.collection('digital_contracts').findOne({
        _id: new Types.ObjectId(prepA.contractId),
      });
      const versionA = await connection.db!.collection('contract_versions').findOne({
        _id: new Types.ObjectId(prepA.versionId),
      });

      await connection.db!.collection('contract_versions').updateOne(
        { _id: versionA._id },
        { $set: { state: ContractVersionState.Accepted } },
      );

      await connection.db!.collection('contract_consents').insertOne({
        _id: oid(),
        contractId: contractA._id,
        contractVersionId: versionA._id,
        actorUserId: seed.customerId,
        action: ContractConsentAction.Accept,
        contentHash: versionA.contentHash,
        bookingFingerprint: versionA.bookingFingerprint,
        idempotencyKey: 'consent-key-1',
        createdAt: new Date(),
      });

      // Provider B has no contract / no acceptance -> guard.evaluate MUST fail closed!
      await expect(
        harness.guard.evaluate(seed.bookingId.toString(), 350000, PaymentPurpose.RentalInitial),
      ).rejects.toThrow();
    });

    // --- TEST SCENARIO 9 ---
    it('9. Feature flag OFF -> legacy booking is not affected', async () => {
      const seed = await seedScenario();
      const harnessOff = buildHarness({ contractsV2Enabled: false });

      // Change booking to legacy flow
      await connection.db!.collection('bookings').updateOne(
        { _id: seed.bookingId },
        { $set: { contractFlowVersion: 1 } },
      );

      const decision = await harnessOff.guard.evaluate(seed.bookingId.toString(), 150000, PaymentPurpose.RentalInitial);
      expect(decision).toEqual({ binding: null, context: null });
    });

    // --- TEST SCENARIO 10 ---
    it('10. ContractVersion ACCEPTED preserves snapshot and contentHash in MongoDB', async () => {
      const seed = await seedScenario();
      const harness = buildHarness();

      // Provider accepts
      await harness.approval.accept(
        { sub: seed.providerUserA.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' },
        approvedMechanism.hash,
      );

      const initialSnapshot = createValidSnapshot(
        seed.bookingId,
        seed.customerId,
        seed.providerAId,
        [seed.itemAId],
        seed.policiesA,
        { pricing: { total: 200000 } },
      );
      harness.snapshotMap.set(seed.providerAId.toString(), initialSnapshot);

      const prep1 = await harness.prep.prepare(seed.bookingId.toString(), seed.providerAId.toString());
      expect(prep1.version).toBe(1);

      // Customer accepts Version 1
      await connection.db!.collection('contract_versions').updateOne(
        { _id: new Types.ObjectId(prep1.versionId) },
        { $set: { state: ContractVersionState.Accepted } },
      );

      const v1Before = await connection.db!.collection('contract_versions').findOne({
        _id: new Types.ObjectId(prep1.versionId),
      });

      // Booking details update
      const updatedSnapshot = createValidSnapshot(
        seed.bookingId,
        seed.customerId,
        seed.providerAId,
        [seed.itemAId],
        seed.policiesA,
        { pricing: { total: 220000 } },
      );
      harness.snapshotMap.set(seed.providerAId.toString(), updatedSnapshot);

      const prep2 = await harness.prep.prepare(seed.bookingId.toString(), seed.providerAId.toString());
      expect(prep2.version).toBe(2);

      // CRITICAL IMMUTABILITY AUDIT ON REAL MONGODB:
      const v1After = await connection.db!.collection('contract_versions').findOne({
        _id: new Types.ObjectId(prep1.versionId),
      });

      expect(v1After.state).toBe(ContractVersionState.Accepted);
      expect(v1After.contentHash).toBe(v1Before.contentHash);
      expect(v1After.bookingFingerprint).toBe(v1Before.bookingFingerprint);
      expect(v1After.renderedText).toBe(v1Before.renderedText);
      expect(v1After.snapshot.pricing.total).toBe(200000); // Unmutated!
    });
  },
);
