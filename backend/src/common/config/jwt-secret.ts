import { ConfigService } from '@nestjs/config';

const DEV_JWT_SECRET = 'dev-jwt-secret-change-me';

export function getJwtSecret(configService: ConfigService): string {
  const configuredSecret = configService.get<string>('JWT_SECRET')?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  const nodeEnv = configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    throw new Error('JWT_SECRET is required outside development.');
  }

  return DEV_JWT_SECRET;
}
