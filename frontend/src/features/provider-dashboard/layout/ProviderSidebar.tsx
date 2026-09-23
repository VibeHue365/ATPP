import {
  ArrowLeft,
  Award,
  Bell,
  Calendar,
  Camera,
  ChevronDown,
  DollarSign,
  Headphones,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Users
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { useProviderNavigationState } from '../hooks/useProviderNavigationState';
import './providerNavbar.css';

type ProviderSidebarProps = Pick<ReturnType<typeof useProviderNavigationState>,
  'setCurrentView' | 'currentView' | 'setCollectionTab' | 'collectionTab'
> &
{
  hasAodaiCapability: boolean | undefined;
  hasPhotographyCapability: boolean | undefined;
  navigate: NavigateFunction;
  handleLogoutClick: () => Promise<void>;
};

export function ProviderSidebar({
  setCurrentView,
  currentView,
  hasAodaiCapability,
  setCollectionTab,
  collectionTab,
  hasPhotographyCapability,
  navigate,
  handleLogoutClick,
}: ProviderSidebarProps) {
  return (
    <aside className="p-sidebar-aside" aria-label="Menu chính">
      <div>
        {/* Brand Header */}
        <div className="p-brand-header">
          <div className="p-brand-logo-box">
            {/* Lotus/Flame Lumé Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2C12 2 8 8 8 13C8 16.5 10 19 12 21C14 19 16 16.5 16 13C16 8 12 2 12 2Z"
                fill="white"
                fillOpacity="0.95"
              />
              <path
                d="M12 7C9.5 9.5 5 11 4 15C3 19 6.5 21 8.5 21C10.5 21 11.5 19.5 12 18C12.5 19.5 13.5 21 15.5 21C17.5 21 21 19 20 15C19 11 14.5 9.5 12 7Z"
                fill="white"
                fillOpacity="0.75"
              />
            </svg>
          </div>
          <div className="p-brand-info">
            <h1 className="p-brand-title">LUMÉ</h1>
            <p className="p-brand-subtitle">Dành cho Nhà cung cấp</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-sidebar-nav">
          {/* 1. Tổng quan */}
          <button
            onClick={() => setCurrentView('overview')}
            className={`p-nav-item ${currentView === 'overview' ? 'active' : ''}`}
            aria-label="Tổng quan"
            type="button"
          >
            <div className="p-nav-item-left">
              <LayoutDashboard size={20} />
              <span>Tổng quan</span>
            </div>
          </button>

          {/* 2. Đơn đặt lịch */}
          <button
            onClick={() => setCurrentView('orders')}
            className={`p-nav-item ${currentView === 'orders' ? 'active' : ''}`}
            aria-label="Đơn hàng"
            type="button"
          >
            <div className="p-nav-item-left">
              <ShoppingBag size={20} />
              <span>Đơn đặt lịch</span>
            </div>
          </button>

          {/* 3. Lịch chụp */}
          {hasPhotographyCapability && (
            <button
              onClick={() => setCurrentView('calendar')}
              className={`p-nav-item ${currentView === 'calendar' ? 'active' : ''}`}
              aria-label="Lịch làm việc & Chặn"
              type="button"
            >
              <div className="p-nav-item-left">
                <Calendar size={20} />
                <span>Lịch chụp</span>
              </div>
            </button>
          )}

          {/* 4. Giao & nhận áo dài */}
          {hasAodaiCapability && (
            <button
              onClick={() => setCurrentView('rental-operations')}
              className={`p-nav-item ${currentView === 'rental-operations' ? 'active' : ''}`}
              aria-label="Giao & nhận áo dài"
              type="button"
            >
              <div className="p-nav-item-left">
                <Package size={20} />
                <span>Giao & nhận áo dài</span>
              </div>
            </button>
          )}

          {/* 5. Sản phẩm & Dịch vụ (Collapsible) */}
          {hasAodaiCapability && (
            <button
              onClick={() => {
                setCurrentView('collections');
                setCollectionTab('products');
              }}
              className={`p-nav-item ${currentView === 'collections' && collectionTab === 'products' ? 'active' : ''}`}
              aria-label="Bộ sưu tập"
              type="button"
            >
              <div className="p-nav-item-left">
                <Layers size={20} />
                <span>Sản phẩm & Dịch vụ</span>
              </div>
              <ChevronDown size={16} className="p-nav-chevron" />
            </button>
          )}

          {/* 6. Combo của tôi */}
          <button
            onClick={() => setCurrentView('vouchers')}
            className={`p-nav-item ${currentView === 'vouchers' ? 'active' : ''}`}
            aria-label="Mã khuyến mãi & Combo"
            type="button"
          >
            <div className="p-nav-item-left">
              <Tag size={20} />
              <span>Combo của tôi</span>
            </div>
          </button>

          {/* 7. Khách hàng */}
          <button
            onClick={() => setCurrentView('trust')}
            className={`p-nav-item ${currentView === 'trust' ? 'active' : ''}`}
            aria-label="Đánh giá khách hàng"
            type="button"
          >
            <div className="p-nav-item-left">
              <Users size={20} />
              <span>Khách hàng</span>
            </div>
          </button>

          {/* 8. Đánh giá & Phản hồi */}
          <button
            onClick={() => setCurrentView('reviews')}
            className={`p-nav-item ${currentView === 'reviews' ? 'active' : ''}`}
            aria-label="Đánh giá & Phản hồi"
            type="button"
          >
            <div className="p-nav-item-left">
              <MessageSquare size={20} />
              <span>Đánh giá & Phản hồi</span>
            </div>
          </button>

          {/* 9. Doanh thu & Thanh toán */}
          <button
            onClick={() => setCurrentView('payouts')}
            className={`p-nav-item ${currentView === 'payouts' ? 'active' : ''}`}
            aria-label="Lịch sử quyết toán"
            type="button"
          >
            <div className="p-nav-item-left">
              <DollarSign size={20} />
              <span>Doanh thu & Thanh toán</span>
            </div>
          </button>

          {/* 10. Tin nhắn (with badge 5) */}
          <button
            onClick={() => navigate('/chat')}
            className="p-nav-item"
            aria-label="Tin nhắn"
            type="button"
          >
            <div className="p-nav-item-left">
              <MessageSquare size={20} />
              <span>Tin nhắn</span>
            </div>
            <span className="p-nav-badge-red">5</span>
          </button>

          {/* 11. Cài đặt cửa hàng */}
          <button
            onClick={() => setCurrentView('profile')}
            className={`p-nav-item ${currentView === 'profile' ? 'active' : ''}`}
            aria-label="Thông tin dịch vụ"
            type="button"
          >
            <div className="p-nav-item-left">
              <Award size={20} />
              <span>Cài đặt cửa hàng</span>
            </div>
          </button>

          {/* Optional items if photographer */}
          {hasPhotographyCapability && (
            <button
              onClick={() => setCurrentView('portfolio')}
              className={`p-nav-item ${currentView === 'portfolio' ? 'active' : ''}`}
              aria-label="Quản lý Portfolio"
              type="button"
            >
              <div className="p-nav-item-left">
                <Camera size={20} />
                <span>Quản lý Portfolio</span>
              </div>
            </button>
          )}

          {hasPhotographyCapability && (
            <button
              onClick={() => setCurrentView('photography-packages')}
              className={`p-nav-item ${currentView === 'photography-packages' ? 'active' : ''}`}
              aria-label="Gói chụp ảnh"
              type="button"
            >
              <div className="p-nav-item-left">
                <Package size={20} />
                <span>Gói chụp ảnh</span>
              </div>
            </button>
          )}

          {/* Thông báo */}
          <button
            onClick={() => setCurrentView('notifications')}
            className={`p-nav-item ${currentView === 'notifications' ? 'active' : ''}`}
            aria-label="Tất cả thông báo"
            type="button"
          >
            <div className="p-nav-item-left">
              <Bell size={20} />
              <span>Tất cả thông báo</span>
            </div>
          </button>

          <div className="p-nav-divider" />

          {/* Quản lý vai trò */}
          <button
            onClick={() => setCurrentView('role-management')}
            className={`p-nav-item ${currentView === 'role-management' ? 'active' : ''}`}
            aria-label="Quản lý vai trò"
            type="button"
          >
            <div className="p-nav-item-left">
              <ShieldCheck size={20} />
              <span>Quản lý vai trò</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Bottom Area: Support Help Widget & Footers */}
      <div>
        <div className="p-sidebar-support">
          <div className="p-support-card">
            <div className="p-support-top">
              <div className="p-support-icon">
                <Headphones size={20} />
              </div>
              <div className="p-support-text">
                <h4 className="p-support-title">Cần hỗ trợ?</h4>
                <p className="p-support-desc">Liên hệ đội ngũ VibeHue</p>
              </div>
            </div>
            <button
              className="p-support-btn"
              onClick={() => navigate('/chat')}
              type="button"
            >
              Liên hệ ngay
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 14px 16px' }}>
          <button
            onClick={() => navigate('/')}
            className="p-nav-item"
            type="button"
          >
            <div className="p-nav-item-left">
              <ArrowLeft size={18} />
              <span>Trang chủ</span>
            </div>
          </button>
          <button
            onClick={handleLogoutClick}
            className="p-nav-item"
            style={{ color: '#FCA5A5' }}
            type="button"
          >
            <div className="p-nav-item-left">
              <LogOut size={18} />
              <span>Đăng xuất</span>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default ProviderSidebar;
