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
import {
  ContractMechanismService,
  AUTO_ACCEPTANCE_MECHANISM_V1,
  SYNTHETIC_TEST_MECHANISM_V2,
} from '../contract-mechanism.service';
import { hashContract } from '../canonical-contract';
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

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)(
  'P1A — Provider Self-Acceptance Integration Suite (Port 27028)',
  () => {
    jest.setTimeout(30000);

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
      scope: 'AO_DAI_RENTAL' as const,
      templateText: 'Hop dong ao dai V2 chuan...',
    };

    const syntheticApprovedMechanism = {
      ...SYNTHETIC_TEST_MECHANISM_V2,
      hash: hashContract(SYNTHETIC_TEST_MECHANISM_V2),
    };

    beforeAll(async () => {
      scratchDbName = `contract_p1a_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchDbName}`;

      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      }).asPromise();

      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(
        ProviderContractAcceptance.name,
        ProviderContractAcceptanceSchema,
      );

      // Unique partial index for active acceptance
      await acceptances.collection.createIndex(
        { providerId: 1, scope: 1 },
        { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
      );
    });

    afterAll(async () => {
      if (connection) {
        try {
          await connection.dropDatabase();
        } catch {}
        await connection.close();
      }
    });

    async function seedFixtures() {
      const providerUserId = oid();
      const providerId = oid();
      const customerUserId = oid();
      const bookingId = oid();
      const productId = oid();
      const bookingItemId = oid();

      await connection.collection('users').insertOne({
        _id: customerUserId,
        profile: { fullName: 'Nguyen Van Khach' },
        auth: { email: 'khach@vibehue.test' },
      });

      await connection.collection('providers').insertOne({
        _id: providerId,
        userId: providerUserId,
        businessName: 'Tiem Ao Dai Hue Xua',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
        policies: {
          rentalPolicy: 'Bao quan trang phuc can than.',
          cancellationPolicy: 'Huy truoc 48h hoan 100%.',
        },
        updatedAt: new Date('2026-10-31T00:00:00.000Z'),
      });

      const now = new Date();
      await connection.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `BK_${oid().toHexString().slice(0, 8)}`,
        customerId: customerUserId,
        bookingType: 'AODAI_RENTAL',
        providerIds: [providerId],
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
        holdExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        pricingSummary: {
          subTotal: 300000,
          grandTotal: 300000,
          amountDueNow: 300000,
        },
        createdAt: now,
      });

      await connection.collection('booking_items').insertOne({
        _id: bookingItemId,
        bookingId,
        providerId,
        productId,
        itemType: 'PRODUCT',
        rentalFrom: new Date(now.getTime() + 86400000),
        rentalTo: new Date(now.getTime() + 172800000),
        unitPrice: 300000,
        quantity: 1,
        depositAmount: 500000,
      });

      await connection.collection('products').insertOne({
        _id: productId,
        providerId,
        name: 'Ao Dai Nhat Binh Hue',
        slug: 'ao-dai-nhat-binh-hue',
      });

      return {
        providerUserId,
        providerId,
        customerUserId,
        bookingId,
      };
    }

    it('1 & 2. In DRAFT mechanism: Provider cannot accept -> throws CONTRACT_MECHANISM_NOT_APPROVED', async () => {
      const fixtures = await seedFixtures();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: fixtures.providerId,
          userId: fixtures.providerUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const draftMechanismService = new ContractMechanismService();

      const approvalService = new ProviderContractApprovalService(
        true,
        connection,
        acceptances,
        accessService,
        draftMechanismService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        {
          currentPoliciesForProvider: jest.fn().mockResolvedValue({
            rentalPolicy: 'Bao quan trang phuc can than.',
          }),
        } as unknown as ContractSnapshotService,
      );

      const providerUser = {
        sub: fixtures.providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'provider@test.com',
        sessionId: 'sess_1',
      };

      // Status shows NOT_ACCEPTED
      const statusRes = await approvalService.status(providerUser);
      expect(statusRes.status).toBe('NOT_ACCEPTED');
      expect(statusRes.active).toBeNull();

      // Accept attempt is rejected with 422
      await expect(
        approvalService.accept(providerUser, draftMechanismService.getDraft().hash),
      ).rejects.toThrow(new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED'));
    });

    it('3, 4, 5 & 6. With APPROVED mechanism fixture: Provider accepts -> records ACTIVE with policyFingerprint and returns status ACTIVE', async () => {
      const fixtures = await seedFixtures();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: fixtures.providerId,
          userId: fixtures.providerUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const approvedMechanismService = {
        getDraft: () => syntheticApprovedMechanism,
        getApproved: () => syntheticApprovedMechanism,
      } as unknown as ContractMechanismService;

      const policySnapshot = {
        rentalPolicy: 'Bao quan trang phuc can than.',
        cancellationPolicy: 'Huy truoc 48h hoan 100%.',
      };
      const expectedFingerprint = hashContract(policySnapshot);

      const snapshotService = {
        currentPoliciesForProvider: jest.fn().mockResolvedValue(policySnapshot),
      } as unknown as ContractSnapshotService;

      const approvalService = new ProviderContractApprovalService(
        true,
        connection,
        acceptances,
        accessService,
        approvedMechanismService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        snapshotService,
      );

      const providerUser = {
        sub: fixtures.providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'provider@test.com',
        sessionId: 'sess_1',
      };

      // Provider accepts with exact hash
      const acceptResult = await approvalService.accept(
        providerUser,
        syntheticApprovedMechanism.hash,
      );
      expect(acceptResult.acceptanceId).toBeDefined();
      expect(acceptResult.reused).toBe(false);

      // Verify in MongoDB
      const doc = await acceptances.findById(acceptResult.acceptanceId).lean();
      expect(doc).toBeDefined();
      expect(doc?.status).toBe(ProviderAcceptanceStatus.Active);
      expect(doc?.providerId.toString()).toBe(fixtures.providerId.toString());
      expect(doc?.mechanismHash).toBe(syntheticApprovedMechanism.hash);
      expect(doc?.policyFingerprint).toBe(expectedFingerprint);

      // Query status -> returns ACTIVE
      const statusAfter = await approvalService.status(providerUser);
      expect(statusAfter.status).toBe('ACTIVE');
      expect(statusAfter.isStale).toBe(false);
      expect(statusAfter.active).toBeDefined();
      expect(statusAfter.active?.mechanismVersion).toBe(syntheticApprovedMechanism.version);
    });

    it('7 & 8. Provider changes shop policies -> status reflects STALE and readiness detects stale acceptance', async () => {
      const fixtures = await seedFixtures();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: fixtures.providerId,
          userId: fixtures.providerUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const approvedMechanismService = {
        getDraft: () => syntheticApprovedMechanism,
        getApproved: () => syntheticApprovedMechanism,
      } as unknown as ContractMechanismService;

      const initialPolicy = { rentalPolicy: 'Chinh sach goc' };
      const updatedPolicy = { rentalPolicy: 'Chinh sach moi da cap nhat gia' };

      let currentPolicy = initialPolicy;
      const snapshotService = {
        currentPoliciesForProvider: jest.fn().mockImplementation(() => Promise.resolve(currentPolicy)),
      } as unknown as ContractSnapshotService;

      const approvalService = new ProviderContractApprovalService(
        true,
        connection,
        acceptances,
        accessService,
        approvedMechanismService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        snapshotService,
      );

      const providerUser = {
        sub: fixtures.providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'provider@test.com',
        sessionId: 'sess_1',
      };

      // Accept with initial policy
      await approvalService.accept(providerUser, syntheticApprovedMechanism.hash);

      // Provider changes policy
      currentPolicy = updatedPolicy;

      // Status should now be STALE
      const statusRes = await approvalService.status(providerUser);
      expect(statusRes.status).toBe('STALE');
      expect(statusRes.isStale).toBe(true);
      expect(statusRes.staleReason).toBe('POLICY_CHANGED');
    });

    it('9 & 10. Provider revokes acceptance -> status updates to REVOKED, and booking readiness fails closed', async () => {
      const fixtures = await seedFixtures();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({
          _id: fixtures.providerId,
          userId: fixtures.providerUserId,
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        }),
      } as unknown as ContractAccessService;

      const approvedMechanismService = {
        getDraft: () => syntheticApprovedMechanism,
        getApproved: () => syntheticApprovedMechanism,
      } as unknown as ContractMechanismService;

      const snapshotService = {
        currentPoliciesForProvider: jest.fn().mockResolvedValue({ rentalPolicy: 'Chinh sach shop' }),
      } as unknown as ContractSnapshotService;

      const approvalService = new ProviderContractApprovalService(
        true,
        connection,
        acceptances,
        accessService,
        approvedMechanismService,
        { getApproved: () => approvedTemplate } as unknown as ContractTemplateService,
        snapshotService,
      );

      const providerUser = {
        sub: fixtures.providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'provider@test.com',
        sessionId: 'sess_1',
      };

      // 1. Accept first
      await approvalService.accept(providerUser, syntheticApprovedMechanism.hash);

      // 2. Revoke
      const revokeRes = await approvalService.revoke(providerUser);
      expect(revokeRes.revoked).toBe(true);

      // 3. Verify in MongoDB
      const doc = await acceptances.findOne({ providerId: fixtures.providerId }).lean();
      expect(doc?.status).toBe(ProviderAcceptanceStatus.Revoked);
      expect(doc?.revokedAt).toBeDefined();

      // 4. Status reflects REVOKED
      const statusRes = await approvalService.status(providerUser);
      expect(statusRes.status).toBe('REVOKED');
      expect(statusRes.active).toBeNull();
      expect(statusRes.revoked).toBeDefined();

      // 5. Customer readiness fails closed
      const policyService = new ContractPolicyService(connection, acceptances);
      await expect(
        policyService.requireAutoAcceptance(fixtures.providerId, approvedTemplate.version),
      ).rejects.toThrow(new UnprocessableEntityException('PROVIDER_AUTO_ACCEPTANCE_MISSING'));
    });
  },
);
