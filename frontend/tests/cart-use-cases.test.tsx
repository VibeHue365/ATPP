// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '../src/context/CartContext';

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

function Probe() {
  const cart = useCart();
  const first = cart.cart[0];
  return <div>
    <span data-testid="count">{cart.cart.length}</span>
    <span data-testid="quantity">{first?.quantity ?? 0}</span>
    <span data-testid="details">{first ? `${first.size}|${first.color}|${first.rentalFrom}|${first.rentalTo}` : ''}</span>
    <button onClick={() => cart.addToCart({ itemType: 'PRODUCT', productId: 'product-1', productName: 'Áo dài đỏ', rentalType: 'DAILY', rentalFrom: '2026-10-20', rentalTo: '2026-10-22', size: 'M', color: 'RED' })}>add</button>
    <button onClick={() => first && cart.removeFromCart(first.id)}>remove</button>
    <button onClick={() => first && cart.updateCartItemQuantity(first.id, 3)}>quantity</button>
    <button onClick={() => first && cart.updateCartItemSize(first.id, 'L')}>size</button>
    <button onClick={() => first && cart.updateCartItemColor(first.id, 'PINK')}>color</button>
    <button onClick={() => first && cart.updateCartItemDates(first.id, '2026-10-25', '2026-10-27')}>dates</button>
    <button onClick={cart.clearCart}>clear</button>
  </div>;
}

describe('Cart direct use-case behavior', () => {
  beforeEach(() => localStorage.clear());

  it('UC-34 adds a configured Ao Dai item and merges an exact duplicate quantity', async () => {
    render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('quantity').textContent).toBe('2');
  });

  it('UC-35 removes one item and clears the cart', async () => {
    render(<CartProvider><Probe /></CartProvider>);
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('count').textContent).toBe('0');
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('UC-36 updates quantity, size, color and rental dates in place', async () => {
    render(<CartProvider><Probe /></CartProvider>);
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('quantity'));
    fireEvent.click(screen.getByText('size'));
    fireEvent.click(screen.getByText('color'));
    fireEvent.click(screen.getByText('dates'));
    expect(screen.getByTestId('quantity').textContent).toBe('3');
    expect(screen.getByTestId('details').textContent).toBe('L|PINK|2026-10-25|2026-10-27');
  });

  it('UC-36 preserves the existing quantity when an invalid value is requested', async () => {
    function InvalidQuantityProbe() {
      const cart = useCart();
      const first = cart.cart[0];
      return <div>
        <span data-testid="invalid-quantity">{first?.quantity ?? 0}</span>
        <button onClick={() => cart.addToCart({ itemType: 'PRODUCT', productId: 'product-2', rentalFrom: '2026-10-20', rentalTo: '2026-10-20', size: 'S', color: 'WHITE' })}>seed</button>
        <button onClick={() => first && cart.updateCartItemQuantity(first.id, 0)}>invalid</button>
      </div>;
    }
    render(<CartProvider><InvalidQuantityProbe /></CartProvider>);
    await act(async () => fireEvent.click(screen.getByText('seed')));
    await act(async () => fireEvent.click(screen.getByText('invalid')));
    expect(screen.getByTestId('invalid-quantity').textContent).toBe('1');
  });
});
