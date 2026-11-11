import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { Connection, Model, Types, createConnection } from 'mongoose';
import { contractTestTarget } from '../contract-test-target';
import {
  SYNTHETIC_APPROVED_MECHANISM,
  SYNTHETIC_APPROVED_TEMPLATE,
  installNetworkGuard,
} from './fixtures/synthetic-contract.fixture';

// Domain Schemas
import {
  ContractApprovalMode,
  ContractScope,
  DigitalContract,
  DigitalContractSchema,
} from '../../bookings/schemas/digital-contract.schema';
import {
  ContractDocumentStatus,
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
import {
  ProviderContractPolicyVersion,
  ProviderContractPolicyVersionSchema,
  ProviderPolicyReviewStatus,
} from '../schemas/provider-contract-policy.schema';
import {
  Booking,
  BookingSchema,
  BookingStatus,
  BookingType,
} from '../../bookings/schemas/booking.schema';
import {
  BookingItem,
  BookingItemSchema,
} from '../../bookings/schemas/booking-item.schema';
import {
  Payment,
  PaymentPurpose,
  PaymentSchema,
  PaymentStatus,
} from '../../payments/schemas/payment.schema';

// Real Domain Services
import { ContractAccessService } from '../contract-access.service';
import { ContractMechanismService } from '../contract-mechanism.service';
import { ContractTemplateService } from '../contract-template';
import { ContractPolicyService } from '../contract-policy.service';
import { ContractSnapshotService } from '../contract-snapshot.service';
import { ContractPreparationService } from '../contract-preparation.service';
import { ContractReadService } from '../contract-read.service';
import { ContractConsentService } from '../contract-consent.service';
import { ContractCheckoutGuard } from '../contract-checkout-guard.service';
import { ContractEvidenceService } from '../contract-evidence.service';
import { ContractPdfGenerator } from '../contract-pdf-generator';
import { ProviderContractApprovalService } from '../provider-contract-approval.service';
import { ProviderContractPolicyService } from '../provider-contract-policy.service';
import { hashContract } from '../canonical-contract';
import { PrivateStorageService } from '../../storage/services/private-storage.service';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)(
  'Contracts V2: Full Lifecycle E2E Suite (Happy Path & Negative Invariants)',
  () => {
    jest.setTimeout(35000);
    let connection: Connection;
    let scratchName: string;
    let uninstallNetworkGuard: () => void;

    // Models
    let contracts: Model<DigitalContract>;
    let versions: Model<ContractVersion>;
    let consents: Model<ContractConsent>;
    let acceptances: Model<ProviderContractAcceptance>;
    let policyVersions: Model<ProviderContractPolicyVersion>;
    let bookings: Model<Booking>;
    let bookingItems: Model<BookingItem>;
    let payments: Model<Payment>;

    // In-memory Storage for isolated PDF tests
    let storageMap: Map<string, Buffer>;
    let storageService: PrivateStorageService;
    let pdfGenerator: ContractPdfGenerator;

    // Domain Services
    let accessService: ContractAccessService;
    let mechanismService: ContractMechanismService;
    let templateService: ContractTemplateService;
    let systemPolicyResolver: any;
    let snapshotService: ContractSnapshotService;
    let contractPolicyService: ContractPolicyService;
    let preparationService: ContractPreparationService;
    let readService: ContractReadService;
    let consentService: ContractConsentService;
    let checkoutGuard: ContractCheckoutGuard;
    let evidenceService: ContractEvidenceService;
    let providerApprovalService: ProviderContractApprovalService;
    let providerPolicyService: ProviderContractPolicyService;

    const mockMechanismHash = createHash('sha256')
      .update(JSON.stringify(SYNTHETIC_APPROVED_MECHANISM))
      .digest('hex');

    beforeAll(async () => {
      uninstallNetworkGuard = installNetworkGuard();

      scratchName = `contract_v2_e2e_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchName}`;

      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 8000,
      }).asPromise();

      // Compile Models
      contracts = connection.model(DigitalContract.name, DigitalContractSchema);
      versions = connection.model(ContractVersion.name, ContractVersionSchema);
      consents = connection.model(ContractConsent.name, ContractConsentSchema);
      acceptances = connection.model(ProviderContractAcceptance.name, ProviderContractAcceptanceSchema);
      policyVersions = connection.model(ProviderContractPolicyVersion.name, ProviderContractPolicyVersionSchema);
      bookings = connection.model(Booking.name, BookingSchema);
      bookingItems = connection.model(BookingItem.name, BookingItemSchema);
      payments = connection.model(Payment.name, PaymentSchema);

      // Create Partial Indexes
      await acceptances.collection.createIndex(
        { providerId: 1, scope: 1 },
        { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
      );
      await policyVersions.collection.createIndex(
        { providerId: 1, versionNumber: -1 },
        { unique: true },
      );

      // Setup In-memory Private Storage
      storageMap = new Map();
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
      } as unknown as PrivateStorageService;

      pdfGenerator = new ContractPdfGenerator();

      // Setup Services
      accessService = new ContractAccessService(connection);

      mechanismService = {
        getDraft: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, hash: mockMechanismHash }),
        getApproved: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, hash: mockMechanismHash }),
      } as unknown as ContractMechanismService;

      templateService = {
        getApproved: () => SYNTHETIC_APPROVED_TEMPLATE,
        compile: () => 'Hop dong thue dien tu ao dai VibeHue',
      } as unknown as ContractTemplateService;

      systemPolicyResolver = {
        clearCache: jest.fn(),
        getActivePolicyByCode: jest.fn((code: string) =>
          Promise.resolve({
            code,
            version: 1,
            value: { autoApproveFreeCancelRefund: true },
          }),
        ),
      };

      snapshotService = new ContractSnapshotService(
        connection,
        systemPolicyResolver,
      );

      contractPolicyService = new ContractPolicyService(
        connection,
        acceptances,
      );

      providerApprovalService = new ProviderContractApprovalService(
        true,
        connection,
        acceptances,
        accessService,
        mechanismService,
        templateService,
        snapshotService,
      );

      providerPolicyService = new ProviderContractPolicyService(
        true,
        connection,
        policyVersions,
        accessService,
      );

      preparationService = new ContractPreparationService(
        true,
        connection,
        contracts,
        versions,
        contractPolicyService,
        snapshotService,
        templateService,
      );

      readService = new ContractReadService(
        true,
        contracts,
        versions,
        consents,
        accessService,
        contractPolicyService,
        templateService,
        snapshotService,
        preparationService,
      );

      consentService = new ContractConsentService(
        true,
        connection,
        contracts,
        versions,
        consents,
        accessService,
        contractPolicyService,
        preparationService,
        snapshotService,
        templateService,
        mechanismService,
      );

      checkoutGuard = new ContractCheckoutGuard(
        true,
        contracts,
        versions,
        consents,
        contractPolicyService,
        snapshotService,
        preparationService,
        templateService,
        mechanismService,
      );

      evidenceService = new ContractEvidenceService(
        contracts,
        versions,
        consents,
        storageService,
        accessService,
      );
    });

    afterAll(async () => {
      uninstallNetworkGuard();
      if (connection) {
        try {
          await connection.dropDatabase();
        } catch {}
        await connection.close();
      }
    });

    // Helper to seed complete test entities
    async function setupTestContext() {
      const providerUserId = oid();
      const providerId = oid();
      const customerUserId = oid();
      const bookingId = oid();
      const productId = oid();
      const bookingItemId = oid();

      await connection.collection('users').insertOne({
        _id: customerUserId,
        profile: { fullName: 'Trần Thị Khách Hàng' },
        auth: { email: 'customer@vibehue.test' },
      });

      await connection.collection('providers').insertOne({
        _id: providerId,
        userId: providerUserId,
        businessName: 'Áo Dài Cung Đình Huế',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
        contact: { phone: '0905123456', email: 'cungdinh@vibehue.test' },
        address: { fullAddress: '123 Lê Lợi, TP Huế' },
        policies: {
          rentalPolicy: 'Quy tắc bảo quản áo dài cung đình.',
          cancellationPolicy: 'Hủy trước 48h hoàn 100%.',
        },
        updatedAt: new Date(),
      });

      const now = new Date();
      const rentalFrom = new Date(now.getTime() + 86400000 * 2);
      const rentalTo = new Date(rentalFrom.getTime() + 86400000 * 2);

      await connection.collection('bookings').insertOne({
        _id: bookingId,
        bookingCode: `BK_${oid().toHexString().slice(0, 8)}`,
        customerId: customerUserId,
        bookingType: 'AODAI_RENTAL',
        providerIds: [providerId],
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        holdExpiresAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 mins
        contractFlowVersion: 2,
        pricingSummary: {
          totalAmount: 500000,
          rentalFeeTotal: 400000,
          depositTotal: 100000,
          finalAmount: 500000,
        },
        createdAt: now,
        updatedAt: now,
      });

      await connection.collection('booking_items').insertOne({
        _id: bookingItemId,
        bookingId,
        providerId,
        productId,
        productName: 'Áo Dài Tấc Sa Cát Đỏ Cung Đình',
        itemType: 'PRODUCT',
        quantity: 1,
        selectedSize: 'M',
        selectedColor: 'Đỏ',
        unitPrice: 400000,
        depositAmount: 100000,
        rentalFrom,
        rentalTo,
        priceVersionId: oid(),
        createdAt: now,
        updatedAt: now,
      });

      const inventoryItemId = oid();
      await connection.collection('products').insertOne({
        _id: productId,
        providerId,
        name: 'Áo Dài Tấc Sa Cát Đỏ Cung Đình',
        sizes: ['M'],
        colors: ['Đỏ'],
      });

      await connection.collection('inventory_items').insertOne({
        _id: inventoryItemId,
        productId,
        providerId,
        size: 'M',
        color: 'Đỏ',
        status: 'AVAILABLE',
      });

      await connection.collection('inventory_reservations').insertOne({
        _id: oid(),
        bookingId,
        bookingItemId,
        inventoryItemId,
        status: 'TEMP_RESERVED',
        reservedFrom: new Date(rentalFrom),
        reservedTo: new Date(rentalTo),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });

      const providerUser = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: ['provider:read', 'provider:write'],
        email: 'provider@vibehue.test',
        sessionId: 'sess_p',
      };

      const customerUser = {
        sub: customerUserId.toString(),
        roles: ['CUSTOMER'],
        permissions: ['user:read'],
        email: 'customer@vibehue.test',
        sessionId: 'sess_c',
      };

      const adminUser = {
        sub: oid().toString(),
        roles: ['ADMIN'],
        permissions: ['user:read', 'provider:read', 'admin:write'],
        email: 'admin@vibehue.test',
        sessionId: 'sess_a',
      };

      return {
        providerUserId,
        providerId,
        customerUserId,
        bookingId,
        productId,
        bookingItemId,
        providerUser,
        customerUser,
        adminUser,
      };
    }

    // ==========================================
    // 1. HAPPY PATH: FULL LIFECYCLE E2E TEST
    // ==========================================
    it('1. HAPPY PATH: Provider accepts mechanism -> saves draft -> admin approves policy -> customer views preview -> customer accepts contract -> guard passes -> binding verified -> PDF verified', async () => {
      const ctx = await setupTestContext();

      // Step 1: Provider accepts synthetic approved mechanism
      const acceptRes = await providerApprovalService.accept(
        ctx.providerUser,
        mockMechanismHash,
      );
      expect(acceptRes.acceptanceId).toBeDefined();

      const initialStatus = await providerApprovalService.status(ctx.providerUser);
      expect(initialStatus.status).toBe('ACTIVE');

      // Step 2: Provider creates DRAFT policy (4 groups, NO accessories)
      const draftDto = {
        garmentCare: {
          allowIroning: true,
          allowWashing: false,
          prohibitedActions: ['Giặt máy', 'Chất tẩy mạnh'],
          specialNotes: 'Chỉ ủi hơi nước mặt trái',
        },
        lateReturn: {
          gracePeriodHours: 2,
          hourlyLateFee: 20000,
          dailyLateFee: 100000,
          maxLateDaysAllowed: 3,
        },
        damageCompensation: {
          minorDamageFee: 50000,
          moderateDamagePercent: 20,
          severeDamageOrLossPercent: 100,
          disputeResolutionNotes: 'Hòa giải theo quy chuẩn sàn',
        },
        cancellationPolicy: {
          refundRules: [
            { daysBeforeRental: 3, refundPercentage: 100 },
            { daysBeforeRental: 1, refundPercentage: 50 },
          ],
          cancellationNotes: 'Tiền cọc luôn hoàn 100% khi chưa nhận áo.',
        },
        supportContact: {
          hotline: '0905123456',
          supportWorkingHours: '08:00 - 21:00',
        },
        customTermsText: 'Khách hàng vui lòng kiểm tra kỹ cúc áo và đường chỉ khi nhận bàn giao.',
      };

      const draftPolicy = await providerPolicyService.saveDraft(ctx.providerUser, draftDto);
      expect(draftPolicy.versionNumber).toBe(1);
      expect(draftPolicy.status).toBe(ProviderPolicyReviewStatus.Draft);

      // Step 3: Provider submits draft for review -> PENDING_REVIEW
      const submitted = await providerPolicyService.submitForReview(ctx.providerUser);
      expect(submitted.status).toBe(ProviderPolicyReviewStatus.PendingReview);
      expect(submitted.policyFingerprint).toBeDefined();

      // Step 4: Admin reviews and APPROVES the policy
      const approved = await providerPolicyService.adminReview(
        ctx.adminUser,
        submitted.id,
        { action: 'APPROVE', reviewNote: 'Điều khoản đạt tiêu chuẩn sàn VibeHue.' },
      );
      expect(approved.status).toBe(ProviderPolicyReviewStatus.Approved);
      expect(approved.approvedAt).toBeDefined();

      // Step 5: Provider acceptance status transitions to STALE because shop policy fingerprint changed
      const staleCheck = await providerApprovalService.status(ctx.providerUser);
      expect(staleCheck.status).toBe('STALE');
      expect(staleCheck.isStale).toBe(true);

      // Step 6: Provider re-accepts mechanism to acknowledge updated policy
      const reacceptRes = await providerApprovalService.accept(
        ctx.providerUser,
        mockMechanismHash,
      );
      expect(reacceptRes.acceptanceId).toBeDefined();

      const refreshedStatus = await providerApprovalService.status(ctx.providerUser);
      expect(refreshedStatus.status).toBe('ACTIVE');
      expect(refreshedStatus.isStale).toBe(false);

      // Step 7: System prepares contract version for customer booking
      const prepRes = await preparationService.prepare(
        ctx.bookingId.toString(),
        ctx.providerId.toString(),
      );
      expect(prepRes.contractId).toBeDefined();
      expect(prepRes.versionId).toBeDefined();

      const versionDoc = await versions.findById(prepRes.versionId).lean();
      expect(versionDoc).toBeDefined();
      expect(versionDoc?.state).toBe(ContractVersionState.Offered);

      // Step 8: Customer reads contract details & A4 Preview
      const contractDetail = await readService.get(ctx.customerUser, prepRes.contractId.toString());
      expect(contractDetail.contractId).toBe(prepRes.contractId.toString());
      expect(contractDetail.version).toBe(1);
      expect(contractDetail.renderedText).toContain('Áo Dài Cung Đình Huế');
      expect(contractDetail.renderedText).toContain('Chỉ ủi hơi nước mặt trái');
      expect(contractDetail.renderedText).toContain('20000');

      // Step 9: Customer ACCEPTS contract
      const consentRes = await consentService.decide(
        ctx.customerUser,
        prepRes.contractId.toString(),
        {
          action: ContractConsentAction.Accept,
          contractVersionId: prepRes.versionId.toString(),
          contentHash: versionDoc!.contentHash,
          bookingFingerprint: versionDoc!.bookingFingerprint,
          idempotencyKey: `consent_idem_${oid().toHexString()}`,
        },
      );
      expect(consentRes.consentId).toBeDefined();
      expect(consentRes.action).toBe(ContractConsentAction.Accept);

      // Step 10: ContractCheckoutGuard evaluates -> PASS
      const decision = await checkoutGuard.evaluate(
        ctx.bookingId.toString(),
        500000,
        PaymentPurpose.Deposit,
      );
      expect(decision.binding).toBeDefined();
      expect(decision.binding?.flowVersion).toBe(2);
      expect(decision.binding?.versions.length).toBe(1);
      expect(decision.binding?.versions[0].contentHash).toBe(versionDoc!.contentHash);

      // Step 11: Verify PDF evidence generation and hash verification
      const pdfEvidence = await evidenceService.getPdfStream(
        ctx.customerUser,
        prepRes.contractId.toString(),
      );
      expect(pdfEvidence.filename).toContain('.pdf');
      expect(pdfEvidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    // ==========================================
    // 2. NEGATIVE INVARIANTS & SECURITY CHECKS
    // ==========================================
    it('2. Negative: Provider cannot accept when mechanism is DRAFT (Fail Closed)', async () => {
      const ctx = await setupTestContext();
      const draftApprovalService = new ProviderContractApprovalService(
        true,
        connection,
        acceptances,
        accessService,
        {
          getDraft: () => ({ ...SYNTHETIC_APPROVED_MECHANISM, status: 'DRAFT' }),
          getApproved: () => {
            throw new UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED');
          },
        } as unknown as ContractMechanismService,
        templateService,
        snapshotService,
      );

      await expect(
        draftApprovalService.accept(ctx.providerUser, mockMechanismHash),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('3. Negative: ContractCheckoutGuard fails when Provider has NOT accepted mechanism', async () => {
      const ctx = await setupTestContext();
      await expect(
        preparationService.prepare(ctx.bookingId.toString(), ctx.providerId.toString()),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('4. Negative: ContractCheckoutGuard fails when Provider acceptance is REVOKED', async () => {
      const ctx = await setupTestContext();
      await providerApprovalService.accept(ctx.providerUser, mockMechanismHash);
      await preparationService.prepare(ctx.bookingId.toString(), ctx.providerId.toString());

      // Provider revokes acceptance
      await providerApprovalService.revoke(ctx.providerUser);

      await expect(
        checkoutGuard.evaluate(ctx.bookingId.toString(), 500000, PaymentPurpose.Deposit),
      ).rejects.toThrow(ConflictException);
    });

    it('5. Negative: Provider cannot edit policy when status is PENDING_REVIEW', async () => {
      const ctx = await setupTestContext();
      const draftDto = {
        garmentCare: { allowIroning: true, allowWashing: false, prohibitedActions: [] },
        lateReturn: { gracePeriodHours: 2, hourlyLateFee: 20000, dailyLateFee: 100000, maxLateDaysAllowed: 3 },
        damageCompensation: { minorDamageFee: 50000, moderateDamagePercent: 20, severeDamageOrLossPercent: 100 },
        cancellationPolicy: { refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }] },
        supportContact: { hotline: '0905123456', supportWorkingHours: '08:00 - 21:00' },
      };

      await providerPolicyService.saveDraft(ctx.providerUser, draftDto);
      await providerPolicyService.submitForReview(ctx.providerUser);

      // Attempt to save draft while pending review -> locked
      await expect(
        providerPolicyService.saveDraft(ctx.providerUser, draftDto),
      ).rejects.toThrow(ConflictException);
    });

    it('6. Negative: Admin cannot reject policy without a reason note (Mandatory note)', async () => {
      const ctx = await setupTestContext();
      const draftDto = {
        garmentCare: { allowIroning: true, allowWashing: false, prohibitedActions: [] },
        lateReturn: { gracePeriodHours: 2, hourlyLateFee: 20000, dailyLateFee: 100000, maxLateDaysAllowed: 3 },
        damageCompensation: { minorDamageFee: 50000, moderateDamagePercent: 20, severeDamageOrLossPercent: 100 },
        cancellationPolicy: { refundRules: [{ daysBeforeRental: 3, refundPercentage: 100 }] },
        supportContact: { hotline: '0905123456', supportWorkingHours: '08:00 - 21:00' },
      };

      await providerPolicyService.saveDraft(ctx.providerUser, draftDto);
      const pending = await providerPolicyService.submitForReview(ctx.providerUser);

      // Attempt reject with empty note -> rejected
      await expect(
        providerPolicyService.adminReview(ctx.adminUser, pending.id, {
          action: 'REJECT',
          reviewNote: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Negative: Non-admin role cannot approve or reject policies', async () => {
      const ctx = await setupTestContext();
      const nonAdminUser = {
        sub: oid().toString(),
        roles: ['CUSTOMER'],
        permissions: [],
        email: 'attacker@evil.test',
        sessionId: 'sess_bad',
      };

      await expect(
        providerPolicyService.adminReview(nonAdminUser, oid().toString(), { action: 'APPROVE' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('8. Negative: Booking hold expiration causes ContractCheckoutGuard to reject (BOOKING_HOLD_EXPIRED)', async () => {
      const ctx = await setupTestContext();
      // Set holdExpiresAt in the past
      await connection.collection('bookings').updateOne(
        { _id: ctx.bookingId },
        { $set: { holdExpiresAt: new Date(Date.now() - 60000) } },
      );

      await expect(
        checkoutGuard.evaluate(ctx.bookingId.toString(), 500000, PaymentPurpose.Deposit),
      ).rejects.toThrow(new ConflictException('BOOKING_HOLD_EXPIRED'));
    });

    it('9. Negative: Customer cannot access another customer’s contract (IDOR protection)', async () => {
      const ctx = await setupTestContext();
      await providerApprovalService.accept(ctx.providerUser, mockMechanismHash);
      const prep = await preparationService.prepare(ctx.bookingId.toString(), ctx.providerId.toString());

      const strangerCustomer = {
        sub: oid().toString(),
        roles: ['CUSTOMER'],
        permissions: ['user:read'],
        email: 'stranger@test.com',
        sessionId: 'sess_stranger',
      };

      await expect(
        readService.get(strangerCustomer, prep.contractId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  },
);
