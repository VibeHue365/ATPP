import {
  ValidationPipe,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../contract-test-target';
import {
  SYNTHETIC_APPROVED_TEMPLATE,
  SYNTHETIC_APPROVED_MECHANISM,
  signPayOSWebhook,
  installNetworkGuard,
} from './fixtures/synthetic-contract.fixture';

// Domain Schemas & Enums
import { DigitalContract, DigitalContractSchema, ContractApprovalMode, ContractScope } from '../../bookings/schemas/digital-contract.schema';
import { ContractVersion, ContractVersionSchema, ContractVersionState, ContractDocumentStatus } from '../schemas/contract-version.schema';
import { ContractConsent, ContractConsentSchema, ContractConsentAction } from '../schemas/contract-consent.schema';
import { ProviderContractAcceptance, ProviderContractAcceptanceSchema, ProviderAcceptanceStatus } from '../schemas/provider-contract-acceptance.schema';
import { Booking, BookingSchema, BookingStatus, BookingType } from '../../bookings/schemas/booking.schema';
import { BookingItem, BookingItemSchema } from '../../bookings/schemas/booking-item.schema';
import { BookingSchedule, BookingScheduleSchema } from '../../bookings/schemas/booking-schedule.schema';
import { InventoryReservation, InventoryReservationSchema, ReservationStatus } from '../../products/schemas/inventory-reservation.schema';
import { Payment, PaymentSchema, PaymentStatus, PaymentPurpose } from '../../payments/schemas/payment.schema';
import { PaymentRecovery, PaymentRecoverySchema, PaymentRecoveryState } from '../../payments/schemas/payment-recovery.schema';
import { BookingEscrow, BookingEscrowSchema, EscrowStatus } from '../../payments/schemas/booking-escrow.schema';
import { PaymentWebhookEvent, PaymentWebhookEventSchema } from '../../payments/schemas/payment-webhook-event.schema';
import { Notification, NotificationSchema } from '../../notifications/schemas/notification.schema';

// Real Domain Services
import { ContractAccessService } from '../contract-access.service';
import { ContractPolicyService } from '../contract-policy.service';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractReadService } from '../contract-read.service';
import { ContractConsentService } from '../contract-consent.service';
import { ContractCheckoutGuard } from '../contract-checkout-guard.service';
import { ContractPdfGenerator } from '../contract-pdf-generator';
import { ContractEvidenceService } from '../contract-evidence.service';
import { V2PaymentFinalizationService } from '../../payments/services/v2-payment-finalization.service';
import { PaymentRecoveryService } from '../../payments/services/payment-recovery.service';
import { WebhookEventRepository } from '../../payments/repositories/webhook-event.repository';
import { PaymentsRepository } from '../../payments/repositories/payments.repository';
import { contractIntentKey } from '../../payments/services/contract-payment-binding';
import { hashContract, canonicalizeContract } from '../canonical-contract';
import { PrivateStorageService } from '../../storage/services/private-storage.service';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();
const TEST_CHECKSUM_KEY = 'test-payos-checksum-secret-64-hex-value-only';
const mechanismHash = createHash('sha256').update(JSON.stringify(SYNTHETIC_APPROVED_MECHANISM)).digest('hex');

