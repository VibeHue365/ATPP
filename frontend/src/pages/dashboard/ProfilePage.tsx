import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { 
  Camera, 
  ShieldCheck, 
  Calendar, 
  User, 
  Mail, 
  Phone, 
  CalendarRange, 
  Star, 
  Pencil
} from 'lucide-react';
import { API_BASE_URL } from '../../config/env';
import { ROUTES } from '../../config/routes';
import { Modal } from '../../components/common/Modal';
import { CustomerDashboard } from '../../features/dashboard/components/CustomerDashboard';
import { ProviderDashboard } from '../../features/dashboard/components/ProviderDashboard';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
                <span className="vh-profile-hero-stat-value font-header">26</span>
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
        {user?.roles?.includes('PROVIDER') ? (
          <ProviderDashboard />
        ) : (
          <CustomerDashboard />
        )}
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
