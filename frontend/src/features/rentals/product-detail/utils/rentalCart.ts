import type { CartItem } from "../../../../context/CartContext";
import type { ProductDetail } from "../types/product-detail.types";

export interface RentalCartSelection {
  rentalMode: "DAILY" | "HOURLY";
  startDate: string;
  endDate: string;
  singleDate: string;
  startTime: string;
  endTime: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  image?: string;
}

export const createRentalCartItem = (
  product: ProductDetail,
  selection: RentalCartSelection,
): Omit<CartItem, "id" | "quantity"> & { quantity: number } => {
  const address = product.providerId?.address;
  const rentalFrom = selection.rentalMode === "DAILY" ? selection.startDate : selection.singleDate;
  const rentalTo = selection.rentalMode === "DAILY" ? selection.endDate : selection.singleDate;
  const image = selection.image || product.images?.[0] || "";

  return {
    itemType: "PRODUCT",
    productId: product._id,
    productName: product.name,
    productImage: image,
    name: product.name,
    image,
    basePrice: selection.price,
    depositAmount: product.depositAmount,
    size: selection.size,
    color: selection.color,
    rentalType: selection.rentalMode,
    rentalFrom,
    rentalTo,
    startDate: rentalFrom,
    endDate: rentalTo,
    startTime: selection.rentalMode === "HOURLY" ? selection.startTime : null,
    endTime: selection.rentalMode === "HOURLY" ? selection.endTime : null,
    providerCity: address?.city || "",
    providerAddress: address?.addressLine || "",
    comboDiscountPercent: (product.providerId as ProductDetail["providerId"] & { comboDiscountPercent?: number }).comboDiscountPercent,
    quantity: selection.quantity,
  };
};
