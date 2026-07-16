import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  SmartTagEntityType,
  SmartTagGenerationRunStatus,
  SmartTagSourceStatus,
} from '../constants/smart-tag.constants';

export type SmartTagGenerationRunDocument =
  HydratedDocument<SmartTagGenerationRun>;

export interface SmartTagGenerationSourceStatus {
  rule: SmartTagSourceStatus;
  aiText: SmartTagSourceStatus;
  aiImage: SmartTagSourceStatus;
}

@Schema({ collection: 'smart_tag_generation_runs', timestamps: true })
export class SmartTagGenerationRun {
  @Prop({
    type: String,
    enum: Object.values(SmartTagEntityType),
    required: true,
  })
  entityType: SmartTagEntityType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entityId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  entityRevision: number;

  @Prop({ required: true, trim: true })
  inputFingerprint: string;

  @Prop({ required: true, trim: true })
  pipelineVersion: string;

  @Prop({ type: Number, required: true, min: 1 })
  taxonomyRevision: number;

  @Prop({
    type: String,
    enum: Object.values(SmartTagGenerationRunStatus),
    required: true,
    index: true,
  })
  status: SmartTagGenerationRunStatus;

  @Prop({
    type: {
      rule: {
        type: String,
        enum: Object.values(SmartTagSourceStatus),
        required: true,
      },
      aiText: {
        type: String,
        enum: Object.values(SmartTagSourceStatus),
        required: true,
      },
      aiImage: {
        type: String,
        enum: Object.values(SmartTagSourceStatus),
        required: true,
      },
    },
    required: true,
  })
  sourceStatus: SmartTagGenerationSourceStatus;

  @Prop({ type: [String], default: [] })
  resultTagCodes: string[];

  @Prop({ type: String, default: null, trim: true, maxlength: 100 })
  errorCode?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  initiatedBy: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  @Prop({ type: Date, required: true, index: true })
  lockExpiresAt: Date;

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  attemptCount: number;
}

export const SmartTagGenerationRunSchema = SchemaFactory.createForClass(
  SmartTagGenerationRun,
);
SmartTagGenerationRunSchema.index(
  { entityType: 1, entityId: 1, inputFingerprint: 1 },
  { unique: true },
);
SmartTagGenerationRunSchema.index({ status: 1, lockExpiresAt: 1 });
