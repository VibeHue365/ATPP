import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
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

  // Mock data for Áo Dài đã thuê
  const rentedItems = [
    {
      id: 'r1',
      name: 'Cúc Họa Mi',
      material: 'Lụa cao cấp',
      price: '550,000đ',
      rentalDate: '10/04/2026',
      status: 'ĐÃ TRẢ',
      image: '/cuc_hoa_mi.png'
    },
    {
      id: 'r2',
      name: 'Hồng Liên Hoa',
      material: 'Lụa vẽ tay',
      price: '1,200,000đ',
      rentalDate: '28/04/2026',
      status: 'ĐANG THUÊ',
      image: '/hong_lien_hoa.png'
    }
  ];

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
                <span className="vh-profile-hero-stat-value font-header">12</span>
                <span className="vh-profile-hero-stat-label">LẦN THUÊ</span>
              </div>
              <div className="vh-profile-hero-stat-divider" />
              <div className="vh-profile-hero-stat">
                <span className="vh-profile-hero-stat-value font-header">04</span>
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
              {/* Card 1: Upcoming appointment */}
              <div className="vh-profile-appointment-card vh-appointment-upcoming">
                <div className="vh-appointment-card-header">
                  <div className="vh-appointment-status-label-upcoming">
                    <Calendar size={13} style={{ marginRight: '4px' }} />
                    <span>SẮP TỚI • 15 TH10, 2024</span>
                  </div>
                </div>
                <h4 className="vh-appointment-card-title font-header">Thử đồ & Đo may</h4>
                <div className="vh-appointment-card-detail-item">
                  <MapPin size={14} className="vh-appointment-icon-muted" />
                  <span>Showroom Nam Kỳ Khởi Nghĩa, Q.1</span>
                </div>
                <div className="vh-appointment-card-footer">
                  <span className="vh-appointment-time-badge font-header">09:30 AM</span>
                  <a href="#appointment-details" className="vh-appointment-action-link" onClick={(e) => { e.preventDefault(); toast.success('Đang hiển thị chi tiết lịch hẹn sắp tới!'); }}>
                    Chi tiết
                  </a>
                </div>
              </div>

              {/* Card 2: Completed appointment */}
              <div className="vh-profile-appointment-card vh-appointment-past">
                <div className="vh-appointment-card-header">
                  <div className="vh-appointment-status-label-past">
                    <History size={13} style={{ marginRight: '4px' }} />
                    <span>ĐÃ QUA • 02 TH09, 2024</span>
                  </div>
                </div>
                <h4 className="vh-appointment-card-title font-header">Tư vấn Bộ sưu tập "Sắc Son"</h4>
                <div className="vh-appointment-card-detail-item">
                  <User size={14} className="vh-appointment-icon-muted" />
                  <span>Chuyên gia: Linh Nguyen</span>
                </div>
                <div className="vh-appointment-card-footer">
                  <span className="vh-appointment-status-success font-header">Hoàn thành</span>
                  <a href="#rebook" className="vh-appointment-action-link" onClick={(e) => { e.preventDefault(); toast.success('Khởi tạo đặt lịch tư vấn lại bộ sưu tập!'); }}>
                    Đặt lại
                  </a>
                </div>
              </div>

              {/* Card 3: Create new appointment dashed card */}
              <button 
                className="vh-profile-appointment-card-dashed-btn"
                onClick={() => toast.success('Khởi chạy trình đặt lịch hẹn dịch vụ di sản cá nhân hóa!')}
              >
                <div className="vh-appointment-dashed-circle">
                  <Plus size={24} />
                </div>
                <h4 className="vh-appointment-dashed-title font-header">Đặt lịch hẹn mới</h4>
                <p className="vh-appointment-dashed-desc">Trải nghiệm dịch vụ cá nhân hóa</p>
              </button>
            </div>
          )}

          {/* Tab 2: Rented Items */}
          {activeTab === 'rentals' && (
            <div className="vh-profile-rentals-grid-layout animate-fade-in">
              {rentedItems.map((item) => (
                <div key={item.id} className="vh-profile-rental-product-card">
                  <div className="vh-profile-rental-img-wrapper">
                    <img src={item.image} alt={item.name} className="vh-profile-rental-img" />
                    <span className={`vh-profile-rental-status-badge ${item.status === 'ĐÃ TRẢ' ? 'status-returned' : 'status-renting'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="vh-profile-rental-details">
                    <div className="vh-profile-rental-name-row">
                      <h4 className="vh-profile-rental-name font-header">{item.name}</h4>
                      <span className="vh-profile-rental-date">{item.rentalDate}</span>
                    </div>
                    <span className="vh-profile-rental-material">{item.material}</span>
                    <div className="vh-profile-rental-price-row">
                      <div className="vh-profile-rental-price-sub">
                        <span>Tổng thanh toán</span>
                        <strong className="font-header">{item.price}</strong>
                      </div>
                      <button className="vh-btn vh-btn-outline vh-btn-sm" style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }} onClick={() => toast.success(`Mở hóa đơn điện tử cho tà áo ${item.name}`)}>
                        Hóa đơn
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
};

export default ProfilePage;
