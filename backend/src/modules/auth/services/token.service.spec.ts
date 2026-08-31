import { Types } from 'mongoose';
import { TokenService } from './token.service';

describe('TokenService authorization context', () => {
  it('uses supplied authorization without loading the user again', async () => {
    const authRepository = {
      createRefreshToken: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    const rolesService = {
      getRoleCodesAndPermissions: jest.fn(),
    };
    const service = new TokenService(
      authRepository as never,
      jwtService as never,
      rolesService as never,
    );
    const authorization = {
      roles: ['CUSTOMER'],
      permissions: ['profile:read'],
    };

    const result = await service.issueTokens(
      new Types.ObjectId(),
      'customer@example.com',
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
      { authorization },
    );

    expect(result.accessToken).toBe('access-token');
    expect(rolesService.getRoleCodesAndPermissions).not.toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining(authorization),
      { expiresIn: 15 * 60 },
    );
  });
});
