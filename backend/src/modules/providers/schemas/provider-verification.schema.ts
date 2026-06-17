import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderVerificationDocument = HydratedDocument<ProviderVerification>;

export enum VerificationStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

export interface IdentityCardInfo {
  cardNumber: string;
  issuedDate?: Date | null;
  frontImageUrl: string;
  backImageUrl: string;
}

export interface BusinessLicenseInfo {
  licenseNumber?: string | null;
  imageUrl?: string | null;
}

@Schema({ collection: 'provider_verifications', timestamps: true })
export class ProviderVerification {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({
    type: {
      cardNumber: { type: String, required: true },
      issuedDate: { type: Date, default: null },
      frontImageUrl: { type: String, required: true },
      backImageUrl: { type: String, required: true },
    },
    required: true,
  })
  identityCard: IdentityCardInfo;

  @Prop({
    type: {
      licenseNumber: { type: String, default: null },
      imageUrl: { type: String, default: null },
    },
    default: {},
  })
  businessLicense: BusinessLicenseInfo;

  @Prop({ type: [String], default: [] })
  shopPhotos: string[];

  @Prop({ type: [String], default: [] })
  portfolioProof: string[];

  @Prop({
    type: String,
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.Pending,
    index: true,
  })
  status: VerificationStatus;

  @Prop({ type: String, default: null })
  rejectionReason?: string | null;

  @Prop({ type: Date, default: Date.now })
  submittedAt: Date;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId | null;
}

export const ProviderVerificationSchema =
  SchemaFactory.createForClass(ProviderVerification);
