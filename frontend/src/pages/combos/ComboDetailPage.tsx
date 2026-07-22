import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles, Scissors, Camera, Calendar, Clock, Users, Package,
  ChevronRight, ShoppingBag, Image as ImageIcon, Loader2, MapPin,
  AlertCircle
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useCart } from '../../context/CartContext';
import { ROUTES } from '../../config/routes';
import { API_BASE_URL } from '../../config/env';
import { useToast } from '../../components/feedback/Toast';
import { PhotographyScheduleSelector } from '../../features/photographers/components/PhotographyScheduleSelector';
import { PhotographyLocationPicker } from '../../features/photographers/components/PhotographyLocationPicker';
import type { LocationSelection } from '../../features/photographers/types/photographer.types';
import type { PhotographyCalendarDay } from '../../features/photographers/components/PhotographyScheduleSelector';
import './ComboDetailPage.css';

const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
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
  const { addToCart } = useCart();
  const toast = useToast();

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

        if (data.providerId?.address) {
          setSelectedLocation({
            address: `${data.providerId.address.addressLine || ''}, ${data.providerId.address.city || ''}`.replace(/^,\s*/, ''),
            latitude: data.providerId.address.geo?.coordinates?.[1] ?? 16.4637,
            longitude: data.providerId.address.geo?.coordinates?.[0] ?? 107.5847,
          });
        }
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
        const busyData = await httpClient.get<{ bookedDates: string[]; bookedSlots: { date: string; timeSlot: string }[] }>(`/api/bookings/busy-dates/provider/${targetId}`);
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

    return () => { cancelled = true; };
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
    const startIndex = photographerSlots.findIndex(s => s.start === slotStart);
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
          <Loader2 size={32} />
          <span>Đang tải thông tin combo...</span>
        </div>
      </div>
    );
  }

  if (error || !combo) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-error">
          <AlertCircle size={36} />
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
          <AlertCircle size={36} />
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

  const canBook = selectedSize && selectedColor && shootDate && startTime && !isCurrentSlotSelectedBusy && remaining > 0;

  const handleBookCombo = () => {
    if (!shootDate || !startTime) {
      toast.error('Vui lòng chọn ngày và giờ chụp mong muốn trên lịch.');
      return;
    }

    if (isCurrentSlotSelectedBusy) {
      toast.error('Khung giờ bạn chọn đã bị trùng lịch với đơn khác. Vui lòng chọn khung giờ hoặc ngày khác.');
      return;
    }

    if (!canBook) {
      toast.error('Vui lòng chọn đầy đủ thông tin trước khi đặt combo');
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
      <div className="vh-combo-detail-breadcrumb">
        <Link to="/">Trang chủ</Link>
        <ChevronRight size={14} />
        <Link to={ROUTES.COMBOS}>Danh sách Combo</Link>
        <ChevronRight size={14} />
        <span className="active">{combo.name}</span>
      </div>

      {/* Top Section: Gallery Left, Info Right */}
      <div className="vh-combo-detail-top">
        {/* Gallery */}
        <div className="vh-combo-detail-gallery">
          {combo.discountPercent > 0 && (
            <div className="vh-combo-detail-discount-badge">
              <Sparkles size={14} /> TIẾT KIỆM {combo.discountPercent}%
            </div>
          )}
          <img
            src={getImageUrl(allImages[activeImg] || '')}
            alt={combo.name}
            className="vh-combo-detail-gallery-main"
          />
          {allImages.length > 1 && (
            <div className="vh-combo-detail-gallery-thumbs">
              {allImages.map((img, idx) => (
                <img
                  key={idx}
                  src={getImageUrl(img)}
                  alt=""
                  className={`vh-combo-detail-gallery-thumb ${activeImg === idx ? 'active' : ''}`}
                  onClick={() => setActiveImg(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="vh-combo-detail-info">
          <h1 className="vh-combo-detail-title">{combo.name}</h1>

          {provider && (
            <div className="vh-combo-detail-provider">
              <MapPin size={14} />
              <span>Cung cấp bởi: <strong>{provider.businessName}</strong> ({provider.address?.city || 'Huế'})</span>
            </div>
          )}

          {/* Price Block */}
          <div className="vh-combo-detail-price-block">
            <div className="vh-combo-detail-price-left">
              <span className="vh-combo-detail-price-label">Giá trọn gói ưu đãi</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span className="vh-combo-detail-price-combo">
                  {discountedPrice.toLocaleString('vi-VN')}đ
                </span>
                <span className="vh-combo-detail-price-original">
                  {originalPrice.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
            <span className="vh-combo-detail-price-save">
              Tiết kiệm {savedAmount.toLocaleString('vi-VN')}đ
            </span>
          </div>

          {/* Description */}
          {combo.description && (
            <div className="vh-combo-detail-desc">
              {combo.description}
            </div>
          )}
        </div>
      </div>

      {/* Included Items Grid */}
      <div className="vh-combo-detail-items">
        <h2>Sản phẩm & Dịch vụ trong Combo</h2>
        <div className="vh-combo-detail-items-grid">
          {/* Ao Dai Card */}
          <div className="vh-combo-detail-item-card">
            <img
              className="vh-combo-detail-item-img"
              src={getImageUrl(product.images?.[0] || '')}
              alt={product.name}
            />
            <div className="vh-combo-detail-item-body">
              <div className="vh-combo-detail-item-type-badge aodai">
                <Scissors size={10} /> Áo Dài
              </div>
              <div className="vh-combo-detail-item-name">{product.name}</div>
              <div className="vh-combo-detail-item-price">
                {product.basePrice.toLocaleString('vi-VN')}đ / bộ
              </div>
              <div className="vh-combo-detail-item-specs">
                {product.sizes && product.sizes.length > 0 && (
                  <div className="vh-combo-detail-item-spec">
                    <Package size={12} />
                    Size: {product.sizes.join(', ')}
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="vh-combo-detail-item-spec">
                    <Sparkles size={12} />
                    Màu: {product.colors.join(', ')}
                  </div>
                )}
                {product.materials && product.materials.length > 0 && (
                  <div className="vh-combo-detail-item-spec">
                    <Scissors size={12} />
                    Chất liệu: {product.materials.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Photography Package Card */}
          <div className="vh-combo-detail-item-card">
            <img
              className="vh-combo-detail-item-img"
              src={getImageUrl(pkg.images?.[0] || '')}
              alt={pkg.name}
            />
            <div className="vh-combo-detail-item-body">
              <div className="vh-combo-detail-item-type-badge photo">
                <Camera size={10} /> Gói Chụp Ảnh
              </div>
              <div className="vh-combo-detail-item-name">{pkg.name}</div>
              <div className="vh-combo-detail-item-price">
                {pkg.price.toLocaleString('vi-VN')}đ / gói
              </div>
              <div className="vh-combo-detail-item-specs">
                <div className="vh-combo-detail-item-spec">
                  <Clock size={12} />
                  Thời lượng: {pkg.durationHours} giờ
                </div>
                {pkg.editedPhotosCount && (
                  <div className="vh-combo-detail-item-spec">
                    <ImageIcon size={12} />
                    {pkg.editedPhotosCount} ảnh chỉnh sửa
                  </div>
                )}
                {pkg.deliveryDays && (
                  <div className="vh-combo-detail-item-spec">
                    <Calendar size={12} />
                    Trả ảnh sau {pkg.deliveryDays} ngày
                  </div>
                )}
                {pkg.maxPeople && (
                  <div className="vh-combo-detail-item-spec">
                    <Users size={12} />
                    Tối đa {pkg.maxPeople} người / gói
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form Sections matching PhotographerDetailPage */}
      <div className="vh-combo-detail-booking">
        <div className="vh-combo-detail-booking-card" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* BƯỚC 1: Chọn Kích cỡ & Màu sắc */}
          {(product.sizes?.length || product.colors?.length) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                1. Kích cỡ & màu sắc áo dài
              </h3>

              {product.sizes && product.sizes.length > 0 && (
                <div className="vh-combo-detail-field">
                  <label>Chọn kích cỡ áo dài</label>
                  <div className="vh-combo-detail-chips">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`vh-combo-detail-chip ${selectedSize === size ? 'selected' : ''}`}
                        onClick={() => setSelectedSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.colors && product.colors.length > 0 && (
                <div className="vh-combo-detail-field">
                  <label>Chọn màu sắc áo dài</label>
                  <div className="vh-combo-detail-chips">
                    {product.colors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`vh-combo-detail-chip ${selectedColor === color ? 'selected' : ''}`}
                        onClick={() => setSelectedColor(color)}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BƯỚC 2: Lịch & khung giờ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              2. Lịch & khung giờ
            </h3>

            <PhotographyScheduleSelector
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

            <div style={{ background: '#FFFDF9', border: '1px solid #FDE68A', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>Thời lượng gói dịch vụ: {pkg.durationHours} giờ</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {shootDate && startTime ? `Khung giờ đã chọn: ${startTime} — ${computedEndTime} ngày ${shootDate}` : 'Hãy chọn ngày và giờ bắt đầu trên lịch.'}
                </div>
              </div>
            </div>
          </div>

          {/* BƯỚC 3: Địa điểm chụp */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              3. Địa điểm chụp ảnh
            </h3>

            <PhotographyLocationPicker
              value={selectedLocation}
              onSelect={setSelectedLocation}
            />
          </div>

          {/* Bottom Checkout Action */}
          <div style={{
            backgroundColor: '#FFFDF9',
            border: '2px solid #8B1E22',
            borderRadius: '16px',
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(139, 30, 34, 0.12)',
            gap: '20px',
            flexWrap: 'wrap',
            marginTop: '16px'
          }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>Tổng cộng Combo trọn gói:</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#8B1E22' }}>{discountedPrice.toLocaleString('vi-VN')}đ</span>
                <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '14px' }}>{originalPrice.toLocaleString('vi-VN')}đ</span>
                <span style={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                  Tiết kiệm {savedAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
              {shootDate && startTime ? (
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600, marginTop: '4px' }}>
                  ✓ Đã chọn ngày {shootDate} ({startTime} - {computedEndTime})
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>
                  ⚠️ Vui lòng chọn ngày và giờ chụp trên lịch ở Bước 2
                </div>
              )}
            </div>

            <button
              type="button"
              className="vh-combo-detail-cta"
              onClick={handleBookCombo}
              disabled={!canBook}
              style={{ margin: 0, minWidth: '240px' }}
            >
              <ShoppingBag size={18} />
              ĐẶT COMBO NGAY
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default ComboDetailPage;
