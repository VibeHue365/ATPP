import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { createConnection, Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
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
  AutoAcceptanceMechanism,
} from '../contract-mechanism.service';
import { ContractsController } from '../contracts.controller';
import { ContractsModule } from '../contracts.module';
import { AppModule } from '../../../app.module';
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
import { JwtStrategy } from '../../../common/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CONTRACTS_V2_ENABLED } from '../contracts.constants';
import { PaymentPurpose } from '../../payments/schemas/payment.schema';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();
const jwtSecret = 'p02-test-secret-key-32-chars-minimum-safe';

(target ? describe : describe.skip)(
  'P0.2 — Mechanism Approval Authenticity & Full Runtime Verification',
  () => {
    jest.setTimeout(45000);

    let connection: Connection;
    let scratchDbName: string;

    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;

    const syntheticApprovedTemplate = {
      version: 'ao-dai-rental-v2',
      status: 'APPROVED' as const,
      approvedAt: '2026-10-31T00:00:00.000Z',
      title: 'HỢP ĐỒNG ĐIỆN TỬ THUÊ TRANG PHỤC ÁO DÀI',
      sections: [],
    };

    const syntheticApprovedMechanism = {
      ...SYNTHETIC_TEST_MECHANISM_V2,
      hash: hashContract(SYNTHETIC_TEST_MECHANISM_V2),
    };

    beforeAll(async () => {
      scratchDbName = `contract_p02_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchDbName}`;

      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      }).asPromise();

      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
        throw new Error('P0.2 tests require primary replica set rsContractTest');
      }

      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(ProviderContractAcceptance.name, ProviderContractAcceptanceSchema);

      await connection.db!.collection('digital_contracts').createIndex(
        { bookingId: 1, providerId: 1, scope: 1 },
        { unique: true },
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
        if (scratchDbName.startsWith('contract_p02_') && scratchDbName.endsWith('_test')) {
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
    ) {
      return {
        bookingId: bId.toString(),
        customerId: cId.toString(),
        providerId: pId.toString(),
        bookingType: 'AODAI_RENTAL',
        bookingItemIds: itemIds.map((id) => id.toString()),
        booking: { code: 'B-001' },
        customer: { fullName: 'Customer A' },
        provider: { businessName: 'Shop A' },
        providerItems: itemIds.map((id) => ({
          bookingItemId: id.toString(),
          productName: 'Ao Dai',
          size: 'M',
        })),
        pricing: { total: 200000 },
        policies,
        template: syntheticApprovedTemplate,
      };
    }

    async function seedShopAndBooking(policies: Record<string, unknown> = { terms: 'Standard' }) {
      const providerUserId = oid();
      const providerId = oid();
      const customerId = oid();
      const bookingId = oid();
      const itemId = oid();

      await connection.db!.collection('users').insertOne({
        _id: providerUserId,
        roles: ['PROVIDER'],
        auth: { email: 'shopowner@vibehue.test' },
      });

      await connection.db!.collection('providers').insertOne({
        _id: providerId,
        userId: providerUserId,
        businessName: 'Ao Dai Hue Studio',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
        policies,
      });

      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: 'B-P02-001',
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
        customerId,
        providerIds: [providerId],
        holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        pricingSummary: { discountAmount: 0 },
        updatedAt: new Date(),
      });

      await connection.db!.collection('booking_items').insertOne({
        _id: itemId,
        bookingId,
        providerId,
        itemType: 'PRODUCT',
        productId: oid(),
        quantity: 1,
        rentalFrom: new Date('2026-11-10'),
        rentalTo: new Date('2026-11-12'),
        pickupReturnLocationSnapshot: { address: 'Hue' },
        updatedAt: new Date(),
      });

      await connection.db!.collection('inventory_reservations').insertOne({
        _id: oid(),
        bookingId,
        bookingItemId: itemId,
        status: 'TEMP_RESERVED',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      return { providerUserId, providerId, customerId, bookingId, itemId, policies };
    }

    describe('P0.2 Section 5 — 10 Mandatory MongoDB Integration Tests', () => {
      it('1. Flag OFF, mechanism DRAFT -> không có acceptance (fail-closed)', async () => {
        const seed = await seedShopAndBooking();
        const access = new ContractAccessService(connection);
        const policy = new ContractPolicyService(connection, acceptances);
        const realDraftMechanismService = new ContractMechanismService(); // Pure service, DRAFT mechanism

        const approval = new ProviderContractApprovalService(
          false, // Flag OFF
          connection,
          acceptances,
          access,
          realDraftMechanismService,
          { getApproved: () => syntheticApprovedTemplate } as any,
          { currentPoliciesForProvider: () => Promise.resolve(seed.policies) } as any,
        );

        const user = { sub: seed.providerUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
        await expect(approval.accept(user, 'any-hash')).rejects.toThrow('CONTRACTS_V2_DISABLED');

        const inDb = await connection.db!.collection('provider_contract_acceptances').countDocuments();
        expect(inDb).toBe(0);
      });

      it('2. Flag ON, mechanism DRAFT -> vẫn không có acceptance (fails closed with CONTRACT_MECHANISM_NOT_APPROVED)', async () => {
        const seed = await seedShopAndBooking();
        const access = new ContractAccessService(connection);
        const realDraftMechanismService = new ContractMechanismService(); // Flag is ON in env, but mechanism is DRAFT!

        const approval = new ProviderContractApprovalService(
          true, // Flag ON!
          connection,
          acceptances,
          access,
          realDraftMechanismService,
          { getApproved: () => syntheticApprovedTemplate } as any,
          { currentPoliciesForProvider: () => Promise.resolve(seed.policies) } as any,
        );

        const user = { sub: seed.providerUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };

        // CRITICAL P0.2 ASSERTION: Feature flag ON does NOT bypass DRAFT status!
        await expect(approval.accept(user, 'some-hash')).rejects.toThrow('CONTRACT_MECHANISM_NOT_APPROVED');

        const inDb = await connection.db!.collection('provider_contract_acceptances').countDocuments({
          providerId: seed.providerId,
        });
        expect(inDb).toBe(0);
      });

      it('3. Flag ON, thiếu approval -> fail-closed tại ContractCheckoutGuard', async () => {
        const seed = await seedShopAndBooking();
        const policy = new ContractPolicyService(connection, acceptances);
        const realDraftMechanismService = new ContractMechanismService();

        const guard = new ContractCheckoutGuard(
          true,
          contracts,
          versions,
          consents,
          policy,
          {} as any,
          {} as any,
          { getApproved: () => syntheticApprovedTemplate } as any,
          realDraftMechanismService, // DRAFT mechanism in runtime!
        );

        await expect(
          guard.evaluate(seed.bookingId.toString(), 200000, PaymentPurpose.RentalInitial),
        ).rejects.toThrow('CONTRACT_MECHANISM_NOT_APPROVED');
      });

      it('4. Mechanism hash stale -> HTTP 409 Conflict', async () => {
        const seed = await seedShopAndBooking();
        const access = new ContractAccessService(connection);
        const isolatedFixtureMechanismService = {
          getApproved: () => syntheticApprovedMechanism,
        } as unknown as ContractMechanismService;

        const approval = new ProviderContractApprovalService(
          true,
          connection,
          acceptances,
          access,
          isolatedFixtureMechanismService,
          { getApproved: () => syntheticApprovedTemplate } as any,
          { currentPoliciesForProvider: () => Promise.resolve(seed.policies) } as any,
        );

        const user = { sub: seed.providerUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
        await expect(
          approval.accept(user, 'outdated_hash_000000000000000000000000000000000000000000000000000000'),
        ).rejects.toThrow(new ConflictException('CONTRACT_MECHANISM_CHANGED'));
      });

      it('5. Provider không sở hữu shop -> bị chặn (PROVIDER_NOT_FOUND)', async () => {
        const seed = await seedShopAndBooking();
        const access = new ContractAccessService(connection);
        const isolatedFixtureMechanismService = {
          getApproved: () => syntheticApprovedMechanism,
        } as unknown as ContractMechanismService;

        const approval = new ProviderContractApprovalService(
          true,
          connection,
          acceptances,
          access,
          isolatedFixtureMechanismService,
          { getApproved: () => syntheticApprovedTemplate } as any,
          { currentPoliciesForProvider: () => Promise.resolve(seed.policies) } as any,
        );

        const imposterUser = { sub: oid().toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
        await expect(approval.accept(imposterUser, syntheticApprovedMechanism.hash)).rejects.toThrow('PROVIDER_NOT_FOUND');
      });

      it('6. Approval fixture hợp lệ trong isolated test -> Provider chủ động ACCEPT thành công', async () => {
        const seed = await seedShopAndBooking();
        const access = new ContractAccessService(connection);
        const isolatedFixtureMechanismService = {
          getApproved: () => syntheticApprovedMechanism,
        } as unknown as ContractMechanismService;

        const approval = new ProviderContractApprovalService(
          true,
          connection,
          acceptances,
          access,
          isolatedFixtureMechanismService,
          { getApproved: () => syntheticApprovedTemplate } as any,
          { currentPoliciesForProvider: () => Promise.resolve(seed.policies) } as any,
        );

        const user = { sub: seed.providerUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
        const result = await approval.accept(user, syntheticApprovedMechanism.hash);
        expect(result.acceptanceId).toBeDefined();

        const doc = await connection.db!.collection('provider_contract_acceptances').findOne({
          _id: new Types.ObjectId(result.acceptanceId),
        });
        expect(doc.status).toBe('ACTIVE');
        expect(doc.mechanismHash).toBe(syntheticApprovedMechanism.hash);
      });

      it('7. Revoke -> ngăn áp dụng cho booking mới', async () => {
        const seed = await seedShopAndBooking();
        const access = new ContractAccessService(connection);
        const policy = new ContractPolicyService(connection, acceptances);
        const isolatedFixtureMechanismService = {
          getApproved: () => syntheticApprovedMechanism,
        } as unknown as ContractMechanismService;

        const approval = new ProviderContractApprovalService(
          true,
          connection,
          acceptances,
          access,
          isolatedFixtureMechanismService,
          { getApproved: () => syntheticApprovedTemplate } as any,
          { currentPoliciesForProvider: () => Promise.resolve(seed.policies) } as any,
        );

        const user = { sub: seed.providerUserId.toString(), roles: ['PROVIDER'], permissions: [], email: '', sessionId: '' };
        await approval.accept(user, syntheticApprovedMechanism.hash);

        // Shop revokes
        const rev = await approval.revoke(user);
        expect(rev.revoked).toBe(true);

        const prep = new ContractPreparationService(
          true,
          connection,
          contracts,
          versions,
          policy,
          { build: () => Promise.resolve(createValidSnapshot(seed.bookingId, seed.customerId, seed.providerId, [seed.itemId], seed.policies)) } as any,
          { getApproved: () => syntheticApprovedTemplate } as any,
        );

        await expect(
          prep.prepare(seed.bookingId.toString(), seed.providerId.toString()),
        ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');
      });

      it('8. Mechanism version thay đổi -> yêu cầu re-acceptance (PROVIDER_ACCEPTANCE_STALE)', async () => {
        const seed = await seedShopAndBooking();
        const policy = new ContractPolicyService(connection, acceptances);

        // Seed an active acceptance with old mechanism version v1
        const activeAcceptanceId = oid();
        await connection.db!.collection('provider_contract_acceptances').insertOne({
          _id: activeAcceptanceId,
          providerId: seed.providerId,
          acceptedByUserId: seed.providerUserId,
          scope: ContractScope.AoDaiRental,
          mechanismVersion: 'old-version-v1',
          mechanismHash: 'old_hash_'.padEnd(64, '0'),
          policyFingerprint: hashContract(seed.policies),
          templateVersion: syntheticApprovedTemplate.version,
          status: ProviderAcceptanceStatus.Active,
          acceptedAt: new Date(),
        });

        const contractId = oid();
        const versionId = oid();
        const snap = createValidSnapshot(seed.bookingId, seed.customerId, seed.providerId, [seed.itemId], seed.policies);
        const contentHash = hashContract({ template: syntheticApprovedTemplate, snapshot: snap });
        const bookingFingerprint = hashContract({ booking: snap.booking, providerItems: snap.providerItems, pricing: snap.pricing });

        await connection.db!.collection('digital_contracts').insertOne({
          _id: contractId,
          bookingId: seed.bookingId,
          customerId: seed.customerId,
          providerId: seed.providerId,
          flowVersion: 2,
          scope: ContractScope.AoDaiRental,
          approvalMode: ContractApprovalMode.AutoAcceptance,
          currentVersionId: versionId,
        });

        await connection.db!.collection('contract_versions').insertOne({
          _id: versionId,
          contractId,
          state: ContractVersionState.Accepted,
          templateVersion: syntheticApprovedTemplate.version,
          providerAcceptanceId: activeAcceptanceId,
          renderedText: 'terms',
          contentHash,
          bookingFingerprint,
          snapshot: snap,
        });

        await connection.db!.collection('contract_consents').insertOne({
          _id: oid(),
          contractId,
          contractVersionId: versionId,
          actorUserId: seed.customerId,
          action: ContractConsentAction.Accept,
          contentHash,
          bookingFingerprint,
          idempotencyKey: 'consent-key-p02',
          createdAt: new Date(),
        });

        // Platform now has NEW approved mechanism
        const newPlatformMechanism = {
          getApproved: () => ({
            version: 'new-version-v2', // Changed version!
            hash: 'new_hash_'.padEnd(64, '1'),
            status: 'APPROVED',
          }),
        } as unknown as ContractMechanismService;

        const guard = new ContractCheckoutGuard(
          true,
          contracts,
          versions,
          consents,
          policy,
          { build: () => Promise.resolve(snap) } as any,
          { assertLiveHold: jest.fn() } as any,
          { getApproved: () => syntheticApprovedTemplate } as any,
          newPlatformMechanism,
        );

        // Guard must throw ConflictException('PROVIDER_ACCEPTANCE_STALE')
        await expect(
          guard.evaluate(seed.bookingId.toString(), 200000, PaymentPurpose.RentalInitial),
        ).rejects.toThrow(new ConflictException('PROVIDER_ACCEPTANCE_STALE'));
      });

      it('9. Không bao giờ tự động upsert acceptance trong MongoDB', async () => {
        const seed = await seedShopAndBooking();
        const policy = new ContractPolicyService(connection, acceptances);
        const prep = new ContractPreparationService(
          true,
          connection,
          contracts,
          versions,
          policy,
          { build: () => Promise.resolve(createValidSnapshot(seed.bookingId, seed.customerId, seed.providerId, [seed.itemId], seed.policies)) } as any,
          { getApproved: () => syntheticApprovedTemplate } as any,
        );

        await expect(
          prep.prepare(seed.bookingId.toString(), seed.providerId.toString()),
        ).rejects.toThrow('PROVIDER_AUTO_ACCEPTANCE_MISSING');

        const count = await connection.db!.collection('provider_contract_acceptances').countDocuments({
          providerId: seed.providerId,
        });
        expect(count).toBe(0);
      });

      it('10. Legacy flow và photography không bị ảnh hưởng', async () => {
        const seed = await seedShopAndBooking();
        const policy = new ContractPolicyService(connection, acceptances);
        const guard = new ContractCheckoutGuard(
          true,
          contracts,
          versions,
          consents,
          policy,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
        );

        // Legacy booking
        await connection.db!.collection('bookings').updateOne(
          { _id: seed.bookingId },
          { $set: { contractFlowVersion: 1 } },
        );
        const res = await guard.evaluate(seed.bookingId.toString(), 200000, PaymentPurpose.RentalInitial);
        expect(res).toEqual({ binding: null, context: null });

        // Photography booking
        await connection.db!.collection('bookings').updateOne(
          { _id: seed.bookingId },
          { $set: { contractFlowVersion: 2, bookingType: 'PHOTOGRAPHY' } },
        );
        const photoRes = await guard.evaluate(seed.bookingId.toString(), 200000, PaymentPurpose.PhotographyInitial);
        expect(photoRes).toEqual({ binding: null, context: null });
      });
    });

    describe('P0.2 Section 6 — Real HTTP Verification via NestJS Application', () => {
      let app: INestApplication;
      let jwtService: JwtService;

      beforeAll(async () => {
        jwtService = new JwtService({ secret: jwtSecret });

        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ isGlobal: true }),
            MongooseModule.forRoot(
              `mongodb://127.0.0.1:27028/${scratchDbName}?replicaSet=rsContractTest&directConnection=true`,
            ),
            ContractsModule,
          ],
          providers: [
            {
              provide: ConfigService,
              useValue: {
                get: (key: string, def?: any) => {
                  if (key === 'JWT_SECRET') return jwtSecret;
                  if (key === 'CONTRACTS_V2_ENABLED') return 'true';
                  return def;
                },
              },
            },
          ],
        })
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate: (context: any) => {
              const req = context.switchToHttp().getRequest();
              const auth = req.headers['authorization'];
              if (!auth || !auth.startsWith('Bearer ')) return false;
              const token = auth.replace('Bearer ', '');
              try {
                req.user = jwtService.verify(token);
                return true;
              } catch {
                return false;
              }
            },
          })
          .overrideProvider('PrivateStorageService')
          .useValue({ uploadPrivateFile: jest.fn(), readPrivateFile: jest.fn() })
          .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
      });

      afterAll(async () => {
        if (app) await app.close();
      });

      it('HTTP 1: POST /contracts/provider/acceptance rejects with HTTP 422 when mechanism is DRAFT (Flag ON but no approval)', async () => {
        const seed = await seedShopAndBooking();
        const token = jwtService.sign({
          sub: seed.providerUserId.toString(),
          email: 'shop@vibehue.test',
          roles: ['PROVIDER'],
        });

        // App running with Flag ON, but ContractMechanismService has DRAFT mechanism
        const res = await request(app.getHttpServer())
          .post('/contracts/provider/acceptance')
          .set('Authorization', `Bearer ${token}`)
          .send({ mechanismHash: 'a'.repeat(64) })
          .expect(422);

        expect(res.body.message).toBe('CONTRACT_MECHANISM_NOT_APPROVED');
      });

      it('HTTP 2: POST /contracts/provider/acceptance rejects with HTTP 404 when user is not a provider', async () => {
        const imposterToken = jwtService.sign({
          sub: oid().toString(),
          email: 'imposter@vibehue.test',
          roles: ['CUSTOMER'],
        });

        const res = await request(app.getHttpServer())
          .post('/contracts/provider/acceptance')
          .set('Authorization', `Bearer ${imposterToken}`)
          .send({ mechanismHash: 'a'.repeat(64) })
          .expect(404);

        expect(res.body.message).toBe('PROVIDER_NOT_FOUND');
      });

      it('HTTP 3: GET /contracts/provider/acceptance returns active: null for unaccepted shop', async () => {
        const seed = await seedShopAndBooking();
        const token = jwtService.sign({
          sub: seed.providerUserId.toString(),
          email: 'shop@vibehue.test',
          roles: ['PROVIDER'],
        });

        const res = await request(app.getHttpServer())
          .get('/contracts/provider/acceptance')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body.active).toBeNull();
        expect(res.body.scope).toBe(ContractScope.AoDaiRental);
      });
    });

    describe('P0.2 Section 6 — Full AppModule Bootstrap Verification', () => {
      it('Bootstraps full production AppModule in isolated environment without errors', async () => {
        const bootstrapDbName = `contract_app_bootstrap_${oid().toHexString()}_test`;
        const testUri = `mongodb://127.0.0.1:27028/${bootstrapDbName}?replicaSet=rsContractTest&directConnection=true`;

        // Configure environment for full AppModule bootstrap
        process.env.MONGODB_URI = testUri;
        process.env.FRONTEND_URL = 'http://localhost:5173';
        process.env.NODE_ENV = 'development';

        const fullModule: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        })
          .overrideProvider('PrivateStorageService')
          .useValue({
            uploadPrivateFile: jest.fn(),
            readPrivateFile: jest.fn(),
            exists: jest.fn(),
            deletePrivateFile: jest.fn(),
          })
          .compile();

        const fullApp = fullModule.createNestApplication();
        await fullApp.init();

        expect(fullApp).toBeDefined();

        // Verify full controller presence
        const contractsCtrl = fullApp.get(ContractsController);
        expect(contractsCtrl).toBeDefined();

        await fullApp.close();

        // Cleanup bootstrap DB
        const cleanupConn = await createConnection(testUri).asPromise();
        await cleanupConn.dropDatabase();
        await cleanupConn.close();
      });
    });
  },
);
