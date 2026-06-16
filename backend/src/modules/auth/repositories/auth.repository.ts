import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LoginHistory,
  LoginProvider,
  LoginStatus,
} from '../schemas/login-history.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';
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
      })
      .sort({ createdAt: -1 });
  }

  findVerificationTokenById(
    tokenId: string,
  ): Promise<VerificationTokenDocument | null> {
    return this.verificationTokenModel.findById(tokenId);
  }

  async revokeActiveVerificationTokens(
    userId: Types.ObjectId,
    purpose: VerificationPurpose,
  ): Promise<void> {
    await this.verificationTokenModel.updateMany(
      { userId, purpose, verifiedAt: null },
      { $set: { verifiedAt: new Date() } },
    );
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
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeActiveRefreshTokens(userId: Types.ObjectId): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
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
}
