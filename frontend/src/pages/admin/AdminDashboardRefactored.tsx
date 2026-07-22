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
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileCheck,
  Folder,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
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

type MenuGroup = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  items: AdminTab[];
};

type AttentionItem = {
  id: string;
  tab: AdminTab;
  title: string;
  description: string;
  occurredAt?: string;
  type: 'verification' | 'dispute' | 'review';
};

import { OverviewPanel } from '../../features/admin-dashboard/components/OverviewPanel';
import { DirectoryPanel } from '../../features/admin-directory/components/DirectoryPanel';
import { CombinedDirectoryPanel } from '../../features/admin-directory/components/CombinedDirectoryPanel';
import { CategoryManagement } from './components/CategoryManagement';
import { SettlementManagement } from './components/SettlementManagement';
import { RefundManagement } from './components/RefundManagement';
import { RevenuePanel } from '../../features/admin-dashboard/components/RevenuePanel';
import { VerificationWorkspace } from '../../features/admin-verifications/components/VerificationWorkspace';
import { DisputesPanel } from '../../features/admin-disputes/components/DisputesPanel';
import { BehaviorPanel } from '../../features/admin-dashboard/components/BehaviorPanel';
import { ProductModerationManagement } from './components/ProductModerationManagement';
import { PortfolioModerationManagement } from './components/PortfolioModerationManagement';
import { ComboModerationManagement } from './components/ComboModerationManagement';
import { ReportedReviewsPanel } from '../../features/admin-reviews/components/ReportedReviewsPanel';
import { PolicyManagement } from './components/PolicyManagement';
import { AccessControl } from './components/AccessControl';
import { NotificationsPage } from '../notifications/NotificationsPage';

const tabs: TabDefinition[] = [
  { id: 'overview', label: 'Tổng quan hệ thống', title: 'Tổng quan hệ thống', icon: LayoutDashboard },
  { id: 'customers', label: 'Khách hàng', title: 'Quản lý Khách hàng', icon: Users },
  { id: 'providers', label: 'Đối tác', title: 'Quản lý Đối tác & Nhà cung cấp', icon: Store },
  { id: 'categories', label: 'Danh mục', title: 'Quản lý Danh mục Dịch vụ', icon: Layers },
  { id: 'bookings', label: 'Lịch trình & Đặt lịch', title: 'Quản lý Lịch trình & Booking', icon: Calendar },
  { id: 'settlements', label: 'Đối soát & Quyết toán', title: 'Đối soát & Quyết toán Tài chính', icon: DollarSign },
  { id: 'revenue', label: 'Báo cáo Doanh thu', title: 'Thống kê Doanh thu Hệ thống', icon: TrendingUp },
  { id: 'verifications', label: 'Phê duyệt hồ sơ đối tác', title: 'Phê duyệt hồ sơ đăng ký đối tác', icon: FileCheck },
  { id: 'disputes', label: 'Giải quyết tranh chấp', title: 'Giải quyết tranh chấp sự cố', icon: AlertTriangle },
  { id: 'combo-moderation', label: 'Phê duyệt combo', title: 'Phê duyệt combo Áo dài + Chụp ảnh', icon: CheckSquare },
  { id: 'product-moderation', label: 'Kiểm duyệt sản phẩm', title: 'Kiểm duyệt nội dung sản phẩm', icon: CheckSquare },
  { id: 'reported-reviews', label: 'Báo cáo Đánh giá (Spam)', title: 'Báo cáo vi phạm & Spam Đánh giá', icon: Ban },
  { id: 'policies', label: 'Cấu hình Chính sách', title: 'Cấu hình Chính sách Hệ thống', icon: Settings },
  { id: 'users-roles', label: 'Tài khoản & Phân quyền', title: 'Tài khoản & Quản trị Phân quyền', icon: ShieldCheck },
  { id: 'behavior', label: 'Phân tích hành vi', title: 'Phân tích hành vi người dùng', icon: BarChart3 },
  { id: 'refunds', label: 'Quản lý hoàn tiền', title: 'Quản lý hoàn tiền', icon: RotateCcw },
  { id: 'notifications', label: 'Thông báo hệ thống', title: 'Tất cả thông báo hệ thống', icon: Bell },
];

