import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sparkles,
  Scissors,
  Camera,
  Clock,
  Users,
  ChevronRight,
  ShoppingBag,
  Image as ImageIcon,
  Loader2,
  MapPin,
  AlertCircle,
  Store,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useCart } from '../../context/CartContext';
import { ROUTES } from '../../config/routes';
import { API_BASE_URL } from '../../config/env';
import { useToast } from '../../components/feedback/Toast';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ConfirmModal } from '../../utils/confirmModal';
import { PhotographyScheduleSelector } from '../../features/photographers/components/PhotographyScheduleSelector';
import { PhotographyLocationPicker } from '../../features/photographers/components/PhotographyLocationPicker';
import type { LocationSelection } from '../../features/photographers/types/photographer.types';
import type { PhotographyCalendarDay } from '../../features/photographers/components/PhotographyScheduleSelector';
import './ComboDetailPage.css';

const POPULAR_HUE_LOCATIONS = [
  'Đại Nội Huế (Hoàng Thành)',
  'Lăng Khải Định',
  'Chùa Thiên Mụ',
  'Cầu Trường Tiền - Sông Hương',
  'Làng Hương Thủy Xuân',
  'Cung An Định',
];

const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${normalized}`;
  }
  return url.startsWith('/') ? url : `/${url}`;
};

const toMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

interface ComboDetail {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  productId: {
    _id: string;
    name: string;
    images: string[];
    basePrice: number;
    slug: string;
    depositAmount?: number;
    sizes?: string[];
    colors?: string[];
    materials?: string[];
  };
  photographyPackageId: {
    _id: string;
    name: string;
    images: string[];
    price: number;
    durationHours: number;
    slug: string;
    editedPhotosCount?: number;
    deliveryDays?: number;
    maxPeople?: number;
  };
  providerId: {
    _id: string;
    businessName: string;
    coverImage?: string;
    portfolio?: string[];
    avatar?: string;
    address?: {
      addressLine: string;
      city: string;
      geo?: { type: 'Point'; coordinates: [number, number] } | null;
    };
    rating?: { averageRating: number; totalReviews: number };
    contact?: { phone: string; email: string };
  };
  discountPercent: number;
  comboPrice?: number;
  validFrom?: string;
  validTo?: string;
  aoDaiQuantity: number;
  shootPeopleCount: number;
  maxUsage: number;
  usedCount: number;
  image?: string;
}

export const ComboDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  const [combo, setCombo] = useState<ComboDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery state
  const [activeImg, setActiveImg] = useState(0);

  // Booking form state
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [busySlots, setBusySlots] = useState<{ date: string; timeSlot: string }[]>([]);

  // Availability & Calendar states
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [monthlyAvailability, setMonthlyAvailability] = useState<Record<string, 'AVAILABLE' | 'FULL' | 'NO_SCHEDULE' | 'OFF_DAY' | 'PAST'>>({});
  const [isMonthlyAvailabilityLoading, setIsMonthlyAvailabilityLoading] = useState<boolean>(false);
  const [availableTimeRanges, setAvailableTimeRanges] = useState<Array<{ start: string; end: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchCombo = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await httpClient.get<ComboDetail>(`/combo-promotions/${id}`);
        setCombo(data);

        // Default size/color
        if (data.productId?.sizes?.length) setSelectedSize(data.productId.sizes[0]);
        if (data.productId?.colors?.length) setSelectedColor(data.productId.colors[0]);

        // Default location: prefer combo location, fallback to provider address or Hue default
        const defaultLocName =
          data.location ||
          (data.providerId?.address?.city?.includes('Huế')
            ? 'Đại Nội Huế (Hoàng Thành), TP. Huế'
            : `${data.providerId?.address?.addressLine ? `${data.providerId.address.addressLine}, ` : ''}${data.providerId?.address?.city || 'TP. Huế'}`);

        const defaultLat = data.providerId?.address?.geo?.coordinates?.[1] ?? 16.4637;
        const defaultLng = data.providerId?.address?.geo?.coordinates?.[0] ?? 107.5847;

        setSelectedLocation({
          address: defaultLocName,
          latitude: defaultLat,
          longitude: defaultLng,
        });
      } catch (err: any) {
        setError(err.message || 'Không thể tải thông tin combo');
      } finally {
        setLoading(false);
      }
    };
    fetchCombo();
  }, [id]);

  // Busy slots for provider
  useEffect(() => {
    if (!combo?.providerId) return;
    const targetId = typeof combo.providerId === 'object' ? combo.providerId._id : combo.providerId;
    const fetchAvailability = async () => {
      try {
        const busyData = await httpClient.get<{ bookedDates: string[]; bookedSlots: { date: string; timeSlot: string }[] }>(
          `/api/bookings/busy-dates/provider/${targetId}`,
        );
        setBusySlots(busyData.bookedSlots || []);
      } catch (err) {
        console.error('Lỗi khi tải lịch bận provider:', err);
      }
    };
    fetchAvailability();
  }, [combo?.providerId]);

  // Monthly availability for visual calendar
  useEffect(() => {
    if (!combo?.providerId || !combo?.photographyPackageId) {
      setMonthlyAvailability({});
      setIsMonthlyAvailabilityLoading(false);
      return;
    }

    const providerId = typeof combo.providerId === 'object' ? combo.providerId._id : combo.providerId;
    const packageId = typeof combo.photographyPackageId === 'object' ? combo.photographyPackageId._id : combo.photographyPackageId;

    let cancelled = false;
    const month = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
    setIsMonthlyAvailabilityLoading(true);
    httpClient
      .get<{ month: string; days: Array<{ date: string; status: 'AVAILABLE' | 'FULL' | 'NO_SCHEDULE' | 'OFF_DAY' | 'PAST' }> }>(
        `/api/photographers/${providerId}/availability/month?month=${month}&packageId=${packageId}`,
      )
      .then((availability) => {
        if (cancelled) return;
        setMonthlyAvailability(Object.fromEntries(availability.days.map((day) => [day.date, day.status])));
      })
      .catch((availabilityError) => {
        console.error('Lỗi khi tải lịch bận tháng:', availabilityError);
        if (!cancelled) setMonthlyAvailability({});
      })
      .finally(() => {
        if (!cancelled) setIsMonthlyAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarDate, combo?.providerId, combo?.photographyPackageId]);

  // Daily time ranges for selected date
  useEffect(() => {
    if (!combo?.providerId || !shootDate) {
      setAvailableTimeRanges([]);
      return;
    }
    const providerId = typeof combo.providerId === 'object' ? combo.providerId._id : combo.providerId;

    httpClient
      .get<{ timeRanges: Array<{ start: string; end: string }> }>(
        `/api/photographers/${providerId}/availability?date=${shootDate}`,
      )
      .then((availability) => setAvailableTimeRanges(availability.timeRanges || []))
      .catch((err) => {
        console.error('Lỗi khi tải khung giờ khả dụng:', err);
        setAvailableTimeRanges([]);
      });
  }, [combo?.providerId, shootDate]);

  // All gallery images
  const allImages = useMemo(() => {
    if (!combo) return [];
    const imgs: string[] = [];
    if (combo.image) imgs.push(combo.image);
    if (combo.productId?.images) imgs.push(...combo.productId.images);
    if (combo.photographyPackageId?.images) imgs.push(...combo.photographyPackageId.images);
    return imgs.length > 0 ? imgs : [''];
  }, [combo]);

  const bookedSlotsOnSelectedDate = useMemo(() => {
    if (!shootDate) return [];
    return busySlots
      .filter((s) => s.date === shootDate)
      .map((s) => s.timeSlot);
  }, [shootDate, busySlots]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: PhotographyCalendarDay[] = [];
    for (let i = 0; i < firstDayOfWeek; i += 1) {
      days.push({ day: 0, dateStr: '', isWeekend: false, isAvailable: false, isEmpty: true });
    }
    for (let i = 1; i <= daysInMonth; i += 1) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const status = monthlyAvailability[dateStr] ?? 'NO_SCHEDULE';
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      days.push({
        day: i,
        dateStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isAvailable: status === 'AVAILABLE',
        isEmpty: false,
        availabilityStatus: status as any,
      });
    }
    return days;
  }, [calendarDate, monthlyAvailability]);

  const effectiveDurationMinutes = useMemo(() => {
    return Math.max((combo?.photographyPackageId?.durationHours || 1) * 60, 30);
  }, [combo?.photographyPackageId?.durationHours]);

  const photographerSlots = useMemo(() => {
    const stepMinutes = effectiveDurationMinutes >= 180 ? 60 : 30;
    return availableTimeRanges.flatMap((range) => {
      const start = toMinutes(range.start);
      const end = toMinutes(range.end);
      const slots: Array<{ start: string; end: string; label: string }> = [];
      const lunchStart = toMinutes('12:00');
      const lunchEnd = toMinutes('13:00');

      for (let current = start; current + effectiveDurationMinutes <= end; current += stepMinutes) {
        const slotEnd = current + effectiveDurationMinutes;
        if (effectiveDurationMinutes >= 180 && current > toMinutes('09:30') && current < lunchEnd && slotEnd > lunchStart) {
          continue;
        }
        slots.push({ start: toTime(current), end: toTime(slotEnd), label: `${toTime(current)} - ${toTime(slotEnd)}` });
      }
      return slots;
    });
  }, [availableTimeRanges, effectiveDurationMinutes]);

  const computedEndTime = useMemo(() => {
    if (!startTime) return '';
    return toTime(toMinutes(startTime) + effectiveDurationMinutes);
  }, [startTime, effectiveDurationMinutes]);

  const isTimeSlotOverlap = (slot1: string, slot2: string) => {
    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const [start1Str, end1Str] = slot1.split('-').map((s) => s.trim());
    const [start2Str, end2Str] = slot2.split('-').map((s) => s.trim());
    if (!start1Str || !end1Str || !start2Str || !end2Str) return false;
    const s1 = parseTime(start1Str);
    const e1 = parseTime(end1Str);
    const s2 = parseTime(start2Str);
    const e2 = parseTime(end2Str);
    return s1 < e2 && s2 < e1;
  };

  const isSlotBusy = (slotStart: string) => {
    if (!shootDate) return false;
    const duration = combo?.photographyPackageId?.durationHours || 1;
    const startIndex = photographerSlots.findIndex((s) => s.start === slotStart);
    const slotEnd = photographerSlots[startIndex]?.end || toTime(toMinutes(slotStart) + Math.round(duration * 60));
    const targetRange = `${slotStart} - ${slotEnd}`;
    return bookedSlotsOnSelectedDate.some((bookedSlot) => isTimeSlotOverlap(targetRange, bookedSlot));
  };

  const isCurrentSlotSelectedBusy = useMemo(() => {
    if (!startTime || !computedEndTime) return false;
    return bookedSlotsOnSelectedDate.some((bookedSlot) => isTimeSlotOverlap(`${startTime} - ${computedEndTime}`, bookedSlot));
  }, [startTime, computedEndTime, bookedSlotsOnSelectedDate]);

  if (loading) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-loading">
          <Loader2 size={36} />
          <span>Đang tải thông tin combo...</span>
        </div>
      </div>
    );
  }

  if (error || !combo) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-error">
          <AlertCircle size={40} />
          <h3>{error || 'Không tìm thấy combo'}</h3>
          <Link to={ROUTES.COMBOS}>← Quay lại danh sách combo</Link>
        </div>
      </div>
    );
  }

  const product = combo.productId;
  const pkg = combo.photographyPackageId;
  const provider = combo.providerId;

  if (!product || !pkg) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-error">
          <AlertCircle size={40} />
          <h3>Sản phẩm áo dài hoặc gói chụp ảnh của combo này không khả dụng</h3>
          <Link to={ROUTES.COMBOS}>← Quay lại danh sách combo</Link>
        </div>
      </div>
    );
  }

  const originalPrice = (product.basePrice || 0) + (pkg.price || 0);
  const discountedPrice = combo.comboPrice
    ? combo.comboPrice
    : Math.round(originalPrice * (1 - combo.discountPercent / 100));
  const savedAmount = originalPrice - discountedPrice;
  const remaining = combo.maxUsage - (combo.usedCount || 0);

  const canBook = Boolean(selectedSize && selectedColor && shootDate && startTime && !isCurrentSlotSelectedBusy && remaining > 0);

  const handleBookCombo = () => {
    if (!isAuthenticated) {
      ConfirmModal.requireAuth(
        'Yêu cầu đăng nhập',
        'Vui lòng đăng nhập để đặt gói combo này!',
        { confirmButtonText: 'Đăng nhập ngay' },
      ).then((result) => {
        if (result.isConfirmed) {
          navigate(ROUTES.LOGIN, { state: { from: location } });
        }
      });
      return;
    }

    if (!shootDate || !startTime) {
      toast.error('Vui lòng chọn ngày và giờ chụp mong muốn trên lịch.');
      return;
    }

    if (isCurrentSlotSelectedBusy) {
      toast.error('Khung giờ bạn chọn đã bị trùng lịch với đơn khác. Vui lòng chọn khung giờ hoặc ngày khác.');
      return;
    }

    if (!canBook) {
      toast.error('Vui lòng chọn đầy đủ kích cỡ, màu sắc áo dài và thời gian chụp.');
      return;
    }

    const comboTimeSlot = `${startTime} - ${computedEndTime}`;
    const shootAddr = selectedLocation?.address || provider.address?.addressLine || '';
    const shootLat = selectedLocation?.latitude ?? provider.address?.geo?.coordinates?.[1] ?? null;
    const shootLng = selectedLocation?.longitude ?? provider.address?.geo?.coordinates?.[0] ?? null;

    // Add Ao Dai to cart
    addToCart({
      itemType: 'PRODUCT',
      productId: product._id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      basePrice: product.basePrice,
      depositAmount: product.depositAmount || 0,
      size: selectedSize,
      color: selectedColor,
      rentalType: 'DAILY',
      startDate: shootDate,
      endDate: shootDate,
      rentalFrom: shootDate,
      rentalTo: shootDate,
      providerCity: provider.address?.city || '',
      providerAddress: provider.address?.addressLine || '',
      comboDiscountPercent: combo.discountPercent,
      comboPromotionId: combo._id,
      quantity: combo.aoDaiQuantity || 1,
    });

    // Add Photography Package to cart
    addToCart({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: pkg._id,
      photographerName: provider.businessName,
      photographerAvatar: provider.coverImage || provider.portfolio?.[0] || '',
      packageImage: pkg.images?.[0] || provider.coverImage || combo.image || '',
      packageName: pkg.name,
      basePrice: pkg.price,
      depositAmount: Math.round(pkg.price * 0.3),
      shootDate: shootDate,
      shootTimeSlot: comboTimeSlot,
      shootLocation: shootAddr,
      shootLocationLatitude: shootLat,
      shootLocationLongitude: shootLng,
      shootConcept: 'Gói chụp ảnh trong Combo',
      photographerCity: provider.address?.city || '',
      comboDiscountPercent: combo.discountPercent,
      comboPromotionId: combo._id,
      quantity: 1,
    });

    toast.success('Đã thêm combo vào giỏ hàng!');
    navigate(ROUTES.CART);
  };

  return (
    <div className="vh-combo-detail">
      {/* Breadcrumbs */}
      <nav className="vh-combo-detail-breadcrumb" aria-label="Breadcrumbs">
        <Link to="/">Trang chủ</Link>
        <ChevronRight size={14} />
        <Link to={ROUTES.COMBOS}>Danh sách Combo</Link>
        <ChevronRight size={14} />
        <span className="active">{combo.name}</span>
      </nav>

      {/* Main 2-Column Grid */}
      <div className="vh-combo-detail-container">
        {/* ===== CỘT TRÁI: NỘI DUNG & CẤU HÌNH COMBO ===== */}
        <div className="vh-combo-detail-main">
          {/* 1. Hero Overview */}
          <section className="vh-combo-hero-section">
            <div className="vh-combo-gallery-container">
              {combo.discountPercent > 0 && (
                <div className="vh-combo-discount-tag">
                  <Sparkles size={14} /> TIẾT KIỆM {combo.discountPercent}%
                </div>
              )}
              <img
                src={getImageUrl(allImages[activeImg] || '')}
                alt={combo.name}
                className="vh-combo-main-image"
              />
              {allImages.length > 1 && (
                <div className="vh-combo-thumbnails">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`vh-combo-thumb-btn ${activeImg === idx ? 'active' : ''}`}
                      onClick={() => setActiveImg(idx)}
                      aria-label={`Ảnh ${idx + 1}`}
                    >
                      <img src={getImageUrl(img)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="vh-combo-header-info">
              <div className="vh-combo-tag-row">
                <span className="vh-combo-badge-brand">COMBO TRỌN GÓI</span>
                {provider?.address?.city && (
                  <span className="vh-combo-badge-location">
                    <MapPin size={12} /> {provider.address.city}
                  </span>
                )}
                {remaining > 0 && remaining <= 10 && (
                  <span className="vh-combo-badge-urgency">
                    Chỉ còn {remaining} suất
                  </span>
                )}
              </div>

              <h1 className="vh-combo-title">{combo.name}</h1>

              {provider && (
                <div className="vh-combo-provider-meta">
                  <span>
                    Cung cấp bởi: <strong>{provider.businessName}</strong>
                  </span>
                  {provider.rating?.averageRating ? (
                    <span className="vh-combo-rating">
                      ★ {provider.rating.averageRating} ({provider.rating.totalReviews || 0} đánh giá)
                    </span>
                  ) : null}
                </div>
              )}

              {combo.description && (
                <p className="vh-combo-description">{combo.description}</p>
              )}

              {/* Highlights cards */}
              <div className="vh-combo-highlights-grid">
                <div className="vh-combo-highlight-item">
                  <Scissors size={20} />
                  <div>
                    <strong>{combo.aoDaiQuantity || 1} Bộ Áo Dài</strong>
                    <span>Trang phục cao cấp</span>
                  </div>
                </div>
                <div className="vh-combo-highlight-item">
                  <Camera size={20} />
                  <div>
                    <strong>{pkg.durationHours} Giờ Chụp</strong>
                    <span>Nhiếp ảnh gia đồng hành</span>
                  </div>
                </div>
                <div className="vh-combo-highlight-item">
                  <ImageIcon size={20} />
                  <div>
                    <strong>{pkg.editedPhotosCount || 20}+ Ảnh Sửa</strong>
                    <span>Nhận toàn bộ file gốc</span>
                  </div>
                </div>
                <div className="vh-combo-highlight-item">
                  <Users size={20} />
                  <div>
                    <strong>Tối đa {combo.shootPeopleCount || pkg.maxPeople || 2} Người</strong>
                    <span>Gói chụp hoàn hảo</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. BƯỚC 1: Chọn Kích cỡ & Màu sắc Áo Dài */}
          <section className="vh-combo-card-section">
            <div className="vh-combo-section-header">
              <div className="vh-step-circle">1</div>
              <div>
                <h2>Trang phục Áo Dài trong Combo</h2>
                <p>Chọn kích cỡ và màu sắc bạn muốn chuẩn bị cho buổi chụp.</p>
              </div>
            </div>

            <div className="vh-combo-product-preview-card">
              <img
                src={getImageUrl(product.images?.[0] || '')}
                alt={product.name}
                className="vh-combo-product-img"
              />
              <div className="vh-combo-product-details">
                <div className="vh-product-badge">
                  <Scissors size={12} /> Áo Dài Cao Cấp
                </div>
                <h3 className="vh-product-name">{product.name}</h3>
                <div className="vh-product-price">
                  Giá niêm yết: <strong>{product.basePrice.toLocaleString('vi-VN')}đ / bộ</strong>
                </div>

                <div className="vh-combo-options-group">
                  {product.sizes && product.sizes.length > 0 && (
                    <div className="vh-option-row">
                      <label>Kích cỡ áo dài:</label>
                      <div className="vh-chips-wrap">
                        {product.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            className={`vh-chip ${selectedSize === size ? 'active' : ''}`}
                            onClick={() => setSelectedSize(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {product.colors && product.colors.length > 0 && (
                    <div className="vh-option-row">
                      <label>Màu sắc áo dài:</label>
                      <div className="vh-chips-wrap">
                        {product.colors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`vh-chip ${selectedColor === color ? 'active' : ''}`}
                            onClick={() => setSelectedColor(color)}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. BƯỚC 2: Chọn Lịch & Khung Giờ Chụp */}
          <section className="vh-combo-card-section">
            <div className="vh-combo-section-header">
              <div className="vh-step-circle">2</div>
              <div>
                <h2>Lịch & khung giờ chụp ảnh</h2>
                <p>
                  Gói dịch vụ: <strong>{pkg.name}</strong> • Thời lượng: <strong>{pkg.durationHours} giờ</strong>
                </p>
              </div>
            </div>

            <div className="vh-combo-schedule-box">
              <PhotographyScheduleSelector
                hideTitle
                calendarDate={calendarDate}
                calendarDays={calendarDays}
                isCalendarLoading={isMonthlyAvailabilityLoading}
                selectedDate={shootDate}
                slots={photographerSlots}
                selectedStartTime={startTime}
                selectedEndTime={computedEndTime}
                onPreviousMonth={() => {
                  const nextDate = new Date(calendarDate);
                  nextDate.setMonth(nextDate.getMonth() - 1);
                  setCalendarDate(nextDate);
                }}
                onNextMonth={() => {
                  const nextDate = new Date(calendarDate);
                  nextDate.setMonth(nextDate.getMonth() + 1);
                  setCalendarDate(nextDate);
                }}
                onSelectDate={setShootDate}
                onSelectSlot={(slot) => setStartTime(slot.start)}
                isSlotBusy={(slot) => isSlotBusy(slot.start)}
              />

              <div className="vh-schedule-time-selected-banner">
                <Clock size={20} />
                <div>
                  <strong>Thời lượng gói chụp: {pkg.durationHours} giờ</strong>
                  <p>
                    {shootDate && startTime
                      ? `✓ Bạn đã chọn: ${startTime} — ${computedEndTime} ngày ${shootDate}`
                      : 'Hãy chọn ngày và khung giờ bắt đầu phù hợp trên lịch.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. BƯỚC 3: Địa Điểm Chụp Ảnh */}
          <section className="vh-combo-card-section">
            <div className="vh-combo-section-header">
              <div className="vh-step-circle">3</div>
              <div>
                <h2>Địa điểm chụp ảnh</h2>
                <p>Chọn địa điểm check-in hoặc tìm vị trí bạn muốn ghi lại khoảnh khắc.</p>
              </div>
            </div>

            <div className="vh-combo-location-box">
              {/* Quick location chips for convenience */}
              <div className="vh-quick-location-chips">
                <span className="vh-quick-label">Gợi ý địa điểm nổi tiếng:</span>
                {POPULAR_HUE_LOCATIONS.map((loc) => {
                  const isSelected = selectedLocation?.address?.includes(loc);
                  return (
                    <button
                      key={loc}
                      type="button"
                      className={`vh-location-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedLocation({
                          address: `${loc}, TP. Huế`,
                          latitude: 16.4637,
                          longitude: 107.5847,
                        });
                      }}
                    >
                      📍 {loc}
                    </button>
                  );
                })}
              </div>

              <PhotographyLocationPicker
                compact
                value={selectedLocation}
                onSelect={setSelectedLocation}
                title="Địa chỉ chụp cụ thể"
                hint="Nhập tên địa điểm hoặc chọn nhanh gợi ý phía trên."
              />
            </div>
          </section>

          {/* 5. Thông tin Cửa Hàng / Studio */}
          {provider && (
            <section className="vh-combo-provider-section">
              <div className="vh-provider-card-inner">
                <div className="vh-provider-avatar">
                  {provider.avatar ? (
                    <img src={getImageUrl(provider.avatar)} alt={provider.businessName} />
                  ) : (
                    <Store size={26} />
                  )}
                </div>
                <div className="vh-provider-info">
                  <div className="vh-provider-verified-tag">
                    <CheckCircle2 size={13} /> Cửa hàng & Studio uy tín
                  </div>
                  <h3>{provider.businessName}</h3>
                  <p>
                    <MapPin size={13} />{' '}
                    {provider.address?.addressLine ? `${provider.address.addressLine}, ` : ''}
                    {provider.address?.city || 'Huế'}
                  </p>
                </div>
                <Link to={`/stores/${provider._id}`} className="vh-provider-visit-btn">
                  <span>Ghé thăm gian hàng</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* ===== CỘT PHẢI: STICKY BOOKING CARD ===== */}
        <aside className="vh-combo-detail-sidebar">
          <div className="vh-combo-sidebar-card">
            {/* Price Header */}
            <div className="vh-sidebar-price-header">
              <span className="vh-sidebar-price-eyebrow">GIÁ TRỌN GÓI ƯU ĐÃI</span>
              <div className="vh-sidebar-price-row">
                <span className="vh-sidebar-main-price">{discountedPrice.toLocaleString('vi-VN')}đ</span>
                <span className="vh-sidebar-original-price">{originalPrice.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="vh-sidebar-save-badge">
                <Sparkles size={13} /> Tiết kiệm {savedAmount.toLocaleString('vi-VN')}đ ({combo.discountPercent}%)
              </div>
            </div>

            {/* Live Summary Box */}
            <div className="vh-sidebar-summary-box">
              <h4 className="vh-sidebar-summary-title">Tóm tắt cấu hình Combo</h4>

              {/* Áo dài choice */}
              <div className="vh-summary-item">
                <div className="vh-summary-icon">
                  <Scissors size={15} />
                </div>
                <div className="vh-summary-content">
                  <strong>Trang phục Áo Dài</strong>
                  <span>
                    {selectedSize ? `Size: ${selectedSize}` : '⚠️ Chưa chọn size'}
                    {selectedColor ? ` • Màu: ${selectedColor}` : ''}
                  </span>
                </div>
              </div>

              {/* Photography package choice */}
              <div className="vh-summary-item">
                <div className="vh-summary-icon">
                  <Camera size={15} />
                </div>
                <div className="vh-summary-content">
                  <strong>Lịch chụp ảnh ({pkg.durationHours}h)</strong>
                  <span>
                    {shootDate && startTime
                      ? `${shootDate} (${startTime} - ${computedEndTime})`
                      : '⚠️ Chưa chọn ngày & giờ chụp'}
                  </span>
                </div>
              </div>

              {/* Location choice */}
              <div className="vh-summary-item">
                <div className="vh-summary-icon">
                  <MapPin size={15} />
                </div>
                <div className="vh-summary-content">
                  <strong>Địa điểm chụp</strong>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px' }}>
                    {selectedLocation?.address || 'Theo yêu cầu'}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              className="vh-combo-main-cta-btn"
              onClick={handleBookCombo}
              disabled={!canBook}
            >
              <ShoppingBag size={18} />
              <span>ĐẶT COMBO NGAY</span>
            </button>

            {!canBook && (
              <p className="vh-sidebar-action-hint">
                {!selectedSize || !selectedColor
                  ? 'Vui lòng chọn Size & Màu áo ở Bước 1'
                  : !shootDate || !startTime
                  ? 'Vui lòng chọn Ngày & Giờ chụp ở Bước 2'
                  : isCurrentSlotSelectedBusy
                  ? 'Khung giờ này đã kín lịch'
                  : 'Vui lòng hoàn tất thông tin để đặt combo'}
              </p>
            )}

            {/* Guarantees */}
            <div className="vh-sidebar-guarantees">
              <div className="vh-guarantee-line">
                <CheckCircle2 size={15} color="#059669" />
                <span>Trang phục được giặt ủi thơm tho, sạch sẽ</span>
              </div>
              <div className="vh-guarantee-line">
                <CheckCircle2 size={15} color="#059669" />
                <span>Nhiếp ảnh gia chuyên nghiệp, giàu kinh nghiệm</span>
              </div>
              <div className="vh-guarantee-line">
                <CheckCircle2 size={15} color="#059669" />
                <span>Được hỗ trợ dời lịch miễn phí trước 24h</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ComboDetailPage;
