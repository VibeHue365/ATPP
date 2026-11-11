import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PublicContractsController } from '../public-contracts.controller';
import { ProviderContractPolicyService } from '../provider-contract-policy.service';

describe('PublicContractsController: Read-Only Public Policy Sync', () => {
  let controller: PublicContractsController;
  const provId = new Types.ObjectId('64b0f0000000000000000001');

  const mockApprovedPolicy = {
    _id: new Types.ObjectId(),
    providerId: provId,
    versionNumber: 3,
    status: 'APPROVED',
    cancellationPolicy: {
      refundRules: [
        { daysBeforeRental: 3, refundPercentage: 100 },
        { daysBeforeRental: 1, refundPercentage: 50 },
        { daysBeforeRental: 0, refundPercentage: 0 },
      ],
      cancellationNotes: 'Tiền cọc luôn hoàn 100% nếu hủy trước khi nhận đồ.',
    },
    damageCompensation: {
      minorDamage: { method: 'FIXED_FEE', fixedFeeAmount: 50000 },
      moderateDamage: { method: 'ACTUAL_REPAIR_COST', conditionsAndEvidence: 'Theo hóa đơn' },
      severeDamage: { method: 'INCIDENT_NEGOTIATION', conditionsAndEvidence: 'Thương lượng' },
      totalLoss: { method: 'INCIDENT_NEGOTIATION', conditionsAndEvidence: 'Thương lượng' },
    },
    approvedAt: new Date('2026-11-05T10:00:00Z'),
  };

  const mockProviderPolicyService = {
    getActiveApprovedPolicy: jest.fn().mockImplementation(async (id: Types.ObjectId) => {
      if (id.equals(provId)) {
        return mockApprovedPolicy;
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicContractsController],
      providers: [
        {
          provide: ProviderContractPolicyService,
          useValue: mockProviderPolicyService,
        },
      ],
    }).compile();

    controller = moduleRef.get<PublicContractsController>(PublicContractsController);
  });

  it('1. Returns sanitized public active approved policy when found', async () => {
    const result = await controller.getPublicProviderActivePolicy(provId.toString());
    expect(result).not.toBeNull();
    expect(result?.versionNumber).toBe(3);
    expect(result?.cancellationPolicy?.refundRules).toHaveLength(3);
    expect(result?.cancellationPolicy?.refundRules[0].daysBeforeRental).toBe(3);
    expect(result?.cancellationPolicy?.refundRules[0].refundPercentage).toBe(100);
    // Audit fields like reviewedByUserId should not be leaked in public endpoint
    expect((result as any)?.reviewedByUserId).toBeUndefined();
  });

  it('2. Returns null when provider has no approved V2 policy', async () => {
    const nonExistentId = new Types.ObjectId().toString();
    const result = await controller.getPublicProviderActivePolicy(nonExistentId);
    expect(result).toBeNull();
  });

  it('3. Throws NotFoundException on invalid ObjectId string', async () => {
    await expect(controller.getPublicProviderActivePolicy('invalid-id')).rejects.toThrow(
      'PROVIDER_NOT_FOUND',
    );
  });
});
