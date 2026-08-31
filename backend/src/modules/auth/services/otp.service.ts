import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { Types } from 'mongoose';
import { UsersRepository } from '../../users/repositories/users.repository';
import { AuthRepository } from '../repositories/auth.repository';
import { SecurityEventType } from '../schemas/security-event.schema';
import {
  VerificationPurpose,
  VerificationTargetType,
} from '../schemas/verification-token.schema';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { RequestContext } from '../types/auth.types';
import { EmailQueueService } from './email-queue.service';
import { RateLimitService } from './rate-limit.service';
import { SecurityLogService } from './security-log.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    private readonly emailQueueService: EmailQueueService,
    private readonly rateLimitService: RateLimitService,
    private readonly securityLogService: SecurityLogService,
  ) {}

  async verifyEmail(
    dto: VerifyEmailDto,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const email = this.normalizeEmail(dto.email);
    await this.rateLimitService.assertRateLimit(
      `auth:verify-email:${email}`,
      10,
      15 * 60,
    );
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
      const nextAttemptCount = token.attemptCount + 1;
      const update: Record<string, unknown> = {
        $inc: { attemptCount: 1 },
      };

      if (nextAttemptCount >= token.maxAttempts) {
        update.$set = { revokedAt: new Date() };
      }

      await token.updateOne(update);

      if (nextAttemptCount >= token.maxAttempts) {
        await this.securityLogService.recordSecurityEvent({
          type: SecurityEventType.OtpMaxAttemptsExceeded,
          userId: user._id,
          email,
          metadata: {
            purpose: VerificationPurpose.VerifyEmail,
            attemptCount: nextAttemptCount,
          },
          context,
        });
        throw new ForbiddenException('OTP attempt limit exceeded');
      }

      await this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.OtpFailed,
        userId: user._id,
        email,
        metadata: {
          purpose: VerificationPurpose.VerifyEmail,
          attemptCount: nextAttemptCount,
          maxAttempts: token.maxAttempts,
        },
        context,
      });
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
    await Promise.all([
      this.rateLimitService.assertRateLimit(
        `auth:resend-verification:email:${email}:short`,
        1,
        60,
      ),
      this.rateLimitService.assertRateLimit(
        `auth:resend-verification:email:${email}:window`,
        5,
        15 * 60,
      ),
    ]);
    const user = await this.usersRepository.findUserByEmail(email);

    if (!user || user.auth.emailVerified) {
      return {
        message: 'If the email needs verification, a new OTP has been sent.',
      };
    }

    const otp = await this.sendFreshEmailVerificationOtp(user._id, email);

    return {
      message: 'If the email needs verification, a new OTP has been sent.',
      demoOtp: this.demoTokensEnabled() ? otp : undefined,
    };
  }

  async sendFreshEmailVerificationOtp(
    userId: Types.ObjectId,
    email: string,
  ): Promise<string> {
    const { otp, tokenId } = await this.createEmailVerificationOtp(userId, email);
    await this.enqueueVerificationEmail(userId, email, otp, tokenId);
    await this.authRepository.revokeOtherActiveVerificationTokens(
      userId,
      VerificationPurpose.VerifyEmail,
      tokenId,
    );

    return otp;
  }

  async createAndSendEmailVerificationOtp(
    userId: Types.ObjectId,
    email: string,
  ): Promise<string> {
    const { otp, tokenId } = await this.createEmailVerificationOtp(userId, email);
    await this.enqueueVerificationEmail(userId, email, otp, tokenId);

    return otp;
  }

  private async createEmailVerificationOtp(
    userId: Types.ObjectId,
    email: string,
  ): Promise<{ otp: string; tokenId: Types.ObjectId }> {
    const otp = randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otp, 12);

    const token = await this.authRepository.createVerificationToken({
      userId,
      target: email,
      targetType: VerificationTargetType.Email,
      codeHash,
      purpose: VerificationPurpose.VerifyEmail,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return { otp, tokenId: token._id };
  }

  private async enqueueVerificationEmail(
    userId: Types.ObjectId,
    email: string,
    otp: string,
    tokenId: Types.ObjectId,
  ): Promise<void> {
    try {
      await this.emailQueueService.enqueueVerificationOtp({
        userId: userId.toString(),
        verificationTokenId: tokenId.toString(),
        email,
        otp,
      });
    } catch {
      await this.authRepository
        .revokeVerificationToken(tokenId)
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        'Email verification is temporarily unavailable. Please try again.',
      );
    }
  }

  private demoTokensEnabled(): boolean {
    return this.configService.get<string>('AUTH_DEMO_TOKENS_ENABLED') === 'true';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
