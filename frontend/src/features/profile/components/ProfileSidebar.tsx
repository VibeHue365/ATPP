import React, { useState } from 'react';
import {
  LayoutDashboard,
  User,
  Calendar,
  Heart,
  MapPin,
  CreditCard,
  Shield,
  Bell,
  LogOut,
  Headphones,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  Store
} from 'lucide-react';
import type { ProfileTab } from '../types/profile.types';

interface ProfileSidebarProps {
  activeTab: ProfileTab;
  scheduleCategory?: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO';
  onSelectTab: (tab: ProfileTab, category?: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO') => void;
  onLogout: () => void;
  favoritesCount?: number;
  userRoles?: string[];
  onNavigateProvider?: () => void;
}

export const ProfileSidebar: React.FC<ProfileSidebarProps> = ({
  activeTab,
  scheduleCategory = 'RENTAL',
  onSelectTab,
  onLogout,
  favoritesCount = 0,
  userRoles = [],
  onNavigateProvider
}) => {
  const isProvider = userRoles.includes('PROVIDER');
  const [isScheduleOpen, setIsScheduleOpen] = useState(true);

  const isRentalActive = activeTab === 'schedule' && scheduleCategory === 'RENTAL';
  const isPhotoshootActive = activeTab === 'schedule' && scheduleCategory === 'PHOTOSHOOT';
  const isComboActive = activeTab === 'schedule' && scheduleCategory === 'COMBO';

  return (
    <aside className="lume-profile-sidebar">
      {/* 1. Main Navigation Menu */}
      <nav className="lume-sidebar-nav-card">
        {/* Tổng quan */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <LayoutDashboard size={18} />
          <span>Tổng quan</span>
        </button>

        {/* Thông tin cá nhân */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => onSelectTab('personal')}
        >
          <User size={18} />
          <span>Thông tin cá nhân</span>
        </button>

        {/* Lịch của tôi (Expandable) */}
        <div>
          <button
            type="button"
            className={`lume-sidebar-menu-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => {
              onSelectTab('schedule', scheduleCategory);
              setIsScheduleOpen(!isScheduleOpen);
            }}
            style={{ justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={18} />
              <span>Lịch của tôi</span>
            </div>
            {isScheduleOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {/* Sub-items */}
          {isScheduleOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '34px', gap: '2px', marginTop: '2px', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={() => onSelectTab('schedule', 'RENTAL')}
                style={{
                  background: isRentalActive ? 'rgba(139, 30, 45, 0.06)' : 'none',
                  border: 'none',
                  borderRadius: '6px',
                  textAlign: 'left',
                  padding: '7px 12px',
                  fontSize: '13px',
                  fontWeight: isRentalActive ? 700 : 500,
                  color: isRentalActive ? '#8B1E2D' : '#7D736B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isRentalActive ? '#8B1E2D' : '#C7BFB5' }} />
                <span>Thuê áo dài</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('schedule', 'PHOTOSHOOT')}
                style={{
                  background: isPhotoshootActive ? 'rgba(139, 30, 45, 0.06)' : 'none',
                  border: 'none',
                  borderRadius: '6px',
                  textAlign: 'left',
                  padding: '7px 12px',
                  fontSize: '13px',
                  fontWeight: isPhotoshootActive ? 700 : 500,
                  color: isPhotoshootActive ? '#8B1E2D' : '#7D736B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isPhotoshootActive ? '#8B1E2D' : '#C7BFB5' }} />
                <span>Chụp ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('schedule', 'COMBO')}
                style={{
                  background: isComboActive ? 'rgba(139, 30, 45, 0.06)' : 'none',
                  border: 'none',
                  borderRadius: '6px',
                  textAlign: 'left',
                  padding: '7px 12px',
                  fontSize: '13px',
                  fontWeight: isComboActive ? 700 : 500,
                  color: isComboActive ? '#8B1E2D' : '#7D736B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isComboActive ? '#8B1E2D' : '#C7BFB5' }} />
                <span>Combo</span>
              </button>
            </div>
          )}
        </div>

        {/* Yêu thích */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => onSelectTab('favorites')}
        >
          <Heart size={18} />
          <span>Yêu thích</span>
          {favoritesCount > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                fontWeight: 700,
                background: '#FDF2F4',
                color: '#8B1E2D',
                padding: '2px 8px',
                borderRadius: '999px'
              }}
            >
              {favoritesCount}
            </span>
          )}
        </button>

        {/* Địa chỉ của tôi */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'addresses' ? 'active' : ''}`}
          onClick={() => onSelectTab('addresses')}
        >
          <MapPin size={18} />
          <span>Địa chỉ của tôi</span>
        </button>

        {/* Phương thức thanh toán */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => onSelectTab('payments')}
        >
          <CreditCard size={18} />
          <span>Phương thức thanh toán</span>
        </button>

        {/* Bảo mật */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => onSelectTab('security')}
        >
          <Shield size={18} />
          <span>Bảo mật</span>
        </button>

        {/* Thông báo */}
        <button
          type="button"
          className={`lume-sidebar-menu-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => onSelectTab('notifications')}
        >
          <Bell size={18} />
          <span>Thông báo</span>
        </button>

        {/* Chuyển sang kênh đối tác nếu có role */}
        {isProvider && onNavigateProvider && (
          <button
            type="button"
            className="lume-sidebar-menu-btn"
            onClick={onNavigateProvider}
            style={{ color: '#C28E3A', borderTop: '1px dashed #ECE5DB', marginTop: '6px' }}
          >
            <Store size={18} />
            <span>Kênh Đối Tác / Shop</span>
          </button>
        )}

        {/* Đăng xuất */}
        <button
          type="button"
          className="lume-sidebar-menu-btn lume-sidebar-menu-btn--logout"
          onClick={onLogout}
        >
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </nav>

      {/* 2. Customer Support Card */}
      <div className="lume-sidebar-support-card">
        <div className="lume-support-header">
          <div className="lume-support-icon-circle">
            <Headphones size={18} />
          </div>
          <div>
            <h4 className="lume-support-title">Bạn cần hỗ trợ?</h4>
            <p className="lume-support-desc">Đội ngũ LUMÉ luôn sẵn sàng đồng hành</p>
          </div>
        </div>

        <div className="lume-support-contacts">
          <a
            href="tel:19009999"
            className="lume-support-link phone"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FDF2F4',
              borderRadius: '8px',
              padding: '10px',
              color: '#8B1E2D',
              fontSize: '13.5px',
              fontWeight: 800
            }}
          >
            <Phone size={14} style={{ marginRight: '6px' }} />
            <span>1900 9999</span>
          </a>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#8C827A', margin: '4px 0 2px 0' }}>
            Hoặc gửi email
          </div>
          <a
            href="mailto:support@lume.vn"
            className="lume-support-link"
            style={{ justifyContent: 'center', fontSize: '12px' }}
          >
            <Mail size={13} />
            <span>support@lume.vn</span>
          </a>
        </div>
      </div>
    </aside>
  );
};
