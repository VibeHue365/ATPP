import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';

import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { useCart } from '../../context/CartContext';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { checkProductAvailability } from '../../features/rentals/services/productAvailabilityService';
import { useProductAvailability } from '../../features/rentals/hooks/useProductAvailability';
import { VirtualTryOn3DModal } from '../../features/virtual-tryon-3d/components/VirtualTryOn3DModal';

// Local modular components & utilities
import type {
  CalendarDay,
  FitPreference,
  InfoTab,
  ProductDetail,
  ProviderScheduleInfo,
  RentalMode,
  ReviewItem,
  ReviewStats,
  ReviewStatus,
  SuggestedPhotographer,
} from './product-detail/types';
import {
  imagesForColor,
  getImageUrl,
  normalizeCol,
} from './product-detail/utils/colorUtils';
import {
  productSlots,
  timeSlots,
  isTimeSlotOverlap,
  getDayDuration,
  getHourDuration,
} from './product-detail/utils/timeSlotUtils';
import { calculateSizeLocally } from './product-detail/utils/aiSizeCalculator';

import { ProductGallery } from './product-detail/components/ProductGallery';
import { ProductHeaderInfo } from './product-detail/components/ProductHeaderInfo';
import { ProductPriceCard } from './product-detail/components/ProductPriceCard';
import { ProductAiWidget } from './product-detail/components/ProductAiWidget';
import { ProductVariantsBooking } from './product-detail/components/ProductVariantsBooking';
import { ProductInfoTabs } from './product-detail/components/ProductInfoTabs';
import { ProductSuggestedPhotographers } from './product-detail/components/ProductSuggestedPhotographers';
import { ProductReviewsSection } from './product-detail/components/ProductReviewsSection';
import { ProductAiSizeModal } from './product-detail/components/ProductAiSizeModal';
import { ProductWriteReviewModal } from './product-detail/components/ProductWriteReviewModal';
import { ProductMobileStickyBar } from './product-detail/components/ProductMobileStickyBar';

