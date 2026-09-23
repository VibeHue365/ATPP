import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Folder,
  Home,
  Image,
  LogOut,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Store,
  User,
  UserCheck,
} from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { adminDisputesApi } from '../../features/admin-disputes/api/adminDisputesApi';
import { adminReportedReviewsApi } from '../../features/admin-reviews/api/adminReportedReviewsApi';
import { adminVerificationApi } from '../../features/admin-verifications/api/adminVerificationApi';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useToast } from '../../components/feedback/Toast';
import './adminDashboardRefactored.css';

type AdminTab =
  | 'overview'
  | 'customers'
  | 'providers'
  | 'categories'
  | 'bookings'
  | 'settlements'
  | 'refunds'
  | 'revenue'
  | 'verifications'
  | 'disputes'
  | 'behavior'
  | 'combo-moderation'
  | 'product-moderation'
  | 'reported-reviews'
  | 'policies'
  | 'users-roles'
  | 'notifications';

type TabDefinition = {
  id: AdminTab;
  label: string;
  title: string;
  icon: ComponentType<{ size?: number; color?: string }>;
};

interface NavGroupDef {
  id: string;
  label: string;
  items: TabDefinition[];
}

type AttentionItem = {
  id: string;
  tab: AdminTab;
  title: string;
  description: string;
  occurredAt?: string;
  type: 'verification' | 'dispute' | 'review';
};

const OverviewPanel = lazy(() => import('../../features/admin-dashboard/components/OverviewPanel'));
const CustomerManagementPanel = lazy(() => import('./components/CustomerManagementPanel').then((module) => ({ default: module.CustomerManagementPanel })));
const PartnerManagementPanel = lazy(() => import('./components/PartnerManagementPanel').then((module) => ({ default: module.PartnerManagementPanel })));
const BookingManagementPanel = lazy(() => import('./components/BookingManagementPanel').then((module) => ({ default: module.BookingManagementPanel })));
const CategoryManagement = lazy(() => import('./components/CategoryManagement').then((module) => ({ default: module.CategoryManagement })));
const SettlementManagement = lazy(() => import('./components/SettlementManagement').then((module) => ({ default: module.SettlementManagement })));
const RefundManagement = lazy(() => import('./components/RefundManagement').then((module) => ({ default: module.RefundManagement })));
const RevenuePanel = lazy(() => import('../../features/admin-dashboard/components/RevenuePanel').then((module) => ({ default: module.RevenuePanel })));
const PartnerVerificationManagement = lazy(() => import('./components/PartnerVerificationManagement').then((module) => ({ default: module.PartnerVerificationManagement })));
const DisputesPanel = lazy(() => import('../../features/admin-disputes/components/DisputesPanel').then((module) => ({ default: module.DisputesPanel })));
const BehaviorPanel = lazy(() => import('../../features/admin-dashboard/components/BehaviorPanel').then((module) => ({ default: module.BehaviorPanel })));
const ProductModerationPanel = lazy(() => import('./components/ProductModerationPanel').then((module) => ({ default: module.ProductModerationPanel })));
const ComboModerationManagement = lazy(() => import('./components/ComboModerationManagement'));
const ReportedReviewsPanel = lazy(() => import('../../features/admin-reviews/components/ReportedReviewsPanel').then((module) => ({ default: module.ReportedReviewsPanel })));
const PolicyManagement = lazy(() => import('./components/PolicyManagement').then((module) => ({ default: module.PolicyManagement })));
const AccessControl = lazy(() => import('./components/AccessControl').then((module) => ({ default: module.AccessControl })));
const NotificationsPage = lazy(() => import('../notifications/NotificationsPage'));

