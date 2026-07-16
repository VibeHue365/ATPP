import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('throws 429 when the request count exceeds the configured limit', async () => {
    const service = new RateLimitService({
      consumeRateLimit: jest.fn().mockResolvedValue({ count: 6 }),
    } as never);

    await expect(
      service.assertRateLimit('auth:login:test', 5, 15 * 60),
    ).rejects.toMatchObject({
      message: 'Too many requests. Please try again later.',
    });
  });

  it('normalizes missing IP values to a stable key fragment', () => {
    const service = new RateLimitService({} as never);

    expect(service.ipKey(undefined)).toBe('unknown-ip');
    expect(service.ipKey(' 127.0.0.1 ')).toBe('127.0.0.1');
  });
});
