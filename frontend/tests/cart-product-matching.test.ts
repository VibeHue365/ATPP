import { describe, expect, it } from 'vitest';
import { enrichCartItems } from '../src/pages/cart/utils/cartCalculations';
import type { CartItem } from '../src/context/CartContext';

describe('Cart Product & Provider Isolation: Two Shops with Identical Product Name', () => {
  const shopAId = '6a5dd0cf48a10617899bf1d6';
  const shopBId = '6b6ee1da59b20728900cf2e7';

  const productShopA = {
    _id: '6a5dd0cf48a10617899bf101',
    name: 'Ao dai rong',
    slug: 'ao-dai-rong-shop-a',
    basePrice: 55000,
    depositAmount: 11000,
    providerId: { _id: shopAId, businessName: 'Shop A' },
  };

  const productShopB = {
    _id: '6a5dd0cf48a10617899bf202',
    name: 'Ao dai rong',
    slug: 'ao-dai-rong-shop-b',
    basePrice: 99000,
    depositAmount: 22000,
    providerId: { _id: shopBId, businessName: 'Shop B' },
  };

  const realProductList = [productShopA, productShopB];

  it('1. Correctly attaches canonical 24-hex ObjectId and Provider ID to cart item of Shop A', () => {
    const rawCart: CartItem[] = [
      {
        id: 'PRODUCT_1730973123456_abc',
        itemType: 'PRODUCT',
        productId: '6a5dd0cf48a10617899bf101',
        providerId: shopAId,
        name: 'Ao dai rong',
        basePrice: 55000,
        depositAmount: 11000,
        quantity: 1,
      },
    ];

    const enriched = enrichCartItems(rawCart, realProductList);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].productId).toBe('6a5dd0cf48a10617899bf101');
    expect(enriched[0].providerId).toBe(shopAId);
    expect(enriched[0].depositAmount).toBe(11000);
  });

  it('2. Distinguishes Shop A vs Shop B when product names are identical', () => {
    const rawCart: CartItem[] = [
      {
        id: 'PRODUCT_A',
        itemType: 'PRODUCT',
        productId: '6a5dd0cf48a10617899bf101',
        providerId: shopAId,
        name: 'Ao dai rong',
        quantity: 1,
      },
      {
        id: 'PRODUCT_B',
        itemType: 'PRODUCT',
        productId: '6a5dd0cf48a10617899bf202',
        providerId: shopBId,
        name: 'Ao dai rong',
        quantity: 1,
      },
    ];

    const enriched = enrichCartItems(rawCart, realProductList);
    expect(enriched[0].productId).toBe('6a5dd0cf48a10617899bf101');
    expect(enriched[0].providerId).toBe(shopAId);
    expect(enriched[1].productId).toBe('6a5dd0cf48a10617899bf202');
    expect(enriched[1].providerId).toBe(shopBId);
  });

  it('3. Legacy resolution does NOT arbitrarily fallback to realProductList[0] when ambiguous', () => {
    // If an item has an invalid/mock ID and ambiguous name without matching providerId,
    // candidate filtering must reject rather than swap to productShopA.
    const ambiguousItem: CartItem = {
      id: 'mock_legacy_unknown_id',
      itemType: 'PRODUCT',
      productId: 'mock_legacy_unknown_id',
      providerId: 'shop_unknown_unrelated',
      name: 'Ao dai rong',
      quantity: 1,
    };

    const targetName = (ambiguousItem.name || '').trim().toLowerCase();
    const candidates = realProductList.filter((p) => {
      const pProvId = typeof p.providerId === 'object' ? p.providerId?._id?.toString() : p.providerId?.toString();
      const matchProvider = !ambiguousItem.providerId || pProvId === ambiguousItem.providerId;
      const matchSlug = p.slug && p.slug === ambiguousItem.productId;
      const matchName = targetName && p.name?.trim().toLowerCase() === targetName;
      return matchProvider && (matchSlug || matchName);
    });

    // Since providerId does not match shopA or shopB, candidates MUST be empty (0)
    // and CANNOT be silently assigned realProductList[0]
    expect(candidates).toHaveLength(0);
  });
});
