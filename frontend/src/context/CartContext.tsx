import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';

export type CartItemType = 'PRODUCT' | 'PHOTOGRAPHY_PACKAGE';

export interface CartItem {
  id: string; // Unique cart item ID (can be combination of product/package ID + date to handle multiple bookings)
  itemType: CartItemType;
  productId?: string | null;
  productName?: string | null;
  productImage?: string | null;
  basePrice?: number;
  depositAmount?: number;
  rentalFrom?: string | null; // YYYY-MM-DD
  rentalTo?: string | null; // YYYY-MM-DD
  size?: string | null;
  color?: string | null;
  quantity: number;

  // Photographer specific fields
  photographyPackageId?: string | null;
  photographerName?: string | null;
  photographerAvatar?: string | null;
  packageName?: string | null;
  shootDate?: string | null; // YYYY-MM-DD
  shootTimeSlot?: string | null; // e.g. "10:30-12:30"
  shootLocation?: string | null;
  shootConcept?: string | null;
  referenceImage?: string | null;
  customRequests?: string | null;

  // UI helper fields
  name?: string | null;
  image?: string | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  endTime?: string | null; // HH:MM
  rentalType?: 'DAILY' | 'HOURLY' | null;
  providerCity?: string | null;
  providerAddress?: string | null;
  photographerCity?: string | null;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemDate: (itemId: string, date: string) => void;
  updateCartItemTimeSlot: (itemId: string, timeSlot: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const cartKey = user ? `vh_cart_${user.id}` : 'vh_cart_guest';

  // Load and merge cart when user/cartKey changes
  useEffect(() => {
    setIsLoaded(false);
    const savedCart = localStorage.getItem(cartKey);
    let parsedCart: CartItem[] = [];

    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          parsedCart = parsed;
        }
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    } else if (cartKey === 'vh_cart_guest') {
      // Giỏ hàng guest bắt đầu rỗng — không seed mock data
      parsedCart = [];
    }

    // Merge guest cart to user cart upon login
    if (user && cartKey !== 'vh_cart_guest') {
      const guestCartJson = localStorage.getItem('vh_cart_guest');
      if (guestCartJson) {
        try {
          const guestCart = JSON.parse(guestCartJson);
          if (Array.isArray(guestCart) && guestCart.length > 0) {
            const mergedCart = [...parsedCart];
            guestCart.forEach((guestItem) => {
              const duplicateIndex = mergedCart.findIndex((item) => {
                if (item.itemType !== guestItem.itemType) return false;
                if (item.itemType === 'PRODUCT') {
                  return (
                    item.productId === guestItem.productId &&
                    item.rentalFrom === guestItem.rentalFrom &&
                    item.rentalTo === guestItem.rentalTo &&
                    item.size === guestItem.size &&
                    item.color === guestItem.color
                  );
                } else {
                  return (
                    item.photographyPackageId === guestItem.photographyPackageId &&
                    item.shootDate === guestItem.shootDate &&
                    item.shootTimeSlot === guestItem.shootTimeSlot
                  );
                }
              });

              if (duplicateIndex > -1) {
                mergedCart[duplicateIndex].quantity += guestItem.quantity;
              } else {
                mergedCart.push(guestItem);
              }
            });
            parsedCart = mergedCart;
            // Clear guest cart after successful merge
            localStorage.removeItem('vh_cart_guest');
          }
        } catch (e) {
          console.error('Failed to merge guest cart', e);
        }
      }
    }

    setCart(parsedCart);
    setIsLoaded(true);
  }, [user, cartKey]);

  // Save changes to localStorage under cartKey (gated by isLoaded)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    }
  }, [cart, cartKey, isLoaded]);

  const addToCart = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    setCart((prevCart) => {
      // Check if exact same item already exists (same product/package and same dates)
      const existingItemIndex = prevCart.findIndex((item) => {
        if (item.itemType !== newItem.itemType) return false;
        if (item.itemType === 'PRODUCT') {
          return (
            item.productId === newItem.productId &&
            item.rentalFrom === newItem.rentalFrom &&
            item.rentalTo === newItem.rentalTo &&
            item.size === newItem.size &&
            item.color === newItem.color
          );
        } else {
          return (
            item.photographyPackageId === newItem.photographyPackageId &&
            item.shootDate === newItem.shootDate &&
            item.shootTimeSlot === newItem.shootTimeSlot
          );
        }
      });

      if (existingItemIndex > -1) {
        // Increase quantity
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        return updatedCart;
      }

      // Add as new item
      const id = `${newItem.itemType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return [...prevCart, { ...newItem, id, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const updateCartItemDate = (itemId: string, newDate: string) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== itemId) return item;
        if (item.itemType === 'PRODUCT') {
          return { ...item, rentalFrom: newDate };
        } else {
          return { ...item, shootDate: newDate };
        }
      })
    );
  };

  const updateCartItemTimeSlot = (itemId: string, newTimeSlot: string) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== itemId) return item;
        if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
          return { ...item, shootTimeSlot: newTimeSlot };
        } else {
          // split time slot like "HH:MM - HH:MM" and update startTime / endTime
          const parts = newTimeSlot.split('-');
          const startTime = parts[0]?.trim() || null;
          const endTime = parts[1]?.trim() || null;
          return { ...item, startTime, endTime };
        }
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartItemDate, updateCartItemTimeSlot, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
