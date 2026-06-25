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
  UserPreferences,
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
    hasCompletedOnboarding?: boolean,
    preferences?: Partial<UserPreferences>,
  ): Promise<void> {
    const $set: Record<string, unknown> = {};

    if (hasCompletedOnboarding !== undefined) {
      $set.hasCompletedOnboarding = hasCompletedOnboarding;
    }

    if (preferences !== undefined) {
      if (preferences.stylePreferences !== undefined) {
        $set['preferences.stylePreferences'] = preferences.stylePreferences;
      }
      if (preferences.favoriteColors !== undefined) {
        $set['preferences.favoriteColors'] = preferences.favoriteColors;
      }
      if (preferences.preferredAoDaiStyles !== undefined) {
        $set['preferences.preferredAoDaiStyles'] = preferences.preferredAoDaiStyles;
      }
      if (preferences.preferredPhotographyStyles !== undefined) {
        $set['preferences.preferredPhotographyStyles'] = preferences.preferredPhotographyStyles;
      }
      if (preferences.sizeInfo !== undefined) {
        if (preferences.sizeInfo.height !== undefined) {
          $set['preferences.sizeInfo.height'] = preferences.sizeInfo.height;
        }
        if (preferences.sizeInfo.weight !== undefined) {
          $set['preferences.sizeInfo.weight'] = preferences.sizeInfo.weight;
        }
        if (preferences.sizeInfo.preferredSize !== undefined) {
          $set['preferences.sizeInfo.preferredSize'] = preferences.sizeInfo.preferredSize;
        }
        if (preferences.sizeInfo.bodyShape !== undefined) {
          $set['preferences.sizeInfo.bodyShape'] = preferences.sizeInfo.bodyShape;
        }
        if (preferences.sizeInfo.chest !== undefined) {
          $set['preferences.sizeInfo.chest'] = preferences.sizeInfo.chest;
        }
        if (preferences.sizeInfo.waist !== undefined) {
          $set['preferences.sizeInfo.waist'] = preferences.sizeInfo.waist;
        }
        if (preferences.sizeInfo.hips !== undefined) {
          $set['preferences.sizeInfo.hips'] = preferences.sizeInfo.hips;
        }
      }
      if (preferences.budgetRange !== undefined) {
        if (preferences.budgetRange.min !== undefined) {
          $set['preferences.budgetRange.min'] = preferences.budgetRange.min;
        }
        if (preferences.budgetRange.max !== undefined) {
          $set['preferences.budgetRange.max'] = preferences.budgetRange.max;
        }
      }
      if (preferences.preferredLocations !== undefined) {
        $set['preferences.preferredLocations'] = preferences.preferredLocations;
      }
    }

    if (Object.keys($set).length === 0) {
      return;
    }

    await this.userModel.updateOne({ _id: userId }, { $set });
  }
}
