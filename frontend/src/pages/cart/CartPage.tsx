import React, { useState, useEffect } from 'react';
import { checkProductAvailability } from '../../features/rentals/services/productAvailabilityService';
import { useCart } from '../../context/CartContext';
import type { CartItem } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';
import {
  Trash2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Calendar,
  QrCode,
  Building,
  CreditCard,
  Pencil,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/feedback/Toast';


// Custom Checkbox Component styled to match the mockup
const CustomCheckbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => {
  return (
    <div
      onClick={onChange}
      style={{
        width: '20px',
        height: '20px',
        border: checked ? 'none' : '2px solid #D5C2AD',
        backgroundColor: checked ? '#8B1E22' : '#FFFFFF',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        flexShrink: 0,
        marginRight: '16px',
        alignSelf: 'center'
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};



const isMongoObjectId = (id?: string | null) => /^[a-f\d]{24}$/i.test(id || '');

const getProductValidationIssues = (item: CartItem): string[] => {
  const issues: string[] = [];
  if (!isMongoObjectId(item.productId)) issues.push('sản phẩm không còn hợp lệ');
  if (!item.size) issues.push('kích cỡ');
  if (!item.color) issues.push('màu sắc');
  if (!(item.rentalFrom || item.startDate)) issues.push('ngày bắt đầu thuê');
  if ((item.rentalType || 'DAILY') === 'DAILY' && !(item.rentalTo || item.endDate)) {
    issues.push('ngày trả');
  }
  if ((item.rentalType || 'DAILY') === 'HOURLY' && (!item.startTime || !item.endTime)) {
    issues.push('khung giờ thuê');
  }
  return issues;
};

const productSlots = [
  { start: '07:00', end: '09:00', label: '07:00 - 09:00' },
  { start: '09:00', end: '11:00', label: '09:00 - 11:00' },
  { start: '11:00', end: '13:00', label: '11:00 - 13:00' },
  { start: '13:00', end: '15:00', label: '13:00 - 15:00' },
  { start: '15:00', end: '17:00', label: '15:00 - 17:00' },
  { start: '17:00', end: '19:00', label: '17:00 - 19:00' },
  { start: '19:00', end: '21:00', label: '19:00 - 21:00' },
];

const isTimeSlotOverlap = (slot1: string, slot2: string) => {
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const [start1Str, end1Str] = slot1.split('-').map(s => s.trim());
  const [start2Str, end2Str] = slot2.split('-').map(s => s.trim());
  if (!start1Str || !end1Str || !start2Str || !end2Str) return false;
  const s1 = parseTime(start1Str);
  const e1 = parseTime(end1Str);
  const s2 = parseTime(start2Str);
  const e2 = parseTime(end2Str);
  return s1 < e2 && s2 < e1;
};

export const CartPage: React.FC = () => {
  const { cart, removeFromCart, updateCartItemDate, updateCartItemTimeSlot, updateCartItemQuantity, updateCartItemSize, updateCartItemColor, updateCartItemDates } = useCart();
  const toast = useToast();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemStocks, setItemStocks] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchStocks = async () => {
      const productItems = cart.filter(item => item.itemType === 'PRODUCT' && item.productId);
      const stockMap: Record<string, number> = {};

      await Promise.all(
        productItems.map(async (item) => {
          try {
            const res = await httpClient.get<{ stock: number }>(
              `/bookings/stock/product/${item.productId}?size=${encodeURIComponent(item.size || '')}&color=${encodeURIComponent(item.color || '')}`
            );
            stockMap[item.id] = res.stock || 0;
          } catch (e) {
            console.error('Error fetching stock for item:', item.id, e);
            stockMap[item.id] = 999;
          }
        })
      );

      setItemStocks(prev => ({ ...prev, ...stockMap }));
    };

    if (cart.length > 0) {
      fetchStocks();
    }
  }, [cart]);

  useEffect(() => {
    cart.forEach(item => {
      if (item.itemType === 'PRODUCT' && item.productId) {
        const maxStock = itemStocks[item.id];
        if (maxStock !== undefined && maxStock > 0 && item.quantity > maxStock) {
          updateCartItemQuantity(item.id, maxStock);
        }
      }
    });
  }, [itemStocks, cart]);
  const [isLoading, setIsLoading] = useState(false);
  const [realProductList, setRealProductList] = useState<any[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // New calendar and busy date/slot states
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [busySlots, setBusySlots] = useState<{ date: string, timeSlot: string }[]>([]);

  const editingItem = cart.find(i => i.id === editingItemId);
  const editingItemType = editingItem?.rentalType || 'DAILY';

  useEffect(() => {
    if (!editingItemId) {
      setBusyDates([]);
      setBusySlots([]);
      return;
    }
    const item = cart.find(i => i.id === editingItemId);
    if (!item || item.itemType !== 'PRODUCT') return;

    const pId = item.productId || item.id;
    if (!pId) return;

    httpClient.get<any>(`/api/bookings/busy-dates/product/${pId}`)
      .then(res => {
        setBusyDates(res.bookedDates || []);
        setBusySlots(res.bookedSlots || []);
      })
      .catch(err => {
        console.error('Error fetching busy dates/slots:', err);
      });
  }, [editingItemId, cart]);

  const calendarDays = React.useMemo(() => {
    if (!editingItem) return [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: any[] = [];
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
        const hasTimeSlotsLeft = productSlots.some(block => {
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
          const hasUnavailable = calendarDays.some(d =>
            !d.isEmpty && !d.isAvailable && d.dateStr >= currentFrom && d.dateStr <= dateStr
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

  const bookedSlotsOnSelectedDate = React.useMemo(() => {
    const singleDate = editingItem?.rentalFrom || editingItem?.startDate || '';
    if (!singleDate) return [];
    return busySlots.filter(s => s.date === singleDate).map(s => s.timeSlot);
  }, [editingItem, busySlots]);

  const startSlotIndex = React.useMemo(() => {
    const startTime = editingItem?.startTime || '07:00';
    return productSlots.findIndex(s => s.start === startTime);
  }, [editingItem]);

  const endSlotIndex = React.useMemo(() => {
    const endTime = editingItem?.endTime || '09:00';
    return productSlots.findIndex(s => s.end === endTime);
  }, [editingItem]);

  const handleSlotClick = (i: number) => {
    if (!editingItem) return;
    const block = productSlots[i];
    const singleDate = editingItem.rentalFrom || editingItem.startDate || '';

    const isBusy = bookedSlotsOnSelectedDate.some(bookedSlot =>
      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot)
    );
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isPast = singleDate === todayStr && (() => {
      const [sh, sm] = block.start.split(':').map(Number);
      return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
    })();

    if (isBusy || isPast) return;

    const currentStartTime = editingItem.startTime || '07:00';
    const currentEndTime = editingItem.endTime || '09:00';
    const currentStartIdx = productSlots.findIndex(s => s.start === currentStartTime);
    const currentEndIdx = productSlots.findIndex(s => s.end === currentEndTime);

    if (currentStartIdx === -1 || currentStartIdx !== currentEndIdx || i < currentStartIdx) {
      updateCartItemTimeSlot(editingItem.id, `${block.start}-${block.end}`);
    } else {
      let hasBusyOrPastInRange = false;
      for (let idx = currentStartIdx; idx <= i; idx++) {
        const checkBlock = productSlots[idx];
        const checkBusy = bookedSlotsOnSelectedDate.some(bookedSlot =>
          isTimeSlotOverlap(`${checkBlock.start}-${checkBlock.end}`, bookedSlot)
        );
        const checkPast = singleDate === todayStr && (() => {
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

  // Reset and auto-select first available slot when date changes
  useEffect(() => {
    if (!editingItem || editingItemType !== 'HOURLY') return;
    const singleDate = editingItem.rentalFrom || editingItem.startDate || '';
    if (!singleDate) return;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const currentStartTime = editingItem.startTime || '07:00';
    const currentEndTime = editingItem.endTime || '09:00';
    const isCurrentBusy = bookedSlotsOnSelectedDate.some(bookedSlot =>
      isTimeSlotOverlap(`${currentStartTime}-${currentEndTime}`, bookedSlot)
    );
    const isCurrentPast = singleDate === todayStr && (() => {
      const [sh, sm] = currentStartTime.split(':').map(Number);
      return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
    })();

    if (isCurrentBusy || isCurrentPast) {
      const firstAvailableIndex = productSlots.findIndex((block) => {
        const isBusy = bookedSlotsOnSelectedDate.some(bookedSlot =>
          isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot)
        );
        const isPast = singleDate === todayStr && (() => {
          const [sh, sm] = block.start.split(':').map(Number);
          return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
        })();
        return !isBusy && !isPast;
      });

      if (firstAvailableIndex !== -1) {
        updateCartItemTimeSlot(editingItem.id, `${productSlots[firstAvailableIndex].start}-${productSlots[firstAvailableIndex].end}`);
      }
    }
  }, [editingItemId, editingItem?.rentalFrom, editingItem?.startDate, bookedSlotsOnSelectedDate, editingItemType]);

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

  // Sync selected items list with cart changes
  useEffect(() => {
    if (cart.length > 0 && selectedItemIds.length === 0) {
      // Default to select all items on load
      setSelectedItemIds(cart.map(item => item.id));
    }
  }, [cart]);


  // Helper date formatters
  const formatDateRange = (fromStr?: string | null, toStr?: string | null) => {
    if (!fromStr) return '';
    const formatSingle = (str: string) => {
      const parts = str.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      if (str.includes('/')) {
        const p = str.split('/');
        if (p.length === 3) return `${p[1]}/${p[0]}`;
      }
      return str;
    };

    const formattedFrom = formatSingle(fromStr);
    if (!toStr) return formattedFrom;
    const formattedTo = formatSingle(toStr);
    const year = fromStr.split('-')[0] || new Date().getFullYear().toString();
    return `${formattedFrom} - ${formattedTo}/${year}`;
  };

  const formatSingleDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    if (dateStr.includes('/')) return dateStr;
    return dateStr;
  };

  const getDayMonth = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    if (dateStr.includes('/')) {
      const p = dateStr.split('/');
      if (p.length === 3) return `${p[1]}/${p[0]}`;
    }
    return dateStr;
  };

  // Enrich cart items with up-to-date product database values
  const enrichedCart = cart.map(item => {
    if (item.itemType === 'PRODUCT') {
      const dbProduct = realProductList.find(p =>
        p._id === item.productId ||
        p._id === item.id ||
        p.slug === item.productId ||
        p.slug === item.id ||
        (item.productId && p._id.toString() === item.productId.toString())
      );
      if (dbProduct) {
        let days = 1;
        const rentalFrom = item.rentalFrom || item.startDate;
        const rentalTo = item.rentalTo || item.endDate;
        if (rentalFrom && rentalTo) {
          const start = new Date(rentalFrom);
          const end = new Date(rentalTo);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
        }

        let hours = 2;
        if (item.startTime && item.endTime) {
          const [sh, sm] = item.startTime.split(':').map(Number);
          const [eh, em] = item.endTime.split(':').map(Number);
          const sDate = new Date();
          sDate.setHours(sh, sm, 0, 0);
          const eDate = new Date();
          eDate.setHours(eh, em, 0, 0);
          hours = Math.max((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60), 2);
        }

        const discountedBasePrice = dbProduct.discountedPrice || dbProduct.basePrice;
        const hourlyRate = dbProduct.hourlyPrice || Math.round(discountedBasePrice * 0.3) || 80000;
        const basePrice = item.rentalType === 'HOURLY' ? hourlyRate * hours : discountedBasePrice * days;
        const originalBasePrice = item.rentalType === 'HOURLY' ? (dbProduct.hourlyPrice || Math.round(dbProduct.basePrice * 0.3) || 80000) * hours : dbProduct.basePrice * days;

        return {
          ...item,
          depositAmount: dbProduct.depositAmount,
          basePrice,
          originalPrice: originalBasePrice,
          providerCity: dbProduct.providerId?.address?.city || item.providerCity,
          providerAddress: dbProduct.providerId?.address?.addressLine || item.providerAddress,
        };
      }
    }
    return item;
  });

  const getImageUrl = (url?: string | null) => {
    if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    return `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Group enrichedCart items into Combos vs Normal Items
  const comboGroupsMap = new Map<string, CartItem[]>();
  const normalCartItems: CartItem[] = [];

  enrichedCart.forEach((item) => {
    if (item.comboPromotionId) {
      const list = comboGroupsMap.get(item.comboPromotionId) || [];
      list.push(item);
      comboGroupsMap.set(item.comboPromotionId, list);
    } else {
      normalCartItems.push(item);
    }
  });

  const comboGroupEntries = Array.from(comboGroupsMap.entries()).map(([comboId, items]) => {
    const origTotal = items.reduce((sum, i) => sum + (i.basePrice || 0) * (i.quantity || 1), 0);
    const discountPct = items[0]?.comboDiscountPercent || 50;
    const comboPrice = Math.round(origTotal * (1 - discountPct / 100));
    const depositAmt = items.filter(i => i.itemType === 'PRODUCT').reduce((sum, i) => sum + (i.depositAmount || 0) * (i.quantity || 1), 0);

    return {
      comboId,
      items,
      origTotal,
      discountPct,
      comboPrice,
      depositAmt,
    };
  });

  const checkedGroups: any[] = [];

  // Combine groups for normal items (non-combo)
  const groups: any[] = normalCartItems.length > 0 ? [
    {
      id: 'normal-items',
      title: 'SẢN PHẨM & DỊCH VỤ THUÊ LẺ',
      type: 'OTHERS',
      items: normalCartItems
    }
  ] : [];

  // Checkbox functions
  const isAllSelected = enrichedCart.length > 0 && selectedItemIds.length === enrichedCart.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(enrichedCart.map(item => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Sync click action
  const handleSyncGroup = (groupItems: CartItem[]) => {
    const product = groupItems.find(item => item.itemType === 'PRODUCT');
    const photo = groupItems.find(item => item.itemType === 'PHOTOGRAPHY_PACKAGE');
    if (product && photo) {
      const targetDate = product.rentalFrom || product.startDate;
      if (targetDate) {
        updateCartItemDate(photo.id, targetDate);
      }

      // If product has time slot, sync the photographer time slot as well!
      if (product.startTime && product.endTime) {
        updateCartItemTimeSlot(photo.id, `${product.startTime} - ${product.endTime}`);
      }
    }
  };

  // Calculations for checkout (only selected items)
  const selectedItems = enrichedCart.filter(item => selectedItemIds.includes(item.id));

  const selectedComboIds = new Set(
    selectedItems.filter(i => i.comboPromotionId).map(i => i.comboPromotionId!)
  );

  let totalComboPrice = 0;
  let totalComboDeposit = 0;

  selectedComboIds.forEach(cId => {
    const cItems = enrichedCart.filter(i => i.comboPromotionId === cId);
    const origTotal = cItems.reduce((sum, i) => sum + (i.basePrice || 0) * (i.quantity || 1), 0);
    const pct = cItems[0]?.comboDiscountPercent || 50;
    const cPrice = Math.round(origTotal * (1 - pct / 100));
    const cDeposit = cItems.filter(i => i.itemType === 'PRODUCT').reduce((sum, i) => sum + (i.depositAmount || 0) * (i.quantity || 1), 0);

    totalComboPrice += cPrice;
    totalComboDeposit += cDeposit;
  });

  const nonComboSelected = selectedItems.filter(i => !i.comboPromotionId);
  const totalNonComboRental = nonComboSelected
    .filter(item => item.itemType === 'PRODUCT')
    .reduce((sum, item) => sum + (item.basePrice || 0) * (item.quantity || 1), 0);
  const totalNonComboDeposit = nonComboSelected
    .filter(item => item.itemType === 'PRODUCT')
    .reduce((sum, item) => sum + (item.depositAmount || 0) * (item.quantity || 1), 0);
  const totalNonComboPhoto = nonComboSelected
    .filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE')
    .reduce((sum, item) => sum + (item.basePrice || 0) * (item.quantity || 1), 0);

  const totalProductRental = totalNonComboRental;
  const totalProductDeposit = totalComboDeposit + totalNonComboDeposit;
  const totalPhotographerFee = totalNonComboPhoto;
  const comboDiscountTotal = Array.from(selectedComboIds).reduce((sum, cId) => {
    const cItems = enrichedCart.filter(i => i.comboPromotionId === cId);
    const origTotal = cItems.reduce((s, i) => s + (i.basePrice || 0) * (i.quantity || 1), 0);
    const pct = cItems[0]?.comboDiscountPercent || 50;
    return sum + Math.round(origTotal * (pct / 100));
  }, 0);

  const serviceFee = 0;

  const grandTotal = totalComboPrice + totalNonComboRental + totalNonComboPhoto;
  const depositToPayNow = totalComboPrice + totalComboDeposit + totalNonComboRental + totalNonComboDeposit + totalNonComboPhoto;
  const remainingToPayLater = 0;

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
        if (['FAILED', 'CANCELLED'].includes(status.paymentStatus) || status.bookingStatus === 'CANCELLED') {
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
    if (await resumePendingCheckout()) return;



    const invalidProduct = selectedItems.find(
      (item) =>
        item.itemType === 'PRODUCT' && getProductValidationIssues(item).length > 0,
    );
    if (invalidProduct) {
      const issues = getProductValidationIssues(invalidProduct).join(', ');
      toast.error(
        'Áo dài "' +
        (invalidProduct.name || invalidProduct.productName || 'trong giỏ hàng') +
        '" đang thiếu: ' + issues + '. Vui lòng chỉnh lại sản phẩm này trước khi thanh toán.',
      );
      return;
    }
    try {
      await Promise.all(selectedItems.filter((item) => item.itemType === 'PRODUCT').map(async (item) => {
        const from = item.rentalFrom || item.startDate || '';
        const to = item.rentalTo || item.endDate || from;
        const result = await checkProductAvailability(item.productId || '', item.size || '', item.color || '', from, to, item.quantity, item.rentalType || 'DAILY', item.startTime || undefined, item.endTime || undefined);
        if (!result.available) throw new Error(`${item.name || item.productName || 'Sản phẩm'} không còn đủ số lượng cho lịch đã chọn.`);
      }));
    } catch (error: any) { toast.error(error.message || 'Không thể kiểm tra lịch thuê.'); return; }
    setIsLoading(true);
    try {
      const productItems = selectedItems.filter(item => item.itemType === 'PRODUCT');
      const photoItems = selectedItems.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE');
      if (photoItems.length > 1) {
        throw new Error('Vui lòng thanh toán từng gói chụp hoặc từng combo riêng biệt.');
      }

      const rentalItemsPayload = productItems.map(item => {
        let pId = item.productId || item.id;
        if (pId && !/^[0-9a-fA-F]{24}$/.test(pId)) {
          // Find a matching real product ID from database
          let matchedProd = null;
          if (pId === 'product_gam_do' || pId === 'prod_gam_do') {
            matchedProd = realProductList.find(p => p.name?.toLowerCase().includes('đỏ') || p.name?.toLowerCase().includes('red'));
          } else if (pId === 'product_to_tam' || pId === 'prod_to_tam') {
            matchedProd = realProductList.find(p => p.name?.toLowerCase().includes('trắng') || p.name?.toLowerCase().includes('white'));
          }
          if (!matchedProd && realProductList.length > 0) {
            matchedProd = realProductList[0];
          }
          if (matchedProd) {
            pId = matchedProd._id;
          }
        }

        // Ensure dates are parsed correctly
        const rentalFrom = item.rentalFrom || item.startDate || new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
        const rentalTo = item.rentalTo || item.endDate || new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0];

        return {
          productId: pId,
          quantity: item.quantity || 1,
          rentalFrom,
          rentalTo,
          selectedSize: item.size || null,
          selectedColor: item.color || null,
          rentalType: item.rentalType || 'DAILY',
          shootDate: item.startDate || item.rentalFrom || null,
          shootTimeSlot: item.shootTimeSlot || (item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : null),
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
          throw new Error('Gói chụp thiếu địa chỉ hoặc tọa độ bản đồ. Vui lòng xóa gói và chọn lại địa điểm chụp.');
        }
        const [startTime, endTime] = photo.shootTimeSlot.split('-').map(value => value.trim());
        if (!startTime || !endTime) {
          throw new Error('Khung giờ chụp không hợp lệ. Vui lòng chọn lại lịch.');
        }
        const holdPayload = {
          packageId: photo.photographyPackageId,
          sessions: [{
            clientId: photo.id,
            startsAt: `${photo.shootDate}T${startTime}:00+07:00`,
            endsAt: `${photo.shootDate}T${endTime}:00+07:00`,
            locationAddress: photo.shootLocation,
            locationLatitude: photo.shootLocationLatitude,
            locationLongitude: photo.shootLocationLongitude,
          }],
          concept: photo.shootConcept || undefined,
          customRequests: photo.customRequests || undefined,
          referenceImage: photo.referenceImage || undefined,
          comboDiscountPercent: photo.comboDiscountPercent ?? (productItems.length > 0 ? (productItems[0]?.comboDiscountPercent ?? 50) : 50),
          comboPromotionId: photo.comboPromotionId || (productItems.length > 0 ? productItems[0]?.comboPromotionId : undefined) || undefined,
          ...(productItems.length > 0 ? {
            aodaiItems: rentalItemsPayload.map(item => ({
              productId: item.productId,
              selectedSize: item.selectedSize,
              selectedColor: item.selectedColor,
              rentalFrom: item.rentalFrom,
              rentalTo: item.rentalTo,
              quantity: item.quantity,
            })),
          } : {}),
        };
        const holdEndpoint = productItems.length > 0
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
          serviceFee,
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
          JSON.stringify({ bookingId, cartItemIds: selectedItems.map(item => item.id) }),
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
    <div style={{ backgroundColor: '#FCF9F2', minHeight: '90vh', padding: '40px 0 80px 0', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '0 24px' }}>

        {/* Cart Header: Title on Left, Select All Button on Right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(45, 41, 38, 0.05)', paddingBottom: '20px' }}>
          <h1 className="font-header" style={{ fontSize: '36px', fontWeight: 700, color: '#8B1E22', margin: 0 }}>
            Giỏ hàng của bạn
          </h1>

          {cart.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: '1px solid #EAE1D4',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'white',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '0.05em',
                color: '#5D4037',
                textTransform: 'uppercase'
              }}
              onClick={toggleSelectAll}
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                style={{ accentColor: '#8B1E22', cursor: 'pointer', margin: 0 }}
              />
              <span>CHỌN TẤT CẢ</span>
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #EAE1D4', boxShadow: 'var(--shadow-sm)' }}>
            <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>Giỏ hàng hiện tại đang trống.</p>
            <Link to={ROUTES.RENTALS} className="vh-btn vh-btn-primary vh-btn-md" style={{ borderRadius: '10px', backgroundColor: '#8B1E22', borderColor: '#8B1E22' }}>
              THUÊ ÁO DÀI NGAY
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', alignItems: 'start' }}>

            {/* Left Column: Cart groups and items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {comboGroupEntries.map(entry => {
                const isComboSelected = entry.items.every(i => selectedItemIds.includes(i.id));

                return (
                  <div
                    key={entry.comboId}
                    style={{
                      backgroundColor: '#FFFDF9',
                      borderRadius: '12px',
                      border: '2px solid #D97706',
                      boxShadow: '0 4px 12px rgba(217, 119, 6, 0.12)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #FDE68A', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CustomCheckbox
                          checked={isComboSelected}
                          onChange={() => {
                            if (isComboSelected) {
                              setSelectedItemIds(prev => prev.filter(id => !entry.items.some(i => i.id === id)));
                            } else {
                              setSelectedItemIds(prev => Array.from(new Set([...prev, ...entry.items.map(i => i.id)])));
                            }
                          }}
                        />
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#8B1E22',
                          color: 'white',
                          padding: '5px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 800,
                          letterSpacing: '0.05em'
                        }}>
                          <Sparkles size={13} fill="#FFF" /> GÓI COMBO TRỌN GÓI (GIẢM {entry.discountPct}%)
                        </span>
                      </div>
                      <button
                        onClick={() => entry.items.forEach(i => removeFromCart(i.id))}
                        style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700 }}
                      >
                        <Trash2 size={16} /> Xóa Combo
                      </button>
                    </div>

                    {/* Items list inside Combo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {entry.items.map((item) => {
                        const itemImage = item.itemType === 'PRODUCT'
                          ? (item.productImage || item.image)
                          : (item.packageImage || item.photographerAvatar || item.image);

                        return (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'white', padding: '14px 16px', borderRadius: '8px', border: '1px solid #FEF3C7' }}>
                            <img
                              src={getImageUrl(itemImage)}
                              alt={item.productName || item.packageName || ''}
                              style={{ width: '70px', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}
                            />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B' }}>
                                {item.itemType === 'PRODUCT' ? `Áo dài: ${item.productName || item.name}` : `Gói chụp: ${item.photographerName} | ${item.packageName}`}
                              </div>
                              {item.itemType === 'PRODUCT' ? (
                                <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                                  Kích cỡ: <strong style={{ color: '#8B1E22' }}>{item.size}</strong> • Màu: <strong style={{ color: '#8B1E22' }}>{item.color}</strong> • Ngày thuê: <strong>{formatSingleDate(item.rentalFrom || item.startDate)}</strong>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                                  Lịch chụp: <strong style={{ color: '#8B1E22' }}>{formatSingleDate(item.shootDate)} ({item.shootTimeSlot})</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer combo summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #FDE68A', paddingTop: '12px' }}>
                      <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                        Giá gốc 2 món: <span style={{ textDecoration: 'line-through' }}>{entry.origTotal.toLocaleString('vi-VN')}đ</span>
                        {entry.depositAmt > 0 && <span style={{ marginLeft: '10px', color: '#D97706', fontWeight: 600 }}>(Cọc áo dài: +{entry.depositAmt.toLocaleString('vi-VN')}đ)</span>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: '#8B1E22', fontWeight: 600 }}>Giá Combo ưu đãi: </span>
                        <strong style={{ fontSize: '20px', color: '#8B1E22', fontWeight: 800 }}>{entry.comboPrice.toLocaleString('vi-VN')}đ</strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              {groups.map(group => (
                <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Group Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
                    {group.type === 'SUCCESS' && (
                      <div style={{ color: '#27AE60', display: 'flex', alignItems: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                    )}
                    {group.type === 'MISMATCH' && (
                      <div style={{ color: '#D35400', display: 'flex', alignItems: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                    )}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: group.type === 'SUCCESS' ? '#27AE60' : group.type === 'MISMATCH' ? '#D35400' : '#5D4037',
                      textTransform: 'uppercase'
                    }}>
                      {group.title}
                    </span>
                  </div>

                  {/* Warning banner for mismatched groups */}
                  {group.type === 'MISMATCH' && group.warning && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: group.isCityMismatch ? '#FDE8E8' : '#FFF7F0',
                      border: group.isCityMismatch ? '1px solid #F8B4B4' : 'none',
                      padding: '12px 16px',
                      borderRadius: '6px',
                      animation: 'fadeIn 0.3s ease-out'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={group.isCityMismatch ? '#C0392B' : '#7D5A2B'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span style={{ fontSize: '13px', color: group.isCityMismatch ? '#C0392B' : '#7D5A2B', fontWeight: 600 }}>
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
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#62441E'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#7D5A2B'}
                        >
                          ĐỒNG BỘ NGÀY & GIỜ
                        </button>
                      )}
                    </div>
                  )}

                  {/* Group Items Container */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {group.items.map((item: CartItem) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      const itemName = item.itemType === 'PRODUCT'
                        ? (item.productName || item.name)
                        : `${item.photographerName} | ${item.packageName}`;

                      const itemImage = item.itemType === 'PRODUCT'
                        ? (item.productImage || item.image)
                        : item.photographerAvatar;

                      const isRentalProduct = item.itemType === 'PRODUCT' && (item.rentalFrom || item.startDate);

                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            backgroundColor: 'white',
                            padding: '24px',
                            borderRadius: '8px',
                            border: '1px solid #EAE1D4',
                            alignItems: 'center',
                            position: 'relative'
                          }}
                        >
                          {/* Checkbox */}
                          <CustomCheckbox
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                          />

                          {/* Item Thumbnail */}
                          {isRentalProduct ? (
                            <img
                              src={itemImage || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600'}
                              alt={itemName || ''}
                              style={{ width: '90px', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.05)', marginRight: '24px' }}
                            />
                          ) : item.itemType === 'PHOTOGRAPHY_PACKAGE' ? (
                            <img
                              src={itemImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200'}
                              alt={itemName || ''}
                              style={{ width: '90px', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.05)', marginRight: '24px' }}
                            />
                          ) : (
                            // Magic Wand icon for AI editing package
                            <div style={{
                              width: '90px',
                              height: '90px',
                              backgroundColor: '#FCEBEB',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#8B1E22',
                              marginRight: '24px'
                            }}>
                              <Sparkles size={32} />
                            </div>
                          )}

                          {/* Item Details */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h3 className="font-header" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#2D2926' }}>
                                {itemName}
                              </h3>

                              <button
                                onClick={() => removeFromCart(item.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#C5B39E',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  position: 'absolute',
                                  top: '24px',
                                  right: '24px'
                                }}
                                title="Xóa"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>

                            {/* Specific text fields */}
                            <div style={{ fontSize: '13px', color: '#7E6D5B', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {isRentalProduct ? (
                                <>
                                  {/* Inline edit panel for product items */}
                                  {editingItemId === item.id ? (
                                    <div style={{
                                      backgroundColor: '#FAF5EE',
                                      border: '1px solid #E8D9C0',
                                      borderRadius: '8px',
                                      padding: '14px 16px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '12px',
                                      marginTop: '4px',
                                      animation: 'fadeIn 0.2s ease'
                                    }}>
                                      {/* Size selector */}
                                      {(() => {
                                        const dbProd = realProductList.find(p => p._id === item.productId || p._id === item.id);
                                        const sizes: string[] = dbProd?.sizes || ['S', 'M', 'L', 'XL'];
                                        const colors: string[] = dbProd?.colors || [];
                                        return (
                                          <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8B1E22', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kích cỡ</label>
                                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {sizes.map(sz => (
                                                  <button
                                                    key={sz}
                                                    onClick={async () => {
                                                      updateCartItemSize(item.id, sz);
                                                      try {
                                                        const res = await httpClient.get<{ stock: number }>(
                                                          `/bookings/stock/product/${item.productId}?size=${encodeURIComponent(sz)}&color=${encodeURIComponent(item.color || '')}`
                                                        );
                                                        const newStock = res.stock || 0;
                                                        setItemStocks(prev => ({ ...prev, [item.id]: newStock }));
                                                        if (item.quantity > newStock && newStock > 0) {
                                                          updateCartItemQuantity(item.id, newStock);
                                                        }
                                                      } catch (e) {
                                                        console.error('Lỗi tải tồn kho:', e);
                                                      }
                                                    }}
                                                    style={{
                                                      padding: '5px 12px',
                                                      borderRadius: '4px',
                                                      border: `1.5px solid ${(item.size || '').toUpperCase() === sz.toUpperCase() ? '#8B1E22' : '#D5C2AD'}`,
                                                      backgroundColor: (item.size || '').toUpperCase() === sz.toUpperCase() ? '#8B1E22' : 'white',
                                                      color: (item.size || '').toUpperCase() === sz.toUpperCase() ? 'white' : '#5D4037',
                                                      fontSize: '12px',
                                                      fontWeight: 700,
                                                      cursor: 'pointer',
                                                      transition: 'all 0.15s'
                                                    }}
                                                  >
                                                    {sz}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>

                                            {colors.length > 0 && (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#8B1E22', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Màu sắc</label>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                  {colors.map(cl => (
                                                    <button
                                                      key={cl}
                                                      onClick={async () => {
                                                        updateCartItemColor(item.id, cl);
                                                        try {
                                                          const res = await httpClient.get<{ stock: number }>(
                                                            `/bookings/stock/product/${item.productId}?size=${encodeURIComponent(item.size || '')}&color=${encodeURIComponent(cl)}`
                                                          );
                                                          const newStock = res.stock || 0;
                                                          setItemStocks(prev => ({ ...prev, [item.id]: newStock }));
                                                          if (item.quantity > newStock && newStock > 0) {
                                                            updateCartItemQuantity(item.id, newStock);
                                                          }
                                                        } catch (e) {
                                                          console.error('Lỗi tải tồn kho:', e);
                                                        }
                                                      }}
                                                      style={{
                                                        padding: '5px 12px',
                                                        borderRadius: '4px',
                                                        border: `1.5px solid ${(item.color || '').toUpperCase() === cl.toUpperCase() ? '#8B1E22' : '#D5C2AD'}`,
                                                        backgroundColor: (item.color || '').toUpperCase() === cl.toUpperCase() ? '#8B1E22' : 'white',
                                                        color: (item.color || '').toUpperCase() === cl.toUpperCase() ? 'white' : '#5D4037',
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                      }}
                                                    >
                                                      {cl}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}

                                      {/* Calendar & Timeslot Grid */}
                                      <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px',
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #EAE1D4',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginTop: '8px'
                                      }}>
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                          gap: '20px',
                                          alignItems: 'start'
                                        }}>
                                          {/* Calendar Section */}
                                          <div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                              <button
                                                type="button"
                                                onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#8B1E22', display: 'flex', alignItems: 'center' }}
                                              >
                                                <ChevronLeft size={16} />
                                              </button>
                                              <span style={{ fontSize: '13px', fontWeight: 750, color: '#2D2926' }}>
                                                Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#8B1E22', display: 'flex', alignItems: 'center' }}
                                              >
                                                <ChevronRight size={16} />
                                              </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                                              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
                                                <span key={w} style={{ fontSize: '10px', fontWeight: 800, color: '#8C827A', padding: '2px 0' }}>{w}</span>
                                              ))}
                                              {calendarDays.map((d, idx) => {
                                                if (d.isEmpty) return <div key={`e-${idx}`} />;

                                                const startDateVal = item.rentalFrom || item.startDate || '';
                                                const endDateVal = item.rentalTo || item.endDate || '';

                                                const isDaySelected = editingItemType === 'HOURLY'
                                                  ? startDateVal === d.dateStr
                                                  : (startDateVal === d.dateStr || endDateVal === d.dateStr);

                                                const isDayInRange = editingItemType === 'DAILY' && startDateVal && endDateVal && d.dateStr > startDateVal && d.dateStr < endDateVal;

                                                return (
                                                  <button
                                                    key={d.day}
                                                    type="button"
                                                    disabled={!d.isAvailable}
                                                    onClick={() => handleCalendarDayClick(d.dateStr)}
                                                    style={{
                                                      aspectRatio: '1',
                                                      border: isDaySelected ? '1.5px solid #8B1E22' : '1px solid transparent',
                                                      borderRadius: '6px',
                                                      backgroundColor: isDaySelected
                                                        ? '#8B1E22'
                                                        : isDayInRange
                                                          ? '#FFF0F1'
                                                          : !d.isAvailable
                                                            ? '#F5F5F5'
                                                            : d.isWeekend
                                                              ? '#FCF9F2'
                                                              : '#FFFFFF',
                                                      color: !d.isAvailable
                                                        ? '#CCCCCC'
                                                        : isDaySelected
                                                          ? '#FFFFFF'
                                                          : isDayInRange
                                                            ? '#8B1E22'
                                                            : '#4A4440',
                                                      fontWeight: isDaySelected || isDayInRange ? 700 : 500,
                                                      fontSize: '11px',
                                                      cursor: !d.isAvailable ? 'not-allowed' : 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      transition: 'all 0.15s ease',
                                                      padding: 0
                                                    }}
                                                  >
                                                    {d.day}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>

                                          {/* Time Slots Section (HOURLY) or Info Section (DAILY) */}
                                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            {editingItemType === 'HOURLY' ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHỌN GIỜ THUÊ (MỖI Ô 2 TIẾNG)</span>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                                                  {productSlots.map((block, idx) => {
                                                    const singleDate = item.rentalFrom || item.startDate || '';
                                                    const isBusy = bookedSlotsOnSelectedDate.some(bookedSlot =>
                                                      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot)
                                                    );
                                                    const today = new Date();
                                                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                                    const isPast = singleDate === todayStr && (() => {
                                                      const [sh, sm] = block.start.split(':').map(Number);
                                                      return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
                                                    })();

                                                    const isSelected = idx >= startSlotIndex && idx <= endSlotIndex;

                                                    return (
                                                      <button
                                                        key={block.label}
                                                        type="button"
                                                        disabled={isBusy || isPast}
                                                        onClick={() => handleSlotClick(idx)}
                                                        style={{
                                                          padding: '6px 4px',
                                                          borderRadius: '6px',
                                                          fontSize: '11px',
                                                          fontWeight: 700,
                                                          display: 'flex',
                                                          flexDirection: 'column',
                                                          alignItems: 'center',
                                                          gap: '2px',
                                                          cursor: (isBusy || isPast) ? 'not-allowed' : 'pointer',
                                                          backgroundColor: isSelected
                                                            ? '#8B1E22'
                                                            : (isBusy || isPast)
                                                              ? '#EAEAE8'
                                                              : '#FFFFFF',
                                                          color: isSelected
                                                            ? '#FFFFFF'
                                                            : (isBusy || isPast)
                                                              ? '#A0A09E'
                                                              : '#5D4037',
                                                          border: isSelected
                                                            ? '1.5px solid #8B1E22'
                                                            : '1.5px solid rgba(45, 41, 38, 0.15)',
                                                          transition: 'all 0.15s ease',
                                                        }}
                                                      >
                                                        <span>{block.label}</span>
                                                        <span style={{ fontSize: '8px', fontWeight: 600, opacity: 0.85 }}>
                                                          {isBusy ? 'Đã bận' : isPast ? 'Đã qua' : isSelected ? 'Đã chọn' : 'Trống'}
                                                        </span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ) : (
                                              <div style={{
                                                backgroundColor: '#FCF9F2',
                                                border: '1px solid #EAE1D4',
                                                borderRadius: '6px',
                                                padding: '12px',
                                                fontSize: '12px',
                                                color: '#5D4037',
                                                lineHeight: 1.5
                                              }}>
                                                <div style={{ fontWeight: 700, color: '#8B1E22', marginBottom: '4px' }}>Thời gian chọn thuê:</div>
                                                {item.rentalFrom && item.rentalTo ? (
                                                  <>
                                                    <div>Từ ngày: <strong>{formatSingleDate(item.rentalFrom)}</strong></div>
                                                    <div>Đến ngày: <strong>{formatSingleDate(item.rentalTo)}</strong></div>
                                                    <div style={{ marginTop: '6px', fontSize: '11px', fontStyle: 'italic', color: '#8C7355' }}>
                                                      * Click chọn Ngày nhận đầu tiên, sau đó click Ngày trả.
                                                    </div>
                                                  </>
                                                ) : (
                                                  <div style={{ fontStyle: 'italic', color: '#8C827A' }}>
                                                    Vui lòng chọn ngày nhận và ngày trả trên lịch.
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {editingItemType === 'HOURLY' && (
                                          <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#8C7355', lineHeight: 1.4 }}>
                                            * Bạn có thể chọn liên tiếp nhiều ô để thuê nhiều giờ (Ví dụ: click ô 9h-11h rồi click ô 11h-13h).
                                          </span>
                                        )}
                                      </div>

                                      <button
                                        onClick={() => setEditingItemId(null)}
                                        style={{
                                          alignSelf: 'flex-end',
                                          padding: '5px 14px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          backgroundColor: '#8B1E22',
                                          color: 'white',
                                          fontSize: '12px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          marginTop: '2px'
                                        }}
                                      >
                                        ✓ Xong
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                          <span>Kích cỡ: <strong>{item.size}</strong> {item.color && <> • Màu: <strong>{item.color}</strong></>}</span>
                                          <span>Ngày thuê: <strong>{formatDateRange(item.rentalFrom || item.startDate, item.rentalTo || item.endDate)}{item.startTime && item.endTime ? ` (${item.startTime} - ${item.endTime})` : ''}</strong></span>
                                          <span>Nơi nhận: <strong>{item.providerCity || 'Thừa Thiên Huế'}</strong></span>
                                          {itemStocks[item.id] !== undefined && (
                                            <span style={{ fontSize: '11px', color: '#8B1E22', fontWeight: 600, marginTop: '2px' }}>
                                              (Còn lại {itemStocks[item.id]} sản phẩm trong kho)
                                            </span>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => setEditingItemId(item.id)}
                                          title="Chỉnh sửa kích cỡ & lịch thuê"
                                          style={{
                                            background: 'none',
                                            border: '1px solid #D5C2AD',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            color: '#8B1E22',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0
                                          }}
                                        >
                                          <Pencil size={11} /> Sửa
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </>
                              ) : item.itemType === 'PHOTOGRAPHY_PACKAGE' ? (
                                <>
                                  <span>Địa điểm chụp: <strong>{item.shootLocation}</strong></span>
                                  <span>Khu vực hoạt động: <strong>{item.photographerCity || 'Thừa Thiên Huế'}</strong></span>
                                  <span>Ngày chụp: <strong>{formatSingleDate(item.shootDate)} ({item.shootTimeSlot})</strong></span>
                                </>
                              ) : (
                                <span>Tăng cường chi tiết gấm silk & ánh sáng chân thực cho 10 ảnh.</span>
                              )}
                            </div>

                            {/* Price and Quantity Selector */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', maxWidth: '350px' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#8B1E22' }}>
                                  {item.basePrice?.toLocaleString('vi-VN')}đ
                                </span>
                                {(item as any).originalPrice && (item as any).originalPrice > (item.basePrice || 0) && (
                                  <span style={{ fontSize: '13px', textDecoration: 'line-through', color: '#9C9C9C', fontWeight: 500 }}>
                                    {(item as any).originalPrice.toLocaleString('vi-VN')}đ
                                  </span>
                                )}
                              </div>

                              {/* Premium Quantity Selector */}
                              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #EAE1D4', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#FAF5EE' }}>
                                <button
                                  onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    width: '28px',
                                    height: '28px',
                                    cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                                    color: item.quantity <= 1 ? '#C5B39E' : '#2D2926',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  -
                                </button>
                                <span style={{
                                  width: '28px',
                                  textAlign: 'center',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  color: '#2D2926',
                                  userSelect: 'none'
                                }}>
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => {
                                    const maxStock = itemStocks[item.id] ?? 999;
                                    if (item.quantity >= maxStock) {
                                      toast.error(`Chỉ còn ${maxStock} sản phẩm khả dụng cho kích cỡ và màu sắc này.`);
                                      return;
                                    }
                                    updateCartItemQuantity(item.id, item.quantity + 1);
                                  }}
                                  disabled={item.quantity >= (itemStocks[item.id] ?? 999)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    width: '28px',
                                    height: '28px',
                                    cursor: item.quantity >= (itemStocks[item.id] ?? 999) ? 'not-allowed' : 'pointer',
                                    color: item.quantity >= (itemStocks[item.id] ?? 999) ? '#C5B39E' : '#2D2926',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                    opacity: item.quantity >= (itemStocks[item.id] ?? 999) ? 0.3 : 1
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Special Badges */}
                            {item.itemType === 'PRODUCT' && (item.depositAmount || 0) > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <span style={{
                                  backgroundColor: '#F7F2EC',
                                  color: '#8C7355',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  display: 'inline-block'
                                }}>
                                  Tiền cọc: {item.depositAmount?.toLocaleString('vi-VN')}đ (Hoàn trả khi nhận đồ)
                                </span>
                              </div>
                            )}

                            {item.itemType === 'PHOTOGRAPHY_PACKAGE' && group.type === 'SUCCESS' && (
                              <div style={{ marginTop: '8px' }}>
                                <span style={{
                                  backgroundColor: '#EAF7EE',
                                  color: '#27AE60',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <Calendar size={12} />
                                  Lịch trình khớp với Áo dài ({getDayMonth(group.syncDate)})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Sticky Summary Panel */}
            <aside style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Tóm tắt đơn hàng box */}
              <div style={{ backgroundColor: '#FAF5EE', padding: '32px', borderRadius: '16px', border: 'none' }}>
                <h3 className="font-header" style={{ fontSize: '20px', fontWeight: 700, color: '#8B1E22', margin: '0 0 24px 0' }}>
                  Tóm tắt đơn hàng
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5D4037' }}>
                    <span>Tổng tiền dịch vụ ({selectedItems.length} mục)</span>
                    <span style={{ color: '#2D2926', fontWeight: 700 }}>
                      {grandTotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  {totalProductRental > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5D4037' }}>
                      <span>Tiền thuê Áo dài</span>
                      <span style={{ color: '#2D2926', fontWeight: 600 }}>
                        {totalProductRental.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}

                  {totalProductDeposit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5D4037' }}>
                      <span>Tiền cọc Áo dài</span>
                      <span style={{ color: '#2D2926', fontWeight: 600 }}>
                        {totalProductDeposit.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}

                  {totalPhotographerFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5D4037' }}>
                      <span>Phí Thợ chụp ảnh</span>
                      <span style={{ color: '#2D2926', fontWeight: 600 }}>
                        {totalPhotographerFee.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}

                  {comboDiscountTotal > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#27AE60', marginTop: '4px' }}>
                        <span>Giảm giá Combo</span>
                        <span style={{ fontWeight: 700 }}>
                          -{comboDiscountTotal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div style={{ padding: '8px 12px', backgroundColor: '#E8F8F5', borderRadius: '6px', fontSize: '12px', color: '#27AE60', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', textAlign: 'left' }}>
                        {checkedGroups
                          .filter((g: any) => g.type === 'SUCCESS')
                          .map((group, gIdx) => {
                            const prod = group.items.find((i: any) => i.itemType === 'PRODUCT');
                            const photo = group.items.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
                            return (
                              <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {prod && (prod.comboDiscountPercent !== 0) && (
                                  <div>• Cửa hàng giảm {(prod.comboDiscountPercent ?? 10)}% áo dài (-{((prod.basePrice || 0) * (prod.comboDiscountPercent ?? 10) / 100).toLocaleString('vi-VN')}đ)</div>
                                )}
                                {photo && (photo.comboDiscountPercent !== 0) && (
                                  <div>• Thợ ảnh giảm {(photo.comboDiscountPercent ?? 10)}% gói chụp (-{((photo.basePrice || 0) * (photo.comboDiscountPercent ?? 10) / 100).toLocaleString('vi-VN')}đ)</div>
                                )}
                                {photo && (photo.comboDiscountPercent === 0) && (
                                  <div style={{ color: '#7F8C8D' }}>• Thợ ảnh {photo.photographerName} không áp dụng giảm giá Combo</div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ height: '1px', backgroundColor: '#EAE1D4', margin: '20px 0' }} />

                {/* Pay Now Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2D2926', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    CẦN THANH TOÁN NGAY
                  </div>
                  <div className="font-header" style={{ fontSize: '32px', fontWeight: 700, color: '#8B1E22' }}>
                    {depositToPayNow.toLocaleString('vi-VN')}đ
                  </div>
                  {totalProductDeposit > 0 && (
                    <div style={{ fontSize: '12px', color: '#8C7355', marginTop: '4px', fontWeight: 600 }}>
                      Gồm: {grandTotal.toLocaleString('vi-VN')}đ (dịch vụ) + {totalProductDeposit.toLocaleString('vi-VN')}đ (tiền cọc áo dài, sẽ hoàn lại)
                    </div>
                  )}
                </div>

                {/* Nested box for pay later */}
                {remainingToPayLater > 0 && (
                  <div style={{ backgroundColor: '#F5EFE6', padding: '12px 16px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#5D4037', marginBottom: '16px' }}>
                    <span>Tiền trả sau cho thợ chụp</span>
                    <strong style={{ color: '#2D2926' }}>{remainingToPayLater.toLocaleString('vi-VN')}đ</strong>
                  </div>
                )}

                {/* Warning message above checkout button */}
                {selectedItems.some((item) => item.itemType === 'PRODUCT') && (
                  <div style={{ display: 'flex', gap: '10px', padding: '12px', backgroundColor: '#FFF8E9', border: '1px solid #F2D9A6', borderRadius: '8px', marginBottom: '16px', color: '#6E5318' }}>
                    <Building size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '12px', lineHeight: 1.55 }}><strong>Nhận và trả áo dài tại cùng một điểm.</strong><br />Điểm do cửa hàng thiết lập được snapshot khi tạo booking. Địa chỉ và nút chỉ đường chỉ hiện trong chi tiết booking, không hiển thị công khai trước đó.</div>
                  </div>
                )}
                {checkedGroups.some(group => group.isCityMismatch) && (
                  <div style={{
                    color: '#C0392B',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#FDE8E8',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    textAlign: 'left',
                    border: '1px solid #F8B4B4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Lệch khu vực địa lý Áo dài & Thợ ảnh!</span>
                  </div>
                )}

                {/* Checkout button */}
                <button
                  onClick={handleCheckout}
                  disabled={selectedItems.length === 0 || isLoading}
                  className="font-body"
                  style={{
                    width: '100%',
                    backgroundColor: (selectedItems.length > 0 && !isLoading) ? '#8B1E22' : '#C5B39E',
                    color: 'white',
                    border: 'none',
                    padding: '16px',
                    fontSize: '15px',
                    fontWeight: '700',
                    borderRadius: '4px',
                    marginTop: '24px',
                    cursor: (selectedItems.length > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    if (selectedItems.length > 0 && !isLoading) e.currentTarget.style.backgroundColor = '#72181B';
                  }}
                  onMouseOut={(e) => {
                    if (selectedItems.length > 0 && !isLoading) e.currentTarget.style.backgroundColor = '#8B1E22';
                  }}
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>ĐANG XỬ LÝ...</span>
                    </>
                  ) : (
                    <>
                      <span>TIẾN HÀNH THANH TOÁN</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>


                {/* Secure Payment details */}
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                  <div style={{ fontSize: '11px', color: '#A29382', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    THANH TOÁN AN TOÀN QUA
                  </div>
                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', color: '#A29382' }}>
                    <QrCode size={20} />
                    <Building size={20} />
                    <CreditCard size={20} />
                  </div>
                </div>
              </div>

              {/* Quality Guarantee Shield box */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #EAE1D4',
                padding: '16px 20px',
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <div style={{ color: '#8B1E22', marginTop: '2px' }}>
                  <ShieldCheck size={20} />
                </div>
                <div style={{ fontSize: '12px', color: '#5D4037', lineHeight: 1.5 }}>
                  Cam kết chất lượng: Hoàn tiền 100% nếu trang phục không đúng mô tả.
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

    </div>
  );
};

export default CartPage;
