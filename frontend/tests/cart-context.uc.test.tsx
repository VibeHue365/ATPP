// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '../src/context/CartContext';

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: auth.user }),
}));

const product = {
  itemType: 'PRODUCT' as const,
  productId: 'product-1',
  productName: 'Áo dài đỏ',
  rentalType: 'DAILY' as const,
  rentalFrom: '2026-11-10',
  rentalTo: '2026-11-12',
  size: 'M',
  color: 'RED',
};

const photography = {
  itemType: 'PHOTOGRAPHY_PACKAGE' as const,
  photographyPackageId: 'package-1',
  shootDate: '2026-11-11',
  shootTimeSlot: '08:00-10:00',
};

function renderCart(strict = false) {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    strict
      ? <React.StrictMode><CartProvider>{children}</CartProvider></React.StrictMode>
      : <CartProvider>{children}</CartProvider>;
  return renderHook(() => useCart(), { wrapper });
}

beforeEach(() => {
  localStorage.clear();
  auth.user = null;
});

describe('UC-34 Add To Cart (NgocL)', () => {
  it('UT-34 UTCID02 merges a photography package with the same date and time slot', () => {
    const { result } = renderCart();

    act(() => result.current.addToCart(photography));
    act(() => result.current.addToCart(photography));

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
  });

  it('UT-34 UTCID03 keeps a different size as a separate cart line', () => {
    const { result } = renderCart();

    act(() => result.current.addToCart(product));
    act(() => result.current.addToCart({ ...product, size: 'L' }));

    expect(result.current.cart.map((item) => item.size)).toEqual(['M', 'L']);
  });

  it('UT-34 UTCID04 adds the requested quantity and defaults an invalid quantity to 1', () => {
    const { result } = renderCart();

    act(() => result.current.addToCart({ ...product, quantity: 3 }));
    act(() => result.current.addToCart({ ...product, productId: 'product-2', quantity: 0 }));

    expect(result.current.cart.map((item) => item.quantity)).toEqual([3, 1]);
  });

  it('UT-34 UTCID05 persists the guest cart in local storage', () => {
    const { result } = renderCart();

    act(() => result.current.addToCart(product));

    const saved = JSON.parse(localStorage.getItem('vh_cart_guest') ?? '[]');
    expect(saved).toEqual([expect.objectContaining({ productId: 'product-1', quantity: 1 })]);
  });

  it('UT-34 UTCID06 merges the guest cart into the signed-in user cart', () => {
    localStorage.setItem('vh_cart_user-1', JSON.stringify([{ ...product, id: 'u1', quantity: 1 }]));
    localStorage.setItem('vh_cart_guest', JSON.stringify([
      { ...product, id: 'g1', quantity: 2 },
      { ...photography, id: 'g2', quantity: 1 },
    ]));
    auth.user = { id: 'user-1' };

    const { result } = renderCart();

    expect(result.current.cart.map((item) => [item.itemType, item.quantity])).toEqual([
      ['PRODUCT', 3],
      ['PHOTOGRAPHY_PACKAGE', 1],
    ]);
    expect(localStorage.getItem('vh_cart_guest')).toBeNull();
  });

  it('UT-34 UTCID07 normalizes items saved by older screens', () => {
    localStorage.setItem('vh_cart_guest', JSON.stringify([
      { id: 'old', itemType: 'PRODUCT', productId: 'product-9', quantity: 1, selectedSize: 'S', selectedColor: 'WHITE', start_date: '2026-11-01', end_date: '2026-11-02' },
    ]));

    const { result } = renderCart();

    expect(result.current.cart[0]).toMatchObject({ size: 'S', color: 'WHITE', rentalFrom: '2026-11-01', rentalTo: '2026-11-02' });
  });

  it('UT-34 UTCID08 starts with an empty cart when stored data is corrupted', () => {
    localStorage.setItem('vh_cart_guest', '{not-json');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderCart();

    expect(result.current.cart).toEqual([]);
  });

  it('UT-34 UTCID09 requires the cart provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useCart())).toThrow('useCart must be used within a CartProvider');
  });

  // Known defect UT-DEF-34-01: addToCart mutates the previous cart item inside the state updater.
  it.fails('UT-34 UTCID10 adds exactly one unit per click in React StrictMode', () => {
    const { result } = renderCart(true);

    act(() => result.current.addToCart(product));
    act(() => result.current.addToCart(product));

    expect(result.current.cart[0].quantity).toBe(2);
  });
});

