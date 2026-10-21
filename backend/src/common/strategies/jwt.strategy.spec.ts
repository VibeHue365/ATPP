import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import type { Request } from 'express';
import { UserStatus } from '../../modules/users/schemas/user.schema';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const userId = new Types.ObjectId();
  const sessionId = new Types.ObjectId();
  const payload = {
    sub: userId.toString(),
    email: 'customer@example.com',
    sessionId: sessionId.toString(),
    roles: ['OLD_ROLE'],
    permissions: [],
  };

  function create(overrides: Record<string, unknown> = {}) {
    const authRepository = {
      findRefreshTokenById: jest.fn().mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      ...(overrides.authRepository as object),
    };
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue({
        _id: userId,
        accountStatus: UserStatus.Active,
        security: {},
        provider: null,
      }),
      restoreExpiredSuspension: jest.fn(),
      ...(overrides.usersRepository as object),
    };
    const rolesService = {
      getRoleCodesAndPermissions: jest.fn().mockResolvedValue({
        roles: ['CUSTOMER'],
        permissions: ['profile:read'],
      }),
      ...(overrides.rolesService as object),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_SECRET' ? 'unit-test-jwt-secret' : 'test',
      ),
    } as unknown as ConfigService;
    return {
      strategy: new JwtStrategy(
        configService,
        authRepository as never,
        usersRepository as never,
        rolesService as never,
      ),
      authRepository,
      usersRepository,
      rolesService,
    };
  }

  const request = (url = '/users/me', method = 'GET') =>
    ({ originalUrl: url, url, method }) as Request;

  it('rejects malformed user and session identifiers', async () => {
    const { strategy } = create();
    await expect(
      strategy.validate(request(), { ...payload, sub: 'bad' }),
    ).rejects.toThrow('User is invalid');
    await expect(
      strategy.validate(request(), { ...payload, sessionId: 'bad' }),
    ).rejects.toThrow('Session is invalid');
  });

  it.each([
    null,
    { revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    { revokedAt: null, expiresAt: new Date(Date.now() - 1) },
  ])('rejects an unavailable session', async (token) => {
    const { strategy } = create({
      authRepository: {
        findRefreshTokenById: jest.fn().mockResolvedValue(token),
      },
    });
    await expect(strategy.validate(request(), payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing user', async () => {
    const { strategy } = create({
      usersRepository: { findUserById: jest.fn().mockResolvedValue(null) },
    });
    await expect(strategy.validate(request(), payload)).rejects.toThrow(
      'Tài khoản không tồn tại',
    );
  });

  it.each([
    UserStatus.Banned,
    UserStatus.PendingEmailVerification,
    UserStatus.Deleted,
  ])('rejects account status %s', async (accountStatus) => {
    const { strategy } = create({
      usersRepository: {
        findUserById: jest
          .fn()
          .mockResolvedValue({ accountStatus, security: {} }),
      },
    });
    await expect(strategy.validate(request(), payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('restores an expired suspension before authorizing', async () => {
    const activeUser = {
      _id: userId,
      accountStatus: UserStatus.Active,
      security: {},
    };
    const { strategy, usersRepository } = create({
      usersRepository: {
        findUserById: jest.fn().mockResolvedValue({
          _id: userId,
          accountStatus: UserStatus.Suspended,
          security: { lockedUntil: new Date(Date.now() - 1000) },
        }),
        restoreExpiredSuspension: jest.fn().mockResolvedValue(activeUser),
      },
    });
    await expect(strategy.validate(request(), payload)).resolves.toMatchObject({
      roles: ['CUSTOMER'],
    });
    expect(usersRepository.restoreExpiredSuspension).toHaveBeenCalledWith(
      userId,
    );
  });

  it('blocks a suspended provider from provider operations', async () => {
    const { strategy } = create({
      usersRepository: {
        findUserById: jest.fn().mockResolvedValue({
          _id: userId,
          accountStatus: UserStatus.Active,
          security: {},
          provider: { providerStatus: 'SUSPENDED' },
        }),
      },
    });
    await expect(
      strategy.validate(request('/bookings/provider', 'GET'), payload),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a suspended provider to use customer routes and refreshes authorization', async () => {
    const { strategy, rolesService } = create({
      usersRepository: {
        findUserById: jest.fn().mockResolvedValue({
          _id: userId,
          accountStatus: UserStatus.Active,
          security: {},
          provider: { providerStatus: 'SUSPENDED' },
        }),
      },
    });
    await expect(
      strategy.validate(request('/users/me'), payload),
    ).resolves.toEqual({
      ...payload,
      roles: ['CUSTOMER'],
      permissions: ['profile:read'],
    });
    expect(rolesService.getRoleCodesAndPermissions).toHaveBeenCalledWith(
      userId,
    );
  });
});
