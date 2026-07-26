import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SecurityEventType } from '../schemas/security-event.schema';
import { SessionService } from './session.service';

describe('SessionService', () => {
  it('detects reuse of a revoked refresh token and records a security event', async () => {
    const userId = new Types.ObjectId();
    const revokedAt = new Date();
    const authRepository = {
      findRefreshTokenById: jest.fn().mockResolvedValue({
        userId,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt,
      }),
    };
    const securityLogService = {
      recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
    };
    const tokenService = {
      parseRefreshToken: jest.fn().mockReturnValue({
        refreshTokenId: new Types.ObjectId().toString(),
      }),
    };
    const service = new SessionService(
      authRepository as never,
      {} as never,
      securityLogService as never,
      tokenService as never,
    );

    await expect(
      service.refreshToken(
        { refreshToken: 'revoked.raw-token' },
        { ipAddress: '127.0.0.1', userAgent: 'jest' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.RefreshTokenReused,
        userId,
        metadata: expect.objectContaining({ revokedAt }),
      }),
    );
  });
});
