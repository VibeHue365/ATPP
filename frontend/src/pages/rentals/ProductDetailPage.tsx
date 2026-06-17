import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, 
  Star, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  ChevronRight,
  Shield,
  Truck,
  RotateCcw,
  Camera,
  User,
  Check
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useToast } from '../../components/feedback/Toast';
import { Modal } from '../../components/common/Modal';
import { ROUTES } from '../../config/routes';

interface ProductDetail {
  _id: string;
  name: string;
  description: string;
  images: string[];
  basePrice: number;
  hourlyPrice?: number | null;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  rating: {
    averageRating: number;
    totalReviews: number;
  };
  providerId: {
    _id: string;
    businessName: string;
  };
}

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery Active Image
  const [activeImage, setActiveImage] = useState<string>('');

  // Selector choices
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  
  // Rental configuration: 'DAILY' | 'HOURLY'
  const [rentalMode, setRentalMode] = useState<'DAILY' | 'HOURLY'>('DAILY');
  
  // Date states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [singleDate, setSingleDate] = useState<string>('');
  
  // Time states (for hourly rental)
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('10:00');

  // Interactive UI modals
  const [isAiStylingOpen, setIsAiStylingOpen] = useState<boolean>(false);
  const [isAiSizeOpen, setIsAiSizeOpen] = useState<boolean>(false);
  const [isComboOpen, setIsComboOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  
  // Created booking information
  const [createdBooking, setCreatedBooking] = useState<any>(null);

  // Description Tabs: 'details' | 'policies' | 'guide'
  const [activeInfoTab, setActiveInfoTab] = useState<'details' | 'policies' | 'guide'>('details');

  // Favorites state
  const [isFav, setIsFav] = useState<boolean>(false);

  // Hours catalog (08:00 to 20:00)
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', 
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await httpClient.get<any>(`/products/${id}`);
        setProduct(data);
        if (data.images && data.images.length > 0) {
          setActiveImage(data.images[0]);
        }
        if (data.colors && data.colors.length > 0) {
          setSelectedColor(data.colors[0]);
        }
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
        // Set default dates
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 3);

        setStartDate(tomorrow.toISOString().split('T')[0]);
        setEndDate(nextDay.toISOString().split('T')[0]);
        setSingleDate(tomorrow.toISOString().split('T')[0]);
      } catch (err: any) {
        console.error('Lỗi lấy chi tiết sản phẩm:', err);
        setError(err.message || 'Không thể lấy thông tin sản phẩm.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  // Handle hourly time validation rules
  useEffect(() => {
    if (rentalMode === 'HOURLY') {
      const startIndex = timeSlots.indexOf(startTime);
      const endIndex = timeSlots.indexOf(endTime);
      
      // Calculate minimum end time index (2 hours difference = 4 slots of 30 minutes)
      const minEndIndex = startIndex + 4;
      
      if (endIndex < minEndIndex && startIndex !== -1) {
        // Automatically set valid end time if currently invalid
        const targetEndIndex = Math.min(minEndIndex, timeSlots.length - 1);
        setEndTime(timeSlots[targetEndIndex]);
      }
    }
  }, [startTime, rentalMode]);

  // Sizing mapping helper
  const translateColorHex = (colorName: string): string => {
    const catalog: Record<string, string> = {
      RED: '#A11E22',
      WHITE: '#FFFFFF',
      GOLD: '#E6C280',
      GREEN: '#2E5A44',
      GREY: '#8E8E93',
      BLACK: '#1A1A1A',
      BLUE: '#2980B9',
      PINK: '#F1948A',
      YELLOW: '#F4D03F',
    };
    return catalog[colorName.toUpperCase()] || '#CCCCCC';
  };

  const getDayDuration = () => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
  };

  const getHourDuration = () => {
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1) return 2;
    return (endIndex - startIndex) * 0.5;
  };

  const getDisplayPrice = (): string => {
    if (!product) return '0đ';
    if (rentalMode === 'DAILY') {
      const days = getDayDuration();
      const priceVal = product.basePrice * days;
      return `${priceVal.toLocaleString('vi-VN')}đ / ${days} ngày`;
    } else {
      const hours = getHourDuration();
      const hourlyRate = product.hourlyPrice || 80000;
      const priceVal = hourlyRate * hours;
      return `${priceVal.toLocaleString('vi-VN')}đ / ${hours} giờ`;
    }
  };

  const getEndTimesOptions = () => {
    const startIndex = timeSlots.indexOf(startTime);
    if (startIndex === -1) return timeSlots;
    // Minimum 2 hours = 4 slots ahead
    return timeSlots.slice(startIndex + 4);
  };

  const handleBookingSubmit = async () => {
    if (!isAuthenticated) {
      toast.info('Bạn cần đăng nhập để đặt thuê sản phẩm.');
      navigate(ROUTES.LOGIN);
      return;
    }

    if (!selectedSize || !selectedColor) {
      toast.error('Vui lòng chọn đầy đủ màu sắc và kích cỡ.');
      return;
    }

    try {
      const bookingPayload = {
        productId: product?._id,
        rentalType: rentalMode,
        startDate: rentalMode === 'DAILY' ? startDate : singleDate,
        endDate: rentalMode === 'DAILY' ? endDate : singleDate,
        startTime: rentalMode === 'HOURLY' ? startTime : undefined,
        endTime: rentalMode === 'HOURLY' ? endTime : undefined,
        size: selectedSize,
        color: selectedColor,
        quantity: 1,
      };

      const res = await httpClient.post<any>('/bookings', bookingPayload);
      setCreatedBooking(res);
      setIsSuccessModalOpen(true);
      toast.success('Tạo đơn thuê áo dài thành công!');
    } catch (err: any) {
      console.error('Lỗi tạo đơn đặt hàng:', err);
      toast.error(err.message || 'Không thể tạo đơn đặt thuê.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', gap: '16px' }}>
        <div className="vh-loading-spinner">
          <div className="vh-loading-double-bounce1"></div>
          <div className="vh-loading-double-bounce2"></div>
        </div>
        <span className="font-header text-stone-600">Đang tải chi tiết áo dài...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center">
        <h3 className="text-2xl font-bold font-header text-stone-800">Đã xảy ra lỗi</h3>
        <p className="text-stone-500 mt-2">{error || 'Không tìm thấy sản phẩm.'}</p>
        <button className="vh-btn vh-btn-primary mt-6" onClick={() => navigate(ROUTES.RENTALS)}>
          QUAY LẠI TRANG CHỦ
        </button>
      </div>
    );
  }

  // Real mock review comments list
  const reviews = [
    {
      id: 'rev1',
      author: 'Nguyễn T. Hương',
      rating: 5,
      date: '10/05/2026',
      content: 'Chất liệu lụa cực kỳ xịn sò, mặc ôm dáng rất tôn đường cong luôn. Áo được giặt thơm tho sạch sẽ trước khi giao. Dịch vụ cọc giải ngân nhanh, rate 5 sao nhe.',
      images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'],
      verified: true
    },
    {
      id: 'rev2',
      author: 'Trần ** Mai',
      rating: 5,
      date: '28/04/2026',
      content: 'Đặt combo chụp ảnh cùng thợ của hệ thống đi Đại Nội rất tuyệt vời! Áo cổ kính chuẩn truyền thống thêu tay tỉ mỉ từng chỉ vàng.',
      images: [],
      verified: true
    }
  ];

  return (
    <div style={{ backgroundColor: '#FCF9F2', minHeight: '100vh', padding: '40px 0' }}>
      <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '0 40px' }}>
        
        {/* BREADCRUMB */}
        <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', color: '#78716c', fontSize: '14px', fontWeight: 500, marginBottom: '32px' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Trang chủ</span>
          <ChevronRight size={14} style={{ color: '#a8a29e' }} />
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/rentals')}>Bộ sưu tập áo dài</span>
          <ChevronRight size={14} style={{ color: '#a8a29e' }} />
          <span style={{ color: '#1c1917', fontWeight: 600 }}>{product.name}</span>
        </nav>

        {/* MAIN SPLIT CONTENT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '60px', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Gallery */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* Thumbnails list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
              {(product.images.length > 0 ? product.images : [
                'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
                'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f',
                'https://images.unsplash.com/photo-1512436991641-6745cdb1723f'
              ]).map((img, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(img)}
                  style={{
                    width: '72px',
                    height: '90px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: activeImage === img ? '2px solid var(--color-primary)' : '1px solid rgba(0,0,0,0.1)',
                    boxShadow: activeImage === img ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0
                  }}
                >
                  <img src={img} alt={`${product.name} thumbnail ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>

            {/* Main Image View */}
            <div style={{ flex: 1, height: '580px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--color-light-border)', position: 'relative', boxShadow: 'var(--shadow-md)' }}>
              <img src={activeImage || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b'} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              
              {/* Premium Badge */}
              <span style={{ position: 'absolute', top: '20px', left: '20px', padding: '6px 14px', borderRadius: '9999px', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
                CHO THUÊ
              </span>

              {/* Heart floating action */}
              <button 
                onClick={() => setIsFav(!isFav)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-md)',
                  cursor: 'pointer',
                  color: isFav ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Details & Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Header info */}
            <div>
              <span className="font-header" style={{ color: 'var(--color-gold)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Hãng: {product.providerId?.businessName || 'Huế Cổ Phục Studio'}
              </span>
              <h1 className="font-header text-4xl text-stone-900 font-bold mt-1 leading-tight">
                {product.name}
              </h1>

              {/* Star rating summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)' }}>
                  {[1, 2, 3, 4, 5].map((starIdx) => (
                    <Star 
                      key={starIdx} 
                      size={14} 
                      fill={starIdx <= Math.round(product.rating.averageRating) ? 'currentColor' : 'none'} 
                      color="currentColor" 
                    />
                  ))}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {product.rating.averageRating.toFixed(1)}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  ({product.rating.totalReviews} đánh giá)
                </span>
              </div>
            </div>

            {/* Price section */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--color-light-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                GIÁ THUÊ TẠM TÍNH
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span className="font-header" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                  {getDisplayPrice()}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={13} className="text-emerald-600" />
                <span>Tiền cọc đảm bảo hoàn trả: <strong>{product.depositAmount.toLocaleString('vi-VN')}đ</strong></span>
              </p>
            </div>

            {/* AI Assistance Widget */}
            <div style={{ border: '1px solid rgba(182, 145, 91, 0.3)', borderRadius: '16px', padding: '20px', backgroundColor: 'rgba(252, 249, 242, 0.7)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-gold-dark)', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={12} /> CÔNG NGHỆ AI HỖ TRỢ
              </span>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                <button 
                  onClick={() => setIsAiStylingOpen(true)}
                  style={{
                    flex: 1,
                    backgroundColor: 'white',
                    border: '1px solid rgba(182, 145, 91, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s ease'
                  }}
                  className="hover:scale-[1.02]"
                >
                  <Sparkles size={18} className="text-amber-500 animate-pulse" />
                  <span className="font-header font-bold text-stone-800" style={{ fontSize: '13px' }}>Thử Đồ Ảo (AI)</span>
                </button>
                <button 
                  onClick={() => setIsAiSizeOpen(true)}
                  style={{
                    flex: 1,
                    backgroundColor: 'white',
                    border: '1px solid rgba(182, 145, 91, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s ease'
                  }}
                  className="hover:scale-[1.02]"
                >
                  <User size={18} className="text-purple-600" />
                  <span className="font-header font-bold text-stone-800" style={{ fontSize: '13px' }}>Gợi Ý Size (AI)</span>
                </button>
              </div>
            </div>

            {/* Colors Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>MÀU SẮC: {selectedColor}</span>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  {product.colors.map((c) => {
                    const isSelected = selectedColor === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        title={c}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: translateColorHex(c),
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(0,0,0,0.15)',
                          boxShadow: isSelected ? '0 0 0 2px white, var(--shadow-sm)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>KÍCH CỠ: {selectedSize}</span>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  {product.sizes.map((s) => {
                    const isSelected = selectedSize === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        style={{
                          padding: '12px 28px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'white',
                          color: isSelected ? 'white' : 'var(--color-text-primary)',
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          minWidth: '56px',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TIME SELECTION WIDGET */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--color-light-border)', overflow: 'hidden' }}>
              
              {/* Switcher Tab */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--color-light-border)', backgroundColor: '#F9F6F0' }}>
                <button
                  onClick={() => setRentalMode('DAILY')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    fontFamily: 'var(--font-header)',
                    fontWeight: 700,
                    fontSize: '14px',
                    border: 'none',
                    backgroundColor: rentalMode === 'DAILY' ? 'white' : 'transparent',
                    color: rentalMode === 'DAILY' ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRight: product?.hourlyPrice ? '1px solid var(--color-light-border)' : 'none',
                  }}
                >
                  Thuê Theo Ngày
                </button>
                {product?.hourlyPrice && (
                  <button
                    onClick={() => setRentalMode('HOURLY')}
                    style={{
                      flex: 1,
                      padding: '16px',
                      fontFamily: 'var(--font-header)',
                      fontWeight: 700,
                      fontSize: '14px',
                      border: 'none',
                      backgroundColor: rentalMode === 'HOURLY' ? 'white' : 'transparent',
                      color: rentalMode === 'HOURLY' ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Thuê Theo Giờ
                  </button>
                )}
              </div>


              {/* Selector Panels */}
              <div style={{ padding: '24px' }}>
                {rentalMode === 'DAILY' ? (
                  /* Daily Selection Grid */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="vh-input-group" style={{ margin: 0 }}>
                        <span className="vh-input-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>NHẬN ĐỒ</span>
                        <div className="vh-input-wrapper">
                          <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                            className="vh-input-field" 
                            style={{ paddingRight: '8px' }}
                          />
                        </div>
                      </div>
                      <div className="vh-input-group" style={{ margin: 0 }}>
                        <span className="vh-input-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>TRẢ ĐỒ</span>
                        <div className="vh-input-wrapper">
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)} 
                            className="vh-input-field" 
                            style={{ paddingRight: '8px' }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Helper text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)', backgroundColor: '#FAF7F0', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(182,145,91,0.15)' }}>
                      <Clock size={14} className="text-amber-600" />
                      <span>Thời gian nhận đồ: <strong>sau 09:00</strong> | Trả đồ: <strong>trước 18:00</strong></span>
                    </div>
                  </div>
                ) : (
                  /* Hourly Selection Grid */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Date Picker */}
                    <div className="vh-input-group" style={{ margin: 0 }}>
                      <span className="vh-input-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>NGÀY THUÊ</span>
                      <div className="vh-input-wrapper">
                        <input 
                          type="date" 
                          value={singleDate} 
                          onChange={(e) => setSingleDate(e.target.value)} 
                          className="vh-input-field" 
                        />
                      </div>
                    </div>

                    {/* Time Selectors Dropdowns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="vh-input-group" style={{ margin: 0 }}>
                        <span className="vh-input-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>GIỜ BẮT ĐẦU</span>
                        <select 
                          value={startTime} 
                          onChange={(e) => setStartTime(e.target.value)}
                          className="vh-select-field"
                        >
                          {timeSlots.slice(0, -4).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="vh-input-group" style={{ margin: 0 }}>
                        <span className="vh-input-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>GIỜ KẾT THÚC</span>
                        <select 
                          value={endTime} 
                          onChange={(e) => setEndTime(e.target.value)}
                          className="vh-select-field"
                        >
                          {getEndTimesOptions().map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Rule indicator */}
                    <span style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                      * Thời gian thuê tối thiểu theo quy định là 2 tiếng. Các khung giờ không hợp lệ sẽ tự động ẩn đi.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION ACTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button 
                onClick={handleBookingSubmit}
                className="vh-btn vh-btn-primary vh-btn-lg" 
                style={{ width: '100%', borderRadius: '12px', fontSize: '16px', height: '54px', fontWeight: 700 }}
              >
                <span>THUÊ NGAY</span>
                <ArrowRight size={18} />
              </button>

              {/* COMBO BANNER */}
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#2D2926',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Camera size={18} className="text-amber-400" />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>ĐẶT KÈM THỢ CHỤP (COMBO)</span>
                </div>
                <button 
                  onClick={() => setIsComboOpen(true)}
                  className="vh-btn vh-btn-secondary font-header font-bold" 
                  style={{ borderRadius: '6px', fontSize: '11px', padding: '6px 14px', border: 'none' }}
                >
                  CHI TIẾT
                </button>
              </div>
            </div>

            {/* Micro value bullets */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-light-border)', paddingTop: '20px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={14} className="text-stone-500" /> Vận chuyển tận nơi
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RotateCcw size={14} className="text-stone-500" /> Hỗ trợ đổi trả
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={14} className="text-stone-500" /> Bảo mật thanh toán
              </span>
            </div>

          </div>
        </div>

        {/* BOTTOM: Description Tabs */}
        <section style={{ marginTop: '80px', borderTop: '1px solid var(--color-light-border)', paddingTop: '40px' }}>
          {/* Tab buttons */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-light-border)', gap: '40px', marginBottom: '24px', overflowX: 'auto' }}>
            <button
              onClick={() => setActiveInfoTab('details')}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-header)',
                fontSize: '16px',
                fontWeight: 700,
                paddingBottom: '16px',
                borderBottom: activeInfoTab === 'details' ? '2px solid var(--color-primary)' : 'none',
                color: activeInfoTab === 'details' ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              CHI TIẾT SẢN PHẨM
            </button>
            <button
              onClick={() => setActiveInfoTab('policies')}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-header)',
                fontSize: '16px',
                fontWeight: 700,
                paddingBottom: '16px',
                borderBottom: activeInfoTab === 'policies' ? '2px solid var(--color-primary)' : 'none',
                color: activeInfoTab === 'policies' ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              QUY ĐỊNH THUÊ
            </button>
            <button
              onClick={() => setActiveInfoTab('guide')}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-header)',
                fontSize: '16px',
                fontWeight: 700,
                paddingBottom: '16px',
                borderBottom: activeInfoTab === 'guide' ? '2px solid var(--color-primary)' : 'none',
                color: activeInfoTab === 'guide' ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              HƯỚNG DẪN SỬ DỤNG
            </button>
          </div>

          {/* Tab content */}
          <div style={{ minHeight: '120px', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            {activeInfoTab === 'details' && (
              <div className="animate-fade-in">
                <p>{product.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}</p>
                <ul style={{ listStyleType: 'disc', marginLeft: '20px', marginTop: '12px' }}>
                  <li>Chất liệu chính: {product.materials?.join(', ') || 'Lụa Hà Đông'}</li>
                  <li>Kích thước hỗ trợ: {product.sizes?.join(', ') || 'S, M, L'}</li>
                  <li>Thích hợp chụp ngoại cảnh Đại Nội Huế, Chùa Thiên Mụ, và lăng tẩm hoàng cung.</li>
                </ul>
              </div>
            )}
            
            {activeInfoTab === 'policies' && (
              <div className="animate-fade-in">
                <p>1. Tiền đặt cọc sẽ được hoàn lại 100% sau khi cửa hàng nhận lại sản phẩm và xác nhận không có hư hại nghiêm trọng (rách, cháy, phai màu loang lổ).</p>
                <p>2. Khách thuê có trách nhiệm bảo quản trang phục sạch sẽ. Vết bẩn nhẹ có thể giặt sạch không bị tính phí. Hư hại nặng đền bù theo thỏa thuận.</p>
                <p>3. Trả đồ quá hạn ngày phạt 100.000đ / ngày đối với hình thức thuê ngày.</p>
              </div>
            )}

            {activeInfoTab === 'guide' && (
              <div className="animate-fade-in">
                <p>1. Không được tự ý là/ủi trang phục ở nhiệt độ cao. Chỉ sử dụng bàn là hơi nước ở nhiệt độ thích hợp cho lụa và gấm.</p>
                <p>2. Tránh để trang phục tiếp xúc với các vật nhọn, trang sức gai góc có thể làm xước tơ lụa.</p>
                <p>3. Khi di chuyển chụp ảnh ngoài trời, hãy nâng nhẹ tà áo để tránh kéo lê trên bùn đất hoặc đá nhọn.</p>
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM: Photographers recommended list */}
        <section style={{ marginTop: '80px' }}>
          <div style={{ marginBottom: '40px', textAlign: 'left', maxWidth: '100%', margin: '0 0 40px 0', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
            <span className="vh-section-badge" style={{ display: 'inline-block', marginBottom: '12px' }}>Nhiếp Ảnh Gia Gợi Ý</span>
            <h2 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-header)', color: '#1c1917', marginTop: '4px' }}>Hoàn thiện trải nghiệm với các gói chụp ảnh chuyên nghiệp</h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              { id: 'p1', name: 'Tran Studio', rating: 4.9, count: 142, desc: 'Chuyên phong cách thơ mộng, ánh sáng tự nhiên. Concept Mộng Thơ sẽ phù hợp với thiết kế này.', price: '1.500.000đ', image: '/hoang_minh.png' },
              { id: 'p2', name: 'Linh Photography', rating: 5.0, count: 96, desc: 'Phong cách hoài cổ, Vintage tôn nét ảnh đậm chất di sản Việt Nam truyền thống và uy nghiêm.', price: '2.000.000đ', image: '/le_thao.png' },
              { id: 'p3', name: 'Khoa Visuals', rating: 4.8, count: 75, desc: 'Chuyên chụp beauty và chân dung ngoại cảnh, tạo cho bạn bức ảnh thần thái đạt chất lượng cao.', price: '2.500.000đ', image: '/tran_bao.png' }
            ].map((photographer) => (
              <div key={photographer.id} className="vh-premium-card" style={{ padding: '20px', backgroundColor: 'white', border: '1px solid var(--color-light-border)' }}>
                <div className="vh-card-image-wrapper" style={{ height: '240px' }}>
                  <img src={photographer.image} alt={photographer.name} className="vh-card-image" />
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.95)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    <Star size={11} className="fill-amber-400 stroke-amber-400" />
                    <span>{photographer.rating}</span>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>({photographer.count})</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <h4 className="font-header font-bold text-stone-900" style={{ fontSize: '18px' }}>{photographer.name}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>{photographer.desc}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-light-border)' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Gói chụp từ</span>
                      <strong className="font-header" style={{ fontSize: '18px', color: 'var(--color-primary-dark)' }}>{photographer.price}</strong>
                    </div>
                    <button 
                      onClick={() => { toast.success(`Đã thêm lịch hẹn chụp với ${photographer.name} vào hàng đợi!`); }}
                      className="vh-btn vh-btn-outline vh-btn-sm" 
                      style={{ borderRadius: '6px' }}
                    >
                      Đặt ngay
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM: Review stats diary */}
        <section style={{ marginTop: '80px', borderTop: '1px solid var(--color-light-border)', paddingTop: '60px' }}>
          <div style={{ marginBottom: '40px', textAlign: 'left', maxWidth: '100%', margin: '0 0 40px 0', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
            <span className="vh-section-badge" style={{ display: 'inline-block', marginBottom: '12px' }}>Nhật Ký Áo Dài</span>
            <h2 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-header)', color: '#1c1917', marginTop: '4px' }}>Khách hàng tỏa sáng trong tà áo Di Sản</h2>
          </div>

          {/* Rating overview grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 240px', gap: '48px', alignItems: 'center', backgroundColor: 'white', borderRadius: '16px', padding: '40px', border: '1px solid var(--color-light-border)', marginBottom: '40px' }}>
            {/* Average rating */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span className="font-header" style={{ fontSize: '56px', fontWeight: 800, color: 'var(--color-text-primary)' }}>4.8</span>
              <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)' }}>
                {[1, 2, 3, 4, 5].map((starIdx) => (
                  <Star key={starIdx} size={18} fill="currentColor" color="currentColor" />
                ))}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>120 đánh giá thực tế</span>
            </div>

            {/* Bars summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { stars: '5 sao', percent: '80%' },
                { stars: '4 sao', percent: '15%' },
                { stars: '3 sao', percent: '3%' },
                { stars: '2 sao', percent: '1%' },
                { stars: '1 sao', percent: '1%' }
              ].map((row, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  <span style={{ width: '40px', textAlign: 'right' }}>{row.stars}</span>
                  <div style={{ flex: 1, height: '6px', backgroundColor: '#F0EBE0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: row.percent, height: '100%', backgroundColor: 'var(--color-gold)', borderRadius: '3px' }} />
                  </div>
                  <span style={{ width: '32px' }}>{row.percent}</span>
                </div>
              ))}
            </div>

            {/* Action write button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={() => { toast.info('Tính năng viết đánh giá sẽ mở sau khi bạn hoàn tất một đơn hàng.'); }}
                className="vh-btn vh-btn-inverted font-header" 
                style={{ borderRadius: '8px', padding: '12px 24px', fontSize: '14px' }}
              >
                VIẾT ĐÁNH GIÁ
              </button>
            </div>
          </div>

          {/* Rating filter tools */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', fontWeight: 700 }}>
              <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Mới nhất</span>
              <span style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Đánh giá cao nhất</span>
              <span style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Đánh giá thấp nhất</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" style={{ accentColor: 'var(--color-primary)' }} />
              <span>Có ảnh/video</span>
            </label>
          </div>

          {/* Reviews list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {reviews.map((rev) => (
              <div key={rev.id} style={{ borderBottom: '1px solid var(--color-light-border)', paddingBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#EADFC9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-primary-dark)', fontSize: '14px' }}>
                      {rev.author.charAt(0)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{rev.author}</strong>
                        {rev.verified && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                            <Check size={10} /> ĐÃ THUÊ
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '2px', color: 'var(--color-gold)', marginTop: '4px' }}>
                        {Array.from({ length: rev.rating }).map((_, sIdx) => (
                          <Star key={sIdx} size={11} fill="currentColor" color="currentColor" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{rev.date}</span>
                </div>
                
                <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', marginTop: '16px', lineHeight: 1.7 }}>{rev.content}</p>
                
                {rev.images && rev.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    {rev.images.map((imgUrl, idx) => (
                      <div key={idx} style={{ width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                        <img src={imgUrl} alt="review media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* -------------------- INTERACTIVE MODALS -------------------- */}

      {/* 1. AI Virtual Try-On Modal */}
      <Modal isOpen={isAiStylingOpen} onClose={() => setIsAiStylingOpen(false)} title="Trải nghiệm Phòng Thử Đồ ẢO (AI Virtual Try-On)" maxWidth="640px">
        <div style={{ padding: '10px 0', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-primary-trans)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Sparkles size={36} className="animate-bounce" />
          </div>
          <h3 className="font-header text-xl font-bold text-stone-900 mb-2">Đang khởi tạo công nghệ AI Virtual Try-On</h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 24px' }}>
            Hệ thống đang đồng bộ chỉ số cơ thể từ trang cá nhân của bạn để dựng mô phỏng 3D chính xác tà áo **{product.name}** trên dáng người của bạn.
          </p>
          
          <div style={{ border: '1px solid rgba(182, 145, 91, 0.2)', padding: '16px', borderRadius: '12px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', maxWidth: '400px', margin: '0 auto 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Chiều cao ước tính:</span>
              <strong>165 cm</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Cân nặng ước tính:</span>
              <strong>52 kg</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Dáng người phân tích:</span>
              <strong>Đồng hồ cát (Hourglass)</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="vh-btn vh-btn-secondary" style={{ padding: '8px 24px', borderRadius: '8px' }} onClick={() => { toast.success('Mô phỏng 3D hoàn tất!'); setIsAiStylingOpen(false); }}>
              BẮT ĐẦU XEM MÔ PHỎNG
            </button>
            <button className="vh-btn vh-btn-outline" style={{ padding: '8px 24px', borderRadius: '8px' }} onClick={() => setIsAiStylingOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. AI Size Suggestion Modal */}
      <Modal isOpen={isAiSizeOpen} onClose={() => setIsAiSizeOpen(false)} title="Gợi ý Size Thông Minh bởi AI" maxWidth="500px">
        <div style={{ padding: '10px 0' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            Dựa trên thông số chiều cao và cân nặng trong hồ sơ cá nhân của bạn, AI của Silk & Stone gợi ý:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white', border: '1px solid var(--color-light-border)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Size đề xuất tối ưu:</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)', fontFamily: 'var(--font-header)' }}>SIZE M</span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--color-light-border)' }} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              * Tỷ lệ vừa vặn chính xác lên đến 95%. Lụa Hà Đông có độ co giãn nhẹ ở ngực giúp bạn di chuyển thoải mái.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              className="vh-btn vh-btn-primary" 
              style={{ padding: '8px 24px', borderRadius: '8px' }} 
              onClick={() => { setSelectedSize('M'); toast.success('Đã áp dụng đề xuất Size M!'); setIsAiSizeOpen(false); }}
            >
              ÁP DỤNG SIZE M
            </button>
            <button className="vh-btn vh-btn-outline" style={{ padding: '8px 24px', borderRadius: '8px' }} onClick={() => setIsAiSizeOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Combo Details Modal */}
      <Modal isOpen={isComboOpen} onClose={() => setIsComboOpen(false)} title="Chi tiết gói Combo Tiết kiệm" maxWidth="550px">
        <div style={{ padding: '10px 0' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            Nhận ngay ưu đãi **giảm giá 10%** tổng giá trị hóa đơn khi bạn lựa chọn kết hợp thuê tà áo dài **{product.name}** cùng bất cứ nhiếp ảnh gia tiêu biểu nào của hệ thống.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'white', border: '1px solid var(--color-light-border)', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px' }}>
            <div>✔️ Giảm ngay 10% phí thuê áo dài</div>
            <div>✔️ Giảm ngay 10% phí book thợ chụp ảnh ngoại cảnh</div>
            <div>✔️ Tự động đồng bộ hóa lịch thử đồ & lịch đi chụp</div>
            <div>✔️ Hỗ trợ hợp đồng bảo hiểm di sản combo trọn gói</div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              className="vh-btn vh-btn-primary" 
              style={{ padding: '8px 24px', borderRadius: '8px' }} 
              onClick={() => { setIsComboOpen(false); toast.success('Đã kích hoạt ưu đãi giảm giá Combo!'); }}
            >
              KÍCH HOẠT COMBO
            </button>
            <button className="vh-btn vh-btn-outline" style={{ padding: '8px 24px', borderRadius: '8px' }} onClick={() => setIsComboOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Success Booking Info Modal */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title="🎉 Đặt Thuê Thành Công" maxWidth="520px">
        {createdBooking && (
          <div style={{ padding: '10px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Check size={28} />
              </div>
              <h4 className="font-header font-bold text-stone-900" style={{ fontSize: '20px' }}>Đơn hàng {createdBooking.bookingCode} đã sẵn sàng</h4>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Vui lòng thanh toán cọc để giữ chỗ cho trang phục của bạn.
              </p>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Mẫu áo dài:</span>
                <strong className="text-stone-900">{product.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tùy chọn:</span>
                <strong className="text-stone-900">Màu {selectedColor} • Size {selectedSize}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Hình thức thuê:</span>
                <strong className="text-stone-900">{rentalMode === 'DAILY' ? 'Thuê theo ngày' : 'Thuê theo giờ'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Thời gian thuê:</span>
                <strong className="text-stone-900">
                  {rentalMode === 'DAILY' 
                    ? `${startDate} đến ${endDate} (${getDayDuration()} ngày)` 
                    : `${singleDate} từ ${startTime} đến ${endTime} (${getHourDuration()} giờ)`}
                </strong>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--color-light-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Phí thuê trang phục:</span>
                <strong className="text-stone-900">{createdBooking.pricingSummary?.subTotal?.toLocaleString('vi-VN')} đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tiền đặt cọc (Refundable):</span>
                <strong className="text-stone-900">{createdBooking.pricingSummary?.depositTotal?.toLocaleString('vi-VN')} đ</strong>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--color-light-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Tổng cộng thanh toán:</span>
                <strong style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>{createdBooking.pricingSummary?.grandTotal?.toLocaleString('vi-VN')} đ</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="vh-btn vh-btn-primary" 
                style={{ padding: '10px 24px', borderRadius: '8px' }} 
                onClick={() => { setIsSuccessModalOpen(false); navigate(`/dashboard/profile?tab=rentals`); }}
              >
                XEM ĐƠN HÀNG CỦA TÔI
              </button>
              <button className="vh-btn vh-btn-outline" style={{ padding: '10px 24px', borderRadius: '8px' }} onClick={() => setIsSuccessModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default ProductDetailPage;
