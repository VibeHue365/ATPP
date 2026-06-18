import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { httpClient } from '../../services/httpClient';
import { 
  Camera, 
  ShieldCheck, 
  Calendar, 
  History, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  CalendarRange, 
  Plus, 
  Star, 
  Pencil,
  Check,
  Heart
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';
import { ROUTES } from '../../config/routes';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/feedback/Toast';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'appointments';

  // Modals state control - Only View modal is needed now
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Detailed Booking Modal state
  const [activeDetailBooking, setActiveDetailBooking] = useState<any>(null);

  const statusLabels: Record<string, { label: string, color: string, bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#7F8C8D', bg: '#F2F4F4' },
    PENDING_PAYMENT: { label: 'Chờ thanh toán', color: '#D35400', bg: '#FDEBD0' },
    DEPOSIT_PAID: { label: 'Đã đặt cọc', color: '#2980B9', bg: '#EBF5FB' },
    CONFIRMED: { label: 'Đã xác nhận', color: '#27AE60', bg: '#E8F8F5' },
    PICKUP_PENDING: { label: 'Chờ nhận đồ', color: '#8E44AD', bg: '#F5EEF8' },
    PICKED_UP: { label: 'Đã nhận đồ', color: '#16A085', bg: '#E8F8F5' },
    RETURN_PENDING: { label: 'Chờ trả đồ', color: '#F39C12', bg: '#FEF9E7' },
    RETURNED: { label: 'Đã trả đồ', color: '#2ECC71', bg: '#E8F8F5' },
    COMPLETED: { label: 'Hoàn thành', color: '#27AE60', bg: '#E8F8F5' },
    CANCELLED: { label: 'Đã hủy', color: '#C0392B', bg: '#FDEDEC' },
    DISPUTED: { label: 'Đang tranh chấp', color: '#78281F', bg: '#F9EBEA' },
    PARTIALLY_REFUNDED: { label: 'Hoàn tiền một phần', color: '#7D6608', bg: '#FEF9E7' },
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

  const handleCancelBooking = async () => {
    if (!activeDetailBooking) return;
    const confirmCancel = window.confirm("Bạn có chắc chắn muốn hủy đơn đặt lịch này không? Lịch bận sẽ được giải phóng ngay lập tức.");
    if (!confirmCancel) return;

    try {
      const response = await httpClient.post<any>(`/api/bookings/${activeDetailBooking._id}/cancel`, {});
      if (response.success) {
        if (response.isFreeCancel) {
          toast.success(`Hủy đơn thành công! Khách hàng được hoàn trả 100% tiền cọc (${response.refundAmount.toLocaleString('vi-VN')}đ).`);
        } else {
          toast.error(`Hủy đơn thành công! Bạn bị phạt mất cọc do hủy sát giờ: ${response.penaltyReason || ''}`);
        }
        
        // Refresh bookings list
        const updated = await httpClient.get<any[]>('/api/bookings');
        setBookings(updated || []);
        setActiveDetailBooking(null);
      }
    } catch (err: any) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      toast.error(err.message || 'Không thể hủy đơn hàng. Vui lòng thử lại!');
    }
  };

  // Bio & Location state loaded from local storage for persistency
  const [bio, setBio] = useState(() => {
    return localStorage.getItem(`vh_user_bio_${user?.id}`) || 'Người yêu tơ lụa & di sản văn hóa Việt';
  });
  const [locationText, setLocationText] = useState(() => {
    return localStorage.getItem(`vh_user_location_${user?.id}`) || 'Hà Nội, VN';
  });

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

  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoadingBookings(true);
        const data = await httpClient.get<any[]>('/api/bookings');
        setBookings(data || []);
      } catch (err: any) {
        console.error('Lỗi khi tải đơn đặt lịch:', err);
      } finally {
        setLoadingBookings(false);
      }
    };
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const photographyBookings = useMemo(() => {
    const list: any[] = [];
    bookings.forEach(b => {
      if (b.items) {
        b.items.forEach((item: any) => {
          if (item.itemType === 'PHOTOGRAPHY_PACKAGE') {
            list.push({
              bookingId: b._id,
              bookingCode: b.bookingCode,
              status: b.status,
              type: 'PHOTOGRAPHY',
              name: item.photographyPackageId?.name || item.packageName || 'Gói Chụp Ảnh',
              photographerName: item.providerId?.businessName || item.photographerName || 'Nhiếp ảnh gia',
              image: item.photographyPackageId?.images?.[0] || item.photographerAvatar || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e',
              date: item.shootDate,
              timeSlot: item.shootTimeSlot,
              location: item.shootLocation,
              concept: item.shootConcept,
              price: item.unitPrice,
            });
          }
        });
      }
    });
    return list;
  }, [bookings]);

  const rentalBookings = useMemo(() => {
    const list: any[] = [];
    bookings.forEach(b => {
      if (b.items) {
        b.items.forEach((item: any) => {
          if (item.itemType === 'PRODUCT') {
            list.push({
              bookingId: b._id,
              bookingCode: b.bookingCode,
              status: b.status,
              rentalType: item.rentalType,
              name: item.productId?.name || item.productName || 'Áo dài',
              material: item.productId?.materials?.join(', ') || 'Lụa truyền thống',
              price: item.unitPrice,
              rentalFrom: item.rentalType === 'HOURLY' ? item.shootDate : item.rentalFrom,
              rentalTo: item.rentalTo,
              timeSlot: item.shootTimeSlot,
              image: item.productId?.images?.[0] || item.productImage || 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f',
            });
          }
        });
      }
    });
    return list;
  }, [bookings]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar;
      const filename = user.avatar.includes('/') || user.avatar.includes('\\') 
        ? user.avatar.split(/[/\\]/).pop() 
        : user.avatar;
      return `${API_BASE_URL}/uploads/avatars/${filename}`;
    }
    // Elegant high-fidelity profile avatar default placeholder
    return '/avatar_hanna.png';
  };

  const getFirstName = () => {
    if (!user?.fullName) return 'Bạn';
    const parts = user.fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
  };

  // rentedItems removed

  // Mock data for Favorites
  const [favorites, setFavorites] = useState([
    {
      id: 'f1',
      name: 'Lam Ngọc Heritage',
      material: 'Gấm & Satin',
      price: '850,000đ',
      image: '/lam_ngoc.png'
    },
    {
      id: 'f2',
      name: 'Nắng Thủy Tiên',
      material: 'Linen tự nhiên',
      price: '420,000đ',
      image: '/nang_thuy_tien.png'
    }
  ]);

  const handleRemoveFavorite = (id: string, name: string) => {
    setFavorites(favorites.filter(item => item.id !== id));
    toast.success(`Đã xóa "${name}" khỏi danh sách yêu thích!`);
  };

  // Mock data for Payment History
  const paymentHistory = [
    {
      id: 'TXN89127021',
      date: '28/04/2026',
      service: 'Thuê trang phục "Hồng Liên Hoa"',
      amount: '1,200,000đ',
      method: 'Chuyển khoản QR',
      status: 'Thành công'
    },
    {
      id: 'TXN89125601',
      date: '10/04/2026',
      service: 'Thuê trang phục "Cúc Họa Mi"',
      amount: '550,000đ',
      method: 'Ví điện tử',
      status: 'Thành công'
    },
    {
      id: 'TXN89110481',
      date: '02/09/2024',
      service: 'Tư vấn Bộ sưu tập "Sắc Son"',
      amount: '300,000đ',
      method: 'Thẻ tín dụng',
      status: 'Thành công'
    }
  ];

  const translateGender = (g?: string) => {
    if (g === 'MALE') return 'Nam';
    if (g === 'FEMALE') return 'Nữ';
    if (g === 'OTHER') return 'Khác';
    return 'Chưa cập nhật';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
                <span className="vh-profile-hero-stat-value font-header">
                  {String(rentalBookings.length).padStart(2, '0')}
                </span>
                <span className="vh-profile-hero-stat-label">LẦN THUÊ</span>
              </div>
              <div className="vh-profile-hero-stat-divider" />
              <div className="vh-profile-hero-stat">
                <span className="vh-profile-hero-stat-value font-header">
                  {String(photographyBookings.length).padStart(2, '0')}
                </span>
                <span className="vh-profile-hero-stat-label">LỊCH HẸN</span>
              </div>
              <div className="vh-profile-hero-stat-divider" />
              <div className="vh-profile-hero-stat">
                <span className="vh-profile-hero-stat-value font-header">{favorites.length + 26}</span>
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
        {/* Header Tabs */}
        <div className="vh-profile-tabs-navigation-row">
          <button 
            className={`vh-profile-navigation-tab-btn font-header ${activeTab === 'appointments' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
            onClick={() => handleTabChange('appointments')}
          >
            Lịch hẹn của tôi
          </button>
          <button 
            className={`vh-profile-navigation-tab-btn font-header ${activeTab === 'rentals' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
            onClick={() => handleTabChange('rentals')}
          >
            Áo dài đã thuê
          </button>
          <button 
            className={`vh-profile-navigation-tab-btn font-header ${activeTab === 'favorites' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
            onClick={() => handleTabChange('favorites')}
          >
            Danh sách yêu thích
          </button>
          <button 
            className={`vh-profile-navigation-tab-btn font-header ${activeTab === 'payments' ? 'vh-profile-navigation-tab-btn-active' : ''}`}
            onClick={() => handleTabChange('payments')}
          >
            Lịch sử thanh toán
          </button>
        </div>

        {/* Tab content panel */}
        <div className="vh-profile-tab-content-panel">
          
          {/* Tab 1: Appointments Grid */}
          {activeTab === 'appointments' && (
            <div className="vh-profile-appointments-grid animate-fade-in">
              {loadingBookings ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: '#8C827A' }}>
                  Đang tải danh sách lịch hẹn...
                </div>
              ) : photographyBookings.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: '#8C827A' }}>
                  Bạn chưa có lịch hẹn đặt lịch chụp ảnh nào.
                </div>
              ) : (
                photographyBookings.map((appt, index) => {
                  const isUpcoming = new Date(appt.date) >= new Date();
                  return (
                    <div key={appt.bookingId + '_' + index} className={`vh-profile-appointment-card ${isUpcoming ? 'vh-appointment-upcoming' : 'vh-appointment-past'}`}>
                      <div className="vh-appointment-card-header">
                        <div className={isUpcoming ? 'vh-appointment-status-label-upcoming' : 'vh-appointment-status-label-past'}>
                          {isUpcoming ? <Calendar size={13} style={{ marginRight: '4px' }} /> : <History size={13} style={{ marginRight: '4px' }} />}
                          <span>{isUpcoming ? 'SẮP TỚI' : 'ĐÃ QUA'} • {formatDate(appt.date)}</span>
                        </div>
                      </div>
                      <h4 className="vh-appointment-card-title font-header">{appt.name}</h4>
                      <div className="vh-appointment-card-detail-item">
                        <User size={14} className="vh-appointment-icon-muted" />
                        <span>{appt.type === 'PHOTOGRAPHY' ? `Thợ ảnh: ${appt.photographerName}` : `Cung cấp: ${appt.providerName}`}</span>
                      </div>
                      {appt.location && (
                        <div className="vh-appointment-card-detail-item">
                          <MapPin size={14} className="vh-appointment-icon-muted" />
                          <span>{appt.location}</span>
                        </div>
                      )}
                      <div className="vh-appointment-card-footer">
                        <span className="vh-appointment-time-badge font-header">{appt.timeSlot || 'Cả ngày'}</span>
                        <a href="#details" className="vh-appointment-action-link" onClick={(e) => { 
                          e.preventDefault(); 
                          const fullBooking = bookings.find(b => b.bookingCode === appt.bookingCode);
                          if (fullBooking) {
                            setActiveDetailBooking(fullBooking);
                          } else {
                            toast.info(`Mã đơn: ${appt.bookingCode} - Chi phí: ${appt.price.toLocaleString('vi-VN')}đ`); 
                          }
                        }}>
                          Chi tiết
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* Card 3: Create new appointment dashed card */}
              <button 
                className="vh-profile-appointment-card-dashed-btn"
                onClick={() => navigate(ROUTES.PHOTOGRAPHERS)}
              >
                <div className="vh-appointment-dashed-circle">
                  <Plus size={24} />
                </div>
                <h4 className="vh-appointment-dashed-title font-header">Đặt lịch hẹn mới</h4>
                <p className="vh-appointment-dashed-desc">Khám phá nhiếp ảnh gia di sản</p>
              </button>
            </div>
          )}

          {/* Tab 2: Rented Items */}
          {activeTab === 'rentals' && (
            <div className="vh-profile-rentals-grid-layout animate-fade-in">
              {loadingBookings ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '40px 0', color: '#8C827A' }}>
                  Đang tải danh sách trang phục...
                </div>
              ) : rentalBookings.length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '40px 0', color: '#8C827A' }}>
                  Bạn chưa có đơn thuê áo dài nào.
                </div>
              ) : (
                rentalBookings.map((item, index) => {
                  const isRenting = item.status !== 'RETURNED' && item.status !== 'COMPLETED';
                  return (
                    <div key={item.bookingId + '_' + index} className="vh-profile-rental-product-card">
                      <div className="vh-profile-rental-img-wrapper">
                        <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                        <span className={`vh-profile-rental-status-badge ${!isRenting ? 'status-returned' : 'status-renting'}`}>
                          {!isRenting ? 'ĐÃ TRẢ' : 'ĐANG THUÊ'}
                        </span>
                      </div>
                      <div className="vh-profile-rental-details">
                        <div className="vh-profile-rental-name-row">
                          <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                          <span className="vh-profile-rental-date">{formatDate(item.rentalFrom)}</span>
                        </div>
                        <span className="vh-profile-rental-material">{item.material}</span>
                        <div className="vh-profile-rental-price-row">
                          <div className="vh-profile-rental-price-sub">
                            <span>Thời hạn thuê</span>
                            <strong className="font-header" style={{ fontSize: '11px', color: '#8C827A' }}>
                              {item.rentalType === 'HOURLY' 
                                ? `Ngày ${formatDate(item.rentalFrom)} (${item.timeSlot || 'Cả ngày'})`
                                : `${formatDate(item.rentalFrom)} - ${formatDate(item.rentalTo)}`
                              }
                            </strong>
                          </div>
                          <button 
                            className="vh-btn vh-btn-outline vh-btn-sm" 
                            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }} 
                            onClick={() => {
                              const fullBooking = bookings.find(b => b.bookingCode === item.bookingCode);
                              if (fullBooking) {
                                setActiveDetailBooking(fullBooking);
                              } else {
                                toast.success(`Đơn hàng: ${item.bookingCode} - Giá trị: ${item.price.toLocaleString('vi-VN')}đ`);
                              }
                            }}
                          >
                            Hóa đơn
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: Favorite items list */}
          {activeTab === 'favorites' && (
            <div className="vh-profile-favorites-grid-layout animate-fade-in">
              {favorites.length === 0 ? (
                <div className="vh-favorites-empty-state">
                  <Heart size={40} className="text-stone-300 mb-2" />
                  <p className="text-stone-500">Danh sách yêu thích trống.</p>
                </div>
              ) : (
                favorites.map((item) => (
                  <div key={item.id} className="vh-profile-rental-product-card">
                    <div className="vh-profile-rental-img-wrapper">
                      <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                      <button 
                        className="vh-profile-favorite-heart-active-btn" 
                        onClick={() => handleRemoveFavorite(item.id, item.name)}
                        title="Xóa khỏi yêu thích"
                      >
                        <Heart size={16} fill="currentColor" />
                      </button>
                    </div>
                    <div className="vh-profile-rental-details">
                      <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                      <span className="vh-profile-rental-material">{item.material}</span>
                      <div className="vh-profile-rental-price-row" style={{ marginTop: '16px' }}>
                        <strong className="font-header" style={{ fontSize: '18px', color: 'var(--color-text-primary)' }}>{item.price}</strong>
                        <button className="vh-btn vh-btn-primary vh-btn-sm" style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }} onClick={() => toast.success(`Khởi tạo đặt mua ${item.name}!`)}>
                          Đặt ngay
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Payments history Table */}
          {activeTab === 'payments' && (
            <div className="vh-profile-payments-table-wrapper animate-fade-in">
              <table className="vh-profile-payments-table">
                <thead>
                  <tr>
                    <th>Mã giao dịch</th>
                    <th>Ngày thanh toán</th>
                    <th>Dịch vụ / Trang phục</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id}>
                      <td className="font-header font-bold text-stone-900">{payment.id}</td>
                      <td>{payment.date}</td>
                      <td>{payment.service}</td>
                      <td className="font-bold text-stone-950">{payment.amount}</td>
                      <td className="text-stone-500 text-xs">{payment.method}</td>
                      <td>
                        <span className="vh-profile-payment-status-success-badge">
                          <Check size={10} style={{ marginRight: '3px' }} />
                          <span>{payment.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* AI Recommendation Showcase Section */}
      <section className="vh-profile-ai-recommendation-section-container">
        <h2 className="vh-profile-ai-recommendation-title font-header">
          Gợi ý riêng cho {getFirstName()}
        </h2>
        <div className="vh-profile-ai-recommendation-grid">
          {/* Product card 1: Phượng Hoàng Cung Đình */}
          <div className="vh-profile-ai-product-card animate-hover-lift">
            <div className="vh-profile-ai-product-image-wrapper">
              <img src="/phuong_hoang.png" alt="Phượng Hoàng Cung Đình" className="vh-profile-ai-product-img" />
            </div>
            <div className="vh-profile-ai-product-meta">
              <h4 className="vh-profile-ai-product-title font-header">PHƯỢNG HOÀNG CUNG ĐÌNH</h4>
              <p className="vh-profile-ai-product-subtitle">Lụa Hà Đông cao cấp</p>
            </div>
          </div>

          {/* Product card 2: Tuyết Mai Thanh Khiết */}
          <div className="vh-profile-ai-product-card animate-hover-lift">
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
            <button className="vh-btn vh-btn-secondary" style={{ padding: '8px 20px', borderRadius: '8px' }} onClick={() => setIsViewOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Modal View: Chi tiết đơn hàng */}
      {activeDetailBooking && (
        <Modal 
          isOpen={!!activeDetailBooking} 
          onClose={() => setActiveDetailBooking(null)} 
          title={`Chi tiết đơn hàng: ${activeDetailBooking.bookingCode}`} 
          maxWidth="680px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '13.5px', color: '#4A4440' }}>
            
            {/* Header info row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAEAE8', paddingBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ngày tạo đơn</div>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{formatDate(activeDetailBooking.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {getStatusBadge(activeDetailBooking.status)}
                {getPaymentStatusBadge(activeDetailBooking.paymentSummary?.paymentStatus)}
              </div>
            </div>

            {/* Customer information section */}
            <div style={{ backgroundColor: '#FCF9F2', padding: '12px 16px', borderRadius: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', display: 'block' }}>Khách hàng</span>
                <strong style={{ display: 'block', fontSize: '13px', marginTop: '2px' }}>{user?.fullName || 'Người dùng VibeHue'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', display: 'block' }}>Liên hệ</span>
                <span style={{ display: 'block', fontSize: '13px', marginTop: '2px' }}>{user?.phone || user?.email || 'N/A'}</span>
              </div>
            </div>

            {/* Items list */}
            <div>
              <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>Danh sách sản phẩm & dịch vụ</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeDetailBooking.items?.map((item: any, idx: number) => {
                  const isProduct = item.itemType === 'PRODUCT';
                  const name = isProduct 
                    ? (item.productId?.name || item.productName || 'Trang phục Áo dài')
                    : (item.photographyPackageId?.name || item.packageName || 'Gói Chụp Ảnh');
                  const provider = isProduct
                    ? (item.productId?.providerId?.businessName || item.providerId?.businessName || 'Cửa hàng')
                    : (item.providerId?.businessName || 'Nhiếp ảnh gia');
                  const img = isProduct
                    ? (item.productId?.images?.[0] || item.productImage || 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f')
                    : (item.photographyPackageId?.images?.[0] || item.photographerAvatar || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e');

                  return (
                    <div key={idx} style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #EAEAE8', paddingBottom: '16px' }}>
                      {/* Item Image */}
                      <img 
                        src={img} 
                        alt={name} 
                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #EAEAE8' }} 
                      />
                      
                      {/* Item Details */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <h5 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{name}</h5>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {(item.unitPrice * (item.quantity || 1)).toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Cung cấp bởi: <strong>{provider}</strong>
                        </div>

                        {/* Options / Details depending on type */}
                        {isProduct ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px', fontSize: '12px' }}>
                            {item.selectedSize && (
                              <span style={{ backgroundColor: '#F5F5F5', padding: '2px 8px', borderRadius: '4px' }}>
                                Kích cỡ: <strong>{item.selectedSize}</strong>
                              </span>
                            )}
                            {item.selectedColor && (
                              <span style={{ backgroundColor: '#F5F5F5', padding: '2px 8px', borderRadius: '4px' }}>
                                Màu sắc: <strong>{item.selectedColor}</strong>
                              </span>
                            )}
                            <span style={{ backgroundColor: '#F5F5F5', padding: '2px 8px', borderRadius: '4px' }}>
                              Hình thức: <strong>{item.rentalType === 'HOURLY' ? 'Thuê theo giờ' : 'Thuê theo ngày'}</strong>
                            </span>
                            
                            {item.rentalType === 'HOURLY' ? (
                              <div style={{ width: '100%', marginTop: '4px', color: 'var(--color-primary-dark)' }}>
                                Lịch thuê: <strong>{formatDate(item.shootDate)} ({item.shootTimeSlot || 'Cả ngày'})</strong>
                              </div>
                            ) : (
                              <div style={{ width: '100%', marginTop: '4px', color: 'var(--color-primary-dark)' }}>
                                Lịch thuê: <strong>{formatDate(item.rentalFrom)} - {formatDate(item.rentalTo)}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', fontSize: '12px' }}>
                            <div style={{ width: '100%', color: 'var(--color-primary-dark)' }}>
                              Ngày chụp: <strong>{formatDate(item.shootDate)} ({item.shootTimeSlot || 'Cả ngày'})</strong>
                            </div>
                            {item.shootLocation && (
                              <div style={{ width: '100%' }}>
                                Địa điểm: <strong>{item.shootLocation}</strong>
                              </div>
                            )}
                            {item.shootConcept && (
                              <div style={{ width: '100%' }}>
                                Concept chụp: <strong>{item.shootConcept}</strong>
                              </div>
                            )}
                          </div>
                        )}

                        {item.customRequests && (
                          <div style={{ marginTop: '6px', fontSize: '12px', fontStyle: 'italic', backgroundColor: '#F9F9FB', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #D3D3D3' }}>
                            Yêu cầu thêm: {item.customRequests}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ marginLeft: 'auto', width: '300px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #EAEAE8', paddingTop: '12px' }}>
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
                <span>Đã thanh toán:</span>
                <span style={{ fontWeight: 600 }}>{(activeDetailBooking.paymentSummary?.totalPaid || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8C827A' }}>
                <span>Còn lại:</span>
                <span style={{ fontWeight: 600, color: (activeDetailBooking.pricingSummary?.grandTotal - activeDetailBooking.paymentSummary?.totalPaid) > 0 ? '#D35400' : '#27AE60' }}>
                  {Math.max(0, (activeDetailBooking.pricingSummary?.grandTotal || 0) - (activeDetailBooking.paymentSummary?.totalPaid || 0)).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid #EAEAE8', paddingTop: '16px' }}>
              {activeDetailBooking.status !== 'CANCELLED' && 
               activeDetailBooking.status !== 'COMPLETED' && 
               activeDetailBooking.status !== 'RETURNED' && 
               activeDetailBooking.status !== 'PICKED_UP' && (
                <button 
                  className="vh-btn vh-btn-danger" 
                  style={{ 
                    padding: '8px 24px', 
                    borderRadius: '8px', 
                    fontSize: '13px', 
                    backgroundColor: '#C0392B', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer' 
                  }} 
                  onClick={handleCancelBooking}
                >
                  Hủy đơn
                </button>
              )}
              <button 
                className="vh-btn vh-btn-secondary" 
                style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '13px' }} 
                onClick={() => setActiveDetailBooking(null)}
              >
                Đóng
              </button>
            </div>

          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProfilePage;
