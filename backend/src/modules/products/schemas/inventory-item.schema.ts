import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

export enum ConditionStatus {
  New = 'NEW',
  Good = 'GOOD',
  MinorDamage = 'MINOR_DAMAGE',
  Locked = 'LOCKED',
  Retired = 'RETIRED',
}

export enum InventoryItemStatus {
  Available = 'AVAILABLE',
  Rented = 'RENTED',
  Maintenance = 'MAINTENANCE',
}

@Schema({ collection: 'inventory_items', timestamps: true })
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  sku: string;

  @Prop({ required: true, trim: true, uppercase: true })
  size: string;

  @Prop({ required: true, trim: true })
  color: string;

  @Prop({
    type: String,
    enum: Object.values(ConditionStatus),
    default: ConditionStatus.New,
    index: true,
  })
  conditionStatus: ConditionStatus;

  @Prop({
    type: String,
    enum: Object.values(InventoryItemStatus),
    default: InventoryItemStatus.Available,
    index: true,
  })
  status: InventoryItemStatus;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
