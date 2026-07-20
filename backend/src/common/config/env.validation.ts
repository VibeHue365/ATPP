interface EnvConfig {
  NODE_ENV?: string;
  MONGODB_URI?: string;
  JWT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MAIL_HOST?: string;
  MAIL_USER?: string;
  MAIL_PASSWORD?: string;
  FRONTEND_URL?: string;
  BCRYPT_SALT_ROUNDS?: string;
  POLICY_ACTIVATION_MODE?: string;
}

export function validateEnv(config: EnvConfig): EnvConfig {
  const env = config.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';
  const requiredInAllEnv = ['MONGODB_URI', 'FRONTEND_URL'];
  const requiredInStrictEnv = [
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MAIL_HOST',
    'MAIL_USER',
    'MAIL_PASSWORD',
  ];

  const missing = [
    ...requiredInAllEnv.filter((key) => !config[key as keyof EnvConfig]),
    ...(isStrict
      ? requiredInStrictEnv.filter((key) => !config[key as keyof EnvConfig])
      : []),
  ];

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const saltRounds = Number(config.BCRYPT_SALT_ROUNDS ?? '12');
  if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 14) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 14');
  }

  const activationMode = config.POLICY_ACTIVATION_MODE ?? 'COMPENSATION';
  if (!['TRANSACTION', 'COMPENSATION'].includes(activationMode)) {
    throw new Error(
      'POLICY_ACTIVATION_MODE must be TRANSACTION or COMPENSATION',
    );
  }

  return config;
}