export const navGroups: NavGroupDef[] = [
  {
    id: 'group-objects',
    label: 'QUẢN LÝ ĐỐI TƯỢNG',
    items: [
      { id: 'customers', label: 'Khách hàng', title: 'Quản lý Khách hàng', icon: User },
      { id: 'providers', label: 'Đối tác', title: 'Quản lý Đối tác & Nhà cung cấp', icon: Store },
      { id: 'categories', label: 'Danh mục', title: 'Quản lý Danh mục Dịch vụ', icon: Folder },
    ],
  },
  {
    id: 'group-operations',
    label: 'VẬN HÀNH & GIAO DỊCH',
    items: [
      { id: 'bookings', label: 'Đơn đặt lịch', title: 'Quản lý Lịch trình & Booking', icon: Calendar },
      { id: 'product-moderation', label: 'Sản phẩm chờ duyệt', title: 'Kiểm duyệt nội dung sản phẩm', icon: Package },
      { id: 'combo-moderation', label: 'Phê duyệt combo', title: 'Phê duyệt combo Áo dài + Chụp ảnh', icon: Image },
    ],
  },
  {
    id: 'group-finance',
    label: 'TÀI CHÍNH & DOANH THU',
    items: [
      { id: 'settlements', label: 'Đối soát & Quyết toán', title: 'Đối soát & Quyết toán Tài chính', icon: FileText },
      { id: 'refunds', label: 'Quản lý hoàn tiền', title: 'Quản lý hoàn tiền', icon: CircleDollarSign },
      { id: 'revenue', label: 'Báo cáo doanh thu', title: 'Thống kê Doanh thu Hệ thống', icon: BarChart3 },
    ],
  },
  {
    id: 'group-moderation',
    label: 'KIỂM DUYỆT & TRỢ GIÚP',
    items: [
      { id: 'verifications', label: 'Phê duyệt hồ sơ đối tác', title: 'Phê duyệt hồ sơ đăng ký đối tác', icon: ShieldCheck },
      { id: 'disputes', label: 'Giải quyết tranh chấp', title: 'Giải quyết tranh chấp sự cố', icon: MessageSquare },
      { id: 'reported-reviews', label: 'Báo cáo đánh giá (Spam)', title: 'Báo cáo vi phạm & Spam Đánh giá', icon: AlertOctagon },
    ],
  },
  {
    id: 'group-system',
    label: 'HỆ THỐNG & CẤU HÌNH',
    items: [
      { id: 'policies', label: 'Cấu hình chính sách', title: 'Cấu hình Chính sách Hệ thống', icon: Settings },
      { id: 'users-roles', label: 'Tài khoản & Phân quyền', title: 'Tài khoản & Quản trị Phân quyền', icon: UserCheck },
      { id: 'behavior', label: 'Phân tích hành vi', title: 'Phân tích hành vi người dùng', icon: Activity },
      { id: 'notifications', label: 'Thông báo hệ thống', title: 'Tất cả thông báo hệ thống', icon: Bell },
    ],
  },
];

export const standaloneTab: TabDefinition = {
  id: 'overview',
  label: 'Tổng quan hệ thống',
  title: 'Tổng quan hệ thống',
  icon: Home,
};

const tabs: TabDefinition[] = [
  standaloneTab,
  ...navGroups.flatMap((g) => g.items),
];

const adminTabIds = new Set<AdminTab>(tabs.map((tab) => tab.id));

function isAdminTab(value: string | null): value is AdminTab {
  return value !== null && adminTabIds.has(value as AdminTab);
}

const attentionStyles = {
  verification: { label: 'HỒ SƠ', className: 'admin-refactor-notification__type--verification' },
  dispute: { label: 'TRANH CHẤP', className: 'admin-refactor-notification__type--dispute' },
  review: { label: 'ĐÁNH GIÁ', className: 'admin-refactor-notification__type--review' },
};

class AdminPanelErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state = { error: null } as { error: Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(previousProps: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Admin refactor tab crashed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="admin-refactor-error" role="alert">
          <h2>Không thể hiển thị chức năng này</h2>
          <p>{this.state.error.message || 'Đã xảy ra lỗi dữ liệu không mong muốn.'}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>Thử lại</button>
        </section>
      );
    }

    return this.props.children;
  }
}

