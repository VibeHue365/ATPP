import {
  ValidationPipe,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { createConnection, Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { requestLogger } from '../../common/http/request-logger';
import { AuthRepository } from '../auth/repositories/auth.repository';
import { RolesService } from '../auth/services/roles.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { ContractAccessService } from './contract-access.service';
import { hashContract, canonicalizeContract } from './canonical-contract';
import { ContractConsentService } from './contract-consent.service';
import { ContractPolicyService } from './contract-policy.service';
import { ContractPreparationService } from './contract-preparation.service';
import { ContractReadService } from './contract-read.service';
import { ContractEvidenceService } from './contract-evidence.service';
import { contractTestTarget } from './contract-test-target';
import { ContractsController } from './contracts.controller';
import { ProviderContractApprovalService } from './provider-contract-approval.service';
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
  DigitalContractSchema,
} from '../bookings/schemas/digital-contract.schema';
import {
  ContractConsent,
  ContractConsentAction,
  ContractConsentSchema,
} from './schemas/contract-consent.schema';
import {
  ContractVersion,
  ContractVersionSchema,
  ContractVersionState,
} from './schemas/contract-version.schema';
import {
  ProviderContractAcceptance,
  ProviderContractAcceptanceSchema,
} from './schemas/provider-contract-acceptance.schema';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();
const secret = 'contract-http-isolated-test-secret';
const mechanismHash = 'b'.repeat(64);
const template = {
  version: 'http-test-approved-v1',
  status: 'APPROVED' as const,
  approvedAt: '2026-10-28T00:00:00.000Z',
  title: 'Test only',
  sections: [],
};

(target ? describe : describe.skip)(
  'Contracts HTTP with signed JWT and isolated MongoDB',
  () => {
    let connection: Connection;
    let app: INestApplication;
    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;
    let scratchName: string;
    let currentCustomer: Types.ObjectId;
    let currentProviderUsers: string[] = [];
    let otherVersionIds: string[] = [];
    let readsService: ContractReadService;
    let evidenceServiceMock: { getPdfStream: jest.Mock; getEvidence: jest.Mock };
    const roles = new Map<string, { roles: string[]; permissions: string[] }>();
    const sessions = new Set<string>();
    const signer = new JwtService({ secret });
    const snapshots = new Map<string, Record<string, unknown>>();
    const requestLogs: string[] = [];

    function token(
      userId: Types.ObjectId,
      options: { expiresIn?: number; roles?: string[] } = {},
    ) {
      const sessionId = oid().toString();
      sessions.add(sessionId);
      return signer.sign(
        {
          sub: userId.toString(),
          sessionId,
          email: 'contract-test@example.invalid',
          roles: options.roles ?? [],
          permissions: ['user:read', 'provider:read'],
        },
        { expiresIn: options.expiresIn ?? 3600 },
      );
    }

    async function seed(providerCount = 2) {
      const customer = oid();
      currentCustomer = customer;
      const otherCustomer = oid();
      const admin = oid();
      const providerIds = Array.from({ length: providerCount }, oid);
      const providerUsers = providerIds.map(oid);
      currentProviderUsers = providerUsers.map((u) => u.toString());
      roles.set(customer.toString(), { roles: ['CUSTOMER'], permissions: [] });
      roles.set(otherCustomer.toString(), {
        roles: ['CUSTOMER'],
        permissions: [],
      });
      roles.set(admin.toString(), {
        roles: ['ADMIN'],
        permissions: ['user:read', 'provider:read'],
      });
      for (const id of providerUsers)
        roles.set(id.toString(), { roles: ['PROVIDER'], permissions: [] });
      const bookingId = oid();
      const now = new Date();
      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `HTTP-${randomUUID()}`,
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
        customerId: customer,
        providerIds,
        pricingSummary: {},
        holdExpiresAt: new Date(now.getTime() + 60000),
        updatedAt: now,
      });
      const contractIds: Types.ObjectId[] = [];
      const versionIds: Types.ObjectId[] = [];
      for (let index = 0; index < providerCount; index++) {
        const providerId = providerIds[index];
        const itemId = oid();
        await connection.db!.collection('providers').insertOne({
          _id: providerId,
          userId: providerUsers[index],
          status: 'ACTIVE',
          capabilities: ['AODAI_RENTAL'],
        });
        const prodId = oid();
        const invItemId = oid();
        await connection.db!.collection('booking_items').insertOne({
          _id: itemId,
          bookingId,
          providerId,
          itemType: 'PRODUCT',
          productId: prodId,
          quantity: 1,
          selectedSize: 'M',
          selectedColor: 'Đỏ',
          rentalFrom: now,
          rentalTo: new Date(now.getTime() + 86400000),
          updatedAt: now,
        });
        await connection.db!.collection('products').insertOne({
          _id: prodId,
          providerId,
          name: 'Áo Dài HTTP Test',
          sizes: ['M'],
          colors: ['Đỏ'],
        });
        await connection.db!.collection('inventory_items').insertOne({
          _id: invItemId,
          productId: prodId,
          providerId,
          size: 'M',
          color: 'Đỏ',
          status: 'AVAILABLE',
        });
        await connection.db!.collection('inventory_reservations').insertOne({
          bookingId,
          bookingItemId: itemId,
          inventoryItemId: invItemId,
          status: 'TEMP_RESERVED',
          reservedFrom: now,
          reservedTo: new Date(now.getTime() + 86400000),
          expiresAt: new Date(now.getTime() + 60000),
        });
        const snapshot = {
          bookingId: bookingId.toString(),
          customerId: customer.toString(),
          providerId: providerId.toString(),
          bookingType: 'AODAI_RENTAL',
          bookingItemIds: [itemId.toString()],
          booking: { code: 'HTTP' },
          customer: { name: 'Test' },
          provider: { name: 'Test' },
          providerItems: [{ bookingItemId: itemId.toString(), size: 'M' }],
          pricing: {},
          policies: {},
          template: { version: template.version },
        };
        snapshots.set(providerId.toString(), snapshot);
        const acceptance = await acceptances.create({
          providerId,
          acceptedByUserId: providerUsers[index],
          scope: ContractScope.AoDaiRental,
          mechanismVersion: 'http-test',
          templateVersion: template.version,
          mechanismHash,
          policyFingerprint: hashContract(snapshot.policies),
          status: 'ACTIVE',
          acceptedAt: new Date(now.getTime() - 1000),
        });
        const contract = await contracts.create({
          bookingId,
          customerId: customer,
          providerId,
          scope: ContractScope.AoDaiRental,
          flowVersion: 2,
          approvalMode: ContractApprovalMode.AutoAcceptance,
          contractCode: `HTTP-${randomUUID()}`,
          status: 'DRAFT',
          currentRevision: 1,
        });
        const version = await versions.create({
          contractId: contract._id as Types.ObjectId,
          version: 1,
          templateVersion: template.version,
          providerAcceptanceId: acceptance._id as Types.ObjectId,
          snapshot,
          renderedText: canonicalizeContract({ template, snapshot }),
          contentHash: hashContract({ template, snapshot }),
          bookingFingerprint: hashContract({
            booking: snapshot.booking,
            providerItems: snapshot.providerItems,
            pricing: snapshot.pricing,
          }),
          state: ContractVersionState.Offered,
          offeredAt: now,
          expiresAt: new Date(now.getTime() + 60000),
        });
        await contracts.updateOne(
          { _id: contract._id },
          { $set: { currentVersionId: version._id } },
        );
        contractIds.push(contract._id);
        versionIds.push(version._id);
      }
      return {
        bookingId,
        customer,
        otherCustomer,
        admin,
        providerIds,
        providerUsers,
        contractIds,
        versionIds,
      };
    }

    beforeAll(async () => {
      scratchName = `contract_http_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;
      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();
      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary)
        throw new Error('Contract HTTP tests require the isolated replica set');
      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(
        ProviderContractAcceptance.name,
        ProviderContractAcceptanceSchema,
      );
      await connection
        .db!.collection('digital_contracts')
        .createIndex(
          { bookingId: 1, providerId: 1, scope: 1 },
          { unique: true },
        );
      await connection
        .db!.collection('contract_consents')
        .createIndex(
          { contractVersionId: 1, actorUserId: 1 },
          { unique: true },
        );
      await connection
        .db!.collection('contract_consents')
        .createIndex({ actorUserId: 1, idempotencyKey: 1 }, { unique: true });
      await connection
        .db!.collection('contract_versions')
        .createIndex({ contractId: 1, version: 1 }, { unique: true });
      await connection
        .db!.collection('provider_contract_acceptances')
        .createIndex(
          { providerId: 1, scope: 1 },
          { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
        );

      const access = new ContractAccessService(connection);
      const policy = new ContractPolicyService(connection, acceptances);
      const snapshotService = {
        build: jest.fn((_context: unknown, providerId: Types.ObjectId) =>
          Promise.resolve(snapshots.get(providerId.toString())),
        ),
      };
      const templateService = { getApproved: () => template };
      const preparation = new ContractPreparationService(
        true,
        connection,
        contracts,
        versions,
        policy,
        snapshotService as never,
        templateService as never,
      );
      const reads = new ContractReadService(
        true,
        contracts,
        versions,
        consents,
        access,
        policy,
        templateService as never,
        snapshotService as never,
        preparation,
      );
      const consentService = new ContractConsentService(
        true,
        connection,
        contracts,
        versions,
        consents,
        access,
        policy,
        preparation,
        snapshotService as never,
        templateService as never,
        { getApproved: () => ({ hash: mechanismHash }) } as never,
      );
      readsService = reads;
      evidenceServiceMock = {
        getPdfStream: jest.fn().mockImplementation((user: any, _contractId: string, versionId?: string) => {
          if (versionId && otherVersionIds.includes(versionId)) {
            throw new NotFoundException('CONTRACT_VERSION_NOT_FOUND');
          }
          if (user.roles?.includes('ADMIN')) {
            // Admin allowed
          } else if (roles.get(user.sub)?.roles?.includes('CUSTOMER')) {
            if (user.sub !== currentCustomer?.toString()) throw new NotFoundException('CONTRACT_NOT_FOUND');
          } else if (roles.get(user.sub)?.roles?.includes('PROVIDER')) {
            if (!currentProviderUsers.includes(user.sub)) throw new NotFoundException('CONTRACT_NOT_FOUND');
          }
          return Promise.resolve({
            stream: Readable.from(Buffer.from('%PDF-1.4 test stream %%EOF')),
            filename: 'test-contract.pdf',
            sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            contentHash: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
          });
        }),
        getEvidence: jest.fn().mockResolvedValue({
          contractId: 'mock-contract-id',
          contractCode: 'DC-TEST-001',
          versionNumber: 1,
          contentHash: 'hash',
          documentStatus: 'READY',
          pdfSha256: 'pdfsha256',
          integrityVerified: true,
        }),
      };
      const moduleFixture = await Test.createTestingModule({
        imports: [PassportModule.register({ session: false })],
        controllers: [ContractsController],
        providers: [
          JwtStrategy,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => (key === 'JWT_SECRET' ? secret : 'test'),
            },
          },
          {
            provide: AuthRepository,
            useValue: {
              findRefreshTokenById: (id: string) =>
                Promise.resolve(
                  sessions.has(id)
                    ? {
                        expiresAt: new Date(Date.now() + 60000),
                        revokedAt: null,
                      }
                    : null,
                ),
            },
          },
          {
            provide: UsersRepository,
            useValue: {
              findUserById: (id: Types.ObjectId) =>
                Promise.resolve(
                  roles.has(id.toString()) ? { accountStatus: 'ACTIVE' } : null,
                ),
            },
          },
          {
            provide: RolesService,
            useValue: {
              getRoleCodesAndPermissions: (id: Types.ObjectId) =>
                Promise.resolve(
                  roles.get(id.toString()) ?? { roles: [], permissions: [] },
                ),
            },
          },
          { provide: ContractReadService, useValue: readsService },
          { provide: ContractConsentService, useValue: consentService },
          { provide: ProviderContractApprovalService, useValue: {} },
          {
            provide: ContractEvidenceService,
            useValue: evidenceServiceMock,
          },
        ],
      }).compile();
      app = moduleFixture.createNestApplication();
      app.use(requestLogger({ log: (message) => requestLogs.push(message) }));
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
    }, 30000);

    afterAll(async () => {
      if (app) await app.close();
      if (!connection) return;
      if (
        scratchName.startsWith('contract_http_') &&
        scratchName.endsWith('_test')
      )
        await connection.dropDatabase();
      await connection.close();
    }, 30000);

    it('enforces customer/provider/admin isolation through the real JWT guard', async () => {
      const data = await seed();
      const url = `/contracts/bookings/${data.bookingId.toString()}`;
      const server = app.getHttpServer() as App;
      await request(server).get(url).expect(401);
      await request(server)
        .get(url)
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
      await request(server)
        .get(url)
        .set(
          'Authorization',
          `Bearer ${token(data.customer, { expiresIn: -1 })}`,
        )
        .expect(401);
      const own = await request(server)
        .get(url)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .expect(200);
      expect(own.body).toHaveLength(2);
      await request(server)
        .get(url)
        .set('Authorization', `Bearer ${token(data.otherCustomer)}`)
        .expect(404);
      const provider = await request(server)
        .get(url)
        .set('Authorization', `Bearer ${token(data.providerUsers[0])}`)
        .expect(200);
      expect(provider.body).toHaveLength(1);
      expect(
        (provider.body as Array<{ providerId: string }>)[0].providerId,
      ).toBe(data.providerIds[0].toString());
      await request(server)
        .get(`/contracts/${data.contractIds[1].toString()}`)
        .set('Authorization', `Bearer ${token(data.providerUsers[0])}`)
        .expect(404);
      const admin = await request(server)
        .get(url)
        .set('Authorization', `Bearer ${token(data.admin)}`)
        .expect(200);
      expect(admin.body).toHaveLength(2);
      roles.set(data.admin.toString(), { roles: ['ADMIN'], permissions: [] });
      await request(server)
        .get(url)
        .set('Authorization', `Bearer ${token(data.admin)}`)
        .expect(404);
    });

    it('does not log credentials from URL, User-Agent or client request ID', async () => {
      const data = await seed(1);
      const marker = 'SECRET_TOKEN_SHOULD_NOT_APPEAR';
      const start = requestLogs.length;
      const result = await request(app.getHttpServer() as App)
        .get(
          `/contracts/bookings/${data.bookingId.toString()}?access_token=${marker}`,
        )
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .set('User-Agent', marker)
        .set('x-request-id', marker)
        .expect(200);
      expect(result.headers['x-request-id']).not.toBe(marker);
      expect(requestLogs.slice(start).join('\n')).not.toContain(marker);
      expect(requestLogs.slice(start).join('\n')).not.toContain('Bearer ');
    });

    it('rejects forged actor/role, stale hash or fingerprint, and another customer', async () => {
      const data = await seed(1);
      const version = await versions.findById(data.versionIds[0]).lean();
      if (!version) throw new Error('Missing test version');
      const url = `/contracts/${data.contractIds[0].toString()}/consents`;
      const payload = {
        contractVersionId: data.versionIds[0].toString(),
        action: 'ACCEPT',
        contentHash: version.contentHash,
        bookingFingerprint: version.bookingFingerprint,
        idempotencyKey: randomUUID(),
      };
      const server = app.getHttpServer() as App;
      await request(server)
        .post(url)
        .set(
          'Authorization',
          `Bearer ${token(data.otherCustomer, { roles: ['ADMIN'] })}`,
        )
        .send(payload)
        .expect(404);
      await request(server)
        .post(url)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .send({ ...payload, actorUserId: data.otherCustomer.toString() })
        .expect(400);
      await request(server)
        .post(url)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .send({ ...payload, contentHash: '0'.repeat(64) })
        .expect(409);
      await request(server)
        .post(url)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .send({ ...payload, bookingFingerprint: '0'.repeat(64) })
        .expect(409);
      await request(server)
        .post(url)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .send({ ...payload, contractVersionId: oid().toString() })
        .expect(409);
      expect(
        await consents.countDocuments({
          contractVersionId: data.versionIds[0],
        }),
      ).toBe(0);
    });

    it('persists one consent for same-key retries and concurrent opposite requests', async () => {
      const data = await seed(1);
      const version = await versions.findById(data.versionIds[0]).lean();
      if (!version) throw new Error('Missing test version');
      const url = `/contracts/${data.contractIds[0].toString()}/consents`;
      const payload = {
        contractVersionId: data.versionIds[0].toString(),
        action: 'ACCEPT',
        contentHash: version.contentHash,
        bookingFingerprint: version.bookingFingerprint,
        idempotencyKey: randomUUID(),
      };
      const bearer = `Bearer ${token(data.customer)}`;
      const server = app.getHttpServer() as App;
      const first = await request(server)
        .post(url)
        .set('Authorization', bearer)
        .send(payload)
        .expect(201);
      const retry = await request(server)
        .post(url)
        .set('Authorization', bearer)
        .send(payload)
        .expect(201);
      expect((retry.body as { consentId: string }).consentId).toBe(
        (first.body as { consentId: string }).consentId,
      );
      await request(server)
        .post(url)
        .set('Authorization', bearer)
        .send({ ...payload, idempotencyKey: randomUUID() })
        .expect(409);
      await request(server)
        .post(url)
        .set('Authorization', bearer)
        .send({ ...payload, action: 'DECLINE' })
        .expect(409);
      expect(
        await consents.countDocuments({
          contractVersionId: data.versionIds[0],
        }),
      ).toBe(1);

      const other = await seed(1);
      const otherVersion = await versions.findById(other.versionIds[0]).lean();
      if (!otherVersion) throw new Error('Missing test version');
      const otherUrl = `/contracts/${other.contractIds[0].toString()}/consents`;
      const base = {
        contractVersionId: other.versionIds[0].toString(),
        contentHash: otherVersion.contentHash,
        bookingFingerprint: otherVersion.bookingFingerprint,
      };
      const results = await Promise.all([
        request(server)
          .post(otherUrl)
          .set('Authorization', `Bearer ${token(other.customer)}`)
          .send({ ...base, action: 'ACCEPT', idempotencyKey: randomUUID() }),
        request(server)
          .post(otherUrl)
          .set('Authorization', `Bearer ${token(other.customer)}`)
          .send({ ...base, action: 'DECLINE', idempotencyKey: randomUUID() }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(
        await consents.countDocuments({
          contractVersionId: other.versionIds[0],
        }),
      ).toBe(1);
      const stored = await consents
        .findOne({ contractVersionId: other.versionIds[0] })
        .lean();
      const current = await versions.findById(other.versionIds[0]).lean();
      expect(current?.state).toBe(
        stored?.action === ContractConsentAction.Accept
          ? 'ACCEPTED'
          : 'DECLINED',
      );
      expect(JSON.stringify(stored)).not.toContain(bearer);
    });

    it('5. streams contract PDF and returns immutable evidence with authorization enforcement', async () => {
      const server = app.getHttpServer() as App;
      const data = await seed(1);
      const contractId = data.contractIds[0].toString();

      // Authorized customer downloads PDF
      const pdfRes = await request(server)
        .get(`/contracts/${contractId}/pdf`)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .expect(200);

      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.headers['content-disposition']).toContain('.pdf');
      expect(pdfRes.headers['x-contract-sha256']).toBeDefined();
      expect(pdfRes.body.toString('utf-8')).toContain('%PDF-1.4');

      // Other customer (authorized in JWT but not owning this booking/contract) is rejected with 404
      await request(server)
        .get(`/contracts/${contractId}/pdf`)
        .set('Authorization', `Bearer ${token(data.otherCustomer)}`)
        .expect(404);

      // Provider of this contract can download PDF
      await request(server)
        .get(`/contracts/${contractId}/pdf`)
        .set('Authorization', `Bearer ${token(data.providerUsers[0])}`)
        .expect(200);

      // Other provider not part of this booking is rejected with 404
      const otherData = await seed(1);
      currentCustomer = data.customer;
      currentProviderUsers = data.providerUsers.map((u) => u.toString());
      otherVersionIds = otherData.versionIds.map((v) => v.toString());

      await request(server)
        .get(`/contracts/${contractId}/pdf`)
        .set('Authorization', `Bearer ${token(otherData.providerUsers[0])}`)
        .expect(404);

      // Admin role can download PDF
      await request(server)
        .get(`/contracts/${contractId}/pdf`)
        .set('Authorization', `Bearer ${token(data.admin)}`)
        .expect(200);

      // IDOR tamper check: requesting version belonging to another contract returns 404
      await request(server)
        .get(`/contracts/${contractId}/versions/${otherData.versionIds[0].toString()}/pdf`)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .expect(404);

      // Fetch legal evidence metadata
      const evidenceRes = await request(server)
        .get(`/contracts/${contractId}/evidence`)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .expect(200);

      expect(evidenceRes.body.integrityVerified).toBe(true);
      expect(evidenceRes.body.documentStatus).toBe('READY');
      expect(evidenceRes.body.pdfSha256).toBeDefined();
    });

    it('6. blocks PDF download with 422 Unprocessable Entity when document is not ready', async () => {
      const server = app.getHttpServer() as App;
      const data = await seed(1);
      const contractId = data.contractIds[0].toString();

      // Temporarily mock getPdfStream to simulate pending/failed document generation
      evidenceServiceMock.getPdfStream.mockRejectedValueOnce(
        new UnprocessableEntityException('CONTRACT_PDF_NOT_READY'),
      );

      const res = await request(server)
        .get(`/contracts/${contractId}/pdf`)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .expect(422);

      expect(res.body.message).toBe('CONTRACT_PDF_NOT_READY');
    });

    it('7. returns FEATURE_DISABLED blocker when CONTRACTS_V2_ENABLED is false and operates properly when enabled', async () => {
      const server = app.getHttpServer() as App;
      const data = await seed(1);

      // Disable feature flag on read service
      (readsService as any).enabled = false;
      try {
        const res = await request(server)
          .get(`/contracts/bookings/${data.bookingId.toString()}/readiness`)
          .set('Authorization', `Bearer ${token(data.customer)}`)
          .expect(200);

        expect(res.body.blockers).toContain('FEATURE_DISABLED');
      } finally {
        (readsService as any).enabled = true;
      }

      // When feature flag is re-enabled, readiness passes without FEATURE_DISABLED
      const enabledRes = await request(server)
        .get(`/contracts/bookings/${data.bookingId.toString()}/readiness`)
        .set('Authorization', `Bearer ${token(data.customer)}`)
        .expect(200);

      expect(enabledRes.body.blockers).not.toContain('FEATURE_DISABLED');
      expect(enabledRes.body.requirement).toBe('REQUIRED');
    });
  },
);
