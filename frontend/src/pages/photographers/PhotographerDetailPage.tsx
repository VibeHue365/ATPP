import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/feedback/Toast';
import { httpClient } from '../../services/httpClient';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../features/auth/hooks/useAuth';
import './PhotographerDetailPage.css';
import './PhotographerPackageDetail.css';
import Swal from 'sweetalert2';
import { usePhotographerDetail } from '../../features/photographers/hooks/usePhotographerDetail';
import type { LocationSelection, PhotographerPackage as Package, PhotographyQuote } from '../../features/photographers/types/photographer.types';
import { photographersApi } from '../../features/photographers/api/photographers.api';
import { PhotographerPortfolioLightbox, type PhotographerPortfolioImage } from '../../features/photographers/components/PhotographerPortfolioLightbox';
import type { PhotographySessionDraft } from '../../features/photographers/components/PhotographyMultiSessionEditor';
import type { PhotographyCalendarDay } from '../../features/photographers/components/PhotographyScheduleSelector';
import type { PhotographerReview } from '../../features/photographers/components/PhotographerReviews';
import { PhotographerPackageDetailLayout } from '../../features/photographers/components/PhotographerPackageDetailLayout';
type PhotographerAvailabilityStatus = 'AVAILABLE' | 'FULL' | 'NO_SCHEDULE' | 'OFF_DAY' | 'PAST';

type MonthlyAvailabilityResponse = {
  month: string;
  days: Array<{ date: string; status: PhotographerAvailabilityStatus }>;
};

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const distanceKm = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;


