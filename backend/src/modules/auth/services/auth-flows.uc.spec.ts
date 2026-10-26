import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { AuthProviderType, UserStatus } from '../../users/schemas/user.schema';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { OAuthExchangeDto } from '../dto/oauth-exchange.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { SecurityEventType } from '../schemas/security-event.schema';
import { VerificationPurpose } from '../schemas/verification-token.schema';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { OtpService } from './otp.service';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordResetService } from './password-reset.service';
import { RateLimitService } from './rate-limit.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

type Row = Record<string, any>;

const context = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const hash = (value: string) => bcrypt.hash(value, 4);

function config(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

/** Rate limiter backed by an in-memory counter so 429 boundaries are real. */
function rateLimiter(counts: Record<string, number> = {}) {
  const authRepository = {
    consumeRateLimit: jest.fn(async (key: string) => {
      counts[key] = (counts[key] ?? 0) + 1;
      return { count: counts[key] };
    }),
  };
  return { service: new RateLimitService(authRepository as any), counts };
}

async function dtoErrors(cls: new () => object, payload: Row) {
  const errors = await validate(plainToInstance(cls, payload));
  return errors.map((error) => error.property).sort();
}

function expectTooManyRequests(error: unknown) {
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(429);
}

// ------------------------------------------------------------------ AuthService
function createAuth(
  options: {
    user?: Row | null;
    counts?: Record<string, number>;
    demo?: boolean;
  } = {},
) {
  const userId = new Types.ObjectId();
  const authRepository = {
    recordLogin: jest.fn().mockResolvedValue(undefined),
  };
  const usersRepository = {
    findUserByEmail: jest.fn().mockResolvedValue(options.user ?? null),
    findUserByEmailWithPassword: jest
      .fn()
      .mockResolvedValue(options.user ?? null),
    existsByPhone: jest.fn().mockResolvedValue(false),
    createUser: jest.fn().mockResolvedValue({ _id: userId }),
    restoreExpiredSuspension: jest.fn(),
    markLoggedIn: jest.fn().mockResolvedValue(undefined),
  };
  const limiter = rateLimiter(options.counts);
  const rolesService = {
    getRoleCodesAndPermissionsForRoles: jest
      .fn()
      .mockResolvedValue({
        roles: ['CUSTOMER'],
        permissions: ['profile:read'],
      }),
  };
  const tokenService = {
    issueTokens: jest
      .fn()
      .mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
      }),
  };
  const otpService = {
    createAndSendEmailVerificationOtp: jest.fn().mockResolvedValue('123456'),
    sendFreshEmailVerificationOtp: jest.fn().mockResolvedValue('654321'),
  };
  const passwordPolicy = new PasswordPolicyService(
    config({ BCRYPT_SALT_ROUNDS: '10' }),
  );
  const securityLogService = {
    recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    authRepository as never,
    usersRepository as never,
    config(options.demo ? { AUTH_DEMO_TOKENS_ENABLED: 'true' } : {}),
    rolesService as never,
    { toMeResponse: jest.fn().mockReturnValue({ id: 'me' }) } as never,
    securityLogService as never,
    limiter.service as never,
    tokenService as never,
    otpService as never,
    {} as never,
    {} as never,
    {} as never,
    passwordPolicy as never,
  );
  return {
    service,
    userId,
    authRepository,
    usersRepository,
    tokenService,
    otpService,
    limiter,
  };
}

async function activeUser(
  password = 'AoDai2026Secure',
  overrides: Row = {},
): Promise<Row> {
  return {
    _id: new Types.ObjectId(),
    accountStatus: UserStatus.Active,
    roles: ['CUSTOMER'],
    auth: {
      passwordHash: await hash(password),
      emailVerified: true,
      emailNormalized: 'customer@example.com',
    },
    security: {},
    ...overrides,
  };
}

