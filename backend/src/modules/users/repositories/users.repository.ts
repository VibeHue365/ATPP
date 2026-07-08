import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuthProviderType,
  User,
  UserAuthProvider,
  UserDocument,
  UserProfile,
  UserStatus,
} from '../schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