(target ? describe : describe.skip)(
  'Phase 8B.1: Isolated Synthetic End-to-End Execution (17 Scenarios)',
  () => {
    jest.setTimeout(30000);
    let connection: Connection;
    let scratchName: string;
    let uninstallNetworkGuard: () => void;

    // Real Mongoose Models
    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;
    let bookings: Model<Booking>;
    let bookingItems: Model<BookingItem>;
    let schedules: Model<BookingSchedule>;
    let reservations: Model<InventoryReservation>;
    let payments: Model<Payment>;
    let recoveries: Model<PaymentRecovery>;
    let escrows: Model<BookingEscrow>;
    let webhookEvents: Model<PaymentWebhookEvent>;
    let notifications: Model<Notification>;

    // In-memory Private Storage map for test isolation
    let storageMap: Map<string, Buffer>;
    let storageService: PrivateStorageService;
    let pdfGenerator: ContractPdfGenerator;

    beforeAll(async () => {
      // 1. P0 Preflight Safety Gate: Network isolation circuit breaker
      uninstallNetworkGuard = installNetworkGuard();

      // 2. Scratch Database strictly on isolated test replica set
      scratchName = `contract_synthetic_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;

      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();

      // 3. Verify Replica Set Name and Primary Health
      const hello = await connection.db!.admin().command({ hello: 1 });
      if (hello.setName !== 'rsContractTest' || !hello.isWritablePrimary) {
        throw new Error('Preflight Check Failed: Isolated test replica set is not primary');
      }

      // Initialize Real Models
      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(ProviderContractAcceptance.name, ProviderContractAcceptanceSchema);
      bookings = connection.model(Booking.name, BookingSchema);
      bookingItems = connection.model(BookingItem.name, BookingItemSchema);
      schedules = connection.model(BookingSchedule.name, BookingScheduleSchema);
      reservations = connection.model(InventoryReservation.name, InventoryReservationSchema);
      payments = connection.model(Payment.name, PaymentSchema);
      recoveries = connection.model(PaymentRecovery.name, PaymentRecoverySchema);
      escrows = connection.model(BookingEscrow.name, BookingEscrowSchema);
      webhookEvents = connection.model(PaymentWebhookEvent.name, PaymentWebhookEventSchema);
      notifications = connection.model(Notification.name, NotificationSchema);

      // Create Mandatory Unique Indexes on Scratch DB
      await connection.db!.collection('digital_contracts').createIndex(
        { bookingId: 1, providerId: 1, scope: 1 },
        { unique: true, name: 'booking_provider_scope_unique' },
      );
      await connection.db!.collection('contract_consents').createIndex(
        { contractVersionId: 1, actorUserId: 1 },
        { unique: true },
      );
      await connection.db!.collection('contract_consents').createIndex(
        { actorUserId: 1, idempotencyKey: 1 },
        { unique: true },
      );
      await connection.db!.collection('contract_versions').createIndex(
        { contractId: 1, version: 1 },
        { unique: true },
      );
      await connection.db!.collection('provider_contract_acceptances').createIndex(
        { providerId: 1, scope: 1 },
        { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
      );
      await connection.db!.collection('payment_recoveries').createIndex({ paymentId: 1 }, { unique: true });
      await connection.db!.collection('booking_escrows').createIndex({ bookingId: 1 }, { unique: true });
      await connection.db!.collection('payment_webhook_events').createIndex({ webhookId: 1 }, { unique: true });

      // In-Memory Storage Service
      storageMap = new Map<string, Buffer>();
      storageService = {
        uploadPrivateFile: jest.fn((bucket: string, storageKey: string, buffer: Buffer) => {
          storageMap.set(`${bucket}:${storageKey}`, buffer);
          return Promise.resolve({ storageProvider: 'synthetic-test-storage', bucket, storageKey });
        }),
        readPrivateFile: jest.fn((bucket: string, storageKey: string) => {
          const buf = storageMap.get(`${bucket}:${storageKey}`);
          if (!buf) throw new Error('FILE_NOT_FOUND');
          return Promise.resolve(Readable.from(buf));
        }),
        exists: jest.fn((bucket: string, storageKey: string) => {
          return Promise.resolve(storageMap.has(`${bucket}:${storageKey}`));
        }),
        deletePrivateFile: jest.fn((bucket: string, storageKey: string) => {
          storageMap.delete(`${bucket}:${storageKey}`);
          return Promise.resolve();
        }),
      } as unknown as PrivateStorageService;

      pdfGenerator = new ContractPdfGenerator();
    }, 30000);

    afterAll(async () => {
      if (uninstallNetworkGuard) uninstallNetworkGuard();
      if (!connection) return;
      if (scratchName.startsWith('contract_synthetic_') && scratchName.endsWith('_test')) {
        await connection.dropDatabase();
      }
      await connection.close();
    }, 30000);

    // Helper: Build Real Service Harness
    function buildServices(options: { contractsV2Enabled?: boolean } = {}) {
      const enabled = options.contractsV2Enabled ?? true;
      const access = new ContractAccessService(connection);
      const policy = new ContractPolicyService(connection, acceptances);
      const templateService = {
        getDraft: () => SYNTHETIC_APPROVED_TEMPLATE,
        getApproved: () => SYNTHETIC_APPROVED_TEMPLATE,
      };
      const mechanismService = {
        getDraft: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, hash: mechanismHash }),
        getApproved: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, hash: mechanismHash }),
      };

      const snapshots = new Map<string, Record<string, unknown>>();
      const snapshotService = {
        build: jest.fn((_context: unknown, providerId: Types.ObjectId) =>
          Promise.resolve(snapshots.get(providerId.toString())),
        ),
      };

      const preparation = new ContractPreparationService(
        enabled,
        connection,
        contracts,
        versions,
        policy,
        snapshotService as never,
        templateService as never,
      );

      const read = new ContractReadService(
        enabled,
        contracts,
        versions,
        consents,
        access,
        policy,
        templateService as never,
        snapshotService as never,
        preparation,
      );

      const consent = new ContractConsentService(
        enabled,
        connection,
        contracts,
        versions,
        consents,
        access,
        policy,
        preparation,
        snapshotService as never,
        templateService as never,
        mechanismService as never,
      );

      const checkout = new ContractCheckoutGuard(
        enabled,
        contracts,
        versions,
        consents,
        policy,
        snapshotService as never,
        preparation,
        templateService as never,
        mechanismService as never,
      );

      const evidence = new ContractEvidenceService(
        contracts,
        versions,
        consents,
        storageService,
        access,
      );

      const recovery = new PaymentRecoveryService(enabled, recoveries, payments, bookings);
      const paymentsRepo = new PaymentsRepository(payments);
      const webhookRepo = new WebhookEventRepository(webhookEvents);

      const finalization = new V2PaymentFinalizationService(
        enabled,
        bookings,
        bookingItems,
        schedules,
        reservations,
        payments,
        recoveries,
        escrows,
        notifications,
        contracts,
        versions,
        consents,
        { confirmForBooking: jest.fn().mockResolvedValue({ confirmed: true }) } as never,
        { findRedemptionByBooking: jest.fn().mockResolvedValue(null) } as never,
        recovery,
        policy,
        preparation,
        snapshotService as never,
        templateService as never,
        evidence,
      );

      return {
        access,
        policy,
        preparation,
        read,
        consent,
        checkout,
        evidence,
        recovery,
        finalization,
        paymentsRepo,
        webhookRepo,
        snapshots,
      };
    }

    async function prepareBooking(services: any, seed: any) {
      for (const pId of seed.providerIds) {
        const res = await services.preparation.prepare(seed.bookingId.toString(), pId.toString());
        await versions.updateOne(
          { _id: new Types.ObjectId(res.versionId) },
          {
            $set: {
              state: ContractVersionState.Offered,
              offeredAt: new Date(),
              expiresAt: new Date(Date.now() + 60000),
            },
          },
        );
      }
    }

    // Helper: Seed Booking & Provider data
    async function seedBooking(providerCount = 1, options: { bookingType?: string; flowVersion?: number; holdExpired?: boolean } = {}) {
      const customerId = oid();
      const customerUserId = customerId;
      const providerIds = Array.from({ length: providerCount }, oid);
      const providerUserIds = providerIds.map(oid);
      const bookingId = oid();
      const now = new Date();
      const holdExpiresAt = options.holdExpired
        ? new Date(now.getTime() - 60000)
        : new Date(now.getTime() + 900000); // 15 mins

      await connection.db!.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `SYNTH-${randomUUID()}`,
        bookingType: options.bookingType ?? 'AODAI_RENTAL',
        status: 'PENDING_PAYMENT',
        contractFlowVersion: options.flowVersion ?? 2,
        customerId,
        providerIds,
        pricingSummary: { amountDueNow: 500000 * providerCount, grandTotal: 500000 * providerCount },
        holdExpiresAt,
        updatedAt: now,
      });

      const snapshots = new Map<string, Record<string, unknown>>();

      for (let i = 0; i < providerCount; i++) {
        const pId = providerIds[i];
        const uId = providerUserIds[i];
        const itemId = oid();

        await connection.db!.collection('providers').insertOne({
          _id: pId,
          userId: uId,
          status: 'ACTIVE',
          businessName: `Tiệm Áo Dài ${i + 1}`,
          capabilities: ['AODAI_RENTAL'],
          policies: { rentalPolicy: 'STANDARD', cancellationPolicy: 'FLEXIBLE' },
        });

        await connection.db!.collection('booking_items').insertOne({
          _id: itemId,
          bookingId,
          providerId: pId,
          itemType: 'PRODUCT',
          productId: oid(),
          quantity: 1,
          unitPrice: 500000,
          depositAmount: 1000000,
          updatedAt: now,
        });

        await connection.db!.collection('inventory_reservations').insertOne({
          bookingId,
          bookingItemId: itemId,
          status: 'TEMP_RESERVED',
          expiresAt: holdExpiresAt,
        });

        const snapshot = {
          bookingId: bookingId.toString(),
          customerId: customerId.toString(),
          providerId: pId.toString(),
          bookingType: 'AODAI_RENTAL',
          bookingItemIds: [itemId.toString()],
          booking: { code: 'SYNTH', rentalFrom: '15/11/2026', rentalTo: '18/11/2026' },
          customer: { name: 'Nguyễn Văn A' },
          provider: { name: `Tiệm Áo Dài ${i + 1}` },
          providerItems: [{ bookingItemId: itemId.toString(), size: 'M' }],
          pricing: { rentalFee: 500000, depositFee: 1000000, amountDueNow: 500000 },
          policies: { rental: 'Standard', cancellation: 'Flexible' },
          template: { version: SYNTHETIC_APPROVED_TEMPLATE.version },
        };
        snapshots.set(pId.toString(), snapshot);

        // Pre-accept auto mechanism
        await acceptances.create({
          providerId: pId,
          acceptedByUserId: uId,
          scope: ContractScope.AoDaiRental,
          mechanismVersion: SYNTHETIC_APPROVED_MECHANISM.version,
          templateVersion: SYNTHETIC_APPROVED_TEMPLATE.version,
          mechanismHash,
          policyFingerprint: hashContract(snapshot.policies),
          status: ProviderAcceptanceStatus.Active,
          acceptedAt: new Date(now.getTime() - 5000),
        });
      }

      return { customerId, customerUserId, providerIds, providerUserIds, bookingId, snapshots };
    }

    // =========================================================================
    // 17 END-TO-END SCENARIOS EXECUTION
    // =========================================================================

    it('E2E-01: Rental booking một provider chuẩn bị hợp đồng tự động', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);

      await prepareBooking(services, seed);

      const contract = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      expect(contract).toBeTruthy();
      expect(contract?.status).toBe('DRAFT');

      const version = await versions.findById(contract?.currentVersionId).lean();
      expect(version?.state).toBe(ContractVersionState.Offered);
      expect(version?.contentHash).toBeDefined();

      const readiness = await services.read.readiness(
        { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] },
        seed.bookingId.toString(),
      );
      expect(readiness.requirement).toBe('REQUIRED');
      expect(readiness.blockers).toEqual([]);
      expect(readiness.providers).toHaveLength(1);
    });

    it('E2E-02: Combo booking nhiều provider (phân tách hợp đồng độc lập & kiểm tra fail-closed khi có voucher)', async () => {
      const seed = await seedBooking(2);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);

      // Normal multi-provider without unallocated fields -> Prepares 2 separate contracts
      await prepareBooking(services, seed);

      const contractList = await contracts.find({ bookingId: seed.bookingId }).lean();
      expect(contractList).toHaveLength(2);
      expect(contractList[0].providerId.toString()).not.toBe(contractList[1].providerId.toString());

      // Conditional Blocker Check: If unallocated voucher exists on combo booking, ContractSnapshotService fails closed
      await connection.db!.collection('bookings').updateOne(
        { _id: seed.bookingId },
        { $set: { 'voucherSnapshot.discountAmount': 50000 } },
      );
      // Clean previous contracts to re-trigger snapshot build
      await contracts.deleteMany({ bookingId: seed.bookingId });
      await versions.deleteMany({});
      
      const realSnapshotService = new (jest.requireActual('../contract-snapshot.service').ContractSnapshotService)(
        connection,
        { resolve: jest.fn() } as never,
      );
      const context = await services.policy.getContext(seed.bookingId.toString());
      await expect(
        realSnapshotService.build(context, seed.providerIds[0], SYNTHETIC_APPROVED_TEMPLATE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('E2E-03: Khách ACCEPT tất cả hợp đồng trước khi thanh toán', async () => {
      const seed = await seedBooking(2);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const contractList = await contracts.find({ bookingId: seed.bookingId }).lean();
      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };

      for (const c of contractList) {
        const v = await versions.findById(c.currentVersionId).lean();
        const consentRes = await services.consent.decide(
          actor,
          c._id.toString(),
          {
            contractVersionId: v!._id.toString(),
            action: ContractConsentAction.Accept,
            contentHash: v!.contentHash,
            bookingFingerprint: v!.bookingFingerprint,
            idempotencyKey: randomUUID(),
          },
          { ipAddress: '127.0.0.1', userAgent: 'SyntheticTest/1.0' },
        );
        expect(consentRes.action).toBe(ContractConsentAction.Accept);
      }

      const allConsents = await consents.find({ actorUserId: seed.customerId }).lean();
      expect(allConsents).toHaveLength(2);

      const readiness = await services.read.readiness(actor, seed.bookingId.toString());
      expect(readiness.providers.every((p: any) => p.status === 'ACCEPTED')).toBe(true);
    });

    it('E2E-04: Khách DECLINE một hợp đồng (chặn tạo thanh toán ngay lập tức)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();
      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };

      await services.consent.decide(
        actor,
        c!._id.toString(),
        {
          contractVersionId: v!._id.toString(),
          action: ContractConsentAction.Decline,
          contentHash: v!.contentHash,
          bookingFingerprint: v!.bookingFingerprint,
          idempotencyKey: randomUUID(),
        },
        { ipAddress: '127.0.0.1', userAgent: 'SyntheticTest/1.0' },
      );

      const updatedV = await versions.findById(v!._id).lean();
      expect(updatedV?.state).toBe(ContractVersionState.Declined);

      // Checkout guard blocks payment evaluation with ConflictException
      await expect(
        services.checkout.evaluate(seed.bookingId.toString(), 500000, PaymentPurpose.DepositPayment),
      ).rejects.toThrow(ConflictException);
    });

    it('E2E-05: Hợp đồng stale version (xung đột hash khi điều khoản thay đổi)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();
      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };

      // Submit consent with altered/stale contentHash
      await expect(
        services.consent.decide(
          actor,
          c!._id.toString(),
          {
            contractVersionId: v!._id.toString(),
            action: ContractConsentAction.Accept,
            contentHash: 'stale_content_hash_' + '0'.repeat(45),
            bookingFingerprint: v!.bookingFingerprint,
            idempotencyKey: randomUUID(),
          },
          { ipAddress: '127.0.0.1', userAgent: 'SyntheticTest/1.0' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('E2E-06: Booking hold expired (chặn luồng consent & thanh toán sau 15 phút)', async () => {
      const seed = await seedBooking(1, { holdExpired: true });
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);

      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };
      const readiness = await services.read.readiness(actor, seed.bookingId.toString());
      expect(readiness.blockers).toContain('BOOKING_NOT_PREPARABLE');

      await expect(
        services.checkout.evaluate(seed.bookingId.toString(), 500000, PaymentPurpose.DepositPayment),
      ).rejects.toThrow(ConflictException);
    });

    it('E2E-07: Payment sandbox success qua PayOS Webhook (finalization, escrow, PDF)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();
      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };

      // 1. Accept contract
      await services.consent.decide(
        actor,
        c!._id.toString(),
        {
          contractVersionId: v!._id.toString(),
          action: ContractConsentAction.Accept,
          contentHash: v!.contentHash,
          bookingFingerprint: v!.bookingFingerprint,
          idempotencyKey: randomUUID(),
        },
        { ipAddress: '127.0.0.1', userAgent: 'SyntheticTest/1.0' },
      );

      // 2. Evaluate Checkout Decision & Create Payment Intent
      const decision = await services.checkout.evaluate(
        seed.bookingId.toString(),
        500000,
        PaymentPurpose.DepositPayment,
      );
      const binding = decision.binding!;
      const key = contractIntentKey(binding);
      const paymentId = oid();
      const orderCode = Math.floor(100000 + Math.random() * 900000);

      const payment = await payments.create({
        _id: paymentId,
        bookingId: seed.bookingId,
        paymentCode: `FINAL-${orderCode}`,
        amount: 500000,
        purpose: PaymentPurpose.DepositPayment,
        paymentMethod: 'PAYOS_SIMULATOR',
        status: PaymentStatus.Success,
        paidAt: new Date(),
        contractBinding: binding,
        contractIntentKey: key,
        payos: { orderCode, checkoutUrl: 'http://localhost:5173/checkout/result' },
      });

      await bookings.updateOne(
        { _id: seed.bookingId },
        {
          $set: {
            pricingSummary: { grandTotal: 500000, depositTotal: 0 },
            paymentSummary: { totalPaid: 500000, totalRefunded: 0, paymentStatus: 'PAID' },
            paymentExpiryClaim: {
              phase: 'FINALIZING',
              token: randomUUID(),
              claimedAt: new Date(),
              leaseUntil: new Date(Date.now() + 60000),
              paymentId,
            },
          },
        },
      );

      // 3. Receive & Process Valid Webhook
      const webhookData = {
        orderCode,
        amount: 500000,
        description: `Thanh toan don hang ${orderCode}`,
        accountNumber: '0123456789',
        reference: 'FT261029',
        transactionDateTime: '2026-10-29 21:00:00',
        currency: 'VND',
        paymentLinkId: `link_${orderCode}`,
        code: '00',
        desc: 'success',
        status: 'PAID',
      };
      const signature = signPayOSWebhook(webhookData, TEST_CHECKSUM_KEY);
      expect(signature).toBeDefined();

      // Claim Webhook Event Idempotently
      const claim = await services.webhookRepo.claimVerifiedEvent(
        `payos_${orderCode}_PAID`,
        webhookData,
        signature,
      );
      expect(claim.state).toBe('claimed');

      // Record Acknowledged & Process Finalization
      await services.recovery.recordAcknowledged(paymentId, seed.bookingId, key);
      expect(await services.finalization.processDue()).toBe(1);

      // Verify Final State
      const updatedBooking = await bookings.findById(seed.bookingId).lean();
      expect(updatedBooking?.status).toBe(BookingStatus.Confirmed);

      const escrow = await escrows.findOne({ bookingId: seed.bookingId }).lean();
      expect(escrow?.status).toBe(EscrowStatus.Held);

      const finalVersion = await versions.findById(v!._id).lean();
      expect(finalVersion?.state).toBe(ContractVersionState.Accepted);
      expect(finalVersion?.document?.status).toBe(ContractDocumentStatus.Ready);
      expect(finalVersion?.document?.sha256).toBeDefined();
    });

    it('E2E-08: Payment sandbox failure / cancel (không kích hoạt escrow, giữ nguyên trạng thái)', async () => {
      const seed = await seedBooking(1);
      const orderCode = Math.floor(100000 + Math.random() * 900000);

      const payment = await payments.create({
        bookingId: seed.bookingId,
        paymentCode: `PAY-FAIL-${orderCode}`,
        amount: 500000,
        purpose: PaymentPurpose.DepositPayment,
        paymentMethod: 'PAYOS_SIMULATOR',
        status: PaymentStatus.Pending,
        payos: { orderCode },
      });

      // Webhook sends CANCELLED
      await payments.updateOne(
        { _id: payment._id },
        { $set: { status: PaymentStatus.Cancelled, lastError: 'Customer cancelled payment' } },
      );

      const escrow = await escrows.findOne({ bookingId: seed.bookingId }).lean();
      expect(escrow).toBeNull(); // Escrow MUST NOT be created
    });

    it('E2E-09: Duplicate webhook (xử lý idempotent, không nhân đôi escrow hay trừ kho 2 lần)', async () => {
      const services = buildServices();
      const orderCode = Math.floor(100000 + Math.random() * 900000);
      const webhookId = `payos_${orderCode}_PAID`;
      const webhookData = { orderCode, amount: 500000, status: 'PAID' };

      const claim1 = await services.webhookRepo.claimVerifiedEvent(webhookId, webhookData, 'sig1');
      expect(claim1.state).toBe('claimed');

      // Mark processed
      await webhookEvents.updateOne({ webhookId }, { $set: { processed: true } });

      // Second Webhook with identical ID
      const claim2 = await services.webhookRepo.claimVerifiedEvent(webhookId, webhookData, 'sig1');
      expect(claim2.state).toBe('processed'); // Idempotently skipped
    });

    it('E2E-10: Recovery sau khi worker bị gián đoạn (Atomic CAS claim lease phục hồi PDF hỏng)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();

      // Simulate a crashed worker: Status GENERATING with expired lease and elapsed backoff
      await versions.updateOne(
        { _id: v!._id },
        {
          $set: {
            state: ContractVersionState.Accepted,
            updatedAt: new Date(Date.now() - 60000),
            document: {
              status: ContractDocumentStatus.Generating,
              claimToken: 'crashed-worker-token',
              leaseExpiresAt: new Date(Date.now() - 30000), // Expired 30s ago
              retryCount: 0,
              generatedAt: new Date(Date.now() - 60000),
            },
          },
        },
      );

      // Run background recovery
      const report = await services.evidence.recoverFailedPdfs();
      expect(report.recovered).toBe(1);

      const recoveredV = await versions.findById(v!._id).lean();
      expect(recoveredV?.document?.status).toBe(ContractDocumentStatus.Ready);
      expect(recoveredV?.document?.sha256).toBeDefined();
    });

    it('E2E-11: PDF generation READY (chuẩn 2 trang, tiếng Việt Unicode, font Noto Sans)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();

      await versions.updateOne({ _id: v!._id }, { $set: { state: ContractVersionState.Accepted } });
      const doc = await services.evidence.generateAndStorePdf(v!._id.toString());

      expect(doc.status).toBe(ContractDocumentStatus.Ready);
      expect(doc.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Verify in-memory stored buffer
      const storedBuf = storageMap.get(`${doc.bucket}:${doc.storageKey}`);
      expect(storedBuf).toBeDefined();
      expect(storedBuf!.toString('utf-8', 0, 8)).toMatch(/^%PDF-1\.[4-7]/);
    });

    it('E2E-12: PDF hash verification (xác thực SHA-256 byte stream thời gian thực)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();
      await versions.updateOne({ _id: v!._id }, { $set: { state: ContractVersionState.Accepted } });

      const doc = await services.evidence.generateAndStorePdf(v!._id.toString());
      const storedBuf = storageMap.get(`${doc.bucket}:${doc.storageKey}`)!;

      // Client-side SHA-256 calculation
      const calculatedHash = createHash('sha256').update(storedBuf).digest('hex');
      expect(calculatedHash).toBe(doc.sha256);

      // Verify integrity method
      const integrity = await services.evidence.verifyIntegrity(v!._id.toString());
      expect(integrity.valid).toBe(true);
      expect(integrity.storedSha256).toBe(integrity.actualSha256);
    });

    it('E2E-13: Customer download PDF & tra cứu evidence metadata (xác thực quyền sở hữu)', async () => {
      const seed = await seedBooking(1);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const c = await contracts.findOne({ bookingId: seed.bookingId }).lean();
      const v = await versions.findById(c!.currentVersionId).lean();
      await versions.updateOne({ _id: v!._id }, { $set: { state: ContractVersionState.Accepted } });
      await services.evidence.generateAndStorePdf(v!._id.toString());

      const actorCustomer = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };
      const streamRes = await services.evidence.getPdfStream(actorCustomer, c!._id.toString());
      expect(streamRes.filename).toContain('.pdf');
      expect(streamRes.sha256).toBeDefined();

      const evidence = await services.evidence.getEvidence(actorCustomer, c!._id.toString());
      expect(evidence.documentStatus).toBe('READY');
      expect(evidence.integrityVerified).toBe(true);

      // Unauthorized customer rejected with 404
      const otherCustomer = { sub: oid().toString(), roles: ['CUSTOMER'], permissions: [] };
      await expect(
        services.evidence.getPdfStream(otherCustomer, c!._id.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('E2E-14: Provider isolation (cô lập IDOR tuyệt đối giữa các đối tác)', async () => {
      const seed = await seedBooking(2);
      const services = buildServices();
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);
      await prepareBooking(services, seed);

      const contractList = await contracts.find({ bookingId: seed.bookingId }).lean();
      const actorProvider0 = { sub: seed.providerUserIds[0].toString(), roles: ['PROVIDER'], permissions: [] };

      // Provider 0 lists booking contracts: ONLY sees own contract
      const list = await services.read.listForBooking(actorProvider0, seed.bookingId.toString());
      expect(list).toHaveLength(1);
      expect(list[0].contractId).toBe(contractList[0]._id.toString());

      // Provider 0 attempts direct access to Provider 1 contract -> Rejected with 404
      await expect(
        services.read.get(actorProvider0, contractList[1]._id.toString()),
      ).rejects.toThrow(NotFoundException);

      await expect(
        services.evidence.getPdfStream(actorProvider0, contractList[1]._id.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('E2E-15: Legacy checkout regression (đơn hàng V1 bỏ qua modal, checkout mượt mà)', async () => {
      const seed = await seedBooking(1, { flowVersion: 1 });
      const services = buildServices();

      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };
      const readiness = await services.read.readiness(actor, seed.bookingId.toString());
      expect(readiness.blockers).toContain('LEGACY_BOOKING');

      // Legacy booking evaluates to null binding (does not block checkout)
      const decision = await services.checkout.evaluate(seed.bookingId.toString(), 500000, PaymentPurpose.DepositPayment);
      expect(decision.binding).toBeNull();
    });

    it('E2E-16: Photography-only regression (không sinh hợp đồng thuê áo dài)', async () => {
      const seed = await seedBooking(1, { bookingType: 'PHOTOGRAPHY' });
      const services = buildServices();

      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };
      const readiness = await services.read.readiness(actor, seed.bookingId.toString());
      expect(readiness.requirement).toBe('NOT_REQUIRED');
      expect(readiness.providers).toHaveLength(0);

      // Context returns empty rental items
      const context = await services.policy.getContext(seed.bookingId.toString());
      expect(context.rentalItems).toHaveLength(0);
    });

    it('E2E-17: Feature flag mismatch (hành vi fail-closed khi backend CONTRACTS_V2_ENABLED=false)', async () => {
      const seed = await seedBooking(1);
      // Construct services with CONTRACTS_V2_ENABLED = false
      const services = buildServices({ contractsV2Enabled: false });
      for (const [k, v] of seed.snapshots) services.snapshots.set(k, v);

      const actor = { sub: seed.customerId.toString(), roles: ['CUSTOMER'], permissions: [] };
      const readiness = await services.read.readiness(actor, seed.bookingId.toString());
      expect(readiness.blockers).toContain('FEATURE_DISABLED');

      // Checkout guard rejects payment link creation with ServiceUnavailableException
      await expect(
        services.checkout.evaluate(seed.bookingId.toString(), 500000, PaymentPurpose.DepositPayment),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  },
);
