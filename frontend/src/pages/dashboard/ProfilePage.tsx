import React, { useState, useEffect, useMemo } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';
import { ROUTES } from '../../config/routes';
import { Modal } from '../../components/common/Modal';
import { CustomerDashboard } from '../../features/dashboard/components/CustomerDashboard';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Modals state control
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeDetailBooking, setActiveDetailBooking] = useState<any>(null);
  
  // Booking Cancel Confirmation state
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Bookings list state
  const [bookings, setBookings] = useState<any[]>([]);

  // Incident & Dispute States for selected booking
  const [bookingIncident, setBookingIncident] = useState<any | null>(null);

  useEffect(() => {
    const fetchIncident = async () => {
      if (activeDetailBooking) {
        try {
          const inc = await httpClient.get(`/api/disputes/incidents/booking/${activeDetailBooking._id}`);
          setBookingIncident(inc);
        } catch (err) {
          console.error('Không thể tải thông tin sự cố:', err);
          setBookingIncident(null);
        }
      } else {
        setBookingIncident(null);
      }
    };
    fetchIncident();
  }, [activeDetailBooking]);

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

  const fetchBookings = async () => {
    try {
      const data = await httpClient.get<any[]>('/api/bookings');
      setBookings(data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách đơn hàng:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

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

  // Status mapping
  const statusLabels: Record<string, { label: string, color: string, bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#7F8C8D', bg: '#F2F4F4' },
    PENDING_PAYMENT: { label: 'Chờ cọc', color: '#D35400', bg: '#FDEBD0' },
    DEPOSIT_PAID: { label: 'Đã cọc (20%)', color: '#2980B9', bg: '#EBF5FB' },
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

            {/* Customer Information */}
            <div style={{ backgroundColor: '#FAF8F5', padding: '16px', borderRadius: '8px', border: '1px solid #EAE1D4' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: '8px', borderBottom: '1px solid rgba(182, 145, 91, 0.15)', paddingBottom: '4px' }}>
                THÔNG TIN KHÁCH HÀNG
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', color: '#4A4440' }}>
                <span>Người đặt: <strong>{user?.fullName || 'Khách hàng'}</strong></span>
                <span>Số điện thoại: <strong>{user?.phone || 'Chưa cập nhật'}</strong></span>
                <span style={{ gridColumn: 'span 2' }}>Email: <strong>{user?.email}</strong></span>
              </div>
            </div>

            {/* Items details loop */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)', margin: 0 }}>
                DANH SÁCH DỊCH VỤ & SẢN PHẨM
              </h4>
              
              {activeDetailBooking.items?.map((item: any, idx: number) => {
                const isProduct = item.itemType === 'PRODUCT';
                const formattedDateStr = isProduct
                  ? (item.rentalType === 'DAILY'
                      ? `${formatDate(item.startDate || item.rentalFrom)} - ${formatDate(item.endDate || item.rentalTo)}`
                      : `Ngày ${formatDate(item.startDate || item.rentalFrom)} (Khung giờ: ${item.startTime} - ${item.endTime})`)
                  : `Ngày chụp: ${formatDate(item.shootDate)} (${item.shootTimeSlot || 'Trống'})`;

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
                    <img 
                      src={item.image || item.productImage || (isProduct ? 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b' : '/avatar_hanna.png')} 
                      alt={item.name} 
                      style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #EAEAE8' }} 
                    />
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h5 style={{ fontSize: '15px', fontWeight: 700, color: '#2D2926', margin: 0 }}>
                          {item.name || (isProduct ? 'Sản phẩm áo dài' : 'Gói chụp ảnh cổ phục')}
                        </h5>
                        
                        <div style={{ fontSize: '12px', color: '#7E6D5B', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>Thời gian: <strong>{formattedDateStr}</strong></span>
                          {isProduct ? (
                            <>
                              <span>Kích cỡ: <strong>{item.size}</strong> • Màu sắc: <strong>{item.color}</strong></span>
                              <span>Địa chỉ nhận: <strong>{item.providerAddress || 'Cửa hàng VibeHue'}</strong></span>
                            </>
                          ) : (
                            <>
                              <span>Địa điểm chụp: <strong>{item.shootLocation || 'Đại Nội Huế'}</strong></span>
                              <span>Concept: <strong>{item.concept || 'Cổ phục tự do'}</strong></span>
                              {item.referenceImage && (
                                <div style={{ marginTop: '8px' }}>
                                  <span style={{ display: 'block', marginBottom: '4px' }}>Ảnh concept mẫu:</span>
                                  <a href={item.referenceImage.startsWith('http') ? item.referenceImage : `${API_BASE_URL}${item.referenceImage.startsWith('/') ? '' : '/'}${item.referenceImage}`} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={item.referenceImage.startsWith('http') ? item.referenceImage : `${API_BASE_URL}${item.referenceImage.startsWith('/') ? '' : '/'}${item.referenceImage}`}
                                      alt="Ảnh concept mẫu"
                                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #EAEAE8', cursor: 'pointer' }}
                                    />
                                  </a>
                                </div>
                              )}
                            </>
                          )}
                          {item.customRequests && (
                            <span style={{ color: '#C0392B', fontStyle: 'italic' }}>
                              Yêu cầu đặc biệt: "{item.customRequests}"
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
            {bookingIncident && (
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
                  <span>Mô tả sự cố: <em style={{ color: '#4A5568' }}>"{bookingIncident.description}"</em></span>
                  <span>Số tiền đền bù yêu cầu: <strong style={{ color: '#C53030', fontSize: '15px' }}>{bookingIncident.requestedAmount?.toLocaleString('vi-VN')}đ</strong></span>
                  
                  {bookingIncident.evidencePhotos && bookingIncident.evidencePhotos.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4A5568', marginBottom: '4px' }}>Hình ảnh bằng chứng:</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {bookingIncident.evidencePhotos.map((photo: string, idx: number) => (
                          <a key={idx} href={photo} target="_blank" rel="noopener noreferrer">
                            <img src={photo} alt={`Bằng chứng ${idx + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #FEB2B2' }} />
                          </a>
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

            {/* Financial Summary */}
            <div style={{ marginLeft: 'auto', width: '320px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #EAEAE8', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Giá thuê/chụp:</span>
                <span>{(activeDetailBooking.pricingSummary?.subTotal || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Tiền cọc trang phục:</span>
                <span>{(activeDetailBooking.pricingSummary?.depositTotal || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              {activeDetailBooking.pricingSummary?.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#27AE60' }}>
                  <span>Giảm giá:</span>
                  <span>-{(activeDetailBooking.pricingSummary?.discountAmount || 0).toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', borderTop: '1px dashed #EAEAE8', paddingTop: '8px' }}>
                <span>Tổng chi phí:</span>
                <span>{(activeDetailBooking.pricingSummary?.grandTotal || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8C827A', marginTop: '4px' }}>
                <span>Đã cọc (thanh toán online):</span>
                <span style={{ fontWeight: 600 }}>{(activeDetailBooking.paymentSummary?.totalPaid || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8C827A' }}>
                <span>Còn lại thanh toán tại tiệm:</span>
                <span style={{ fontWeight: 600, color: (activeDetailBooking.pricingSummary?.grandTotal - activeDetailBooking.paymentSummary?.totalPaid) > 0 ? '#D35400' : '#27AE60' }}>
                  {Math.max(0, (activeDetailBooking.pricingSummary?.grandTotal || 0) - (activeDetailBooking.paymentSummary?.totalPaid || 0)).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Footer action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid #EAEAE8', paddingTop: '16px' }}>
              {/* Only show Cancel button if status is cancellable */}
              {activeDetailBooking.status !== 'CANCELLED' && 
               activeDetailBooking.status !== 'COMPLETED' && 
               activeDetailBooking.status !== 'RETURNED' && 
               activeDetailBooking.status !== 'PICKED_UP' && (
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
                  Hủy lịch / Trả hàng
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

      {/* 3. Modal View: Xác nhận hủy lịch và chính sách hoàn tiền */}
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

    </div>
  );
};

export default ProfilePage;
