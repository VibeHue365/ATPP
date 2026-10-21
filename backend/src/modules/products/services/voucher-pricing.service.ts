import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DiscountType, Promotion, PromotionStatus } from '../schemas/promotion.schema';

export const PAYOS_MIN_PAYABLE_AMOUNT = 2000;

export interface PricingItemInput {
  id?: string;
  productId?: string;
  photographyPackageId?: string;
  providerId: string | Types.ObjectId;
  itemType: 'PRODUCT' | 'PHOTOGRAPHY_PACKAGE';
  unitPrice: number;
  quantity: number;
  serviceAmount?: number; // (unitPrice * quantity)
  depositAmount?: number; // rental deposit (not discounted)
  comboDiscountAmount?: number; // combo discount already applied
}

export interface PricingUserContext {
  customerId?: string | Types.ObjectId;
  membershipTier?: string; // 'STANDARD' | 'SILVER' | 'GOLD' | 'DIAMOND'
  isNewCustomer?: boolean;
}

export interface VoucherPricingInput {
  bookingType?: 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO';
  items: PricingItemInput[];
  promotion?: Promotion | null;
  userContext?: PricingUserContext;
  travelFee?: number;
  serviceFee?: number;
  isInitialDepositOnly?: boolean; // photography / combo 2-stage deposit
}

export interface VoucherItemAllocation {
  id?: string;
  productId?: string;
  photographyPackageId?: string;
  providerId: string;
  itemType: 'PRODUCT' | 'PHOTOGRAPHY_PACKAGE';
  serviceAmount: number;
  depositAmount: number;
  comboDiscountAmount: number;
  shopVoucherDiscountAmount: number;
  platformVoucherDiscountAmount: number;
  lineNet: number;
}

export interface VoucherSnapshotData {
  promotionId: Types.ObjectId;
  code: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  scope: 'SHOP' | 'PLATFORM';
  providerId?: Types.ObjectId | null;
}

export interface VoucherPricingResult {
  isValid: boolean;
  errorReason?: string;
  errorMessage?: string;
  subTotal: number;
  depositTotal: number;
  comboDiscountTotal: number;
  voucherDiscountTotal: number;
  shopVoucherDiscountTotal: number;
  platformVoucherDiscountTotal: number;
  travelFee: number;
  serviceFee: number;
  platformSubsidyAmount: number;
  grandTotal: number;
  amountDueNow: number;
  amountRemaining: number;
  itemAllocations: VoucherItemAllocation[];
  voucherSnapshot?: VoucherSnapshotData | null;
}

