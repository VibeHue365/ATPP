import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/vibehue_test',
    FRONTEND_URL: 'http://localhost:5173',
  };

  it('accepts the minimum development configuration', () => {
    expect(validateEnv({ ...base })).toEqual(base);
  });

  it('requires MongoDB and frontend URLs in every environment', () => {
    expect(() => validateEnv({})).toThrow(
      'Missing required environment variables: MONGODB_URI, FRONTEND_URL',
    );
  });

  it.each(['production', 'staging'])('requires secrets in %s', (NODE_ENV) => {
    expect(() => validateEnv({ ...base, NODE_ENV })).toThrow(
      /JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAIL_HOST, MAIL_USER, MAIL_PASSWORD/,
    );
  });

  it.each(['9', '15', '10.5', 'not-a-number'])(
    'rejects invalid bcrypt rounds: %s',
    (BCRYPT_SALT_ROUNDS) => {
      expect(() => validateEnv({ ...base, BCRYPT_SALT_ROUNDS })).toThrow(
        'BCRYPT_SALT_ROUNDS must be an integer between 10 and 14',
      );
    },
  );

  it.each(['10', '12', '14'])(
    'accepts bcrypt rounds: %s',
    (BCRYPT_SALT_ROUNDS) => {
      expect(validateEnv({ ...base, BCRYPT_SALT_ROUNDS })).toBeDefined();
    },
  );

  it('rejects an unknown policy activation mode', () => {
    expect(() =>
      validateEnv({ ...base, POLICY_ACTIVATION_MODE: 'UNKNOWN' }),
    ).toThrow('POLICY_ACTIVATION_MODE must be TRANSACTION or COMPENSATION');
  });
});
