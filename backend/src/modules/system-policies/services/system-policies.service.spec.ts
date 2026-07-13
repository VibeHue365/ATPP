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
});