export const PhotographerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { cart, addToCart } = useCart();
  const { isAuthenticated, user, toggleFavorite: apiToggleFavorite } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  // Sync favorites with user context
  useEffect(() => {
    if (user?.favorites) {
      const favIds = user.favorites
        .filter((f: any) => f.targetType === 'PROVIDER' || f.targetType === 'Provider')
        .map((f: any) => f.targetId.toString());
      setFavorites(favIds);
    } else {
      setFavorites([]);
    }
  }, [user]);

  const handleToggleFavorite = async (favId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      Swal.fire({
        icon: 'warning',
        title: 'Yêu cầu đăng nhập',
        text: 'Vui lòng đăng nhập để lưu nhiếp ảnh gia yêu thích!',
        confirmButtonColor: 'var(--color-primary-dark)',
        confirmButtonText: 'Đăng nhập ngay',
        showCancelButton: true,
        cancelButtonText: 'Hủy',
        background: 'white',
        customClass: {
          popup: 'font-body',
        }
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/auth/login');
        }
      });
      return;
    }
    try {
      const isAlreadyFavorite = favorites.includes(favId);
      await apiToggleFavorite('PROVIDER', favId);
      if (isAlreadyFavorite) {
        toast.success('Đã xóa khỏi danh sách yêu thích!');
      } else {
        toast.success('Đã thêm vào danh sách yêu thích!');
      }
    } catch (err: any) {
      toast.error('Có lỗi xảy ra khi cập nhật yêu thích');
    }
  };
  const location = useLocation();

  const { photographer, isLoading: loading, error } = usePhotographerDetail(id);
  const [reviews, setReviews] = useState<PhotographerReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(true);

  // Lightbox States
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const allPortfolioImages = useMemo<PhotographerPortfolioImage[]>(() => {
    if (!photographer) return [];
    const portfolioImages = photographer.portfolioItems.flatMap((item) => {
      const images = item.images.filter(Boolean);
      return images.map((src, index) => ({
        src,
        title: item.title,
        description: item.description || undefined,
        imageNumber: index + 1,
        imageCount: images.length,
      }));
    });
    const packageImages = photographer.packages.flatMap((pkg) => (pkg.images || []).filter(Boolean)).map((src, index, images) => ({
      src,
      title: photographer.packages.find((pkg) => pkg.images?.includes(src))?.name || `Ảnh package #${index + 1}`,
      imageNumber: index + 1,
      imageCount: images.length,
    }));
    const legacyImages = photographer.portfolio.length && !portfolioImages.length
      ? photographer.portfolio.filter(Boolean).map((src, index, images) => ({
        src,
        title: `Tác phẩm #${index + 1}`,
        imageNumber: index + 1,
        imageCount: images.length,
      }))
      : [];
    return [...portfolioImages, ...legacyImages, ...packageImages.filter((image) => !portfolioImages.some((item) => item.src === image.src) && !legacyImages.some((item) => item.src === image.src))];
  }, [photographer]);

  const handleImageClick = (imageSrc: string) => {
    const index = allPortfolioImages.findIndex((image) => image.src === imageSrc);
    if (index >= 0) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const handlePreviousImage = () => {
    setLightboxIndex((current) =>
      current === 0 ? allPortfolioImages.length - 1 : current - 1,
    );
  };

  const handleNextImage = () => {
    setLightboxIndex((current) =>
      current === allPortfolioImages.length - 1 ? 0 : current + 1,
    );
  };

  // Booking Form States
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [schedulePreviewDate, setSchedulePreviewDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const includedDurationMinutes = Math.max(selectedPkg?.includedDurationMinutes ?? Math.round((selectedPkg?.durationHours ?? 2) * 60), 30);
  const overtimeIncrementMinutes = Math.max(selectedPkg?.overtimeIncrementMinutes ?? 30, 30);
  const maxOvertimeMinutes = Math.max(selectedPkg?.maxOvertimeMinutes ?? 240, 0);
  const selectedPricingUnit = selectedPkg?.pricingUnit ?? 'PER_SESSION';
  const minimumMultiSessionMinutes = selectedPricingUnit === 'PER_SESSION' ? includedDurationMinutes : 30;
  const effectiveDurationMinutes = Math.max(durationMinutes || includedDurationMinutes, includedDurationMinutes);
  const endTime = startTime ? toTime(toMinutes(startTime) + effectiveDurationMinutes) : '';
  const selectedTimeSlot = startTime && endTime ? `${startTime} - ${endTime}` : '';
  const [quote, setQuote] = useState<PhotographyQuote | null>(null);
  const [nextDurationQuote, setNextDurationQuote] = useState<PhotographyQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isNextDurationQuoteLoading, setIsNextDurationQuoteLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [customRequest, setCustomRequest] = useState<string>('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [bookingMode, setBookingMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [multiSessions, setMultiSessions] = useState<PhotographySessionDraft[]>([]);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  // Calendar navigation & booking state
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isBookingNow, setIsBookingNow] = useState<boolean>(false);
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [busySlots, setBusySlots] = useState<{ date: string, timeSlot: string }[]>([]);
  const [availableTimeRanges, setAvailableTimeRanges] = useState<Array<{ start: string; end: string }>>([]);
  const [monthlyAvailability, setMonthlyAvailability] = useState<Record<string, PhotographerAvailabilityStatus>>({});
  const [isMonthlyAvailabilityLoading, setIsMonthlyAvailabilityLoading] = useState(false);

  // Check if cart has an Ao Dai to auto-fill details
  const aoDaiInCart = cart.find((item) => item.itemType === 'PRODUCT');

  const rentalFrom = aoDaiInCart?.rentalFrom || aoDaiInCart?.startDate;

  const photographerCity = photographer?.address?.city || "";

  const isCitySynced = true;

  const formatSingleDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    if (dateStr.includes('/')) return dateStr;
    return dateStr;
  };


  // Load booking availability separately from the public photographer profile.
  useEffect(() => {
    const fetchBookingAvailability = async () => {
      const targetId = photographer?.providerId || id;
      if (!targetId) return;
      try {
        const busyData = await httpClient.get<{ bookedDates: string[]; bookedSlots: { date: string; timeSlot: string }[] }>(`/api/bookings/busy-dates/provider/${targetId}`);
        setBusyDates(busyData.bookedDates || []);
        setBusySlots(busyData.bookedSlots || []);
      } catch (bookingError) {
        console.error('Không thể tải lịch bận của nhiếp ảnh gia:', bookingError);
        setBusyDates([]);
        setBusySlots([]);
      }
    };

    void fetchBookingAvailability();
  }, [id, photographer?.providerId]);

  useEffect(() => {
    if (!photographer?.packages.length) {
      setSelectedPkg(null);
      return;
    }

    const selectedPackageId = location.state?.selectedPackageId || new URLSearchParams(location.search).get('packageId');
    const selectedPackage = selectedPackageId
      ? photographer.packages.find((item) => item._id === selectedPackageId)
      : undefined;
    setSelectedPkg(selectedPackage ?? photographer.packages[0]);
  }, [location.search, location.state, photographer]);

  useEffect(() => {
    if (!selectedPkg) {
      setDurationMinutes(0);
      return;
    }
    const packageDuration = Math.max(selectedPkg.includedDurationMinutes ?? Math.round(selectedPkg.durationHours * 60), 30);
    setDurationMinutes(packageDuration);
    setBookingMode('SINGLE');
    setMultiSessions([]);
  }, [selectedPkg?._id]);
  // Load Photographer reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setReviewsLoading(true);
        const data = await httpClient.get<PhotographerReview[]>(`/reviews/provider/${id}`);
        setReviews(data || []);
      } catch (err) {
        console.error('Failed to fetch reviews for photographer', err);
      } finally {
        setReviewsLoading(false);
      }
    };
    if (id) {
      fetchReviews();
    }
  }, [id]);

  // Handle Cart Autofill logic
  useEffect(() => {
    const rentalDate = aoDaiInCart?.rentalFrom || aoDaiInCart?.startDate;
    if (rentalDate) {
      if (busyDates.includes(rentalDate)) {
        setSelectedDate('');
        toast.error(`Nhiếp ảnh gia đã bận vào ngày thuê Áo dài của bạn (${formatSingleDate(rentalDate)}). Vui lòng chọn ngày chụp khác!`);
      } else {
        setSelectedDate(rentalDate);
      }
    }

    if (aoDaiInCart) {
      if (aoDaiInCart.startTime) setStartTime(aoDaiInCart.startTime);
    }
  }, [aoDaiInCart, busyDates]);

  const bookedSlotsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return busySlots.filter(s => s.date === selectedDate).map(s => s.timeSlot);
  }, [selectedDate, busySlots]);

  const bookedSlotsOnPreviewDate = useMemo(() => {
    const targetDate = schedulePreviewDate || selectedDate;
    if (!targetDate) return [];
    return busySlots.filter(s => s.date === targetDate).map(s => s.timeSlot);
  }, [schedulePreviewDate, selectedDate, busySlots]);
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


  // Calendar availability is supplied by the backend from provider working hours,
  // off days, active bookings, and the duration of the selected package.
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
        availabilityStatus: status,
      });
    }
    return days;
  }, [calendarDate, monthlyAvailability]);

  useEffect(() => {
    if (!id || !selectedPkg) {
      setMonthlyAvailability({});
      setIsMonthlyAvailabilityLoading(false);
      return;
    }

    let cancelled = false;
    const month = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
    setIsMonthlyAvailabilityLoading(true);
    httpClient
      .get<MonthlyAvailabilityResponse>(
        `/api/photographers/${id}/availability/month?month=${month}&packageId=${selectedPkg._id}`,
      )
      .then((availability) => {
        if (cancelled) return;
        setMonthlyAvailability(Object.fromEntries(availability.days.map((day) => [day.date, day.status])));
      })
      .catch((availabilityError) => {
        console.error('Unable to load monthly photographer availability:', availabilityError);
        if (!cancelled) setMonthlyAvailability({});
      })
      .finally(() => {
        if (!cancelled) setIsMonthlyAvailabilityLoading(false);
      });

    return () => { cancelled = true; };
  }, [calendarDate, id, selectedPkg]);

  useEffect(() => {
    if (!selectedDate) return;
    const displayedMonth = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
    if (selectedDate.startsWith(displayedMonth) && monthlyAvailability[selectedDate] && monthlyAvailability[selectedDate] !== 'AVAILABLE') {
      setSelectedDate('');
      setStartTime('');
    }
  }, [calendarDate, monthlyAvailability, selectedDate]);

  const availabilityDate = schedulePreviewDate || selectedDate;

  useEffect(() => {
    if (!id || !availabilityDate) {
      setAvailableTimeRanges([]);
      return;
    }

    httpClient
      .get<{ timeRanges: Array<{ start: string; end: string }> }>(
        `/api/photographers/${id}/availability?date=${availabilityDate}`,
      )
      .then((availability) => setAvailableTimeRanges(availability.timeRanges || []))
      .catch((availabilityError) => {
        console.error("Unable to load photographer availability:", availabilityError);
        setAvailableTimeRanges([]);
      });
  }, [id, availabilityDate]);

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
        // For 3h+ packages, avoid slots starting between 09:30 and 12:30 that cut straight through 12:00-13:00 lunch hour
        if (effectiveDurationMinutes >= 180 && current > toMinutes('09:30') && current < lunchEnd && slotEnd > lunchStart) {
          continue;
        }
        slots.push({ start: toTime(current), end: toTime(slotEnd), label: `${toTime(current)} - ${toTime(slotEnd)}` });
      }
      return slots;
    });
  }, [availableTimeRanges, effectiveDurationMinutes]);

  useEffect(() => {
    if (schedulePreviewDate && schedulePreviewDate !== selectedDate) return;
    const currentSlot = photographerSlots.find((slot) => slot.start === startTime);
    const currentSlotIsAvailable = currentSlot && !bookedSlotsOnSelectedDate.some((bookedSlot) =>
      isTimeSlotOverlap(`${currentSlot.start}-${currentSlot.end}`, bookedSlot),
    );
    if (currentSlotIsAvailable) return;

    const firstAvailableSlot = photographerSlots.find((slot) => !bookedSlotsOnSelectedDate.some((bookedSlot) =>
      isTimeSlotOverlap(`${slot.start}-${slot.end}`, bookedSlot),
    ));
    setStartTime(firstAvailableSlot?.start || '');
  }, [photographerSlots, bookedSlotsOnSelectedDate, schedulePreviewDate, selectedDate, startTime]);

  const handlePreviewDate = (date: string) => {
    setAvailableTimeRanges([]);
    setSchedulePreviewDate(date);
  };

  const handleConfirmSchedule = (date: string, slot: { start: string; end: string }) => {
    setSchedulePreviewDate(null);
    setSelectedDate(date);
    setStartTime(slot.start);
  };

  const handleCancelSchedule = () => {
    setSchedulePreviewDate(null);
  };
  const isCurrentTimeSlotBusy = useMemo(() => {
    return bookedSlotsOnSelectedDate.some(bookedSlot => {
      if (!bookedSlot) return false;
      return isTimeSlotOverlap(selectedTimeSlot, bookedSlot);
    });
  }, [selectedTimeSlot, bookedSlotsOnSelectedDate]);

  const quoteSessions = useMemo<PhotographySessionDraft[]>(() => (
    bookingMode === 'SINGLE'
      ? [{ clientId: 'main-session', date: selectedDate, startTime, durationMinutes: effectiveDurationMinutes }]
      : multiSessions
  ), [bookingMode, selectedDate, startTime, effectiveDurationMinutes, multiSessions]);
  const providerGeo = photographer?.address?.geo?.coordinates;
  const providerCenter = providerGeo && providerGeo.length >= 2 ? { latitude: Number(providerGeo[1]), longitude: Number(providerGeo[0]) } : null;
  const handleLocationChange = (nextLocation: LocationSelection) => {
    const radius = Number(photographer?.serviceRadiusKm);
    const distance = providerCenter ? distanceKm(providerCenter.latitude, providerCenter.longitude, nextLocation.latitude, nextLocation.longitude) : null;
    if (Number.isFinite(radius) && radius > 0 && distance !== null && distance > radius) {
      setSelectedLocation(null);
      setLocationError(`Địa điểm cách provider khoảng ${distance.toFixed(1)} km, vượt bán kính phục vụ ${radius} km.`);
      toast.error(`Địa điểm vượt quá bán kính phục vụ ${radius} km của provider.`);
      return;
    }
    setLocationError(null);
    setSelectedLocation(nextLocation);
  };

  const isQuoteable = Boolean(selectedLocation) && !locationError && quoteSessions.length > 0 && quoteSessions.every((session) => Boolean(session.date && session.startTime));
  const nextDurationMinutes = effectiveDurationMinutes + overtimeIncrementMinutes;
  const canRequestNextDurationQuote = Boolean(
    bookingMode === 'SINGLE' && id && selectedPkg && selectedDate && startTime && nextDurationMinutes <= includedDurationMinutes + maxOvertimeMinutes,
  );

  useEffect(() => {
    if (!id || !selectedPkg || !isQuoteable) {
      setQuote(null);
      setNextDurationQuote(null);
      setQuoteError(null);
      setIsQuoteLoading(false);
      setIsNextDurationQuoteLoading(false);
      return;
    }

    let cancelled = false;
    const createPayload = (sessions: PhotographySessionDraft[]) => ({
      packageId: selectedPkg._id,
      sessions: sessions.map((session) => ({
        clientId: session.clientId,
        startsAt: `${session.date}T${session.startTime}:00+07:00`,
        endsAt: `${session.date}T${toTime(toMinutes(session.startTime) + session.durationMinutes)}:00+07:00`,
        ...(selectedLocation ? {
          locationAddress: selectedLocation.address,
          locationLatitude: selectedLocation.latitude,
          locationLongitude: selectedLocation.longitude,
        } : {}),
      })),
    });

    setIsQuoteLoading(true);
    setQuoteError(null);
    setIsNextDurationQuoteLoading(canRequestNextDurationQuote);
    if (!canRequestNextDurationQuote) setNextDurationQuote(null);

    const timer = window.setTimeout(() => {
      const currentQuote = photographersApi.quote(id, createPayload(quoteSessions));
      const nextQuote = canRequestNextDurationQuote
        ? photographersApi.quote(id, createPayload([{ clientId: 'main-session', date: selectedDate, startTime, durationMinutes: nextDurationMinutes }]))
        : Promise.resolve(null);

      Promise.all([currentQuote, nextQuote])
        .then(([current, next]) => {
          if (cancelled) return;
          setQuote(current);
          setNextDurationQuote(next);
        })
        .catch((quoteRequestError: any) => {
          if (cancelled) return;
          console.error('Không thể lấy báo giá chụp ảnh:', quoteRequestError);
          setQuote(null);
          setNextDurationQuote(null);
          setQuoteError(quoteRequestError?.message || 'Không thể kiểm tra lịch và báo giá lúc này. Vui lòng thử lại.');
        })
        .finally(() => {
          if (!cancelled) {
            setIsQuoteLoading(false);
            setIsNextDurationQuoteLoading(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id, selectedPkg, selectedLocation, quoteSessions, isQuoteable, selectedDate, startTime, effectiveDurationMinutes, nextDurationMinutes, canRequestNextDurationQuote]);

  const canIncreaseDuration = bookingMode === 'SINGLE' && Boolean(nextDurationQuote?.valid) && !isNextDurationQuoteLoading;
  const increaseUnavailableReason = !selectedDate || !startTime
    ? 'Hãy chọn ngày và giờ bắt đầu trước.'
    : !selectedLocation
      ? 'Hãy chọn địa điểm chụp để kiểm tra lịch và chi phí tăng giờ.'
    : nextDurationMinutes > includedDurationMinutes + maxOvertimeMinutes
      ? 'Đã đạt thời lượng tăng giờ tối đa của gói.'
      : isNextDurationQuoteLoading
        ? 'Đang kiểm tra lịch còn trống…'
        : nextDurationQuote?.errors[0]?.message || 'Khoảng thời gian tăng thêm không còn trống.';
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



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceFile(e.target.files[0]);
      toast.success(`Đã nhận ảnh mẫu: ${e.target.files[0].name}`);
    }
  };

  const localToday = () => {
    const now = new Date(Date.now() + 86400000);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const createSessionDraft = (
    date = selectedDate || rentalFrom || localToday(),
    sessionDurationMinutes = includedDurationMinutes,
    sessionStartTime = startTime || '09:00',
  ): PhotographySessionDraft => ({
    clientId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    startTime: sessionStartTime,
    durationMinutes: sessionDurationMinutes,
  });

  const generateSessionsForRange = (from: string, to: string) => {
    if (!from || !to || to < from) {
      toast.error('Khoảng ngày chụp không hợp lệ.');
      return;
    }
    const sessions: PhotographySessionDraft[] = [];
    const cursor = new Date(`${from}T12:00:00+07:00`);
    const last = new Date(`${to}T12:00:00+07:00`);
    while (cursor <= last && sessions.length < 20) {
      const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      sessions.push(createSessionDraft(date, selectedPricingUnit === 'PER_BOOKING' ? minimumMultiSessionMinutes : includedDurationMinutes));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (cursor <= last) {
      toast.error('Mỗi lần chỉ có thể tạo tối đa 20 buổi. Hãy chia nhỏ khoảng ngày.');
      return;
    }
    setMultiSessions(sessions);
  };

  const startMultiSessionBooking = () => {
    if (!selectedDate || !startTime) {
      toast.error('Hãy hoàn tất ngày và giờ của buổi đầu tiên trước khi thêm buổi.');
      return;
    }
    const firstSession = createSessionDraft(selectedDate, effectiveDurationMinutes, startTime);
    const nextSession = createSessionDraft(selectedDate, minimumMultiSessionMinutes, '');
    setMultiSessions([firstSession, nextSession]);
    setBookingMode('MULTI');
  };

  const backToSingleSession = () => {
    const firstSession = multiSessions[0];
    if (firstSession) {
      setSelectedDate(firstSession.date);
      setStartTime(firstSession.startTime);
      setDurationMinutes(Math.max(firstSession.durationMinutes, includedDurationMinutes));
    }
    setMultiSessions([]);
    setBookingMode('SINGLE');
  };

  const updateMultiSession = (clientId: string, patch: Partial<Omit<PhotographySessionDraft, 'clientId'>>) => {
    setMultiSessions((current) => current.map((session) => session.clientId === clientId ? { ...session, ...patch } : session));
  };
  const handleAddBookingToCart = async () => {
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để thực hiện chức năng này.');
      navigate(ROUTES.LOGIN, { state: { from: location } });
      return;
    }

    if (bookingMode === 'MULTI') {
      toast.info('Lịch nhiều buổi cần được giữ chỗ và thanh toán trực tiếp để bảo toàn toàn bộ các buổi chụp.');
      return;
    }

    if (!selectedPkg) { toast.error('Vui lòng chọn gói dịch vụ!'); return; }
    if (!selectedDate) { toast.error('Vui lòng chọn ngày dự kiến chụp!'); return; }
    if (!startTime || !endTime) { toast.error('Vui lòng chọn khung giờ chụp còn trống!'); return; }
    if (!quote?.valid || !quote.totals) {
      toast.error('Lịch chụp chưa hợp lệ hoặc báo giá đang được cập nhật.');
      return;
    }
    if (!agreeTerms) { toast.error('Vui lòng đồng ý với điều khoản đặt lịch!'); return; }
    if (!isCitySynced) {
      toast.error(`Không thể đặt: Thợ ảnh và Áo dài trong giỏ hàng đang lệch khu vực (${photographerCity} vs ${aoDaiInCart?.providerCity}).`);
      return;
    }

    const finalLocation = selectedLocation;
    if (!finalLocation) {
      toast.error('Vui lòng chọn địa điểm chụp ảnh.');
      return;
    }

    setIsBookingNow(true);
    let referenceImageUrl = null;
    if (referenceFile) {
      try {
        const formData = new FormData();
        formData.append('file', referenceFile);
        const uploadRes: any = await httpClient.post('/api/bookings/upload-reference', formData);
        referenceImageUrl = uploadRes.url;
      } catch (err: any) {
        console.error('Lỗi upload ảnh:', err);
        toast.error(err.message || 'Không thể tải ảnh concept lên hệ thống. Vui lòng thử lại!');
        setIsBookingNow(false);
        return;
      }
    }

    addToCart({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: selectedPkg._id,
      photographerName: photographer.businessName,
      photographerAvatar: photographer.portfolio[0] || '',
      packageName: selectedPkg.name,
      basePrice: quote.totals.totalAmount,
      depositAmount: quote.totals.totalAmount,
      shootDate: selectedDate,
      shootTimeSlot: selectedTimeSlot,
      shootLocation: finalLocation.address,
      shootLocationLatitude: finalLocation.latitude,
      shootLocationLongitude: finalLocation.longitude,
      shootConcept: selectedConcept,
      photographerCity: photographerCity,
      comboDiscountPercent: (photographer as any).comboDiscountPercent,
      customRequests: customRequest || null,
      referenceImage: referenceImageUrl
    });
    setIsBookingNow(false);
    toast.success(`Đã thêm gói ${selectedPkg.name} của ${photographer.businessName} vào giỏ hàng!`);
  };

  const handleDirectBooking = async () => {
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để thực hiện chức năng này.');
      navigate(ROUTES.LOGIN, { state: { from: location } });
      return;
    }

    if (!selectedPkg) { toast.error('Vui lòng chọn gói dịch vụ!'); return; }
    if (!isQuoteable) { toast.error('Vui lòng hoàn tất thông tin của tất cả buổi chụp.'); return; }
    if (!quote?.valid || !quote.totals) {
      toast.error('Lịch chụp chưa hợp lệ hoặc báo giá đang được cập nhật.');
      return;
    }
    if (!agreeTerms) { toast.error('Vui lòng đồng ý với điều khoản đặt lịch!'); return; }
    if (!isCitySynced) {
      toast.error(`Không thể đặt: Thợ ảnh và Áo dài trong giỏ hàng đang lệch khu vực (${photographerCity} vs ${aoDaiInCart?.providerCity}).`);
      return;
    }

    const finalLocation = selectedLocation;
    if (!finalLocation) {
      toast.error('Vui lòng chọn địa điểm chụp ảnh.');
      return;
    }

    try {
      setIsBookingNow(true);

      let referenceImageUrl = null;
      if (referenceFile) {
        try {
          const formData = new FormData();
          formData.append('file', referenceFile);
          const uploadRes: any = await httpClient.post('/api/bookings/upload-reference', formData);
          referenceImageUrl = uploadRes.url;
        } catch (err: any) {
          console.error('Lỗi upload ảnh:', err);
          toast.error(err.message || 'Không thể tải ảnh concept lên hệ thống. Vui lòng thử lại!');
          setIsBookingNow(false);
          return;
        }
      }

      const idempotencyKey =
        'photography-hold-' +
        Date.now().toString() +
        '-' +
        Math.random().toString(36).slice(2);
      const holdRes: any = await httpClient.post(
        '/api/bookings/photography/hold',
        {
          packageId: selectedPkg._id,
          sessions: quoteSessions.map((session) => ({
            clientId: session.clientId,
            startsAt: `${session.date}T${session.startTime}:00+07:00`,
            endsAt: `${session.date}T${toTime(toMinutes(session.startTime) + session.durationMinutes)}:00+07:00`,
            locationAddress: finalLocation.address,
            locationLatitude: finalLocation.latitude,
            locationLongitude: finalLocation.longitude,
          })),
          concept: selectedConcept,
          customRequests: customRequest || undefined,
          referenceImage: referenceImageUrl || undefined,
        },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );

      toast.success('Đã giữ lịch trong 10 phút. Đang chuyển đến thanh toán...');

      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId: holdRes.bookingId,
        purpose: 'DEPOSIT_PAYMENT',
      });

      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        toast.info('Đang chuyển hướng tới cổng thanh toán PayOS Simulator...');
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 1500);
      } else {
        throw new Error('Không thể khởi tạo liên kết thanh toán');
      }
    } catch (err: any) {
      console.error('Lỗi đặt lịch:', err);
      toast.error(err.message || 'Không thể tạo lịch đặt. Vui lòng thử lại.');
    } finally {
      setIsBookingNow(false);
    }
  };

  return (
    <PhotographerPackageDetailLayout
      photographer={photographer}
      packages={photographer.packages}
      selectedPackage={selectedPkg}
      selectedDate={selectedDate}
      startTime={startTime}
      endTime={endTime}
      durationMinutes={effectiveDurationMinutes}
      selectedTimeSlot={selectedTimeSlot}
      quote={quote}
      quoteError={quoteError}
      isQuoteLoading={isQuoteLoading}
      selectedLocation={selectedLocation}
      locationError={locationError}
      selectedConcept={selectedConcept}
      customRequest={customRequest}
      referenceFile={referenceFile}
      bookingMode={bookingMode}
      multiSessions={multiSessions}
      agreeTerms={agreeTerms}
      isFavorite={favorites.includes(photographer._id)}
      isBusy={bookingMode === 'SINGLE' && isCurrentTimeSlotBusy}
      isBooking={isBookingNow}
      canAddToCart={bookingMode === 'SINGLE'}
      reviews={reviews}
      reviewsLoading={reviewsLoading}
      calendarDate={calendarDate}
      calendarDays={calendarDays}
      isCalendarLoading={isMonthlyAvailabilityLoading}
      slots={photographerSlots}
      isSlotBusy={(slot) => bookedSlotsOnPreviewDate.some((bookedSlot) => isTimeSlotOverlap(`${slot.start}-${slot.end}`, bookedSlot))}
      includedDurationMinutes={includedDurationMinutes}
      overtimeIncrementMinutes={overtimeIncrementMinutes}
      maxOvertimeMinutes={maxOvertimeMinutes}
      canIncreaseDuration={canIncreaseDuration}
      isNextDurationQuoteLoading={isNextDurationQuoteLoading}
      increaseUnavailableReason={increaseUnavailableReason}
      onToggleFavorite={(event) => handleToggleFavorite(photographer._id, event)}
      onSelectPackage={setSelectedPkg}
      onPreviousMonth={() => { const nextDate = new Date(calendarDate); nextDate.setMonth(nextDate.getMonth() - 1); setCalendarDate(nextDate); }}
      onNextMonth={() => { const nextDate = new Date(calendarDate); nextDate.setMonth(nextDate.getMonth() + 1); setCalendarDate(nextDate); }}
      onPreviewDate={handlePreviewDate}
      onConfirmSchedule={handleConfirmSchedule} onCancelSchedule={handleCancelSchedule}
      onDecreaseDuration={() => setDurationMinutes((current) => Math.max(includedDurationMinutes, current - overtimeIncrementMinutes))}
      onIncreaseDuration={() => { if (canIncreaseDuration) setDurationMinutes(nextDurationMinutes); }}
      onLocationChange={handleLocationChange}
      onConceptChange={setSelectedConcept}
      onRequestChange={setCustomRequest}
      onReferenceFileChange={handleFileChange}
      onAgreeTermsChange={setAgreeTerms}
      onBookNow={handleDirectBooking}
      onAddToCart={handleAddBookingToCart}
      onImageClick={handleImageClick}
      lightbox={lightboxOpen ? <PhotographerPortfolioLightbox images={allPortfolioImages} activeIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} onPrevious={handlePreviousImage} onNext={handleNextImage} /> : null}
      onStartMultiSession={startMultiSessionBooking}
      onBackToSingle={backToSingleSession}
      onAddSession={() => setMultiSessions((current) => [...current, createSessionDraft(selectedDate || localToday(), minimumMultiSessionMinutes, '')])}
      onGenerateRange={generateSessionsForRange}
      onUpdateSession={updateMultiSession}
      onRemoveSession={(clientId) => setMultiSessions((current) => current.filter((session) => session.clientId !== clientId))}
    />
  );


};

export default PhotographerDetailPage;
