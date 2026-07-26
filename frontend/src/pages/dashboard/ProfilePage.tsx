import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { PrivateEvidenceImage } from '../../components/common/PrivateEvidenceImage';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import {
  Camera,
  ShieldCheck,
  Calendar,
  User,
  Mail,
  Phone,
  CalendarRange,
  Star,
  Pencil,
  AlertTriangle,
  Loader2,
  Download,
  XCircle,
  Scale
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';
import { ROUTES } from '../../config/routes';
import { Modal } from '../../components/common/Modal';
import { CustomerDashboard } from '../../features/dashboard/components/CustomerDashboard';
import { PhotographyLocationPicker } from '../../features/photographers/components/PhotographyLocationPicker';
import type { LocationSelection } from '../../features/photographers/types/photographer.types';
import { RentalPickupReturnPanel } from '../../features/rentals/components/RentalPickupReturnPanel';
import { ImageWithFallback } from '../../shared/media/ImageWithFallback';
import { downloadPhotosAsZip, downloadSinglePhoto } from '../../utils/downloadUtils';

type TimeRange = { start: string; end: string };
type BusyTimeSlot = { date: string; timeSlot: string; bookingItemId?: string };

const toMinutes = (value: string): number => {
  const [hours, minutes] = value.trim().split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN;
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const timeSlotsOverlap = (first: string, second: string): boolean => {
  const [firstStart, firstEnd] = first.split('-').map(toMinutes);
  const [secondStart, secondEnd] = second.split('-').map(toMinutes);
  return [firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)
    && firstStart < secondEnd
    && secondStart < firstEnd;
};

const getEntityId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(value)) return value;
    return null;
  }
  if (value && typeof value === 'object') {
    if ('_id' in value && typeof (value as any)._id === 'string' && /^[0-9a-fA-F]{24}$/.test((value as any)._id)) {
      return (value as any)._id;
    }
    if ('providerId' in value) {
      return getEntityId((value as any).providerId);
    }
  }
  return null;
};

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Modals state control
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeDetailBooking, setActiveDetailBooking] = useState<any>(null);
  const [locationChangeSchedule, setLocationChangeSchedule] = useState<any>(null);
  const [requestedLocation, setRequestedLocation] = useState<LocationSelection | null>(null);
  const [locationChangeNote, setLocationChangeNote] = useState('');
  const [isSubmittingLocationChange, setIsSubmittingLocationChange] = useState(false);

  useEffect(() => {
    const bookingId = activeDetailBooking?._id;
    if (!bookingId) return;
    let isCancelled = false;
    httpClient.get<any>('/api/bookings/' + bookingId)
      .then((detail) => {
        if (!isCancelled && detail) setActiveDetailBooking(detail);
      })
      .catch(() => undefined);
    return () => {
      isCancelled = true;
    };
  }, [activeDetailBooking?._id]);
  // Booking Cancel Confirmation state
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Reschedule state (UC-E06)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<any>(null);
  const [rescheduleFrom, setRescheduleFrom] = useState('');
  const [rescheduleTo, setRescheduleTo] = useState('');
  const [rescheduleShootDate, setRescheduleShootDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [customRescheduleDuration, setCustomRescheduleDuration] = useState<number>(0);
  const [availableRescheduleSlots, setAvailableRescheduleSlots] = useState<string[]>([]);
  const [isLoadingRescheduleSlots, setIsLoadingRescheduleSlots] = useState(false);
  const [rescheduleSlotsError, setRescheduleSlotsError] = useState<string | null>(null);

  // Bookings list state
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  // Review states (UC-B03/UC-D05)
  const [reviewingItem, setReviewingItem] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;

    try {
      await httpClient.post('/reviews', {
        bookingId: reviewingItem.bookingId,
        bookingItemId: reviewingItem.itemId,
        rating,
        comment,
        productId: reviewingItem.productId || undefined,
        photographyPackageId: reviewingItem.photographyPackageId || undefined,
      });

      toast.success('Gửi đánh giá dịch vụ thành công!');
      setReviewingItem(null);
      setComment('');
      setRating(5);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Gửi đánh giá thất bại');
    }
  };

  // Incident & Dispute States for selected booking
  const [bookingIncident, setBookingIncident] = useState<any | null>(null);

  useEffect(() => {
    // Immediately clear stale incident data when switching bookings
    setBookingIncident(null);

    if (!activeDetailBooking?._id) return;

    let isSubscribed = true;

    // Fetch full booking details (with populated schedules, startsAt, timeSlot)
    httpClient.get<any>(`/api/bookings/${activeDetailBooking._id}`)
      .then((fullBooking) => {
        if (isSubscribed && fullBooking && fullBooking._id) {
          setActiveDetailBooking((prev) => (prev?._id === fullBooking._id ? { ...prev, ...fullBooking } : prev));
        }
      })
      .catch((err) => console.error('Lỗi khi tải chi tiết đầy đủ đơn hàng:', err));

    const fetchIncident = async () => {
      try {
        const inc = await httpClient.get<any | null>(`/api/disputes/incidents/booking/${activeDetailBooking._id}`);
        if (isSubscribed) setBookingIncident(inc && inc._id ? inc : null);
      } catch (err) {
        if (isSubscribed) setBookingIncident(null);
      }
    };
    fetchIncident();

    return () => { isSubscribed = false; };
  }, [activeDetailBooking?._id]);

  const handleIncidentResponse = async (agree: boolean) => {
    if (!bookingIncident) return;
    const actionText = agree ? 'đồng ý đền bù' : 'từ chối đền bù và yêu cầu Admin giải quyết';
    const result = await Swal.fire({
      title: agree ? 'Đồng ý đền bù?' : 'Yêu cầu khiếu nại?',
      text: `Bạn có chắc chắn muốn ${actionText} số tiền ${bookingIncident.requestedAmount?.toLocaleString()}đ không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: agree ? '#27AE60' : '#C0392B',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: agree ? 'Đồng ý' : 'Khiếu nại',
      cancelButtonText: 'Quay lại',
      background: 'white',
      customClass: {
        popup: 'font-body',
      }
    });

    if (result.isConfirmed) {
      try {
        const endpoint = agree
          ? `/api/disputes/incidents/${bookingIncident._id}/agree`
          : `/api/disputes/incidents/${bookingIncident._id}/disagree`;
        await httpClient.post(endpoint, {});
        toast.success(agree ? 'Đã chấp nhận đền bù thành công!' : 'Đã gửi yêu cầu tranh chấp lên Admin!');
        setActiveDetailBooking(null);
        fetchBookings();
      } catch (err: any) {
        toast.error(err.message || 'Thao tác thất bại');
      }
    }
  };

  // Bio & Location state loaded from local storage for persistency
  const [bio, setBio] = useState(() => {
    return localStorage.getItem(`vh_user_bio_${user?.id}`) || 'Người yêu tơ lụa & di sản văn hóa Việt';
  });
  const [locationText, setLocationText] = useState(() => {
    return localStorage.getItem(`vh_user_location_${user?.id}`) || 'Hà Nội, VN';
  });

  const fetchBookings = async (silent = false) => {
    if (!silent) setIsLoadingBookings(true);
    try {
      const data = await httpClient.get<any[]>('/api/bookings');
      
      setBookings(prevBookings => {
        const isBookingsChanged = (prev: any[], next: any[]) => {
          if (prev.length !== next.length) return true;
          for (let i = 0; i < prev.length; i++) {
            if (prev[i]._id !== next[i]._id) return true;
            if (prev[i].status !== next[i].status) return true;
            
            const prevItems = prev[i].items || [];
            const nextItems = next[i].items || [];
            if (prevItems.length !== nextItems.length) return true;
            for (let j = 0; j < prevItems.length; j++) {
              if (prevItems[j].rentalFulfillment?.status !== nextItems[j].rentalFulfillment?.status) return true;
              if (prevItems[j].rescheduleRequest?.status !== nextItems[j].rescheduleRequest?.status) return true;
            }
          }
          return false;
        };
        
        const changed = isBookingsChanged(prevBookings, data || []);
        return changed ? (data || []) : prevBookings;
      });
    } catch (err) {
      console.error('Lỗi khi tải danh sách đơn hàng:', err);
    } finally {
      if (!silent) setIsLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Real-time: listen for booking_updated events pushed by the backend after provider actions
  const { socket } = useSocket();
  const fetchBookingsRef = useRef(fetchBookings);
  useEffect(() => { fetchBookingsRef.current = fetchBookings; });
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { bookingId: string; status: string }) => {
      console.log('[RT] booking_updated received', payload);
      fetchBookingsRef.current(true);
      setActiveDetailBooking((prev: any) => {
        if (prev && prev._id === payload.bookingId) {
          httpClient.get<any>('/api/bookings/' + payload.bookingId)
            .then((fresh) => setActiveDetailBooking(fresh))
            .catch(() => {});
        }
        return prev;
      });
    };
    socket.on('booking_updated', handler);
    return () => { socket.off('booking_updated', handler); };
  }, [socket]);

  // Sync state when custom event triggers (profile updated successfully)
  useEffect(() => {
    const handleProfileUpdate = () => {
      if (user?.id) {
        setBio(localStorage.getItem(`vh_user_bio_${user.id}`) || 'Người yêu tơ lụa & di sản văn hóa Việt');
        setLocationText(localStorage.getItem(`vh_user_location_${user.id}`) || 'Hà Nội, VN');
      }
    };

    window.addEventListener('vh-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('vh-profile-updated', handleProfileUpdate);
    };
  }, [user]);

  // Sync details if user changes (e.g. login as someone else)
  useEffect(() => {
    if (user?.id) {
      setBio(localStorage.getItem(`vh_user_bio_${user.id}`) || 'Người yêu tơ lụa & di sản văn hóa Việt');
      setLocationText(localStorage.getItem(`vh_user_location_${user.id}`) || 'Hà Nội, VN');
    }
  }, [user]);

  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar;
      const filename = user.avatar.includes('/') || user.avatar.includes('\\')
        ? user.avatar.split(/[/\\]/).pop()
        : user.avatar;
      return `${API_BASE_URL}/uploads/avatars/${filename}`;
    }
    return '/avatar_hanna.png';
  };

  const getFirstName = () => {
    if (!user?.fullName) return 'Bạn';
    const parts = user.fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
  };

  const translateGender = (g?: string) => {
    if (g === 'MALE') return 'Nam';
    if (g === 'FEMALE') return 'Nữ';
    if (g === 'OTHER') return 'Khác';
    return 'Chưa cập nhật';
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getTimeSlotDisplay = (item: any, booking: any, schedule?: any): string => {
    const slot = item?.shootTimeSlot || item?.timeSlot || item?.shootTimeSlotSnapshot || schedule?.timeSlot || booking?.shootTimeSlot || booking?.timeSlot;
    if (slot && typeof slot === 'string' && slot.trim() && slot.trim() !== 'Trống') {
      return slot.replace(/\s*-\s*/, ' - ');
    }

    const rawStartsAt = item?.startsAt || item?.shootDate || schedule?.startsAt || schedule?.scheduledDate || booking?.startsAt || booking?.shootDate;
    const rawEndsAt = item?.endsAt || schedule?.endsAt || booking?.endsAt;

    if (rawStartsAt) {
      const dStart = new Date(rawStartsAt);
      if (!isNaN(dStart.getTime())) {
        const hours = dStart.getHours();
        const minutes = dStart.getMinutes();
        const strVal = String(rawStartsAt);
        const hasTimePart = strVal.includes('T') || strVal.includes(':') || hours > 0 || minutes > 0;
        if (hasTimePart) {
          const startStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          if (rawEndsAt) {
            const dEnd = new Date(rawEndsAt);
            if (!isNaN(dEnd.getTime())) {
              const endStr = `${String(dEnd.getHours()).padStart(2, '0')}:${String(dEnd.getMinutes()).padStart(2, '0')}`;
              return `${startStr} - ${endStr}`;
            }
          }
          return `${startStr} (Giờ bắt đầu)`;
        }
      }
    }

    const duration = item?.durationHours ? `${item.durationHours} giờ` : (item?.photographyPackageId?.includedDurationMinutes ? `${item.photographyPackageId.includedDurationMinutes / 60} giờ` : (booking?.durationHours ? `${booking.durationHours} giờ` : ''));
    if (duration) return `Thời lượng ${duration}`;

    return 'Thỏa thuận trực tiếp với thợ';
  };

  // Status mapping
  const statusLabels: Record<string, { label: string, color: string, bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#7F8C8D', bg: '#F2F4F4' },
    PENDING_PAYMENT: { label: 'Chờ cọc', color: '#D35400', bg: '#FDEBD0' },
    DEPOSIT_PAID: { label: 'Đã đặt cọc', color: '#2980B9', bg: '#EBF5FB' },
    CONFIRMED: { label: 'Đã xác nhận', color: '#27AE60', bg: '#E8F8F5' },
    PICKUP_PENDING: { label: 'Chờ nhận đồ', color: '#8E44AD', bg: '#F5EEF8' },
    PICKED_UP: { label: 'Đang thuê', color: '#16A085', bg: '#E8F8F5' },
    RETURN_PENDING: { label: 'Chờ trả đồ', color: '#F39C12', bg: '#FEF9E7' },
    RETURNED: { label: 'Đã trả đồ', color: '#2ECC71', bg: '#E8F8F5' },
    COMPLETED: { label: 'Hoàn thành', color: '#27AE60', bg: '#E8F8F5' },
    CANCELLED: { label: 'Đã hủy', color: '#C0392B', bg: '#FDEDEC' },
    DISPUTED: { label: 'Tranh chấp', color: '#78281F', bg: '#F9EBEA' },
    REFUNDED: { label: 'Đã hoàn tiền', color: '#7F8C8D', bg: '#F2F4F4' },
  };

  const paymentStatusLabels: Record<string, { label: string, color: string, bg: string }> = {
    UNPAID: { label: 'Chưa thanh toán', color: '#C0392B', bg: '#FDEDEC' },
    PARTIALLY_PAID: { label: 'Thanh toán một phần', color: '#D35400', bg: '#FDEBD0' },
    PAID: { label: 'Đã thanh toán', color: '#27AE60', bg: '#E8F8F5' },
    REFUNDED: { label: 'Đã hoàn tiền', color: '#7F8C8D', bg: '#F2F4F4' },
  };

  const getStatusBadge = (status: string) => {
    const match = statusLabels[status] || { label: status, color: '#333333', bg: '#EAEAEA' };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: match.bg,
        color: match.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {match.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status?: string) => {
    const match = paymentStatusLabels[status || 'UNPAID'] || { label: status || 'CHƯA THANH TOÁN', color: '#333333', bg: '#EAEAEA' };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: match.bg,
        color: match.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {match.label}
      </span>
    );
  };

  // Dynamic hero stats counts
  const rentalsCount = useMemo(() => {
    let count = 0;
    bookings.forEach(b => {
      if (b.items) {
        b.items.forEach((item: any) => {
          if (item.itemType === 'PRODUCT') count += (item.quantity || 1);
        });
      }
    });
    return count;
  }, [bookings]);

  const appointmentsCount = useMemo(() => {
    let count = 0;
    bookings.forEach(b => {
      if (b.items) {
        b.items.forEach((item: any) => {
          if (item.itemType === 'PHOTOGRAPHY_PACKAGE') count++;
        });
      }
    });
    return count;
  }, [bookings]);

  const favoritesCount = (user as any)?.favorites?.length || 0;

  // Cancel trigger button click handler
  const handleCancelClick = (booking: any) => {
    setBookingToCancel(booking);
    setIsCancelConfirmOpen(true);
  };

  // Perform backend cancel request
  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    const bookingId = bookingToCancel._id;

    try {
      const response = await httpClient.post<any>(`/api/bookings/${bookingId}/cancel`, {
        reason: cancelReason || 'Khách hàng tự hủy trên giao diện'
      });
      if (response.success || response._id) {
        if (response.isFreeCancel) {
          toast.success(`Hủy đơn thành công! Khách hàng được hoàn trả 100% tiền cọc (${(response.refundAmount || 0).toLocaleString('vi-VN')}đ).`);
        } else {
          toast.error(`Hủy đơn thành công! ${response.penaltyReason || 'Bạn bị phạt mất cọc giữ chỗ do hủy sát giờ.'}`);
        }

        fetchBookings();
        setActiveDetailBooking(null);
        setIsCancelConfirmOpen(false);
        setBookingToCancel(null);
        setCancelReason('');
      }
    } catch (err: any) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      toast.error(err.message || 'Không thể hủy đơn đặt lịch này. Vui lòng kiểm tra lại!');
    }
  };

  const handleContinuePayment = async (bookingId: string) => {
    try {
      toast.info('Đang tải liên kết thanh toán...');
      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId,
        purpose: activeDetailBooking?.bookingType === 'COMBO' ? 'DEPOSIT_PAYMENT' : 'FULL_PAYMENT',
      });
      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        toast.success('Đang chuyển hướng tới cổng thanh toán PayOS Simulator...');
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 1200);
      } else {
        toast.error('Không tìm thấy liên kết thanh toán cho đơn hàng này.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi kết nối đến cổng thanh toán.');
    }
  };

  // ── UC-E06: Reschedule handler ──
  const submitLocationChange = async () => {
    if (!activeDetailBooking || !locationChangeSchedule || !requestedLocation) {
      toast.error('Vui lòng chọn pin địa điểm mới.');
      return;
    }
    setIsSubmittingLocationChange(true);
    try {
      await httpClient.post(
        '/api/bookings/' + activeDetailBooking._id + '/photoshoot-schedules/' + locationChangeSchedule._id + '/location-change-requests',
        { address: requestedLocation.address, latitude: requestedLocation.latitude, longitude: requestedLocation.longitude, note: locationChangeNote || undefined },
      );
      const detail = await httpClient.get<any>('/api/bookings/' + activeDetailBooking._id);
      setActiveDetailBooking(detail);
      setLocationChangeSchedule(null);
      setRequestedLocation(null);
      setLocationChangeNote('');
      toast.success('Đã gửi yêu cầu đổi địa điểm. Chờ photographer duyệt.');
    } catch (requestError: any) {
      toast.error(requestError?.message || 'Không thể gửi yêu cầu đổi địa điểm.');
    } finally {
      setIsSubmittingLocationChange(false);
    }
  };

  const rescheduleIncludedDuration = useMemo(() => {
    const packageDuration = Number(
      rescheduleItem?.photographyPackageId?.includedDurationMinutes
      || rescheduleItem?.photographyPackageId?.durationMinutes,
    );
    if (Number.isFinite(packageDuration) && packageDuration > 0) return packageDuration;
    const packageHours = Number(rescheduleItem?.photographyPackageId?.durationHours);
    return Number.isFinite(packageHours) && packageHours > 0 ? packageHours * 60 : 120;
  }, [rescheduleItem]);

  const rescheduleDurationMinutes = useMemo(() => {
    if (customRescheduleDuration > 0) return customRescheduleDuration;
    const currentSlot = String(rescheduleItem?.shootTimeSlot || '');
    const [start, end] = currentSlot.split('-').map(toMinutes);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) return end - start;
    return rescheduleIncludedDuration;
  }, [rescheduleItem, customRescheduleDuration, rescheduleIncludedDuration]);

  useEffect(() => {
    if (!isRescheduleOpen || !rescheduleItem || rescheduleItem.itemType === 'PRODUCT' || !rescheduleShootDate) {
      setAvailableRescheduleSlots([]);
      setRescheduleSlotsError(null);
      return;
    }

    const photographerId =
      getEntityId(rescheduleItem.providerId) ||
      getEntityId(rescheduleItem.photographerId) ||
      getEntityId(rescheduleItem.photographyPackageId?.providerId) ||
      getEntityId(activeDetailBooking?.providerIds?.[0]);

    if (!photographerId) {
      setAvailableRescheduleSlots([]);
      setRescheduleSlotsError('Không xác định được nhiếp ảnh gia của lịch này.');
      return;
    }

    const cleanShootDate = String(rescheduleShootDate).slice(0, 10);
    let isCurrent = true;
    setIsLoadingRescheduleSlots(true);
    setRescheduleSlotsError(null);
    setRescheduleTimeSlot('');

    Promise.all([
      httpClient.get<{ timeRanges: TimeRange[] }>(`/api/photographers/${photographerId}/availability?date=${cleanShootDate}`),
      httpClient.get<{ bookedSlots: BusyTimeSlot[] }>(`/api/bookings/busy-dates/provider/${photographerId}`),
    ])
      .then(([availability, busy]) => {
        if (!isCurrent) return;
        const slots = (availability.timeRanges || []).flatMap((range) => {
          const rangeStart = toMinutes(range.start);
          const rangeEnd = toMinutes(range.end);
          if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) return [];

          const candidates: string[] = [];
          for (let start = rangeStart; start + rescheduleDurationMinutes <= rangeEnd; start += 30) {
            const candidate = `${toTime(start)}-${toTime(start + rescheduleDurationMinutes)}`;
            const conflicts = (busy.bookedSlots || []).some((booked) =>
              booked.date === rescheduleShootDate
              && String(booked.bookingItemId || '') !== String(rescheduleItem._id)
              && timeSlotsOverlap(candidate, booked.timeSlot),
            );
            if (!conflicts) candidates.push(candidate);
          }
          return candidates;
        });
        setAvailableRescheduleSlots([...new Set(slots)]);
      })
      .catch(() => {
        if (!isCurrent) return;
        setAvailableRescheduleSlots([]);
        setRescheduleSlotsError('Không thể tải khung giờ trống. Vui lòng thử lại.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingRescheduleSlots(false);
      });

    return () => { isCurrent = false; };
  }, [isRescheduleOpen, rescheduleItem, rescheduleShootDate, rescheduleDurationMinutes]);

  const handleReschedule = async () => {
    if (!rescheduleItem || !activeDetailBooking) return;
    const isProduct = rescheduleItem.itemType === 'PRODUCT';
    if (isProduct && (!rescheduleFrom || !rescheduleTo)) {
      toast.error('Vui lòng chọn ngày nhận và ngày trả mới');
      return;
    }
    if (!isProduct && (!rescheduleShootDate || !rescheduleTimeSlot)) {
      toast.error('Vui lòng chọn ngày chụp và khung giờ còn trống');
      return;
    }
    try {
      const res = await httpClient.patch<any>(`/api/bookings/${activeDetailBooking._id}/reschedule`, {
        itemId: rescheduleItem._id,
        ...(isProduct ? { newRentalFrom: rescheduleFrom, newRentalTo: rescheduleTo } : {
          newShootDate: rescheduleShootDate,
          newShootTimeSlot: rescheduleTimeSlot,
        }),
        reason: rescheduleReason || undefined,
      });
      if (res?.directUpdate || res?.status === 'APPROVED') {
        toast.success('Lịch chụp mới đã được cập nhật trực tiếp thành công!');
      } else {
        toast.success('Đã gửi yêu cầu đổi lịch. Vui lòng chờ provider xác nhận.');
      }
      setIsRescheduleOpen(false);
      setRescheduleItem(null);
      setRescheduleFrom('');
      setRescheduleTo('');
      setRescheduleShootDate('');
      setRescheduleTimeSlot('');
      setRescheduleReason('');
      fetchBookings();
      setActiveDetailBooking(null);
    } catch (err: any) {
      toast.error(err.message || 'Không thể đổi lịch. Vui lòng thử lại!');
    }
  };

  return (
    <div className="vh-profile-redesigned-page">
      {/* Visual User Hero Card - Fully Restyled */}
      <section className="vh-profile-hero-section-container">
        <div className="vh-profile-hero-card-layout">
          {/* Left Avatar */}
          <div className="vh-profile-hero-avatar-wrapper">
            <img src={getAvatarUrl()} alt={user?.fullName} className="vh-profile-hero-avatar-img" />
            <button className="vh-profile-hero-avatar-camera-btn" onClick={() => navigate(ROUTES.SETTINGS)} title="Thay đổi ảnh đại diện">
              <Camera size={14} />
            </button>
          </div>

          {/* Center Details */}
          <div className="vh-profile-hero-details-layout">
            <div className="vh-profile-hero-name-row">
              <h2 className="vh-profile-hero-full-name font-header">{user?.fullName || 'Người dùng VibeHue'}</h2>
              <span className="vh-profile-hero-member-badge">
                <Star size={10} fill="currentColor" />
                <span>Thành viên Bạch Kim</span>
              </span>
            </div>

            <p className="vh-profile-hero-tagline">
              {bio} • {locationText}
            </p>

            <div className="vh-profile-hero-stats-row">
              <div className="vh-profile-hero-stat">
                <span className="vh-profile-hero-stat-value font-header">{rentalsCount}</span>
                <span className="vh-profile-hero-stat-label">LẦN THUÊ</span>
              </div>
              <div className="vh-profile-hero-stat-divider" />
              <div className="vh-profile-hero-stat">
                <span className="vh-profile-hero-stat-value font-header">{appointmentsCount}</span>
                <span className="vh-profile-hero-stat-label">LỊCH HẸN</span>
              </div>
              <div className="vh-profile-hero-stat-divider" />
              <div className="vh-profile-hero-stat">
                <span className="vh-profile-hero-stat-value font-header">{favoritesCount}</span>
                <span className="vh-profile-hero-stat-label">YÊU THÍCH</span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="vh-profile-hero-actions-layout">
            <button className="vh-profile-hero-action-btn-outline" onClick={() => setIsViewOpen(true)}>
              Xem hồ sơ
            </button>
            <button className="vh-profile-hero-action-btn-solid" onClick={() => navigate(ROUTES.SETTINGS)}>
              <Pencil size={14} style={{ marginRight: '6px' }} />
              Chỉnh sửa
            </button>
          </div>
        </div>
      </section>

      {/* Tabs System Container */}
      <section className="vh-profile-tabs-section-container">
        {user?.roles?.includes('PROVIDER') && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FAF6F0',
            border: '1px solid #E8E2D5',
            padding: '16px 24px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontFamily: 'Inter, sans-serif'
          }}>
            <div>
              <h4 style={{ margin: 0, color: '#4A0E17', fontSize: '14px', fontWeight: 700 }}>Kênh quản trị của Đối tác</h4>
              <p style={{ margin: '4px 0 0 0', color: '#7A7A7A', fontSize: '12.5px' }}>Bạn đang đăng nhập với quyền đối tác. Để quản lý bộ sưu tập áo dài, lịch chụp ảnh, mã giảm giá và đối soát quyết toán, vui lòng truy cập Kênh Đối tác.</p>
            </div>
            <button
              onClick={() => navigate(ROUTES.PROVIDER_DASHBOARD)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4A0E17',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                whiteSpace: 'nowrap',
                marginLeft: '16px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#360A10'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4A0E17'}
            >
              Truy cập Kênh Đối Tác →
            </button>
          </div>
        )}

        <CustomerDashboard
          user={user}
          bookings={bookings}
          isLoadingBookings={isLoadingBookings}
          onViewDetails={(b) => setActiveDetailBooking(b)}
          onRefresh={fetchBookings}
        />
      </section>

      {/* AI Recommendation Showcase Section */}
      <section className="vh-profile-ai-recommendation-section-container">
        <h2 className="vh-profile-ai-recommendation-title font-header">
          Gợi ý riêng cho {getFirstName()}
        </h2>
        <div className="vh-profile-ai-recommendation-grid">
          {/* Product card 1: Phượng Hoàng Cung Đình */}
          <div className="vh-profile-ai-product-card animate-hover-lift" style={{ cursor: 'pointer' }} onClick={() => navigate('/rentals')}>
            <div className="vh-profile-ai-product-image-wrapper">
              <img src="/phuong_hoang.png" alt="Phượng Hoàng Cung Đình" className="vh-profile-ai-product-img" />
            </div>
            <div className="vh-profile-ai-product-meta">
              <h4 className="vh-profile-ai-product-title font-header">PHƯỢNG HOÀNG CUNG ĐÌNH</h4>
              <p className="vh-profile-ai-product-subtitle">Lụa Hà Đông cao cấp</p>
            </div>
          </div>

          {/* Product card 2: Tuyết Mai Thanh Khiết */}
          <div className="vh-profile-ai-product-card animate-hover-lift" style={{ cursor: 'pointer' }} onClick={() => navigate('/rentals')}>
            <div className="vh-profile-ai-product-image-wrapper">
              <img src="/tuyet_mai.png" alt="Tuyết Mai Thanh Khiết" className="vh-profile-ai-product-img" />
            </div>
            <div className="vh-profile-ai-product-meta">
              <h4 className="vh-profile-ai-product-title font-header">TUYẾT MAI THANH KHIẾT</h4>
              <p className="vh-profile-ai-product-subtitle">Gấm vân chìm</p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- MODALS -------------------- */}

      {/* 1. Modal View: Chi tiết Hồ sơ cá nhân */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Thông tin tài khoản" maxWidth="500px">
        <div className="vh-modal-profile-info-details animate-fade-in">
          <div className="vh-modal-profile-info-row">
            <span className="vh-modal-profile-info-label">
              <User size={16} />
              <span>Họ và tên</span>
            </span>
            <strong className="vh-modal-profile-info-value">{user?.fullName || 'Chưa cập nhật'}</strong>
          </div>

          <div className="vh-modal-profile-info-row">
            <span className="vh-modal-profile-info-label">
              <Mail size={16} />
              <span>Địa chỉ Email</span>
            </span>
            <strong className="vh-modal-profile-info-value">{user?.email}</strong>
          </div>

          <div className="vh-modal-profile-info-row">
            <span className="vh-modal-profile-info-label">
              <Phone size={16} />
              <span>Số điện thoại</span>
            </span>
            <strong className="vh-modal-profile-info-value">{user?.phone || 'Chưa cập nhật'}</strong>
          </div>

          <div className="vh-modal-profile-info-row">
            <span className="vh-modal-profile-info-label">
              <User size={16} />
              <span>Giới tính</span>
            </span>
            <strong className="vh-modal-profile-info-value">{translateGender(user?.gender)}</strong>
          </div>

          <div className="vh-modal-profile-info-row">
            <span className="vh-modal-profile-info-label">
              <CalendarRange size={16} />
              <span>Ngày sinh</span>
            </span>
            <strong className="vh-modal-profile-info-value">{formatDate(user?.dateOfBirth)}</strong>
          </div>

          <div className="vh-modal-profile-info-row">
            <span className="vh-modal-profile-info-label">
              <ShieldCheck size={16} />
              <span>Xác thực tài khoản</span>
            </span>
            <span className="vh-badge-verified" style={{ padding: '2px 8px', fontSize: '10px' }}>
              <ShieldCheck size={12} style={{ marginRight: '3px' }} />
              <span>Email đã xác thực</span>
            </span>
          </div>

          <div className="vh-modal-profile-info-row" style={{ borderBottom: 'none' }}>
            <span className="vh-modal-profile-info-label">
              <Calendar size={16} />
              <span>Thành viên từ</span>
            </span>
            <strong className="vh-modal-profile-info-value">{formatDate(user?.createdAt)}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button className="vh-btn vh-btn-outline" style={{ padding: '8px 20px', borderRadius: '8px' }} onClick={() => setIsViewOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Modal View: Chi tiết đơn đặt lịch (activeDetailBooking) */}
      {activeDetailBooking && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailBooking(null)}
          title={`CHI TIẾT ĐƠN HÀNG: ${activeDetailBooking.bookingCode}`}
          maxWidth="700px"
        >
          <div className="vh-modal-booking-details-wrapper animate-fade-in" style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Row Status Badges */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAEAE8', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#7E6D5B' }}>Trạng thái đơn:</span>
                {getStatusBadge(activeDetailBooking.status)}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#7E6D5B' }}>Thanh toán:</span>
                {getPaymentStatusBadge(activeDetailBooking.paymentSummary?.paymentStatus || activeDetailBooking.paymentStatus)}
              </div>
            </div>

            {/* Customer Information & Photoshoot Summary Banner */}
            <div style={{ backgroundColor: '#FAF8F5', padding: '16px', borderRadius: '8px', border: '1px solid #EAE1D4', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: '8px', borderBottom: '1px solid rgba(182, 145, 91, 0.15)', paddingBottom: '4px' }}>
                  THÔNG TIN KHÁCH HÀNG
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', color: '#4A4440' }}>
                  <span>Người đặt: <strong>{user?.fullName || activeDetailBooking.customerName || 'Khách hàng'}</strong></span>
                  <span>Số điện thoại: <strong>{user?.phone || activeDetailBooking.customerPhone || 'Chưa cập nhật'}</strong></span>
                  <span style={{ gridColumn: 'span 2' }}>Email: <strong>{user?.email || activeDetailBooking.customerEmail || '—'}</strong></span>
                </div>
              </div>

              {/* Special Photography Banner if this is a photoshoot booking */}
              {(() => {
                const photoItem = activeDetailBooking.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.shootDate) || activeDetailBooking.items?.[0] || {};
                const isPhoto = activeDetailBooking.bookingType === 'PHOTOGRAPHY' || photoItem.itemType === 'PHOTOGRAPHY_PACKAGE' || photoItem.shootDate;
                if (!isPhoto) return null;

                const matchedSchedule = activeDetailBooking.schedules?.find((s: any) => s.scheduleType === 'PHOTOSHOOT');
                const rawShootDate = photoItem.shootDate || photoItem.startsAt || matchedSchedule?.scheduledDate || matchedSchedule?.startsAt || activeDetailBooking.shootDate;
                const shootDateStr = rawShootDate ? formatDate(rawShootDate) : '';
                const timeSlotDisplay = getTimeSlotDisplay(photoItem, activeDetailBooking, matchedSchedule);
                const locationStr = photoItem.shootLocation || photoItem.location || matchedSchedule?.locationAddress || activeDetailBooking.shootLocation || activeDetailBooking.address || '';

                return (
                  <div style={{ borderTop: '1px dashed #D6C7B2', paddingTop: '10px', marginTop: '4px' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📸 CHI TIẾT THỜI GIAN & ĐỊA ĐIỂM CHỤP:</span>
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', color: '#1E3A8A', backgroundColor: '#EFF6FF', padding: '10px 12px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                      <div>📅 Ngày chụp: <strong>{shootDateStr || 'Chưa xếp ngày'}</strong></div>
                      <div>⏰ Khung giờ: <strong>{timeSlotDisplay}</strong></div>
                      {locationStr && <div style={{ gridColumn: 'span 2' }}>📍 Địa điểm: <strong>{locationStr}</strong></div>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Photography Delivered Photos */}
            {(() => {
              const photos = (activeDetailBooking.deliveredPhotos && activeDetailBooking.deliveredPhotos.length > 0)
                ? activeDetailBooking.deliveredPhotos
                : [];
              const driveUrl = activeDetailBooking.deliveryDriveUrl;

              if (photos.length === 0 && !driveUrl) return null;

              return (
                <div style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1D4ED8', fontWeight: 700, fontSize: '13px' }}>
                      <Camera size={16} />
                      <span>📸 ẢNH KẾT QUẢ TỪ THỢ CHỤP</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {driveUrl && (
                        <a
                          href={driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: '#2563EB', color: 'white', border: 'none',
                            borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
                            fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                          }}
                        >
                          🔗 Mở Kho Ảnh Gốc (Google Drive)
                        </a>
                      )}
                      {photos.length > 0 && (
                        <button
                          onClick={() => {
                            const zipName = `anh_chup_${activeDetailBooking.bookingCode || 'ket_qua'}.zip`;
                            void downloadPhotosAsZip(photos, zipName, toast);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: '#1D4ED8', color: 'white', border: 'none',
                            borderRadius: '6px', padding: '5px 10px', fontSize: '11px',
                            fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = '#1E40AF')}
                          onMouseOut={(e) => (e.currentTarget.style.background = '#1D4ED8')}
                        >
                          <Download size={12} /> Tải tất cả ({photos.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {photos.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {photos.map((photo: string, index: number) => {
                          const photoUrl = photo.startsWith('http') ? photo : `${import.meta.env.VITE_API_URL || ''}${photo}`;
                          return (
                            <div key={index} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #BFDBFE', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
                              <a href={photoUrl} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                                <img src={photoUrl} alt={`Ảnh kết quả ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </a>
                              <button
                                type="button"
                                onClick={() => void downloadSinglePhoto(photoUrl, `photo_${index + 1}.jpg`)}
                                style={{
                                  position: 'absolute', bottom: '3px', right: '3px',
                                  background: 'rgba(29, 78, 216, 0.85)', color: 'white',
                                  border: 'none', borderRadius: '4px', padding: '3px', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                title="Tải xuống"
                              >
                                <Download size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                        Thợ chụp đã bàn giao {photos.length} ảnh. Bấm vào ảnh để xem hoặc nút ⬇ để tải về.
                      </p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Cancellation Reason Display */}
            {activeDetailBooking.status === 'CANCELLED' && activeDetailBooking.cancellation?.reason && (
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '13px' }}>
                  <XCircle size={16} />
                  <span>LÝ DO HỦY ĐƠN</span>
                </div>
                <p style={{ fontSize: '13px', color: '#7F1D1D', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  {activeDetailBooking.cancellation.reason}
                </p>
                {activeDetailBooking.cancellation.cancelledAt && (
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                    Thời gian hủy: {new Date(activeDetailBooking.cancellation.cancelledAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            )}

            {/* Admin Dispute Result Display */}
            {(() => {
              const resInput = activeDetailBooking.disputeResult || (() => {
                const log = [...(activeDetailBooking.statusTimeline || [])].reverse().find((t: any) => t.note?.includes('Admin giải quyết tranh chấp'));
                if (!log) return null;
                return {
                  decisionLabel: log.note,
                  resolvedAt: log.changedAt,
                };
              })();

              if (!resInput) return null;

              let decisionText = resInput.decisionLabel || 'Admin đã phán quyết';
              let adminNote = resInput.notes || '';
              let refundAmt: any = resInput.refundAmount;
              let compAmt: any = resInput.compensationAmount;

              if (typeof decisionText === 'string' && decisionText.includes('Admin giải quyết tranh chấp.')) {
                const raw = decisionText;
                const decMatch = raw.match(/Quyết định:\s*([^.]+)/);
                if (decMatch) decisionText = decMatch[1].trim();

                const noteMatch = raw.match(/Ghi chú:\s*(.*)$/);
                if (noteMatch && !adminNote) adminNote = noteMatch[1].trim();

                const refMatch = raw.match(/Hoàn khách:\s*([\d.,\s]+đ)/);
                if (refMatch && (refundAmt === undefined || refundAmt === null)) {
                  refundAmt = refMatch[1];
                }
                const compMatch = raw.match(/bồi thường provider:\s*([\d.,\s]+đ)/);
                if (compMatch && (compAmt === undefined || compAmt === null)) {
                  compAmt = compMatch[1];
                }
              }

              return (
                <div style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: '10px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 750, fontSize: '14px' }}>
                    <Scale size={18} />
                    <span>⚖️ KẾT QUẢ GIẢI QUYẾT TRANH CHẤP TỪ ADMIN</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', borderTop: '1px solid #FDE68A', paddingTop: '10px' }}>
                    <div>
                      <span style={{ color: '#6B7280' }}>Quyết định: </span>
                      <strong style={{ color: '#D97706', fontSize: '13.5px' }}>{decisionText}</strong>
                    </div>
                    {refundAmt !== undefined && refundAmt !== null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>Hoàn tiền khách: </span>
                        <strong style={{ color: '#059669' }}>
                          {typeof refundAmt === 'number' ? `${refundAmt.toLocaleString('vi-VN')}đ` : refundAmt}
                        </strong>
                      </div>
                    )}
                    {compAmt !== undefined && compAmt !== null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>Bồi thường shop/thợ: </span>
                        <strong style={{ color: '#D97706' }}>
                          {typeof compAmt === 'number' ? `${compAmt.toLocaleString('vi-VN')}đ` : compAmt}
                        </strong>
                      </div>
                    )}
                  </div>

                  {adminNote && (
                    <div style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginTop: '2px',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', marginBottom: '4px' }}>
                        💬 Ghi chú phán quyết từ Admin:
                      </div>
                      <div style={{ fontSize: '13px', color: '#1F2937', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                        "{adminNote}"
                      </div>
                    </div>
                  )}

                  {resInput.resolvedAt && (
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                      Thời gian phán quyết: {new Date(resInput.resolvedAt).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Items details loop */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)', margin: 0 }}>
                DANH SÁCH DỊCH VỤ & SẢN PHẨM
              </h4>

              {activeDetailBooking.items?.map((item: any, idx: number) => {
                const isProduct = item.itemType === 'PRODUCT';
                const populatedProduct = isProduct && item.productId && typeof item.productId === 'object'
                  ? item.productId
                  : null;
                const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object'
                  ? item.photographyPackageId
                  : null;

                const selectedColorImages = populatedProduct?.colorImages?.find(
                  (entry: { color?: string; images?: string[] }) =>
                    entry.color?.trim().toUpperCase() === item.color?.trim().toUpperCase(),
                )?.images;

                const itemImage = selectedColorImages?.[0]
                  || populatedProduct?.images?.[0]
                  || pkgObj?.coverImage
                  || pkgObj?.portfolio?.[0]
                  || pkgObj?.images?.[0]
                  || item.image
                  || item.productImage
                  || item.coverImage
                  || (item.referenceImages && item.referenceImages.length > 0 ? item.referenceImages[0] : item.referenceImage);

                const itemName = populatedProduct?.name
                  || pkgObj?.name
                  || item.name
                  || item.productName
                  || (isProduct ? 'Sản phẩm áo dài' : 'Gói chụp ảnh cổ phục');

                const matchedSchedule = activeDetailBooking.schedules?.find(
                  (s: any) => s.scheduleType === 'PHOTOSHOOT' || s.scheduleType === 'RENTAL_PERIOD'
                );

                const rawShootDate = item.shootDate || item.startsAt || item.startDate || matchedSchedule?.scheduledDate || matchedSchedule?.startsAt || activeDetailBooking.shootDate || activeDetailBooking.startDate;
                const timeSlotDisplay = getTimeSlotDisplay(item, activeDetailBooking, matchedSchedule);

                const formattedDateStr = isProduct
                  ? (item.rentalType === 'DAILY'
                    ? `${formatDate(item.startDate || item.rentalFrom || activeDetailBooking.startDate)} - ${formatDate(item.endDate || item.rentalTo || activeDetailBooking.endDate)}`
                    : `Ngày ${formatDate(item.startDate || item.rentalFrom || activeDetailBooking.startDate)} (Khung giờ: ${item.startTime || '08:00'} - ${item.endTime || '18:00'})`)
                  : `Ngày chụp: ${formatDate(rawShootDate)} (Khung giờ: ${timeSlotDisplay})`;

                const photographerProvider = pkgObj?.providerId || item.providerId || activeDetailBooking.providerId || {};
                const photographerName = typeof photographerProvider === 'object' ? (photographerProvider.businessName || photographerProvider.fullName || photographerProvider.name || '') : '';
                const photographerPhone = typeof photographerProvider === 'object' ? (photographerProvider.contact?.phone || photographerProvider.phone || '') : '';

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      border: '1px solid #EAEAE8',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: 'white'
                    }}
                  >
                    <ImageWithFallback
                      src={itemImage || (isProduct ? undefined : 'https://images.unsplash.com/photo-1537633552985-df8429e8048b')}
                      alt={itemName}
                      fallback={
                        <div
                          aria-label={'Ảnh gói ' + itemName}
                          style={{ width: '80px', height: '100px', display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '6px', border: '1px solid #EAEAE8', background: '#F7F3ED', color: '#9A8170', fontSize: '11px', textAlign: 'center', padding: '8px' }}
                        >
                          Gói chụp
                        </div>
                      }
                      style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #EAEAE8' }}
                    />

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h5 style={{ fontSize: '15px', fontWeight: 700, color: '#2D2926', margin: 0 }}>
                            {itemName}
                          </h5>
                          {activeDetailBooking.status === 'COMPLETED' && (
                            item.isReviewed ? (
                              <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 650 }}>Đã đánh giá</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveDetailBooking(null);
                                  setReviewingItem({
                                    bookingId: activeDetailBooking._id,
                                    itemId: item._id,
                                    productId: item.productId?._id || item.productId,
                                    photographyPackageId: item.photographyPackageId?._id || item.photographyPackageId
                                  });
                                }}
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: 'var(--color-primary-dark)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Đánh giá
                              </button>
                            )
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#7E6D5B', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span>Thời gian: <strong>{formattedDateStr}</strong></span>
                          {isProduct ? (
                            <>
                              <span>Kích cỡ: <strong>{item.selectedSize || item.size || 'M'}</strong> • Màu sắc: <strong>{item.selectedColor || item.color || 'Đỏ'}</strong></span>
                              <span>Địa chỉ nhận: <strong>{item.providerAddress || 'Showroom VibeHue'}</strong></span>
                            </>
                          ) : (
                            <>
                              {photographerName && (
                                <span>Thợ ảnh / Studio: <strong style={{ color: '#1E293B' }}>{photographerName}</strong> {photographerPhone ? `(SĐT: ${photographerPhone})` : ''}</span>
                              )}
                              <span>Địa điểm chụp: <strong>{item.shootLocation || item.locationAddress || activeDetailBooking.shootLocation || 'Lăng Khải Định, Thủy Bằng, Huế'}</strong></span>
                              <span>Concept: <strong>{item.shootConcept || item.concept || 'Cổ phục tự do'}</strong></span>
                              {(item.referenceImage || (item.referenceImages && item.referenceImages.length > 0)) && (
                                <div style={{ marginTop: '6px' }}>
                                  <span style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 700, color: '#7E22CE' }}>📸 Ảnh concept mẫu tham khảo:</span>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {(Array.isArray(item.referenceImages) ? item.referenceImages : [item.referenceImage]).filter(Boolean).map((refImg: string, rIdx: number) => {
                                      const refUrl = refImg.startsWith('http') ? refImg : `${API_BASE_URL}${refImg.startsWith('/') ? '' : '/'}${refImg}`;
                                      return (
                                        <a key={rIdx} href={refUrl} target="_blank" rel="noopener noreferrer">
                                          <img
                                            src={refUrl}
                                            alt={`Ảnh concept mẫu ${rIdx + 1}`}
                                            style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E9D5FF', cursor: 'pointer' }}
                                          />
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {isProduct && item.pickupReturnLocationSnapshot?.address && <RentalPickupReturnPanel location={item.pickupReturnLocationSnapshot} itemName={item.name} />}
                          {(item.customRequests || item.conceptNotes || item.notes) && (
                            <span style={{ color: '#C0392B', fontStyle: 'italic', marginTop: '2px' }}>
                              Yêu cầu đặc biệt: "{item.customRequests || item.conceptNotes || item.notes}"
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px', borderTop: '1px dashed #EAEAE8', paddingTop: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#7E6D5B' }}>
                          Đơn giá: {item.unitPrice?.toLocaleString('vi-VN')}đ x {item.quantity || 1}
                        </span>
                        <strong style={{ fontSize: '14px', color: '#2D2926' }}>
                          {((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Incident / Dispute section */}
            {bookingIncident && bookingIncident._id && (
              <div style={{
                backgroundColor: '#FFF5F5',
                border: '1px solid #FEB2B2',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #FED7D7', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#C53030', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> BÁO CÁO SỰ CỐ / HỎNG ĐỒ
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: bookingIncident.status === 'PENDING_CUSTOMER' ? '#ED8936' : bookingIncident.status === 'ACCEPTED' ? '#48BB78' : bookingIncident.status === 'DISPUTED' ? '#E53E3E' : '#4A5568',
                    color: 'white'
                  }}>
                    {bookingIncident.status === 'PENDING_CUSTOMER' ? 'CHỜ PHẢN HỒI' : bookingIncident.status === 'ACCEPTED' ? 'ĐÃ ĐỒNG Ý' : bookingIncident.status === 'DISPUTED' ? 'ĐANG TRANH CHẤP' : 'ĐÃ GIẢI QUYẾT'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#2D3748', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Sản phẩm gặp sự cố: <strong>{bookingIncident.bookingItemId?.name || bookingIncident.productId?.name || 'Sản phẩm'}</strong></span>
                  <span>Hình thức xử lý: <strong>{bookingIncident.bookingItemId?.actionType === 'MAINTENANCE' || bookingIncident.actionType === 'MAINTENANCE' ? 'Sửa chữa / Bảo dưỡng (MAINTENANCE)' : 'Giặt là / Tẩy rửa (CLEANING)'}</strong></span>
                  <span>Mô tả sự cố: <em style={{ color: '#4A5568' }}>{bookingIncident.description ? `"${bookingIncident.description}"` : <span style={{ color: '#A0AEC0' }}>Không có mô tả</span>}</em></span>
                  <span>Số tiền đền bù yêu cầu: <strong style={{ color: '#C53030', fontSize: '15px' }}>{(bookingIncident.requestedAmount ?? 0).toLocaleString('vi-VN')}đ</strong></span>
                  {bookingIncident.evidencePhotos && bookingIncident.evidencePhotos.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4A5568', marginBottom: '4px' }}>Hình ảnh bằng chứng:</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {bookingIncident.evidencePhotos.map((photo: string, idx: number) => (
                          <PrivateEvidenceImage
                            key={idx}
                            reference={photo}
                            legacyUrl={photo?.startsWith('http') ? photo : `${API_BASE_URL}${photo}`}
                            alt={`Bằng chứng ${idx + 1}`}
                            imageStyle={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #FEB2B2' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {bookingIncident.adminNotes && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#EDF2F7', borderRadius: '6px', borderLeft: '4px solid #4A5568' }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2D3748' }}>Quyết định của Admin:</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#4A5568' }}>{bookingIncident.adminNotes}</p>
                    </div>
                  )}

                  {bookingIncident.status === 'PENDING_CUSTOMER' && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px dashed #FED7D7', paddingTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleIncidentResponse(true)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#38A169',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '12px',
                          textAlign: 'center'
                        }}
                      >
                        ĐỒNG Ý ĐỀN BÙ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIncidentResponse(false)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#E53E3E',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '12px',
                          textAlign: 'center'
                        }}
                      >
                        KHIẾU NẠI / TỪ CHỐI
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeDetailBooking.status === 'CONFIRMED' && activeDetailBooking.schedules?.length > 0 && (
              <section style={{ border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: '10px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#1D4ED8' }}>Địa điểm các buổi chụp</h4>
                {activeDetailBooking.schedules.map((schedule: any) => {
                  const request = schedule.locationChangeRequest;
                  return <div key={schedule._id} style={{ padding: '10px 0', borderTop: '1px solid #DBEAFE', fontSize: '12px' }}>
                    <div><strong>{schedule.locationSnapshot?.address || schedule.locationAddress || 'Chưa có địa điểm'}</strong></div>
                    <div style={{ color: '#6B7280', marginTop: '3px' }}>{schedule.startsAt ? new Date(schedule.startsAt).toLocaleString('vi-VN') : ''}</div>
                    {request?.status === 'PENDING' ? <div style={{ marginTop: '7px', color: '#92400E', fontWeight: 700 }}>Đang chờ photographer duyệt địa điểm mới.</div>
                      : request?.status === 'REJECTED' ? <div style={{ marginTop: '7px', color: '#B91C1C', fontWeight: 700 }}>Yêu cầu gần nhất đã bị từ chối.</div>
                        : <button type="button" onClick={() => { setLocationChangeSchedule(schedule); setRequestedLocation(null); setLocationChangeNote(''); }} style={{ marginTop: '8px', border: 'none', borderRadius: '6px', padding: '7px 10px', background: '#2563EB', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Yêu cầu đổi địa điểm</button>}
                  </div>;
                })}
              </section>
            )}

            {/* Financial Summary */}
            {(() => {
              const bType = activeDetailBooking.bookingType || 'PHOTOGRAPHY';
              const depositTotal = activeDetailBooking.pricingSummary?.depositTotal ?? 0;
              const grandTotal = activeDetailBooking.pricingSummary?.grandTotal || 0;
              const subTotal = Math.max(0, (activeDetailBooking.pricingSummary?.subTotal || grandTotal) - depositTotal);
              const isPaid = activeDetailBooking.status !== 'PENDING_PAYMENT' && activeDetailBooking.status !== 'WAITING_PAYMENT';
              const totalPaid = activeDetailBooking.paymentSummary?.totalPaid || (isPaid ? grandTotal : 0);

              const photoBasePrice = grandTotal || subTotal;
              const photoDeposit = Math.round(photoBasePrice * 0.3);

              return (
                <div style={{ marginLeft: 'auto', width: '350px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #EAEAE8', paddingTop: '12px' }}>
                  {bType === 'PHOTOGRAPHY' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span>Tiền gói dịch vụ chụp ảnh:</span>
                        <span style={{ fontWeight: 600 }}>{photoBasePrice.toLocaleString('vi-VN')}đ</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#D97706', paddingLeft: '8px' }}>
                        <span>• Trong đó: Cọc giữ lịch chụp (30%):</span>
                        <span style={{ fontWeight: 600 }}>{photoDeposit.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span>{bType === 'AODAI_RENTAL' ? 'Tiền thuê áo dài:' : 'Tiền dịch vụ chụp & thuê:'}</span>
                        <span>{subTotal.toLocaleString('vi-VN')}đ</span>
                      </div>

                      {depositTotal > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span>Tiền cọc giữ đồ trang phục (Hoàn trả khi trả đồ):</span>
                          <span style={{ color: '#D97706', fontWeight: 600 }}>{depositTotal.toLocaleString('vi-VN')}đ</span>
                        </div>
                      )}
                    </>
                  )}

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#27AE60' }}>
                      <span>Giảm giá:</span>
                      <span>-{discountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', borderTop: '1px dashed #EAEAE8', paddingTop: '8px' }}>
                    <span>Tổng chi phí:</span>
                    <span style={{ color: '#4A0E17' }}>{grandTotal.toLocaleString('vi-VN')}đ</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#059669', marginTop: '4px', fontWeight: 700 }}>
                    <span>{isPaid ? 'Thanh toán online (100%):' : 'Cần thanh toán online:'}</span>
                    <span>{(isPaid ? (totalPaid || grandTotal) : grandTotal).toLocaleString('vi-VN')}đ</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8C827A' }}>
                    <span>Còn lại thanh toán tại tiệm:</span>
                    <span style={{ fontWeight: 700, color: '#27AE60' }}>0đ</span>
                  </div>

                  {isPaid && (
                    <div style={{ fontSize: '11px', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 8px', borderRadius: '6px', textAlign: 'center', marginTop: '2px', fontWeight: 700 }}>
                      ✅ Đã thanh toán đầy đủ 100% online
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Footer action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid #EAEAE8', paddingTop: '16px' }}>
              {/* Reschedule button - allowed only for CONFIRMED/DEPOSIT_PAID */}
              {(activeDetailBooking.status === 'CONFIRMED' || activeDetailBooking.status === 'DEPOSIT_PAID') && (
                <button
                  className="vh-btn"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#2980B9',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => {
                    if (activeDetailBooking.items && activeDetailBooking.items.length > 0) {
                      setRescheduleItem(activeDetailBooking.items[0]);
                      const item = activeDetailBooking.items[0];
                      if (item.rescheduleRequest?.status === 'PENDING') {
                        toast.info('Yêu cầu đổi lịch của đơn này đang chờ provider phản hồi.');
                        return;
                      }
                      if (item.itemType === 'PRODUCT') {
                        setRescheduleFrom(item.startDate || item.rentalFrom || '');
                        setRescheduleTo(item.endDate || item.rentalTo || '');
                      } else {
                        const rawDate = item.shootDate ? String(item.shootDate).slice(0, 10) : '';
                        setRescheduleShootDate(rawDate);
                        setRescheduleTimeSlot(item.shootTimeSlot || '');
                      }
                      setIsRescheduleOpen(true);
                    }
                  }}
                >
                  <Calendar size={14} /> {activeDetailBooking.items?.[0]?.rescheduleRequest?.status === 'PENDING' ? 'Đang chờ duyệt đổi lịch' : 'Đổi lịch hẹn'}
                </button>
              )}

              {/* Only show Cancel button if status is cancellable */}
              {activeDetailBooking.status !== 'CANCELLED' && 
               activeDetailBooking.status !== 'COMPLETED' && 
               activeDetailBooking.status !== 'RETURNED' && 
               activeDetailBooking.status !== 'PICKED_UP' && 
               activeDetailBooking.status !== 'RETURN_PENDING' && 
               activeDetailBooking.status !== 'DISPUTED' && 
               activeDetailBooking.status !== 'AWAITING_REVIEW' && 
               activeDetailBooking.status !== 'IN_PROGRESS' && 
               !bookingIncident && (
                <button 
                  className="vh-btn" 
                  style={{ 
                    padding: '8px 24px', 
                    borderRadius: '8px', 
                    fontSize: '13px', 
                    backgroundColor: '#C0392B', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer' 
                  }} 
                  onClick={() => handleCancelClick(activeDetailBooking)}
                >
                  {activeDetailBooking.bookingType === 'PHOTOGRAPHY' ? 'Hủy lịch chụp' : 'Hủy đơn / Trả hàng'}
                </button>
              )}

              {activeDetailBooking.status === 'PENDING_PAYMENT' && (
                <button
                  className="vh-btn"
                  style={{
                    padding: '8px 24px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#8B1E22',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleContinuePayment(activeDetailBooking._id)}
                >
                  Tiếp tục thanh toán
                </button>
              )}

              <button
                className="vh-btn vh-btn-outline"
                style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '13px' }}
                onClick={() => setActiveDetailBooking(null)}
              >
                Đóng
              </button>
            </div>

          </div>
        </Modal>
      )}

      {/* 3. Modal View: Đổi lịch hẹn (UC-E06) */}
      {isRescheduleOpen && rescheduleItem && activeDetailBooking && (
        <Modal
          isOpen={true}
          onClose={() => { setIsRescheduleOpen(false); setRescheduleItem(null); }}
          title={`ĐỔI LỊCH: ${activeDetailBooking.bookingCode}`}
          maxWidth="600px"
        >
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            
            {/* Thẻ Thông tin Lịch Hiện Tại */}
            <div style={{ backgroundColor: '#FDF8F5', border: '1px solid #F3E4D8', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#8C6D1F', fontWeight: 700 }}>📌 LỊCH CHỤP HIỆN TẠI:</span>
                <strong style={{ color: '#7D161A' }}>
                  {rescheduleItem.shootDate ? formatDate(rescheduleItem.shootDate) : 'Chưa có'} {rescheduleItem.shootTimeSlot ? `(${rescheduleItem.shootTimeSlot.replace('-', ' - ')})` : ''}
                </strong>
              </div>
              {rescheduleItem.photographyPackageId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', borderTop: '1px dashed #EAD8C7', paddingTop: '6px', marginTop: '2px' }}>
                  <span>Gói dịch vụ:</span>
                  <span style={{ fontWeight: 600, color: '#333' }}>
                    {rescheduleItem.photographyPackageId.name || 'Gói chụp ảnh'} ({rescheduleDurationMinutes / 60} giờ)
                  </span>
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#EBF5FB', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px', color: '#1A5276', lineHeight: 1.5 }}>
              <strong>Lưu ý nghiệp vụ:</strong> Yêu cầu đổi lịch phải được gửi trước giờ chụp ít nhất <strong>24 tiếng</strong>. Khung giờ mới sẽ được tạm <strong>khóa giữ chỗ (TTL 12h)</strong> chờ Nhiếp ảnh gia xác nhận.
            </div>

            {rescheduleItem.itemType === 'PRODUCT' ? (
              <>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>NGÀY NHẬN MỚI</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={rescheduleFrom}
                      onChange={e => setRescheduleFrom(e.target.value)}
                      style={{ border: '1px solid #D5C2AD', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>NGÀY TRẢ MỚI</label>
                    <input
                      type="date"
                      min={rescheduleFrom || new Date().toISOString().split('T')[0]}
                      value={rescheduleTo}
                      onChange={e => setRescheduleTo(e.target.value)}
                      style={{ border: '1px solid #D5C2AD', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', width: '100%' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>CHỌN NGÀY CHỤP MỚI</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={rescheduleShootDate}
                    onChange={e => {
                      setRescheduleShootDate(e.target.value);
                      setRescheduleTimeSlot('');
                    }}
                    style={{ border: '1px solid #D5C2AD', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>

                {/* Bộ Tăng / Giảm Thời Lượng Chụp khi Đổi Lịch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>THỜI LƯỢNG BUỔI CHỤP MỚI</label>
                    <span style={{ fontSize: '12.5px', color: '#7D161A', fontWeight: 700 }}>
                      {Math.floor(rescheduleDurationMinutes / 60)} giờ {rescheduleDurationMinutes % 60 ? `${rescheduleDurationMinutes % 60}p` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#F9F6F0', padding: '8px 12px', borderRadius: '8px', border: '1px solid #EAD8C7' }}>
                    <button
                      type="button"
                      disabled={rescheduleDurationMinutes <= rescheduleIncludedDuration}
                      onClick={() => {
                        setCustomRescheduleDuration(Math.max(rescheduleIncludedDuration, rescheduleDurationMinutes - 30));
                        setRescheduleTimeSlot('');
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '1px solid #D5C2AD',
                        backgroundColor: rescheduleDurationMinutes <= rescheduleIncludedDuration ? '#EAEAE8' : '#FFF',
                        color: rescheduleDurationMinutes <= rescheduleIncludedDuration ? '#AAA' : '#333',
                        cursor: rescheduleDurationMinutes <= rescheduleIncludedDuration ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                      }}
                    >
                      -
                    </button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: '12px' }}>
                      {rescheduleDurationMinutes > rescheduleIncludedDuration ? (
                        <span style={{ color: '#C0392B', fontWeight: 700 }}>
                          Tăng giờ thêm: +{Math.floor((rescheduleDurationMinutes - rescheduleIncludedDuration) / 60)}h {(rescheduleDurationMinutes - rescheduleIncludedDuration) % 60 ? `${(rescheduleDurationMinutes - rescheduleIncludedDuration) % 60}p` : ''} (sẽ tính phí phụ thu)
                        </span>
                      ) : (
                        <span style={{ color: '#27AE60', fontWeight: 600 }}>Thời lượng gói chụp gốc ({rescheduleIncludedDuration / 60} giờ)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={rescheduleDurationMinutes >= rescheduleIncludedDuration + 240}
                      onClick={() => {
                        setCustomRescheduleDuration(rescheduleDurationMinutes + 30);
                        setRescheduleTimeSlot('');
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '1px solid #D5C2AD',
                        backgroundColor: rescheduleDurationMinutes >= rescheduleIncludedDuration + 240 ? '#EAEAE8' : '#FFF',
                        color: rescheduleDurationMinutes >= rescheduleIncludedDuration + 240 ? '#AAA' : '#333',
                        cursor: rescheduleDurationMinutes >= rescheduleIncludedDuration + 240 ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bộ Chọn Khung Giờ Mới dạng Grid Phân Ca Sáng / Ca Chiều */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>CHỌN KHUNG GIỜ MỚI</label>
                  
                  {!rescheduleShootDate ? (
                    <p style={{ fontSize: '12.5px', color: '#888', fontStyle: 'italic', margin: 0 }}>Vui lòng chọn Ngày chụp mới ở trên trước.</p>
                  ) : isLoadingRescheduleSlots ? (
                    <p style={{ fontSize: '12.5px', color: '#2980B9', fontStyle: 'italic', margin: 0 }}>Đang kiểm tra ca làm việc & lịch bận của nhiếp ảnh gia...</p>
                  ) : rescheduleSlotsError ? (
                    <small style={{ color: '#C0392B', fontSize: '12px' }}>{rescheduleSlotsError}</small>
                  ) : availableRescheduleSlots.length === 0 ? (
                    <small style={{ color: '#C0392B', fontSize: '12px' }}>Nhiếp ảnh gia đã kín lịch hoặc không có ca làm việc phù hợp vào ngày này.</small>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                      {/* Ca Sáng */}
                      {availableRescheduleSlots.some((slot) => Number(slot.split('-')[0].split(':')[0]) < 12) && (
                        <div>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#555', display: 'block', marginBottom: '6px' }}>🌅 Ca Sáng (Bắt đầu trước 12:00)</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                            {availableRescheduleSlots.filter((slot) => Number(slot.split('-')[0].split(':')[0]) < 12).map((slot) => {
                              const isSelected = rescheduleTimeSlot === slot;
                              const isSameAsCurrent = String(rescheduleItem.shootDate || '').slice(0, 10) === rescheduleShootDate && rescheduleItem.shootTimeSlot === slot;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={isSameAsCurrent}
                                  onClick={() => setRescheduleTimeSlot(slot)}
                                  style={{
                                    padding: '9px 8px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: isSelected ? '1.5px solid #7D161A' : '1px solid #D5C2AD',
                                    backgroundColor: isSelected ? '#7D161A' : isSameAsCurrent ? '#F3F4F6' : '#FFFFFF',
                                    color: isSelected ? '#FFFFFF' : isSameAsCurrent ? '#9CA3AF' : '#2C3E50',
                                    cursor: isSameAsCurrent ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <span>{slot.replace('-', ' - ')}</span>
                                  <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>
                                    {isSameAsCurrent ? 'Lịch hiện tại' : isSelected ? 'Đã chọn' : 'Trống'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Ca Chiều */}
                      {availableRescheduleSlots.some((slot) => Number(slot.split('-')[0].split(':')[0]) >= 12) && (
                        <div>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#555', display: 'block', marginBottom: '6px' }}>🌇 Ca Chiều (Bắt đầu từ 12:00)</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                            {availableRescheduleSlots.filter((slot) => Number(slot.split('-')[0].split(':')[0]) >= 12).map((slot) => {
                              const isSelected = rescheduleTimeSlot === slot;
                              const isSameAsCurrent = String(rescheduleItem.shootDate || '').slice(0, 10) === rescheduleShootDate && rescheduleItem.shootTimeSlot === slot;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={isSameAsCurrent}
                                  onClick={() => setRescheduleTimeSlot(slot)}
                                  style={{
                                    padding: '9px 8px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: isSelected ? '1.5px solid #7D161A' : '1px solid #D5C2AD',
                                    backgroundColor: isSelected ? '#7D161A' : isSameAsCurrent ? '#F3F4F6' : '#FFFFFF',
                                    color: isSelected ? '#FFFFFF' : isSameAsCurrent ? '#9CA3AF' : '#2C3E50',
                                    cursor: isSameAsCurrent ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <span>{slot.replace('-', ' - ')}</span>
                                  <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>
                                    {isSameAsCurrent ? 'Lịch hiện tại' : isSelected ? 'Đã chọn' : 'Trống'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A4440' }}>LÝ DO ĐỔI LỊCH (tùy chọn)</label>
              <textarea
                placeholder="Nhập lý do đổi lịch..."
                value={rescheduleReason}
                onChange={e => setRescheduleReason(e.target.value)}
                style={{ border: '1px solid #D5C2AD', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', width: '100%', minHeight: '64px', fontFamily: 'inherit', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #EAEAE8', paddingTop: '14px' }}>
              <button
                className="vh-btn vh-btn-outline"
                style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px' }}
                onClick={() => { setIsRescheduleOpen(false); setRescheduleItem(null); }}
              >
                Hủy bỏ
              </button>
              <button
                className="vh-btn"
                style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '13px', backgroundColor: '#2980B9', color: 'white', border: 'none', cursor: 'pointer' }}
                onClick={handleReschedule}
              >
                Gửi yêu cầu đổi lịch
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Modal View: Xác nhận hủy lịch và chính sách hoàn tiền */}
      {locationChangeSchedule && activeDetailBooking && (
        <Modal isOpen={true} onClose={() => setLocationChangeSchedule(null)} title="YÊU CẦU ĐỔI ĐỊA ĐIỂM CHỤP" maxWidth="560px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Photographer phải duyệt trước khi địa điểm mới được áp dụng.</p>
            <PhotographyLocationPicker value={requestedLocation} onSelect={setRequestedLocation} />
            <textarea value={locationChangeNote} onChange={(event) => setLocationChangeNote(event.target.value)} placeholder="Ghi chú cho photographer (không bắt buộc)" maxLength={500} style={{ minHeight: '72px', border: '1px solid #D5C2AD', borderRadius: '6px', padding: '10px', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="vh-btn vh-btn-outline" onClick={() => setLocationChangeSchedule(null)}>Hủy</button>
              <button type="button" className="vh-btn" disabled={!requestedLocation || isSubmittingLocationChange} onClick={() => void submitLocationChange()} style={{ background: '#2563EB', color: 'white', border: 'none' }}>{isSubmittingLocationChange ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
            </div>
          </div>
        </Modal>
      )}
      {isCancelConfirmOpen && bookingToCancel && (
        <Modal
          isOpen={true}
          onClose={() => setIsCancelConfirmOpen(false)}
          title="XÁC NHẬN HỦY LỊCH ĐẶT CHỖ"
          maxWidth="550px"
        >
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>

            {/* Warning block about refund policies */}
            <div style={{ backgroundColor: '#FDF2F2', border: '1px solid #FDE8E8', borderRadius: '8px', padding: '16px' }}>
              <h5 style={{ color: '#9B1C1C', fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> QUY ĐỊNH HOÀN TIỀN CỌC
              </h5>

              <ul style={{ fontSize: '12.5px', color: '#7F1D1D', paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Hủy trước 24 giờ:</strong> Khách hàng được hoàn trả <strong>100%</strong> tiền cọc đã đóng.</li>
                <li><strong>Hủy trong vòng 24 giờ:</strong> Áp dụng phạt <strong>100%</strong> tiền cọc giữ chỗ (trừ các đơn đặt lịch mới trong vòng 60 phút - Grace Period).</li>
                <li><strong>Đơn hàng chưa thanh toán:</strong> Có thể hủy miễn phí bất kỳ lúc nào.</li>
              </ul>
            </div>

            {/* Input reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#4A4440' }}>Lý do hủy đơn (Bắt buộc)</label>
              <textarea
                placeholder="Vui lòng cung cấp lý do hủy để chúng tôi cải thiện dịch vụ..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #EAE1D4',
                  fontSize: '13px',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #EAEAE8', paddingTop: '16px', marginTop: '8px' }}>
              <button
                className="vh-btn vh-btn-outline"
                style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px' }}
                onClick={() => { setIsCancelConfirmOpen(false); setBookingToCancel(null); setCancelReason(''); }}
              >
                Hủy bỏ
              </button>

              <button
                className="vh-btn"
                disabled={!cancelReason.trim()}
                style={{
                  padding: '8px 24px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  backgroundColor: cancelReason.trim() ? '#C0392B' : '#CCCCCC',
                  color: 'white',
                  border: 'none',
                  cursor: cancelReason.trim() ? 'pointer' : 'not-allowed'
                }}
                onClick={handleCancelBooking}
              >
                Xác nhận hủy lịch
              </button>
            </div>

          </div>
        </Modal>
      )}

      {/* Review Modal popup */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <form onSubmit={handleCreateReview} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: '448px', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ backgroundColor: '#2D2926', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Viết đánh giá dịch vụ</h4>
              <button type="button" onClick={() => setReviewingItem(null)} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#7E6D5B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHỌN SỐ SAO ĐÁNH GIÁ</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: '24px', transition: 'transform 0.15s', padding: 0 }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Star size={32} fill={star <= rating ? '#D4AF37' : 'none'} color="#D4AF37" />
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', color: '#2D2926', fontWeight: 700, textTransform: 'uppercase' }}>NỘI DUNG NHẬN XÉT</label>
                <textarea
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D5C2AD', fontSize: '13px', minHeight: '96px', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  rows={4}
                  placeholder="Chia sẻ trải nghiệm của bạn về phom dáng áo dài hoặc tác phong chụp ảnh..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: '#8B1E22', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'background-color 0.15s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#72181B'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8B1E22'}
              >
                GỬI ĐÁNH GIÁ NGAY
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default ProfilePage;