describe('UC-35 Delete Item (NgocL)', () => {
  it('UT-35 UTCID02 ignores an unknown item id', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));

    act(() => result.current.removeFromCart('missing-id'));

    expect(result.current.cart).toHaveLength(1);
  });

  it('UT-35 UTCID03 removes only the selected line', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.addToCart(photography));

    act(() => result.current.removeFromCart(result.current.cart[0].id));

    expect(result.current.cart.map((item) => item.itemType)).toEqual(['PHOTOGRAPHY_PACKAGE']);
  });

  it('UT-35 UTCID04 stores an empty cart after clearing', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));

    act(() => result.current.clearCart());

    expect(JSON.parse(localStorage.getItem('vh_cart_guest') ?? 'null')).toEqual([]);
  });

  it('UT-35 UTCID05 creates a fresh line with quantity 1 after a removed item is added again', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart({ ...product, quantity: 4 }));
    act(() => result.current.removeFromCart(result.current.cart[0].id));

    act(() => result.current.addToCart(product));

    expect(result.current.cart).toEqual([expect.objectContaining({ quantity: 1 })]);
  });
});

describe('UC-36 Edit Cart Item (NgocL)', () => {
  it('UT-36 UTCID03 changes the rental start date of an Ao Dai and the shoot date of a package', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.addToCart(photography));
    const [ao, pkg] = result.current.cart;

    act(() => result.current.updateCartItemDate(ao.id, '2026-11-15'));
    act(() => result.current.updateCartItemDate(pkg.id, '2026-11-16'));

    expect(result.current.cart[0].rentalFrom).toBe('2026-11-15');
    expect(result.current.cart[1].shootDate).toBe('2026-11-16');
  });

  it('UT-36 UTCID04 splits an hourly rental time slot into start and end times', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart({ ...product, rentalType: 'HOURLY' }));

    act(() => result.current.updateCartItemTimeSlot(result.current.cart[0].id, '09:00 - 11:00'));

    expect(result.current.cart[0]).toMatchObject({ startTime: '09:00', endTime: '11:00' });
  });

  it('UT-36 UTCID05 stores a photography time slot unchanged', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(photography));

    act(() => result.current.updateCartItemTimeSlot(result.current.cart[0].id, '14:00-16:00'));

    expect(result.current.cart[0].shootTimeSlot).toBe('14:00-16:00');
  });

  it('UT-36 UTCID06 ignores a negative quantity', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart({ ...product, quantity: 2 }));

    act(() => result.current.updateCartItemQuantity(result.current.cart[0].id, -1));

    expect(result.current.cart[0].quantity).toBe(2);
  });

  it('UT-36 UTCID07 edits only the targeted cart line', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.addToCart({ ...product, productId: 'product-2' }));

    act(() => result.current.updateCartItemColor(result.current.cart[1].id, 'PINK'));

    expect(result.current.cart.map((item) => item.color)).toEqual(['RED', 'PINK']);
  });

  it('UT-36 UTCID08 leaves the end time empty for a slot without an end', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart({ ...product, rentalType: 'HOURLY' }));

    act(() => result.current.updateCartItemTimeSlot(result.current.cart[0].id, '09:00'));

    expect(result.current.cart[0]).toMatchObject({ startTime: '09:00', endTime: null });
  });
});
