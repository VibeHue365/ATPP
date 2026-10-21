import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-secret';

describe('getJwtSecret', () => {
  function config(values: Record<string, string | undefined>): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('returns and trims the configured secret', () => {
    expect(getJwtSecret(config({ JWT_SECRET: '  secure-test-secret  ' }))).toBe(
      'secure-test-secret',
    );
  });

  it('uses the development fallback outside strict environments', () => {
    expect(getJwtSecret(config({ NODE_ENV: 'test' }))).toBe(
      'dev-jwt-secret-change-me',
    );
  });

  it.each(['production', 'staging'])(
    'rejects a missing secret in %s',
    (NODE_ENV) => {
      expect(() => getJwtSecret(config({ NODE_ENV }))).toThrow(
        'JWT_SECRET is required outside development.',
      );
    },
  );
});
