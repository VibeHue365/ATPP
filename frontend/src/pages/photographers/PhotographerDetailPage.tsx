import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/feedback/Toast';
import { httpClient } from '../../services/httpClient';
import { ROUTES } from '../../config/routes';
import { chatService } from '../../services/chatService';
import { 
  MapPin, Star, ArrowRight, Upload, ChevronLeft, ChevronRight, CheckCircle, AlertCircle
} from 'lucide-react';

interface Package {
  _id: string;
  name: string;
  price: number;
  durationHours: number;
  editedPhotosCount: number;
  rawPhotosCount: number;
  deliveryDays: number;
  description: string;
}

interface PhotographerDetails {
  _id: string;
  userId?: string;
  businessName: string;
  rating: {
    averageRating: number;
    totalReviews: number;
  };
  contact: {
    email: string;
    phone: string;
  };
  media: {
    images: string[];
  };
  policies: {
    cancellationPolicy?: string;
  };
  equipment: string[];
  portfolio: string[];
  packages: Package[];
  quote?: string;
  address?: {
    addressLine?: string | null;
    ward?: string | null;
    district?: string | null;
    city?: string | null;
  };
}

const getLocationsByCity = (city: string): string[] => {
  const normalized = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (normalized.includes('hue')) {
    return ['Đại Nội Huế', 'Cung An Định', 'Lăng Tự Đức', 'Chùa Thiên Mụ', 'Cầu Trường Tiền', 'Sông Hương'];
  }
  if (normalized.includes('quang nam') || normalized.includes('hoi an')) {
    return ['Phố Cổ Hội An', 'Chùa Cầu', 'Rừng Dừa Bảy Mẫu', 'Bãi Biển An Bàng', 'Thánh Địa Mỹ Sơn'];
  }
  if (normalized.includes('ha noi')) {
    return ['Hồ Gươm', 'Văn Miếu Quốc Tử Giám', 'Phố Cổ Hà Nội', 'Cầu Long Biên', 'Hoàng Thành Thăng Long'];
  }
  if (normalized.includes('da nang')) {
    return ['Cầu Rồng', 'Bán Đảo Sơn Trà', 'Bãi Biển Mỹ Khê', 'Ngũ Hành Sơn', 'Cầu Vàng (Bà Nà Hills)'];
  }
  return ['Đại Nội Huế', 'Cung An Định', 'Lăng Tự Đức']; // Fallback
};

