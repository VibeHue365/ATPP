import {
  ArrowLeft,
  Award,
  Bell,
  Calendar,
  Camera,
  DollarSign,
  Headphones,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
  isSidebarCollapsed?: boolean;
  toggleSidebar?: () => void;
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
  isSidebarCollapsed = false,
  toggleSidebar,
}: ProviderSidebarProps) {
  return (
    <aside className={`p-sidebar-aside ${isSidebarCollapsed ? 'collapsed' : ''}`} aria-label="Menu chính">
      <div>
        {/* Brand Header */}
        <div className="p-brand-header">
          <div
            className="p-brand-logo-box"
            onClick={() => isSidebarCollapsed && toggleSidebar?.()}
            style={{
              cursor: isSidebarCollapsed ? 'pointer' : 'default',
              background: '#FFFFFF',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              border: 'none',
              flexShrink: 0
            }}
            title={isSidebarCollapsed ? "TàGo - Nhấn để mở rộng menu" : "TàGo"}
          >
            <img
              src="/logo-icon.png"
              alt="TàGo"
              style={{
                width: '28px',
                height: '28px',
                objectFit: 'contain'
              }}
            />
          </div>
          {!isSidebarCollapsed && (
            <div className="p-brand-info">
              <h1 className="p-brand-title">TàGo</h1>
              <p className="p-brand-subtitle">Kênh dành cho Đối tác</p>
            </div>
          )}
          {toggleSidebar && (
            <button
              type="button"
              className="p-sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Mở rộng thanh điều hướng (280px)" : "Thu gọn thanh điều hướng (76px)"}
              aria-label="Toggle sidebar"
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-sidebar-nav">
          {/* 1. Tổng quan */}
          <button
            onClick={() => setCurrentView('overview')}
            className={`p-nav-item ${currentView === 'overview' ? 'active' : ''}`}
            aria-label="Tổng quan"
            title="Tổng quan"
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
            title="Đơn đặt lịch"
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
              title="Lịch chụp"
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
              title="Giao & nhận áo dài"
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
              title="Sản phẩm & Dịch vụ"
              type="button"
            >
              <div className="p-nav-item-left">
                <Layers size={20} />
                <span>Sản phẩm & Dịch vụ</span>
              </div>
            </button>
          )}

          {/* 6. Combo của tôi */}
          <button
            onClick={() => setCurrentView('vouchers')}
            className={`p-nav-item ${currentView === 'vouchers' ? 'active' : ''}`}
            aria-label="Mã khuyến mãi & Combo"
            title="Combo của tôi"
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
            title="Khách hàng"
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
            title="Đánh giá & Phản hồi"
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
            title="Doanh thu & Thanh toán"
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
            title="Tin nhắn (5 tin chưa đọc)"
            type="button"
          >
            <div className="p-nav-item-left">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <MessageSquare size={20} />
                {isSidebarCollapsed && <span className="p-nav-badge-dot" />}
              </div>
              <span>Tin nhắn</span>
            </div>
            {!isSidebarCollapsed && <span className="p-nav-badge-red">5</span>}
          </button>

          {/* 11. Cài đặt cửa hàng */}
          <button
            onClick={() => setCurrentView('profile')}
            className={`p-nav-item ${currentView === 'profile' ? 'active' : ''}`}
            aria-label="Thông tin dịch vụ"
            title="Cài đặt cửa hàng"
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
              title="Quản lý Portfolio"
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
              title="Gói chụp ảnh"
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
            title="Tất cả thông báo"
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
            title="Quản lý vai trò"
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
          {isSidebarCollapsed ? (
            <button
              className="p-support-btn-collapsed"
              onClick={() => navigate('/chat')}
              type="button"
              title="Cần hỗ trợ? Nhấn để liên hệ đội ngũ TàGo"
              aria-label="Liên hệ hỗ trợ"
            >
              <Headphones size={20} />
            </button>
          ) : (
            <div className="p-support-card">
              <div className="p-support-top">
                <div className="p-support-icon">
                  <Headphones size={20} />
                </div>
                <div className="p-support-text">
                  <h4 className="p-support-title">Cần hỗ trợ?</h4>
                  <p className="p-support-desc">Liên hệ đội ngũ TàGo</p>
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
          )}
        </div>

        <div className="p-sidebar-footer-links">
          <button
            onClick={() => navigate('/')}
            className="p-nav-item"
            type="button"
            title="Trang chủ"
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
            title="Đăng xuất"
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
