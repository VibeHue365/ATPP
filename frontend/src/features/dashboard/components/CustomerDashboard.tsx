import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { httpClient } from '../../../services/httpClient';
import { useToast } from '../../../components/feedback/Toast';
import { Calendar, MapPin, User, History, Plus, Heart, Star, ShieldCheck, Clock, AlertTriangle, Check, XCircle, X, Sparkles } from 'lucide-react';
import { BookingDetailModal } from '../../../components/common/BookingDetailModal';
import { API_BASE_URL } from '../../../config/env';
import { getFirstMediaUrl } from '../../../shared/media/mediaUrl';

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};


const HandoverCountdown = ({ initiatedAt, onTimeout }: { initiatedAt: string; onTimeout: () => void }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>('');

  React.useEffect(() => {
    const calculateTime = () => {
      const start = new Date(initiatedAt).getTime();
      const deadline = start + 30 * 60 * 1000;
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        onTimeout();
        return;
      }

      const minutes = Math.floor(diff / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);
      setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [initiatedAt, onTimeout]);

  return (
    <div style={{
      backgroundColor: '#FEF9E7',
      border: '1px solid #F5CBA7',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '12px',
      color: '#B9770E',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '10px',
      fontWeight: 600,
      width: '100%'
    }}>
      <span>⏰ Xác nhận tại quầy còn: <strong style={{ color: '#C0392B', fontSize: '13px' }}>{timeLeft}</strong></span>
    </div>
  );
};

interface CustomerDashboardProps {
  user: any;
  bookings: any[];
  isLoadingBookings?: boolean;
  onViewDetails: (booking: any) => void;
  onRefresh: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  user,
  bookings,
  isLoadingBookings = false,
  onViewDetails,
  onRefresh
}) => {
  const toast = useToast();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'appointments' | 'rentals' | 'favorites' | 'payments'>('appointments');
  const [favoriteSubTab, setFavoriteSubTab] = useState<'aodai' | 'photographer'>('aodai');
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [paymentCategoryTab, setPaymentCategoryTab] = useState<'all' | 'aodai' | 'photography'>('all');
  const [realProductList, setRealProductList] = useState<any[]>([]);
  const [realPhotographersList, setRealPhotographersList] = useState<any[]>([]);

  const [currentPageAppointments, setCurrentPageAppointments] = useState(1);
  const [currentPageRentals, setCurrentPageRentals] = useState(1);
  const ITEMS_PER_PAGE = 9;

  useEffect(() => {
    setCurrentPageAppointments(1);
    setCurrentPageRentals(1);

    if (activeTab === 'payments') {
      setIsLoadingPayments(true);
      httpClient.get<any[]>('/payments/history')
        .then((res: any) => {
          setPayments(Array.isArray(res) ? res : (res?.data || []));
        })
        .catch((err: any) => {
          console.error('Failed to fetch payment history:', err);
        })
        .finally(() => {
          setIsLoadingPayments(false);
        });
    }

    if (activeTab === 'favorites') {
      setIsLoadingFavorites(true);
      Promise.allSettled([
        httpClient.get<any[]>('/products').then((res: any) => setRealProductList(Array.isArray(res) ? res : (res?.data || []))),
        httpClient.get<any[]>('/providers/photographers').then((res: any) => setRealPhotographersList(Array.isArray(res) ? res : (res?.data || []))),
      ]).finally(() => {
        setIsLoadingFavorites(false);
      });
    }
  }, [activeTab]);

  const [reviewingItem, setReviewingItem] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<'DAMAGE' | 'REJECT'>('DAMAGE');
  const [reportDesc, setReportDesc] = useState('');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);

  const [isPhotoDisputeModalOpen, setIsPhotoDisputeModalOpen] = useState(false);
  const [photoDisputeBookingId, setPhotoDisputeBookingId] = useState<string | null>(null);
  const [selectedDisputeReason, setSelectedDisputeReason] = useState<string>('Thợ chụp ảnh không đến / Vắng mặt tại buổi chụp');
  const [photoDisputeNote, setPhotoDisputeNote] = useState<string>('');
  const [photoDisputePhotos, setPhotoDisputePhotos] = useState<string[]>([]);

  const handleContinuePayment = async (bookingId: string) => {
    try {
      const res = await httpClient.get<{ checkoutUrl?: string }>(`/payments/booking/${bookingId}/status`);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        const b = bookings.find((item) => item._id === bookingId);
        if (b) onViewDetails(b);
      }
    } catch {
      const b = bookings.find((item) => item._id === bookingId);
      if (b) onViewDetails(b);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;
    try {
      toast.info('Đang gửi đánh giá...');
      await httpClient.post('/reviews', {
        bookingId: reviewingItem.bookingId || reviewingItem._id,
        productId: reviewingItem.productId,
        rating,
        comment,
      });
      toast.success('Cảm ơn bạn đã gửi đánh giá thành công!');
      setReviewingItem(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Gửi đánh giá thất bại');
    }
  };

  const handleConfirmPickup = async (bookingId: string) => {
    try {
      toast.info('Đang xác nhận nhận đồ...');
      await httpClient.post(`/bookings/${bookingId}/customer-confirm-pickup`, {});
      toast.success('Xác nhận nhận đồ thành công!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Xác nhận thất bại');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    toast.info('Đang tải ảnh lên...');
    
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const res: any = await httpClient.post('/bookings/upload-reference', formData);
        if (res.url) urls.push(res.url);
      }
      setReportPhotos(prev => [...prev, ...urls]);
      toast.success('Tải ảnh thành công!');
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + (err.message || ''));
    }
  };

  const handlePhotoDisputeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    toast.info('Đang tải ảnh bằng chứng...');
    
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const res: any = await httpClient.post('/bookings/upload-reference', formData);
        if (res.url) urls.push(res.url);
      }
      setPhotoDisputePhotos(prev => [...prev, ...urls]);
      toast.success('Tải ảnh bằng chứng thành công!');
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + (err.message || ''));
    }
  };

  const handleSubmitReport = async () => {
    if (!reportDesc.trim()) {
      toast.error('Vui lòng nhập mô tả lỗi.');
      return;
    }
    if (reportPhotos.length === 0) {
      toast.error('Vui lòng tải lên ít nhất 1 hình ảnh làm bằng chứng.');
      return;
    }

    try {
      toast.info('Đang gửi báo cáo...');
      if (reportModalType === 'DAMAGE') {
        await httpClient.post(`/bookings/${selectedBookingId}/customer-report-damage`, {
          description: reportDesc,
          evidencePhotos: reportPhotos
        });
        toast.success('Đã gửi báo cáo lỗi và nhận đồ thành công!');
      } else {
        await httpClient.post(`/bookings/${selectedBookingId}/customer-reject-handover`, {
          reason: reportDesc,
          evidencePhotos: reportPhotos
        });
        toast.success('Đã gửi khiếu nại từ chối nhận đồ. Đơn hàng chuyển sang tranh chấp để Admin đối soát xử lý!');
      }
      setIsReportModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Gửi báo cáo thất bại');
    }
  };

  const handleDisputeBooking = (bookingId: string) => {
    setPhotoDisputeBookingId(bookingId);
    setSelectedDisputeReason('Thợ chụp ảnh không đến / Vắng mặt tại buổi chụp');
    setPhotoDisputeNote('');
    setPhotoDisputePhotos([]);
    setIsPhotoDisputeModalOpen(true);
  };

  const handleConfirmComplete = async (bookingId: string) => {
    const result = await Swal.fire({
      title: 'Xác nhận hài lòng?',
      text: 'Bạn xác nhận đã hài lòng với buổi chụp ảnh này. Hành động này không thể hoàn tác.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
      confirmButtonText: '✓ Xác nhận hài lòng',
      cancelButtonText: 'Huỷ',
    });
    if (!result.isConfirmed) return;

    try {
      toast.info('Đang xác nhận...');
      await httpClient.post(`/bookings/${bookingId}/confirm-complete`, {});
      toast.success('Cảm ơn bạn đã xác nhận! Đơn hàng đã hoàn thành.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Xác nhận thất bại, vui lòng thử lại.');
    }
  };

  const handleSubmitPhotoDispute = async () => {
    if (!photoDisputeBookingId) return;

    let finalReason = selectedDisputeReason;
    const isOther = selectedDisputeReason.startsWith('Khác');

    if (isOther) {
      if (!photoDisputeNote.trim()) {
        toast.error('Vui lòng nhập chi tiết lý do khiếu nại.');
        return;
      }
      finalReason = photoDisputeNote.trim();
    } else if (photoDisputeNote.trim()) {
      finalReason = `${selectedDisputeReason}: ${photoDisputeNote.trim()}`;
    }

    try {
      toast.info('Đang gửi khiếu nại...');
      await httpClient.patch(`/bookings/${photoDisputeBookingId}/status`, {
        status: 'DISPUTED',
        note: finalReason,
        evidencePhotos: photoDisputePhotos.length > 0 ? photoDisputePhotos : undefined,
      });
      toast.success('Đã gửi khiếu nại thành công. Admin sẽ liên hệ hỗ trợ bạn trong 24h!');
      setIsPhotoDisputeModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi gửi khiếu nại.');
    }
  };

  // --- 1. APPOINTMENTS (Lịch hẹn của tôi) ---
  const realAppointments = bookings.filter(b =>
    b.items?.some((item: any) => item.itemType === 'PHOTOGRAPHY_PACKAGE')
  ).map(b => {
    const photoItem = b.items.find((item: any) => item.itemType === 'PHOTOGRAPHY_PACKAGE');
    const isPast = ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(b.status);

    const now = new Date();
    const nowYMD = now.toLocaleDateString('sv-SE'); // 'YYYY-MM-DD'
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const shootYMD = photoItem?.shootDate ? new Date(photoItem.shootDate).toLocaleDateString('sv-SE') : '';
    const timeStr = photoItem?.shootTimeSlot || '09:00 - 11:00';
    
    // Lấy giờ kết thúc ca chụp (ví dụ "08:00 - 09:00" -> "09:00")
    let endTimeStr = '23:59';
    if (timeStr.includes('-')) {
      const parts = timeStr.split('-');
      if (parts.length >= 2) endTimeStr = parts[1].trim();
    }

    const isPendingStartStatus = ['CONFIRMED', 'DEPOSIT_PAID'].includes(b.status);
    const isPastDate = shootYMD !== '' && shootYMD < nowYMD;
    const isPastTimeToday = shootYMD === nowYMD && currentHourMin > endTimeStr;

    // Đơn CHỈ BỊ COI LÀ QUÁ GIỜ/QUÁ HẠN khi Thợ ảnh CHƯA bấm "Bắt đầu buổi chụp" (trạng thái vẫn là DEPOSIT_PAID/CONFIRMED)
    const isOverdue = !isPast && isPendingStartStatus && (isPastDate || isPastTimeToday);

    let statusLabel = 'Sắp tới';
    if (b.status === 'DEPOSIT_PAID') statusLabel = 'Chờ xác nhận';
    else if (b.status === 'IN_PROGRESS') statusLabel = 'Đang chụp';
    else if (b.status === 'AWAITING_REVIEW') statusLabel = 'Chờ bạn duyệt';
    else if (b.status === 'COMBO_PHOTOS_APPROVED') statusLabel = 'Đã duyệt ảnh • Đang thuê áo';
    else if (b.status === 'COMPLETED') statusLabel = 'Hoàn thành';
    else if (b.status === 'CANCELLED') statusLabel = 'Đã hủy';
    else if (b.status === 'DISPUTED') statusLabel = 'Tranh chấp';

    if (!isPast && isOverdue && ['CONFIRMED', 'DEPOSIT_PAID'].includes(b.status)) {
      statusLabel = isPastTimeToday ? 'Quá giờ chụp' : 'Quá hạn chụp';
    }

    return {
      id: b._id,
      isReal: true,
      booking: b,
      rawStatus: b.status,
      isOverdue,
      isPastTimeToday,
      shootYMD,
      endTimeStr,
      awaitingReviewSince: b.awaitingReviewSince,
      statusType: isPast ? 'PAST' : isOverdue ? 'OVERDUE' : (b.status === 'AWAITING_REVIEW' || b.status === 'IN_PROGRESS') ? 'ACTION' : 'UPCOMING',
      dateStr: photoItem?.shootDate ? formatDate(photoItem.shootDate) : '',
      title: photoItem?.photographyPackageId?.name || photoItem?.name || 'Gói Chụp Ảnh Cổ Phong',
      photographerName: photoItem?.providerId?.businessName || photoItem?.providerId?.fullName || photoItem?.photographerName || 'Nhiếp ảnh gia',
      shootLocation: photoItem?.shootLocation || 'Showroom Nam Kỳ Khởi Nghĩa, Q.1',
      timeStr: photoItem?.shootTimeSlot || '09:00 - 11:00',
      statusLabel
    };
  });

  // --- Helper: Sorting function ---
  // Nhóm 1: Sự kiện TƯƠNG LAI & HÔM NAY CHƯA QUÁ GIỜ (Xếp từ mốc gần nhất tới xa nhất)
  // Nhóm 2: Sự kiện QUÁ HẠN / QUÁ GIỜ CHỤP chưa hoàn tất
  // Nhóm 3: Sự kiện ĐÃ HOÀN THÀNH / ĐÃ TRẢ ĐỒ / ĐÃ HỦY (Luôn xếp dưới cùng)
  const sortItemsByUrgencyDate = (a: any, b: any) => {
    const isFinished = (item: any) => {
      const st = item.rawStatus || item.status;
      return ['COMPLETED', 'RETURNED', 'CANCELLED', 'REFUNDED'].includes(st);
    };

    const getItemYMD = (item: any) => {
      if (item.shootYMD) return item.shootYMD;
      if (item.startDate) {
        try {
          return new Date(item.startDate).toLocaleDateString('sv-SE');
        } catch (e) { return ''; }
      }
      const photoItem = item.booking?.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
      if (photoItem?.shootDate) {
        try {
          return new Date(photoItem.shootDate).toLocaleDateString('sv-SE');
        } catch (e) { return ''; }
      }
      return '';
    };

    const aFin = isFinished(a);
    const bFin = isFinished(b);

    const ymdA = getItemYMD(a);
    const ymdB = getItemYMD(b);

    const getGroup = (item: any, _ymd: string, fin: boolean) => {
      if (fin) return 3; // Hoàn thành/Đã hủy -> Nhóm 3 (cuối cùng)
      if (item.isOverdue) return 2; // Đã quá hạn (quá ngày hoặc quá giờ hôm nay) -> Nhóm 2
      return 1; // Sắp tới / Hôm nay đúng giờ -> Nhóm 1 (đầu tiên)
    };

    const groupA = getGroup(a, ymdA, aFin);
    const groupB = getGroup(b, ymdB, bFin);

    if (groupA !== groupB) {
      return groupA - groupB;
    }

    // Nếu cùng Group 1 (Sắp tới / Hôm nay): Ngày gần nhất lên đầu (21/07 -> 22/07 -> 23/07)
    if (groupA === 1) {
      if (ymdA && ymdB && ymdA !== ymdB) {
        return ymdA.localeCompare(ymdB);
      }
      const dateA = a.booking?.createdAt ? new Date(a.booking.createdAt).getTime() : 0;
      const dateB = b.booking?.createdAt ? new Date(b.booking.createdAt).getTime() : 0;
      return dateA - dateB;
    }

    // Nếu cùng Group 2 (Quá hạn) hoặc Group 3 (Đã xong/Đã hủy): Ngày mới tạo gần đây lên đầu nhóm
    const dateA = a.booking?.createdAt ? new Date(a.booking.createdAt).getTime() : 0;
    const dateB = b.booking?.createdAt ? new Date(b.booking.createdAt).getTime() : 0;
    return dateB - dateA;
  };

  const sortedAppointments = [...realAppointments].sort(sortItemsByUrgencyDate);
  const totalAppointmentPages = Math.ceil(sortedAppointments.length / ITEMS_PER_PAGE) || 1;
  const displayAppointments = sortedAppointments.slice(
    (currentPageAppointments - 1) * ITEMS_PER_PAGE,
    currentPageAppointments * ITEMS_PER_PAGE
  );

  // --- 2. RENTED AO DAI (Áo dài đã thuê) ---
  const rentalItems: any[] = [];
  bookings.forEach(b => {
    // Exclude Combo bookings or Photography bookings from Ao Dai rental tab (Combo will only appear under My Appointments)
    if (b.bookingType === 'COMBO' || b.items?.some((item: any) => item.itemType === 'PHOTOGRAPHY_PACKAGE')) return;

    if (b.items) {
      const productItems = b.items.filter((item: any) => item.itemType === 'PRODUCT');
      if (productItems.length > 0) {
        const firstItem = productItems[0];
        const productInfo = firstItem.productId && typeof firstItem.productId === 'object' ? firstItem.productId : null;
        let providerName = 'Cửa hàng VibeHue';
        let providerAddress = 'Showroom VibeHue';
        
        if (productInfo && productInfo.providerId) {
          const prov = productInfo.providerId;
          providerName = prov.businessName || prov.fullName || providerName;
          if (prov.address) {
            const addr = prov.address;
            providerAddress = `${addr.addressLine || ''}, ${addr.district || ''}, ${addr.city || ''}`.replace(/^,\s*/, '');
          }
        } else if (firstItem.providerId && typeof firstItem.providerId === 'object') {
          const prov = firstItem.providerId;
          providerName = prov.businessName || prov.fullName || providerName;
          if (prov.address) {
            const addr = prov.address;
            providerAddress = `${addr.addressLine || ''}, ${addr.district || ''}, ${addr.city || ''}`.replace(/^,\s*/, '');
          }
        } else if (firstItem.productId && realProductList.length > 0) {
          const prod = realProductList.find((p: any) => p._id === firstItem.productId.toString() || p._id === firstItem.productId);
          if (prod && prod.providerId) {
            providerName = prod.providerId.businessName || prod.providerId.fullName || providerName;
            if (prod.providerId.address) {
              const addr = prod.providerId.address;
              providerAddress = `${addr.addressLine || ''}, ${addr.district || ''}, ${addr.city || ''}`.replace(/^,\s*/, '');
            }
          }
        }

        const totalQuantity = productItems.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
        const sizes = Array.from(new Set(productItems.map((it: any) => it.selectedSize || it.size || 'M'))).join(', ');
        const colors = Array.from(new Set(productItems.map((it: any) => it.selectedColor || it.color || 'RED'))).join(', ');
        const totalCost = b.totalAmount || productItems.reduce((sum: number, it: any) => sum + (it.unitPrice || 0), 0);

        let productImage = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
        if (productInfo?.images && productInfo.images.length > 0) {
          const img = productInfo.images[0];
          productImage = img.startsWith('http') ? img : `${API_BASE_URL}${img}`;
        } else if (firstItem.image || firstItem.productImage) {
          const img = firstItem.image || firstItem.productImage;
          productImage = img.startsWith('http') ? img : `${API_BASE_URL}${img}`;
        }

        rentalItems.push({
          id: b._id,
          bookingId: b._id,
          bookingCode: b.bookingCode,
          status: b.status,
          name: productInfo?.name || firstItem.name || 'Mẫu Áo Dài Di Sản',
          totalQuantity,
          image: productImage,
          size: sizes,
          color: colors,
          rentalType: firstItem.rentalType || 'DAILY',
          startDate: firstItem.startDate || firstItem.rentalFrom,
          endDate: firstItem.endDate || firstItem.rentalTo,
          startTime: firstItem.startTime,
          endTime: firstItem.endTime,
          shootTimeSlot: firstItem.shootTimeSlot,
          unitPrice: totalCost,
          depositAmount: b.depositAmount || 0,
          providerName,
          providerAddress,
          booking: b
        });
      }
    }
  });

  const sortedRentals = [...rentalItems].sort(sortItemsByUrgencyDate);
  const totalRentalPages = Math.ceil(sortedRentals.length / ITEMS_PER_PAGE) || 1;
  const displayRentals = sortedRentals.slice(
    (currentPageRentals - 1) * ITEMS_PER_PAGE,
    currentPageRentals * ITEMS_PER_PAGE
  );

  // --- 3. FAVORITES (Danh sách yêu thích) ---
  const realFavorites = React.useMemo(() => {
    if (!user?.favorites || !Array.isArray(user.favorites)) return [];

    const list: any[] = [];
    user.favorites.forEach((fav: any) => {
      const targetId = fav.targetId?.toString() || fav.targetId;
      if (fav.targetType === 'PRODUCT' || fav.targetType === 'Product') {
        const prod = realProductList.find(p => p._id === targetId);
        if (prod) {
          list.push({
            id: prod._id,
            itemType: 'PRODUCT',
            name: prod.name,
            image: prod.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
            price: prod.basePrice,
            material: prod.materials?.[0] || 'Lụa truyền thống',
            link: `/rentals/${prod._id}`
          });
        }
      } else if (fav.targetType === 'PROVIDER' || fav.targetType === 'Provider' || fav.targetType === 'PHOTOGRAPHER' || fav.targetType === 'Photographer') {
        const photo = realPhotographersList.find(p => {
          const pid = p._id?.toString() || p._id;
          const provId = p.providerId?.toString() || p.providerId;
          return pid === targetId || provId === targetId;
        });
        if (photo) {
          list.push({
            id: photo._id,
            itemType: 'PHOTOGRAPHY_PACKAGE',
            name: photo.businessName || photo.name,
            image: getFirstMediaUrl(
              photo.packages?.[0]?.images?.[0],
              photo.coverImage,
              photo.media?.coverUrl,
              photo.media?.images?.[0],
              photo.portfolioItems?.[0]?.images?.[0]
            ) || '/avatar_hanna.png',
            price: photo.packages && photo.packages.length > 0 ? Math.min(...photo.packages.map((p: any) => p.price)) : 1500000,
            material: photo.quote || 'Nhiếp ảnh gia chuyên nghiệp',
            link: `/photographers`
          });
        }
      }
    });
    return list;
  }, [user?.favorites, realProductList, realPhotographersList]);

  const pendingBookings = (bookings || []).filter(
    (b) => b.status === 'PENDING_PAYMENT' || b.status === 'WAITING_PAYMENT'
  );

  const pendingIncidents = (bookings || []).filter(
    (b) => b.status === 'RETURN_PENDING'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>

      {/* Pending incident compensation notification section */}
      {pendingIncidents.length > 0 && (
        <div style={{
          backgroundColor: '#FDF2F2',
          border: '1px solid #FDE8E8',
          borderRadius: '16px',
          padding: '20px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h4 style={{ margin: 0, color: '#9B1C1C', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={18} style={{ color: '#E53E3E' }} />
            Yêu cầu đền bù hỏng đồ cần phản hồi ({pendingIncidents.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingIncidents.map((b) => {
              return (
                <div key={b._id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  border: '1px solid #FEE2E2',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937' }}>Mã đơn: {b.bookingCode}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#E53E3E', backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>CHỜ XÁC NHẬN SỰ CỐ</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Đơn hàng bị báo cáo gặp sự cố hỏng đồ. Vui lòng bấm vào chi tiết để xem hình ảnh bằng chứng và thực hiện Đồng ý đền bù hoặc Khiếu nại.
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => onViewDetails(b)}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#C0392B',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#A93226'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#C0392B'}
                    >
                      Xem & Phản hồi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending payments notification section */}
      {pendingBookings.length > 0 && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '16px',
          padding: '20px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h4 style={{ margin: 0, color: '#92400E', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Clock size={18} style={{ color: '#D97706' }} />
            Đơn hàng chờ cọc / thanh toán ({pendingBookings.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingBookings.map((b) => {
              const formattedDate = b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN') : 'Vừa xong';
              return (
                <div key={b._id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  border: '1px solid #F3F4F6',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937' }}>Mã đơn: {b.bookingCode}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>CHỜ THANH TOÁN</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Thời gian tạo: {formattedDate} • Tổng tiền: <strong style={{ color: '#8B1E22' }}>{(b.pricingSummary?.grandTotal || 0).toLocaleString('vi-VN')}đ</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onViewDetails(b)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#F3F4F6',
                        color: '#4B5563',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                    >
                      Chi tiết
                    </button>
                    <button
                      onClick={() => handleContinuePayment(b._id)}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#8B1E22',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#72181B'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8B1E22'}
                    >
                      Tiếp tục thanh toán
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation tabs row */}
      <div className="vh-profile-tabs-navigation-row">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'appointments' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Lịch hẹn của tôi
        </button>
        <button
          onClick={() => setActiveTab('rentals')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'rentals' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Áo dài đã thuê
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'favorites' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Danh sách yêu thích
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`vh-profile-navigation-tab-btn ${activeTab === 'payments' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
        >
          Lịch sử thanh toán
        </button>
      </div>

      {/* Tab Panels */}
      <div className="vh-profile-tab-content-panel">

        {/* PANEL 1: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          isLoadingBookings ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '12px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', padding: '30px' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid #F3F4F6', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', color: '#8C827A', fontWeight: 500 }}>Đang tải lịch hẹn...</span>
            </div>
          ) : (
          <div className="vh-profile-appointments-grid">
            {displayAppointments.length === 0 ? (
              <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8' }}>
                <Calendar size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có lịch hẹn nào</h5>
                <p style={{ fontSize: '13px', color: '#8C827A' }}>Bạn chưa đặt lịch chụp ảnh nào với nhiếp ảnh gia.</p>
              </div>
            ) : (
              displayAppointments.map((app) => (
                <div
                  key={app.id}
                  className={`vh-profile-appointment-card ${app.statusType === 'UPCOMING' ? 'vh-appointment-upcoming' : 'vh-appointment-past'}`}
                >
                  <div className="vh-appointment-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(app.booking?.bookingType === 'COMBO' || app.booking?.items?.some((i: any) => i.itemType === 'PRODUCT')) && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #8B1E22 0%, #DC2626 100%)',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          boxShadow: '0 2px 5px rgba(139, 30, 34, 0.3)',
                        }}>
                          <Sparkles size={12} fill="#FFF" /> GÓI COMBO TRỌN GÓI
                        </span>
                      )}
                      {app.rawStatus === 'DEPOSIT_PAID' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#EA580C', color: 'white' }}>
                          <Clock size={13} style={{ marginRight: '6px' }} />
                          CHỜ THỢ CHỤP XÁC NHẬN • {app.dateStr}
                        </span>
                      ) : app.rawStatus === 'AWAITING_REVIEW' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#0284C7', color: 'white' }}>
                          <Clock size={13} style={{ marginRight: '6px' }} />
                          CHỜ XÁC NHẬN • {app.dateStr}
                        </span>
                      ) : app.rawStatus === 'COMBO_PHOTOS_APPROVED' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#059669', color: 'white' }}>
                          <CheckCircle size={13} style={{ marginRight: '6px' }} />
                          ĐÃ DUYỆT ẢNH • {app.dateStr}
                        </span>
                      ) : app.rawStatus === 'IN_PROGRESS' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#059669', color: 'white' }}>
                          <Clock size={13} style={{ marginRight: '6px' }} />
                          ĐANG CHỤP • {app.dateStr}
                        </span>
                      ) : app.isOverdue ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#C2410C', color: 'white' }}>
                          <Clock size={13} style={{ marginRight: '6px' }} />
                          {app.isPastTimeToday ? 'QUÁ GIỜ CHỤP' : 'QUÁ HẠN CHỤP'} • {app.dateStr}
                        </span>
                      ) : app.statusType === 'UPCOMING' ? (
                        <span className="vh-appointment-status-label-upcoming">
                          <Calendar size={13} style={{ marginRight: '6px' }} />
                          SẮP TỚI • {app.dateStr}
                        </span>
                      ) : (
                        <span className="vh-appointment-status-label-past">
                          <History size={13} style={{ marginRight: '6px' }} />
                          {app.statusLabel.toUpperCase()} • {app.dateStr}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="vh-appointment-card-title font-header">{app.title}</h4>
                    <div className="vh-appointment-card-detail-item" style={{ marginBottom: '6px' }}>
                      <User size={13} className="vh-appointment-icon-muted" style={{ marginRight: '6px' }} />
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Thợ ảnh: <strong>{app.photographerName}</strong></span>
                    </div>
                    <div className="vh-appointment-card-detail-item">
                      <MapPin size={13} className="vh-appointment-icon-muted" style={{ marginRight: '6px', marginTop: '2px', flexShrink: 0 }} />
                      <span 
                        style={{ 
                          fontSize: '13px', 
                          color: 'var(--color-text-secondary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.4,
                          textAlign: 'left'
                        }} 
                        title={app.shootLocation}
                      >
                      </span>
                    </div>

                    {(app.rawStatus === 'PICKUP_PENDING' || app.booking?.status === 'PICKUP_PENDING') && (
                      <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#EDF9F2', border: '1px solid #C2F0D7', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#27AE60', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Check size={14} /> Cửa hàng đã chuẩn bị xong áo dài. Vui lòng kiểm tra & xác nhận nhận đồ:
                        </p>
                        {app.booking?.handoverPhotos && app.booking.handoverPhotos.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                            {app.booking.handoverPhotos.map((photo: string, index: number) => {
                              const url = photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
                              return (
                                <a key={index} href={url} target="_blank" rel="noreferrer" style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #C2F0D7', flexShrink: 0 }}>
                                  <img src={url} alt="Handover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
                          <button 
                            onClick={() => handleConfirmPickup(app.id)}
                            style={{
                              flex: 1, backgroundColor: '#27AE60', color: 'white', border: 'none',
                              padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                            }}
                          >
                            <Check size={14} /> Xác nhận đã nhận áo dài
                          </button>
                        </div>
                      </div>
                    )}

                    {(app.rawStatus === 'AWAITING_REVIEW' || app.rawStatus === 'COMBO_PHOTOS_APPROVED') && (
                      <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#0369A1', fontWeight: 600, margin: '0 0 10px 0', lineHeight: 1.4 }}>
                          📷 Thợ ảnh đã báo hoàn thành buổi chụp. Vui lòng kiểm tra & xác nhận trong 48h (hệ thống sẽ tự động xác nhận sau 48h).
                        </p>
                        {(() => {
                          const photos = (app.booking?.deliveredPhotos && app.booking.deliveredPhotos.length > 0)
                            ? app.booking.deliveredPhotos
                            : [];
                          const driveUrl = app.booking?.deliveryDriveUrl;
                          if (photos.length === 0 && !driveUrl) return null;

                          return (
                            <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                              {photos.length > 0 && (
                                <>
                                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', margin: '0 0 6px 0' }}>
                                    📸 {photos.length} ảnh kết quả đã bàn giao:
                                  </p>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {photos.slice(0, 4).map((photo: string, idx: number) => {
                                      const photoUrl = photo.startsWith('http') ? photo : `${import.meta.env.VITE_API_URL || ''}${photo}`;
                                      return (
                                        <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #BFDBFE', display: 'block' }}>
                                          <img src={photoUrl} alt={`Ảnh ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </a>
                                      );
                                    })}
                                    {photos.length > 4 && (
                                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>
                                        +{photos.length - 4}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                              {driveUrl && (
                                <div style={{ marginTop: photos.length > 0 ? '6px' : '0', marginBottom: '6px' }}>
                                  <a
                                    href={driveUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      backgroundColor: '#2563EB',
                                      color: '#FFFFFF',
                                      borderRadius: '6px',
                                      padding: '8px 14px',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                                    }}
                                  >
                                    🔗 Mở Kho Ảnh Gốc (Google Drive)
                                  </a>
                                </div>
                              )}
                              {photos.length > 0 && (
                                <button
                                  onClick={() => onViewDetails(app.booking)}
                                  style={{ background: 'none', border: 'none', color: '#1D4ED8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                >
                                  Xem tất cả & Tải xuống →
                                </button>
                              )}
                            </div>
                          );
                        })()}
                        {app.booking?.photosApproved ? (
                          <div style={{ padding: '8px 12px', backgroundColor: '#EDF9F2', border: '1px solid #C2F0D7', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#27AE60', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={14} /> Bạn đã xác nhận hài lòng với bộ ảnh chụp này.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleConfirmComplete(app.id)}
                              style={{ flex: 1, backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              ✓ Xác nhận hài lòng
                            </button>
                            <button
                              onClick={() => handleDisputeBooking(app.id)}
                              style={{ backgroundColor: 'white', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Khiếu nại
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Customer Report / Dispute button during CONFIRMED, IN_PROGRESS, AWAITING_REVIEW or OVERDUE */}
                    {(app.rawStatus === 'CONFIRMED' || app.rawStatus === 'IN_PROGRESS' || app.rawStatus === 'AWAITING_REVIEW' || app.isOverdue) && app.rawStatus !== 'DISPUTED' && app.rawStatus !== 'COMPLETED' && app.rawStatus !== 'CANCELLED' && (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          onClick={() => handleDisputeBooking(app.id)}
                          style={{
                            width: '100%',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            borderRadius: '6px',
                            padding: '7px 12px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <AlertTriangle size={13} />
                          Báo thợ ảnh không đến / Khiếu nại
                        </button>
                      </div>
                    )}

                    {/* Cancellation reason from provider */}
                    {app.rawStatus === 'CANCELLED' && app.booking?.cancellation?.reason && (
                      <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                          Lý do hủy đơn
                        </p>
                        <p style={{ fontSize: '12px', color: '#7F1D1D', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                          {app.booking.cancellation.reason}
                        </p>
                        {app.booking.cancellation.cancelledAt && (
                          <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '4px 0 0 0' }}>
                            {new Date(app.booking.cancellation.cancelledAt).toLocaleString('vi-VN')}
                          </p>
                        )}
                      </div>
                    )}

                  </div>

                  <div className="vh-appointment-card-footer">
                    {app.statusType === 'UPCOMING' ? (
                      <span className="vh-appointment-time-badge">{app.timeStr}</span>
                    ) : (
                      <span className="vh-appointment-status-success">{app.timeStr}</span>
                    )}
                    {app.isReal ? (
                      <button
                        className="vh-appointment-action-link"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        onClick={() => onViewDetails(app.booking)}
                      >
                        Chi tiết
                      </button>
                    ) : (
                      <span className="vh-appointment-action-link" style={{ cursor: 'pointer' }}>
                        {app.statusType === 'UPCOMING' ? 'Chi tiết' : 'Đặt lại'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Dashed placeholder card to book new appointment */}
            <button
              onClick={() => navigate('/photographers')}
              className="vh-profile-appointment-card-dashed-btn"
              style={{ width: '100%', height: '100%', minHeight: '184px' }}
            >
              <div className="vh-appointment-dashed-circle" style={{ backgroundColor: '#FDE8E8', color: '#8B1E22' }}>
                <Plus size={20} />
              </div>
              <h5 className="vh-appointment-dashed-title font-header">Đặt lịch hẹn mới</h5>
              <p className="vh-appointment-dashed-desc">Trải nghiệm dịch vụ cá nhân hóa</p>
            </button>

            {/* Pagination Controls for Appointments */}
            {totalAppointmentPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '24px', width: '100%', gridColumn: 'span 2' }}>
                <button
                  disabled={currentPageAppointments === 1}
                  onClick={() => setCurrentPageAppointments(p => Math.max(p - 1, 1))}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                    backgroundColor: currentPageAppointments === 1 ? '#F3F4F6' : 'white',
                    color: currentPageAppointments === 1 ? '#9CA3AF' : '#374151',
                    fontWeight: 600, cursor: currentPageAppointments === 1 ? 'not-allowed' : 'pointer', fontSize: '13px'
                  }}
                >
                  &laquo; Trang trước
                </button>
                {Array.from({ length: totalAppointmentPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPageAppointments(idx + 1)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '6px', border: '1px solid',
                      borderColor: currentPageAppointments === idx + 1 ? 'var(--color-primary-dark, #4A0E17)' : '#E5E7EB',
                      backgroundColor: currentPageAppointments === idx + 1 ? 'var(--color-primary-dark, #4A0E17)' : 'white',
                      color: currentPageAppointments === idx + 1 ? 'white' : '#374151',
                      fontWeight: 700, cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  disabled={currentPageAppointments === totalAppointmentPages}
                  onClick={() => setCurrentPageAppointments(p => Math.min(p + 1, totalAppointmentPages))}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                    backgroundColor: currentPageAppointments === totalAppointmentPages ? '#F3F4F6' : 'white',
                    color: currentPageAppointments === totalAppointmentPages ? '#9CA3AF' : '#374151',
                    fontWeight: 600, cursor: currentPageAppointments === totalAppointmentPages ? 'not-allowed' : 'pointer', fontSize: '13px'
                  }}
                >
                  Trang sau &raquo;
                </button>
              </div>
            )}
          </div>
          )
        )}

        {/* PANEL 2: RENTALS */}
        {activeTab === 'rentals' && (
          isLoadingBookings ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '12px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', padding: '30px' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid #F3F4F6', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', color: '#8C827A', fontWeight: 500 }}>Đang tải trang phục đã thuê...</span>
            </div>
          ) : (
          <div className="vh-profile-appointments-grid">
            {displayRentals.length === 0 ? (
              <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8' }}>
                <History size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có trang phục nào được thuê</h5>
                <p style={{ fontSize: '13px', color: '#8C827A' }}>Hãy khám phá các bộ sưu tập áo dài của chúng tôi để bắt đầu thuê.</p>
              </div>
            ) : (
              displayRentals.map((item) => {
                const isReturned = item.status === 'RETURNED' || item.status === 'COMPLETED';
                const isIncidentPending = item.status === 'RETURN_PENDING';
                const isDisputed = item.status === 'DISPUTED';
                
                const timeSlotStr = item.shootTimeSlot || (item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : '');
                const rentalDateFormatted = item.rentalType === 'DAILY'
                  ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                  : `Ngày ${formatDate(item.startDate)}${timeSlotStr ? ' (' + timeSlotStr + ')' : ''}`;

                const getRentalStatus = () => {
                  if (item.status === 'PENDING_PAYMENT') {
                    return { 
                      label: 'CHỜ THANH TOÁN', 
                      color: '#E67E22', 
                      bgColor: '#FFF5EC', 
                      borderColor: '#FFE0C2',
                      icon: History
                    };
                  }
                  if (item.status === 'CANCELLED') {
                    return { 
                      label: 'ĐÃ HỦY', 
                      color: '#7F8C8D', 
                      bgColor: '#F8F9F9', 
                      borderColor: '#EAEDED',
                      icon: History
                    };
                  }
                  if (isReturned) {
                    return { 
                      label: 'ĐÃ TRẢ ĐỒ', 
                      color: '#27AE60', 
                      bgColor: '#EDF9F2', 
                      borderColor: '#C2F0D7',
                      icon: History
                    };
                  }
                  if (isIncidentPending) {
                    return { 
                      label: 'YÊU CẦU ĐỀN BÙ', 
                      color: '#D97706', 
                      bgColor: '#FEF3C7', 
                      borderColor: '#FDE68A',
                      icon: AlertTriangle
                    };
                  }
                  if (isDisputed) {
                    return { 
                      label: 'ĐANG TRANH CHẤP', 
                      color: '#B91C1C', 
                      bgColor: '#FEE2E2', 
                      borderColor: '#FCA5A5',
                      icon: AlertTriangle
                    };
                  }
                  
                  if (item.status === 'PICKUP_PENDING') {
                    return { 
                      label: 'XÁC NHẬN TẠI QUẦY (30 PHÚT)', 
                      color: '#D35400', 
                      bgColor: '#FDF2E9', 
                      borderColor: '#F5CBA7',
                      icon: Clock
                    };
                  }
                  
                  if (item.status === 'PICKED_UP') {
                    return { 
                      label: 'ĐANG THUÊ', 
                      color: '#27AE60', 
                      bgColor: '#EDF9F2', 
                      borderColor: '#C2F0D7',
                      icon: Calendar
                    };
                  }
                  
                  // For CONFIRMED, DEPOSIT_PAID
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const start = item.startDate ? new Date(item.startDate) : null;
                  if (start) start.setHours(0, 0, 0, 0);
                  
                  const end = item.endDate ? new Date(item.endDate) : null;
                  if (end) end.setHours(23, 59, 59, 999);
                  
                  if (start && today < start) {
                    return { 
                      label: 'SẮP THUÊ', 
                      color: '#2980B9', 
                      bgColor: '#EBF5FB', 
                      borderColor: '#AED6F1',
                      icon: Calendar
                    };
                  }
                  if (end && today > end) {
                    return { 
                      label: 'CHỜ TRẢ ĐỒ', 
                      color: '#E74C3C', 
                      bgColor: '#FDEDEC', 
                      borderColor: '#FADBD8',
                      icon: Calendar
                    };
                  }
                  
                  return { 
                    label: 'ĐANG THUÊ', 
                    color: '#27AE60', 
                    bgColor: '#EDF9F2', 
                    borderColor: '#C2F0D7',
                    icon: Calendar
                  };
                };
                
                const statusInfo = getRentalStatus();
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={item.id}
                    className={`vh-profile-appointment-card ${isReturned || item.status === 'CANCELLED' ? 'vh-appointment-past' : 'vh-appointment-upcoming'}`}
                  >
                    <div className="vh-appointment-card-header">
                      <span
                        className={isReturned || item.status === 'CANCELLED' ? 'vh-appointment-status-label-past' : 'vh-appointment-status-label-upcoming'}
                        style={{
                          color: statusInfo.color,
                          backgroundColor: statusInfo.bgColor,
                          border: `1px solid ${statusInfo.borderColor}`
                        }}
                      >
                        <StatusIcon size={13} style={{ marginRight: '6px' }} />
                        {statusInfo.label.toUpperCase()} • {rentalDateFormatted}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="vh-appointment-card-title font-header">
                        {item.name} {item.totalQuantity > 1 ? `(x${item.totalQuantity})` : ''}
                      </h4>
                      <div className="vh-appointment-card-detail-item" style={{ marginBottom: '6px' }}>
                        <User size={13} className="vh-appointment-icon-muted" style={{ marginRight: '6px' }} />
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Kích cỡ: <strong>{item.size}</strong> • Màu: <strong>{item.color}</strong></span>
                      </div>
                      <div className="vh-appointment-card-detail-item">
                        <MapPin size={13} className="vh-appointment-icon-muted" style={{ marginRight: '6px', marginTop: '2px', flexShrink: 0 }} />
                        <span 
                          style={{ 
                            fontSize: '13px', 
                            color: 'var(--color-text-secondary)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.4,
                            textAlign: 'left'
                          }} 
                          title={item.providerAddress}
                        >
                          Cửa hàng: <strong>{item.providerName}</strong> ({item.providerAddress})
                        </span>
                      </div>

                      {/* Các nút giao nhận: Chỉ hiển thị khi đơn ở trạng thái chờ nhận đồ PICKUP_PENDING */}
                      {item.status === 'PICKUP_PENDING' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', width: '100%' }}>
                          {/* Ảnh bàn giao từ Shop nếu có */}
                          {item.booking?.handoverPhotos && item.booking.handoverPhotos.length > 0 && (
                            <div style={{
                              backgroundColor: '#EDF9F2',
                              border: '1px solid #C2F0D7',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#27AE60', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Check size={12} /> Ảnh bàn giao từ Shop:
                              </span>
                              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                                {item.booking.handoverPhotos.map((photo: string, index: number) => {
                                  const url = photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
                                  return (
                                    <a key={index} href={url} target="_blank" rel="noreferrer" style={{ width: '48px', height: '48px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #C2F0D7', flexShrink: 0 }}>
                                      <img src={url} alt="Handover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Đếm ngược 30 phút xác nhận */}
                          {item.booking?.handoverInitiatedAt && (
                            <HandoverCountdown 
                              initiatedAt={item.booking.handoverInitiatedAt} 
                              onTimeout={() => {
                                onRefresh();
                              }} 
                            />
                          )}

                          {/* Các nút bấm thao tác giao nhận */}
                          <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => handleConfirmPickup(item.booking?._id || item.booking?.id)}
                              style={{
                                flex: 1, backgroundColor: '#27AE60', color: 'white', border: 'none',
                                padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                minWidth: '90px'
                              }}
                            >
                              <Check size={13} /> Nhận đồ
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedBookingId(item.booking?._id || item.booking?.id);
                                setReportModalType('DAMAGE');
                                setReportDesc('');
                                setReportPhotos([]);
                                setIsReportModalOpen(true);
                              }}
                              style={{
                                flex: 1, backgroundColor: '#F39C12', color: 'white', border: 'none',
                                padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                minWidth: '90px'
                              }}
                            >
                              <AlertTriangle size={13} /> Báo lỗi nhẹ
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedBookingId(item.booking?._id || item.booking?.id);
                                setReportModalType('REJECT');
                                setReportDesc('');
                                setReportPhotos([]);
                                setIsReportModalOpen(true);
                              }}
                              style={{
                                flex: 1, backgroundColor: '#C0392B', color: 'white', border: 'none',
                                padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                minWidth: '90px'
                              }}
                            >
                              <XCircle size={13} /> Từ chối nhận
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cảnh báo sự cố nếu có */}
                      {isIncidentPending && (
                        <div style={{
                          backgroundColor: '#FFF7ED',
                          border: '1px solid #FDE68A',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          marginTop: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '12px',
                          textAlign: 'left',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0 }} /> Shop yêu cầu đền bù sự cố hỏng đồ!
                          </div>
                          <div style={{ color: '#78350F', lineHeight: 1.4 }}>
                            Vui lòng bấm nút <strong style={{ color: '#C0392B' }}>"Phản hồi đền bù"</strong> bên dưới để xem ảnh bằng chứng và chọn phương án Chấp nhận hoặc Khiếu nại.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="vh-appointment-card-footer">
                      <span className={isReturned || item.status === 'CANCELLED' ? 'vh-appointment-status-success' : 'vh-appointment-time-badge'}>
                        {item.unitPrice?.toLocaleString('vi-VN')}đ
                      </span>
                      
                      {item.booking ? (
                        <button 
                          className="vh-appointment-action-link"
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            padding: 0, 
                            cursor: 'pointer',
                            color: (isIncidentPending || isDisputed) ? '#C0392B' : undefined,
                            fontWeight: (isIncidentPending || isDisputed) ? 700 : undefined
                          }}
                          onClick={() => onViewDetails(item.booking)}
                        >
                          {isIncidentPending ? 'Phản hồi đền bù' : isDisputed ? 'Chi tiết tranh chấp' : 'Chi tiết'}
                        </button>
                      ) : (
                        <span className="vh-appointment-action-link" style={{ cursor: 'pointer' }}>
                          Chi tiết
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* Pagination Controls for Rentals */}
            {totalRentalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '24px', width: '100%', gridColumn: 'span 2' }}>
                <button
                  disabled={currentPageRentals === 1}
                  onClick={() => setCurrentPageRentals(p => Math.max(p - 1, 1))}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                    backgroundColor: currentPageRentals === 1 ? '#F3F4F6' : 'white',
                    color: currentPageRentals === 1 ? '#9CA3AF' : '#374151',
                    fontWeight: 600, cursor: currentPageRentals === 1 ? 'not-allowed' : 'pointer', fontSize: '13px'
                  }}
                >
                  &laquo; Trang trước
                </button>
                {Array.from({ length: totalRentalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPageRentals(idx + 1)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '6px', border: '1px solid',
                      borderColor: currentPageRentals === idx + 1 ? 'var(--color-primary-dark, #4A0E17)' : '#E5E7EB',
                      backgroundColor: currentPageRentals === idx + 1 ? 'var(--color-primary-dark, #4A0E17)' : 'white',
                      color: currentPageRentals === idx + 1 ? 'white' : '#374151',
                      fontWeight: 700, cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  disabled={currentPageRentals === totalRentalPages}
                  onClick={() => setCurrentPageRentals(p => Math.min(p + 1, totalRentalPages))}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                    backgroundColor: currentPageRentals === totalRentalPages ? '#F3F4F6' : 'white',
                    color: currentPageRentals === totalRentalPages ? '#9CA3AF' : '#374151',
                    fontWeight: 600, cursor: currentPageRentals === totalRentalPages ? 'not-allowed' : 'pointer', fontSize: '13px'
                  }}
                >
                  Trang sau &raquo;
                </button>
              </div>
            )}
          </div>
          )
        )}

        {/* PANEL 3: FAVORITES */}
        {activeTab === 'favorites' && (
          isLoadingFavorites ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '12px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', padding: '30px' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid #F3F4F6', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', color: '#8C827A', fontWeight: 500 }}>Đang tải danh sách yêu thích...</span>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
            {/* Sub-tabs header */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #EAEAE8', paddingBottom: '12px' }}>
              <button
                onClick={() => setFavoriteSubTab('aodai')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: favoriteSubTab === 'aodai' ? 'var(--color-primary)' : '#8C827A',
                  borderBottom: favoriteSubTab === 'aodai' ? '2px solid var(--color-primary)' : 'none',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                Trang phục áo dài ({realFavorites.filter(item => item.itemType === 'PRODUCT').length})
              </button>
              <button
                onClick={() => setFavoriteSubTab('photographer')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: favoriteSubTab === 'photographer' ? 'var(--color-primary)' : '#8C827A',
                  borderBottom: favoriteSubTab === 'photographer' ? '2px solid var(--color-primary)' : 'none',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                Nhiếp ảnh gia ({realFavorites.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').length})
              </button>
            </div>

            {/* Sub-tab content */}
            {favoriteSubTab === 'aodai' ? (
              <div className="vh-profile-favorites-grid-layout">
                {realFavorites.filter(item => item.itemType === 'PRODUCT').length === 0 ? (
                  <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                    <Heart size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                    <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có áo dài yêu thích</h5>
                    <p style={{ fontSize: '13px', color: '#8C827A' }}>Hãy tìm kiếm những bộ áo dài tuyệt vời và lưu lại tại đây.</p>
                  </div>
                ) : (
                  realFavorites.filter(item => item.itemType === 'PRODUCT').map((item) => (
                    <div key={item.id} className="vh-profile-rental-product-card">
                      <div className="vh-profile-rental-img-wrapper" style={{ height: '280px' }}>
                        <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                      </div>
                      <div className="vh-profile-rental-details">
                        <div>
                          <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                          <span className="vh-profile-rental-material" style={{ marginTop: '6px', display: 'block' }}>{item.material}</span>
                        </div>
                        <div className="vh-profile-rental-price-row">
                          <div className="vh-profile-rental-price-sub">
                            <span>Giá cọc / dịch vụ tham khảo</span>
                            <strong>{item.price.toLocaleString('vi-VN')}đ</strong>
                          </div>
                          <button
                            className="vh-appointment-action-link"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            onClick={() => navigate(item.link)}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="vh-profile-favorites-grid-layout">
                {realFavorites.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').length === 0 ? (
                  <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                    <Heart size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                    <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có nhiếp ảnh gia yêu thích</h5>
                    <p style={{ fontSize: '13px', color: '#8C827A' }}>Hãy khám phá các thợ chụp hình và lưu nhiếp ảnh gia bạn thích.</p>
                  </div>
                ) : (
                  realFavorites.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').map((item) => (
                    <div key={item.id} className="vh-profile-rental-product-card">
                      <div className="vh-profile-rental-img-wrapper" style={{ height: '280px' }}>
                        <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                      </div>
                      <div className="vh-profile-rental-details">
                        <div>
                          <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                          <span className="vh-profile-rental-material" style={{ marginTop: '6px', display: 'block' }}>{item.material}</span>
                        </div>
                        <div className="vh-profile-rental-price-row">
                          <div className="vh-profile-rental-price-sub">
                            <span>Giá dịch vụ tham khảo</span>
                            <strong>{item.price.toLocaleString('vi-VN')}đ</strong>
                          </div>
                          <button
                            className="vh-appointment-action-link"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            onClick={() => navigate(item.link)}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          )
        )}

        {/* PANEL 4: PAYMENTS */}
        {activeTab === 'payments' && (
          isLoadingPayments ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '12px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', padding: '30px' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid #F3F4F6', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', color: '#8C827A', fontWeight: 500 }}>Đang tải lịch sử thanh toán...</span>
            </div>
          ) : (
          <div className="vh-profile-payments-table-wrapper">
            {/* Payment Category Sub-Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPaymentCategoryTab('all')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: paymentCategoryTab === 'all' ? '#2D2926' : '#EAEAE8',
                  backgroundColor: paymentCategoryTab === 'all' ? '#2D2926' : '#FFFFFF',
                  color: paymentCategoryTab === 'all' ? '#FFFFFF' : '#6B7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: paymentCategoryTab === 'all' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Tất cả ({payments.length})
              </button>
              <button
                type="button"
                onClick={() => setPaymentCategoryTab('aodai')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: paymentCategoryTab === 'aodai' ? '#2D2926' : '#EAEAE8',
                  backgroundColor: paymentCategoryTab === 'aodai' ? '#2D2926' : '#FFFFFF',
                  color: paymentCategoryTab === 'aodai' ? '#FFFFFF' : '#6B7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: paymentCategoryTab === 'aodai' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                👘 Đơn thuê áo dài
              </button>
              <button
                type="button"
                onClick={() => setPaymentCategoryTab('photography')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: paymentCategoryTab === 'photography' ? '#2D2926' : '#EAEAE8',
                  backgroundColor: paymentCategoryTab === 'photography' ? '#2D2926' : '#FFFFFF',
                  color: paymentCategoryTab === 'photography' ? '#FFFFFF' : '#6B7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: paymentCategoryTab === 'photography' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                📷 Đơn photographer
              </button>
            </div>

            {(() => {
              const filteredList = payments.filter((p) => {
                if (paymentCategoryTab === 'all') return true;

                let bType: string | undefined = undefined;
                if (p.bookingId && typeof p.bookingId === 'object') {
                  bType = p.bookingId.bookingType;
                }
                if (!bType) {
                  const bIdStr = typeof p.bookingId === 'object' ? (p.bookingId._id || p.bookingId.id) : p.bookingId;
                  const matchedBooking = bookings.find((b) => (b._id || b.id) === bIdStr);
                  if (matchedBooking) {
                    bType = matchedBooking.bookingType;
                  }
                }

                if (paymentCategoryTab === 'aodai') {
                  return bType === 'AODAI_RENTAL' || bType === 'COMBO' || !bType;
                }
                if (paymentCategoryTab === 'photography') {
                  return bType === 'PHOTOGRAPHY' || bType === 'COMBO';
                }
                return true;
              });

              if (filteredList.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAEAE8', width: '100%' }}>
                    <ShieldCheck size={32} style={{ color: '#8C827A', margin: '0 auto 12px' }} />
                    <h5 className="font-header" style={{ fontSize: '16px', color: '#2D2926', marginBottom: '4px' }}>Chưa có lịch sử giao dịch</h5>
                    <p style={{ fontSize: '13px', color: '#8C827A' }}>
                      {paymentCategoryTab === 'aodai'
                        ? 'Chưa có giao dịch nào thuộc đơn thuê áo dài.'
                        : paymentCategoryTab === 'photography'
                          ? 'Chưa có giao dịch nào thuộc đơn photographer.'
                          : 'Bạn chưa thực hiện bất kỳ giao dịch thanh toán nào.'}
                    </p>
                  </div>
                );
              }

              return (
                <table className="vh-profile-payments-table">
                  <thead>
                    <tr>
                      <th>Mã giao dịch</th>
                      <th>Dịch vụ</th>
                      <th>Số tiền</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((p) => {
                      let bType: string | undefined = undefined;
                      if (p.bookingId && typeof p.bookingId === 'object') {
                        bType = p.bookingId.bookingType;
                      }
                      if (!bType) {
                        const bIdStr = typeof p.bookingId === 'object' ? (p.bookingId._id || p.bookingId.id) : p.bookingId;
                        const matchedBooking = bookings.find((b) => (b._id || b.id) === bIdStr);
                        if (matchedBooking) bType = matchedBooking.bookingType;
                      }

                      return (
                        <tr
                          key={p._id || p.paymentCode}
                          onClick={() => {
                            let bId = p.bookingId;
                            if (bId && typeof bId === 'object') {
                              bId = bId.id || bId._id;
                            }
                            if (bId) {
                              setSelectedBookingId(bId);
                              setIsDetailModalOpen(true);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                          className="hover:bg-stone-50 transition"
                        >
                          <td style={{ fontWeight: 700 }}>{p.paymentCode}</td>
                          <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                            <div style={{ fontWeight: 600, color: '#2D2926' }}>
                              {p.purpose === 'DEPOSIT_PAYMENT'
                                ? 'Đặt cọc giữ chỗ'
                                : p.purpose === 'DEPOSIT_REFUND'
                                  ? 'Hoàn trả tiền cọc'
                                  : 'Thanh toán hoàn tất'}
                            </div>
                            {bType && (
                              <div style={{ fontSize: '11px', color: '#8C827A', marginTop: '2px' }}>
                                {bType === 'PHOTOGRAPHY' ? '📷 Gói chụp ảnh' : bType === 'COMBO' ? '✨ Combo Thuê & Chụp' : '👘 Thuê áo dài'}
                              </div>
                            )}
                          </td>
                          <td style={{
                            fontWeight: 800,
                            color: p.purpose === 'DEPOSIT_REFUND' ? '#2e7d32' : 'var(--color-primary-dark)'
                          }}>
                            {p.purpose === 'DEPOSIT_REFUND' ? '+' : ''}{p.amount?.toLocaleString('vi-VN')}đ
                          </td>
                          <td>
                            {p.paymentMethod === 'PAYOS_REFUND'
                              ? 'Hoàn tiền (PayOS)'
                              : p.paymentMethod || 'PayOS (VietQR)'}
                          </td>
                          <td>
                            {p.status === 'SUCCESS' ? (
                              <span className="vh-profile-payment-status-success-badge" style={{
                                backgroundColor: p.purpose === 'DEPOSIT_REFUND' ? '#e8f5e9' : undefined,
                                color: p.purpose === 'DEPOSIT_REFUND' ? '#2e7d32' : undefined,
                              }}>
                                <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                                <span>Thành công</span>
                              </span>
                            ) : p.status === 'PENDING' ? (
                              <span className="vh-profile-payment-status-pending-badge" style={{
                                backgroundColor: '#FEF3C7',
                                color: '#D97706',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}>
                                <Clock size={12} style={{ marginRight: '4px' }} />
                                <span>Chờ thanh toán</span>
                              </span>
                            ) : p.status === 'CANCELLED' ? (
                              <span className="vh-profile-payment-status-cancelled-badge" style={{
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}>
                                <X size={12} style={{ marginRight: '4px' }} />
                                <span>Đã hủy</span>
                              </span>
                            ) : (
                              <span className="vh-profile-payment-status-failed-badge" style={{
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}>
                                <X size={12} style={{ marginRight: '4px' }} />
                                <span>Thất bại</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
          )
        )}

      </div>

      {/* Review Modal popup */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleCreateReview} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-up-fade">
            <div className="px-6 py-4 bg-stone-900 text-white flex justify-between items-center">
              <h4 className="font-header text-sm font-bold">Viết đánh giá dịch vụ</h4>
              <button type="button" onClick={() => setReviewingItem(null)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2 items-center">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Chọn số sao đánh giá</span>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-amber-500 hover:scale-110 transition"
                    >
                      <Star size={32} fill={star <= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-stone-700 font-bold uppercase">Nội dung nhận xét</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 placeholder:text-stone-400"
                  rows={4}
                  placeholder="Chia sẻ trải nghiệm của bạn về phom dáng áo dài hoặc tác phong chụp ảnh..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs tracking-wider rounded-xl transition"
              >
                GỬI ĐÁNH GIÁ NGAY
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report Damage or Reject Handover Modal */}
      {isReportModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '460px',
            padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--font-header)', color: '#2D2926' }}>
              {reportModalType === 'DAMAGE' ? '⚠️ Báo cáo lỗi nhẹ khi nhận' : '🔴 Từ chối nhận đồ do lỗi nặng'}
            </h3>
            <p style={{ fontSize: '12px', color: '#8C827A', marginBottom: '16px' }}>
              {reportModalType === 'DAMAGE' 
                ? 'Nếu trang phục có vết bẩn nhỏ, vết xước cũ, hãy chụp ảnh lại làm bằng chứng để không bị phạt cọc lúc trả.'
                : 'Nếu trang phục bị rách nặng, sai mẫu mã không mặc được, hãy chụp ảnh lại để hủy đơn & hoàn tiền 100%.'}
            </p>

            {/* Description text area */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#2D2926' }}>Mô tả chi tiết lỗi:</label>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Mô tả cụ thể vị trí và tình trạng lỗi..."
                style={{
                  width: '100%', height: '80px', borderRadius: '8px', border: '1px solid #EAEAE8',
                  padding: '10px', fontSize: '13px', outline: 'none', resize: 'none', color: '#2D2926'
                }}
              />
            </div>

            {/* Upload image area */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#2D2926' }}>
                Hình ảnh bằng chứng (Bắt buộc có ít nhất 1 ảnh):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {reportPhotos.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #EAEAE8' }}>
                    <img src={url} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      type="button"
                      onClick={() => setReportPhotos(prev => prev.filter((_, i) => i !== idx))}
                      style={{
                        position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {reportPhotos.length < 5 && (
                  <label style={{
                    width: '70px', height: '70px', borderRadius: '6px', border: '2px dashed #CCCCCC',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#8C827A'
                  }}>
                    <Plus size={18} />
                    <span style={{ fontSize: '10px' }}>Tải lên</span>
                    <input 
                      type="file" 
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                style={{
                  flex: 1, backgroundColor: 'white', color: '#2D2926', border: '1px solid #EAEAE8',
                  padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button 
                type="button"
                onClick={handleSubmitReport}
                style={{
                  flex: 1, 
                  backgroundColor: reportModalType === 'DAMAGE' ? '#F39C12' : '#C0392B', 
                  color: 'white', border: 'none',
                  padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photography Booking Complaint Modal popup */}
      {isPhotoDisputeModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px',
            padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, fontFamily: 'var(--font-header)', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="#DC2626" />
                Khiếu nại đơn chụp ảnh
              </h3>
              <button
                type="button"
                onClick={() => setIsPhotoDisputeModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6B7280' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.5 }}>
              Bộ phận Chăm sóc khách hàng & Admin sẽ kiểm tra thông tin và hỗ trợ giải quyết tranh chấp trong vòng 24 giờ.
            </p>

            {/* Dropdown Select Reason */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#1F2937' }}>
                Lý do khiếu nại (chọn từ danh sách):
              </label>
              <select
                value={selectedDisputeReason}
                onChange={(e) => setSelectedDisputeReason(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB',
                  fontSize: '13px', outline: 'none', color: '#1F2937', backgroundColor: '#F9FAFB', fontWeight: 500
                }}
              >
                <option value="Thợ chụp ảnh không đến / Vắng mặt tại buổi chụp">Thợ chụp ảnh không đến / Vắng mặt tại buổi chụp</option>
                <option value="Thợ chụp ảnh đến trễ so với lịch hẹn">Thợ chụp ảnh đến trễ so với lịch hẹn</option>
                <option value="Thái độ thợ chụp không chuyên nghiệp / không hợp tác">Thái độ thợ chụp không chuyên nghiệp / không hợp tác</option>
                <option value="Sản phẩm ảnh giao không đạt chất lượng / Giao ảnh trễ">Sản phẩm ảnh giao không đạt chất lượng / Giao ảnh trễ</option>
                <option value="Khác (Vui lòng nhập chi tiết bên dưới)">Khác (Vui lòng nhập chi tiết bên dưới)</option>
              </select>
            </div>

            {/* Description / Additional Detail Textarea */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#1F2937' }}>
                {selectedDisputeReason.startsWith('Khác') ? 'Mô tả chi tiết lý do khiếu nại (bắt buộc):' : 'Bổ sung ghi chú chi tiết (nếu có):'}
              </label>
              <textarea
                value={photoDisputeNote}
                onChange={(e) => setPhotoDisputeNote(e.target.value)}
                placeholder={selectedDisputeReason.startsWith('Khác') ? 'Nhập chi tiết cụ thể lý do khiếu nại...' : 'Mô tả thêm thời gian, địa điểm hoặc chi tiết sự việc...'}
                style={{
                  width: '100%', height: '85px', borderRadius: '8px', border: '1px solid #D1D5DB',
                  padding: '10px 12px', fontSize: '13px', outline: 'none', resize: 'none', color: '#1F2937'
                }}
              />
            </div>

            {/* Upload evidence photos */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#1F2937' }}>
                Hình ảnh bằng chứng (ảnh tin nhắn, lịch sử cuộc gọi... - tùy chọn):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {photoDisputePhotos.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                    <img src={url} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => setPhotoDisputePhotos(prev => prev.filter((_, i) => i !== idx))}
                      style={{
                        position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {photoDisputePhotos.length < 5 && (
                  <label style={{
                    width: '64px', height: '64px', borderRadius: '6px', border: '2px dashed #D1D5DB',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#6B7280', backgroundColor: '#F9FAFB'
                  }}>
                    <Plus size={18} />
                    <span style={{ fontSize: '10px' }}>Tải ảnh</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoDisputeUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setIsPhotoDisputeModalOpen(false)}
                style={{
                  flex: 1, backgroundColor: 'white', color: '#374151', border: '1px solid #D1D5DB',
                  padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmitPhotoDispute}
                style={{
                  flex: 1, backgroundColor: '#DC2626', color: 'white', border: 'none',
                  padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(220,38,38,0.2)'
                }}
              >
                Gửi khiếu nại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      <BookingDetailModal
        bookingId={selectedBookingId}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        viewerRole="customer"
        onBookingChanged={onRefresh}
        onWriteReview={(itemDetails) => {
          setIsDetailModalOpen(false);
          setReviewingItem(itemDetails);
        }}
      />
    </div>
  );
};

export default CustomerDashboard;
