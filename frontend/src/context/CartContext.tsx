import React, { createContext, useContext, useState, useEffect } from 'react';

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
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem('vh_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
    // Seed default items for premium mockup presentation
    const defaultCart: CartItem[] = [
      {
        id: 'product_gam_do',
        itemType: 'PRODUCT',
        productId: 'prod_gam_do',
        productName: 'Áo dài Gấm Đỏ Hoàng Triều',
        productImage: 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=600',
        basePrice: 800000,
        depositAmount: 1500000,
        rentalFrom: '2024-10-12',
        rentalTo: '2024-10-14',
        size: 'M',
        color: 'Đỏ',
        quantity: 1,
        providerCity: 'Thừa Thiên Huế',
        providerAddress: '12 Đại Nội, TP. Huế'
      },
      {
        id: 'photographer_hoang_minh_1',
        itemType: 'PHOTOGRAPHY_PACKAGE',
        photographyPackageId: 'pkg_hoang_minh_art',
        photographerName: 'Hoàng Minh',
        photographerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200',
        packageName: 'Gói Nghệ Thuật',
        shootDate: '2024-10-13',
        shootTimeSlot: '8:00 - 11:00',
        shootLocation: 'Văn Miếu, Hà Nội',
        basePrice: 2000000,
        quantity: 1,
        photographerCity: 'Hà Nội'
      },
      {
        id: 'product_to_tam',
        itemType: 'PRODUCT',
        productId: 'prod_to_tam',
        productName: 'Áo dài Tơ Tằm Thủy Mặc',
        productImage: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600',
        basePrice: 1200000,
        depositAmount: 1800000,
        rentalFrom: '2024-10-15',
        rentalTo: '2024-10-17',
        size: 'L',
        color: 'Xanh Thủy Mặc',
        quantity: 1,
        providerCity: 'Thừa Thiên Huế',
        providerAddress: '24 Lê Lợi, TP. Huế'
      },
      {
        id: 'photographer_hoang_minh_2',
        itemType: 'PHOTOGRAPHY_PACKAGE',
        photographyPackageId: 'pkg_hoang_minh_mismatch',
        photographerName: 'Hoàng Minh',
        photographerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200',
        packageName: 'Gói Nghệ Thuật',
        shootDate: '2024-10-18',
        shootTimeSlot: '14:00 - 17:00',
        shootLocation: 'Văn Miếu, Hà Nội',
        basePrice: 2000000,
        quantity: 1,
        photographerCity: 'Hà Nội'
      },
      {
        id: 'product_ai_cinematic',
        itemType: 'PRODUCT',
        productId: 'prod_ai_cinematic',
        productName: 'Gói chỉnh sửa AI Cinematic',
        productImage: '',
        basePrice: 350000,
        depositAmount: 0,
        rentalFrom: null,
        rentalTo: null,
        quantity: 1
      }
    ];
    localStorage.setItem('vh_cart', JSON.stringify(defaultCart));
    return defaultCart;
  });

  useEffect(() => {
    localStorage.setItem('vh_cart', JSON.stringify(cart));
  }, [cart]);

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
