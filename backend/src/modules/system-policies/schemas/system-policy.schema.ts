import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PolicyCode } from '../constants/policy-code.enum';
import { PolicyStatus } from '../constants/policy-status.enum';
import { PolicyType } from '../constants/policy-type.enum';

export type SystemPolicyDocument = HydratedDocument<SystemPolicy>;

@Schema({ collection: 'system_policies', timestamps: true })
export class SystemPolicy {
  @Prop({
    type: String,
    enum: Object.values(PolicyCode),
    required: true,
    index: true,
  })
  code: PolicyCode;

  @Prop({
    type: String,
    enum: Object.values(PolicyType),
    required: true,
    index: true,
  })
  type: PolicyType;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Object, required: true })
  value: Record<string, unknown>;

  @Prop({
    type: String,
    enum: Object.values(PolicyStatus),
    default: PolicyStatus.Draft,
    index: true,
  })
  status: PolicyStatus;

  @Prop({ type: Number, required: true, min: 1 })
  version: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  updatedBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  activatedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  activatedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  deactivatedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  deactivatedAt?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  reason?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SystemPolicySchema = SchemaFactory.createForClass(SystemPolicy);

SystemPolicySchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { status: PolicyStatus.Active },
  },
);
SystemPolicySchema.index({ code: 1, version: 1 }, { unique: true });
SystemPolicySchema.index({ code: 1, version: -1 });
SystemPolicySchema.index({ type: 1, status: 1 });
SystemPolicySchema.index({ status: 1 });
