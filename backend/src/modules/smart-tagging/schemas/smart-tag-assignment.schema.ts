import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  SmartTagActorRole,
  SmartTagAssignmentStatus,
  SmartTagEntityType,
  SmartTagSignalSource,
} from '../constants/smart-tag.constants';

export type SmartTagAssignmentDocument = HydratedDocument<SmartTagAssignment>;

export interface SmartTagSignalEvidence {
  matchedFields?: string[];
  matchedKeywords?: string[];
  imageIndexes?: number[];
  explanation?: string | null;
}

export interface SmartTagModelMetadata {
  provider?: string | null;
  model?: string | null;
  modelVersion?: string | null;
  promptVersion?: string | null;
  latencyMs?: number | null;
}

export interface SmartTagSignal {
  source: SmartTagSignalSource;
  confidence?: number | null;
  evidence?: SmartTagSignalEvidence;
  modelMetadata?: SmartTagModelMetadata;
}

@Schema({ collection: 'smart_tag_assignments', timestamps: true })
export class SmartTagAssignment {
  @Prop({
    type: String,
    enum: Object.values(SmartTagEntityType),
    required: true,
  })
  entityType: SmartTagEntityType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entityId: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  tagCode: string;

  @Prop({ type: Number, required: true, min: 1 })
  entityRevision: number;

  @Prop({ type: Number, required: true, min: 1 })
  taxonomyRevision: number;

  @Prop({ required: true, trim: true })
  lastInputFingerprint: string;

  @Prop({
    type: [
      {
        source: {
          type: String,
          enum: Object.values(SmartTagSignalSource),
          required: true,
        },
        confidence: { type: Number, default: null, min: 0, max: 1 },
        evidence: {
          matchedFields: { type: [String], default: [] },
          matchedKeywords: { type: [String], default: [] },
          imageIndexes: { type: [Number], default: [] },
          explanation: { type: String, default: null, maxlength: 1000 },
        },
        modelMetadata: {
          provider: { type: String, default: null },
          model: { type: String, default: null },
          modelVersion: { type: String, default: null },
          promptVersion: { type: String, default: null },
          latencyMs: { type: Number, default: null, min: 0 },
        },
      },
    ],
    default: [],
  })
  signals: SmartTagSignal[];

  @Prop({
    type: String,
    enum: Object.values(SmartTagAssignmentStatus),
    required: true,
    default: SmartTagAssignmentStatus.Suggested,
    index: true,
  })
  status: SmartTagAssignmentStatus;

  @Prop({ type: Date, required: true, default: Date.now })
  suggestedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  decidedBy?: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(SmartTagActorRole), default: null })
  decidedByRole?: SmartTagActorRole | null;

  @Prop({ type: Date, default: null })
  decidedAt?: Date | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 300 })
  decisionReason?: string | null;
}

export const SmartTagAssignmentSchema =
  SchemaFactory.createForClass(SmartTagAssignment);
SmartTagAssignmentSchema.index(
  { entityType: 1, entityId: 1, tagCode: 1 },
  { unique: true },
);
SmartTagAssignmentSchema.index({
  entityType: 1,
  entityId: 1,
  entityRevision: 1,
  status: 1,
});
SmartTagAssignmentSchema.index({ status: 1, updatedAt: -1 });
