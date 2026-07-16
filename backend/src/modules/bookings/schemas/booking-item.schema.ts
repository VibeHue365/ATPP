import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingItemDocument = HydratedDocument<BookingItem>;

export enum BookingItemType {
  Product = 'PRODUCT',
  PhotographyPackage = 'PHOTOGRAPHY_PACKAGE',
}

@Schema({ collection: 'booking_items', timestamps: true })
export class BookingItem {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(BookingItemType),
    required: true,
  })
  itemType: BookingItemType;

  @Prop({ type: Types.ObjectId, ref: 'Product', default: null, index: true })
  productId?: Types.ObjectId | null;

  /**
   * @deprecated Nguồn chân lý cho tồn kho thực tế của đơn hàng sẽ là truy vấn bảng InventoryReservation:
   * `InventoryReservation.find({ bookingItemId })`.
   * Trường này chỉ được giữ lại để tương thích ngược.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'InventoryItem',
    default: null,
    index: true,
  })
  inventoryItemId?: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'PhotographyPackage',
    default: null,
    index: true,
  })
  photographyPackageId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'PriceVersion', required: true })
  priceVersionId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  unitPrice: number; // Snapshot of unit price at the time of booking

  @Prop({ type: Number, default: 0, min: 0 })
  depositAmount: number; // Snapshot of deposit amount at the time of booking

  @Prop({ type: Number, default: 1, min: 1 })
  quantity: number;

  @Prop({ type: Date, default: null, index: true })
  rentalFrom?: Date | null;

  @Prop({ type: Date, default: null, index: true })
  rentalTo?: Date | null;

  @Prop({ type: Date, default: null, index: true })
  shootDate?: Date | null;

  @Prop({ type: String, default: null })
  shootTimeSlot?: string | null;

  @Prop({ type: String, default: null })
  shootLocation?: string | null;

  @Prop({ type: String, default: null })
  shootConcept?: string | null;

  @Prop({ type: String, default: null })
  referenceImage?: string | null;

  @Prop({
    type: String,
    enum: ['DAILY', 'HOURLY'],
    required: true,
    default: 'DAILY',
    index: true,
  })
  rentalType: 'DAILY' | 'HOURLY';

  @Prop({ type: String, default: null, trim: true, uppercase: true })
  selectedSize?: string | null;

  @Prop({ type: String, default: null, trim: true, uppercase: true })
  selectedColor?: string | null;

  @Prop({ type: String, default: null, trim: true })
  customRequests?: string | null;

  @Prop({ type: Boolean, default: false })
  isReviewed?: boolean;

  @Prop({ type: Number, default: 0 })
  comboDiscountPercent: number;

  @Prop({ type: Number, default: 0 })
  comboDiscountAmount: number;
}

export const BookingItemSchema = SchemaFactory.createForClass(BookingItem);
