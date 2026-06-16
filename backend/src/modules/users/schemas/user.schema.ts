import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  PendingEmailVerification = 'PENDING_EMAIL_VERIFICATION',
  Active = 'ACTIVE',
  Banned = 'BANNED',
  Deleted = 'DELETED',
}

export enum Gender {
  Male = 'MALE',
  Female = 'FEMALE',
  Other = 'OTHER',
}

export enum AuthProviderType {
  Local = 'LOCAL',
  Google = 'GOOGLE',
}

export enum FavoriteTargetType {
  Product = 'PRODUCT',
  Provider = 'PROVIDER',
}

export enum MembershipLevel {
  Bronze = 'BRONZE',
  Silver = 'SILVER',
  Gold = 'GOLD',
}

export enum ProviderStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

export interface UserAuthProvider {
  provider: AuthProviderType;
  providerUserId?: string | null;
}

export interface UserAuth {
  email: string;
  emailNormalized: string;
  phone?: string | null;
  phoneNormalized?: string | null;
  passwordHash?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  authProviders: UserAuthProvider[];
}

export interface UserProfile {
  fullName: string;
  avatarUrl?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
}

export interface UserPreferences {
  stylePreferences: string[];
  favoriteColors: string[];
  preferredAoDaiStyles: string[];
  preferredPhotographyStyles: string[];
  sizeInfo: {
    height?: number | null;
    weight?: number | null;
    preferredSize?: string | null;
    bodyShape?: string | null;
  };
  budgetRange: {
    min?: number | null;
    max?: number | null;
  };
  preferredLocations: string[];
}

export interface UserAddress {
  label: string;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  isDefault: boolean;
}

export interface UserFavorite {
  targetType: FavoriteTargetType;
  targetId: Types.ObjectId;
  addedAt: Date;
}

export interface UserLoyalty {
  pointsBalance: number;
  membershipLevel: MembershipLevel;
}

export interface UserProviderProfile {
  providerId?: Types.ObjectId | null;
  providerStatus?: ProviderStatus | null;
}

export interface UserSecurity {
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
}

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({
    type: {
      email: { type: String, required: true, trim: true },
      emailNormalized: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      phone: { type: String, default: null, trim: true },
      phoneNormalized: { type: String, default: null, trim: true },
      passwordHash: { type: String, default: null },
      emailVerified: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false },
      authProviders: [
        {
          _id: false,
          provider: {
            type: String,
            enum: Object.values(AuthProviderType),
            required: true,
          },
          providerUserId: { type: String, default: null, trim: true },
        },
      ],
    },
    required: true,
  })
  auth: UserAuth;

  @Prop({ type: [String], default: ['CUSTOMER'], index: true })
  roles: string[];

  @Prop({ type: String, default: 'CUSTOMER', trim: true, uppercase: true })
  defaultRole: string;

  @Prop({
    enum: UserStatus,
    default: UserStatus.PendingEmailVerification,
    index: true,
  })
  accountStatus: UserStatus;

  @Prop({
    type: {
      fullName: { type: String, required: true, trim: true },
      avatarUrl: { type: String, default: null },
      gender: { type: String, enum: Object.values(Gender), default: null },
      dateOfBirth: { type: Date, default: null },
    },
    required: true,
  })
  profile: UserProfile;

  @Prop({
    type: {
      stylePreferences: { type: [String], default: [] },
      favoriteColors: { type: [String], default: [] },
      preferredAoDaiStyles: { type: [String], default: [] },
      preferredPhotographyStyles: { type: [String], default: [] },
      sizeInfo: {
        height: { type: Number, default: null },
        weight: { type: Number, default: null },
        preferredSize: { type: String, default: null },
        bodyShape: { type: String, default: null },
      },
      budgetRange: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
      },
      preferredLocations: { type: [String], default: [] },
    },
    default: {},
  })
  preferences: UserPreferences;

  @Prop({
    type: [
      {
        label: { type: String, required: true, trim: true },
        addressLine: { type: String, required: true, trim: true },
        ward: { type: String, default: null, trim: true },
        district: { type: String, default: null, trim: true },
        city: { type: String, default: null, trim: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  addresses: UserAddress[];

  @Prop({
    type: [
      {
        targetType: {
          type: String,
          enum: Object.values(FavoriteTargetType),
          required: true,
        },
        targetId: { type: Types.ObjectId, required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  favorites: UserFavorite[];

  @Prop({
    type: {
      pointsBalance: { type: Number, default: 0 },
      membershipLevel: {
        type: String,
        enum: Object.values(MembershipLevel),
        default: MembershipLevel.Bronze,
      },
    },
    default: {},
  })
  loyalty: UserLoyalty;

  @Prop({
    type: {
      providerId: { type: Types.ObjectId, default: null },
      providerStatus: {
        type: String,
        enum: Object.values(ProviderStatus),
        default: null,
      },
    },
    default: {},
  })
  provider: UserProviderProfile;

  @Prop({
    type: {
      lastLoginAt: { type: Date, default: null },
      passwordChangedAt: { type: Date, default: null },
      failedLoginAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
    },
    default: {},
  })
  security: UserSecurity;

  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index(
  { 'auth.emailNormalized': 1 },
  {
    unique: true,
    partialFilterExpression: { 'auth.emailNormalized': { $type: 'string' } },
  },
);
UserSchema.index(
  { 'auth.phoneNormalized': 1 },
  {
    unique: true,
    partialFilterExpression: { 'auth.phoneNormalized': { $type: 'string' } },
  },
);
UserSchema.index(
  {
    'auth.authProviders.provider': 1,
    'auth.authProviders.providerUserId': 1,
  },
  {
    partialFilterExpression: {
      'auth.authProviders.providerUserId': { $type: 'string' },
    },
  },
);
