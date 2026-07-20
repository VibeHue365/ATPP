import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SMART_TAG_TAXONOMY_SCOPE } from '../constants/smart-tag.constants';

export type SmartTagTaxonomyMetadataDocument =
  HydratedDocument<SmartTagTaxonomyMetadata>;

@Schema({ collection: 'smart_tag_taxonomy_metadata', timestamps: true })
export class SmartTagTaxonomyMetadata {
  @Prop({ required: true, default: SMART_TAG_TAXONOMY_SCOPE, immutable: true })
  scope: string;

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  taxonomyRevision: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  updatedBy?: Types.ObjectId | null;
}

export const SmartTagTaxonomyMetadataSchema = SchemaFactory.createForClass(
  SmartTagTaxonomyMetadata,
);
SmartTagTaxonomyMetadataSchema.index({ scope: 1 }, { unique: true });
