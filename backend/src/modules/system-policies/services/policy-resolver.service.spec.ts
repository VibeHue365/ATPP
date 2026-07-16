import { PolicyCode } from '../constants/policy-code.enum';
import { DEFAULT_POLICY_VALUES } from './default-policy-values';
import { PolicyResolverService } from './policy-resolver.service';

describe('PolicyResolverService', () => {
  it('returns default fallback when active policy is missing', async () => {
    const policyModel = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const validationService = {
      validatePolicyValue: jest.fn(),
    };
    const service = new PolicyResolverService(
      policyModel as any,
      validationService as any,
    );

    await expect(service.getCommissionPolicy()).resolves.toEqual(
      DEFAULT_POLICY_VALUES[PolicyCode.CommissionPolicy],
    );
  });

  it('caches active policy lookups', async () => {
    const policy = {
      code: PolicyCode.BookingHoldPolicy,
      value: DEFAULT_POLICY_VALUES[PolicyCode.BookingHoldPolicy],
    };
    const policyModel = {
      findOne: jest.fn().mockResolvedValue(policy),
    };
    const validationService = {
      validatePolicyValue: jest.fn(),
    };
    const service = new PolicyResolverService(
      policyModel as any,
      validationService as any,
    );

    await service.getActivePolicyByCode(PolicyCode.BookingHoldPolicy);
    await service.getActivePolicyByCode(PolicyCode.BookingHoldPolicy);

    expect(policyModel.findOne).toHaveBeenCalledTimes(1);
  });
});
