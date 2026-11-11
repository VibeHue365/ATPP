import { Types, createConnection, Connection } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { ContractPolicyService } from '../contract-policy.service';
import { ContractReadService } from '../contract-read.service';
import { ContractScope } from '../../bookings/schemas/digital-contract.schema';
import { ProviderAcceptanceStatus } from '../schemas/provider-contract-acceptance.schema';
import { BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { hashContract } from '../canonical-contract';

describe('Dual-Mode Contract Architecture: LEGACY & CONTRACT_V2 Coexistence', () => {
  const oid = () => new Types.ObjectId();

  describe('1. ContractPolicyService: Shop Participation Status Detection', () => {
    it('returns LEGACY when provider has zero acceptance records', async () => {
      const mockAcceptanceModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      } as any;
      const mockConn = { db: {} } as any;

      const policyService = new ContractPolicyService(
        mockConn,
        mockAcceptanceModel,
      );

      const statusRes = await policyService.getProviderContractParticipationStatus(oid());
      expect(statusRes.status).toBe('LEGACY');
      expect(statusRes.acceptance).toBeUndefined();
    });

    it('returns CONTRACT_ACTIVE when provider has active acceptance matching mechanism, template, and policy', async () => {
      const provId = oid();
      const ownerUserId = oid();
      const mockAcceptance = {
        _id: oid(),
        providerId: provId,
        acceptedByUserId: ownerUserId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
        mechanismVersion: 'mech-v1',
        templateVersion: 'tmpl-v1',
        mechanismHash: 'mech_hash_valid'.padEnd(64, '0'),
        policyFingerprint: hashContract({ rentalPolicy: 'standard' }),
        acceptedAt: new Date(Date.now() - 10000),
      };

      const mockAcceptanceModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockAcceptance]),
        }),
      } as any;

      const mockDb = {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({
            _id: provId,
            userId: ownerUserId,
            status: 'ACTIVE',
            capabilities: ['AODAI_RENTAL'],
          }),
        }),
      };
      const mockConn = { db: mockDb } as any;

      const mockSnapshots = {
        currentPoliciesForProvider: jest.fn().mockResolvedValue({ rentalPolicy: 'standard' }),
      } as any;
      const mockMechanism = {
        getApproved: jest.fn().mockReturnValue({
          version: 'mech-v1',
          hash: 'mech_hash_valid'.padEnd(64, '0'),
        }),
      } as any;
      const mockTemplates = {
        getApproved: jest.fn().mockReturnValue({ version: 'tmpl-v1' }),
      } as any;

      const policyService = new ContractPolicyService(
        mockConn,
        mockAcceptanceModel,
        mockSnapshots,
        mockMechanism,
        mockTemplates,
      );

      const statusRes = await policyService.getProviderContractParticipationStatus(provId);
      expect(statusRes.status).toBe('CONTRACT_ACTIVE');
      expect(statusRes.acceptance).toBeDefined();
    });

    it('returns CONTRACT_SUSPENDED when provider has revoked acceptance', async () => {
      const provId = oid();
      const mockRevoked = {
        _id: oid(),
        providerId: provId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Revoked,
        revokedAt: new Date(Date.now() - 5000),
        acceptedAt: new Date(Date.now() - 20000),
      };

      const mockAcceptanceModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockRevoked]),
        }),
      } as any;

      const policyService = new ContractPolicyService(
        { db: {} } as any,
        mockAcceptanceModel,
      );

      const statusRes = await policyService.getProviderContractParticipationStatus(provId);
      expect(statusRes.status).toBe('CONTRACT_SUSPENDED');
      expect(statusRes.reason).toBe('REVOKED');
    });

    it('returns CONTRACT_SUSPENDED when active acceptance is STALE (policy changed)', async () => {
      const provId = oid();
      const ownerUserId = oid();
      const mockAcceptance = {
        _id: oid(),
        providerId: provId,
        acceptedByUserId: ownerUserId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
        mechanismVersion: 'mech-v1',
        templateVersion: 'tmpl-v1',
        mechanismHash: 'mech_hash_valid'.padEnd(64, '0'),
        policyFingerprint: 'old_fingerprint'.padEnd(64, '0'),
        acceptedAt: new Date(Date.now() - 10000),
      };

      const mockAcceptanceModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockAcceptance]),
        }),
      } as any;

      const mockDb = {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({
            _id: provId,
            userId: ownerUserId,
            status: 'ACTIVE',
            capabilities: ['AODAI_RENTAL'],
          }),
        }),
      };

      const mockSnapshots = {
        currentPoliciesForProvider: jest.fn().mockResolvedValue({ rentalPolicy: 'NEW_POLICY_UPDATED' }),
      } as any;
      const mockMechanism = {
        getApproved: jest.fn().mockReturnValue({
          version: 'mech-v1',
          hash: 'mech_hash_valid'.padEnd(64, '0'),
        }),
      } as any;
      const mockTemplates = {
        getApproved: jest.fn().mockReturnValue({ version: 'tmpl-v1' }),
      } as any;

      const policyService = new ContractPolicyService(
        { db: mockDb } as any,
        mockAcceptanceModel,
        mockSnapshots,
        mockMechanism,
        mockTemplates,
      );

      const statusRes = await policyService.getProviderContractParticipationStatus(provId);
      expect(statusRes.status).toBe('CONTRACT_SUSPENDED');
      expect(statusRes.reason).toBe('POLICY_STALE');
    });
  });

  describe('2. ContractReadService.checkEligibility: Dual-Mode & Multi-Shop', () => {
    const provLegacy = oid();
    const prodLegacy = oid();

    const provActive = oid();
    const prodActive = oid();

    const provSuspended = oid();
    const prodSuspended = oid();

    const createReadService = () => {
      const mockDb = {
        collection: jest.fn((name: string) => ({
          findOne: jest.fn(async (q: any) => {
            if (name === 'products') {
              if (q._id.equals(prodLegacy)) {
                return { _id: prodLegacy, providerId: provLegacy, name: 'Áo dài Legacy' };
              }
              if (q._id.equals(prodActive)) {
                return { _id: prodActive, providerId: provActive, name: 'Áo dài V2', replacementValue: 1500000, moderationStatus: 'APPROVED' };
              }
              if (q._id.equals(prodSuspended)) {
                return { _id: prodSuspended, providerId: provSuspended, name: 'Áo dài Suspended' };
              }
            }
            if (name === 'providers') {
              if (q._id.equals(provLegacy)) return { _id: provLegacy, businessName: 'Shop Legacy', status: 'ACTIVE', capabilities: ['AODAI_RENTAL'] };
              if (q._id.equals(provActive)) return { _id: provActive, businessName: 'Shop V2 Active', status: 'ACTIVE', capabilities: ['AODAI_RENTAL'] };
              if (q._id.equals(provSuspended)) return { _id: provSuspended, businessName: 'Shop Suspended', status: 'ACTIVE', capabilities: ['AODAI_RENTAL'] };
            }
            return null;
          }),
        })),
      };

      const mockPolicy = {
        getProviderContractParticipationStatus: jest.fn(async (pId: Types.ObjectId) => {
          if (pId.equals(provLegacy)) return { status: 'LEGACY' };
          if (pId.equals(provActive)) return { status: 'CONTRACT_ACTIVE' };
          if (pId.equals(provSuspended)) return { status: 'CONTRACT_SUSPENDED', reason: 'REVOKED' };
          return { status: 'LEGACY' };
        }),
      } as any;

      const mockSnapshots = {
        currentPoliciesForProvider: jest.fn().mockResolvedValue({
          providerDamageCompensation: {
            minorDamageFee: 50000,
            moderateDamagePercent: 20,
            severeDamageOrLossPercent: 100,
          },
        }),
      } as any;

      const service = new ContractReadService(
        true,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockPolicy,
        {} as any,
        mockSnapshots,
        {} as any,
        { db: mockDb } as any,
      );

      return service;
    };

    it('Scenario 1: Shop chưa từng ký acceptance (LEGACY) -> Eligible với flow LEGACY, không đòi replacement value', async () => {
      const service = createReadService();
      const res = await service.checkEligibility([{ productId: prodLegacy.toString() }]);
      expect(res.eligible).toBe(true);
      expect(res.ineligibleItems).toHaveLength(0);
      expect(res.flow).toBe('LEGACY');
    });

    it('Scenario 2: Shop có acceptance ACTIVE (CONTRACT_ACTIVE) -> Eligible với flow CONTRACT_V2', async () => {
      const service = createReadService();
      const res = await service.checkEligibility([{ productId: prodActive.toString() }]);
      expect(res.eligible).toBe(true);
      expect(res.ineligibleItems).toHaveLength(0);
      expect(res.flow).toBe('CONTRACT_V2');
    });

    it('Scenario 3: Shop có acceptance REVOKED hoặc STALE -> Ineligible với reason PROVIDER_ACCEPTANCE_SUSPENDED', async () => {
      const service = createReadService();
      const res = await service.checkEligibility([{ productId: prodSuspended.toString() }]);
      expect(res.eligible).toBe(false);
      expect(res.ineligibleItems).toHaveLength(1);
      expect(res.ineligibleItems[0].reason).toBe('PROVIDER_ACCEPTANCE_SUSPENDED');
      expect(res.flow).toBe('BLOCKED');
    });

    it('Scenario 6: Mixed Cart (1 Shop LEGACY + 1 Shop CONTRACT_ACTIVE) -> Fails with MIXED_CONTRACT_FLOW_UNSUPPORTED', async () => {
      const service = createReadService();
      const res = await service.checkEligibility([
        { productId: prodLegacy.toString() },
        { productId: prodActive.toString() },
      ]);
      expect(res.eligible).toBe(false);
      expect(res.ineligibleItems).toHaveLength(1);
      expect(res.ineligibleItems[0].reason).toBe('MIXED_CONTRACT_FLOW_UNSUPPORTED');
      expect(res.flow).toBe('MIXED');
    });
  });

  describe('3. ContractReadService.readiness: No Auto-Upgrade on Legacy Bookings', () => {
    it('Scenario 1b: Calling readiness on a legacy booking returns NOT_REQUIRED and NEVER upgrades contractFlowVersion', async () => {
      const bookingId = oid();
      const legacyBooking = {
        _id: bookingId,
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: null, // Legacy
      };

      const mockAccess = {
        booking: jest.fn().mockResolvedValue(legacyBooking),
        assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER', userId: oid() }),
        markContractFlowVersion: jest.fn(),
      } as any;

      const service = new ContractReadService(
        true,
        {} as any,
        {} as any,
        {} as any,
        mockAccess,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { db: {} } as any,
      );

      const res = await service.readiness({ sub: 'user_1' } as any, bookingId.toString());
      expect(res.requirement).toBe('NOT_REQUIRED');
      expect(res.ready).toBe(true);
      expect(res.flow).toBe('LEGACY');
      // Crucial check: markContractFlowVersion was NEVER called!
      expect(mockAccess.markContractFlowVersion).not.toHaveBeenCalled();
      expect(legacyBooking.contractFlowVersion).toBeNull();
    });

    it('Scenario 4: Old booking created as LEGACY stays LEGACY even if shop accepts later', async () => {
      const bookingId = oid();
      const oldLegacyBooking = {
        _id: bookingId,
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: null,
      };

      const mockAccess = {
        booking: jest.fn().mockResolvedValue(oldLegacyBooking),
        assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER', userId: oid() }),
        markContractFlowVersion: jest.fn(),
      } as any;

      const service = new ContractReadService(
        true,
        {} as any,
        {} as any,
        {} as any,
        mockAccess,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { db: {} } as any,
      );

      const res = await service.readiness({ sub: 'user_1' } as any, bookingId.toString());
      expect(res.flow).toBe('LEGACY');
      expect(res.requirement).toBe('NOT_REQUIRED');
      expect(oldLegacyBooking.contractFlowVersion).toBeNull();
    });
  });

  describe('4. Real MongoDB Docker Verification (Port 27028)', () => {
    const mongoUri = 'mongodb://127.0.0.1:27028/?replicaSet=rsContractTest&directConnection=true';
    let connection: Connection | null = null;
    let scratchDbName: string;

    beforeAll(async () => {
      scratchDbName = `dual_mode_${oid().toHexString()}_test`;
      try {
        connection = await createConnection(`${mongoUri}&authSource=admin`, {
          dbName: scratchDbName,
          serverSelectionTimeoutMS: 2000,
        }).asPromise();
      } catch {
        connection = null;
      }
    });

    afterAll(async () => {
      if (connection) {
        try {
          await connection.dropDatabase();
        } catch {}
        await connection.close();
      }
    });

    it('Runtime Real Test: Legacy shop has no acceptances in DB -> creates booking with contractFlowVersion: null -> readiness returns NOT_REQUIRED', async () => {
      if (!connection || !connection.db) {
        console.warn('Skipping Docker Mongo test: 27028 not available');
        return;
      }
      const db = connection.db;
      const provId = oid();
      const prodId = oid();
      const custId = oid();
      const bookingId = oid();

      await db.collection('providers').insertOne({
        _id: provId,
        businessName: 'Tiệm Huế Cổ Truyền (Legacy)',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
      });

      await db.collection('products').insertOne({
        _id: prodId,
        providerId: provId,
        name: 'Áo Dài Cổ Truyền',
        price: 100000,
      });

      // No acceptance in provider_contract_acceptances!
      const acceptanceCount = await db.collection('provider_contract_acceptances').countDocuments({ providerId: provId });
      expect(acceptanceCount).toBe(0);

      // Create booking in MongoDB with contractFlowVersion: null
      await db.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: 'B_LEGACY_001',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: null,
      });

      // Verify contractFlowVersion in DB is null
      const createdBooking = await db.collection('bookings').findOne({ _id: bookingId });
      expect(createdBooking?.contractFlowVersion).toBeNull();

      // Run ContractReadService over real MongoDB connection
      const mockAccess = {
        booking: jest.fn().mockResolvedValue(createdBooking),
        assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER', userId: custId }),
        markContractFlowVersion: jest.fn(),
      } as any;

      const readService = new ContractReadService(
        true,
        {} as any,
        {} as any,
        {} as any,
        mockAccess,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        connection as any,
      );

      const readinessRes = await readService.readiness({ sub: custId.toString() } as any, bookingId.toString());
      expect(readinessRes.requirement).toBe('NOT_REQUIRED');
      expect(readinessRes.flow).toBe('LEGACY');
      expect(readinessRes.ready).toBe(true);

      // DB remains untouched: contractFlowVersion is still null!
      const bookingAfter = await db.collection('bookings').findOne({ _id: bookingId });
      expect(bookingAfter?.contractFlowVersion).toBeNull();
    });

    it('Runtime Real Test: Shop with active acceptance -> creates booking with contractFlowVersion: 2 -> readiness returns REQUIRED', async () => {
      if (!connection || !connection.db) {
        console.warn('Skipping Docker Mongo test: 27028 not available');
        return;
      }
      const db = connection.db;
      const provId = oid();
      const prodId = oid();
      const custId = oid();
      const bookingId = oid();

      await db.collection('providers').insertOne({
        _id: provId,
        businessName: 'Tiệm Hoàng Cung (Contract Active)',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
      });

      await db.collection('provider_contract_acceptances').insertOne({
        providerId: provId,
        scope: ContractScope.AoDaiRental,
        status: ProviderAcceptanceStatus.Active,
        mechanismVersion: '1.0.0',
        templateVersion: '1.0.0',
        mechanismHash: 'mech_hash_valid'.padEnd(64, '0'),
        policyFingerprint: 'fp_valid'.padEnd(64, '0'),
        acceptedAt: new Date(),
      });

      await db.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: 'B_V2_001',
        customerId: custId,
        providerIds: [provId],
        bookingType: 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: 2,
      });

      const v2Booking = await db.collection('bookings').findOne({ _id: bookingId });
      expect(v2Booking?.contractFlowVersion).toBe(2);

      const mockAccess = {
        booking: jest.fn().mockResolvedValue(v2Booking),
        assertBookingReader: jest.fn().mockResolvedValue({ kind: 'CUSTOMER', userId: custId }),
      } as any;

      const mockPolicy = {
        getContext: jest.fn().mockResolvedValue({
          booking: v2Booking,
          rentalProviderIds: [provId],
          rentalItems: [{ productId: prodId, providerId: provId }],
        }),
      } as any;

      const mockContracts = {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      } as any;

      const mockTemplates = {
        getApproved: jest.fn().mockReturnValue({ version: '1.0.0' }),
      } as any;

      const readService = new ContractReadService(
        true,
        mockContracts,
        {} as any,
        {} as any,
        mockAccess,
        mockPolicy,
        mockTemplates,
        {} as any,
        { prepare: jest.fn().mockRejectedValue(new Error('NOT_PREPARED')) } as any,
        connection as any,
      );

      const readinessRes = await readService.readiness({ sub: custId.toString() } as any, bookingId.toString());
      expect(readinessRes.requirement).toBe('REQUIRED');
      expect(readinessRes.ready).toBe(false);
      expect(readinessRes.flow).toBe('CONTRACT_V2');
    });
  });
});
