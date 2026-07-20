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
  Cleaning = 'CLEANING',
}

@Schema({ collection: 'inventory_items', timestamps: true })
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
  })
  sku: string;

  @Prop({ required: true, trim: true, uppercase: true })
  size: string;

  @Prop({ required: true, trim: true })
  color: string;

  @Prop({ type: String, default: null, trim: true })
  material?: string | null;

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

  /**
   * Đánh dấu hiện vật thuộc một biến thể đã bị XOÁ HẲN khỏi sản phẩm.
   * Khác với thanh lý lẻ: hiện vật chỉ RETIRED vẫn được coi là biến thể "còn đăng bán
   * nhưng hết hàng" và vẫn hiện một dòng trong bảng tồn kho để đối tác nhập lại.
   * Không thể suy ra điều này từ product.colors/sizes vì cùng một màu có thể còn dùng ở size khác.
   */
  @Prop({ type: Date, default: null })
  variantRemovedAt?: Date | null;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
