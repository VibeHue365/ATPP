import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LoginHistory,
  LoginProvider,
  LoginStatus,
} from '../schemas/login-history.schema';
import { OAuthState, OAuthStateDocument } from '../schemas/oauth-state.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';
import { RateLimit, RateLimitDocument } from '../schemas/rate-limit.schema';
import {
  VerificationPurpose,
  VerificationToken,
  VerificationTokenDocument,
} from '../schemas/verification-token.schema';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectModel(VerificationToken.name)
    private readonly verificationTokenModel: Model<VerificationToken>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
    @InjectModel(LoginHistory.name)
    private readonly loginHistoryModel: Model<LoginHistory>,
    @InjectModel(RateLimit.name)
    private readonly rateLimitModel: Model<RateLimit>,
    @InjectModel(OAuthState.name)
    private readonly oauthStateModel: Model<OAuthState>,
  ) {}

  createVerificationToken(
    data: Partial<VerificationToken> & { _id?: Types.ObjectId },
  ): Promise<VerificationTokenDocument> {
    return this.verificationTokenModel.create(data);
  }

  findLatestActiveVerificationToken(
    userId: Types.ObjectId,
    target: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationTokenDocument | null> {
    return this.verificationTokenModel
      .findOne({
        userId,
        target,
        purpose,
        verifiedAt: null,
        revokedAt: null,
      })
      .sort({ createdAt: -1 });
  }

  findVerificationTokenById(
    tokenId: string,
  ): Promise<VerificationTokenDocument | null> {
    return this.verificationTokenModel.findById(tokenId);
  }

  async revokeVerificationToken(tokenId: Types.ObjectId): Promise<void> {
    await this.verificationTokenModel.updateOne(
      { _id: tokenId, verifiedAt: null, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeActiveVerificationTokens(
    userId: Types.ObjectId,
    purpose: VerificationPurpose,
  ): Promise<void> {
    await this.verificationTokenModel.updateMany(
      { userId, purpose, verifiedAt: null, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeOtherActiveVerificationTokens(
    userId: Types.ObjectId,
    purpose: VerificationPurpose,
    keepTokenId: Types.ObjectId,
  ): Promise<void> {
    await this.verificationTokenModel.updateMany(
      {
        _id: { $ne: keepTokenId },
        userId,
        purpose,
        verifiedAt: null,
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } },
    );
  }

  async markVerificationTokenVerifiedIfActive(
    tokenId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.verificationTokenModel.updateOne(
      { _id: tokenId, verifiedAt: null, revokedAt: null },
      { $set: { verifiedAt: new Date() } },
    );

    return result.modifiedCount === 1;
  }

  createRefreshToken(
    data: Partial<RefreshToken> & { _id: Types.ObjectId },
  ): Promise<RefreshTokenDocument> {
    return this.refreshTokenModel.create(data);
  }

  findRefreshTokenById(
    refreshTokenId: string,
  ): Promise<RefreshTokenDocument | null> {
    return this.refreshTokenModel.findById(refreshTokenId);
  }

  async revokeRefreshToken(
    refreshTokenId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    await this.refreshTokenModel.updateOne(
      { _id: refreshTokenId, userId },
      { $set: { revokedAt: new Date(), revokedReason: 'LOGOUT' } },
    );
  }

  async revokeRefreshTokenIfActive(
    refreshTokenId: Types.ObjectId,
    userId: Types.ObjectId,
    replacedByTokenId?: Types.ObjectId,
  ): Promise<boolean> {
    const update: Record<string, unknown> = {
      revokedAt: new Date(),
      revokedReason: 'ROTATED',
    };
    if (replacedByTokenId) {
      update.replacedByTokenId = replacedByTokenId;
    }

    const result = await this.refreshTokenModel.updateOne(
      {
        _id: refreshTokenId,
        userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: update },
    );

    return result.modifiedCount === 1;
  }
  async revokeActiveRefreshTokens(userId: Types.ObjectId): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'REVOKED_ALL' } },
    );
  }

  async recordLogin(
    userId: Types.ObjectId | null,
    emailOrPhone: string,
    provider: LoginProvider,
    status: LoginStatus,
    failureReason: string | null,
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string,
  ): Promise<void> {
    await this.loginHistoryModel.create({
      userId,
      emailOrPhone,
      provider,
      status,
      failureReason,
      ipAddress,
      userAgent,
      deviceId,
      loggedInAt: new Date(),
    });
  }

  async consumeRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<RateLimitDocument> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    const existing = await this.rateLimitModel.findOne({ key });

    if (!existing || existing.expiresAt.getTime() <= now.getTime()) {
      return this.rateLimitModel.findOneAndUpdate(
        { key },
        { $set: { count: 1, expiresAt, lastAttemptAt: now } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    existing.count += 1;
    existing.lastAttemptAt = now;
    return existing.save();
  }

  createOAuthState(
    data: Partial<OAuthState> & { _id: Types.ObjectId },
  ): Promise<OAuthStateDocument> {
    return this.oauthStateModel.create(data);
  }

  findOAuthStateById(stateId: string): Promise<OAuthStateDocument | null> {
    return this.oauthStateModel.findById(stateId);
  }

  async markOAuthStateUsedIfActive(stateId: Types.ObjectId): Promise<boolean> {
    const result = await this.oauthStateModel.updateOne(
      {
        _id: stateId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
    );

    return result.modifiedCount === 1;
  }
}
