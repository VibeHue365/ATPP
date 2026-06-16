import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

export enum CartItemType {
  Product = 'PRODUCT',
  PhotographyPackage = 'PHOTOGRAPHY_PACKAGE',
}

export interface CartItem {
  itemType: CartItemType;
  productId?: Types.ObjectId | null;
  inventoryItemId?: Types.ObjectId | null;
  photographyPackageId?: Types.ObjectId | null;
  quantity: number;
  rentalFrom?: Date | null;
  rentalTo?: Date | null;
  shootDate?: Date | null;
  shootTimeSlot?: string | null;
  customRequests?: string | null;
  addedAt: Date;
}

@Schema({ collection: 'carts', timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  customerId: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        itemType: {
          type: String,
          enum: Object.values(CartItemType),
          required: true,
        },
        productId: { type: Types.ObjectId, ref: 'Product', default: null },
        inventoryItemId: { type: Types.ObjectId, ref: 'InventoryItem', default: null },
        photographyPackageId: { type: Types.ObjectId, ref: 'PhotographyPackage', default: null },
        quantity: { type: Number, default: 1, min: 1 },
        rentalFrom: { type: Date, default: null },
        rentalTo: { type: Date, default: null },
        shootDate: { type: Date, default: null },
        shootTimeSlot: { type: String, default: null },
        customRequests: { type: String, default: null },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  items: CartItem[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);
