import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyActivationLockService } from './policy-activation-lock.service';

describe('PolicyActivationLockService', () => {
  it('acquires lock fail-fast and releases only by owner', () => {
    const service = new PolicyActivationLockService();

    expect(service.acquire(PolicyCode.CommissionPolicy, 'admin-a')).toBe(true);
    expect(service.acquire(PolicyCode.CommissionPolicy, 'admin-b')).toBe(false);

    service.release(PolicyCode.CommissionPolicy, 'admin-b');
    expect(service.acquire(PolicyCode.CommissionPolicy, 'admin-b')).toBe(false);

    service.release(PolicyCode.CommissionPolicy, 'admin-a');
    expect(service.acquire(PolicyCode.CommissionPolicy, 'admin-b')).toBe(true);
  });
});
