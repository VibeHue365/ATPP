import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

export enum ProviderCapability {
  AoDaiRental = 'AODAI_RENTAL',
  Photography = 'PHOTOGRAPHY',
}

export enum ProviderStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Suspended = 'SUSPENDED',
}

export enum PaymentAccountType {
  BankAccount = 'BANK_ACCOUNT',
}

export enum PaymentAccountStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export interface ProviderContact {
  email: string;
  phone: string;
  website?: string | null;
}

export interface ProviderAddress {
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
}

export interface ProviderMedia {
  logoUrl?: string | null;
  coverUrl?: string | null;
  images: string[];
}

export interface ProviderPolicies {
  cancellationPolicy?: string | null;
  rentalPolicy?: string | null;
}

export interface PaymentAccount {
  accountType: PaymentAccountType;
  bankName: string;
  accountNumberMasked: string;
  accountHolder: string;
  isDefault: boolean;
  status: PaymentAccountStatus;
}

export interface ProviderRating {
  averageRating: number;
  totalReviews: number;
}

@Schema({ collection: 'providers', timestamps: true })
export class Provider {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  businessName: string;

  @Prop({
    type: [String],
    enum: Object.values(ProviderCapability),
    default: [],
  })
  capabilities: ProviderCapability[];

  @Prop({
    type: {
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      website: { type: String, default: null },
    },
    required: true,
  })
  contact: ProviderContact;

  @Prop({
    type: {
      addressLine: { type: String, required: true, trim: true },
      ward: { type: String, default: null, trim: true },
      district: { type: String, default: null, trim: true },
      city: { type: String, default: null, trim: true },
    },
    required: true,
  })
  address: ProviderAddress;

  @Prop({
    type: {
      logoUrl: { type: String, default: null },
      coverUrl: { type: String, default: null },
      images: { type: [String], default: [] },
    },
    default: {},
  })
  media: ProviderMedia;

  @Prop({
    type: {
      cancellationPolicy: { type: String, default: null },
      rentalPolicy: { type: String, default: null },
    },
    default: {},
  })
  policies: ProviderPolicies;

  @Prop({
    type: [
      {
        _id: false,
        accountType: {
          type: String,
          enum: Object.values(PaymentAccountType),
          default: PaymentAccountType.BankAccount,
        },
        bankName: { type: String, required: true },
        accountNumberMasked: { type: String, required: true },
        accountHolder: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        status: {
          type: String,
          enum: Object.values(PaymentAccountStatus),
          default: PaymentAccountStatus.Active,
        },
      },
    ],
    default: [],
  })
  paymentAccounts: PaymentAccount[];

  @Prop({
    type: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    default: { averageRating: 0, totalReviews: 0 },
  })
  rating: ProviderRating;

  @Prop({
    type: String,
    enum: Object.values(ProviderStatus),
    default: ProviderStatus.Pending,
    index: true,
  })
  status: ProviderStatus;

  @Prop({ type: Date, default: null })
  approvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy?: Types.ObjectId | null;
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);
