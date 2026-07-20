import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

export enum ProviderCapability {
  AoDaiRental = 'AODAI_RENTAL',
  Photography = 'PHOTOGRAPHY',
}

export enum ProviderStatus {
  PendingApproval = 'PENDING_APPROVAL',
  Active = 'ACTIVE',
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

export interface GeoPoint {
  type: 'Point';
  /** GeoJSON coordinate order: [longitude, latitude]. */
  coordinates: [number, number];
}

export interface ProviderRentalSettings {
  useBusinessAddressForPickup: boolean;
  pickupLocation?: ProviderAddress | null;
}

export interface ProviderPhotographySettings {
  /** Maximum straight-line distance from the provider base location in kilometres. */
  serviceRadiusKm?: number | null;
}

export interface ProviderAddress {
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  geo?: GeoPoint | null;
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
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
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
      geo: { type: Object, default: null },
    },
    required: true,
  })
  address: ProviderAddress;

  @Prop({ type: Object, default: { useBusinessAddressForPickup: true, pickupLocation: null } })
  rentalSettings: ProviderRentalSettings;

  @Prop({ type: Object, default: { serviceRadiusKm: null } })
  photographySettings: ProviderPhotographySettings;

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
    default: ProviderStatus.PendingApproval,
    index: true,
  })
  status: ProviderStatus;

  @Prop({ type: Date, default: null })
  approvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy?: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  comboDiscountPercent: number;

  @Prop({ type: Number, default: 0 })
  violationCount: number;
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);
ProviderSchema.index({ userId: 1, status: 1 });
ProviderSchema.index({ capabilities: 1 });
ProviderSchema.index({ 'address.city': 1 });
ProviderSchema.index({ 'address.geo': '2dsphere' });
ProviderSchema.index({ 'rentalSettings.pickupLocation.geo': '2dsphere' });
