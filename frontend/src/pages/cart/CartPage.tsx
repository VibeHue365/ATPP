import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../../config/routes';
import { checkProductAvailability } from '../../features/rentals/services/productAvailabilityService';
import { useCart } from '../../context/CartContext';
import type { CartItem } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { productSlots, isTimeSlotOverlap } from '../rentals/product-detail/utils/timeSlotUtils';
import type { EnrichedCartItem, ComboGroupEntry, CartCalendarDay, CartItemGroup } from './types';
import {
  isMongoObjectId,
  getProductValidationIssues,
  enrichCartItems,
  calculateCartTotals,
} from './utils/cartCalculations';
import { CartEmptyState } from './components/CartEmptyState';
import { CartComboCard } from './components/CartComboCard';
import { CartItemCard } from './components/CartItemCard';
import { CartEditItemInline } from './components/CartEditItemInline';
import { CartOrderSummary } from './components/CartOrderSummary';
import { CartMobileStickyBar } from './components/CartMobileStickyBar';
import './CartPage.css';

export const CartPage: React.FC = () => {
  const {
    cart,
    removeFromCart,
    updateCartItemDate,
    updateCartItemTimeSlot,
    updateCartItemQuantity,
    updateCartItemSize,
    updateCartItemColor,
    updateCartItemDates,
  } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemStocks, setItemStocks] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [realProductList, setRealProductList] = useState<any[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Calendar and busy date/slot states for editing item
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [busySlots, setBusySlots] = useState<{ date: string; timeSlot: string }[]>([]);

  const editingItem = cart.find((i) => i.id === editingItemId);
  const editingItemType = editingItem?.rentalType || 'DAILY';

  // Batch fetch stocks
  useEffect(() => {
    let active = true;
    const fetchStocks = async () => {
      const productItems = cart.filter((item) => item.itemType === 'PRODUCT' && item.productId);
      if (!productItems.length) return;

      try {
        const response = await httpClient.post<Array<{ key: string; stock: number }>>(
          '/bookings/stock/batch',
          {
            items: productItems.map((item) => ({
              key: item.id,
              productId: item.productId,
              size: item.size || '',
              color: item.color || '',
            })),
          },
        );
        if (!active) return;
        const stockByItemId = new Map(response.map((item) => [item.key, item.stock]));
        const stockMap = Object.fromEntries(
          productItems.map((item) => [item.id, stockByItemId.get(item.id) ?? 0]),
        );
        setItemStocks((prev) => ({ ...prev, ...stockMap }));
      } catch (error) {
        console.error('Error fetching stock batch:', error);
        if (active) {
          setItemStocks((prev) => ({
            ...prev,
            ...Object.fromEntries(productItems.map((item) => [item.id, 999])),
          }));
        }
      }
    };

    if (cart.length > 0) {
      fetchStocks();
    }
    return () => {
      active = false;
    };
  }, [cart]);

  // Adjust item quantity if exceeds stock
  useEffect(() => {
    cart.forEach((item) => {
      if (item.itemType === 'PRODUCT' && item.productId) {
        const maxStock = itemStocks[item.id];
        if (maxStock !== undefined && maxStock > 0 && item.quantity > maxStock) {
          updateCartItemQuantity(item.id, maxStock);
        }
      }
    });
  }, [itemStocks, cart, updateCartItemQuantity]);

  // Fetch busy dates/slots when editing an item
  useEffect(() => {
    if (!editingItemId) {
      setBusyDates([]);
      setBusySlots([]);
      return;
    }
    const item = cart.find((i) => i.id === editingItemId);
    if (!item || item.itemType !== 'PRODUCT') return;

    const pId = item.productId || item.id;
    if (!pId) return;

    httpClient
      .get<any>(`/api/bookings/busy-dates/product/${pId}`)
      .then((res) => {
        setBusyDates(res.bookedDates || []);
        setBusySlots(res.bookedSlots || []);
      })
      .catch((err) => {
        console.error('Error fetching busy dates/slots:', err);
      });
  }, [editingItemId, cart]);

  // Fetch product list for enrichment
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const prods = await httpClient.get<any[]>('/products');
        setRealProductList(prods);
      } catch (e) {
        console.error('Failed to fetch real products for mapping', e);
      }
    };
    fetchRealData();
  }, []);

  // Sync selected items with cart changes
  useEffect(() => {
    if (cart.length > 0 && selectedItemIds.length === 0) {
      setSelectedItemIds(cart.map((item) => item.id));
    }
  }, [cart]);

  // Enrich cart items
  const enrichedCart = useMemo(
    () => enrichCartItems(cart, realProductList),
    [cart, realProductList],
  );

  // Calendar days calculation for inline editing
  const calendarDays = useMemo<CartCalendarDay[]>(() => {
    if (!editingItem) return [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: CartCalendarDay[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: 0, dateStr: '', isWeekend: false, isAvailable: false, isEmpty: true });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = new Date(dateStr).getDay();

      let isAvailable = !busyDates.includes(dateStr) && dateStr >= todayStr;
      if (editingItemType === 'HOURLY' && dateStr === todayStr) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const hasTimeSlotsLeft = productSlots.some((block) => {
          const [h, m] = block.start.split(':').map(Number);
          return h > currentHour || (h === currentHour && m > currentMinute);
        });
        isAvailable = isAvailable && hasTimeSlotsLeft;
      }

      days.push({
        day: i,
        dateStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isAvailable,
        isEmpty: false,
      });
    }
    return days;
  }, [calendarDate, busyDates, editingItemType, editingItem]);

  const handleCalendarDayClick = (dateStr: string) => {
    if (!editingItem) return;
    if (editingItemType === 'HOURLY') {
      updateCartItemDates(editingItem.id, dateStr, dateStr);
    } else {
      if (busyDates.includes(dateStr)) {
        toast.error('Ngày này đã bị đặt lịch!');
        return;
      }
      const currentFrom = editingItem.rentalFrom || editingItem.startDate || '';
      const currentTo = editingItem.rentalTo || editingItem.endDate || '';

      if (!currentFrom || (currentFrom && currentTo)) {
        updateCartItemDates(editingItem.id, dateStr, '');
      } else {
        if (dateStr < currentFrom) {
          updateCartItemDates(editingItem.id, dateStr, '');
        } else {
          const hasUnavailable = calendarDays.some(
            (d) =>
              !d.isEmpty && !d.isAvailable && d.dateStr >= currentFrom && d.dateStr <= dateStr,
          );
          if (hasUnavailable) {
            toast.error('Khoảng thời gian chọn chứa ngày đã bị đặt!');
            return;
          }
          updateCartItemDates(editingItem.id, currentFrom, dateStr);
        }
      }
    }
  };

  const bookedSlotsOnSelectedDate = useMemo(() => {
    const singleDate = editingItem?.rentalFrom || editingItem?.startDate || '';
    if (!singleDate) return [];
    return busySlots.filter((s) => s.date === singleDate).map((s) => s.timeSlot);
  }, [editingItem, busySlots]);

  const startSlotIndex = useMemo(() => {
    const startTime = editingItem?.startTime || '07:00';
    return productSlots.findIndex((s) => s.start === startTime);
  }, [editingItem]);

  const endSlotIndex = useMemo(() => {
    const endTime = editingItem?.endTime || '09:00';
    return productSlots.findIndex((s) => s.end === endTime);
  }, [editingItem]);

  const handleSlotClick = (i: number) => {
    if (!editingItem) return;
    const block = productSlots[i];
    const singleDate = editingItem.rentalFrom || editingItem.startDate || '';

    const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
    );
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isPast =
      singleDate === todayStr &&
      (() => {
        const [sh, sm] = block.start.split(':').map(Number);
        return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
      })();

    if (isBusy || isPast) return;

    const currentStartTime = editingItem.startTime || '07:00';
    const currentStartIdx = productSlots.findIndex((s) => s.start === currentStartTime);

    if (currentStartIdx === -1 || currentStartIdx !== endSlotIndex || i < currentStartIdx) {
      updateCartItemTimeSlot(editingItem.id, `${block.start}-${block.end}`);
    } else {
      let hasBusyOrPastInRange = false;
      for (let idx = currentStartIdx; idx <= i; idx++) {
        const checkBlock = productSlots[idx];
        const checkBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
          isTimeSlotOverlap(`${checkBlock.start}-${checkBlock.end}`, bookedSlot),
        );
        const checkPast =
          singleDate === todayStr &&
          (() => {
            const [sh, sm] = checkBlock.start.split(':').map(Number);
            return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
          })();
        if (checkBusy || checkPast) {
          hasBusyOrPastInRange = true;
          break;
        }
      }

      if (hasBusyOrPastInRange) {
        toast.error('Khoảng thời gian chọn chứa khung giờ đã bận hoặc đã qua!');
        updateCartItemTimeSlot(editingItem.id, `${block.start}-${block.end}`);
      } else {
        const targetStartTime = productSlots[currentStartIdx].start;
        const targetEndTime = productSlots[i].end;
        updateCartItemTimeSlot(editingItem.id, `${targetStartTime}-${targetEndTime}`);
      }
    }
  };

  // Auto-select first available slot when date changes
  useEffect(() => {
    if (!editingItem || editingItemType !== 'HOURLY') return;
    const singleDate = editingItem.rentalFrom || editingItem.startDate || '';
    if (!singleDate) return;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const currentStartTime = editingItem.startTime || '07:00';
    const currentEndTime = editingItem.endTime || '09:00';
    const isCurrentBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
      isTimeSlotOverlap(`${currentStartTime}-${currentEndTime}`, bookedSlot),
    );
    const isCurrentPast =
      singleDate === todayStr &&
      (() => {
        const [sh, sm] = currentStartTime.split(':').map(Number);
        return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
      })();

    if (isCurrentBusy || isCurrentPast) {
      const firstAvailableIndex = productSlots.findIndex((block) => {
        const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
          isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
        );
        const isPast =
          singleDate === todayStr &&
          (() => {
            const [sh, sm] = block.start.split(':').map(Number);
            return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
          })();
        return !isBusy && !isPast;
      });

      if (firstAvailableIndex !== -1) {
        updateCartItemTimeSlot(
          editingItem.id,
          `${productSlots[firstAvailableIndex].start}-${productSlots[firstAvailableIndex].end}`,
        );
      }
    }
  }, [
    editingItemId,
    editingItem?.rentalFrom,
    editingItem?.startDate,
    bookedSlotsOnSelectedDate,
    editingItemType,
  ]);

  // Group enrichedCart items into Combos vs Normal Items
  const { comboGroupEntries, normalCartItems } = useMemo(() => {
    const comboGroupsMap = new Map<string, EnrichedCartItem[]>();
    const normalItems: EnrichedCartItem[] = [];

    enrichedCart.forEach((item) => {
      if (item.comboPromotionId) {
        const list = comboGroupsMap.get(item.comboPromotionId) || [];
        list.push(item);
        comboGroupsMap.set(item.comboPromotionId, list);
      } else {
        normalItems.push(item);
      }
    });

    const entries: ComboGroupEntry[] = Array.from(comboGroupsMap.entries()).map(
      ([comboId, items]) => {
        const origTotal = items.reduce(
          (sum, i) => sum + (i.basePrice || 0) * (i.quantity || 1),
          0,
        );
        const discountPct = items[0]?.comboDiscountPercent || 50;
        const comboPrice = Math.round(origTotal * (1 - discountPct / 100));
        const depositAmt = items
          .filter((i) => i.itemType === 'PRODUCT')
          .reduce((sum, i) => sum + (i.depositAmount || 0) * (i.quantity || 1), 0);

        return {
          comboId,
          items,
          origTotal,
          discountPct,
          comboPrice,
          depositAmt,
        };
      },
    );

    return { comboGroupEntries: entries, normalCartItems: normalItems };
  }, [enrichedCart]);

  const groups: CartItemGroup[] = useMemo(() => {
    return normalCartItems.length > 0
      ? [
          {
            id: 'normal-items',
            title: 'SẢN PHẨM & DỊCH VỤ THUÊ LẺ',
            type: 'OTHERS',
            items: normalCartItems,
          },
        ]
      : [];
  }, [normalCartItems]);

  // Selection handlers
  const isAllSelected =
    enrichedCart.length > 0 && selectedItemIds.length === enrichedCart.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(enrichedCart.map((item) => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleCombo = (entry: ComboGroupEntry, isSelected: boolean) => {
    if (isSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !entry.items.some((i) => i.id === id)));
    } else {
      setSelectedItemIds((prev) =>
        Array.from(new Set([...prev, ...entry.items.map((i) => i.id)])),
      );
    }
  };

  const handleRemoveCombo = (entry: ComboGroupEntry) => {
    entry.items.forEach((i) => removeFromCart(i.id));
  };

  const handleSyncGroup = (groupItems: CartItem[]) => {
    const product = groupItems.find((item) => item.itemType === 'PRODUCT');
    const photo = groupItems.find((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE');
    if (product && photo) {
      const targetDate = product.rentalFrom || product.startDate;
      if (targetDate) {
        updateCartItemDate(photo.id, targetDate);
      }
      if (product.startTime && product.endTime) {
        updateCartItemTimeSlot(photo.id, `${product.startTime} - ${product.endTime}`);
      }
    }
  };

  const handleSizeChange = async (sz: string) => {
    if (!editingItem) return;
    updateCartItemSize(editingItem.id, sz);
    try {
      const res = await httpClient.get<{ stock: number }>(
        `/bookings/stock/product/${editingItem.productId}?size=${encodeURIComponent(sz)}&color=${encodeURIComponent(editingItem.color || '')}`,
      );
      const newStock = res.stock || 0;
      setItemStocks((prev) => ({ ...prev, [editingItem.id]: newStock }));
      if (editingItem.quantity > newStock && newStock > 0) {
        updateCartItemQuantity(editingItem.id, newStock);
      }
    } catch (e) {
      console.error('Lỗi tải tồn kho:', e);
    }
  };

  const handleColorChange = async (cl: string) => {
    if (!editingItem) return;
    updateCartItemColor(editingItem.id, cl);
    try {
      const res = await httpClient.get<{ stock: number }>(
        `/bookings/stock/product/${editingItem.productId}?size=${encodeURIComponent(editingItem.size || '')}&color=${encodeURIComponent(cl)}`,
      );
      const newStock = res.stock || 0;
      setItemStocks((prev) => ({ ...prev, [editingItem.id]: newStock }));
      if (editingItem.quantity > newStock && newStock > 0) {
        updateCartItemQuantity(editingItem.id, newStock);
      }
    } catch (e) {
      console.error('Lỗi tải tồn kho:', e);
    }
  };

  // Calculations for checkout
  const selectedItems = useMemo(
    () => enrichedCart.filter((item) => selectedItemIds.includes(item.id)),
    [enrichedCart, selectedItemIds],
  );

  const totals = useMemo(
    () => calculateCartTotals(enrichedCart, selectedItemIds),
    [enrichedCart, selectedItemIds],
  );

  const resumePendingCheckout = async (): Promise<boolean> => {
    const selectedIds = selectedItems.map((item) => item.id).sort().join('|');
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('vh_pending_checkout_')) continue;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || '{}') as {
          cartItemIds?: string[];
        };
        if ((pending.cartItemIds || []).slice().sort().join('|') !== selectedIds) continue;
        const paymentCode = key.replace('vh_pending_checkout_', '');
        const status = await httpClient.get<{
          paymentStatus: string;
          bookingStatus: string;
          checkoutUrl?: string | null;
        }>(`/payments/${encodeURIComponent(paymentCode)}/status`);
        if (
          status.paymentStatus === 'PENDING' &&
          status.bookingStatus === 'PENDING_PAYMENT' &&
          status.checkoutUrl
        ) {
          toast.info('Bạn đang có một đơn giữ chỗ chờ thanh toán. Đang mở lại cổng thanh toán…');
          window.location.href = status.checkoutUrl;
          return true;
        }
        if (
          ['FAILED', 'CANCELLED'].includes(status.paymentStatus) ||
          status.bookingStatus === 'CANCELLED'
        ) {
          localStorage.removeItem(key);
        }
      } catch {
        // A stale local record must not block checkout of a new order.
      }
    }

    try {
      const pending = await httpClient.get<
        Array<{ paymentCode: string; checkoutUrl?: string | null }>
      >('/payments/pending-checkouts');
      if (pending.length === 1 && pending[0].checkoutUrl) {
        toast.info('Bạn đang có một đơn chờ thanh toán. Đang mở lại cổng thanh toán…');
        window.location.href = pending[0].checkoutUrl;
        return true;
      }
    } catch {
      // Do not prevent a new checkout if pending-payment lookup is unavailable.
    }
    return false;
  };

  const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    if (!isAuthenticated) {
      toast.info('Vui lòng đăng nhập để tiến hành thanh toán.');
      navigate(ROUTES.LOGIN, { state: { from: location } });
      return;
    }
    if (await resumePendingCheckout()) return;

    const invalidProduct = selectedItems.find(
      (item) => item.itemType === 'PRODUCT' && getProductValidationIssues(item).length > 0,
    );
    if (invalidProduct) {
      const issues = getProductValidationIssues(invalidProduct).join(', ');
      toast.error(
        'Áo dài "' +
          (invalidProduct.name || invalidProduct.productName || 'trong giỏ hàng') +
          '" đang thiếu: ' +
          issues +
          '. Vui lòng chỉnh lại sản phẩm này trước khi thanh toán.',
      );
      return;
    }
    try {
      await Promise.all(
        selectedItems
          .filter((item) => item.itemType === 'PRODUCT')
          .map(async (item) => {
            const from = item.rentalFrom || item.startDate || '';
            const to = item.rentalTo || item.endDate || from;
            const result = await checkProductAvailability(
              item.productId || '',
              item.size || '',
              item.color || '',
              from,
              to,
              item.quantity,
              item.rentalType || 'DAILY',
              item.startTime || undefined,
              item.endTime || undefined,
            );
            if (!result.available)
              throw new Error(
                `${item.name || item.productName || 'Sản phẩm'} không còn đủ số lượng cho lịch đã chọn.`,
              );
          }),
      );
    } catch (error: any) {
      toast.error(error.message || 'Không thể kiểm tra lịch thuê.');
      return;
    }
    setIsLoading(true);
    try {
      const productItems = selectedItems.filter((item) => item.itemType === 'PRODUCT');
      const photoItems = selectedItems.filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE');
      if (photoItems.length > 1) {
        throw new Error('Vui lòng thanh toán từng gói chụp hoặc từng combo riêng biệt.');
      }

      const rentalItemsPayload = productItems.map((item) => {
        let pId = item.productId || item.id;
        if (pId && !/^[0-9a-fA-F]{24}$/.test(pId)) {
          let matchedProd = null;
          if (pId === 'product_gam_do' || pId === 'prod_gam_do') {
            matchedProd = realProductList.find(
              (p) => p.name?.toLowerCase().includes('đỏ') || p.name?.toLowerCase().includes('red'),
            );
          } else if (pId === 'product_to_tam' || pId === 'prod_to_tam') {
            matchedProd = realProductList.find(
              (p) =>
                p.name?.toLowerCase().includes('trắng') || p.name?.toLowerCase().includes('white'),
            );
          }
          if (!matchedProd && realProductList.length > 0) {
            matchedProd = realProductList[0];
          }
          if (matchedProd) {
            pId = matchedProd._id;
          }
        }

        const rentalFrom =
          item.rentalFrom ||
          item.startDate ||
          new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
        const rentalTo =
          item.rentalTo ||
          item.endDate ||
          new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0];

        return {
          productId: pId,
          quantity: item.quantity || 1,
          rentalFrom,
          rentalTo,
          selectedSize: item.size || null,
          selectedColor: item.color || null,
          rentalType: item.rentalType || 'DAILY',
          shootDate: item.startDate || item.rentalFrom || null,
          shootTimeSlot:
            item.shootTimeSlot ||
            (item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : null),
        };
      });

      let bookingId: string;
      let paymentPurpose: 'FULL_PAYMENT' | 'DEPOSIT_PAYMENT' = 'FULL_PAYMENT';
      if (photoItems.length === 1) {
        const photo = photoItems[0];
        if (
          !isMongoObjectId(photo.photographyPackageId) ||
          !photo.shootDate ||
          !photo.shootTimeSlot ||
          !photo.shootLocation ||
          !Number.isFinite(photo.shootLocationLatitude) ||
          !Number.isFinite(photo.shootLocationLongitude)
        ) {
          throw new Error(
            'Gói chụp thiếu địa chỉ hoặc tọa độ bản đồ. Vui lòng xóa gói và chọn lại địa điểm chụp.',
          );
        }
        const [startTime, endTime] = photo.shootTimeSlot.split('-').map((value) => value.trim());
        if (!startTime || !endTime) {
          throw new Error('Khung giờ chụp không hợp lệ. Vui lòng chọn lại lịch.');
        }
        const holdPayload = {
          packageId: photo.photographyPackageId,
          sessions: [
            {
              clientId: photo.id,
              startsAt: `${photo.shootDate}T${startTime}:00+07:00`,
              endsAt: `${photo.shootDate}T${endTime}:00+07:00`,
              locationAddress: photo.shootLocation,
              locationLatitude: photo.shootLocationLatitude,
              locationLongitude: photo.shootLocationLongitude,
            },
          ],
          concept: photo.shootConcept || undefined,
          customRequests: photo.customRequests || undefined,
          referenceImage: photo.referenceImage || undefined,
          ...(productItems.length > 0
            ? {
                aodaiItems: rentalItemsPayload.map((item) => ({
                  productId: item.productId,
                  selectedSize: item.selectedSize,
                  selectedColor: item.selectedColor,
                  rentalFrom: item.rentalFrom,
                  rentalTo: item.rentalTo,
                  quantity: item.quantity,
                })),
              }
            : {}),
        };
        const holdEndpoint =
          productItems.length > 0
            ? '/api/bookings/combo/photography-hold'
            : '/api/bookings/photography/hold';
        const idempotencyKey = `cart-hold-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const holdRes: any = await httpClient.post(holdEndpoint, holdPayload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
        bookingId = holdRes.bookingId;
        paymentPurpose = 'DEPOSIT_PAYMENT';
      } else {
        const bookingRes: any = await httpClient.post('/bookings', {
          bookingType: 'AODAI_RENTAL',
          items: rentalItemsPayload,
          travelFee: 0,
          serviceFee: 0,
        });
        bookingId = bookingRes._id;
      }

      toast.info('Đơn đã được giữ tạm thời. Đang chuyển đến thanh toán…');

      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId,
        purpose: paymentPurpose,
      });

      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        localStorage.setItem(
          `vh_pending_checkout_${paymentRes.paymentCode}`,
          JSON.stringify({ bookingId, cartItemIds: selectedItems.map((item) => item.id) }),
        );
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 500);
      } else {
        throw new Error('Không thể khởi tạo liên kết thanh toán');
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thanh toán thất bại');
      setIsLoading(false);
    }
  };

  return (
    <div className="vh-cart-container">
      <div className="vh-cart-wrapper">
        {/* Cart Header */}
        <div className="vh-cart-header">
          <h1 className="font-header vh-cart-title">Giỏ hàng của bạn</h1>

          {cart.length > 0 && (
            <div className="vh-cart-select-all" onClick={toggleSelectAll}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelectAll();
                }}
                style={{ accentColor: '#8B1E22', cursor: 'pointer', margin: 0 }}
              />
              <span>CHỌN TẤT CẢ</span>
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <CartEmptyState />
        ) : (
          <div className="vh-cart-layout">
            {/* Left Column: Cart groups and items */}
            <div className="vh-cart-items-column">
              {/* Combo Bundles */}
              {comboGroupEntries.map((entry) => (
                <CartComboCard
                  key={entry.comboId}
                  entry={entry}
                  selectedItemIds={selectedItemIds}
                  onToggleCombo={handleToggleCombo}
                  onRemoveCombo={handleRemoveCombo}
                />
              ))}

              {/* Normal Items Groups */}
              {groups.map((group) => (
                <div
                  key={group.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  {/* Group Title */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color:
                          group.type === 'SUCCESS'
                            ? '#27AE60'
                            : group.type === 'MISMATCH'
                              ? '#D35400'
                              : '#5D4037',
                        textTransform: 'uppercase',
                      }}
                    >
                      {group.title}
                    </span>
                  </div>

                  {/* Warning banner for mismatched groups */}
                  {group.type === 'MISMATCH' && group.warning && (
                    <div
                      className="vh-cart-group-warning-banner"
                      style={{
                        backgroundColor: group.isCityMismatch ? '#FDE8E8' : '#FFF7F0',
                        border: group.isCityMismatch ? '1px solid #F8B4B4' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            color: group.isCityMismatch ? '#C0392B' : '#7D5A2B',
                            fontWeight: 600,
                          }}
                        >
                          {group.warning}
                        </span>
                      </div>
                      {!group.isCityMismatch && (
                        <button
                          onClick={() => handleSyncGroup(group.items)}
                          style={{
                            borderRadius: '4px',
                            padding: '8px 16px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: 'white',
                            backgroundColor: '#7D5A2B',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          ĐỒNG BỘ NGÀY & GIỜ
                        </button>
                      )}
                    </div>
                  )}

                  {/* Group Items Container */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {group.items.map((item: EnrichedCartItem) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      const isEditing = editingItemId === item.id;

                      return (
                        <CartItemCard
                          key={item.id}
                          item={item}
                          isSelected={isSelected}
                          onToggleSelect={() => toggleSelectItem(item.id)}
                          onRemove={() => removeFromCart(item.id)}
                          isEditing={isEditing}
                          onToggleEdit={() =>
                            setEditingItemId(isEditing ? null : item.id)
                          }
                          itemStocks={itemStocks}
                          groupType={group.type}
                          groupSyncDate={group.syncDate}
                          onQuantityChange={(qty) => {
                            if (qty < 1) return;
                            const maxStock = itemStocks[item.id] ?? 999;
                            if (qty > maxStock) {
                              toast.error(
                                `Chỉ còn ${maxStock} sản phẩm khả dụng cho kích cỡ và màu sắc này.`,
                              );
                              return;
                            }
                            updateCartItemQuantity(item.id, qty);
                          }}
                          editComponent={
                            <CartEditItemInline
                              item={item}
                              realProductList={realProductList}
                              calendarDate={calendarDate}
                              setCalendarDate={setCalendarDate}
                              calendarDays={calendarDays}
                              editingItemType={editingItemType}
                              bookedSlotsOnSelectedDate={bookedSlotsOnSelectedDate}
                              startSlotIndex={startSlotIndex}
                              endSlotIndex={endSlotIndex}
                              onSizeChange={handleSizeChange}
                              onColorChange={handleColorChange}
                              onCalendarDayClick={handleCalendarDayClick}
                              onSlotClick={handleSlotClick}
                              onClose={() => setEditingItemId(null)}
                            />
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Sticky Summary Panel */}
            <CartOrderSummary
              selectedItemsCount={selectedItems.length}
              totals={totals}
              checkedGroups={[]}
              hasRentalProduct={selectedItems.some((item) => item.itemType === 'PRODUCT')}
              hasCityMismatch={false}
              isLoading={isLoading}
              onCheckout={handleCheckout}
            />
          </div>
        )}
      </div>

      {/* Mobile Sticky Checkout Bar */}
      {cart.length > 0 && (
        <CartMobileStickyBar
          selectedCount={selectedItems.length}
          depositToPayNow={totals.depositToPayNow}
          grandTotal={totals.grandTotal}
          isLoading={isLoading}
          onCheckout={handleCheckout}
        />
      )}
    </div>
  );
};

export default CartPage;