@Injectable()
export class VoucherPricingService {
  /**
   * Pure calculation function: Computes pricing, discounts, item allocations,
   * deposit safety caps, and PayOS minimum threshold subsidies without DB writes.
   */
  calculatePricing(input: VoucherPricingInput): VoucherPricingResult {
    const {
      bookingType = 'AODAI_RENTAL',
      items = [],
      promotion,
      userContext,
      travelFee = 0,
      serviceFee = 0,
      isInitialDepositOnly = false,
    } = input;

    // 1. Calculate raw item totals
    let rawSubTotal = 0;
    let rawDepositTotal = 0;
    let rawComboDiscountTotal = 0;

    const normalizedItems = items.map((item, index) => {
      const qty = item.quantity > 0 ? item.quantity : 1;
      const sAmt = item.serviceAmount !== undefined
        ? item.serviceAmount
        : Math.round((item.unitPrice || 0) * qty);
      const dAmt = item.depositAmount !== undefined
        ? Math.round(item.depositAmount * qty)
        : 0;
      const cDiscount = item.comboDiscountAmount || 0;

      rawSubTotal += sAmt;
      rawDepositTotal += dAmt;
      rawComboDiscountTotal += cDiscount;

      return {
        id: item.id || `item_${index}`,
        productId: item.productId,
        photographyPackageId: item.photographyPackageId,
        providerId: item.providerId ? item.providerId.toString() : '',
        itemType: item.itemType,
        serviceAmount: sAmt,
        depositAmount: dAmt,
        comboDiscountAmount: cDiscount,
        lineNet: Math.max(0, sAmt - cDiscount),
      };
    });

    const baseResult: VoucherPricingResult = {
      isValid: true,
      subTotal: rawSubTotal,
      depositTotal: rawDepositTotal,
      comboDiscountTotal: rawComboDiscountTotal,
      voucherDiscountTotal: 0,
      shopVoucherDiscountTotal: 0,
      platformVoucherDiscountTotal: 0,
      travelFee,
      serviceFee,
      platformSubsidyAmount: 0,
      grandTotal: rawSubTotal + rawDepositTotal + travelFee + serviceFee - rawComboDiscountTotal,
      amountDueNow: 0,
      amountRemaining: 0,
      itemAllocations: normalizedItems.map((i) => ({
        ...i,
        shopVoucherDiscountAmount: 0,
        platformVoucherDiscountAmount: 0,
      })),
      voucherSnapshot: null,
    };

    // If no voucher provided, calculate final due amounts and return directly
    if (!promotion) {
      this.computeDueAmounts(baseResult, bookingType, isInitialDepositOnly);
      return baseResult;
    }

    // 2. Validate Promotion State
    const now = new Date();
    if (promotion.status && promotion.status !== PromotionStatus.Active) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'PROMOTION_INACTIVE',
        errorMessage: 'Mã khuyến mãi hiện không còn hoạt động.',
      };
    }

    if (promotion.startDate && now < new Date(promotion.startDate)) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'PROMOTION_NOT_STARTED',
        errorMessage: 'Mã khuyến mãi chưa đến thời gian áp dụng.',
      };
    }

    if (promotion.endDate && now > new Date(promotion.endDate)) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'PROMOTION_EXPIRED',
        errorMessage: 'Mã khuyến mãi đã hết hạn sử dụng.',
      };
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usageLimit !== undefined &&
      promotion.usedCount >= promotion.usageLimit
    ) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'USAGE_LIMIT_EXCEEDED',
        errorMessage: 'Mã khuyến mãi đã hết lượt sử dụng.',
      };
    }

    // Dynamic schema checks: audience, requiredTiers, applicableBookingTypes
    const promoAny = promotion as any;
    if (promoAny.audience === 'NEW_CUSTOMER' && !userContext?.isNewCustomer) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'NEW_CUSTOMER_ONLY',
        errorMessage: 'Mã khuyến mãi chỉ dành cho khách hàng mới đặt đơn lần đầu.',
      };
    }

    if (
      Array.isArray(promoAny.requiredTiers) &&
      promoAny.requiredTiers.length > 0
    ) {
      const userTier = (userContext?.membershipTier || 'STANDARD').toUpperCase();
      const tiers = promoAny.requiredTiers.map((t: string) => t.toUpperCase());
      if (!tiers.includes(userTier)) {
        return {
          ...baseResult,
          isValid: false,
          errorReason: 'TIER_NOT_ELIGIBLE',
          errorMessage: `Mã chỉ áp dụng cho hạng thành viên: ${promoAny.requiredTiers.join(', ')}.`,
        };
      }
    }

    if (
      Array.isArray(promoAny.applicableBookingTypes) &&
      promoAny.applicableBookingTypes.length > 0
    ) {
      if (!promoAny.applicableBookingTypes.includes(bookingType)) {
        return {
          ...baseResult,
          isValid: false,
          errorReason: 'BOOKING_TYPE_NOT_ELIGIBLE',
          errorMessage: 'Mã không áp dụng cho hình thức đặt lịch này.',
        };
      }
    }

    // 3. Determine Eligible Items (Shop vs Platform scope)
    const isShopVoucher = Boolean(promotion.providerId);
    const shopProviderIdStr = promotion.providerId?.toString();

    const eligibleItems = normalizedItems.filter((item) => {
      if (!isShopVoucher) return true; // Platform voucher applies to all items
      return item.providerId === shopProviderIdStr;
    });

    if (eligibleItems.length === 0) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'NO_ELIGIBLE_ITEMS',
        errorMessage: isShopVoucher
          ? 'Mã giảm giá này chỉ áp dụng cho sản phẩm của cửa hàng phát hành.'
          : 'Không có sản phẩm nào hợp lệ để áp dụng mã giảm giá.',
      };
    }

    // Eligible subtotal = sum of net service amounts (excluding deposits)
    const eligibleSubTotal = eligibleItems.reduce((sum, item) => sum + item.lineNet, 0);

    if (promotion.minOrderValue && eligibleSubTotal < promotion.minOrderValue) {
      return {
        ...baseResult,
        isValid: false,
        errorReason: 'MIN_ORDER_VALUE_NOT_MET',
        errorMessage: `Đơn hàng cần đạt tối thiểu ${promotion.minOrderValue.toLocaleString('vi-VN')}đ dịch vụ áp dụng mã này.`,
      };
    }

    // 4. Calculate Discount Amount
    let rawDiscount = 0;
    if (promotion.discountType === DiscountType.Percentage) {
      rawDiscount = Math.round((eligibleSubTotal * promotion.discountValue) / 100);
      if (promotion.maxDiscountAmount && promotion.maxDiscountAmount > 0) {
        rawDiscount = Math.min(rawDiscount, promotion.maxDiscountAmount);
      }
    } else {
      // FIXED_AMOUNT
      rawDiscount = Math.min(promotion.discountValue, eligibleSubTotal);
    }

    // Voucher cannot discount more than the eligible service net
    const finalVoucherDiscount = Math.min(rawDiscount, eligibleSubTotal);

    // 5. Apportion Discount across Eligible Items (LineNet Proportional)
    let distributedDiscount = 0;
    const allocationsMap = new Map<string, { shopVoucher: number; platformVoucher: number }>();

    eligibleItems.forEach((item, index) => {
      let itemDiscount = 0;
      if (index === eligibleItems.length - 1) {
        // Last item absorbs rounding remainder
        itemDiscount = finalVoucherDiscount - distributedDiscount;
      } else if (eligibleSubTotal > 0) {
        itemDiscount = Math.floor((item.lineNet / eligibleSubTotal) * finalVoucherDiscount);
      }
      distributedDiscount += itemDiscount;

      allocationsMap.set(item.id, {
        shopVoucher: isShopVoucher ? itemDiscount : 0,
        platformVoucher: !isShopVoucher ? itemDiscount : 0,
      });
    });

    const finalItemAllocations: VoucherItemAllocation[] = normalizedItems.map((item) => {
      const discount = allocationsMap.get(item.id) || { shopVoucher: 0, platformVoucher: 0 };
      return {
        ...item,
        shopVoucherDiscountAmount: discount.shopVoucher,
        platformVoucherDiscountAmount: discount.platformVoucher,
      };
    });

    const shopVoucherTotal = isShopVoucher ? finalVoucherDiscount : 0;
    const platformVoucherTotal = !isShopVoucher ? finalVoucherDiscount : 0;

    const resultWithDiscount: VoucherPricingResult = {
      isValid: true,
      subTotal: rawSubTotal,
      depositTotal: rawDepositTotal,
      comboDiscountTotal: rawComboDiscountTotal,
      voucherDiscountTotal: finalVoucherDiscount,
      shopVoucherDiscountTotal: shopVoucherTotal,
      platformVoucherDiscountTotal: platformVoucherTotal,
      travelFee,
      serviceFee,
      platformSubsidyAmount: 0,
      grandTotal: Math.max(
        0,
        rawSubTotal + rawDepositTotal + travelFee + serviceFee - rawComboDiscountTotal - finalVoucherDiscount,
      ),
      amountDueNow: 0,
      amountRemaining: 0,
      itemAllocations: finalItemAllocations,
      voucherSnapshot: {
        promotionId: (promotion as any)._id || new Types.ObjectId(),
        code: promotion.code,
        name: promotion.name,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        discountAmount: finalVoucherDiscount,
        scope: isShopVoucher ? 'SHOP' : 'PLATFORM',
        providerId: promotion.providerId || null,
      },
    };

    // 6. Compute Due Amounts & Handle PayOS Min Threshold Subsidy
    this.computeDueAmounts(resultWithDiscount, bookingType, isInitialDepositOnly);

    return resultWithDiscount;
  }

  /**
   * Computes amountDueNow and amountRemaining based on bookingType and 2-stage rules,
   * then applies the PayOS minimum threshold subsidy if amountDueNow is in (0, 2000đ].
   */
  private computeDueAmounts(
    result: VoucherPricingResult,
    bookingType: 'AODAI_RENTAL' | 'PHOTOGRAPHY' | 'COMBO',
    isInitialDepositOnly: boolean,
  ): void {
    if (bookingType === 'PHOTOGRAPHY') {
      // Photography shoot deposit is 20% on the net shoot service price after voucher
      const photoServiceNet = Math.max(0, result.subTotal - result.voucherDiscountTotal);
      const shootDeposit = Math.round(photoServiceNet * 0.2);
      const requiredDue = shootDeposit + result.depositTotal + result.travelFee + result.serviceFee;

      if (isInitialDepositOnly) {
        result.amountDueNow = Math.min(requiredDue, result.grandTotal);
        result.amountRemaining = Math.max(0, result.grandTotal - result.amountDueNow);
      } else {
        result.amountDueNow = result.grandTotal;
        result.amountRemaining = 0;
      }
    } else if (bookingType === 'COMBO') {
      if (isInitialDepositOnly) {
        // Combo deposit = 100% rental items net + 100% rental deposit + 20% photo items net + fees
        let photoNet = 0;
        let rentalNet = 0;
        let rentalDeposit = 0;

        for (const item of result.itemAllocations) {
          const itemNet = Math.max(
            0,
            item.serviceAmount - item.comboDiscountAmount - item.shopVoucherDiscountAmount - item.platformVoucherDiscountAmount,
          );
          if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
            photoNet += itemNet;
          } else {
            rentalNet += itemNet;
            rentalDeposit += item.depositAmount;
          }
        }

        const requiredDue = rentalNet + rentalDeposit + Math.round(photoNet * 0.2) + result.travelFee + result.serviceFee;
        result.amountDueNow = Math.min(requiredDue, result.grandTotal);
        result.amountRemaining = Math.max(0, result.grandTotal - result.amountDueNow);
      } else {
        result.amountDueNow = result.grandTotal;
        result.amountRemaining = 0;
      }
    } else {
      // Ao Dai rental: 100% upfront
      result.amountDueNow = result.grandTotal;
      result.amountRemaining = 0;
    }

    // 7. PayOS Minimum Threshold Check: (0, 2000đ]
    if (result.amountDueNow > 0 && result.amountDueNow <= PAYOS_MIN_PAYABLE_AMOUNT) {
      result.platformSubsidyAmount = result.amountDueNow;
      result.amountDueNow = 0;
    } else {
      result.platformSubsidyAmount = 0;
    }
  }
}