describe('UC-01 Login (HuyLDN)', () => {
  it('UT-01 UTCID09 issues tokens and records a successful login for an active account', async () => {
    const user = await activeUser();
    const { service, tokenService, usersRepository, authRepository } =
      createAuth({ user });

    const session = await service.login(
      { email: 'customer@example.com', password: 'AoDai2026Secure' },
      context,
    );

    expect(session).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      roles: ['CUSTOMER'],
    });
    expect(tokenService.issueTokens).toHaveBeenCalledWith(
      user._id,
      'customer@example.com',
      context,
      expect.any(Object),
    );
    expect(usersRepository.markLoggedIn).toHaveBeenCalledWith(user._id);
    expect(authRepository.recordLogin).toHaveBeenCalledWith(
      user._id,
      'customer@example.com',
      expect.any(String),
      'SUCCESS',
      null,
      '127.0.0.1',
      'jest',
    );
  });

  it('UT-01 UTCID10 normalizes the email before looking up the account', async () => {
    const user = await activeUser();
    const { service, usersRepository } = createAuth({ user });

    await service.login(
      { email: '  Customer@Example.COM ', password: 'AoDai2026Secure' },
      context,
    );

    expect(usersRepository.findUserByEmailWithPassword).toHaveBeenCalledWith(
      'customer@example.com',
    );
  });

  it('UT-01 UTCID11 rejects a suspension that has not expired yet', async () => {
    const user = await activeUser('AoDai2026Secure', {
      accountStatus: UserStatus.Suspended,
      security: { lockedUntil: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const { service, usersRepository } = createAuth({ user });

    await expect(
      service.login(
        { email: 'customer@example.com', password: 'AoDai2026Secure' },
        context,
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tài khoản chưa được kích hoạt hoặc email chưa được xác minh.',
      ),
    );
    expect(usersRepository.restoreExpiredSuspension).not.toHaveBeenCalled();
  });

  it('UT-01 UTCID12 blocks the sixth failed attempt within 15 minutes with HTTP 429', async () => {
    const user = await activeUser();
    const key = 'auth:login:customer@example.com:127.0.0.1';
    const { service } = createAuth({ user, counts: { [key]: 5 } });

    const error = await service
      .login({ email: 'customer@example.com', password: 'Wrong2026' }, context)
      .catch((reason: unknown) => reason);

    expectTooManyRequests(error);
  });

  it('UT-01 UTCID13 rejects password login for an account without a local password', async () => {
    const user = await activeUser();
    user.auth.passwordHash = null;
    const { service, tokenService } = createAuth({ user });

    await expect(
      service.login(
        { email: 'customer@example.com', password: 'AoDai2026Secure' },
        context,
      ),
    ).rejects.toThrow(
      new UnauthorizedException('Email hoặc mật khẩu không chính xác.'),
    );
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('UT-01 UTCID14 validates a well-formed email and a non-empty password', async () => {
    await expect(
      dtoErrors(LoginDto, { email: 'customer@example.com', password: 'x' }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(LoginDto, { email: 'customer', password: '' }),
    ).resolves.toEqual(['email', 'password']);
  });
});

// ------------------------------------------------------------------ Session (refresh / logout)
async function createSession(
  options: { token?: Row | null; rotated?: boolean; user?: Row | null } = {},
) {
  const tokenId = new Types.ObjectId();
  const refreshToken = `${tokenId.toString()}.${'a'.repeat(96)}`;
  const authRepository = {
    findRefreshTokenById: jest
      .fn()
      .mockResolvedValue(
        options.token === undefined
          ? {
              userId: new Types.ObjectId(),
              tokenHash: await hash(refreshToken),
              expiresAt: new Date(Date.now() + 60_000),
              familyId: 'family-1',
            }
          : options.token,
      ),
    revokeRefreshTokenIfActive: jest
      .fn()
      .mockResolvedValue(options.rotated ?? true),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  };
  const usersRepository = {
    findUserById: jest
      .fn()
      .mockResolvedValue(
        options.user === undefined
          ? {
              _id: new Types.ObjectId(),
              accountStatus: UserStatus.Active,
              auth: { emailNormalized: 'customer@example.com' },
            }
          : options.user,
      ),
  };
  const securityLogService = {
    recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
  };
  const tokenService = new TokenService({} as any, {} as any, {} as any);
  jest
    .spyOn(tokenService, 'issueTokens')
    .mockResolvedValue({
      accessToken: 'a2',
      refreshToken: 'r2',
      expiresIn: 900,
    });
  const service = new SessionService(
    authRepository as any,
    usersRepository as any,
    securityLogService as any,
    tokenService,
  );
  return {
    service,
    refreshToken,
    tokenId,
    authRepository,
    securityLogService,
    tokenService,
  };
}

describe('UC-01 Login - session refresh (HuyLDN)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UT-01 UTCID15 rejects an expired refresh token', async () => {
    const { service, refreshToken } = await createSession({
      token: {
        userId: new Types.ObjectId(),
        tokenHash: 'x',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(
      service.refreshToken({ refreshToken }, context),
    ).rejects.toThrow(new UnauthorizedException('Refresh token is invalid'));
  });

  it('UT-01 UTCID16 rotates a valid refresh token inside the same token family', async () => {
    const { service, refreshToken, tokenService, authRepository } =
      await createSession();

    await expect(
      service.refreshToken({ refreshToken }, context),
    ).resolves.toMatchObject({ accessToken: 'a2' });

    expect(authRepository.revokeRefreshTokenIfActive).toHaveBeenCalledTimes(1);
    expect(tokenService.issueTokens).toHaveBeenCalledWith(
      expect.any(Types.ObjectId),
      'customer@example.com',
      context,
      expect.objectContaining({
        familyId: 'family-1',
        refreshTokenId: expect.any(Types.ObjectId),
      }),
    );
  });

  it('UT-01 UTCID17 records token reuse when a concurrent rotation already happened', async () => {
    const { service, refreshToken, securityLogService } = await createSession({
      rotated: false,
    });

    await expect(
      service.refreshToken({ refreshToken }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.RefreshTokenReused,
        metadata: expect.objectContaining({
          reason: 'ATOMIC_ROTATION_CONFLICT',
        }),
      }),
    );
  });

  it('UT-01 UTCID18 does not refresh a session for an account that is no longer active', async () => {
    const { service, refreshToken } = await createSession({
      user: {
        _id: new Types.ObjectId(),
        accountStatus: UserStatus.Banned,
        auth: {},
      },
    });

    await expect(
      service.refreshToken({ refreshToken }, context),
    ).rejects.toThrow(new UnauthorizedException('User is not active'));
  });

  it('UT-01 UTCID19 rejects a malformed refresh token before querying storage', async () => {
    const { service, authRepository } = await createSession();

    await expect(
      service.refreshToken({ refreshToken: 'not-an-object-id.token' }, context),
    ).rejects.toThrow(new UnauthorizedException('Refresh token is invalid'));
    expect(authRepository.findRefreshTokenById).not.toHaveBeenCalled();
  });
});

describe('UC-07 Logout (HuyLDN)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UT-07 UTCID03 revokes only the refresh token of the current session', async () => {
    const { service, authRepository } = await createSession();
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    await expect(
      service.logout(userId.toString(), sessionId.toString()),
    ).resolves.toEqual({ message: 'Logout success' });
    expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
      sessionId,
      userId,
    );
  });

  it('UT-07 UTCID04 rejects a malformed session identifier', async () => {
    const { service, authRepository } = await createSession();

    await expect(
      service.logout(new Types.ObjectId().toString(), 'session-1'),
    ).rejects.toThrow();
    expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('UT-07 UTCID05 refuses to refresh with a token revoked by logout and records reuse', async () => {
    const { service, refreshToken, securityLogService } = await createSession({
      token: {
        userId: new Types.ObjectId(),
        tokenHash: 'x',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    });

    await expect(
      service.refreshToken({ refreshToken }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.RefreshTokenReused }),
    );
  });

  it('UT-07 UTCID06 rejects a refresh token whose secret part does not match', async () => {
    const { service, tokenId } = await createSession();

    await expect(
      service.refreshToken(
        { refreshToken: `${tokenId.toString()}.${'b'.repeat(96)}` },
        context,
      ),
    ).rejects.toThrow(new UnauthorizedException('Refresh token is invalid'));
  });

  it('UT-07 UTCID07 issues a 15-minute access token bound to the stored session id', async () => {
    const authRepository = {
      createRefreshToken: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = new JwtService({ secret: 'unit-test-secret' });
    const tokenService = new TokenService(
      authRepository as any,
      jwt,
      {} as any,
    );
    const userId = new Types.ObjectId();

    const tokens = await tokenService.issueTokens(
      userId,
      'customer@example.com',
      context,
      {
        authorization: { roles: ['CUSTOMER'], permissions: [] },
      },
    );

    const payload = jwt.decode(tokens.accessToken);
    const stored = authRepository.createRefreshToken.mock.calls[0][0];
    expect(tokens.expiresIn).toBe(900);
    expect(payload.sessionId).toBe(stored._id.toString());
    expect(tokens.refreshToken.startsWith(`${stored._id.toString()}.`)).toBe(
      true,
    );
  });
});

// ------------------------------------------------------------------ Signup
describe('UC-03 Signup (HuyLDN)', () => {
  const dto = {
    email: 'new@example.com',
    phone: '0901234567',
    password: 'AoDai2026Secure',
    fullName: 'Nguyen Van B',
  };

  it('UT-03 UTCID06 rejects a weak password before touching the database', async () => {
    const { service, usersRepository } = createAuth();

    await expect(
      service.register({ ...dto, password: 'onlyletters' }, context),
    ).rejects.toThrow(
      new BadRequestException(
        'Password must contain at least one letter and one number',
      ),
    );
    expect(usersRepository.findUserByEmail).not.toHaveBeenCalled();
  });

  it('UT-03 UTCID07 blocks the sixth registration from one IP within 15 minutes', async () => {
    const { service, usersRepository } = createAuth({
      counts: { 'auth:register:ip:127.0.0.1': 5 },
    });

    expectTooManyRequests(
      await service.register(dto, context).catch((reason: unknown) => reason),
    );
    expect(usersRepository.createUser).not.toHaveBeenCalled();
  });

  it('UT-03 UTCID08 creates a pending local account with the CUSTOMER role', async () => {
    const { service, usersRepository, otpService } = createAuth();

    await expect(service.register(dto, context)).resolves.toEqual({
      message: 'Register success. Please verify your email.',
      demoOtp: undefined,
    });
    expect(usersRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['CUSTOMER'],
        accountStatus: UserStatus.PendingEmailVerification,
        auth: expect.objectContaining({
          emailVerified: false,
          passwordHash: expect.stringMatching(/^\$2[aby]\$/),
        }),
      }),
    );
    expect(otpService.createAndSendEmailVerificationOtp).toHaveBeenCalledWith(
      expect.any(Types.ObjectId),
      'new@example.com',
    );
  });

  it('UT-03 UTCID09 returns the demo OTP only when demo tokens are enabled', async () => {
    const { service } = createAuth({ demo: true });

    await expect(service.register(dto, context)).resolves.toMatchObject({
      demoOtp: '123456',
    });
  });

  it('UT-03 UTCID10 validates phone format and length boundaries', async () => {
    await expect(
      dtoErrors(RegisterDto, { ...dto, phone: '0901 234' }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(RegisterDto, { ...dto, phone: '0901234' }),
    ).resolves.toEqual(['phone']);
    await expect(
      dtoErrors(RegisterDto, { ...dto, phone: '090-abc-4567' }),
    ).resolves.toEqual(['phone']);
  });

  it('UT-03 UTCID11 validates password length 8-128 characters', async () => {
    await expect(
      dtoErrors(RegisterDto, { ...dto, password: 'a1'.repeat(4) }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(RegisterDto, { ...dto, password: 'a1b2c3d' }),
    ).resolves.toEqual(['password']);
    await expect(
      dtoErrors(RegisterDto, { ...dto, password: 'a'.repeat(129) }),
    ).resolves.toEqual(['password']);
  });

  it('UT-03 UTCID12 rejects a malformed email and a full name over 100 characters', async () => {
    await expect(
      dtoErrors(RegisterDto, {
        ...dto,
        email: 'new@',
        fullName: 'x'.repeat(101),
      }),
    ).resolves.toEqual(['email', 'fullName']);
  });
});

// ------------------------------------------------------------------ Forgot / reset password
async function createReset(
  options: {
    user?: Row | null;
    token?: Row | null;
    counts?: Record<string, number>;
  } = {},
) {
  const userId = new Types.ObjectId();
  const tokenId = new Types.ObjectId();
  const rawToken = `${tokenId.toString()}.${'c'.repeat(96)}`;
  const tokenDoc =
    options.token === undefined
      ? {
          userId,
          target: 'customer@example.com',
          purpose: VerificationPurpose.PasswordReset,
          codeHash: await hash(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          updateOne: jest.fn().mockResolvedValue(undefined),
        }
      : options.token;
  const authRepository = {
    createVerificationToken: jest.fn().mockResolvedValue(undefined),
    findVerificationTokenById: jest.fn().mockResolvedValue(tokenDoc),
    revokeActiveRefreshTokens: jest.fn().mockResolvedValue(undefined),
  };
  const usersRepository = {
    findActiveUserByEmail: jest
      .fn()
      .mockResolvedValue(
        options.user === undefined
          ? { _id: userId, auth: { emailVerified: true } }
          : options.user,
      ),
    findUserByIdWithPassword: jest.fn(),
    updatePassword: jest.fn().mockResolvedValue(undefined),
  };
  const mailService = {
    sendPasswordResetLink: jest.fn().mockResolvedValue(undefined),
  };
  const securityLogService = {
    recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PasswordResetService(
    authRepository as any,
    usersRepository as any,
    config(),
    mailService as any,
    rateLimiter(options.counts).service,
    securityLogService as any,
    new PasswordPolicyService(config({ BCRYPT_SALT_ROUNDS: '10' })),
  );
  return {
    service,
    rawToken,
    tokenDoc,
    userId,
    authRepository,
    usersRepository,
    mailService,
    securityLogService,
  };
}

describe('UC-04 Forgot Password (HuyLDN)', () => {
  const generic = {
    message: 'If the email exists, a reset link has been sent.',
  };

  it('UT-04 UTCID03 returns the generic message for an unknown email without sending mail', async () => {
    const { service, mailService } = await createReset({ user: null });

    await expect(
      service.forgotPassword({ email: 'missing@example.com' }, context),
    ).resolves.toEqual(generic);
    expect(mailService.sendPasswordResetLink).not.toHaveBeenCalled();
  });

  it('UT-04 UTCID04 does not send a reset link to an unverified email', async () => {
    const { service, mailService } = await createReset({
      user: { _id: new Types.ObjectId(), auth: { emailVerified: false } },
    });

    await expect(
      service.forgotPassword({ email: 'customer@example.com' }, context),
    ).resolves.toEqual(generic);
    expect(mailService.sendPasswordResetLink).not.toHaveBeenCalled();
  });

  it('UT-04 UTCID05 creates a 15-minute reset token and mails the link', async () => {
    const { service, authRepository, mailService, securityLogService } =
      await createReset();

    await expect(
      service.forgotPassword({ email: ' Customer@Example.com ' }, context),
    ).resolves.toMatchObject(generic);

    const created = authRepository.createVerificationToken.mock.calls[0][0];
    const ttlMinutes = (created.expiresAt.getTime() - Date.now()) / 60_000;
    expect(created.purpose).toBe(VerificationPurpose.PasswordReset);
    expect(ttlMinutes).toBeGreaterThan(14);
    expect(ttlMinutes).toBeLessThanOrEqual(15);
    expect(mailService.sendPasswordResetLink).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringMatching(/^[0-9a-f]{24}\./),
    );
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.PasswordResetRequested,
      }),
    );
  });

  it('UT-04 UTCID06 allows only one reset request per email per minute', async () => {
    const { service } = await createReset({
      counts: { 'auth:forgot-password:email:customer@example.com:short': 1 },
    });

    expectTooManyRequests(
      await service
        .forgotPassword({ email: 'customer@example.com' }, context)
        .catch((r: unknown) => r),
    );
  });

  it('UT-04 UTCID07 rejects a malformed reset token', async () => {
    const { service, authRepository } = await createReset();

    await expect(
      service.resetPassword(
        { token: 'x'.repeat(30), newPassword: 'NewAoDai2026' },
        context,
      ),
    ).rejects.toThrow(
      new BadRequestException('Reset token is expired or invalid'),
    );
    expect(authRepository.findVerificationTokenById).not.toHaveBeenCalled();
  });

  it('UT-04 UTCID08 rejects an expired reset token', async () => {
    const { service, rawToken } = await createReset({
      token: {
        purpose: VerificationPurpose.PasswordReset,
        expiresAt: new Date(Date.now() - 1000),
        codeHash: 'x',
      },
    });

    await expect(
      service.resetPassword(
        { token: rawToken, newPassword: 'NewAoDai2026' },
        context,
      ),
    ).rejects.toThrow('Reset token is expired or invalid');
  });

  it('UT-04 UTCID09 rejects a reset token that was already used', async () => {
    const { service, rawToken } = await createReset({
      token: {
        purpose: VerificationPurpose.PasswordReset,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        codeHash: 'x',
      },
    });

    await expect(
      service.resetPassword(
        { token: rawToken, newPassword: 'NewAoDai2026' },
        context,
      ),
    ).rejects.toThrow('Reset token is expired or invalid');
  });

  it('UT-04 UTCID10 rejects a token whose secret does not match the stored hash', async () => {
    const { service, usersRepository } = await createReset();
    const forged = `${new Types.ObjectId().toString()}.${'d'.repeat(96)}`;

    await expect(
      service.resetPassword(
        { token: forged, newPassword: 'NewAoDai2026' },
        context,
      ),
    ).rejects.toThrow('Reset token is expired or invalid');
    expect(usersRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('UT-04 UTCID11 resets the password, consumes the token and revokes sessions', async () => {
    const {
      service,
      rawToken,
      tokenDoc,
      userId,
      usersRepository,
      authRepository,
    } = await createReset();

    await expect(
      service.resetPassword(
        { token: rawToken, newPassword: 'NewAoDai2026' },
        context,
      ),
    ).resolves.toEqual({
      message: 'Password reset successfully',
    });
    expect(usersRepository.updatePassword).toHaveBeenCalledWith(
      userId,
      expect.stringMatching(/^\$2[aby]\$/),
    );
    expect(tokenDoc!.updateOne).toHaveBeenCalledWith({
      $set: { verifiedAt: expect.any(Date) },
    });
    expect(authRepository.revokeActiveRefreshTokens).toHaveBeenCalledWith(
      userId,
    );
  });

  it('UT-04 UTCID12 rejects a weak new password even with a valid token', async () => {
    const { service, rawToken } = await createReset();

    await expect(
      service.resetPassword(
        { token: rawToken, newPassword: 'password123' },
        context,
      ),
    ).rejects.toThrow(new BadRequestException('Password is too weak'));
  });

  it('UT-04 UTCID13 validates reset token and new password length boundaries', async () => {
    await expect(
      dtoErrors(ResetPasswordDto, {
        token: 't'.repeat(20),
        newPassword: 'p'.repeat(8),
      }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(ResetPasswordDto, {
        token: 't'.repeat(19),
        newPassword: 'p'.repeat(7),
      }),
    ).resolves.toEqual(['newPassword', 'token']);
  });
});

// ------------------------------------------------------------------ Change password
describe('UC-06 Change Password (HuyLDN)', () => {
  async function setup(user: Row | null) {
    const created = await createReset();
    created.usersRepository.findUserByIdWithPassword.mockResolvedValue(user);
    return created;
  }

  it('UT-06 UTCID06 rejects an account that has no local password', async () => {
    const { service } = await setup({ auth: { passwordHash: null } });

    await expect(
      service.changePassword(
        new Types.ObjectId().toString(),
        { currentPassword: 'x', newPassword: 'NewAoDai2026' },
        context,
      ),
    ).rejects.toThrow(
      new BadRequestException('This account does not have a local password'),
    );
  });

  it('UT-06 UTCID07 rejects an incorrect current password', async () => {
    const { service, usersRepository } = await setup({
      auth: { passwordHash: await hash('OldAoDai2026') },
    });

    await expect(
      service.changePassword(
        new Types.ObjectId().toString(),
        { currentPassword: 'Wrong2026', newPassword: 'NewAoDai2026' },
        context,
      ),
    ).rejects.toThrow(
      new UnauthorizedException('Current password is incorrect'),
    );
    expect(usersRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('UT-06 UTCID08 rejects reusing the current password', async () => {
    const { service } = await setup({
      auth: { passwordHash: await hash('OldAoDai2026') },
    });

    await expect(
      service.changePassword(
        new Types.ObjectId().toString(),
        { currentPassword: 'OldAoDai2026', newPassword: 'OldAoDai2026' },
        context,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'New password must be different from current password',
      ),
    );
  });

  it('UT-06 UTCID09 saves the new password, revokes sessions and logs the change', async () => {
    const { service, usersRepository, authRepository, securityLogService } =
      await setup({
        auth: { passwordHash: await hash('OldAoDai2026') },
      });
    const userId = new Types.ObjectId();

    await expect(
      service.changePassword(
        userId.toString(),
        { currentPassword: 'OldAoDai2026', newPassword: 'NewAoDai2026' },
        context,
      ),
    ).resolves.toEqual({
      message: 'Password changed successfully. Please login again.',
    });
    expect(usersRepository.updatePassword).toHaveBeenCalledWith(
      userId,
      expect.stringMatching(/^\$2[aby]\$/),
    );
    expect(authRepository.revokeActiveRefreshTokens).toHaveBeenCalledWith(
      userId,
    );
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.PasswordChanged }),
    );
  });

  it('UT-06 UTCID10 rejects a new password without any digit', async () => {
    const { service } = await setup({
      auth: { passwordHash: await hash('OldAoDai2026') },
    });

    await expect(
      service.changePassword(
        new Types.ObjectId().toString(),
        { currentPassword: 'OldAoDai2026', newPassword: 'OnlyLetters' },
        context,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Password must contain at least one letter and one number',
      ),
    );
  });

  it('UT-06 UTCID11 validates new password length 8-128 characters', async () => {
    await expect(
      dtoErrors(ChangePasswordDto, {
        currentPassword: 'x',
        newPassword: 'p'.repeat(8),
      }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(ChangePasswordDto, {
        currentPassword: '',
        newPassword: 'p'.repeat(129),
      }),
    ).resolves.toEqual(['currentPassword', 'newPassword']);
  });
});

// ------------------------------------------------------------------ Verify OTP
async function createOtp(
  options: {
    user?: Row | null;
    token?: Row | null;
    counts?: Record<string, number>;
    otp?: string;
  } = {},
) {
  const userId = new Types.ObjectId();
  const otp = options.otp ?? '123456';
  const token =
    options.token === undefined
      ? {
          codeHash: await hash(otp),
          expiresAt: new Date(Date.now() + 60_000),
          attemptCount: 0,
          maxAttempts: 5,
          updateOne: jest.fn().mockResolvedValue(undefined),
        }
      : options.token;
  const authRepository = {
    findLatestActiveVerificationToken: jest.fn().mockResolvedValue(token),
    createVerificationToken: jest
      .fn()
      .mockResolvedValue({ _id: new Types.ObjectId() }),
    revokeOtherActiveVerificationTokens: jest.fn().mockResolvedValue(undefined),
    revokeVerificationToken: jest.fn().mockResolvedValue(undefined),
  };
  const usersRepository = {
    findUserByEmail: jest
      .fn()
      .mockResolvedValue(
        options.user === undefined
          ? { _id: userId, auth: { emailVerified: false } }
          : options.user,
      ),
    activateEmail: jest.fn().mockResolvedValue(undefined),
  };
  const emailQueueService = {
    enqueueVerificationOtp: jest.fn().mockResolvedValue(undefined),
  };
  const securityLogService = {
    recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OtpService(
    authRepository as any,
    usersRepository as any,
    config(),
    emailQueueService as any,
    rateLimiter(options.counts).service,
    securityLogService as any,
  );
  return {
    service,
    token,
    userId,
    authRepository,
    usersRepository,
    emailQueueService,
    securityLogService,
  };
}

describe('UC-05 Verify OTP (HuyLDN)', () => {
  const dto = { email: 'customer@example.com', otp: '123456' };

  it('UT-05 UTCID05 rejects verification for an unknown email', async () => {
    const { service } = await createOtp({ user: null });

    await expect(service.verifyEmail(dto, context)).rejects.toThrow(
      new BadRequestException('Invalid verification request'),
    );
  });

  it('UT-05 UTCID06 rejects an expired OTP', async () => {
    const { service } = await createOtp({
      token: {
        codeHash: 'x',
        expiresAt: new Date(Date.now() - 1000),
        attemptCount: 0,
        maxAttempts: 5,
      },
    });

    await expect(service.verifyEmail(dto, context)).rejects.toThrow(
      new BadRequestException('OTP is expired or invalid'),
    );
  });

  it('UT-05 UTCID07 blocks verification once the attempt limit is reached', async () => {
    const { service, usersRepository } = await createOtp({
      token: {
        codeHash: 'x',
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 5,
        maxAttempts: 5,
      },
    });

    await expect(service.verifyEmail(dto, context)).rejects.toThrow(
      new ForbiddenException('OTP attempt limit exceeded'),
    );
    expect(usersRepository.activateEmail).not.toHaveBeenCalled();
  });

  it('UT-05 UTCID08 counts a wrong OTP and logs the failed attempt', async () => {
    const { service, token, securityLogService } = await createOtp();

    await expect(
      service.verifyEmail({ ...dto, otp: '000000' }, context),
    ).rejects.toThrow(new BadRequestException('OTP is incorrect'));
    expect(token!.updateOne).toHaveBeenCalledWith({
      $inc: { attemptCount: 1 },
    });
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.OtpFailed }),
    );
  });

  it('UT-05 UTCID09 revokes the OTP on the last allowed wrong attempt', async () => {
    const { service, token, securityLogService } = await createOtp({
      token: {
        codeHash: await hash('123456'),
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 4,
        maxAttempts: 5,
        updateOne: jest.fn().mockResolvedValue(undefined),
      },
    });

    await expect(
      service.verifyEmail({ ...dto, otp: '000000' }, context),
    ).rejects.toThrow(new ForbiddenException('OTP attempt limit exceeded'));
    expect(token!.updateOne).toHaveBeenCalledWith({
      $inc: { attemptCount: 1 },
      $set: { revokedAt: expect.any(Date) },
    });
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.OtpMaxAttemptsExceeded,
      }),
    );
  });

  it('UT-05 UTCID10 activates the email with the correct OTP', async () => {
    const { service, token, userId, usersRepository } = await createOtp();

    await expect(service.verifyEmail(dto, context)).resolves.toEqual({
      message: 'Email verified successfully',
    });
    expect(usersRepository.activateEmail).toHaveBeenCalledWith(userId);
    expect(token!.updateOne).toHaveBeenCalledWith({
      $set: { verifiedAt: expect.any(Date) },
    });
  });

  it('UT-05 UTCID11 does not resend an OTP to an already verified email', async () => {
    const { service, emailQueueService } = await createOtp({
      user: { _id: new Types.ObjectId(), auth: { emailVerified: true } },
    });

    await expect(
      service.resendVerification({ email: 'customer@example.com' }),
    ).resolves.toEqual({
      message: 'If the email needs verification, a new OTP has been sent.',
    });
    expect(emailQueueService.enqueueVerificationOtp).not.toHaveBeenCalled();
  });

  it('UT-05 UTCID12 sends a fresh 10-minute OTP and revokes older codes', async () => {
    const { service, authRepository, emailQueueService } = await createOtp();

    await service.resendVerification({ email: ' Customer@Example.com ' });

    const created = authRepository.createVerificationToken.mock.calls[0][0];
    expect((created.expiresAt.getTime() - Date.now()) / 60_000).toBeCloseTo(
      10,
      0,
    );
    expect(emailQueueService.enqueueVerificationOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        otp: expect.stringMatching(/^\d{6}$/),
      }),
    );
    expect(
      authRepository.revokeOtherActiveVerificationTokens,
    ).toHaveBeenCalledTimes(1);
  });

  it('UT-05 UTCID13 allows only one resend per email per minute', async () => {
    const { service } = await createOtp({
      counts: {
        'auth:resend-verification:email:customer@example.com:short': 1,
      },
    });

    expectTooManyRequests(
      await service
        .resendVerification({ email: 'customer@example.com' })
        .catch((r: unknown) => r),
    );
  });

  it('UT-05 UTCID14 requires an OTP of exactly six characters', async () => {
    await expect(
      dtoErrors(VerifyEmailDto, { email: 'a@b.vn', otp: '123456' }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(VerifyEmailDto, { email: 'a@b.vn', otp: '12345' }),
    ).resolves.toEqual(['otp']);
    await expect(
      dtoErrors(VerifyEmailDto, { email: 'a@b.vn', otp: '1234567' }),
    ).resolves.toEqual(['otp']);
  });

  it('UT-05 UTCID15 reports email service unavailability when the OTP cannot be queued', async () => {
    const { service, emailQueueService, authRepository } = await createOtp();
    emailQueueService.enqueueVerificationOtp.mockRejectedValue(
      new Error('queue down'),
    );

    await expect(
      service.resendVerification({ email: 'customer@example.com' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(authRepository.revokeVerificationToken).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------------ Google login
async function createOAuth(
  options: {
    state?: Row | null;
    marked?: boolean;
    providerUser?: Row | null;
    emailUser?: Row | null;
    token?: Row | null;
    user?: Row | null;
  } = {},
) {
  const stateId = new Types.ObjectId();
  const rawState = `${stateId.toString()}.${'e'.repeat(96)}`;
  const codeId = new Types.ObjectId();
  const rawCode = `${codeId.toString()}.${'f'.repeat(96)}`;
  const userId = new Types.ObjectId();
  const authRepository = {
    createOAuthState: jest.fn().mockResolvedValue(undefined),
    findOAuthStateById: jest
      .fn()
      .mockResolvedValue(
        options.state === undefined
          ? {
              stateHash: await hash(rawState),
              expiresAt: new Date(Date.now() + 60_000),
            }
          : options.state,
      ),
    markOAuthStateUsedIfActive: jest
      .fn()
      .mockResolvedValue(options.marked ?? true),
    createVerificationToken: jest.fn().mockResolvedValue(undefined),
    findVerificationTokenById: jest
      .fn()
      .mockResolvedValue(
        options.token === undefined
          ? {
              userId,
              purpose: VerificationPurpose.OAuthLogin,
              codeHash: await hash(rawCode),
              expiresAt: new Date(Date.now() + 60_000),
            }
          : options.token,
      ),
    markVerificationTokenVerifiedIfActive: jest.fn().mockResolvedValue(true),
    recordLogin: jest.fn().mockResolvedValue(undefined),
  };
  const usersRepository = {
    findUserByAuthProvider: jest
      .fn()
      .mockResolvedValue(options.providerUser ?? null),
    findUserByEmail: jest.fn().mockResolvedValue(options.emailUser ?? null),
    createUser: jest
      .fn()
      .mockImplementation(async (data: Row) => ({ _id: userId, ...data })),
    restoreExpiredSuspension: jest.fn(),
    addAuthProvider: jest.fn().mockResolvedValue(undefined),
    activateEmail: jest.fn().mockResolvedValue(undefined),
    findUserById: jest
      .fn()
      .mockResolvedValue(
        options.user === undefined
          ? {
              _id: userId,
              accountStatus: UserStatus.Active,
              roles: ['CUSTOMER'],
              auth: { emailNormalized: 'google@example.com' },
            }
          : options.user,
      ),
    markLoggedIn: jest.fn().mockResolvedValue(undefined),
  };
  const tokenService = new TokenService({} as any, {} as any, {} as any);
  jest
    .spyOn(tokenService, 'issueTokens')
    .mockResolvedValue({
      accessToken: 'g-access',
      refreshToken: 'g-refresh',
      expiresIn: 900,
    });
  const service = new OAuthService(
    authRepository as any,
    usersRepository as any,
    {
      getRoleCodesAndPermissionsForRoles: jest
        .fn()
        .mockResolvedValue({ roles: ['CUSTOMER'], permissions: [] }),
    } as any,
    { toMeResponse: jest.fn().mockReturnValue({ id: 'me' }) } as any,
    tokenService,
    { recordSecurityEvent: jest.fn().mockResolvedValue(undefined) } as any,
    rateLimiter().service,
  );
  return {
    service,
    rawState,
    rawCode,
    userId,
    authRepository,
    usersRepository,
  };
}

const googleProfile = {
  providerUserId: 'google-123',
  email: 'Google@Example.com',
  emailVerified: true,
  fullName: 'Google User',
  avatarUrl: 'https://cdn.test/a.png',
};

describe('UC-02 Login Google (HuyLDN)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UT-02 UTCID03 creates a hashed one-time OAuth state that expires in 5 minutes', async () => {
    const { service, authRepository } = await createOAuth();

    const state = await service.createGoogleOAuthState(context);

    const stored = authRepository.createOAuthState.mock.calls[0][0];
    expect(state.startsWith(`${stored._id.toString()}.`)).toBe(true);
    expect(await bcrypt.compare(state, stored.stateHash)).toBe(true);
    expect((stored.expiresAt.getTime() - Date.now()) / 60_000).toBeCloseTo(
      5,
      0,
    );
  });

  it('UT-02 UTCID04 rejects an expired or already used OAuth state', async () => {
    const used = await createOAuth({
      state: {
        stateHash: 'x',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const expired = await createOAuth({
      state: { stateHash: 'x', expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      used.service.validateGoogleOAuthState(used.rawState),
    ).rejects.toThrow('OAuth state is expired or invalid');
    await expect(
      expired.service.validateGoogleOAuthState(expired.rawState),
    ).rejects.toThrow('OAuth state is expired or invalid');
  });

  it('UT-02 UTCID05 accepts a valid state exactly once', async () => {
    const { service, rawState, authRepository } = await createOAuth();

    await expect(
      service.validateGoogleOAuthState(rawState),
    ).resolves.toBeUndefined();
    expect(authRepository.markOAuthStateUsedIfActive).toHaveBeenCalledTimes(1);
  });

  it('UT-02 UTCID06 rejects a state consumed concurrently by another callback', async () => {
    const { service, rawState } = await createOAuth({ marked: false });

    await expect(
      service.validateGoogleOAuthState(rawState),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('UT-02 UTCID07 rejects a Google account whose email is not verified', async () => {
    const { service, usersRepository } = await createOAuth();

    await expect(
      service.handleGoogleLogin(
        { ...googleProfile, emailVerified: false },
        context,
      ),
    ).rejects.toThrow(new ForbiddenException('Google email is not verified'));
    expect(usersRepository.createUser).not.toHaveBeenCalled();
  });

  it('UT-02 UTCID08 creates an active customer for a first-time Google user', async () => {
    const { service, usersRepository, authRepository } = await createOAuth();

    const result = await service.handleGoogleLogin(googleProfile, context);

    expect(usersRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        accountStatus: UserStatus.Active,
        roles: ['CUSTOMER'],
        auth: expect.objectContaining({
          emailNormalized: 'google@example.com',
          passwordHash: null,
          authProviders: [
            { provider: AuthProviderType.Google, providerUserId: 'google-123' },
          ],
        }),
      }),
    );
    const code = authRepository.createVerificationToken.mock.calls[0][0];
    expect(code.purpose).toBe(VerificationPurpose.OAuthLogin);
    expect(result.code.startsWith(`${code._id.toString()}.`)).toBe(true);
  });

  it('UT-02 UTCID09 links Google to an existing account found by email', async () => {
    const existing = {
      _id: new Types.ObjectId(),
      accountStatus: UserStatus.Active,
      auth: { authProviders: [] },
    };
    const { service, usersRepository } = await createOAuth({
      emailUser: existing,
    });

    await service.handleGoogleLogin(googleProfile, context);

    expect(usersRepository.createUser).not.toHaveBeenCalled();
    expect(usersRepository.addAuthProvider).toHaveBeenCalledWith(existing._id, {
      provider: AuthProviderType.Google,
      providerUserId: 'google-123',
    });
  });

  it('UT-02 UTCID10 rejects Google login for a banned account', async () => {
    const banned = {
      _id: new Types.ObjectId(),
      accountStatus: UserStatus.Banned,
      auth: { authProviders: [] },
    };
    const { service } = await createOAuth({ providerUser: banned });

    await expect(
      service.handleGoogleLogin(googleProfile, context),
    ).rejects.toThrow(new ForbiddenException('Account is not active'));
  });

  it('UT-02 UTCID11 exchanges a valid one-time code for tokens and records a Google login', async () => {
    const { service, rawCode, authRepository, usersRepository } =
      await createOAuth();

    await expect(
      service.exchangeOAuthCode({ code: rawCode }, context),
    ).resolves.toMatchObject({ accessToken: 'g-access' });
    expect(
      authRepository.markVerificationTokenVerifiedIfActive,
    ).toHaveBeenCalledTimes(1);
    expect(usersRepository.markLoggedIn).toHaveBeenCalledTimes(1);
    expect(authRepository.recordLogin).toHaveBeenCalledWith(
      expect.any(Types.ObjectId),
      'google@example.com',
      'GOOGLE',
      'SUCCESS',
      null,
      '127.0.0.1',
      'jest',
    );
  });

  it('UT-02 UTCID12 rejects reuse of an exchange code', async () => {
    const { service, rawCode } = await createOAuth({
      token: {
        purpose: VerificationPurpose.OAuthLogin,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        codeHash: 'x',
      },
    });

    await expect(
      service.exchangeOAuthCode({ code: rawCode }, context),
    ).rejects.toThrow(
      new UnauthorizedException('OAuth code is expired or invalid'),
    );
  });

  it('UT-02 UTCID13 rejects a malformed exchange code', async () => {
    const { service, authRepository } = await createOAuth();

    await expect(
      service.exchangeOAuthCode({ code: 'z'.repeat(40) }, context),
    ).rejects.toThrow('OAuth code is expired or invalid');
    expect(authRepository.findVerificationTokenById).not.toHaveBeenCalled();
  });

  it('UT-02 UTCID14 validates the exchange code length 20-200 characters', async () => {
    await expect(
      dtoErrors(OAuthExchangeDto, { code: 'c'.repeat(20) }),
    ).resolves.toEqual([]);
    await expect(
      dtoErrors(OAuthExchangeDto, { code: 'c'.repeat(19) }),
    ).resolves.toEqual(['code']);
    await expect(
      dtoErrors(OAuthExchangeDto, { code: 'c'.repeat(201) }),
    ).resolves.toEqual(['code']);
  });
});
