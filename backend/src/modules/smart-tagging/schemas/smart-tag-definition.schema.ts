import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  SmartTagDefinitionStatus,
  SmartTagEntityType,
  SmartTagGroup,
} from '../constants/smart-tag.constants';

export type SmartTagDefinitionDocument = HydratedDocument<SmartTagDefinition>;

export interface SmartTagDisplayConfig {
  color: string;
  backgroundColor: string;
  icon?: string | null;
}

export interface SmartTagRuleConfig {
  keywords?: string[];
}

@Schema({ collection: 'smart_tag_definitions', timestamps: true })
export class SmartTagDefinition {
  @Prop({ required: true, trim: true, uppercase: true, immutable: true })
  code: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  label: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(SmartTagGroup),
    default: null,
    index: true,
  })
  group?: SmartTagGroup | null;

  @Prop({
    type: [String],
    enum: Object.values(SmartTagEntityType),
    required: true,
  })
  entityTypes: SmartTagEntityType[];

  @Prop({ type: Boolean, default: true })
  isPublicBadge: boolean;

  @Prop({
    type: String,
    enum: Object.values(SmartTagDefinitionStatus),
    default: SmartTagDefinitionStatus.Active,
    index: true,
  })
  status: SmartTagDefinitionStatus;

  @Prop({ type: Number, default: 0, min: 0, index: true })
  displayPriority: number;

  @Prop({
    type: {
      color: { type: String, required: true, trim: true },
      backgroundColor: { type: String, required: true, trim: true },
      icon: { type: String, default: null, trim: true },
    },
    required: true,
  })
  displayConfig: SmartTagDisplayConfig;

  @Prop({
    type: {
      keywords: { type: [String], default: [] },
    },
    default: {},
  })
  ruleConfig: SmartTagRuleConfig;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  updatedBy?: Types.ObjectId | null;
}

export const SmartTagDefinitionSchema =
  SchemaFactory.createForClass(SmartTagDefinition);
SmartTagDefinitionSchema.index({ code: 1 }, { unique: true });
SmartTagDefinitionSchema.index({ status: 1, displayPriority: 1 });
