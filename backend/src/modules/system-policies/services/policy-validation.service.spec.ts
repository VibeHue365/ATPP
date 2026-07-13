import { BadRequestException } from '@nestjs/common';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyType } from '../constants/policy-type.enum';
import { PolicyValidationService } from './policy-validation.service';

describe('PolicyValidationService', () => {
  const service = new PolicyValidationService();

  it('rejects code/type mismatch', () => {
    expect(() =>
      service.validateCodeAndType(
        PolicyCode.CommissionPolicy,
        PolicyType.Refund,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects commission rate greater than 1', () => {
    expect(() =>
      service.validatePolicyValue(PolicyCode.CommissionPolicy, {
        defaultCommissionRate: 1.2,
        sameProviderComboCommissionRate: 0.08,
        crossProviderComboCommissionRate: 0.1,
        fixedPlatformFee: 0,
        minCommissionAmount: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts booking hold policy in valid range', () => {
    expect(() =>
      service.validatePolicyValue(PolicyCode.BookingHoldPolicy, {
        holdMinutes: 15,
        autoExpireEnabled: true,
      }),
    ).not.toThrow();
  });
});
