import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { GoogleOAuthProfile } from '../../../common/strategies/google.strategy';
import { UsersRepository } from '../../users/repositories/users.repository';
import { AuthProviderType, UserStatus } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/services/users.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { OAuthExchangeDto } from '../dto/oauth-exchange.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { LoginProvider, LoginStatus } from '../schemas/login-history.schema';
import { SecurityEventType } from '../schemas/security-event.schema';
import {
  AuthSession,
  IssuedTokens,
  OAuthLoginCode,
  RequestContext,
} from '../types/auth.types';
import { OAuthService } from './oauth.service';
import { OtpService } from './otp.service';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordResetService } from './password-reset.service';
import { RateLimitService } from './rate-limit.service';
import { RolesService } from './roles.service';
import { SecurityLogService } from './security-log.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly securityLogService: SecurityLogService,
    private readonly rateLimitService: RateLimitService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly passwordResetService: PasswordResetService,
    private readonly oauthService: OAuthService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async register(
    dto: RegisterDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const emailNormalized = this.normalizeEmail(dto.email);
    const phoneNormalized = this.normalizePhone(dto.phone);
    this.passwordPolicyService.assertAcceptablePassword(dto.password);
    await Promise.all([
      this.rateLimitService.assertRateLimit(
        `auth:register:ip:${this.rateLimitService.ipKey(context.ipAddress)}`,
        5,
        15 * 60,
      ),
      this.rateLimitService.assertRateLimit(
        `auth:register:email:${emailNormalized}`,
        3,
        30 * 60,
      ),
    ]);

    const existingUser =
      await this.usersRepository.findUserByEmail(emailNormalized);
    if (existingUser) {
      const canResumeVerification =
        existingUser.accountStatus === UserStatus.PendingEmailVerification &&
        !existingUser.auth.emailVerified &&
        existingUser.auth.phoneNormalized === phoneNormalized;

      if (canResumeVerification) {
        const otp = await this.otpService.sendFreshEmailVerificationOtp(
          existingUser._id,
          emailNormalized,
        );

        return {
          message: 'Register success. Please verify your email.',
          demoOtp: this.demoTokensEnabled() ? otp : undefined,
        };
      }

      throw new BadRequestException('Email already exists');
    }

    const phoneExists =
      await this.usersRepository.existsByPhone(phoneNormalized);
    if (phoneExists) {
      throw new BadRequestException('Phone already exists');
    }

    const passwordHash = await this.passwordPolicyService.hashPassword(
      dto.password,
    );
    const user = await this.usersRepository.createUser({
      auth: {
        email: dto.email.trim(),
        emailNormalized,
        phone: dto.phone.trim(),
        phoneNormalized,
        passwordHash,
        emailVerified: false,
        phoneVerified: false,
        authProviders: [
          {
            provider: AuthProviderType.Local,
            providerUserId: null,
          },
        ],
      },
      roles: ['CUSTOMER'],
      defaultRole: 'CUSTOMER',
      accountStatus: UserStatus.PendingEmailVerification,
      profile: {
        fullName: dto.fullName.trim(),
      },
      security: {
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
      },
    });

    await this.rolesService.assignDefaultCustomerRole(user._id);
    const otp = await this.otpService.createAndSendEmailVerificationOtp(
      user._id,
      emailNormalized,
    );

    return {
      message: 'Register success. Please verify your email.',
      demoOtp: this.demoTokensEnabled() ? otp : undefined,
    };
  }

  verifyEmail(
    dto: VerifyEmailDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    return this.otpService.verifyEmail(dto, context);
  }

  resendVerification(
    dto: ResendVerificationDto,
  ): Promise<Record<string, unknown>> {
    return this.otpService.resendVerification(dto);
  }

  async login(dto: LoginDto, context: RequestContext): Promise<AuthSession> {
    const email = this.normalizeEmail(dto.email);
    const loginRateLimitKey = `auth:login:${email}:${this.rateLimitService.ipKey(
      context.ipAddress,
    )}`;
    let user = await this.usersRepository.findUserByEmail(email);

    if (!user || !user.auth.passwordHash) {
      await this.rateLimitService.assertRateLimit(
        loginRateLimitKey,
        5,
        15 * 60,
      );
      await this.recordLogin(
        null,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'INVALID_CREDENTIALS',
        context,
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }
    const passwordHash = user.auth.passwordHash;

    if (
      user.accountStatus === UserStatus.Suspended &&
      user.security?.lockedUntil &&
      user.security.lockedUntil.getTime() <= Date.now()
    ) {
      user =
        (await this.usersRepository.restoreExpiredSuspension(user._id)) ?? user;
    }

    if (user.accountStatus === UserStatus.Banned) {
      await this.recordLogin(
        user._id,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'ACCOUNT_BANNED',
        context,
      );
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa bởi quản trị viên.');
    }

    if (user.accountStatus !== UserStatus.Active || !user.auth.emailVerified) {
      await this.rateLimitService.assertRateLimit(
        loginRateLimitKey,
        5,
        15 * 60,
      );
      await this.recordLogin(
        user._id,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'ACCOUNT_NOT_ACTIVE',
        context,
      );
      throw new ForbiddenException(
        'Tài khoản chưa được kích hoạt hoặc email chưa được xác minh.',
      );
    }

    const validPassword = await bcrypt.compare(
      dto.password,
      passwordHash,
    );
    if (!validPassword) {
      await this.rateLimitService.assertRateLimit(
        loginRateLimitKey,
        5,
        15 * 60,
      );
      await this.recordLogin(
        user._id,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'INVALID_CREDENTIALS',
        context,
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    const tokens = await this.tokenService.issueTokens(user._id, email, context);
    const { roles } = await this.rolesService.getRoleCodesAndPermissions(
      user._id,
    );
    await Promise.all([
      this.usersRepository.markLoggedIn(user._id),
      this.recordLogin(
        user._id,
        email,
        LoginProvider.Local,
        LoginStatus.Success,
        null,
        context,
      ),
    ]);

    return {
      ...tokens,
      user: await this.usersService.getMe(user._id.toString(), roles),
    };
  }

  refreshToken(
    dto: RefreshTokenDto,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    return this.sessionService.refreshToken(dto, context);
  }

  logout(userId: string, sessionId: string): Promise<Record<string, unknown>> {
    return this.sessionService.logout(userId, sessionId);
  }

  changePassword(
    userId: string,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    return this.passwordResetService.changePassword(userId, dto, context);
  }

  forgotPassword(
    dto: ForgotPasswordDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    return this.passwordResetService.forgotPassword(dto, context);
  }

  resetPassword(
    dto: ResetPasswordDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    return this.passwordResetService.resetPassword(dto, context);
  }

  createGoogleOAuthState(context: RequestContext): Promise<string> {
    return this.oauthService.createGoogleOAuthState(context);
  }

  validateGoogleOAuthState(state: string): Promise<void> {
    return this.oauthService.validateGoogleOAuthState(state);
  }

  handleGoogleLogin(
    profile: GoogleOAuthProfile,
    context: RequestContext,
  ): Promise<OAuthLoginCode> {
    return this.oauthService.handleGoogleLogin(profile, context);
  }

  exchangeOAuthCode(
    dto: OAuthExchangeDto,
    context: RequestContext,
  ): Promise<AuthSession> {
    return this.oauthService.exchangeOAuthCode(dto, context);
  }

  async getPermissions(userId: string): Promise<Record<string, unknown>> {
    return this.rolesService.getRoleCodesAndPermissions(
      new Types.ObjectId(userId),
    );
  }

  private async recordLogin(
    userId: Types.ObjectId | null,
    email: string,
    provider: LoginProvider,
    status: LoginStatus,
    failureReason: string | null,
    context: RequestContext,
  ): Promise<void> {
    await this.authRepository.recordLogin(
      userId,
      email,
      provider,
      status,
      failureReason,
      context.ipAddress,
      context.userAgent,
    );
    await this.securityLogService.recordSecurityEvent({
      type:
        status === LoginStatus.Success
          ? SecurityEventType.LoginSuccess
          : SecurityEventType.LoginFailed,
      userId,
      email,
      metadata: {
        provider,
        failureReason,
      },
      context,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\s/g, '');
  }

  private demoTokensEnabled(): boolean {
    return this.configService.get<string>('AUTH_DEMO_TOKENS_ENABLED') === 'true';
  }
}