const menuGroups: MenuGroup[] = [
  {
    id: 'group-objects',
    label: 'Quản lý đối tượng',
    icon: Folder,
    items: ['customers', 'providers', 'categories'],
  },
  {
    id: 'group-operations',
    label: 'Vận hành & Giao dịch',
    icon: Activity,
    items: ['bookings', 'product-moderation', 'combo-moderation'],
  },
  {
    id: 'group-finance',
    label: 'Tài chính & Doanh thu',
    icon: DollarSign,
    items: ['settlements', 'refunds', 'revenue'],
  },
  {
    id: 'group-moderation',
    label: 'Kiểm duyệt & Trợ giúp',
    icon: ShieldAlert,
    items: ['verifications', 'disputes', 'reported-reviews'],
  },
  {
    id: 'group-system',
    label: 'Hệ thống & Cấu hình',
    icon: Settings,
    items: ['policies', 'users-roles', 'behavior', 'notifications'],
  },
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

function TabPanel({ tab }: { tab: AdminTab }) {
  switch (tab) {
    case 'overview': return <OverviewPanel />;
    case 'customers': return <DirectoryPanel key="customers" kind="customers" />;
    case 'providers': return <DirectoryPanel key="providers" kind="providers" />;
    case 'categories': return <CategoryManagement />;
    case 'bookings': return <DirectoryPanel key="bookings" kind="bookings" />;
    case 'settlements': return <SettlementManagement />;
    case 'refunds': return <RefundManagement />;
    case 'revenue': return <RevenuePanel />;
    case 'verifications': return <VerificationWorkspace />;
    case 'disputes': return <DisputesPanel />;
    case 'behavior': return <BehaviorPanel />;
    case 'combo-moderation': return <ComboModerationManagement />;
    case 'product-moderation': return <><ProductModerationManagement /><PortfolioModerationManagement /></>;
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
  const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(activeTab !== 'overview');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      'group-objects': false,
      'group-operations': false,
      'group-finance': false,
      'group-moderation': false,
      'group-system': false,
    };
    const activeGroup = menuGroups.find((g) => g.items.includes(activeTab));
    if (activeGroup) {
      initial[activeGroup.id] = true;
    }
    return initial;
  });
  const [isLoadingAttention, setIsLoadingAttention] = useState(false);
  const [attentionError, setAttentionError] = useState<string | null>(null);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const activeDefinition = tabs.find((tab) => tab.id === activeTab)!;
  const avatar = user?.avatar || user?.avatarUrl || '/avatar_hanna.png';
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
    if (activeTab !== 'overview') {
      setIsOverviewExpanded(true);
      const matchingGroup = menuGroups.find((g) => g.items.includes(activeTab));
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
      verificationResult.value
        .filter((item) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW')
        .forEach((item) => nextItems.push({
          id: `verification-${item.verificationId}`,
          tab: 'verifications',
          type: 'verification',
          title: item.businessProfile.businessName || 'Hồ sơ đối tác',
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
      <aside className="admin-refactor-sidebar">
        <div className="admin-refactor-sidebar__top">
          <div className="admin-refactor-brand">
            <strong>Di sản Áo Dài</strong>
            <span>CURATING ELEGANCE • ADMIN</span>
          </div>

          <div className="admin-refactor-profile admin-refactor-profile--sidebar">
            <img src={avatar} alt="Admin" />
            <div>
              <strong>{user?.fullName || 'Hanna Nguyễn'}</strong>
              <span>Quản Trị Viên Hệ Thống</span>
            </div>
          </div>

          <nav className="admin-refactor-nav" aria-label="Điều hướng quản trị">
            {/* 🏠 TOP STANDALONE: Tổng quan hệ thống */}
            <button
              type="button"
              className={activeTab === 'overview' ? 'is-active' : ''}
              aria-current={activeTab === 'overview' ? 'page' : undefined}
              onClick={() => {
                setActiveTab('overview');
                setIsOverviewExpanded((prev) => !prev);
              }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LayoutDashboard size={16} color={activeTab === 'overview' ? '#4A0E17' : '#B89047'} />
                <span>Tổng quan hệ thống</span>
              </div>
              {isOverviewExpanded ? (
                <ChevronUp size={14} color={activeTab === 'overview' ? '#4A0E17' : '#B89047'} />
              ) : (
                <ChevronDown size={14} color={activeTab === 'overview' ? '#4A0E17' : '#B89047'} />
              )}
            </button>

            {/* 📁 5 MENU GROUPS - Shown when Overview is expanded */}
            {isOverviewExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '6px', marginTop: '4px' }}>
                {menuGroups.map((group) => {
                  const GroupIcon = group.icon;
                  const isGroupActive = group.items.includes(activeTab);
                  const isOpen = openGroups[group.id] ?? false;

                  return (
                    <div key={group.id} style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                      <button
                        type="button"
                        className={isGroupActive ? 'is-active' : ''}
                        onClick={() => toggleGroup(group.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <GroupIcon size={16} color={isGroupActive ? '#4A0E17' : '#B89047'} />
                          <span>{group.label}</span>
                        </div>
                        {isOpen ? (
                          <ChevronUp size={14} color={isGroupActive ? '#4A0E17' : '#B89047'} />
                        ) : (
                          <ChevronDown size={14} color={isGroupActive ? '#4A0E17' : '#B89047'} />
                        )}
                      </button>

                      {isOpen && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            paddingLeft: '16px',
                            marginTop: '2px',
                            marginBottom: '4px',
                            borderLeft: '2px solid rgba(255, 255, 255, 0.15)',
                            marginLeft: '12px',
                          }}
                        >
                          {group.items.map((subId) => {
                            const subTab = tabs.find((t) => t.id === subId);
                            if (!subTab) return null;
                            const SubIcon = subTab.icon;
                            const isSubActive = activeTab === subId;

                            return (
                              <button
                                key={subId}
                                type="button"
                                className={isSubActive ? 'is-active' : ''}
                                aria-current={isSubActive ? 'page' : undefined}
                                onClick={() => setActiveTab(subId)}
                                style={{ padding: '8px 12px', fontSize: '12.5px' }}
                              >
                                <SubIcon size={14} color={isSubActive ? '#4A0E17' : '#B89047'} />
                                <span>{subTab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        <div className="admin-refactor-sidebar__footer">
          <button type="button" aria-label="Trở về Trang chủ" onClick={() => navigate(ROUTES.LANDING)}>
            <Home size={16} color="#B89047" />
            <span>Trở về Trang chủ</span>
          </button>
          <button className="admin-refactor-logout" type="button" aria-label="Đăng xuất" onClick={() => void handleLogout()}>
            <LogOut size={16} color="#F87171" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="admin-refactor-main">
        <header className="admin-refactor-header">
          <h1>{activeDefinition.title}</h1>
          <div className="admin-refactor-header__actions">
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
            <div className="admin-refactor-profile admin-refactor-profile--header">
              <img src={avatar} alt="Admin" />
              <strong>{user?.fullName || 'Admin'}</strong>
            </div>
          </div>
        </header>

        <div className="admin-refactor-content">
          <AdminPanelErrorBoundary resetKey={activeTab}>
            <Suspense fallback={<p className="admin-refactor-loading">Đang tải chức năng…</p>}>
              <TabPanel tab={activeTab} />
            </Suspense>
          </AdminPanelErrorBoundary>
        </div>
      </main>
    </div>
  );
}
