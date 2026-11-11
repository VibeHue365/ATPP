import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createConnection, Connection, Model, Types } from 'mongoose';
import { contractTestTarget } from '../contract-test-target';
import { ContractAccessService } from '../contract-access.service';
import { ContractSnapshotService } from '../contract-snapshot.service';
import { PolicyResolverService } from '../../system-policies/services/policy-resolver.service';
import { PolicyCode } from '../../system-policies/constants/policy-code.enum';
import { ProviderContractPolicyService } from '../provider-contract-policy.service';
import {
  ProviderContractPolicyVersion,
  ProviderContractPolicyVersionSchema,
  ProviderPolicyReviewStatus,
} from '../schemas/provider-contract-policy.schema';
import { SaveProviderPolicyDraftDto } from '../dto/provider-contract-policy.dto';

const target = contractTestTarget();
const oid = () => new Types.ObjectId();

(target ? describe : describe.skip)(
  'P1B — Provider Policy Management & Versioning Lifecycle (Port 27028)',
  () => {
    jest.setTimeout(30000);

    let connection: Connection;
    let scratchDbName: string;
    let policyModel: Model<ProviderContractPolicyVersion>;

    const validPolicyDto: SaveProviderPolicyDraftDto = {
      garmentCare: {
        allowIroning: true,
        allowWashing: false,
        prohibitedActions: [
          'Xịt nước hoa trực tiếp lên tơ tằm',
          'Sử dụng ghim băng kim loại làm tưa chỉ',
        ],
        specialNotes: 'Chất liệu lụa tơ tằm thêu tay truyền thống.',
      },
      lateReturn: {
        gracePeriodHours: 2,
        hourlyLateFee: 30000,
        dailyLateFee: 150000,
        maxLateDaysAllowed: 3,
      },
      damageCompensation: {
        minorDamageFee: 50000,
        moderateDamagePercent: 20,
        severeDamageOrLossPercent: 100,
        disputeResolutionNotes: 'Khi phát sinh tranh chấp, hai bên tự thương lượng hòa giải trên tinh thần hợp tác.',
      },
      cancellationPolicy: {
        refundRules: [
          { daysBeforeRental: 3, refundPercentage: 100 },
          { daysBeforeRental: 1, refundPercentage: 50 },
          { daysBeforeRental: 0, refundPercentage: 0 },
        ],
        cancellationNotes: 'Tiền cọc luôn hoàn 100% nếu hủy trước ngày nhận đồ.',
      },
      supportContact: {
        hotline: '0901234567',
        supportWorkingHours: '08:00 - 21:00',
        contactNote: 'Hỗ trợ đổi size trong vòng 2 giờ sau nhận.',
      },
      customTermsText: 'Khách hàng vui lòng đồng kiểm trang phục khi nhận hàng.',
    };

    beforeAll(async () => {
      scratchDbName = `contract_p1b_${oid().toHexString()}_test`;
      const uri = new URL(target!.uri);
      uri.pathname = `/${scratchDbName}`;

      connection = await createConnection(uri.toString(), {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      }).asPromise();

      policyModel = connection.model(
        ProviderContractPolicyVersion.name,
        ProviderContractPolicyVersionSchema,
      );

      await policyModel.collection.createIndex(
        { providerId: 1, versionNumber: -1 },
        { unique: true },
      );
      await policyModel.collection.createIndex({ providerId: 1, status: 1 });
    });

    afterAll(async () => {
      if (connection) {
        try {
          await connection.dropDatabase();
        } catch {}
        await connection.close();
      }
    });

    async function seedProvider() {
      const providerUserId = oid();
      const providerId = oid();

      await connection.collection('providers').insertOne({
        _id: providerId,
        userId: providerUserId,
        businessName: 'Tiem Ao Dai Co Do',
        status: 'ACTIVE',
        capabilities: ['AODAI_RENTAL'],
        policies: {
          rentalPolicy: 'Legacy rental policy',
          cancellationPolicy: 'Legacy cancel policy',
        },
        updatedAt: new Date(),
      });

      return { providerUserId, providerId };
    }

    it('1. Provider saves policy draft with 4 groups (NO accessories) -> Created as DRAFT version 1', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      const saved = await policyService.saveDraft(user, validPolicyDto);
      expect(saved.versionNumber).toBe(1);
      expect(saved.status).toBe(ProviderPolicyReviewStatus.Draft);
      expect(saved.garmentCare.allowIroning).toBe(true);
      expect(saved.garmentCare.allowWashing).toBe(false);
      expect(saved.lateReturn.gracePeriodHours).toBe(2);
      expect(saved.damageCompensation.minorDamageFee).toBe(50000);
      expect(saved.cancellationPolicy.refundRules.length).toBe(3);
      expect(saved.supportContact.hotline).toBe('0901234567');
      expect((saved as any).accessories).toBeUndefined(); // Confirm NO accessories
    });

    it('2. Guardrail validation rejects out-of-bound threshold values', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      // Negative daily late fee (< 0)
      const invalidLateFee = {
        ...validPolicyDto,
        lateReturn: { ...validPolicyDto.lateReturn, dailyLateFee: -25000 },
      };
      await expect(policyService.saveDraft(user, invalidLateFee)).rejects.toThrow(
        UnprocessableEntityException,
      );

      // Negative minor damage fee (< 0)
      const invalidMinorDamage = {
        ...validPolicyDto,
        damageCompensation: { ...validPolicyDto.damageCompensation, minorDamageFee: -10000 },
      };
      await expect(policyService.saveDraft(user, invalidMinorDamage)).rejects.toThrow(
        UnprocessableEntityException,
      );

      // Severe damage percent > 100%
      const invalidSeverePercent = {
        ...validPolicyDto,
        damageCompensation: { ...validPolicyDto.damageCompensation, severeDamageOrLossPercent: 120 },
      };
      await expect(policyService.saveDraft(user, invalidSeverePercent)).rejects.toThrow(
        UnprocessableEntityException,
      );

      // Business guidance check: values above platform reference guidelines set businessApprovalRequired = true
      const guidelineExceeded = {
        ...validPolicyDto,
        lateReturn: { ...validPolicyDto.lateReturn, dailyLateFee: 250000 },
      };
      const savedGuideline = await policyService.saveDraft(user, guidelineExceeded);
      expect(savedGuideline.businessApprovalRequired).toBe(true);
    });

    it('3. Provider submits draft for review -> transitions to PENDING_REVIEW and calculates policyFingerprint', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      await policyService.saveDraft(user, validPolicyDto);
      const submitted = await policyService.submitForReview(user);

      expect(submitted.status).toBe(ProviderPolicyReviewStatus.PendingReview);
      expect(submitted.submittedAt).toBeDefined();
      expect(submitted.policyFingerprint).toBeDefined();
      expect(submitted.policyFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it('4. Admin reviews and APPROVES policy -> status changes to APPROVED, sets approvedAt', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      await policyService.saveDraft(user, validPolicyDto);
      const submitted = await policyService.submitForReview(user);

      const adminUser = {
        sub: oid().toString(),
        roles: ['ADMIN'],
        permissions: ['policy:review'],
        email: 'admin@vibehue.test',
        sessionId: 'admin_sess',
      };

      const approved = await policyService.adminReview(adminUser, submitted._id.toString(), {
        action: 'APPROVE',
        reviewNote: 'Chính sách đạt chuẩn VibeHue.',
      });

      expect(approved.status).toBe(ProviderPolicyReviewStatus.Approved);
      expect(approved.approvedAt).toBeDefined();
      expect(approved.reviewedByUserId?.toString()).toBe(adminUser.sub);
    });

    it('5. Provider updates policy again -> version 2 created; when approved, version 1 becomes SUPERSEDED', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      const adminUser = {
        sub: oid().toString(),
        roles: ['ADMIN'],
        permissions: ['policy:review'],
        email: 'admin@vibehue.test',
        sessionId: 'admin_sess',
      };

      // 1. Version 1 Approved
      await policyService.saveDraft(user, validPolicyDto);
      const sub1 = await policyService.submitForReview(user);
      await policyService.adminReview(adminUser, sub1._id.toString(), { action: 'APPROVE' });

      // 2. Provider creates Version 2
      const updatedDto = {
        ...validPolicyDto,
        lateReturn: { ...validPolicyDto.lateReturn, dailyLateFee: 180000 },
      };
      const draft2 = await policyService.saveDraft(user, updatedDto);
      expect(draft2.versionNumber).toBe(2);
      expect(draft2.status).toBe(ProviderPolicyReviewStatus.Draft);

      // 3. Submit Version 2
      const sub2 = await policyService.submitForReview(user);
      expect(sub2.versionNumber).toBe(2);

      // 4. Admin Approves Version 2
      await policyService.adminReview(adminUser, sub2._id.toString(), { action: 'APPROVE' });

      // 5. Verify Version 1 is now SUPERSEDED
      const v1 = await policyModel.findById(sub1._id).lean();
      expect(v1?.status).toBe(ProviderPolicyReviewStatus.Superseded);

      const v2 = await policyModel.findById(sub2._id).lean();
      expect(v2?.status).toBe(ProviderPolicyReviewStatus.Approved);
    });

    it('6. Admin REJECTS policy -> transitions to REJECTED, saves reviewNote', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      const adminUser = {
        sub: oid().toString(),
        roles: ['ADMIN'],
        permissions: ['policy:review'],
        email: 'admin@vibehue.test',
        sessionId: 'admin_sess',
      };

      await policyService.saveDraft(user, validPolicyDto);
      const sub = await policyService.submitForReview(user);

      const rejected = await policyService.adminReview(adminUser, sub._id.toString(), {
        action: 'REJECT',
        reviewNote: 'Mô tả ghi chú chất liệu chưa rõ ràng.',
      });

      expect(rejected.status).toBe(ProviderPolicyReviewStatus.Rejected);
      expect(rejected.reviewNote).toBe('Mô tả ghi chú chất liệu chưa rõ ràng.');
    });

    it('7. Contract Snapshot Integration: Resolves structured policy when APPROVED policy exists', async () => {
      const { providerUserId, providerId } = await seedProvider();

      const accessService = {
        ownProvider: jest.fn().mockResolvedValue({ _id: providerId, userId: providerUserId }),
      } as unknown as ContractAccessService;

      const policyService = new ProviderContractPolicyService(
        true,
        connection,
        policyModel,
        accessService,
      );

      const user = {
        sub: providerUserId.toString(),
        roles: ['PROVIDER'],
        permissions: [],
        email: 'shop@test.com',
        sessionId: 'sess_1',
      };

      const adminUser = {
        sub: oid().toString(),
        roles: ['ADMIN'],
        permissions: ['policy:review'],
        email: 'admin@vibehue.test',
        sessionId: 'admin_sess',
      };

      await policyService.saveDraft(user, validPolicyDto);
      const sub = await policyService.submitForReview(user);
      await policyService.adminReview(adminUser, sub._id.toString(), { action: 'APPROVE' });

      // Test ContractSnapshotService resolution
      const policyResolver = {
        clearCache: jest.fn(),
        getActivePolicyByCode: jest.fn().mockImplementation((code: PolicyCode) =>
          Promise.resolve({ code, version: 1, value: 'System policy' }),
        ),
      } as unknown as PolicyResolverService;

      const snapshotService = new ContractSnapshotService(connection, policyResolver);
      const resolvedPolicies = await snapshotService.currentPoliciesForProvider(providerId);

      expect(resolvedPolicies.providerPolicyVersion).toBe(1);
      expect(resolvedPolicies.providerGarmentCare).toBeDefined();
      expect(resolvedPolicies.providerLateReturn).toBeDefined();
      expect(resolvedPolicies.providerDamageCompensation).toBeDefined();
      expect(resolvedPolicies.providerCancellationPolicy).toBeDefined();
    });
  },
);
