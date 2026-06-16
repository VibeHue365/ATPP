import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { GoogleOAuthProfile } from '../../../common/strategies/google.strategy';
import { AuthProviderType, UserStatus } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/services/users.service';
import { UsersRepository } from '../../users/repositories/users.repository';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { LoginProvider, LoginStatus } from '../schemas/login-history.schema';
import {
  VerificationPurpose,
  VerificationTargetType,
} from '../schemas/verification-token.schema';
import { MailService } from './mail.service';
import { RolesService } from './roles.service';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds = 15 * 60;
  private readonly refreshTokenTtlDays = 30;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto): Promise<Record<string, unknown>> {
    const emailNormalized = this.normalizeEmail(dto.email);
    const phoneNormalized = this.normalizePhone(dto.phone);
    const existing = await this.usersRepository.existsByEmail(emailNormalized);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const phoneExists =
      await this.usersRepository.existsByPhone(phoneNormalized);
    if (phoneExists) {
      throw new BadRequestException('Phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
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
    const otp = await this.createEmailVerificationOtp(
      user._id,
      emailNormalized,
    );
    await this.mailService.sendEmailVerificationOtp(emailNormalized, otp);

    return {
      message: 'Register success. Please verify your email.',
      demoOtp: this.demoTokensEnabled() ? otp : undefined,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersRepository.findUserByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid verification request');
    }

    const token = await this.authRepository.findLatestActiveVerificationToken(
      user._id,
      email,
      VerificationPurpose.VerifyEmail,
    );

    if (!token || token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP is expired or invalid');
    }

    if (token.attemptCount >= token.maxAttempts) {
      throw new ForbiddenException('OTP attempt limit exceeded');
    }

    const validOtp = await bcrypt.compare(dto.otp, token.codeHash);
    if (!validOtp) {
      await token.updateOne({ $inc: { attemptCount: 1 } });
      throw new BadRequestException('OTP is incorrect');
    }

    await Promise.all([
      this.usersRepository.activateEmail(user._id),
      token.updateOne({ $set: { verifiedAt: new Date() } }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersRepository.findUserByEmail(email);

    if (!user || user.auth.emailVerified) {
      return {
        message: 'If the email needs verification, a new OTP has been sent.',
      };
    }

    await this.authRepository.revokeActiveVerificationTokens(
      user._id,
      VerificationPurpose.VerifyEmail,
    );
    const otp = await this.createEmailVerificationOtp(user._id, email);
    await this.mailService.sendEmailVerificationOtp(email, otp);

    return {
      message: 'If the email needs verification, a new OTP has been sent.',
      demoOtp: this.demoTokensEnabled() ? otp : undefined,
    };
  }

  async login(
    dto: LoginDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersRepository.findUserByEmail(email);

    if (!user || !user.auth.passwordHash) {
      await this.recordLogin(
        null,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'INVALID_CREDENTIALS',
        context,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.accountStatus !== UserStatus.Active || !user.auth.emailVerified) {
      await this.recordLogin(
        user._id,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'ACCOUNT_NOT_ACTIVE',
        context,
      );
      throw new ForbiddenException(
        'Account is not active or email is not verified',
      );
    }

    const validPassword = await bcrypt.compare(
      dto.password,
      user.auth.passwordHash,
    );
    if (!validPassword) {
      await this.recordLogin(
        user._id,
        email,
        LoginProvider.Local,
        LoginStatus.Failed,
        'INVALID_CREDENTIALS',
        context,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user._id, email, context);
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

  async refreshToken(
    dto: RefreshTokenDto,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    const { refreshTokenId } = this.parseRefreshToken(dto.refreshToken);
    const refreshToken =
      await this.authRepository.findRefreshTokenById(refreshTokenId);

    if (
      !refreshToken ||
      refreshToken.revokedAt ||
      refreshToken.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const validToken = await bcrypt.compare(
      dto.refreshToken,
      refreshToken.tokenHash,
    );
    if (!validToken) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    await refreshToken.updateOne({ $set: { revokedAt: new Date() } });
    const user = await this.usersRepository.findUserById(refreshToken.userId);
    if (!user || user.accountStatus !== UserStatus.Active) {
      throw new UnauthorizedException('User is not active');
    }

    return this.issueTokens(user._id, user.auth.emailNormalized, context);
  }

  async logout(
    userId: string,
    sessionId: string,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const userObjectId = new Types.ObjectId(userId);
    await this.authRepository.revokeRefreshToken(
      new Types.ObjectId(sessionId),
      userObjectId,
    );

    return { message: 'Logout success' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.usersRepository.findUserById(userObjectId);
    if (!user?.auth.passwordHash) {
      throw new BadRequestException(
        'This account does not have a local password',
      );
    }

    const validPassword = await bcrypt.compare(
      dto.currentPassword,
      user.auth.passwordHash,
    );
    if (!validPassword) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await Promise.all([
      this.usersRepository.updatePassword(userObjectId, passwordHash),
      this.authRepository.revokeActiveRefreshTokens(userObjectId),
    ]);

    return { message: 'Password changed successfully. Please login again.' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersRepository.findActiveUserByEmail(email);

    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const token = await this.createPasswordResetToken(user._id, email);
    await this.mailService.sendPasswordResetLink(email, token);

    return {
      message: 'If the email exists, a reset link has been sent.',
      demoResetToken: this.demoTokensEnabled() ? token : undefined,
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { tokenId } = this.parseResetToken(dto.token);
    const resetToken =
      await this.authRepository.findVerificationTokenById(tokenId);

    if (
      !resetToken ||
      resetToken.purpose !== VerificationPurpose.PasswordReset ||
      resetToken.verifiedAt ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token is expired or invalid');
    }

    const validToken = await bcrypt.compare(dto.token, resetToken.codeHash);
    if (!validToken) {
      throw new BadRequestException('Reset token is expired or invalid');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await Promise.all([
      this.usersRepository.updatePassword(resetToken.userId, passwordHash),
      this.usersRepository.activateEmail(resetToken.userId),
      resetToken.updateOne({ $set: { verifiedAt: new Date() } }),
      this.authRepository.revokeActiveRefreshTokens(resetToken.userId),
    ]);

    return { message: 'Password reset successfully' };
  }

  async handleGoogleLogin(
    profile: GoogleOAuthProfile,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(profile.email);
    const providerUserId = profile.providerUserId;
    let user = await this.usersRepository.findUserByAuthProvider(
      AuthProviderType.Google,
      providerUserId,
    );

    user ??= await this.usersRepository.findUserByEmail(email);
    const hasGoogleProvider = Boolean(
      user?.auth.authProviders.some(
        (authProvider) =>
          authProvider.provider === AuthProviderType.Google &&
          authProvider.providerUserId === providerUserId,
      ),
    );

    if (!user) {
      user = await this.usersRepository.createUser({
        auth: {
          email: profile.email,
          emailNormalized: email,
          passwordHash: null,
          emailVerified: true,
          phoneVerified: false,
          authProviders: [
            {
              provider: AuthProviderType.Google,
              providerUserId,
            },
          ],
        },
        roles: ['CUSTOMER'],
        defaultRole: 'CUSTOMER',
        accountStatus: UserStatus.Active,
        profile: {
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
        },
        security: {
          failedLoginAttempts: 0,
        },
      });
      await this.rolesService.assignDefaultCustomerRole(user._id);
    } else if (user.accountStatus !== UserStatus.Active) {
      throw new ForbiddenException('Account is not active');
    } else if (!hasGoogleProvider) {
      await this.usersRepository.addAuthProvider(user._id, {
        provider: AuthProviderType.Google,
        providerUserId,
      });
    }

    const tokens = await this.issueTokens(user._id, email, context);
    const { roles } = await this.rolesService.getRoleCodesAndPermissions(
      user._id,
    );
    await Promise.all([
      this.usersRepository.markLoggedIn(user._id),
      this.usersRepository.activateEmail(user._id),
      this.recordLogin(
        user._id,
        email,
        LoginProvider.Google,
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

  async getPermissions(userId: string): Promise<Record<string, unknown>> {
    return this.rolesService.getRoleCodesAndPermissions(
      new Types.ObjectId(userId),
    );
  }

  private async issueTokens(
    userId: Types.ObjectId,
    email: string,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    const refreshTokenId = new Types.ObjectId();
    const refreshToken = `${refreshTokenId.toString()}.${randomBytes(48).toString('hex')}`;
    const tokenHash = await bcrypt.hash(refreshToken, 12);
    const expiresAt = new Date(
      Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.authRepository.createRefreshToken({
      _id: refreshTokenId,
      userId,
      tokenHash,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.userAgent,
      expiresAt,
    });

    const { roles, permissions } =
      await this.rolesService.getRoleCodesAndPermissions(userId);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId.toString(),
        email,
        sessionId: refreshTokenId.toString(),
        roles,
        permissions,
      },
      { expiresIn: this.accessTokenTtlSeconds },
    );

    return { accessToken, refreshToken, expiresIn: this.accessTokenTtlSeconds };
  }

  private async createEmailVerificationOtp(
    userId: Types.ObjectId,
    email: string,
  ): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otp, 12);

    await this.authRepository.createVerificationToken({
      userId,
      target: email,
      targetType: VerificationTargetType.Email,
      codeHash,
      purpose: VerificationPurpose.VerifyEmail,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return otp;
  }

  private async createPasswordResetToken(
    userId: Types.ObjectId,
    email: string,
  ): Promise<string> {
    const tokenId = new Types.ObjectId();
    const token = `${tokenId.toString()}.${randomBytes(48).toString('hex')}`;
    const codeHash = await bcrypt.hash(token, 12);

    await this.authRepository.createVerificationToken({
      _id: tokenId,
      userId,
      target: email,
      targetType: VerificationTargetType.Email,
      codeHash,
      purpose: VerificationPurpose.PasswordReset,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return token;
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
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\s/g, '');
  }

  private parseRefreshToken(refreshToken: string): { refreshTokenId: string } {
    const [refreshTokenId] = refreshToken.split('.');
    if (!Types.ObjectId.isValid(refreshTokenId)) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    return { refreshTokenId };
  }

  private parseResetToken(token: string): { tokenId: string } {
    const [tokenId] = token.split('.');
    if (!Types.ObjectId.isValid(tokenId)) {
      throw new BadRequestException('Reset token is expired or invalid');
    }

    return { tokenId };
  }

  private demoTokensEnabled(): boolean {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }
}
