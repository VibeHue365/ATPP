import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SearchLogDocument = HydratedDocument<SearchLog>;

@Schema({ collection: 'search_logs', timestamps: true })
export class SearchLog {
  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true })
  keyword: string;

  @Prop({ type: Number, default: 1 })
  count: number;

  @Prop({ type: Date, default: Date.now, index: true })
  lastSearchedAt: Date;
}

export const SearchLogSchema = SchemaFactory.createForClass(SearchLog);
