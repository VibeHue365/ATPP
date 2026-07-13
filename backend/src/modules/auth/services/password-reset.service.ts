import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { UsersRepository } from '../../users/repositories/users.repository';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { SecurityEventType } from '../schemas/security-event.schema';
import {
  VerificationPurpose,
  VerificationTargetType,
} from '../schemas/verification-token.schema';
import { RequestContext } from '../types/auth.types';
import { MailService } from './mail.service';
import { RateLimitService } from './rate-limit.service';
import { SecurityLogService } from './security-log.service';
import { PasswordPolicyService } from './password-policy.service';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly rateLimitService: RateLimitService,
    private readonly securityLogService: SecurityLogService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

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

    this.passwordPolicyService.assertAcceptablePassword(dto.newPassword);
    await this.passwordPolicyService.assertDifferentPassword(
      dto.newPassword,
      user.auth.passwordHash,
    );
    const passwordHash = await this.passwordPolicyService.hashPassword(
      dto.newPassword,
    );
    await Promise.all([
      this.usersRepository.updatePassword(userObjectId, passwordHash),
      this.authRepository.revokeActiveRefreshTokens(userObjectId),
      this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.PasswordChanged,
        userId: userObjectId,
        context,
      }),
    ]);

    return { message: 'Password changed successfully. Please login again.' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(dto.email);
    await Promise.all([
      this.rateLimitService.assertRateLimit(
        `auth:forgot-password:email:${email}:short`,
        1,
        60,
      ),
      this.rateLimitService.assertRateLimit(
        `auth:forgot-password:email:${email}:window`,
        5,
        15 * 60,
      ),
    ]);
    const user = await this.usersRepository.findActiveUserByEmail(email);

    if (!user || !user.auth.emailVerified) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const token = await this.createPasswordResetToken(user._id, email);
    await this.mailService.sendPasswordResetLink(email, token);
    await this.securityLogService.recordSecurityEvent({
      type: SecurityEventType.PasswordResetRequested,
      userId: user._id,
      email,
      context,
    });

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
    await this.rateLimitService.assertRateLimit(
      `auth:reset-password:${tokenId}`,
      10,
      15 * 60,
    );
    const resetToken =
      await this.authRepository.findVerificationTokenById(tokenId);

    if (
      !resetToken ||
      resetToken.purpose !== VerificationPurpose.PasswordReset ||
      resetToken.verifiedAt ||
      resetToken.revokedAt ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token is expired or invalid');
    }

    const validToken = await bcrypt.compare(dto.token, resetToken.codeHash);
    if (!validToken) {
      throw new BadRequestException('Reset token is expired or invalid');
    }

    this.passwordPolicyService.assertAcceptablePassword(dto.newPassword);
    const passwordHash = await this.passwordPolicyService.hashPassword(
      dto.newPassword,
    );
    await Promise.all([
      this.usersRepository.updatePassword(resetToken.userId, passwordHash),
      resetToken.updateOne({ $set: { verifiedAt: new Date() } }),
      this.authRepository.revokeActiveRefreshTokens(resetToken.userId),
      this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.PasswordResetSuccess,
        userId: resetToken.userId,
        email: resetToken.target,
        context,
      }),
    ]);

    return { message: 'Password reset successfully' };
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

  private parseResetToken(token: string): { tokenId: string } {
    const [tokenId] = token.split('.');
    if (!Types.ObjectId.isValid(tokenId)) {
      throw new BadRequestException('Reset token is expired or invalid');
    }

    return { tokenId };
  }

  private demoTokensEnabled(): boolean {
    return this.configService.get<string>('AUTH_DEMO_TOKENS_ENABLED') === 'true';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
