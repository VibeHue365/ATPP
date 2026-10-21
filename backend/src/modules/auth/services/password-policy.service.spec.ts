import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  function service(rounds = '10') {
    return new PasswordPolicyService({
      get: jest.fn().mockReturnValue(rounds),
    } as unknown as ConfigService);
  }

  it.each(['short1', 'onlyletters', '123456789'])(
    'rejects invalid password %s',
    (password) => {
      expect(() => service().assertAcceptablePassword(password)).toThrow(
        BadRequestException,
      );
    },
  );

  it.each(['password123', ' QWERTY123 '])(
    'rejects known weak password %s',
    (password) => {
      expect(() => service().assertAcceptablePassword(password)).toThrow(
        'Password is too weak',
      );
    },
  );

  it('accepts a password containing letters and numbers', () => {
    expect(() =>
      service().assertAcceptablePassword('AoDai2026Secure'),
    ).not.toThrow();
  });

  it('creates a bcrypt hash using a valid configured cost', async () => {
    const hash = await service('10').hashPassword('AoDai2026Secure');
    await expect(bcrypt.compare('AoDai2026Secure', hash)).resolves.toBe(true);
    expect(Number(hash.split('$')[2])).toBe(10);
  });

  it('falls back to cost 12 when configuration is invalid', async () => {
    const hash = await service('2').hashPassword('AoDai2026Secure');
    expect(Number(hash.split('$')[2])).toBe(12);
  });

  it('rejects reuse of the current password', async () => {
    const hash = await bcrypt.hash('Current2026', 10);
    await expect(
      service().assertDifferentPassword('Current2026', hash),
    ).rejects.toThrow('New password must be different from current password');
  });

  it('allows a genuinely different password', async () => {
    const hash = await bcrypt.hash('Current2026', 10);
    await expect(
      service().assertDifferentPassword('Different2026', hash),
    ).resolves.toBeUndefined();
  });
});
