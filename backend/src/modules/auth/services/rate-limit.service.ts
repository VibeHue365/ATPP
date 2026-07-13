import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class RateLimitService {
  constructor(private readonly authRepository: AuthRepository) {}

  async assertRateLimit(
    key: string,
    maxAttempts: number,
    windowSeconds: number,
  ): Promise<void> {
    const rateLimit = await this.authRepository.consumeRateLimit(
      key,
      windowSeconds,
    );

    if (rateLimit.count > maxAttempts) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  ipKey(ipAddress?: string): string {
    return ipAddress?.trim() || 'unknown-ip';
  }
}
