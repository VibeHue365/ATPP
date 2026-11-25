import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProviderStaffDocument = HydratedDocument<ProviderStaff>;

export enum ProviderStaffStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export interface ProviderStaffBlockedSlot {
  _id: Types.ObjectId;
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh */
  date: string;
  /** Optional HH:mm; null/empty means full day blocked */
  startTime?: string | null;
  /** Optional HH:mm; null/empty means full day blocked */
  endTime?: string | null;
  reason?: string | null;
  createdAt: Date;
}

@Schema({ collection: 'provider_staff', timestamps: true })
export class ProviderStaff {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 30 })
  phone: string;

  @Prop({ type: String, default: null, trim: true })
  avatarUrl?: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  specialty?: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 600 })
  bio?: string | null;

  @Prop({ type: Number, default: null, min: 0, max: 60 })
  experienceYears?: number | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  internalNote?: string | null;

  @Prop({
    type: String,
    enum: Object.values(ProviderStaffStatus),
    default: ProviderStaffStatus.Active,
    index: true,
  })
  status: ProviderStaffStatus;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  /** Optional link to an isolated User with role STAFF (populated in Phase 2). */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  linkedUserId?: Types.ObjectId | null;

  /** Individual off-days or blocked time windows for this staff member. */
  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId, required: true },
        date: { type: String, required: true, trim: true },
        startTime: { type: String, default: null, trim: true },
        endTime: { type: String, default: null, trim: true },
        reason: { type: String, default: null, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  blockedSlots: ProviderStaffBlockedSlot[];
}

export const ProviderStaffSchema = SchemaFactory.createForClass(ProviderStaff);

ProviderStaffSchema.index({ providerId: 1, status: 1, sortOrder: 1 });
ProviderStaffSchema.index({ providerId: 1, 'blockedSlots.date': 1 });
