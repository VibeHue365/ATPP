import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  SmartTagActorRole,
  SmartTagDecisionAction,
  SmartTagEntityType,
} from '../constants/smart-tag.constants';

export type SmartTagDecisionDocument = HydratedDocument<SmartTagDecision>;

@Schema({ collection: 'smart_tag_decisions', timestamps: true })
export class SmartTagDecision {
  @Prop({
    type: Types.ObjectId,
    ref: 'SmartTagAssignment',
    default: null,
    index: true,
  })
  assignmentId?: Types.ObjectId | null;

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

  @Prop({
    type: String,
    enum: Object.values(SmartTagDecisionAction),
    required: true,
  })
  action: SmartTagDecisionAction;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(SmartTagActorRole),
    required: true,
  })
  actorRole: SmartTagActorRole;

  @Prop({ type: String, default: null, trim: true, maxlength: 300 })
  reason?: string | null;

  @Prop({ type: Number, required: true, min: 1 })
  decisionVersion: number;
}

export const SmartTagDecisionSchema =
  SchemaFactory.createForClass(SmartTagDecision);
SmartTagDecisionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
SmartTagDecisionSchema.index({ assignmentId: 1, createdAt: -1 });
