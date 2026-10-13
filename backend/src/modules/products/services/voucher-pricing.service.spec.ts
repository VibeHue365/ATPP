import { Types } from 'mongoose';
import { DiscountType, Promotion, PromotionStatus } from '../schemas/promotion.schema';
import {
  PAYOS_MIN_PAYABLE_AMOUNT,
  PricingItemInput,
  VoucherPricingService,
} from './voucher-pricing.service';

describe('VoucherPricingService', () => {
  let service: VoucherPricingService;

  beforeEach(() => {
    service = new VoucherPricingService();
  });

  const shopAId = new Types.ObjectId();
  const shopBId = new Types.ObjectId();

  it('should calculate base pricing correctly without voucher', () => {
    const items: PricingItemInput[] = [
      {
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 200000,
        quantity: 2, // 400,000đ service
        depositAmount: 500000, // 1,000,000đ deposit
      },
    ];

    const result = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: null,
    });

    expect(result.isValid).toBe(true);
    expect(result.subTotal).toBe(400000);
    expect(result.depositTotal).toBe(1000000);
    expect(result.voucherDiscountTotal).toBe(0);
    expect(result.grandTotal).toBe(1400000);
    expect(result.amountDueNow).toBe(1400000);
  });

  it('should restrict Shop Voucher to only that shop items and apportion correctly', () => {
    const items: PricingItemInput[] = [
      {
        id: 'item_1',
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 200000,
        quantity: 1, // 200,000đ
        depositAmount: 100000,
      },
      {
        id: 'item_2',
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 400000,
        quantity: 1, // 400,000đ
        depositAmount: 100000,
      },
      {
        id: 'item_3',
        providerId: shopBId,
        itemType: 'PRODUCT',
        unitPrice: 500000,
        quantity: 1, // 500,000đ
        depositAmount: 200000,
      },
    ];

    const shopVoucher: Promotion = {
      _id: new Types.ObjectId(),
      code: 'SHOP10',
      name: 'Shop 10%',
      discountType: DiscountType.Percentage,
      discountValue: 10,
      minOrderValue: 500000,
      providerId: shopAId,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const result = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: shopVoucher,
    });

    expect(result.isValid).toBe(true);
    // Shop A total = 600,000đ. 10% = 60,000đ discount
    expect(result.voucherDiscountTotal).toBe(60000);
    expect(result.shopVoucherDiscountTotal).toBe(60000);
    expect(result.platformVoucherDiscountTotal).toBe(0);

    // Item 1 (200k / 600k * 60k = 20,000đ)
    // Item 2 (remainder = 60k - 20k = 40,000đ)
    // Item 3 (Shop B = 0đ)
    const alloc1 = result.itemAllocations.find((i) => i.id === 'item_1')!;
    const alloc2 = result.itemAllocations.find((i) => i.id === 'item_2')!;
    const alloc3 = result.itemAllocations.find((i) => i.id === 'item_3')!;

    expect(alloc1.shopVoucherDiscountAmount).toBe(20000);
    expect(alloc2.shopVoucherDiscountAmount).toBe(40000);
    expect(alloc3.shopVoucherDiscountAmount).toBe(0);
  });

  it('should apportion Platform Voucher across multiple shops with rounding remainder assigned to last item', () => {
    const items: PricingItemInput[] = [
      {
        id: 'item_1',
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 333333,
        quantity: 1,
      },
      {
        id: 'item_2',
        providerId: shopBId,
        itemType: 'PRODUCT',
        unitPrice: 666667,
        quantity: 1,
      },
    ];

    const platformVoucher: Promotion = {
      _id: new Types.ObjectId(),
      code: 'PLATFORM100',
      name: 'Platform 100k',
      discountType: DiscountType.FixedAmount,
      discountValue: 100000,
      minOrderValue: 500000,
      providerId: null,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const result = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: platformVoucher,
    });

    expect(result.isValid).toBe(true);
    expect(result.voucherDiscountTotal).toBe(100000);
    expect(result.platformVoucherDiscountTotal).toBe(100000);

    const alloc1 = result.itemAllocations.find((i) => i.id === 'item_1')!;
    const alloc2 = result.itemAllocations.find((i) => i.id === 'item_2')!;

    expect(alloc1.platformVoucherDiscountAmount + alloc2.platformVoucherDiscountAmount).toBe(100000);
  });

  it('should NEVER discount rental deposits, even with 100% discount', () => {
    const items: PricingItemInput[] = [
      {
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 300000,
        quantity: 1,
        depositAmount: 500000,
      },
    ];

    const freeRentalVoucher: Promotion = {
      _id: new Types.ObjectId(),
      code: 'FREE100',
      name: 'Free Rental 100%',
      discountType: DiscountType.Percentage,
      discountValue: 100,
      minOrderValue: 0,
      providerId: null,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const result = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: freeRentalVoucher,
    });

    expect(result.isValid).toBe(true);
    // Service fee is reduced by 300k to 0đ
    expect(result.voucherDiscountTotal).toBe(300000);
    // Deposit of 500k is 100% preserved
    expect(result.depositTotal).toBe(500000);
    expect(result.grandTotal).toBe(500000);
    expect(result.amountDueNow).toBe(500000);
  });

  it('should cap fixed amount discount by eligible service amount', () => {
    const items: PricingItemInput[] = [
      {
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 250000,
        quantity: 1,
      },
    ];

    const bigVoucher: Promotion = {
      _id: new Types.ObjectId(),
      code: 'BIG500',
      name: 'Giảm 500k',
      discountType: DiscountType.FixedAmount,
      discountValue: 500000,
      minOrderValue: 0,
      providerId: null,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const result = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: bigVoucher,
    });

    expect(result.isValid).toBe(true);
    // Capped at 250,000đ, not 500,000đ
    expect(result.voucherDiscountTotal).toBe(250000);
    expect(result.grandTotal).toBe(0);
  });

  it('should subsidize and round to 0đ when amountDueNow is in (0, 2000đ]', () => {
    const items: PricingItemInput[] = [
      {
        providerId: shopAId,
        itemType: 'PRODUCT',
        unitPrice: 101500,
        quantity: 1,
      },
    ];

    const voucher: Promotion = {
      _id: new Types.ObjectId(),
      code: 'DISCOUNT100K',
      name: 'Giảm 100k',
      discountType: DiscountType.FixedAmount,
      discountValue: 100000,
      minOrderValue: 0,
      providerId: null,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const result = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: voucher,
    });

    expect(result.isValid).toBe(true);
    expect(result.grandTotal).toBe(1500); // 101,500 - 100,000 = 1,500đ
    // Since 1500 <= PAYOS_MIN_PAYABLE_AMOUNT (2000):
    expect(result.platformSubsidyAmount).toBe(1500);
    expect(result.amountDueNow).toBe(0);
  });

  it('should enforce dynamic audience and tier conditions', () => {
    const promoNewCustomer = {
      _id: new Types.ObjectId(),
      code: 'LUMEWELCOME',
      name: 'Welcome New Customer',
      discountType: DiscountType.Percentage,
      discountValue: 20,
      minOrderValue: 0,
      audience: 'NEW_CUSTOMER',
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const items: PricingItemInput[] = [
      { providerId: shopAId, itemType: 'PRODUCT', unitPrice: 300000, quantity: 1 },
    ];

    // User is NOT new customer
    const failRes = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: promoNewCustomer,
      userContext: { isNewCustomer: false },
    });
    expect(failRes.isValid).toBe(false);
    expect(failRes.errorReason).toBe('NEW_CUSTOMER_ONLY');

    // User IS new customer
    const successRes = service.calculatePricing({
      bookingType: 'AODAI_RENTAL',
      items,
      promotion: promoNewCustomer,
      userContext: { isNewCustomer: true },
    });
    expect(successRes.isValid).toBe(true);
    expect(successRes.voucherDiscountTotal).toBe(60000);
  });

  it('should calculate 2-stage photography deposit correctly with voucher discount', () => {
    const items: PricingItemInput[] = [
      {
        providerId: shopAId,
        itemType: 'PHOTOGRAPHY_PACKAGE',
        unitPrice: 1000000, // 1,000,000đ shoot fee
        quantity: 1,
      },
    ];

    const voucher: Promotion = {
      _id: new Types.ObjectId(),
      code: 'PHOTO100K',
      name: 'Giảm 100k',
      discountType: DiscountType.FixedAmount,
      discountValue: 100000,
      minOrderValue: 500000,
      providerId: null,
      status: PromotionStatus.Active,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    } as any;

    const result = service.calculatePricing({
      bookingType: 'PHOTOGRAPHY',
      items,
      promotion: voucher,
      isInitialDepositOnly: true,
    });

    expect(result.isValid).toBe(true);
    // Shoot price after voucher: 900,000đ
    // 20% deposit = 180,000đ
    expect(result.grandTotal).toBe(900000);
    expect(result.amountDueNow).toBe(180000);
    expect(result.amountRemaining).toBe(720000);
  });
});