function TabPanel({
  tab,
  onNavigateTab,
}: {
  tab: AdminTab;
  onNavigateTab?: (t: AdminTab) => void;
}) {
  switch (tab) {
    case 'overview': return <OverviewPanel onNavigateTab={onNavigateTab as any} />;
    case 'customers': return <CustomerManagementPanel />;
    case 'providers': return <PartnerManagementPanel />;
    case 'categories': return <CategoryManagement />;
    case 'bookings': return <BookingManagementPanel />;
    case 'settlements': return <SettlementManagement />;
    case 'refunds': return <RefundManagement />;
    case 'revenue': return <RevenuePanel />;
    case 'verifications': return <PartnerVerificationManagement />;
    case 'disputes': return <DisputesPanel />;
    case 'behavior': return <BehaviorPanel />;
    case 'combo-moderation': return <ComboModerationManagement />;
    case 'product-moderation': return <ProductModerationPanel />;
    case 'reported-reviews': return <ReportedReviewsPanel />;
    case 'policies': return <PolicyManagement />;
    case 'users-roles': return <AccessControl />;
    case 'notifications': return <NotificationsPage hideBreadcrumb variant="admin" />;
  }
}

export default function AdminDashboardRefactored() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, user } = useAuth();
  const requestedTab = searchParams.get('tab');
  const activeTab: AdminTab = isAdminTab(requestedTab) ? requestedTab : 'overview';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'group-objects': true,
    'group-operations': true,
    'group-finance': true,
    'group-moderation': true,
    'group-system': true,
  });
  const [isLoadingAttention, setIsLoadingAttention] = useState(false);
  const [attentionError, setAttentionError] = useState<string | null>(null);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [visitedTabs, setVisitedTabs] = useState<Set<AdminTab>>(() => new Set([activeTab]));
  const activeDefinition = tabs.find((tab) => tab.id === activeTab) || standaloneTab;
  const avatar = user?.avatar || user?.avatarUrl || '/avatar_hanna.webp';
  const isAdmin = user?.roles?.some((role) => role.toUpperCase() === 'ADMIN') ?? false;

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const setActiveTab = useCallback((tab: AdminTab, options?: { replace?: boolean }) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: options?.replace ?? false });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setVisitedTabs((previous) => {
      if (previous.has(activeTab)) return previous;
      const next = new Set(previous);
      next.add(activeTab);
      return next;
    });

    if (activeTab !== 'overview') {
      const matchingGroup = navGroups.find((g) => g.items.some((i) => i.id === activeTab));
      if (matchingGroup) {
        setOpenGroups((prev) => ({ ...prev, [matchingGroup.id]: true }));
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (requestedTab !== null && !isAdminTab(requestedTab)) {
      setActiveTab('overview', { replace: true });
    }
  }, [requestedTab, setActiveTab]);

  useEffect(() => {
    if (user && !isAdmin) {
      toast.error('Bạn không có quyền truy cập trang quản trị!');
      navigate(ROUTES.LANDING, { replace: true });
    }
  }, [isAdmin, navigate, toast, user]);

  const loadAttention = useCallback(async () => {
    setIsLoadingAttention(true);
    setAttentionError(null);

    const [verificationResult, disputeResult, reviewResult] = await Promise.allSettled([
      adminVerificationApi.list(),
      adminDisputesApi.list(),
      adminReportedReviewsApi.list(),
    ]);

    const nextItems: AttentionItem[] = [];
    if (verificationResult.status === 'fulfilled') {
      const vItems = Array.isArray(verificationResult.value)
        ? verificationResult.value
        : (verificationResult.value as any)?.items || [];
      vItems
        .filter((item: any) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW')
        .forEach((item: any) => nextItems.push({
          id: `verification-${item.verificationId}`,
          tab: 'verifications',
          type: 'verification',
          title: item.businessProfile?.businessName || 'Hồ sơ đối tác',
          description: `Hồ sơ đang ở trạng thái ${item.status}.`,
          occurredAt: item.createdAt,
        }));
    }
    if (disputeResult.status === 'fulfilled') {
      disputeResult.value.forEach((item) => nextItems.push({
        id: `dispute-${item._id}`,
        tab: 'disputes',
        type: 'dispute',
        title: `Tranh chấp ${item.bookingId?.bookingCode || 'cần xử lý'}`,
        description: item.description || 'Cần admin đưa ra quyết định.',
      }));
    }
    if (reviewResult.status === 'fulfilled') {
      reviewResult.value.forEach((item) => nextItems.push({
        id: `review-${item._id}`,
        tab: 'reported-reviews',
        type: 'review',
        title: 'Báo cáo đánh giá cần kiểm duyệt',
        description: item.reportReason || 'Review được báo cáo vi phạm.',
        occurredAt: item.reportedAt,
      }));
    }

    setAttentionItems(nextItems.slice(0, 20));
    const failedSources = [verificationResult, disputeResult, reviewResult]
      .filter((result) => result.status === 'rejected').length;
    if (failedSources > 0) {
      setAttentionError(`Không thể tải ${failedSources}/3 nguồn thông báo.`);
    }
    setIsLoadingAttention(false);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const openAttention = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsNotificationOpen(false);
  };

  return (
    <div className="admin-refactor-shell">
      <aside className={`admin-refactor-sidebar ${isSidebarCollapsed ? 'admin-refactor-sidebar--collapsed' : ''}`}>
        <div className="admin-refactor-sidebar__top">
          {/* Brand */}
          <div className="admin-refactor-brand">
            <div
              className="admin-brand-left"
              onClick={() => isSidebarCollapsed && setIsSidebarCollapsed(false)}
              style={{ cursor: isSidebarCollapsed ? 'pointer' : 'default' }}
            >
              <div className="admin-brand-logo">L</div>
              <div className="admin-brand-text">
                <strong>LUMÉ</strong>
                <span>ÁO DÀI & CHỤP ẢNH</span>
              </div>
            </div>

            <button
              type="button"
              className="admin-sidebar-toggle-btn"
              title={isSidebarCollapsed ? 'Mở rộng menu (240px)' : 'Thu gọn menu (76px)'}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {/* Profile */}
          <div className="admin-refactor-profile--sidebar" title="System Admin - Quản trị viên hệ thống">
            <img src={avatar} alt="Admin" />
            <div className="admin-profile-info">
              <strong>{user?.fullName || 'System Admin'}</strong>
              <span>Quản trị viên hệ thống</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="admin-refactor-nav" aria-label="Điều hướng quản trị">
            {/* Standalone item: Tổng quan hệ thống */}
            <div className="admin-sidebar-standalone">
              <button
                type="button"
                className={`admin-nav-item ${activeTab === 'overview' ? 'is-active' : ''}`}
                aria-current={activeTab === 'overview' ? 'page' : undefined}
                title="Tổng quan hệ thống"
                onClick={() => setActiveTab('overview')}
              >
                <Home size={18} />
                <span>Tổng quan hệ thống</span>
              </button>
            </div>

            {/* 5 Menu Groups */}
            {navGroups.map((group) => {
              const isOpen = openGroups[group.id] ?? true;

              return (
                <div key={group.id} className="admin-nav-group">
                  {/* Group Header (only shown when expanded) */}
                  <button
                    type="button"
                    className="admin-nav-group__header"
                    onClick={() => toggleGroup(group.id)}
                    title={group.label}
                  >
                    <span>{group.label}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {/* Group Items (always shown in collapsed mode, or when group isOpen in expanded mode) */}
                  {(isOpen || isSidebarCollapsed) && (
                    <div className="admin-nav-group__items">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = activeTab === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`admin-nav-item ${isItemActive ? 'is-active' : ''}`}
                            aria-current={isItemActive ? 'page' : undefined}
                            title={item.label}
                            onClick={() => setActiveTab(item.id)}
                          >
                            <ItemIcon size={18} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="admin-refactor-sidebar__footer">
          <button
            type="button"
            className="admin-footer-btn"
            title="Trở về trang chủ"
            onClick={() => navigate(ROUTES.LANDING)}
          >
            <ArrowLeft size={18} />
            <span>Trở về trang chủ</span>
          </button>
          <button
            type="button"
            className="admin-footer-btn"
            title="Đăng xuất"
            onClick={() => void handleLogout()}
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="admin-refactor-main">
        <header className="admin-refactor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, minWidth: 0 }}>
            {activeTab !== 'overview' && activeTab !== 'customers' && <h1>{activeDefinition.title}</h1>}
            <div className="admin-global-search">
              <Search size={15} color="#9CA3AF" />
              <input
                type="text"
                placeholder={
                  activeTab === 'customers'
                    ? 'Tìm kiếm khách hàng, email, số điện thoại, mã ID...'
                    : activeTab === 'providers'
                    ? 'Tìm kiếm đối tác, cửa hàng, chủ cơ sở, mã #DT...'
                    : 'Tìm kiếm khách hàng, đơn hàng, đối tác, sản phẩm...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd className="admin-search-kbd">⌘ K</kbd>
            </div>
          </div>

          <div className="admin-refactor-header__actions">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '34px',
                padding: '0 12px',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#374151',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Calendar size={13} color="#881337" />
              <span>01/07/2024 - 31/07/2024</span>
              <ChevronDown size={13} color="#9CA3AF" />
            </div>

            <div className="admin-refactor-notification">
              <button
                className="admin-refactor-notification__trigger"
                type="button"
                title="Thông báo cần xử lý"
                aria-expanded={isNotificationOpen}
                onClick={() => {
                  setIsNotificationOpen((isOpen) => !isOpen);
                  if (!isNotificationOpen) void loadAttention();
                }}
              >
                <Bell size={20} />
                {!!attentionItems.length && <span>{attentionItems.length}</span>}
              </button>

              {isNotificationOpen && (
                <div className="admin-refactor-notification__menu">
                  <div className="admin-refactor-notification__header">
                    <strong>Cần xử lý ({attentionItems.length})</strong>
                    {isLoadingAttention && <span>Đang tải…</span>}
                  </div>
                  <div className="admin-refactor-notification__list">
                    {attentionError && (
                      <p className='admin-refactor-notification__error' role='alert'>{attentionError}</p>
                    )}
                    {!isLoadingAttention && !attentionItems.length && (
                      <p>Không có thông báo mới nào cần xử lý.</p>
                    )}
                    {attentionItems.map((item) => {
                      const style = attentionStyles[item.type];
                      return (
                        <button key={item.id} type="button" onClick={() => openAttention(item.tab)}>
                          <span className={`admin-refactor-notification__type ${style.className}`}>{style.label}</span>
                          <strong>{item.title}</strong>
                          <small>{item.description}</small>
                          {item.occurredAt && (
                            <time dateTime={item.occurredAt}>
                              {new Date(item.occurredAt).toLocaleString('vi-VN')}
                            </time>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{
                    padding: '10px 16px', borderTop: '1px solid var(--color-light-border, #E8E2D5)',
                    textAlign: 'center', backgroundColor: '#FAF6F0'
                  }}>
                    <button
                      type="button"
                      onClick={() => { setIsNotificationOpen(false); setActiveTab('notifications'); }}
                      style={{
                        background: 'none', border: 'none', color: '#4A0E17',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        padding: '4px 12px', borderRadius: '4px', transition: 'all 0.15s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.color = '#B89047'; }}
                      onMouseOut={e => { e.currentTarget.style.color = '#4A0E17'; }}
                    >
                      Xem tất cả thông báo hệ thống →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="admin-refactor-header__divider" />
            <div className="admin-refactor-profile admin-refactor-profile--header" style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <img src={avatar} alt="Admin" style={{ width: '34px', height: '34px', borderRadius: '50%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{user?.fullName || 'System Admin'}</strong>
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>Quản trị viên</span>
              </div>
            </div>
          </div>
        </header>

        <div className={`admin-refactor-content ${activeTab === 'customers' ? 'admin-refactor-content--customers' : activeTab === 'providers' ? 'admin-refactor-content--providers' : activeTab === 'categories' ? 'admin-refactor-content--categories' : activeTab === 'bookings' ? 'admin-refactor-content--bookings' : ''}`}>
          {Array.from(visitedTabs.has(activeTab) ? visitedTabs : new Set([...visitedTabs, activeTab])).map((tab) => (
            <div key={tab} style={{ display: tab === activeTab ? 'contents' : 'none' }}>
              <AdminPanelErrorBoundary resetKey={tab}>
                <Suspense fallback={<p className="admin-refactor-loading">Đang tải chức năng…</p>}>
                  <TabPanel tab={tab} onNavigateTab={setActiveTab} />
                </Suspense>
              </AdminPanelErrorBoundary>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
