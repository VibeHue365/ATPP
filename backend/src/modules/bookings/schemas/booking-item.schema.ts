import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { RentalFulfillment } from './rental-fulfillment.types';

export type BookingItemDocument = HydratedDocument<BookingItem>;

export interface PhotographyPackageSnapshot {
  name: string;
  basePrice: number;
  pricingUnit: 'PER_SESSION' | 'PER_DAY' | 'PER_BOOKING';
  includedDurationMinutes: number;
  includedSessionCount?: number | null;
  includedDayCount?: number | null;
  overtimeFeePerHour: number;
  overtimeIncrementMinutes: number;
  maxOvertimeMinutes: number;
}

export interface BookingPriceBreakdownItem {
  type: 'BASE_PACKAGE' | 'OVERTIME' | 'TRAVEL' | 'SURCHARGE' | 'MULTI_DAY_DISCOUNT';
  label: string;
  amount: number;
  scheduleId?: Types.ObjectId | null;
}
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

  /** Immutable shoot location captured when the photography hold is created. */
  @Prop({ type: Object, default: null })
  shootLocationSnapshot?: {
    address: string | null;
    geo: {
      type: 'Point';
      coordinates: [number, number];
    } | null;
  } | null;

  /** Ao Dai MVP: one provider-selected point is used for both pickup and return. */
  @Prop({ type: Object, default: null })
  pickupReturnLocationSnapshot?: {
    address: string;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
    geo: {
      type: 'Point';
      coordinates: [number, number];
    } | null;
  } | null;
  /** Immutable, per physical rental unit fulfillment state. */
  @Prop({ type: Object, default: null })
  rentalFulfillment?: RentalFulfillment | null;

  /** Audit marker set only by the v1 Ao Dai fulfillment migration. */
  @Prop({
    type: {
      version: { type: Number, required: true },
      status: { type: String, enum: ['MIGRATED', 'NEEDS_ADMIN_REVIEW', 'LEGACY_READ_ONLY'], required: true, index: true },
      reasons: { type: [String], default: [] },
      migratedAt: { type: Date, default: null },
    },
    default: null,
  })
  rentalMigration?: {
    version: number;
    status: 'MIGRATED' | 'NEEDS_ADMIN_REVIEW' | 'LEGACY_READ_ONLY';
    reasons: string[];
    migratedAt?: Date | null;
  } | null;

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

  /** A customer proposal; the booking dates remain unchanged until its provider approves it. */
  @Prop({
    type: {
      status: { type: String, enum: ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'], required: true },
      requestedBy: { type: Types.ObjectId, ref: 'User', required: true },
      requestedAt: { type: Date, required: true },
      resolvedBy: { type: Types.ObjectId, ref: 'Provider', default: null },
      resolvedAt: { type: Date, default: null },
      newRentalFrom: { type: Date, default: null },
      newRentalTo: { type: Date, default: null },
      newShootDate: { type: String, default: null },
      newShootTimeSlot: { type: String, default: null },
      customerReason: { type: String, default: null, maxlength: 500 },
      providerNote: { type: String, default: null, maxlength: 500 },
    },
    default: null,
  })
  rescheduleRequest?: {
    status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
    requestedBy: Types.ObjectId;
    requestedAt: Date;
    resolvedBy?: Types.ObjectId | null;
    resolvedAt?: Date | null;
    newRentalFrom?: Date | null;
    newRentalTo?: Date | null;
    newShootDate?: string | null;
    newShootTimeSlot?: string | null;
    customerReason?: string | null;
    providerNote?: string | null;
  } | null;

  @Prop({ type: Boolean, default: false })
  isReviewed?: boolean;

  @Prop({ type: Object, default: null })
  packageSnapshot?: PhotographyPackageSnapshot | null;

  @Prop({ type: [Object], default: [] })
  priceBreakdown: BookingPriceBreakdownItem[];

  @Prop({ type: Number, default: 1, min: 1 })
  scheduleSchemaVersion: number;

  @Prop({ type: Number, default: 0 })
  comboDiscountPercent: number;

  @Prop({ type: Number, default: 0 })
  comboDiscountAmount: number;
}

export const BookingItemSchema = SchemaFactory.createForClass(BookingItem);
