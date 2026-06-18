import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import type { CartItem } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';
import { 
  Trash2, 
  CheckCircle, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  QrCode, 
  Building, 
  CreditCard 
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
          <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
};

const normalizeCity = (city?: string | null) => {
  if (!city) return '';
  return city.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(thanh pho|tp\.?|tinh)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const isSameCity = (city1?: string | null, city2?: string | null) => {
  const c1 = normalizeCity(city1 || 'Thừa Thiên Huế');
  const c2 = normalizeCity(city2 || 'Thừa Thiên Huế');
  return c1.includes(c2) || c2.includes(c1);
};

const isMongoObjectId = (id?: string | null) => /^[a-f\d]{24}$/i.test(id || '');

export const CartPage: React.FC = () => {
  const { cart, removeFromCart, updateCartItemDate, updateCartItemTimeSlot } = useCart();
  const toast = useToast();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'BANK'>('BANK');
  const [isLoading, setIsLoading] = useState(false);
  const [realProductList, setRealProductList] = useState<any[]>([]);
  const [realPhotographersList, setRealPhotographersList] = useState<any[]>([]);

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const prods = await httpClient.get<any[]>('/products');
        setRealProductList(prods);
      } catch (e) {
        console.error('Failed to fetch real products for mapping', e);
      }
      try {
        const phs = await httpClient.get<any[]>('/api/photographers');
        setRealPhotographersList(phs);
      } catch (e) {
        console.error('Failed to fetch real photographers for mapping', e);
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

  // Grouping logic for items (Combo 1, Combo 2, Others)
  const checkedItems = cart.filter(item => selectedItemIds.includes(item.id));
  const uncheckedItems = cart.filter(item => !selectedItemIds.includes(item.id));

  // Helper to find combos in a list of items
  const findCombos = (itemsList: CartItem[], startIndex: number) => {
    const listGroups: any[] = [];
    const photographersList = itemsList.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE');
    const productsList = itemsList.filter(item => item.itemType === 'PRODUCT' && (item.rentalFrom || item.startDate));
    const groupedIdsInList = new Set<string>();

    let idx = startIndex;

    // A. Match success combos (overlapping dates AND overlapping time slots if hourly, AND matching city location)
    photographersList.forEach(photo => {
      if (groupedIdsInList.has(photo.id)) return;

      const matchingProduct = productsList.find(prod => {
        if (groupedIdsInList.has(prod.id)) return false;
        
        // City match check is mandatory for a successful combo
        const isCityMatch = isSameCity(prod.providerCity, photo.photographerCity);
        if (!isCityMatch) return false;
        
        const rentalFrom = prod.rentalFrom || prod.startDate;
        const rentalTo = prod.rentalTo || prod.endDate;
        const shootDate = photo.shootDate;
        if (!rentalFrom || !rentalTo || !shootDate) return false;
        
        const start = new Date(rentalFrom);
        const end = new Date(rentalTo);
        const shoot = new Date(shootDate);
        
        // Date overlap check
        const isDateOverlap = shoot >= start && shoot <= end;
        if (!isDateOverlap) return false;

        // Time slot overlap check (only if hourly rental)
        if (prod.startTime && prod.endTime && photo.shootTimeSlot) {
          const parts = photo.shootTimeSlot.split('-');
          const photoStart = parts[0]?.trim();
          const photoEnd = parts[1]?.trim();
          if (photoStart && photoEnd) {
            // Check if photo is within prod rental period
            const isTimeOverlap = photoStart >= prod.startTime && photoEnd <= prod.endTime;
            return isTimeOverlap;
          }
        }
        
        return true;
      });

      if (matchingProduct) {
        listGroups.push({
          id: `combo_${idx++}`,
          title: `NHÓM COMBO ${idx - 1} - ĐỒNG BỘ THÀNH CÔNG`,
          type: 'SUCCESS',
          items: [matchingProduct, photo],
          syncDate: matchingProduct.rentalFrom || matchingProduct.startDate
        });
        groupedIdsInList.add(photo.id);
        groupedIdsInList.add(matchingProduct.id);
      }
    });

    // B. Match mismatched combos
    photographersList.forEach(photo => {
      if (groupedIdsInList.has(photo.id)) return;

      const matchingProduct = productsList.find(prod => !groupedIdsInList.has(prod.id));

      if (matchingProduct) {
        const rentalFrom = matchingProduct.rentalFrom || matchingProduct.startDate;
        const shootDate = photo.shootDate;
        const prodDateFormatted = getDayMonth(rentalFrom);
        const photoDateFormatted = getDayMonth(shootDate);
        const prodCity = matchingProduct.providerCity || 'Thừa Thiên Huế';
        const photoCity = photo.photographerCity || 'Thừa Thiên Huế';
        const isCityMatch = isSameCity(prodCity, photoCity);
        
        let warning = '';
        let isCityMismatch = false;
        
        if (!isCityMatch) {
          warning = `Không thể đi chung Combo: Áo dài nhận tại ${prodCity} nhưng Thợ ảnh hoạt động ở ${photoCity}.`;
          isCityMismatch = true;
        } else if (rentalFrom !== shootDate) {
          warning = `Ngày thuê Áo dài (${prodDateFormatted}) và Ngày chụp (${photoDateFormatted}) đang không trùng khớp.`;
        } else if (matchingProduct.startTime && matchingProduct.endTime && photo.shootTimeSlot) {
          const parts = photo.shootTimeSlot.split('-');
          const photoStart = parts[0]?.trim();
          const photoEnd = parts[1]?.trim();
          warning = `Khung giờ thuê Áo dài (${matchingProduct.startTime} - ${matchingProduct.endTime}) và Giờ chụp (${photoStart} - ${photoEnd}) đang không trùng khớp.`;
        } else {
          warning = `Khung giờ thuê Áo dài và Lịch chụp ảnh đang không trùng khớp.`;
        }

        listGroups.push({
          id: `combo_${idx++}`,
          title: isCityMismatch ? `NHÓM COMBO ${idx - 1} - LỆCH KHU VỰC ĐỊA LÝ` : `NHÓM COMBO ${idx - 1} - LỆCH LỊCH TRÌNH`,
          type: 'MISMATCH',
          items: [matchingProduct, photo],
          warning,
          isCityMismatch
        });
        groupedIdsInList.add(photo.id);
        groupedIdsInList.add(matchingProduct.id);
      }
    });

    // C. Standalone items
    const remaining = itemsList.filter(item => !groupedIdsInList.has(item.id));

    return { listGroups, remaining, nextIndex: idx };
  };

  // Run pairing for checked items
  const { listGroups: checkedGroups, remaining: checkedRemaining, nextIndex: afterCheckedIdx } = findCombos(checkedItems, 1);

  // Run pairing for unchecked items
  const { listGroups: uncheckedGroups, remaining: uncheckedRemaining } = findCombos(uncheckedItems, afterCheckedIdx);

  // Combine groups
  const groups = [...checkedGroups, ...uncheckedGroups];

  // Standalone/Others
  const allRemaining = [...checkedRemaining, ...uncheckedRemaining];
  if (allRemaining.length > 0) {
    groups.push({
      id: 'others',
      title: 'SẢN PHẨM KHÁC',
      type: 'OTHERS',
      items: allRemaining
    });
  }

  // Checkbox functions
  const isAllSelected = cart.length > 0 && selectedItemIds.length === cart.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(cart.map(item => item.id));
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
  const selectedItems = cart.filter(item => selectedItemIds.includes(item.id));
  
  const totalProductRental = selectedItems
    .filter(item => item.itemType === 'PRODUCT' && (item.rentalFrom || item.startDate))
    .reduce((sum, item) => sum + (item.basePrice || 0) * item.quantity, 0);

  const totalProductDeposit = selectedItems
    .filter(item => item.itemType === 'PRODUCT' && (item.rentalFrom || item.startDate))
    .reduce((sum, item) => sum + (item.depositAmount || 0) * item.quantity, 0);

  const totalPhotographerFee = selectedItems
    .filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE')
    .reduce((sum, item) => sum + (item.basePrice || 0) * item.quantity, 0);

  const totalOthersFee = selectedItems
    .filter(item => item.itemType === 'PRODUCT' && !(item.rentalFrom || item.startDate))
    .reduce((sum, item) => sum + (item.basePrice || 0) * item.quantity, 0);

  // Flat service fee of 50.000đ if any items are selected
  const serviceFee = selectedItems.length > 0 ? 50000 : 0;

  const totalPhotographerDeposit = Math.round(totalPhotographerFee * 0.3);
  const totalPhotographerRemaining = totalPhotographerFee - totalPhotographerDeposit;

  const grandTotal = totalProductRental + totalPhotographerFee + totalOthersFee;
  const depositToPayNow = totalProductRental + totalPhotographerDeposit + totalOthersFee + serviceFee + totalProductDeposit;
  const remainingToPayLater = totalPhotographerRemaining;

  const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    
    const hasCityMismatch = checkedGroups.some(group => group.isCityMismatch);
    if (hasCityMismatch) {
      toast.error('Không thể tiến hành thanh toán do có sự lệch khu vực địa lý giữa Áo dài và Thợ ảnh trong giỏ hàng. Vui lòng kiểm tra lại!');
      return;
    }
    
    setIsLoading(true);
    try {
      const itemsPayload = selectedItems.map(item => {
        if (item.itemType === 'PRODUCT') {
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
          };
        } else {
          // PHOTOGRAPHY_PACKAGE
          let pkgId = item.photographyPackageId;
          if (pkgId && !/^[0-9a-fA-F]{24}$/.test(pkgId)) {
            // Find first photographer's package
            const firstPhoto = realPhotographersList.find(p => p.packages && p.packages.length > 0);
            if (firstPhoto && firstPhoto.packages.length > 0) {
              pkgId = firstPhoto.packages[0]._id;
            }
          }

          const shootDate = item.shootDate || new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
          const shootTimeSlot = item.shootTimeSlot || '09:00-11:00';

          return {
            photographyPackageId: pkgId,
            quantity: item.quantity || 1,
            shootDate,
            shootTimeSlot,
            shootLocation: item.shootLocation || 'Đại Nội Huế',
            concept: item.shootConcept || 'Cổ phục Huế',
            customRequests: item.customRequests || '',
          };
        }
      });

      const hasProduct = selectedItems.some(i => i.itemType === 'PRODUCT');
      const hasPhoto = selectedItems.some(i => i.itemType === 'PHOTOGRAPHY_PACKAGE');
      let bookingType = 'COMBO';
      if (hasProduct && !hasPhoto) {
        bookingType = 'AODAI_RENTAL';
      } else if (!hasProduct && hasPhoto) {
        bookingType = 'PHOTOGRAPHY';
      }

      const bookingPayload = {
        bookingType,
        items: itemsPayload,
        travelFee: 0,
      };

      const bookingRes: any = await httpClient.post('/bookings', bookingPayload);
      toast.success('Khởi tạo đơn hàng thành công!');

      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId: bookingRes._id,
        purpose: 'DEPOSIT_PAYMENT',
      });

      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        toast.info('Đang chuyển hướng tới cổng thanh toán PayOS Simulator...');
        
        // Clear selected items from cart
        selectedItems.forEach(item => removeFromCart(item.id));
        
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 1500);
      } else {
        throw new Error('Không thể khởi tạo liên kết thanh toán');
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thanh toán thất bại');
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    try {
      // Loop through selected items and save them to backend database
      for (const item of selectedItems) {
        if (item.itemType === 'PRODUCT') {
          if (!isMongoObjectId(item.productId)) {
            throw new Error(`Sản phẩm "${item.name || item.productName || 'trong giỏ hàng'}" không còn hợp lệ. Vui lòng xóa khỏi giỏ và thêm lại từ trang sản phẩm.`);
          }

          const startDate = item.startDate || item.rentalFrom;
          const endDate = item.endDate || item.rentalTo;
          const rentalType = item.rentalType || 'DAILY';

          if (!startDate || (rentalType === 'DAILY' && !endDate)) {
            throw new Error(`Sản phẩm "${item.name || item.productName || 'trong giỏ hàng'}" thiếu ngày thuê. Vui lòng chọn lại lịch thuê.`);
          }

          await httpClient.post('/api/bookings', {
            productId: item.productId,
            rentalType,
            startDate,
            endDate,
            startTime: item.startTime,
            endTime: item.endTime,
            size: item.size || 'M',
            color: item.color || 'RED',
            quantity: item.quantity || 1
          });
        } else if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
          if (!isMongoObjectId(item.photographyPackageId)) {
            throw new Error(`Gói chụp "${item.packageName || 'trong giỏ hàng'}" không còn hợp lệ. Vui lòng xóa khỏi giỏ và thêm lại từ trang nhiếp ảnh gia.`);
          }

          if (!item.shootDate || !item.shootTimeSlot || !item.shootLocation) {
            throw new Error(`Gói chụp "${item.packageName || 'trong giỏ hàng'}" thiếu lịch chụp. Vui lòng chọn lại lịch chụp.`);
          }

          await httpClient.post('/api/bookings/photography', {
            packageId: item.photographyPackageId,
            shootDate: item.shootDate,
            shootTimeSlot: item.shootTimeSlot,
            shootLocation: item.shootLocation,
            concept: item.shootConcept || 'Cổ phục Huế',
            customRequests: item.customRequests || null,
          });
        }
      }
      setShowPaymentModal(false);
      setIsCheckoutSuccess(true);
      // Clear only selected items from the cart
      selectedItems.forEach(item => removeFromCart(item.id));
      toast.success('Thành công! Lịch hẹn của bạn đã được ghi nhận.');
    } catch (err: any) {
      console.error('Lỗi khi lưu đơn đặt lịch:', err);
      toast.error(err.message || 'Không thể lưu đơn đặt lịch lên hệ thống. Vui lòng thử lại!');
    }
  };


  if (isCheckoutSuccess) {
    return (
      <div style={{ backgroundColor: '#FCF9F2', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #EAE1D4', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(39, 174, 96, 0.1)', color: '#27AE60', marginBottom: '24px' }}>
            <CheckCircle size={40} />
          </div>
          <h2 className="font-header" style={{ fontSize: '28px', color: '#8B1E22', marginBottom: '16px' }}>Đặt lịch & Thuê đồ thành công!</h2>
          <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>
            Cảm ơn bạn đã lựa chọn Di sản Áo Dài. Đơn đặt hàng của bạn đã được ghi nhận. Vui lòng kiểm tra email để xem hóa đơn điện tử và chi tiết lịch trình.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link to="/" className="vh-btn vh-btn-outline vh-btn-md" style={{ borderRadius: '10px', borderColor: '#8B1E22', color: '#8B1E22' }}>
              Về Trang Chủ
            </Link>
            <Link to={ROUTES.PHOTOGRAPHERS} className="vh-btn vh-btn-primary vh-btn-md" style={{ borderRadius: '10px', backgroundColor: '#8B1E22', borderColor: '#8B1E22' }}>
              Xem Thợ Chụp Khác
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
                                  <span>Kích cỡ: <strong>{item.size}</strong></span>
                                  <span>Ngày thuê: <strong>{formatDateRange(item.rentalFrom || item.startDate, item.rentalTo || item.endDate)}{item.startTime && item.endTime ? ` (${item.startTime} - ${item.endTime})` : ''}</strong></span>
                                  <span>Nơi nhận: <strong>{item.providerCity || 'Thừa Thiên Huế'}</strong></span>
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

                            {/* Price label */}
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#2D2926', marginTop: '8px' }}>
                              {item.basePrice?.toLocaleString('vi-VN')}đ
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
                    <span>Tổng tiền hàng ({selectedItems.length} mục)</span>
                    <span style={{ color: '#2D2926', fontWeight: 700 }}>
                      {grandTotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5D4037' }}>
                    <span>Phí dịch vụ Heritage</span>
                    <span style={{ color: '#2D2926', fontWeight: 700 }}>
                      {serviceFee.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  {totalProductDeposit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5D4037' }}>
                      <span>Tiền cọc Áo dài</span>
                      <span style={{ color: '#2D2926', fontWeight: 700 }}>
                        {totalProductDeposit.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
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
                </div>

                {/* Nested box for pay later */}
                <div style={{ backgroundColor: '#F5EFE6', padding: '12px 16px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#5D4037' }}>
                  <span>Tiền trả sau cho thợ chụp</span>
                  <strong style={{ color: '#2D2926' }}>{remainingToPayLater.toLocaleString('vi-VN')}đ</strong>
                </div>

                {/* Warning message above checkout button */}
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{ backgroundColor: 'white', maxWidth: '500px', width: '100%', padding: '32px', borderRadius: '16px', border: '1px solid #EAE1D4', boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="font-header" style={{ fontSize: '22px', fontWeight: 700, color: '#8B1E22', marginBottom: '24px', textAlign: 'center' }}>
              Thanh toán đơn hàng
            </h3>

            {/* Payment Method Selector */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <button
                onClick={() => setPaymentMethod('BANK')}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: paymentMethod === 'BANK' ? '2px solid #8B1E22' : '1px solid #EAE1D4',
                  backgroundColor: paymentMethod === 'BANK' ? 'rgba(139, 30, 34, 0.03)' : 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CreditCard size={18} color={paymentMethod === 'BANK' ? '#8B1E22' : '#7E6D5B'} />
                <span>Chuyển khoản QR</span>
              </button>
              <button
                onClick={() => setPaymentMethod('MOMO')}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  border: paymentMethod === 'MOMO' ? '2px solid #8B1E22' : '1px solid #EAE1D4',
                  backgroundColor: paymentMethod === 'MOMO' ? 'rgba(139, 30, 34, 0.03)' : 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#A50064', color: 'white', fontSize: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MoMo</div>
                <span>Ví điện tử MoMo</span>
              </button>
            </div>

            {/* QR Mockup */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backgroundColor: '#FCF9F2', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #EAE1D4' }}>
              <span style={{ fontSize: '13px', color: '#7E6D5B' }}>Mã QR quét thanh toán</span>
              <img
                src={paymentMethod === 'BANK'
                  ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=STB_tiendat5604_VIBEHUE_PAY_${depositToPayNow}`
                  : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Momo_0911122201_VIBEHUE_PAY_${depositToPayNow}`
                }
                alt="QR Code"
                style={{ width: '150px', height: '150px', backgroundColor: 'white', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)' }}
              />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: '#7E6D5B', display: 'block' }}>Số tiền cần chuyển:</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#8B1E22' }}>
                  {depositToPayNow.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="vh-btn vh-btn-outline"
                style={{ flex: 1, borderRadius: '10px', padding: '10px', borderColor: '#EAE1D4', color: '#5D4037' }}
              >
                HỦY
              </button>
              <button
                onClick={handleConfirmPayment}
                className="vh-btn vh-btn-primary"
                style={{ flex: 1, borderRadius: '10px', padding: '10px', backgroundColor: '#8B1E22', borderColor: '#8B1E22' }}
              >
                XÁC NHẬN ĐÃ CHUYỂN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
