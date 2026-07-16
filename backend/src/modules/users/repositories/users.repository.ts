import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  AuthProviderType,
  User,
  UserAuthProvider,
  UserDocument,
  UserProfile,
  UserStatus,
} from '../schemas/user.schema';

export interface AdminUserListFilters {
  keyword?: string;
  role?: string;
  status?: UserStatus;
  page: number;
  limit: number;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async existsByEmail(emailNormalized: string): Promise<boolean> {
    return Boolean(
      await this.userModel.exists({
        'auth.emailNormalized': emailNormalized,
        deletedAt: null,
      }),
    );
  }

  async existsByPhone(phoneNormalized: string): Promise<boolean> {
    return Boolean(
      await this.userModel.exists({
        'auth.phoneNormalized': phoneNormalized,
        deletedAt: null,
      }),
    );
  }

  async isPhoneUsedByAnotherUser(
    phoneNormalized: string,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    return Boolean(
      await this.userModel.exists({
        _id: { $ne: userId },
        'auth.phoneNormalized': phoneNormalized,
        deletedAt: null,
      }),
    );
  }

  createUser(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findUserByEmail(emailNormalized: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      'auth.emailNormalized': emailNormalized,
      deletedAt: null,
    });
  }

  findActiveUserByEmail(emailNormalized: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      'auth.emailNormalized': emailNormalized,
      accountStatus: UserStatus.Active,
      deletedAt: null,
    });
  }

  findUserById(userId: Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findOne({ _id: userId, deletedAt: null });
  }

  async listUsersForAdmin(
    filters: AdminUserListFilters,
  ): Promise<{ items: UserDocument[]; total: number }> {
    const query: Record<string, unknown> = { deletedAt: null };

    if (filters.role) {
      query.roles = filters.role.toUpperCase();
    }

    if (filters.status) {
      query.accountStatus = filters.status;
    }

    if (filters.keyword) {
      const keyword = filters.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { 'profile.fullName': { $regex: keyword, $options: 'i' } },
        { 'auth.email': { $regex: keyword, $options: 'i' } },
        { 'auth.phone': { $regex: keyword, $options: 'i' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      this.userModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit),
      this.userModel.countDocuments(query),
    ]);

    return { items, total };
  }

  async updateRoles(
    userId: Types.ObjectId,
    roles: string[],
    defaultRole: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set: { roles, defaultRole } },
      { new: true },
    );
  }

  async updateAccountStatus(
    userId: Types.ObjectId,
    status: UserStatus,
    reason?: string,
  ): Promise<UserDocument | null> {
    const update: Record<string, unknown> = { accountStatus: status };

    if (status === UserStatus.Active) {
      update['security.lockedUntil'] = null;
      update['security.lockedAt'] = null;
      update['security.lockedBy'] = null;
      update['security.lockedReason'] = null;
    } else if (reason !== undefined) {
      update['security.lockedReason'] = reason;
    }

    return this.userModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set: update },
      { new: true },
    );
  }

  async lockUser(
    userId: Types.ObjectId,
    status: UserStatus.Suspended | UserStatus.Banned,
    actorId: Types.ObjectId,
    reason?: string,
    lockedUntil?: Date | null,
  ): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      {
        $set: {
          accountStatus: status,
          'security.lockedUntil': lockedUntil ?? null,
          'security.lockedAt': new Date(),
          'security.lockedBy': actorId,
          'security.lockedReason': reason ?? null,
        },
      },
      { new: true },
    );
  }

  async unlockUser(userId: Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      {
        $set: { accountStatus: UserStatus.Active },
        $unset: {
          'security.lockedUntil': '',
          'security.lockedAt': '',
          'security.lockedBy': '',
          'security.lockedReason': '',
        },
      },
      { new: true },
    );
  }

  countActiveAdmins(): Promise<number> {
    return this.userModel.countDocuments({
      roles: 'ADMIN',
      accountStatus: UserStatus.Active,
      deletedAt: null,
    });
  }

  async findActiveRoleCodes(roleCodes: string[]): Promise<string[]> {
    const roles = await this.connection
      .collection<{ code: string }>('roles')
      .find({ code: { $in: roleCodes }, status: 'ACTIVE' }, { projection: { code: 1 } })
      .toArray();
    return roles.map((role) => role.code);
  }

  async revokeActiveSessions(userId: Types.ObjectId, reason: string): Promise<number> {
    const result = await this.connection.collection('refresh_tokens').updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
  }

  async listRecentLoginHistory(userId: Types.ObjectId, limit = 10) {
    return this.connection
      .collection('login_histories')
      .find(
        { userId },
        {
          projection: {
            provider: 1,
            status: 1,
            ipAddress: 1,
            userAgent: 1,
            loggedInAt: 1,
            failureReason: 1,
          },
        },
      )
      .sort({ loggedInAt: -1 })
      .limit(limit)
      .toArray();
  }

  async restoreExpiredSuspension(userId: Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      {
        _id: userId,
        accountStatus: UserStatus.Suspended,
        'security.lockedUntil': { $ne: null, $lte: new Date() },
        deletedAt: null,
      },
      {
        $set: { accountStatus: UserStatus.Active },
        $unset: {
          'security.lockedUntil': '',
          'security.lockedAt': '',
          'security.lockedBy': '',
          'security.lockedReason': '',
        },
      },
      { new: true },
    );
  }

  findUserByAuthProvider(
    provider: AuthProviderType,
    providerUserId: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({
      'auth.authProviders': {
        $elemMatch: {
          provider,
          providerUserId,
        },
      },
      deletedAt: null,
    });
  }

  async addAuthProvider(
    userId: Types.ObjectId,
    authProvider: UserAuthProvider,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $addToSet: { 'auth.authProviders': authProvider } },
    );
  }

  async addRole(userId: Types.ObjectId, roleCode: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $addToSet: { roles: roleCode },
        $set: { defaultRole: roleCode },
      },
    );
  }

  async updateProfile(
    userId: Types.ObjectId,
    update: Partial<UserProfile> & {
      phone?: string | null;
      phoneNormalized?: string | null;
    },
  ): Promise<void> {
    const $set: Record<string, unknown> = {};

    if (update.fullName !== undefined) {
      $set['profile.fullName'] = update.fullName;
    }
    if (update.avatarUrl !== undefined) {
      $set['profile.avatarUrl'] = update.avatarUrl;
    }
    if (update.gender !== undefined) {
      $set['profile.gender'] = update.gender;
    }
    if (update.dateOfBirth !== undefined) {
      $set['profile.dateOfBirth'] = update.dateOfBirth;
    }
    if (update.phone !== undefined) {
      $set['auth.phone'] = update.phone;
      $set['auth.phoneNormalized'] = update.phoneNormalized;
    }

    if (Object.keys($set).length === 0) {
      return;
    }

    await this.userModel.updateOne({ _id: userId }, { $set });
  }

  async activateEmail(userId: Types.ObjectId): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          'auth.emailVerified': true,
          accountStatus: UserStatus.Active,
        },
      },
    );
  }

  async updatePassword(
    userId: Types.ObjectId,
    passwordHash: string,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          'auth.passwordHash': passwordHash,
          'security.passwordChangedAt': new Date(),
        },
      },
    );
  }

  async markLoggedIn(userId: Types.ObjectId): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: { 'security.lastLoginAt': new Date() },
        $unset: { 'security.lockedUntil': '' },
      },
    );
  }

  async updatePreferences(
    userId: Types.ObjectId,
    preferences: any,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          preferences,
          hasCompletedOnboarding: true,
        },
      },
    );
  }

  async toggleFavorite(
    userId: Types.ObjectId,
    targetType: string,
    targetId: Types.ObjectId,
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    const favorites = user.favorites || [];
    const index = favorites.findIndex(
      (fav) => fav.targetId.toString() === targetId.toString() && fav.targetType === targetType
    );

    if (index > -1) {
      await this.userModel.updateOne(
        { _id: userId },
        { $pull: { favorites: { targetId, targetType } } }
      );
    } else {
      await this.userModel.updateOne(
        { _id: userId },
        {
          $push: {
            favorites: {
              targetType,
              targetId,
              addedAt: new Date(),
            },
          },
        }
      );
    }
  }
}