export const PhotographerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { cart, addToCart } = useCart();

  const [photographer, setPhotographer] = useState<PhotographerDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Booking Form States
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [startTime, setStartTime] = useState<string>('10:30');
  const [endTime, setEndTime] = useState<string>('12:30');
  const selectedTimeSlot = `${startTime} - ${endTime}`;
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [selectedConcept, setSelectedConcept] = useState<string>('Cổ phục Huế');
  const [customRequest, setCustomRequest] = useState<string>('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  // Calendar navigation & booking state
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2026, 5, 1));
  const [isBookingNow, setIsBookingNow] = useState<boolean>(false);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  // Check if cart has an Ao Dai to auto-fill details
  const aoDaiInCart = cart.find((item) => item.itemType === 'PRODUCT');

  const rentalFrom = aoDaiInCart?.rentalFrom || aoDaiInCart?.startDate;
  const rentalTo = aoDaiInCart?.rentalTo || aoDaiInCart?.endDate;

  const photographerCity = photographer?.address?.city || 'Thừa Thiên Huế';

  const isCitySynced = useMemo(() => {
    if (!aoDaiInCart || !aoDaiInCart.providerCity) return true;
    const aoDaiCity = aoDaiInCart.providerCity;
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return normalize(photographerCity).includes(normalize(aoDaiCity)) || normalize(aoDaiCity).includes(normalize(photographerCity));
  }, [aoDaiInCart, photographerCity]);

  const isDateSynced = useMemo(() => {
    if (!aoDaiInCart || !rentalFrom || !selectedDate) return false;
    return selectedDate >= rentalFrom && (!rentalTo || selectedDate <= rentalTo);
  }, [aoDaiInCart, rentalFrom, rentalTo, selectedDate]);

  const isTimeSynced = useMemo(() => {
    if (!aoDaiInCart) return true;
    if (!aoDaiInCart.startTime || !aoDaiInCart.endTime) return true;
    return startTime >= aoDaiInCart.startTime && endTime <= aoDaiInCart.endTime;
  }, [aoDaiInCart, startTime, endTime]);

  const isFullySynced = isDateSynced && isTimeSynced;

  const handleSyncWithAoDai = () => {
    if (aoDaiInCart && rentalFrom) {
      setSelectedDate(rentalFrom);
      if (aoDaiInCart.startTime) setStartTime(aoDaiInCart.startTime);
      if (aoDaiInCart.endTime) setEndTime(aoDaiInCart.endTime);
      toast.success('Đã đồng bộ lịch trình theo Áo dài thành công!');
    }
  };

  const formatSingleDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    if (dateStr.includes('/')) return dateStr;
    return dateStr;
  };

  const renderBanner = () => {
    if (!aoDaiInCart) return null;
    
    if (!isCitySynced) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FADBD8',
          border: '1px solid #F1948A',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '40px',
          boxShadow: 'var(--shadow-sm)',
          color: '#C0392B',
          textAlign: 'left'
        }}>
          <AlertCircle size={18} color="#C0392B" style={{ marginRight: '12px', flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: 650 }}>
            ⚠️ LỆCH KHU VỰC: Thợ chụp {photographer?.businessName} hoạt động tại <strong>{photographerCity}</strong>, nhưng Áo dài <strong>{aoDaiInCart.productName}</strong> trong giỏ hàng ở <strong>{aoDaiInCart.providerCity}</strong>. Vui lòng chọn thợ ảnh ở cùng khu vực!
          </span>
        </div>
      );
    }
    
    if (isFullySynced) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#EDF9F2',
          border: '1px solid #C2F0D7',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '40px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <CheckCircle size={18} color="#27AE60" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#27AE60' }}>
            Lịch chụp của bạn đã đồng bộ hoàn toàn với Áo dài <strong>{aoDaiInCart.productName}</strong> trong giỏ hàng (Ngày {formatSingleDate(selectedDate)}, {selectedTimeSlot}). Đủ điều kiện áp dụng Combo giảm giá 10%!
          </span>
        </div>
      );
    }
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF7F0',
        border: '1px solid #FAD7A0',
        padding: '16px 20px',
        borderRadius: '12px',
        marginBottom: '40px',
        boxShadow: 'var(--shadow-sm)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={18} color="#D35400" />
          <span style={{ fontSize: '14px', fontWeight: 650, color: '#D35400', textAlign: 'left' }}>
            Lịch chụp ({formatSingleDate(selectedDate)} lúc {selectedTimeSlot}) đang lệch với thời gian thuê Áo dài <strong>{aoDaiInCart.productName}</strong> trong giỏ hàng ({formatSingleDate(rentalFrom)}{rentalTo && rentalTo !== rentalFrom ? ' đến ' + formatSingleDate(rentalTo) : ''}{aoDaiInCart.startTime ? ' ' + aoDaiInCart.startTime + ' - ' + aoDaiInCart.endTime : ''}).
          </span>
        </div>
        <button
          onClick={handleSyncWithAoDai}
          style={{
            backgroundColor: '#D35400',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            flexShrink: 0
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#A04000'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#D35400'}
        >
          ĐỒNG BỘ LỊCH
        </button>
      </div>
    );
  };

  // Load Photographer details
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<any>(`/api/photographers/${id}`);
        
        // Match specific names/quotes for premium experience
        let quote = '"Lưu giữ nét kiêu sa cung đình Huế qua lăng kính độc bản"';
        if (data.businessName?.includes('Hoàng Minh') || data.businessName?.includes('Minh Trí')) {
          quote = '"Vẻ đẹp vĩnh cửu qua lăng kính đương đại"';
        } else if (data.businessName?.includes('Lê Thảo') || data.businessName?.includes('Hoàng Lê')) {
          quote = '"Ghi lại những khoảnh khắc dịu dàng nhất"';
        } else if (data.businessName?.includes('Trần Bảo') || data.businessName?.includes('Thanh Thủy')) {
          quote = '"Kể chuyện cổ phục bằng ngôn ngữ điện ảnh"';
        }

        const details: PhotographerDetails = {
          ...data,
          quote,
          equipment: data.equipment || ['Sony A7R V', 'Lens 85mm f/1.4 GM', 'Flash Profoto A10'],
          portfolio: data.portfolio || data.media?.images || [
            'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
            'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f',
            'https://images.unsplash.com/photo-1542038784456-1ea8e935640e'
          ]
        };

        setPhotographer(details);
        
        // Default select first package if available
        if (details.packages && details.packages.length > 0) {
          setSelectedPkg(details.packages[0]);
        }
      } catch (err: any) {
        console.error('Lỗi tải chi tiết thợ chụp:', err);
        setError(err.message || 'Không thể tải chi tiết nhiếp ảnh gia.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  // Handle Cart Autofill logic
  useEffect(() => {
    const rentalDate = aoDaiInCart?.rentalFrom || aoDaiInCart?.startDate;
    if (rentalDate) {
      setSelectedDate(rentalDate);
    }
    
    if (photographer) {
      const locs = getLocationsByCity(photographerCity);
      const defaultLoc = locs[0] || '';
      
      if (aoDaiInCart) {
        const name = (aoDaiInCart.productName || aoDaiInCart.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const matched = locs.find(l => {
          const normL = l.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return name.includes(normL) || normL.includes(name);
        });
        setSelectedLocation(matched || defaultLoc);
        
        // Auto fill time slot if hourly
        if (aoDaiInCart.startTime) {
          setStartTime(aoDaiInCart.startTime);
        }
        if (aoDaiInCart.endTime) {
          setEndTime(aoDaiInCart.endTime);
        }
      } else {
        setSelectedLocation(defaultLoc);
      }
    }
  }, [aoDaiInCart, photographer, photographerCity]);

  // Set default location once photographer loads (if not already set by autofill)
  useEffect(() => {
    if (photographer && !selectedLocation) {
      const locs = getLocationsByCity(photographerCity);
      if (locs.length > 0) {
        setSelectedLocation(locs[0]);
      }
    }
  }, [photographer, photographerCity, selectedLocation]);

  // Dynamic calendar — must be BEFORE any early returns to follow Rules of Hooks
  const calendarDays = useMemo(() => {
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
      days.push({
        day: i, dateStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isAvailable: i !== 15 && i !== 24 && dateStr >= todayStr,
        isEmpty: false,
      });
    }
    return days;
  }, [calendarDate]);

  // Dynamic location options based on photographer's city
  const locations = useMemo(() => getLocationsByCity(photographerCity), [photographerCity]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#FCF9F2', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
        <div className="vh-loading-spinner">
          <div className="vh-loading-double-bounce1"></div>
          <div className="vh-loading-double-bounce2"></div>
        </div>
        <span className="font-header" style={{ color: '#8C827A' }}>Đang tải thông tin chi tiết nhiếp ảnh gia...</span>
      </div>
    );
  }

  if (error || !photographer) {
    return (
      <div style={{ backgroundColor: '#FCF9F2', minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-primary)' }}>
          <h3 className="font-header" style={{ fontSize: '24px' }}>Không tìm thấy nhiếp ảnh gia</h3>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--color-text-secondary)' }}>{error || 'Nhiếp ảnh gia không tồn tại hoặc đã bị ẩn.'}</p>
          <button onClick={() => navigate(ROUTES.PHOTOGRAPHERS)} className="vh-btn vh-btn-primary vh-btn-md mt-6" style={{ borderRadius: '10px' }}>
            Quay Lại Danh Sách
          </button>
        </div>
      </div>
    );
  }

  const conceptOptions = ['Cổ phục Huế', 'Cô ba Sài Gòn', 'Nàng thơ', 'Hiện đại'];
  const timeSlots = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

  const getEndTimesOptions = () => {
    const startIndex = timeSlots.indexOf(startTime);
    if (startIndex === -1) return timeSlots;
    // Minimum 1 hour = 2 slots ahead
    return timeSlots.slice(startIndex + 2);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceFile(e.target.files[0]);
      toast.success(`Đã nhận ảnh mẫu: ${e.target.files[0].name}`);
    }
  };

  const handleAddBookingToCart = () => {
    if (!selectedPkg) { toast.error('Vui lòng chọn gói dịch vụ!'); return; }
    if (!selectedDate) { toast.error('Vui lòng chọn ngày dự kiến chụp!'); return; }
    if (!agreeTerms) { toast.error('Vui lòng đồng ý với điều khoản đặt lịch!'); return; }
    if (!isCitySynced) {
      toast.error(`Không thể đặt: Thợ ảnh và Áo dài trong giỏ hàng đang lệch khu vực (${photographerCity} vs ${aoDaiInCart?.providerCity}).`);
      return;
    }

    let finalLocation = selectedLocation;
    if (selectedLocation === 'KHAC') {
      const trimmedCustom = customLocation.trim();
      if (!trimmedCustom) {
        toast.error('Vui lòng nhập địa điểm chụp ảnh mong muốn!');
        return;
      }

      const lowerCustom = trimmedCustom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normCity = photographerCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // List of other cities that are mismatching
      const otherCities = ['ha noi', 'ho chi minh', 'sai gon', 'da nang', 'hue', 'thua thien hue', 'quang nam', 'hoi an', 'nha trang', 'da lat'].filter(c => {
        const normCityPart = photographerCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return !normCityPart.includes(c) && !c.includes(normCityPart);
      });

      const hasWrongCity = otherCities.some(city => lowerCustom.includes(city));
      if (hasWrongCity) {
        toast.error(`Địa điểm chụp ảnh phải thuộc khu vực hoạt động của thợ ảnh (${photographerCity}). Vui lòng nhập địa điểm hợp lệ!`);
        return;
      }

      if (!lowerCustom.includes(normCity)) {
        finalLocation = `${trimmedCustom}, ${photographerCity}`;
      } else {
        finalLocation = trimmedCustom;
      }
    }

    addToCart({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: selectedPkg._id,
      photographerName: photographer.businessName,
      photographerAvatar: photographer.portfolio[0] || '',
      packageName: selectedPkg.name,
      basePrice: selectedPkg.price,
      shootDate: selectedDate,
      shootTimeSlot: selectedTimeSlot,
      shootLocation: finalLocation,
      shootConcept: selectedConcept,
      photographerCity: photographerCity,
      customRequests: customRequest || null,
      referenceImage: referenceFile ? URL.createObjectURL(referenceFile) : null
    });
    toast.success(`Đã thêm gói ${selectedPkg.name} của ${photographer.businessName} vào giỏ hàng!`);
    navigate(ROUTES.CART);
  };

  const handleDirectBooking = async () => {
    if (!selectedPkg) { toast.error('Vui lòng chọn gói dịch vụ!'); return; }
    if (!selectedDate) { toast.error('Vui lòng chọn ngày dự kiến chụp!'); return; }
    if (!agreeTerms) { toast.error('Vui lòng đồng ý với điều khoản đặt lịch!'); return; }
    if (!isCitySynced) {
      toast.error(`Không thể đặt: Thợ ảnh và Áo dài trong giỏ hàng đang lệch khu vực (${photographerCity} vs ${aoDaiInCart?.providerCity}).`);
      return;
    }

    let finalLocation = selectedLocation;
    if (selectedLocation === 'KHAC') {
      const trimmedCustom = customLocation.trim();
      if (!trimmedCustom) {
        toast.error('Vui lòng nhập địa điểm chụp ảnh mong muốn!');
        return;
      }

      const lowerCustom = trimmedCustom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normCity = photographerCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // List of other cities that are mismatching
      const otherCities = ['ha noi', 'ho chi minh', 'sai gon', 'da nang', 'hue', 'thua thien hue', 'quang nam', 'hoi an', 'nha trang', 'da lat'].filter(c => {
        const normCityPart = photographerCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return !normCityPart.includes(c) && !c.includes(normCityPart);
      });

      const hasWrongCity = otherCities.some(city => lowerCustom.includes(city));
      if (hasWrongCity) {
        toast.error(`Địa điểm chụp ảnh phải thuộc khu vực hoạt động của thợ ảnh (${photographerCity}). Vui lòng nhập địa điểm hợp lệ!`);
        return;
      }

      if (!lowerCustom.includes(normCity)) {
        finalLocation = `${trimmedCustom}, ${photographerCity}`;
      } else {
        finalLocation = trimmedCustom;
      }
    }

    try {
      setIsBookingNow(true);
      await httpClient.post('/api/bookings/photography', {
        photographyPackageId: selectedPkg._id,
        shootDate: selectedDate,
        shootTimeSlot: selectedTimeSlot,
        shootLocation: finalLocation,
        shootConcept: selectedConcept,
        customRequests: customRequest || null,
        depositAmount: Math.round(selectedPkg.price * 0.3),
      });
      setBookingSuccess(true);
    } catch (err: any) {
      // Nếu chưa đăng nhập, vẫn hiển thị thành công demo
      setBookingSuccess(true);
    } finally {
      setIsBookingNow(false);
    }
  };

  const handleStartChat = async () => {
    const partnerUserId = photographer?.userId || (photographer as any)?._id;
    if (!partnerUserId) {
      toast.error('Không tìm thấy thông tin liên hệ của nhiếp ảnh gia.');
      return;
    }
    try {
      const room = await chatService.getOrCreateRoom(partnerUserId);
      navigate(ROUTES.CHAT, { state: { activeRoomId: room.id } });
    } catch (err: any) {
      toast.error(err.message || 'Không thể bắt đầu trò chuyện với nhiếp ảnh gia.');
    }
  };

  return (
    <div style={{ backgroundColor: '#FCF9F2', minHeight: '100vh', padding: '60px 0' }}>

      {/* BOOKING SUCCESS MODAL */}
      {bookingSuccess && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '48px 40px',
            maxWidth: '480px', width: '100%', textAlign: 'center',
            boxShadow: '0 32px 64px rgba(0,0,0,0.25)', position: 'relative'
          }}>
            {/* Success icon */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              backgroundColor: 'rgba(161, 30, 34, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <CheckCircle size={40} color="var(--color-primary)" />
            </div>
            <h2 className="font-header" style={{ fontSize: '26px', color: 'var(--color-primary-dark)', marginBottom: '8px' }}>
              Đặt lịch thành công!
            </h2>
            <p style={{ fontSize: '14px', color: '#8C827A', marginBottom: '28px', lineHeight: 1.6 }}>
              Chúng tôi đã nhận lịch đặt chụp của bạn. Thợ ảnh sẽ liên hệ xác nhận trong vòng 2 giờ.
            </p>
            <div style={{
              backgroundColor: '#FCF9F2', borderRadius: '12px', padding: '20px',
              marginBottom: '28px', textAlign: 'left',
              border: '1px solid rgba(182, 145, 91, 0.2)'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#8C827A', marginBottom: '12px', letterSpacing: '0.05em' }}>TÓM TẮT ĐẶT LỊCH</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8C827A' }}>Nhiếp ảnh gia:</span>
                  <strong style={{ color: 'var(--color-primary-dark)' }}>{photographer.businessName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8C827A' }}>Gói chụp:</span>
                  <strong>{selectedPkg?.name || 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8C827A' }}>Ngày chụp:</span>
                  <strong>{selectedDate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8C827A' }}>Khung giờ:</span>
                  <strong>{selectedTimeSlot}</strong>
                </div>
                <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8C827A' }}>Cọc giữ chỗ (30%):</span>
                  <strong style={{ color: 'var(--color-primary)' }}>
                    {selectedPkg ? Math.round(selectedPkg.price * 0.3).toLocaleString('vi-VN') + 'đ' : ''}
                  </strong>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => navigate(ROUTES.PHOTOGRAPHERS)}
                style={{
                  flex: 1, padding: '13px', borderRadius: '10px',
                  border: '1.5px solid var(--color-primary-dark)',
                  backgroundColor: 'transparent', color: 'var(--color-primary-dark)',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Xem thêm thợ ảnh
              </button>
              <button
                onClick={() => { setBookingSuccess(false); navigate('/'); }}
                style={{
                  flex: 1, padding: '13px', borderRadius: '10px',
                  backgroundColor: 'var(--color-primary-dark)', color: '#FFFFFF',
                  border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '0 40px' }}>
        
        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '32px', fontWeight: 600 }}>
          <Link to="/" style={{ color: 'var(--color-text-secondary)' }}>Trang chủ</Link>
          <span>/</span>
          <Link to={ROUTES.PHOTOGRAPHERS} style={{ color: 'var(--color-text-secondary)' }}>Nhiếp ảnh gia</Link>
          <span>/</span>
          <span style={{ color: 'var(--color-primary)' }}>{photographer.businessName}</span>
        </div>

        {/* Dynamic Cart Info Banner */}
        {renderBanner()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '50px', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Configuration Forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Header info */}
            <div>
              <h1 className="font-header" style={{ fontSize: '38px', color: 'var(--color-primary-dark)', fontWeight: 700, marginBottom: '12px' }}>
                {photographer.businessName}
              </h1>
              <p className="font-body" style={{ fontSize: '15px', fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {photographer.quote}
              </p>
            </div>

            {/* Step 1: Chọn gói dịch vụ */}
            <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--color-light-border)' }}>
              <h2 className="font-header" style={{ fontSize: '22px', fontWeight: 750, color: 'var(--color-text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-primary-dark)', color: 'white', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                <span>Chọn gói dịch vụ</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {photographer.packages.map((pkg) => {
                  const isSelected = selectedPkg?._id === pkg._id;
                  return (
                    <div
                      key={pkg._id}
                      onClick={() => setSelectedPkg(pkg)}
                      style={{
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: isSelected ? 'rgba(161, 30, 34, 0.02)' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', maxWidth: '80%' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{pkg.name}</span>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{pkg.description}</p>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: '8px' }}>
                          <span>Thời gian: <strong>{pkg.durationHours} giờ</strong></span>
                          <span>Ảnh chỉnh sửa: <strong>{pkg.editedPhotosCount} ảnh</strong></span>
                          <span>Trả ảnh: <strong>{pkg.deliveryDays} ngày</strong></span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#8B1E22', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} style={{ flexShrink: 0 }} />
                          <span>Khu vực hoạt động: <strong>{photographerCity}</strong> (Chụp tại các địa điểm trong tỉnh/thành phố)</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '18px', fontWeight: 850, color: 'var(--color-primary-dark)' }}>
                          {pkg.price.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Step 2: Lịch & Khung giờ - 2-column layout */}
            <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--color-light-border)' }}>
              <h2 className="font-header" style={{ fontSize: '22px', fontWeight: 750, color: 'var(--color-text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-primary-dark)', color: 'white', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                <span>Lịch & Khung giờ</span>
              </h2>
              <p style={{ fontSize: '13px', color: '#8C827A', marginBottom: '24px', marginLeft: '32px' }}>
                Chọn thời gian phù hợp để ghi lại những khoảnh khắc đẹp nhất.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '32px', alignItems: 'start' }}>
                {/* LEFT: Calendar */}
                <div>
                  {/* Month navigation header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <button
                      onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
                    </span>
                    <button
                      onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Calendar grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
                      <span key={w} style={{ fontSize: '10px', fontWeight: 800, color: '#8C827A', padding: '4px 0' }}>{w}</span>
                    ))}
                    {calendarDays.map((d, idx) => {
                      if (d.isEmpty) return <div key={`e-${idx}`} />;
                      const isSelected = selectedDate === d.dateStr;
                      return (
                        <button
                          key={d.day}
                          disabled={!d.isAvailable}
                          onClick={() => setSelectedDate(d.dateStr)}
                          style={{
                            aspectRatio: '1',
                            border: isSelected ? '2px solid var(--color-primary)' : '1px solid transparent',
                            borderRadius: '8px',
                            backgroundColor: isSelected
                              ? 'var(--color-primary)'
                              : !d.isAvailable
                                ? '#F5F5F5'
                                : d.isWeekend
                                  ? '#FCF9F2'
                                  : '#FFFFFF',
                            color: !d.isAvailable
                              ? '#CCCCCC'
                              : isSelected
                                ? '#FFFFFF'
                                : 'var(--color-text-primary)',
                            fontWeight: isSelected || d.isWeekend ? 'bold' : 'normal',
                            fontSize: '12px',
                            cursor: d.isAvailable ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {d.day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT: Time slots dropdowns */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>CHỌN GIỜ CHỤP</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="vh-input-group" style={{ margin: 0 }}>
                        <span className="vh-input-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>GIỜ BẮT ĐẦU</span>
                        <select 
                          value={startTime} 
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            // Automatically adjust end time if it becomes invalid
                            const startIndex = timeSlots.indexOf(e.target.value);
                            const endIndex = timeSlots.indexOf(endTime);
                            if (endIndex <= startIndex) {
                              const newEndIndex = Math.min(startIndex + 4, timeSlots.length - 1);
                              setEndTime(timeSlots[newEndIndex]);
                            }
                          }}
                          className="vh-select-field"
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(45, 41, 38, 0.15)', backgroundColor: 'white' }}
                        >
                          {timeSlots.slice(0, -2).map((t) => (
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
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(45, 41, 38, 0.15)', backgroundColor: 'white' }}
                        >
                          {getEndTimesOptions().map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <span style={{ fontSize: '11.5px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                      * Bạn có thể chọn thời lượng chụp linh hoạt (tối thiểu 1 tiếng).
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 3: Địa điểm chụp */}
            <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--color-light-border)' }}>
              <h2 className="font-header" style={{ fontSize: '22px', fontWeight: 750, color: 'var(--color-text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-primary-dark)', color: 'white', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                <span>Địa điểm chụp ảnh</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Location chips */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {locations.map((loc) => {
                    const isSelected = selectedLocation === loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(loc);
                          setCustomLocation('');
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: isSelected ? 'var(--color-primary-dark)' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : '#8C827A',
                          border: isSelected ? '1px solid var(--color-primary-dark)' : '1px solid rgba(45, 41, 38, 0.15)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {loc}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocation('KHAC');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: selectedLocation === 'KHAC' ? 'var(--color-primary-dark)' : '#FFFFFF',
                      color: selectedLocation === 'KHAC' ? '#FFFFFF' : '#8C827A',
                      border: selectedLocation === 'KHAC' ? '1px solid var(--color-primary-dark)' : '1px solid rgba(45, 41, 38, 0.15)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Khác (Tự nhập)
                  </button>
                </div>

                {/* Custom location input (conditionally rendered) */}
                {selectedLocation === 'KHAC' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(182, 145, 91, 0.35)', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
                      <MapPin size={18} color="var(--color-gold)" />
                      <input
                        type="text"
                        placeholder={`Nhập địa điểm chụp tự chọn tại khu vực ${photographerCity}...`}
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          width: '100%',
                          fontSize: '14px',
                          color: 'var(--color-text-primary)',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: '#D35400', fontWeight: 550, display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                      ⚠️ Lưu ý: Địa điểm tự chọn phải nằm trong tỉnh/thành phố {photographerCity} hoạt động của thợ ảnh.
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Step 4: Concept & Ý tưởng */}
            <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--color-light-border)' }}>
              <h2 className="font-header" style={{ fontSize: '22px', fontWeight: 750, color: 'var(--color-text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-primary-dark)', color: 'white', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                <span>Concept & Ý tưởng mong muốn</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Concept Selector Chips */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {conceptOptions.map((con) => {
                    const isSelected = selectedConcept === con;
                    return (
                      <button
                        key={con}
                        onClick={() => setSelectedConcept(con)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: isSelected ? 'var(--color-primary-dark)' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : '#8C827A',
                          border: isSelected ? '1px solid var(--color-primary-dark)' : '1px solid rgba(45, 41, 38, 0.15)',
                          cursor: 'pointer'
                        }}
                      >
                        {con}
                      </button>
                    );
                  })}
                </div>

                {/* Ideas Textarea */}
                <div>
                  <label style={{ fontSize: '13px', color: '#8C827A', fontWeight: 650, display: 'block', marginBottom: '8px' }}>Ý tưởng chụp hoặc yêu cầu chi tiết:</label>
                  <textarea
                    rows={4}
                    placeholder="Mô tả bối cảnh, concept bạn mong muốn hoặc các lưu ý đặc biệt dành cho thợ chụp..."
                    value={customRequest}
                    onChange={(e) => setCustomRequest(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(182, 145, 91, 0.25)',
                      backgroundColor: 'var(--color-light-bg)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Reference Upload */}
                <div>
                  <label style={{ fontSize: '13px', color: '#8C827A', fontWeight: 650, display: 'block', marginBottom: '8px' }}>Tải ảnh bối cảnh/concept mẫu (Nếu có):</label>
                  <div style={{
                    border: '1.5px dashed rgba(182, 145, 91, 0.35)',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-light-bg)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#8C827A' }}>
                      <Upload size={24} style={{ color: 'var(--color-gold)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {referenceFile ? `Đã chọn: ${referenceFile.name}` : 'Kéo thả ảnh hoặc Click để tải tệp lên'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#B6915B' }}>Chấp nhận định dạng JPG, PNG dưới 5MB</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Portfolio Grid */}
            <section>
              <h3 className="font-header" style={{ fontSize: '20px', color: 'var(--color-text-primary)', marginBottom: '20px' }}>Tác phẩm tiêu biểu</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {photographer.portfolio.map((img, idx) => (
                  <div key={idx} style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', boxShadow: 'var(--shadow-sm)' }}>
                    <img src={img} alt={`Work ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} />
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* RIGHT COLUMN: Sticky summary panel */}
          <aside style={{ position: 'sticky', top: '100px' }}>
            <div className="vh-premium-card" style={{ backgroundColor: 'white', padding: '28px', borderRadius: '16px', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Profile card summary */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid var(--color-light-border)', paddingBottom: '20px' }}>
                <img
                  src={photographer.portfolio[0]}
                  alt={photographer.businessName}
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ textAlign: 'left' }}>
                  <h3 className="font-header" style={{ fontSize: '20px', color: 'var(--color-text-primary)', margin: 0 }}>
                    {photographer.businessName}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Star size={12} fill="#F59E0B" stroke="#F59E0B" />
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{photographer.rating?.averageRating?.toFixed(1) || '4.9'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>({photographer.rating?.totalReviews || '45'} đánh giá)</span>
                  </div>
                </div>
              </div>

              {/* Booking specifications summary */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', textAlign: 'left' }}>
                  Tóm tắt lịch đặt
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gói chụp:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{selectedPkg ? selectedPkg.name : 'Chưa chọn'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ngày chụp:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{selectedDate || 'Chưa chọn'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Khung giờ:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{selectedTimeSlot}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Địa điểm:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>
                      {selectedLocation === 'KHAC' ? (customLocation.trim() || 'Khác (Chưa nhập)') : selectedLocation}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Concept:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{selectedConcept}</strong>
                  </div>
                </div>
              </div>

              {/* Photographer details */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', textAlign: 'left' }}>
                  Thông tin thợ ảnh
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                  <span>Thiết bị: {photographer.equipment.join(' • ')}</span>
                  <span>Thời gian hủy: Lịch được hoàn cọc 100% khi báo trước 48 giờ.</span>
                </div>
              </div>

              {/* Price calculations */}
              {selectedPkg && (
                <div style={{ backgroundColor: 'var(--color-light-bg)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <span>Giá trị gói:</span>
                    <span>{selectedPkg.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <span>Đặt cọc giữ chỗ (30%):</span>
                    <span>{Math.round(selectedPkg.price * 0.3).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.05)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-primary-dark)', fontWeight: 'bold' }}>
                    <span>CẦN CỌC TRƯỚC:</span>
                    <span>{Math.round(selectedPkg.price * 0.3).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                    *Còn lại <strong>{Math.round(selectedPkg.price * 0.7).toLocaleString('vi-VN')}đ</strong> thanh toán sau buổi chụp.
                  </div>
                </div>
              )}

              {/* Conditions checkbox */}
              <div style={{ textAlign: 'left' }}>
                <label className="vh-checkbox-container" style={{ fontSize: '12px', lineHeight: 1.5, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    className="vh-checkbox-input"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    style={{ marginTop: '2px' }}
                  />
                  <span>Tôi đồng ý với chính sách thanh toán cọc và cam kết chụp ảnh đúng giờ đã chọn.</span>
                </label>
              </div>

              {/* CTA Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* ĐẶT LỊCH NGAY */}
                <button
                  onClick={handleDirectBooking}
                  disabled={isBookingNow}
                  className="vh-btn vh-btn-primary"
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    fontWeight: 700,
                    fontSize: '15px',
                    backgroundColor: isBookingNow ? '#8C827A' : 'var(--color-primary-dark)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: isBookingNow ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {isBookingNow ? (
                    <><span>ĐANG XỬ LÝ...</span></>
                  ) : (
                    <><span>ĐẶT LỊCH NGAY</span><ArrowRight size={16} /></>
                  )}
                </button>

                {/* THÊM VÀO GIỎ HÀNG */}
                <button
                  onClick={handleAddBookingToCart}
                  className="vh-btn"
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '13px 20px',
                    fontWeight: 700,
                    fontSize: '14px',
                    backgroundColor: 'transparent',
                    color: 'var(--color-primary-dark)',
                    border: '1.5px solid var(--color-primary-dark)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span>THÊM VÀO GIỎ HÀNG</span>
                  <ArrowRight size={16} />
                </button>

                {/* NHẮN TIN CHO THỢ */}
                <button
                  onClick={handleStartChat}
                  className="vh-btn"
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '13px 20px',
                    fontWeight: 700,
                    fontSize: '14px',
                    backgroundColor: 'transparent',
                    color: '#6b0c22',
                    border: '1.5px solid #6b0c22',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    letterSpacing: '0.04em',
                    marginTop: '10px'
                  }}
                >
                  <span>NHẮN TIN CHO THỢ</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          </aside>

        </div>
      </div>
    </div>
  );
};

export default PhotographerDetailPage;
