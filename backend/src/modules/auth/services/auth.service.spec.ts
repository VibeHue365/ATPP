/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { UserStatus } from '../../users/schemas/user.schema';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const context = { ipAddress: '127.0.0.1', userAgent: 'jest' };
  const userId = new Types.ObjectId();

  function create(options: { demoTokens?: boolean } = {}) {
    const authRepository = {
      recordLogin: jest.fn().mockResolvedValue(undefined),
    };
    const usersRepository = {
      findUserByEmail: jest.fn().mockResolvedValue(null),
      existsByPhone: jest.fn().mockResolvedValue(false),
      createUser: jest.fn().mockResolvedValue({ _id: userId }),
      restoreExpiredSuspension: jest.fn(),
      markLoggedIn: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'AUTH_DEMO_TOKENS_ENABLED' && options.demoTokens
          ? 'true'
          : undefined,
      ),
    } as unknown as ConfigService;
    const rolesService = {
      getRoleCodesAndPermissionsForRoles: jest.fn().mockResolvedValue({
        roles: ['CUSTOMER'],
        permissions: ['profile:read'],
      }),
      getRoleCodesAndPermissions: jest.fn().mockResolvedValue({
        roles: ['CUSTOMER'],
        permissions: [],
      }),
    };
    const usersService = {
      toMeResponse: jest.fn().mockReturnValue({ id: userId.toString() }),
    };
    const securityLogService = {
      recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
    };
    const rateLimitService = {
      assertRateLimit: jest.fn().mockResolvedValue(undefined),
      ipKey: jest.fn((ip?: string) => ip ?? 'unknown'),
    };
    const tokenService = {
      issueTokens: jest.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
      }),
    };
    const otpService = {
      createAndSendEmailVerificationOtp: jest.fn().mockResolvedValue('123456'),
      sendFreshEmailVerificationOtp: jest.fn().mockResolvedValue('654321'),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
    };
    const sessionService = { refreshToken: jest.fn(), logout: jest.fn() };
    const passwordResetService = {
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };
    const oauthService = {
      createGoogleOAuthState: jest.fn(),
      validateGoogleOAuthState: jest.fn(),
      handleGoogleLogin: jest.fn(),
      exchangeOAuthCode: jest.fn(),
    };
    const passwordPolicyService = {
      assertAcceptablePassword: jest.fn(),
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
    };
    const service = new AuthService(
      authRepository as never,
      usersRepository as never,
      configService,
      rolesService as never,
      usersService as never,
      securityLogService as never,
      rateLimitService as never,
      tokenService as never,
      otpService as never,
      sessionService as never,
      passwordResetService as never,
      oauthService as never,
      passwordPolicyService as never,
    );
    return {
      service,
      authRepository,
      usersRepository,
      rolesService,
      usersService,
      securityLogService,
      rateLimitService,
      tokenService,
      otpService,
      passwordPolicyService,
    };
  }

  const registerDto = {
    email: '  Customer@Example.com ',
    phone: '090 123 4567',
    password: 'AoDai2026Secure',
    fullName: '  Nguyễn Văn A  ',
  };

  it('registers a normalized customer and sends verification OTP', async () => {
    const { service, usersRepository, otpService, passwordPolicyService } =
      create({
        demoTokens: true,
      });
    await expect(service.register(registerDto, context)).resolves.toEqual({
      message: 'Register success. Please verify your email.',
      demoOtp: '123456',
    });
    expect(passwordPolicyService.assertAcceptablePassword).toHaveBeenCalledWith(
      registerDto.password,
    );
    expect(usersRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          emailNormalized: 'customer@example.com',
          phoneNormalized: '0901234567',
          passwordHash: 'hashed-password',
        }),
        roles: ['CUSTOMER'],
        accountStatus: UserStatus.PendingEmailVerification,
        profile: { fullName: 'Nguyễn Văn A' },
      }),
    );
    expect(otpService.createAndSendEmailVerificationOtp).toHaveBeenCalledWith(
      userId,
      'customer@example.com',
    );
  });

  it('resumes verification for the matching unverified account', async () => {
    const { service, usersRepository, otpService } = create();
    usersRepository.findUserByEmail.mockResolvedValue({
      _id: userId,
      accountStatus: UserStatus.PendingEmailVerification,
      auth: { emailVerified: false, phoneNormalized: '0901234567' },
    });
    await expect(service.register(registerDto, context)).resolves.toMatchObject(
      {
        message: expect.any(String),
      },
    );
    expect(otpService.sendFreshEmailVerificationOtp).toHaveBeenCalledWith(
      userId,
      'customer@example.com',
    );
    expect(usersRepository.createUser).not.toHaveBeenCalled();
  });

  it('rejects an existing email that cannot resume verification', async () => {
    const { service, usersRepository } = create();
    usersRepository.findUserByEmail.mockResolvedValue({
      accountStatus: UserStatus.Active,
      auth: { emailVerified: true },
    });
    await expect(service.register(registerDto, context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an existing phone number', async () => {
    const { service, usersRepository } = create();
    usersRepository.existsByPhone.mockResolvedValue(true);
    await expect(service.register(registerDto, context)).rejects.toThrow(
      'Phone already exists',
    );
  });

  it('rejects unknown credentials and records the failed login', async () => {
    const { service, authRepository, securityLogService } = create();
    await expect(
      service.login(
        { email: 'missing@example.com', password: 'Wrong2026' },
        context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.recordLogin).toHaveBeenCalledWith(
      null,
      'missing@example.com',
      expect.any(String),
      expect.any(String),
      'INVALID_CREDENTIALS',
      context.ipAddress,
      context.userAgent,
    );
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalled();
  });

  it.each([
    [UserStatus.Banned, true],
    [UserStatus.PendingEmailVerification, false],
  ])(
    'rejects login for account status %s',
    async (accountStatus, emailVerified) => {
      const { service, usersRepository } = create();
      usersRepository.findUserByEmail.mockResolvedValue({
        _id: userId,
        accountStatus,
        auth: { passwordHash: 'hash', emailVerified },
        security: {},
        roles: ['CUSTOMER'],
      });
      await expect(
        service.login(
          { email: 'customer@example.com', password: 'Password2026' },
          context,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('restores an expired suspension and completes a valid login', async () => {
    const hash = await bcrypt.hash('Password2026', 10);
    const suspended = {
      _id: userId,
      accountStatus: UserStatus.Suspended,
      auth: { passwordHash: hash, emailVerified: true },
      security: { lockedUntil: new Date(Date.now() - 1000) },
      roles: ['CUSTOMER'],
    };
    const active = { ...suspended, accountStatus: UserStatus.Active };
    const { service, usersRepository, tokenService, usersService } = create();
    usersRepository.findUserByEmail.mockResolvedValue(suspended);
    usersRepository.restoreExpiredSuspension.mockResolvedValue(active);

    await expect(
      service.login(
        { email: ' CUSTOMER@example.com ', password: 'Password2026' },
        context,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        accessToken: 'access',
        roles: ['CUSTOMER'],
        user: { id: userId.toString() },
      }),
    );
    expect(tokenService.issueTokens).toHaveBeenCalledWith(
      userId,
      'customer@example.com',
      context,
      expect.objectContaining({ authorization: expect.any(Object) }),
    );
    expect(usersService.toMeResponse).toHaveBeenCalledWith(active, [
      'CUSTOMER',
    ]);
  });

  it('rejects an invalid password after rate limiting and logging', async () => {
    const hash = await bcrypt.hash('Correct2026', 10);
    const { service, usersRepository, rateLimitService } = create();
    usersRepository.findUserByEmail.mockResolvedValue({
      _id: userId,
      accountStatus: UserStatus.Active,
      auth: { passwordHash: hash, emailVerified: true },
      security: {},
      roles: ['CUSTOMER'],
    });
    await expect(
      service.login(
        { email: 'customer@example.com', password: 'Wrong2026' },
        context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rateLimitService.assertRateLimit).toHaveBeenCalled();
  });
});
