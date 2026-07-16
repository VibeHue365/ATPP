import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyStatus } from '../constants/policy-status.enum';
import { PolicyType } from '../constants/policy-type.enum';
import { SystemPoliciesService } from './system-policies.service';

describe('SystemPoliciesService', () => {
  function createService(policyModelOverrides: Record<string, unknown>) {
    const policyModel = {
      findById: jest.fn(),
      ...policyModelOverrides,
    };
    return new SystemPoliciesService(
      policyModel as any,
      { startSession: jest.fn() } as any,
      { get: jest.fn().mockReturnValue('COMPENSATION') } as any,
      {
        validateCodeAndType: jest.fn(),
        validatePolicyValue: jest.fn(),
      } as any,
      { clearCache: jest.fn() } as any,
      { acquire: jest.fn(), release: jest.fn() } as any,
      { recordAdminAudit: jest.fn() } as any,
    );
  }

  it('rejects direct update of an active policy', async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        code: PolicyCode.CommissionPolicy,
        type: PolicyType.Commission,
        status: PolicyStatus.Active,
      }),
    });

    await expect(
      service.updatePolicy(new Types.ObjectId().toString(), new Types.ObjectId().toString(), {
        name: 'New commission policy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates a draft and deactivates the previous active version', async () => {
    const actorId = new Types.ObjectId().toString();
    const target = {
      _id: new Types.ObjectId(),
      code: PolicyCode.CommissionPolicy,
      type: PolicyType.Commission,
      status: PolicyStatus.Draft,
      version: 2,
      value: {
        defaultCommissionRate: 0.12,
        sameProviderComboCommissionRate: 0.08,
        crossProviderComboCommissionRate: 0.1,
        fixedPlatformFee: 0,
        minCommissionAmount: 0,
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const oldActive = {
      _id: new Types.ObjectId(),
      code: PolicyCode.CommissionPolicy,
      status: PolicyStatus.Active,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const clearCache = jest.fn();
    const release = jest.fn();
    const policyModel = {
      findById: jest.fn().mockResolvedValue(target),
      findOne: jest.fn().mockResolvedValue(oldActive),
    };
    const service = new SystemPoliciesService(
      policyModel as any,
      { startSession: jest.fn() } as any,
      { get: jest.fn().mockReturnValue('COMPENSATION') } as any,
      {
        validateCodeAndType: jest.fn(),
        validatePolicyValue: jest.fn(),
      } as any,
      { clearCache } as any,
      { acquire: jest.fn().mockReturnValue(true), release } as any,
      { recordAdminAudit: jest.fn() } as any,
    );

    const result = await service.activatePolicy(actorId, target._id.toString(), {
      reason: 'Apply new commission rate',
    });

    expect(result.status).toBe(PolicyStatus.Active);
    expect(oldActive.status).toBe(PolicyStatus.Inactive);
    expect(oldActive.save).toHaveBeenCalled();
    expect(target.save).toHaveBeenCalled();
    expect(clearCache).toHaveBeenCalledWith(PolicyCode.CommissionPolicy);
    expect(release).toHaveBeenCalledWith(PolicyCode.CommissionPolicy, actorId);
  });

  it('seeds each default policy only once across repeated bootstrap calls', async () => {
    const existingCodes = new Set<PolicyCode>();
    const savedCodes: PolicyCode[] = [];
    const policyModel = Object.assign(
      jest.fn().mockImplementation((policy: { code: PolicyCode }) => ({
        ...policy,
        _id: new Types.ObjectId(),
        save: jest.fn().mockImplementation(async () => {
          existingCodes.add(policy.code);
          savedCodes.push(policy.code);
          return policy;
        }),
      })),
      {
        exists: jest.fn().mockImplementation(({ code }: { code: PolicyCode }) =>
          Promise.resolve(existingCodes.has(code)),
        ),
      },
    );
    const service = new SystemPoliciesService(
      policyModel as any,
      { startSession: jest.fn() } as any,
      { get: jest.fn().mockReturnValue('COMPENSATION') } as any,
      {
        validateCodeAndType: jest.fn(),
        validatePolicyValue: jest.fn(),
      } as any,
      { clearCache: jest.fn() } as any,
      { acquire: jest.fn(), release: jest.fn() } as any,
      { recordAdminAudit: jest.fn() } as any,
    );

    await service.seedDefaultPolicies();
    await service.seedDefaultPolicies();

    expect(savedCodes).toHaveLength(Object.values(PolicyCode).length);
    expect(new Set(savedCodes)).toEqual(new Set(Object.values(PolicyCode)));
  });
});