import './product-detail/ProductDetailPage.css';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { addToCart } = useCart();
  const {
    isAuthenticated,
    user,
    toggleFavorite: apiToggleFavorite,
  } = useAuth();

  // Core Product State
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery Active Image
  const [activeImage, setActiveImage] = useState<string>('');

  // Selector choices
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [bookingQty, setBookingQty] = useState<number>(1);

  // Rental configuration: 'DAILY' | 'HOURLY'
  const [rentalMode, setRentalMode] = useState<RentalMode>('DAILY');

  // Date and Time selection
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [singleDate, setSingleDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('07:00');
  const [endTime, setEndTime] = useState<string>('09:00');

  // Busy calendar & schedule info
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [busySlots, setBusySlots] = useState<{ date: string; timeSlot: string }[]>([]);
  const [variantBookedDates, setVariantBookedDates] = useState<Record<string, string[]>>({});
  const [providerScheduleInfo, setProviderScheduleInfo] = useState<ProviderScheduleInfo | null>(null);

  // Description tab
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTab>('details');

  // Favorites
  const [isFav, setIsFav] = useState<boolean>(false);

  // Suggested photographers
  const [suggestedPhotographers, setSuggestedPhotographers] = useState<SuggestedPhotographer[]>([]);

  // Reviews States
  const [realReviews, setRealReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [checkingReviewStatus, setCheckingReviewStatus] = useState<boolean>(false);
  const [reviewSortOrder, setReviewSortOrder] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [reviewFilterHasImage, setReviewFilterHasImage] = useState<boolean>(false);

  // Modals
  const [isAiStylingOpen, setIsAiStylingOpen] = useState<boolean>(false);
  const [isAiSizeOpen, setIsAiSizeOpen] = useState<boolean>(false);
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState<boolean>(false);

  // AI Size Form
  const [aiHeight, setAiHeight] = useState<number | ''>(160);
  const [aiWeight, setAiWeight] = useState<number | ''>(50);
  const [aiChest, setAiChest] = useState<number | ''>(84);
  const [aiWaist, setAiWaist] = useState<number | ''>(66);
  const [aiFitPref, setAiFitPref] = useState<FitPreference>('COMFORT');
  const [aiResultSize, setAiResultSize] = useState<string>('');
  const [aiReason, setAiReason] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Write Review Form
  const [writeRating, setWriteRating] = useState<number>(5);
  const [writeComment, setWriteComment] = useState<string>('');
  const [writeImages, setWriteImages] = useState<string[]>([]);
  const [reviewBookingDetails, setReviewBookingDetails] = useState<{
    bookingId: string;
    bookingItemId: string;
  } | null>(null);
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Availability Hook
  const availability = useProductAvailability({
    productId: product?._id,
    size: selectedSize,
    color: selectedColor,
    rentalFrom: rentalMode === 'DAILY' ? startDate : singleDate,
    rentalTo: rentalMode === 'DAILY' ? endDate : singleDate,
    quantity: bookingQty,
    rentalType: rentalMode,
    startTime: rentalMode === 'HOURLY' ? startTime : undefined,
    endTime: rentalMode === 'HOURLY' ? endTime : undefined,
  });

  // Load product details and busy dates
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await httpClient.get<any>(`/products/${id}`);
        setProduct(data);

        // Track view
        void httpClient.post(`/analytics/products/${id}/view`, {}).catch(() => {});

        // Load busy dates/slots
        let loadedBookedDates: string[] = [];
        try {
          const busyData = await httpClient.get<{
            bookedDates: string[];
            bookedSlots: { date: string; timeSlot: string }[];
            variantBookedDates?: Record<string, string[]>;
            workingDays?: number[];
            offDays?: string[];
            hasSchedule?: boolean;
          }>(`/api/bookings/busy-dates/product/${id}`);
          loadedBookedDates = busyData.bookedDates || [];
          setBusyDates(loadedBookedDates);
          setBusySlots(busyData.bookedSlots || []);
          if (busyData.variantBookedDates) {
            setVariantBookedDates(busyData.variantBookedDates);
          }
          if (busyData.hasSchedule !== undefined) {
            setProviderScheduleInfo({
              hasSchedule: busyData.hasSchedule,
              workingDays: busyData.workingDays || [],
              offDays: busyData.offDays || [],
            });
          }
        } catch (e) {
          console.error('Lỗi tải lịch bận của sản phẩm:', e);
        }

        if (data.images && data.images.length > 0) {
          setActiveImage(data.images[0]);
        }
        if (data.colors && data.colors.length > 0) {
          setSelectedColor(data.colors[0]);
        }
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
          try {
            const me = await httpClient.get<any>('/users/me');
            if (
              me?.hasCompletedOnboarding &&
              me?.preferences?.sizeInfo?.preferredSize
            ) {
              const preferred = me.preferences.sizeInfo.preferredSize.toUpperCase();
              const matchedSize = data.sizes.find(
                (s: string) => s.toUpperCase() === preferred,
              );
              if (matchedSize) {
                setSelectedSize(matchedSize);
              }
            }
          } catch {
            // Not logged in or failed
          }
        }

        // Search first available 3-day range
        let foundRange = false;
        let startDateVal = '';
        let endDateVal = '';
        const maxSearchDays = 60;

        for (let offset = 0; offset < maxSearchDays; offset++) {
          const checkStart = new Date();
          checkStart.setDate(checkStart.getDate() + 1 + offset);
          const startStr = checkStart.toISOString().split('T')[0];

          const checkEnd = new Date(checkStart);
          checkEnd.setDate(checkEnd.getDate() + 2);
          const endStr = checkEnd.toISOString().split('T')[0];

          let hasBusy = false;
          const temp = new Date(checkStart);
          while (temp <= checkEnd) {
            const tempStr = temp.toISOString().split('T')[0];
            if (loadedBookedDates.includes(tempStr)) {
              hasBusy = true;
              break;
            }
            temp.setDate(temp.getDate() + 1);
          }

          if (!hasBusy) {
            startDateVal = startStr;
            endDateVal = endStr;
            foundRange = true;
            break;
          }
        }

        if (foundRange) {
          setStartDate(startDateVal);
          setEndDate(endDateVal);
          setSingleDate(startDateVal);
        } else {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const nextDay = new Date();
          nextDay.setDate(nextDay.getDate() + 3);
          setStartDate(tomorrow.toISOString().split('T')[0]);
          setEndDate(nextDay.toISOString().split('T')[0]);
          setSingleDate(tomorrow.toISOString().split('T')[0]);
        }
      } catch (err: any) {
        console.error('Lỗi lấy chi tiết sản phẩm:', err);
        setError(err.message || 'Không thể lấy thông tin sản phẩm.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  // Color change update main image
  useEffect(() => {
    const next = imagesForColor(product, selectedColor);
    if (next.length > 0) setActiveImage(next[0]);
  }, [selectedColor, product]);

  // Favorite toggle check
  useEffect(() => {
    if (user?.favorites && id) {
      const isFavorited = user.favorites.some(
        (f: any) =>
          (f.targetType === 'PRODUCT' || f.targetType === 'Product') &&
          f.targetId.toString() === id.toString(),
      );
      setIsFav(isFavorited);
    } else {
      setIsFav(false);
    }
  }, [user, id]);

  const handleToggleFavorite = async () => {
    if (!user) {
      Swal.fire({
        icon: 'warning',
        title: 'Yêu cầu đăng nhập',
        text: 'Vui lòng đăng nhập để lưu sản phẩm yêu thích!',
        confirmButtonColor: 'var(--color-primary)',
        confirmButtonText: 'Đăng nhập ngay',
        showCancelButton: true,
        cancelButtonText: 'Hủy',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
      return;
    }
    try {
      await apiToggleFavorite('PRODUCT', id!);
      if (isFav) {
        toast.success('Đã xóa khỏi danh sách yêu thích!');
      } else {
        toast.success('Đã thêm vào danh sách yêu thích!');
      }
    } catch (err) {
      console.error('Lỗi khi lưu yêu thích:', err);
      toast.error('Không thể cập nhật danh sách yêu thích.');
    }
  };

  // Suggested photographers
  useEffect(() => {
    if (!product) return;
    const fetchSuggestions = async () => {
      try {
        const res = await httpClient.get<any>('/api/photographers');
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (!data.length) {
          setSuggestedPhotographers([]);
          return;
        }

        const productCity = product.providerId?.address?.city || 'Thừa Thiên Huế';
        const normalize = (s: string) =>
          s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        const filtered = data.filter((prov: any) => {
          const provCity = prov.address?.city || '';
          return (
            normalize(provCity).includes(normalize(productCity)) ||
            normalize(productCity).includes(normalize(provCity))
          );
        });

        const listToMap = filtered.length > 0 ? filtered : data;
        const mapped = listToMap.slice(0, 3).map((prov: any) => {
          const displayName = prov.businessName || 'Nhiếp ảnh gia chuyên nghiệp';
          const quote =
            prov.quote ||
            prov.portfolioItems?.[0]?.description ||
            (prov.address?.city
              ? `Chuyên chụp ảnh nghệ thuật & ngoại cảnh tại ${prov.address.city}`
              : 'Chuyên chụp cổ phục ngoại cảnh và bộ sưu tập nghệ thuật');

          const rawImage =
            prov.coverImage ||
            prov.media?.coverUrl ||
            prov.media?.images?.[0] ||
            prov.packages?.[0]?.images?.[0] ||
            prov.portfolioItems?.[0]?.images?.[0] ||
            prov.portfolio?.[0] ||
            prov.avatar;

          const avatar = rawImage ? getImageUrl(rawImage) : '/hoang_minh.webp';
          const prices = Array.isArray(prov.packages) && prov.packages.length > 0
            ? prov.packages.map((p: any) => p.price).filter((p: number) => typeof p === 'number' && p > 0)
            : [];
          const minPrice = prices.length > 0 ? Math.min(...prices) : null;

          return {
            id: prov._id,
            name: displayName,
            rating: typeof prov.rating?.averageRating === 'number' ? prov.rating.averageRating : 5.0,
            count: typeof prov.rating?.totalReviews === 'number' ? prov.rating.totalReviews : 0,
            desc: quote,
            price: minPrice ? `${minPrice.toLocaleString('vi-VN')}đ` : 'Liên hệ',
            image: avatar,
          };
        });

        setSuggestedPhotographers(mapped);
      } catch (err) {
        console.warn('Lỗi lấy danh sách thợ gợi ý:', err);
        setSuggestedPhotographers([]);
      }
    };

    fetchSuggestions();
  }, [product]);

  // Hourly min duration validation rule (at least 2 hours)
  useEffect(() => {
    if (rentalMode === 'HOURLY') {
      const startIndex = timeSlots.indexOf(startTime);
      const endIndex = timeSlots.indexOf(endTime);
      const minEndIndex = startIndex + 4; // 2 hours = 4 x 30min slots

      if (endIndex < minEndIndex && startIndex !== -1) {
        const targetEndIndex = Math.min(minEndIndex, timeSlots.length - 1);
        setEndTime(timeSlots[targetEndIndex]);
      }
    }
  }, [startTime, rentalMode, endTime]);

  // Busy Dates calculation
  const activeBusyDates = useMemo(() => {
    let combined = [...busyDates];
    if (selectedSize && selectedColor) {
      const key = `${selectedSize.trim().toUpperCase()}_${normalizeCol(selectedColor)}`;
      if (variantBookedDates[key]) {
        combined = Array.from(new Set([...combined, ...variantBookedDates[key]]));
      }
    }
    return combined;
  }, [selectedSize, selectedColor, variantBookedDates, busyDates]);

  const bookedSlotsOnSelectedDate = useMemo(() => {
    if (!singleDate) return [];
    return busySlots
      .filter((s) => s.date === singleDate)
      .map((s) => s.timeSlot);
  }, [singleDate, busySlots]);

  // Calendar Days calculation
  const calendarDays = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: CalendarDay[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        day: 0,
        dateStr: '',
        isWeekend: false,
        isAvailable: false,
        isEmpty: true,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const [yNum, mNum, dNum] = dateStr.split('-').map(Number);
      const dateObj = new Date(yNum, mNum - 1, dNum);
      const dayOfWeek = dateObj.getDay();

      let isAvailable = !activeBusyDates.includes(dateStr) && dateStr >= todayStr;

      if (providerScheduleInfo) {
        if (!providerScheduleInfo.hasSchedule) {
          isAvailable = false;
        } else {
          if (providerScheduleInfo.workingDays && providerScheduleInfo.workingDays.length > 0) {
            if (!providerScheduleInfo.workingDays.includes(dayOfWeek)) {
              isAvailable = false;
            }
          }
          if (providerScheduleInfo.offDays && providerScheduleInfo.offDays.includes(dateStr)) {
            isAvailable = false;
          }
        }
      }

      if (rentalMode === 'HOURLY' && dateStr === todayStr) {
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
  }, [calendarDate, activeBusyDates, rentalMode, providerScheduleInfo]);

  const startSlotIndex = useMemo(() => {
    return productSlots.findIndex((s) => s.start === startTime);
  }, [startTime]);

  const endSlotIndex = useMemo(() => {
    return productSlots.findIndex((s) => s.end === endTime);
  }, [endTime]);

  // Auto-select first available slot when date changes
  useEffect(() => {
    if (rentalMode !== 'HOURLY' || !singleDate) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const firstAvailableIndex = productSlots.findIndex((block) => {
      const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
        isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
      );
      const isPast =
        singleDate === todayStr &&
        (() => {
          const [sh, sm] = block.start.split(':').map(Number);
          return (
            sh < today.getHours() ||
            (sh === today.getHours() && sm <= today.getMinutes())
          );
        })();
      return !isBusy && !isPast;
    });

    if (firstAvailableIndex !== -1) {
      setStartTime(productSlots[firstAvailableIndex].start);
      setEndTime(productSlots[firstAvailableIndex].end);
    }
  }, [singleDate, bookedSlotsOnSelectedDate, rentalMode]);

  const handleSlotClick = (i: number) => {
    const block = productSlots[i];
    const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
    );
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isPast =
      singleDate === todayStr &&
      (() => {
        const [sh, sm] = block.start.split(':').map(Number);
        return (
          sh < today.getHours() ||
          (sh === today.getHours() && sm <= today.getMinutes())
        );
      })();

    if (isBusy || isPast) return;

    const currentStartIdx = productSlots.findIndex((s) => s.start === startTime);
    const currentEndIdx = productSlots.findIndex((s) => s.end === endTime);

    if (
      currentStartIdx === -1 ||
      currentStartIdx !== currentEndIdx ||
      i < currentStartIdx
    ) {
      setStartTime(block.start);
      setEndTime(block.end);
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
            return (
              sh < today.getHours() ||
              (sh === today.getHours() && sm <= today.getMinutes())
            );
          })();
        if (checkBusy || checkPast) {
          hasBusyOrPastInRange = true;
          break;
        }
      }

      if (hasBusyOrPastInRange) {
        toast.error('Khoảng thời gian chọn chứa khung giờ đã bận hoặc đã qua!');
        setStartTime(block.start);
        setEndTime(block.end);
      } else {
        setEndTime(block.end);
      }
    }
  };

  const selectedTimeSlot = `${startTime}-${endTime}`;
  const isCurrentTimeSlotBusy = useMemo(() => {
    if (rentalMode !== 'HOURLY') return false;
    return bookedSlotsOnSelectedDate.some((bookedSlot) => {
      if (!bookedSlot) return false;
      return isTimeSlotOverlap(selectedTimeSlot, bookedSlot);
    });
  }, [rentalMode, selectedTimeSlot, bookedSlotsOnSelectedDate]);

  const handleCalendarDayClick = (dateStr: string) => {
    if (rentalMode === 'HOURLY') {
      setSingleDate(dateStr);
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else {
      if (busyDates.includes(dateStr)) {
        toast.error('Ngày này đã bị đặt lịch!');
        return;
      }
      if (!startDate || (startDate && endDate)) {
        setStartDate(dateStr);
        setEndDate('');
      } else {
        if (dateStr < startDate) {
          setStartDate(dateStr);
          setEndDate('');
        } else {
          const hasUnavailable = calendarDays.some(
            (d) =>
              !d.isEmpty &&
              !d.isAvailable &&
              d.dateStr >= startDate &&
              d.dateStr <= dateStr,
          );
          if (hasUnavailable) {
            toast.error('Khoảng thời gian chọn chứa ngày đã bị đặt!');
            return;
          }
          setEndDate(dateStr);
        }
      }
    }
  };

  // Price calculations
  const numericComputedPrice = useMemo((): number => {
    if (!product) return 0;
    const base = product.activeCampaign && product.discountedPrice
      ? product.discountedPrice
      : product.basePrice;

    if (rentalMode === 'DAILY') {
      const days = getDayDuration(startDate, endDate);
      return base * days;
    } else {
      const hours = getHourDuration(startTime, endTime);
      const hourlyRate = product.hourlyPrice || Math.round(base * 0.3) || 80000;
      return hourlyRate * hours;
    }
  }, [product, rentalMode, startDate, endDate, startTime, endTime]);

  const getDisplayPrice = (): string => {
    if (!product) return '0đ';
    if (rentalMode === 'DAILY') {
      const days = getDayDuration(startDate, endDate);
      return `${numericComputedPrice.toLocaleString('vi-VN')}đ / ${days} ngày`;
    } else {
      const hours = getHourDuration(startTime, endTime);
      return `${numericComputedPrice.toLocaleString('vi-VN')}đ / ${hours} giờ`;
    }
  };

  // Reviews logic
  const fetchRealReviews = async () => {
    if (!id) return;
    try {
      setLoadingReviews(true);
      const res: any = await httpClient.get(`/reviews/item/${id}`);
      setRealReviews(res || []);
    } catch (e) {
      console.error('Lỗi tải đánh giá sản phẩm:', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchReviewStatus = async () => {
    if (!id || !isAuthenticated) {
      setReviewStatus(null);
      return;
    }
    try {
      const res: any = await httpClient.get(`/reviews/my-status/${id}`);
      setReviewStatus(res);
    } catch {
      setReviewStatus(null);
    }
  };

  useEffect(() => {
    fetchRealReviews();
  }, [id]);

  useEffect(() => {
    fetchReviewStatus();
  }, [id, isAuthenticated]);

  const reviewStats: ReviewStats = useMemo(() => {
    const totalReviews = realReviews.length;
    if (totalReviews === 0) {
      return {
        averageRating: product?.rating?.averageRating || 0,
        totalReviews: product?.rating?.totalReviews || 0,
        breakdown: { 5: '0%', 4: '0%', 3: '0%', 2: '0%', 1: '0%' },
      };
    }
    const sum = realReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = Math.round((sum / totalReviews) * 10) / 10;

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    realReviews.forEach((r) => {
      const star = Math.floor(r.rating) as 5 | 4 | 3 | 2 | 1;
      if (counts[star] !== undefined) {
        counts[star]++;
      }
    });

    const breakdown = {
      5: `${Math.round((counts[5] / totalReviews) * 100)}%`,
      4: `${Math.round((counts[4] / totalReviews) * 100)}%`,
      3: `${Math.round((counts[3] / totalReviews) * 100)}%`,
      2: `${Math.round((counts[2] / totalReviews) * 100)}%`,
      1: `${Math.round((counts[1] / totalReviews) * 100)}%`,
    };

    return {
      averageRating: avg,
      totalReviews,
      breakdown,
    };
  }, [realReviews, product]);

  const displayedReviews = useMemo(() => {
    let filtered = [...realReviews];
    if (reviewFilterHasImage) {
      filtered = filtered.filter((r) => r.images && r.images.length > 0);
    }
    if (reviewSortOrder === 'newest') {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    } else if (reviewSortOrder === 'highest') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (reviewSortOrder === 'lowest') {
      filtered.sort((a, b) => a.rating - b.rating);
    }
    return filtered;
  }, [realReviews, reviewSortOrder, reviewFilterHasImage]);

  const handleReportReview = async (reviewId: string) => {
    try {
      await httpClient.post(`/reviews/${reviewId}/report`, {
        reason: 'Spam hoặc không phù hợp',
      });
      toast.success('Báo cáo đánh giá vi phạm thành công!');
    } catch {
      toast.error('Báo cáo đánh giá thất bại');
    }
  };

  const handleWriteReviewClick = async () => {
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để viết đánh giá.');
      navigate(ROUTES.LOGIN, { state: { from: location } });
      return;
    }

    if (reviewStatus) {
      if (reviewStatus.alreadyReviewed) {
        toast.success('Bạn đã gửi đánh giá cho sản phẩm này rồi. Cảm ơn bạn!');
        return;
      }
      if (!reviewStatus.hasCompletedBooking) {
        await Swal.fire({
          title: 'Chưa có đơn thuê hoàn thành',
          html: `
            <div style="text-align:left;font-size:14px;line-height:1.6;color:#4B4540">
              <p>Để viết đánh giá, bạn cần hoàn thành ít nhất <strong>01 đơn thuê</strong> sản phẩm này.</p>
              <br/>
              <p>📌 <strong>Quy trình:</strong> Đặt lịch → Thanh toán → Nhà cung cấp xác nhận → Nhận đồ → Trả đồ → Hoàn thành → Viết đánh giá</p>
            </div>`,
          icon: 'info',
          confirmButtonColor: 'var(--color-primary-dark)',
          confirmButtonText: 'Đặt lịch ngay',
          showCancelButton: true,
          cancelButtonText: 'Đóng',
          background: 'white',
        }).then((res) => {
          if (res.isConfirmed) {
            document
              .getElementById('booking-section')
              ?.scrollIntoView({ behavior: 'smooth' });
          }
        });
        return;
      }
      if (
        reviewStatus.canReview &&
        reviewStatus.bookingId &&
        reviewStatus.bookingItemId
      ) {
        setReviewBookingDetails({
          bookingId: reviewStatus.bookingId,
          bookingItemId: reviewStatus.bookingItemId,
        });
        setIsWriteReviewOpen(true);
        return;
      }
    }

    setCheckingReviewStatus(true);
    try {
      const status: any = await httpClient.get(`/reviews/my-status/${id}`);
      setReviewStatus(status);

      if (status.alreadyReviewed) {
        toast.success('Bạn đã gửi đánh giá cho sản phẩm này rồi!');
        return;
      }

      if (!status.hasCompletedBooking) {
        await Swal.fire({
          title: 'Chưa có đơn thuê hoàn thành',
          html: `
            <div style="text-align:left;font-size:14px;line-height:1.6;color:#4B4540">
              <p>Để viết đánh giá, bạn cần hoàn thành ít nhất <strong>01 đơn thuê</strong> sản phẩm này.</p>
              <br/>
              <p>📌 <strong>Quy trình:</strong> Đặt lịch → Thanh toán → Nhà cung cấp xác nhận → Nhận đồ → Trả đồ → Hoàn thành → Viết đánh giá</p>
            </div>`,
          icon: 'info',
          confirmButtonColor: 'var(--color-primary-dark)',
          confirmButtonText: 'Đặt lịch ngay',
          showCancelButton: true,
          cancelButtonText: 'Đóng',
          background: 'white',
        }).then((res) => {
          if (res.isConfirmed) {
            document
              .getElementById('booking-section')
              ?.scrollIntoView({ behavior: 'smooth' });
          }
        });
        return;
      }

      if (status.canReview && status.bookingId && status.bookingItemId) {
        setReviewBookingDetails({
          bookingId: status.bookingId,
          bookingItemId: status.bookingItemId,
        });
        setIsWriteReviewOpen(true);
      }
    } catch {
      toast.error('Có lỗi xảy ra khi kiểm tra quyền đánh giá.');
    } finally {
      setCheckingReviewStatus(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBookingDetails) return;
    if (!writeComment.trim()) {
      toast.error('Vui lòng nhập nội dung đánh giá.');
      return;
    }

    setSubmittingReview(true);
    try {
      await httpClient.post('/reviews', {
        bookingId: reviewBookingDetails.bookingId,
        bookingItemId: reviewBookingDetails.bookingItemId,
        rating: writeRating,
        comment: writeComment.trim(),
        images: writeImages,
        productId: id,
      });

      toast.success('Gửi đánh giá thành công! Cảm ơn bạn đã chia sẻ trải nghiệm.');
      setIsWriteReviewOpen(false);
      setWriteComment('');
      setWriteRating(5);
      setWriteImages([]);
      setReviewBookingDetails(null);
      fetchRealReviews();
      fetchReviewStatus();
    } catch (err: any) {
      toast.error(err.message || 'Gửi đánh giá thất bại. Vui lòng thử lại.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // AI Size Calculation
  const handleAiSizeCalculation = async () => {
    const h = Math.max(100, Math.min(250, Number(aiHeight) || 160));
    const w = Math.max(20, Math.min(200, Number(aiWeight) || 50));
    const c = Math.max(40, Math.min(150, Number(aiChest) || 84));
    const e = Math.max(30, Math.min(150, Number(aiWaist) || 66));

    setAiHeight(h);
    setAiWeight(w);
    setAiChest(c);
    setAiWaist(e);

    setIsAiLoading(true);
    setAiResultSize('');
    setAiReason('');

    const computedSize = calculateSizeLocally(h, w, c, e, aiFitPref, product?.sizes);

    try {
      let prompt = '';
      if (computedSize === 'CUSTOM') {
        prompt = `Tôi muốn thuê áo dài "${product?.name}". Số đo: cao ${h}cm, nặng ${w}kg, vòng eo ${e}cm, vòng ngực ${c}cm. Tôi thích mặc kiểu ${aiFitPref === 'SLIM' ? 'ôm sát tôn dáng' : 'rộng rãi thoải mái'}. Số đo này vượt quá bảng size may sẵn tiêu chuẩn hoặc vượt quá các size hiện có của sản phẩm này (${product?.sizes?.join(', ') || 'S, M, L'}). Hãy tư vấn cho tôi lý do tôi cần liên hệ trực tiếp với cửa hàng để được đặt may đo hoặc chỉnh sửa theo số đo cơ thể, và khuyên tôi không nên thuê các size may sẵn hiện có. Hãy trả lời ngắn gọn trong 2-3 câu.`;
      } else {
        prompt = `Tôi muốn thuê áo dài "${product?.name}". Số đo: cao ${h}cm, nặng ${w}kg, vòng eo ${e}cm, vòng ngực ${c}cm. Tôi thích mặc kiểu ${aiFitPref === 'SLIM' ? 'ôm sát tôn dáng' : 'rộng rãi thoải mái'}. Hãy tư vấn xem tôi nên chọn size nào trong các size khả dụng: ${product?.sizes?.join(', ') || 'S, M, L'}. Hãy khuyên dùng size ${computedSize} và giải thích lý do cụ thể trong 2-3 câu ngắn gọn.`;
      }

      const response: any = await httpClient.post('/ai/chat', { message: prompt });
      setAiResultSize(computedSize);

      if (computedSize === 'CUSTOM') {
        setAiReason(
          response.answer ||
            `Số đo bạn nhập (cân nặng ${w}kg, vòng eo ${e}cm) vượt quá bảng size may sẵn tiêu chuẩn của áo dài này. Chúng tôi khuyên bạn nên liên hệ trực tiếp với VibeHue để đặt may hoặc chỉnh sửa số đo riêng nhằm đảm bảo sự vừa vặn và thoải mái cao nhất.`,
        );
      } else {
        setAiReason(
          response.answer ||
            `Dựa trên số đo chiều cao ${h}cm và cân nặng ${w}kg, kích cỡ tối ưu cho bạn là Size ${computedSize}. Size này sẽ giúp bạn thoải mái cử động và giữ phom dáng áo đẹp nhất.`,
        );
      }
    } catch (err) {
      console.error('Lỗi khi gọi AI tư vấn size:', err);
      setAiResultSize(computedSize);
      if (computedSize === 'CUSTOM') {
        setAiReason(
          `Số đo bạn nhập (cân nặng ${w}kg, vòng eo ${e}cm) vượt quá bảng size may sẵn tiêu chuẩn của áo dài này. Chúng tôi khuyên bạn nên liên hệ trực tiếp với VibeHue để đặt may hoặc chỉnh sửa số đo riêng.`,
        );
      } else {
        setAiReason(
          `Dựa trên phân tích số đo chiều cao ${h}cm, cân nặng ${w}kg và sở thích mặc của bạn, chuyên gia khuyên dùng Size ${computedSize} để ôm vừa vặn vòng eo ${e}cm của bạn.`,
        );
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  // Validation helper for booking & cart
  const validateBookingForm = (): boolean => {
    if (!selectedColor) {
      toast.error('Vui lòng chọn màu sắc trang phục.');
      document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    if (!selectedSize) {
      toast.error('Vui lòng chọn kích cỡ (Size) trang phục.');
      document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    if (rentalMode === 'DAILY') {
      if (!startDate) {
        toast.error('Vui lòng chọn ngày nhận đồ trên lịch.');
        document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
        return false;
      }
      if (!endDate) {
        toast.error('Vui lòng chọn ngày trả đồ trên lịch.');
        document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
        return false;
      }
      if (endDate < startDate) {
        toast.error('Ngày trả đồ không thể trước ngày nhận đồ.');
        return false;
      }
    } else {
      if (!singleDate) {
        toast.error('Vui lòng chọn ngày thuê theo giờ trên lịch.');
        document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
        return false;
      }
      if (!startTime || !endTime) {
        toast.error('Vui lòng chọn khung giờ thuê trang phục.');
        document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
        return false;
      }
      if (isCurrentTimeSlotBusy) {
        toast.error('Khung giờ này đã có người thuê. Vui lòng chọn giờ hoặc ngày khác.');
        return false;
      }
    }
    if (!bookingQty || bookingQty < 1) {
      toast.error('Số lượng thuê tối thiểu là 1.');
      return false;
    }
    return true;
  };

  // Add to cart & Rent now
  const handleAddToCart = async () => {
    if (!validateBookingForm()) return;
    const rentalFrom = rentalMode === 'DAILY' ? startDate : singleDate;
    const rentalTo = rentalMode === 'DAILY' ? endDate : singleDate;
    try {
      const avail = await checkProductAvailability(
        product?._id || '',
        selectedSize,
        selectedColor,
        rentalFrom,
        rentalTo,
        bookingQty,
        rentalMode,
        rentalMode === 'HOURLY' ? startTime : undefined,
        rentalMode === 'HOURLY' ? endTime : undefined,
      );
      if (!avail.available) {
        toast.error(`Chỉ còn ${avail.availableQuantity} sản phẩm phù hợp trong lịch đã chọn.`);
        return;
      }
    } catch (error: any) {
      toast.error(error.message || 'Không thể kiểm tra lịch thuê.');
      return;
    }

    const days = getDayDuration(startDate, endDate);
    const hours = getHourDuration(startTime, endTime);
    const base = product?.activeCampaign && product?.discountedPrice
      ? product.discountedPrice
      : (product?.basePrice || 0);
    const hourlyRate = product?.hourlyPrice || Math.round(base * 0.3) || 80000;
    const computedPrice = rentalMode === 'DAILY' ? base * days : hourlyRate * hours;

    const cartPayload = {
      itemType: 'PRODUCT' as const,
      productId: product?._id,
      name: product?.name,
      image:
        imagesForColor(product, selectedColor)[0] ||
        product?.images?.[0] ||
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
      basePrice: computedPrice,
      depositAmount: product?.depositAmount,
      size: selectedSize,
      color: selectedColor,
      rentalType: rentalMode,
      startDate: rentalMode === 'DAILY' ? startDate : singleDate,
      endDate: rentalMode === 'DAILY' ? endDate : singleDate,
      startTime: rentalMode === 'HOURLY' ? startTime : undefined,
      endTime: rentalMode === 'HOURLY' ? endTime : undefined,
      providerCity: product?.providerId?.address?.city || 'Thừa Thiên Huế',
      providerAddress: product?.providerId?.address?.addressLine || '',
      comboDiscountPercent: (product?.providerId as any)?.comboDiscountPercent,
      quantity: bookingQty,
    };

    addToCart(cartPayload);
    toast.success('Đã thêm sản phẩm áo dài vào giỏ hàng thành công!');
  };

  const handleBookingSubmit = async () => {
    if (!validateBookingForm()) return;
    const rentalFrom = rentalMode === 'DAILY' ? startDate : singleDate;
    const rentalTo = rentalMode === 'DAILY' ? endDate : singleDate;
    try {
      const avail = await checkProductAvailability(
        product?._id || '',
        selectedSize,
        selectedColor,
        rentalFrom,
        rentalTo,
        bookingQty,
        rentalMode,
        rentalMode === 'HOURLY' ? startTime : undefined,
        rentalMode === 'HOURLY' ? endTime : undefined,
      );
      if (!avail.available) {
        toast.error(`Chỉ còn ${avail.availableQuantity} sản phẩm phù hợp trong lịch đã chọn.`);
        return;
      }
    } catch (error: any) {
      toast.error(error.message || 'Không thể kiểm tra lịch thuê.');
      return;
    }

    const days = getDayDuration(startDate, endDate);
    const hours = getHourDuration(startTime, endTime);
    const baseForBooking = product?.activeCampaign && product?.discountedPrice
      ? product.discountedPrice
      : (product?.basePrice || 0);
    const hourlyRate = product?.hourlyPrice || Math.round(baseForBooking * 0.3) || 80000;
    const computedPrice = rentalMode === 'DAILY' ? baseForBooking * days : hourlyRate * hours;

    const cartPayload = {
      itemType: 'PRODUCT' as const,
      productId: product?._id,
      name: product?.name,
      image:
        imagesForColor(product, selectedColor)[0] ||
        product?.images?.[0] ||
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
      basePrice: computedPrice,
      depositAmount: product?.depositAmount,
      size: selectedSize,
      color: selectedColor,
      rentalType: rentalMode,
      startDate: rentalMode === 'DAILY' ? startDate : singleDate,
      endDate: rentalMode === 'DAILY' ? endDate : singleDate,
      startTime: rentalMode === 'HOURLY' ? startTime : undefined,
      endTime: rentalMode === 'HOURLY' ? endTime : undefined,
      providerCity: product?.providerId?.address?.city || 'Thừa Thiên Huế',
      providerAddress: product?.providerId?.address?.addressLine || '',
      comboDiscountPercent: (product?.providerId as any)?.comboDiscountPercent,
      quantity: bookingQty,
    };

    addToCart(cartPayload);
    toast.success('Đã thêm sản phẩm áo dài vào giỏ hàng!');
    navigate(ROUTES.CART);
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '80vh',
          gap: '16px',
        }}
      >
        <div className="vh-loading-spinner">
          <div className="vh-loading-double-bounce1"></div>
          <div className="vh-loading-double-bounce2"></div>
        </div>
        <span className="font-header text-stone-600">
          Đang tải chi tiết áo dài...
        </span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center">
        <h3 className="text-2xl font-bold font-header text-stone-800">
          Đã xảy ra lỗi
        </h3>
        <p className="text-stone-500 mt-2">
          {error || 'Không tìm thấy sản phẩm.'}
        </p>
        <button
          className="vh-btn vh-btn-primary mt-6"
          onClick={() => navigate(ROUTES.RENTALS)}
        >
          QUAY LẠI TRANG CHỦ
        </button>
      </div>
    );
  }

  return (
    <div className="vh-pd-wrapper">
      {/* Campaign Banner */}
      {product.activeCampaign && (
        <div className="vh-pd-campaign-wrapper">
          <div className="vh-pd-campaign-card">
            <div className="vh-pd-campaign-discount">
              -{product.activeCampaign.discountPercent}%
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>
                Ưu đãi {product.activeCampaign.occasion} · Giảm {product.activeCampaign.discountPercent}%
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 500, opacity: 0.92, marginTop: '2px' }}>
                Áp dụng đến hết ngày {new Date(product.activeCampaign.endDate).toLocaleDateString('vi-VN')} — đặt ngay kẻo lỡ!
              </div>
            </div>
            <span className="vh-pd-campaign-badge">
              ĐANG DIỄN RA
            </span>
          </div>
        </div>
      )}

      <div className="vh-pd-container">
        {/* Breadcrumbs */}
        <nav className="vh-pd-breadcrumb">
          <span className="vh-pd-breadcrumb-link" onClick={() => navigate('/')}>
            Trang chủ
          </span>
          <ChevronRight size={14} style={{ color: '#a8a29e' }} />
          <span className="vh-pd-breadcrumb-link" onClick={() => navigate('/rentals')}>
            Bộ sưu tập áo dài
          </span>
          <ChevronRight size={14} style={{ color: '#a8a29e' }} />
          <span style={{ color: '#1c1917', fontWeight: 600 }}>
            {product.name}
          </span>
        </nav>

        {/* Main 2-Column Split */}
        <div className="vh-pd-main-grid">
          {/* Left: Gallery */}
          <ProductGallery
            product={product}
            activeImage={activeImage}
            onSelectImage={setActiveImage}
            isFav={isFav}
            onToggleFav={handleToggleFavorite}
          />

          {/* Right: Info, Price, AI Widget, Config & Booking */}
          <div id="booking-section" className="vh-pd-info-col">
            <ProductHeaderInfo
              product={product}
              onNavigateStore={(providerId) => navigate(`/stores/${providerId}`)}
            />

            <ProductPriceCard
              product={product}
              displayPrice={getDisplayPrice()}
            />

            <ProductAiWidget
              onOpenVirtualTryOn={() => setIsAiStylingOpen(true)}
              onOpenAiSize={() => setIsAiSizeOpen(true)}
            />

            <ProductVariantsBooking
              product={product}
              selectedColor={selectedColor}
              onSelectColor={setSelectedColor}
              selectedSize={selectedSize}
              onSelectSize={setSelectedSize}
              rentalMode={rentalMode}
              onChangeRentalMode={setRentalMode}
              calendarDate={calendarDate}
              onChangeCalendarDate={setCalendarDate}
              calendarDays={calendarDays}
              onSelectCalendarDay={handleCalendarDayClick}
              startDate={startDate}
              endDate={endDate}
              singleDate={singleDate}
              startTime={startTime}
              endTime={endTime}
              onSelectSlot={handleSlotClick}
              bookedSlotsOnSelectedDate={bookedSlotsOnSelectedDate}
              isTimeSlotOverlap={isTimeSlotOverlap}
              startSlotIndex={startSlotIndex}
              endSlotIndex={endSlotIndex}
              isCurrentTimeSlotBusy={isCurrentTimeSlotBusy}
              availability={availability}
              bookingQty={bookingQty}
              onChangeBookingQty={setBookingQty}
              onAddToCart={handleAddToCart}
              onRentNow={handleBookingSubmit}
            />
          </div>
        </div>

        {/* Bottom: Tabs */}
        <ProductInfoTabs
          product={product}
          activeInfoTab={activeInfoTab}
          onChangeTab={setActiveInfoTab}
        />

        {/* Bottom: Photographers */}
        <ProductSuggestedPhotographers
          photographers={suggestedPhotographers}
          onNavigatePhotographer={(photographerId) =>
            navigate(`/photographers/${photographerId}`)
          }
        />

        {/* Bottom: Reviews Section */}
        <ProductReviewsSection
          reviews={displayedReviews}
          loadingReviews={loadingReviews}
          reviewStats={reviewStats}
          reviewStatus={reviewStatus}
          checkingReviewStatus={checkingReviewStatus}
          reviewSortOrder={reviewSortOrder}
          onChangeSortOrder={setReviewSortOrder}
          reviewFilterHasImage={reviewFilterHasImage}
          onChangeFilterHasImage={setReviewFilterHasImage}
          onWriteReviewClick={handleWriteReviewClick}
          onReportReview={handleReportReview}
        />
      </div>

      {/* Interactive Modals */}
      <VirtualTryOn3DModal
        isOpen={isAiStylingOpen}
        onClose={() => setIsAiStylingOpen(false)}
        productImage={getImageUrl(product.images?.[0] || '')}
        productName={product.name}
      />

      <ProductAiSizeModal
        isOpen={isAiSizeOpen}
        onClose={() => setIsAiSizeOpen(false)}
        productName={product.name}
        aiHeight={aiHeight}
        setAiHeight={setAiHeight}
        aiWeight={aiWeight}
        setAiWeight={setAiWeight}
        aiChest={aiChest}
        setAiChest={setAiChest}
        aiWaist={aiWaist}
        setAiWaist={setAiWaist}
        aiFitPref={aiFitPref}
        setAiFitPref={setAiFitPref}
        aiResultSize={aiResultSize}
        aiReason={aiReason}
        isAiLoading={isAiLoading}
        onCalculate={handleAiSizeCalculation}
        onApplySize={(size) => {
          setSelectedSize(size);
          toast.success(`Đã áp dụng đề xuất Size ${size}!`);
          setIsAiSizeOpen(false);
        }}
        onContactCustom={() => {
          toast.info(
            'Vui lòng liên hệ hotline hoặc nhắn tin trực tiếp để được tư vấn thiết kế may đo riêng!',
          );
          window.open('https://zalo.me/', '_blank');
          setIsAiSizeOpen(false);
        }}
      />

      <ProductWriteReviewModal
        isOpen={isWriteReviewOpen}
        onClose={() => setIsWriteReviewOpen(false)}
        writeRating={writeRating}
        setWriteRating={setWriteRating}
        writeComment={writeComment}
        setWriteComment={setWriteComment}
        writeImages={writeImages}
        setWriteImages={setWriteImages}
        submittingReview={submittingReview}
        onSubmitReview={handleReviewSubmit}
      />

      {/* Mobile Sticky Action Bar */}
      <ProductMobileStickyBar
        computedPrice={numericComputedPrice}
        depositAmount={product.depositAmount || 0}
        rentalMode={rentalMode}
        onRentNow={handleBookingSubmit}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
};

export default ProductDetailPage;
