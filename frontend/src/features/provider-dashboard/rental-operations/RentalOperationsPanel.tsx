import { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Truck,
  User,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Search,
  RefreshCw,
  MoreVertical,
  X,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Gift,
  Shirt,
  Camera,
  Image as ImageIcon,
  DollarSign,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderOrderState } from '../orders/useProviderOrderState';
import { toLocalDateKey } from '../shared/dateHelpers';
import { getImageUrl } from '../shared/mediaHelpers';
import type { Order } from '../types';
import traditionalAoDaiImg from '../../../assets/images/onboarding_traditional.webp';
import { httpClient } from '../../../services/httpClient';
import './rentalOperationsFigma.css';

const FALLBACK_AODAI_IMAGE = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80';

type RentalOperationsPanelProps = Pick<ReturnType<typeof useProviderOrderState>,
  'loadingOrders'
> &
  Pick<ReturnType<typeof useProviderSessionState>,
    'setSelectedBookingId' | 'setIsDetailModalOpen'
  > &
{
  fetchOrders: (silent?: boolean, force?: boolean) => Promise<void>;
  rentalOperationItems: { order: Order; item: any; }[];
  orders?: Order[];
  toast?: any;
};

export function RentalOperationsPanel({
  fetchOrders,
  loadingOrders,
  rentalOperationItems,
  setSelectedBookingId,
  setIsDetailModalOpen,
  toast,
}: RentalOperationsPanelProps) {
  const navigate = useNavigate();

  // Reset scroll on mount to ensure top Hero Banner and Metric Cards are shown
  useEffect(() => {
    const parentContainer = document.querySelector('.ro-wrapper')?.parentElement;
    if (parentContainer) {
      parentContainer.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // State
  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 6;

  // Selected item for the side drawer
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'products' | 'schedule' | 'payment' | 'evidence'>('overview');
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState<boolean>(false);
  const [isActionBusy, setIsActionBusy] = useState<boolean>(false);

  // Helper date calculations
  const todayKey = toLocalDateKey();
  const parseSafeDate = (val: any, fallback: Date = new Date()): Date => {
    if (!val) return fallback;
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d;
  };

  const resolveProductImg = (targetItem: any) => {
    if (typeof targetItem?.productId === 'object' && targetItem?.productId?.images?.[0]) {
      return getImageUrl(targetItem.productId.images[0]);
    }
    if (targetItem?.image) {
      return getImageUrl(targetItem.image);
    }
    return traditionalAoDaiImg || FALLBACK_AODAI_IMAGE;
  };

  // Metric counts
  const metrics = useMemo(() => {
    let pending = 0;
    let ready = 0;
    let rented = 0;
    let returningToday = 0;
    let completed = 0;
    let overdue = 0;

    rentalOperationItems.forEach(({ item }) => {
      const fulfillment = item.rentalFulfillment || {};
      const status = fulfillment.status || 'PENDING';
      const returnDueDate = fulfillment.returnDueAt ? parseSafeDate(fulfillment.returnDueAt) : null;
      const returnDue = returnDueDate ? toLocalDateKey(returnDueDate) : null;

      if (status === 'PENDING') pending++;
      else if (status === 'READY_FOR_PICKUP') ready++;
      else if (status === 'PICKED_UP') {
        rented++;
        if (returnDue === todayKey) returningToday++;
        if (returnDueDate && returnDueDate.getTime() < Date.now()) {
          overdue++;
        }
      } else if (status === 'COMPLETED' || status === 'RETURNED') {
        completed++;
      }
    });

    return {
      pending,
      ready,
      rented,
      returningToday,
      completed,
      overdue,
      total: rentalOperationItems.length,
    };
  }, [rentalOperationItems, todayKey]);

  // Filter items
  const filteredItems = useMemo(() => {
    return rentalOperationItems.filter(({ order, item }) => {
      const fulfillment = item.rentalFulfillment || {};
      const status = fulfillment.status || 'PENDING';
      const returnDueDate = fulfillment.returnDueAt ? parseSafeDate(fulfillment.returnDueAt) : null;
      const returnDue = returnDueDate ? toLocalDateKey(returnDueDate) : null;
      const isOverdue = returnDueDate && returnDueDate.getTime() < Date.now() && status === 'PICKED_UP';

      // Status pill filter
      if (activeStatusTab === 'PENDING' && status !== 'PENDING') return false;
      if (activeStatusTab === 'READY' && status !== 'READY_FOR_PICKUP') return false;
      if (activeStatusTab === 'RENTED' && status !== 'PICKED_UP') return false;
      if (activeStatusTab === 'RETURNING_TODAY' && (status !== 'PICKED_UP' || returnDue !== todayKey)) return false;
      if (activeStatusTab === 'OVERDUE' && !isOverdue) return false;

      // Dropdown status filter
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const orderId = (order.id || order._id || '').toLowerCase();
        const custName = (order.customerName || '').toLowerCase();
        const prodName = (typeof item.productId === 'object' ? item.productId?.name : item.name || '').toLowerCase();
        if (!orderId.includes(query) && !custName.includes(query) && !prodName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [rentalOperationItems, activeStatusTab, statusFilter, searchQuery, todayKey]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, currentPage, rowsPerPage]);

  // Active selected item in drawer
  const activeSelection = useMemo(() => {
    if (!selectedItemKey) return null;
    return rentalOperationItems.find(({ order, item }) => `${order._id}-${item._id}` === selectedItemKey) || null;
  }, [selectedItemKey, rentalOperationItems]);

  // Fallback active item if none selected or on initial load
  const currentItem = activeSelection || rentalOperationItems[0] || null;

  // Status mapping helper
  const getStatusBadge = (fulfillment: any) => {
    const status = fulfillment?.status || 'PENDING';
    const returnDue = fulfillment?.returnDueAt ? parseSafeDate(fulfillment.returnDueAt) : null;
    const isDueToday = returnDue && toLocalDateKey(returnDue) === todayKey;
    const isOverdue = returnDue && returnDue.getTime() < Date.now() && status === 'PICKED_UP';

    if (isOverdue) {
      return {
        label: 'Quá hạn trả',
        sub: 'Quá hạn 1 ngày',
        className: 'ro-status-late',
        dot: '#DC2626',
      };
    }
    if (status === 'PICKED_UP' && isDueToday) {
      return {
        label: 'Khách trả hôm nay',
        sub: 'Cần kiểm tra',
        className: 'ro-status-returned-today',
        dot: '#059669',
      };
    }
    if (status === 'PENDING') {
      return {
        label: 'Cần chuẩn bị',
        sub: 'Còn 2 ngày',
        className: 'ro-status-pending',
        dot: '#D97706',
      };
    }
    if (status === 'READY_FOR_PICKUP') {
      return {
        label: 'Sẵn sàng giao',
        sub: 'Chờ khách nhận',
        className: 'ro-status-ready',
        dot: '#2563EB',
      };
    }
    if (status === 'PICKED_UP') {
      return {
        label: 'Khách đang thuê',
        sub: 'Còn 1 ngày',
        className: 'ro-status-rented',
        dot: '#7C3AED',
      };
    }
    if (status === 'RETURNED') {
      return {
        label: 'Đã nhận lại',
        sub: 'Chờ giặt ủi',
        className: 'ro-status-returned',
        dot: '#4B5563',
      };
    }
    return {
      label: 'Hoàn tất',
      sub: 'Đã tất toán',
      className: 'ro-status-completed',
      dot: '#047857',
    };
  };

  // Step advancement action
  const handleAdvanceStep = async () => {
    if (!currentItem) return;
    const { order, item } = currentItem;
    const fulfillment = item.rentalFulfillment || {};
    const status = fulfillment.status || 'PENDING';
    const basePath = `/bookings/${order._id}/items/${item._id}/rental`;

    setIsActionBusy(true);
    try {
      if (status === 'PENDING') {
        await httpClient.post(`${basePath}/ready`, {});
        toast?.success?.('Đã chuyển sang trạng thái Sẵn sàng giao áo!');
      } else if (status === 'READY_FOR_PICKUP') {
        await httpClient.post(`${basePath}/picked-up`, { fileIds: [] });
        toast?.success?.('Xác nhận khách đã nhận áo thành công!');
      } else if (status === 'PICKED_UP') {
        await httpClient.post(`${basePath}/returned`, { fileIds: [] });
        toast?.success?.('Xác nhận đã nhận lại áo từ khách!');
      }
      await fetchOrders();
    } catch (err: any) {
      toast?.error?.(err?.message || 'Thao tác không thành công.');
    } finally {
      setIsActionBusy(false);
    }
  };

  return (
    <div className="ro-wrapper">
      {/* LEFT/CENTER MAIN COLUMN */}
      <main className="ro-main-content">
        {/* Hero Banner */}
        <div className="ro-hero-banner">
          <div className="ro-hero-left">
            <h1>Giao &amp; nhận áo dài</h1>
            <p>
              Quản lý hiện vật áo dài theo từng đơn hàng. Theo dõi tình trạng, xác nhận giao nhận và xử lý sự cố.
            </p>
          </div>
          <div className="ro-hero-right">
            <div className="ro-hero-slogan">
              Giữ trọn<br />nét đẹp Việt
            </div>
            <img
              src={traditionalAoDaiImg}
              alt="Áo dài nét đẹp Việt"
              className="ro-hero-thumb"
            />
          </div>
        </div>

        {/* 5 Metric Summary Cards */}
        <div className="ro-metrics-grid">
          {/* Card 1 */}
          <div className="ro-metric-card">
            <div className="ro-metric-icon" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
              <Package size={20} />
            </div>
            <div>
              <div className="ro-metric-num">{metrics.pending}</div>
              <div className="ro-metric-title">Cần chuẩn bị</div>
              <div className="ro-metric-desc">Đơn đã cọc, chờ soạn áo</div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="ro-metric-card">
            <div className="ro-metric-icon" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
              <Truck size={20} />
            </div>
            <div>
              <div className="ro-metric-num">{metrics.ready}</div>
              <div className="ro-metric-title">Sẵn sàng giao</div>
              <div className="ro-metric-desc">Đã soạn xong, chờ khách nhận</div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="ro-metric-card">
            <div className="ro-metric-icon" style={{ backgroundColor: '#F3E8FF', color: '#7E22CE' }}>
              <User size={20} />
            </div>
            <div>
              <div className="ro-metric-num">{metrics.rented}</div>
              <div className="ro-metric-title">Khách đang thuê</div>
              <div className="ro-metric-desc">Đang trong thời gian thuê</div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="ro-metric-card">
            <div className="ro-metric-icon" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <div className="ro-metric-num">{metrics.returningToday}</div>
              <div className="ro-metric-title">Khách trả hôm nay</div>
              <div className="ro-metric-desc">Cần kiểm tra và xác nhận</div>
            </div>
          </div>

          {/* Card 5 */}
          <div className="ro-metric-card">
            <div className="ro-metric-icon" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="ro-metric-num">{metrics.completed}</div>
              <div className="ro-metric-title">Hoàn tất</div>
              <div className="ro-metric-desc">Trong tháng này</div>
            </div>
          </div>
        </div>

        {/* Safety & Escrow Banner */}
        <div className="ro-safety-banner">
          <div className="ro-safety-left">
            <div className="ro-safety-icon-wrap">
              <ShieldCheck size={20} />
            </div>
            <div className="ro-safety-text">
              <h4>Quy tắc vận hành &amp; Ký quỹ an toàn</h4>
              <p>
                Vui lòng kiểm tra kỹ hiện trạng áo dài và chụp ảnh minh chứng ở mỗi bước giao nhận. Tiền cọc được VibeHue giữ hộ và sẽ tự động hoàn trả cho khách sau khi đơn hoàn tất.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsGuidelineModalOpen(true)}
            className="ro-safety-btn"
          >
            Xem hướng dẫn
          </button>
        </div>

        {/* Filter Tabs Pills */}
        <div className="ro-tabs-bar">
          <button
            type="button"
            onClick={() => { setActiveStatusTab('ALL'); setCurrentPage(1); }}
            className={`ro-tab-pill ${activeStatusTab === 'ALL' ? 'active' : ''}`}
          >
            Tất cả ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => { setActiveStatusTab('PENDING'); setCurrentPage(1); }}
            className={`ro-tab-pill ${activeStatusTab === 'PENDING' ? 'active' : ''}`}
          >
            Cần chuẩn bị ({metrics.pending})
          </button>
          <button
            type="button"
            onClick={() => { setActiveStatusTab('READY'); setCurrentPage(1); }}
            className={`ro-tab-pill ${activeStatusTab === 'READY' ? 'active' : ''}`}
          >
            Sẵn sàng giao ({metrics.ready})
          </button>
          <button
            type="button"
            onClick={() => { setActiveStatusTab('RENTED'); setCurrentPage(1); }}
            className={`ro-tab-pill ${activeStatusTab === 'RENTED' ? 'active' : ''}`}
          >
            Đang thuê ({metrics.rented})
          </button>
          <button
            type="button"
            onClick={() => { setActiveStatusTab('RETURNING_TODAY'); setCurrentPage(1); }}
            className={`ro-tab-pill ${activeStatusTab === 'RETURNING_TODAY' ? 'active' : ''}`}
          >
            Khách trả hôm nay ({metrics.returningToday})
          </button>
          <button
            type="button"
            onClick={() => { setActiveStatusTab('OVERDUE'); setCurrentPage(1); }}
            className={`ro-tab-pill ${activeStatusTab === 'OVERDUE' ? 'active' : ''}`}
          >
            Quá hạn ({metrics.overdue})
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="ro-toolbar">
          <div className="ro-search-box">
            <Search size={16} className="ro-search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm đơn hàng, tên khách..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="ro-search-input"
            />
          </div>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="ro-select-filter"
          >
            <option value="ALL">Tất cả thời gian</option>
            <option value="TODAY">Hôm nay</option>
            <option value="WEEK">Tuần này</option>
            <option value="MONTH">Tháng này</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ro-select-filter"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Cần chuẩn bị</option>
            <option value="READY_FOR_PICKUP">Sẵn sàng giao</option>
            <option value="PICKED_UP">Đang thuê</option>
            <option value="RETURNED">Đã nhận lại</option>
          </select>

          <button
            type="button"
            onClick={() => void fetchOrders()}
            disabled={loadingOrders}
            className="ro-btn-refresh"
          >
            <RefreshCw size={14} className={loadingOrders ? 'is-spinning' : ''} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Orders Table */}
        <div className="ro-table-card">
          <table className="ro-table">
            <thead>
              <tr>
                <th className="ro-th">ĐƠN HÀNG</th>
                <th className="ro-th">ÁO DÀI</th>
                <th className="ro-th">KHÁCH HÀNG</th>
                <th className="ro-th">NGÀY NHẬN</th>
                <th className="ro-th">NGÀY TRẢ</th>
                <th className="ro-th">TRẠNG THÁI</th>
                <th className="ro-th" style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: '#6B7280' }}>
                    Đang tải danh sách áo dài...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
                    <Package size={40} style={{ opacity: 0.35, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>Không tìm thấy đơn thuê nào phù hợp</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(({ order, item }) => {
                  const key = `${order._id}-${item._id}`;
                  const isSelected = selectedItemKey === key;
                  const fulfillment = item.rentalFulfillment || {};
                  const statusInfo = getStatusBadge(fulfillment);
                  const isCombo = order.bookingType === 'COMBO' || (order.items && order.items.length > 1);
                  const productName = typeof item.productId === 'object' ? item.productId?.name : item.name || order.productName || 'Áo dài';
                  const productImg = resolveProductImg(item);
                  const size = item.size || 'M';
                  const color = item.color || 'Trắng';

                  const pickupDate = parseSafeDate(fulfillment.pickupDueAt || order.startDate);
                  const returnDate = parseSafeDate(fulfillment.returnDueAt || order.endDate);

                  const customerInitials = order.customerName ? order.customerName.trim().split(/\s+/).map((n: string) => n[0]).join('').slice(-2).toUpperCase() : 'KH';

                  return (
                    <tr
                      key={key}
                      onClick={() => {
                        setSelectedItemKey(key);
                        setIsDrawerOpen(true);
                      }}
                      className={`ro-tr ${isSelected ? 'selected' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* 1. Đơn hàng */}
                      <td className="ro-td">
                        <span className="ro-order-id-title">{order.id || `#VH-${(order._id || '').slice(-5).toUpperCase()}`}</span>
                        {isCombo ? (
                          <span className="ro-badge-type ro-badge-combo">
                            <Gift size={10} /> Combo
                          </span>
                        ) : (
                          <span className="ro-badge-type ro-badge-aodai">
                            <Shirt size={10} /> Áo dài
                          </span>
                        )}
                      </td>

                      {/* 2. Áo dài */}
                      <td className="ro-td">
                        <div className="ro-aodai-wrap">
                          <img
                            src={productImg}
                            alt={productName}
                            className="ro-aodai-img"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement;
                              if (el.src !== FALLBACK_AODAI_IMAGE) {
                                el.src = FALLBACK_AODAI_IMAGE;
                              }
                            }}
                          />
                          <div>
                            <span className="ro-aodai-name" title={productName}>{productName}</span>
                            <span className="ro-aodai-sub">Size {size} · {color}</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Khách hàng */}
                      <td className="ro-td">
                        <div className="ro-cust-wrap">
                          <div className="ro-cust-avatar" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                            {customerInitials}
                          </div>
                          <div>
                            <span className="ro-cust-name">{order.customerName || 'Khách hàng'}</span>
                            <span className="ro-cust-phone">{order.customerPhone || '0901 234 567'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Ngày nhận */}
                      <td className="ro-td">
                        <span className="ro-date-bold">
                          {pickupDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span className="ro-date-time">
                          {pickupDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* 5. Ngày trả */}
                      <td className="ro-td">
                        <span className="ro-date-bold">
                          {returnDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span className="ro-date-time">
                          {returnDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* 6. Trạng thái */}
                      <td className="ro-td">
                        <span className={`ro-status-badge ${statusInfo.className}`}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusInfo.dot }} />
                          {statusInfo.label}
                        </span>
                        <span className="ro-status-sub">{statusInfo.sub}</span>
                      </td>

                      {/* 7. Thao tác */}
                      <td className="ro-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemKey(key);
                            setIsDrawerOpen(true);
                          }}
                          className="ro-btn-action"
                        >
                          Xử lý
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookingId(order._id);
                            setIsDetailModalOpen(true);
                          }}
                          className="ro-btn-more"
                          title="Tùy chọn khác"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div className="ro-pagination">
            <span style={{ color: '#6B7280', fontWeight: 600 }}>
              Hiển thị {paginatedItems.length ? (currentPage - 1) * rowsPerPage + 1 : 0} -{' '}
              {Math.min(currentPage * rowsPerPage, filteredItems.length)} của {filteredItems.length} đơn hàng
            </span>

            <div className="ro-pagination-controls">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="ro-page-btn"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setCurrentPage(pg)}
                  className={`ro-page-btn ${currentPage === pg ? 'active' : ''}`}
                >
                  {pg}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="ro-page-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <span style={{ color: '#6B7280', fontSize: '12px' }}>
              6 dòng / trang
            </span>
          </div>
        </div>
      </main>

      {/* RIGHT SLIDE-IN DETAIL DRAWER */}
      {isDrawerOpen && currentItem && (
        <>
          <div
            className="ro-drawer-overlay"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside className="ro-drawer">
            {/* Drawer Header */}
            <div className="ro-drawer-header">
              <h3 className="ro-drawer-title">
                Chi tiết đơn {currentItem.order.id || `#VH-${(currentItem.order._id || '').slice(-5).toUpperCase()}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="ro-drawer-close"
                title="Đóng chi tiết"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Summary Card */}
            <div className="ro-drawer-summary">
              <img
                src={resolveProductImg(currentItem.item)}
                alt="Áo dài"
                className="ro-summary-img"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  if (el.src !== FALLBACK_AODAI_IMAGE) {
                    el.src = FALLBACK_AODAI_IMAGE;
                  }
                }}
              />
            <div style={{ flex: 1 }}>
              <h4 className="ro-summary-title">
                {typeof currentItem.item.productId === 'object' ? currentItem.item.productId?.name : currentItem.item.name || currentItem.order.productName || 'Combo Cố Đô'}
              </h4>
              <div className="ro-summary-badges">
                <span className="ro-badge-type ro-badge-combo">
                  {currentItem.order.bookingType === 'COMBO' ? 'Combo' : 'Áo dài'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                  }}
                >
                  {getStatusBadge(currentItem.item.rentalFulfillment).label}
                </span>
              </div>
              <div className="ro-summary-meta">
                📅 {parseSafeDate(currentItem.order.startDate).toLocaleDateString('vi-VN')} -{' '}
                {parseSafeDate(currentItem.order.endDate).toLocaleDateString('vi-VN')}<br />
                Tổng đơn: <strong>{(currentItem.order.totalAmount || 2800000).toLocaleString('vi-VN')}đ</strong> | Đã cọc:{' '}
                <strong style={{ color: '#059669' }}>
                  {(currentItem.order.depositTotal || (currentItem.order.totalAmount ? Math.round(currentItem.order.totalAmount * 0.5) : 1400000)).toLocaleString('vi-VN')}đ (50%)
                </strong>
              </div>
            </div>
          </div>

          {/* Drawer Navigation Tabs */}
          <div className="ro-drawer-tabs">
            <button
              type="button"
              onClick={() => setActiveDrawerTab('overview')}
              className={`ro-drawer-tab-btn ${activeDrawerTab === 'overview' ? 'active' : ''}`}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setActiveDrawerTab('products')}
              className={`ro-drawer-tab-btn ${activeDrawerTab === 'products' ? 'active' : ''}`}
            >
              Sản phẩm
            </button>
            <button
              type="button"
              onClick={() => setActiveDrawerTab('schedule')}
              className={`ro-drawer-tab-btn ${activeDrawerTab === 'schedule' ? 'active' : ''}`}
            >
              Lịch trình
            </button>
            <button
              type="button"
              onClick={() => setActiveDrawerTab('payment')}
              className={`ro-drawer-tab-btn ${activeDrawerTab === 'payment' ? 'active' : ''}`}
            >
              Thanh toán
            </button>
            <button
              type="button"
              onClick={() => setActiveDrawerTab('evidence')}
              className={`ro-drawer-tab-btn ${activeDrawerTab === 'evidence' ? 'active' : ''}`}
            >
              Bằng chứng
            </button>
          </div>

          {/* Drawer Scrollable Body */}
          <div className="ro-drawer-body">
            {activeDrawerTab === 'overview' && (
              <>
                {/* 1. Customer Info */}
                <div className="ro-section-card">
                  <div className="ro-section-header">
                    <User size={14} />
                    <span>Thông tin khách hàng</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="ro-cust-avatar" style={{ width: 44, height: 44, fontSize: 16, background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                      {currentItem.order.customerName ? currentItem.order.customerName[0] : 'K'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '14px', color: '#111827' }}>
                          {currentItem.order.customerName || 'Nguyễn Thảo My'}
                        </strong>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F3E8FF', color: '#7E22CE' }}>
                          Khách hàng thân thiết
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                        📞 {currentItem.order.customerPhone || '0901 234 567'}<br />
                        ✉️ {currentItem.order.customerEmail || 'thaomy@gmail.com'}
                      </div>
                    </div>
                  </div>

                  <div className="ro-contact-buttons">
                    <button
                      type="button"
                      onClick={() => navigate('/chat')}
                      className="ro-btn-contact"
                    >
                      <MessageSquare size={14} />
                      <span>Nhắn tin</span>
                    </button>
                    <a
                      href={`tel:${currentItem.order.customerPhone || '0901234567'}`}
                      className="ro-btn-contact"
                      style={{ textDecoration: 'none' }}
                    >
                      <Phone size={14} />
                      <span>Gọi điện</span>
                    </a>
                  </div>
                </div>

                {/* 2. Schedule Info */}
                <div className="ro-section-card">
                  <div className="ro-section-header">
                    <Calendar size={14} />
                    <span>Thông tin lịch thuê</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px', marginBottom: '10px' }}>
                    <div>
                      <span style={{ color: '#6B7280', fontSize: '11px', display: 'block' }}>Ngày nhận</span>
                      <strong>
                        {parseSafeDate(currentItem.order.startDate).toLocaleDateString('vi-VN')} · 08:00
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280', fontSize: '11px', display: 'block' }}>Ngày trả</span>
                      <strong>
                        {parseSafeDate(currentItem.order.endDate).toLocaleDateString('vi-VN')} · 18:00
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#4B5563', borderTop: '1px solid #EBE4D8', paddingTop: '8px' }}>
                    <MapPin size={15} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <strong>Địa điểm nhận:</strong> {currentItem.order.pickupLocation || 'Số 23 Đặng Thái Thân, TP. Huế'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBookingId(currentItem.order._id);
                        setIsDetailModalOpen(true);
                      }}
                      style={{ background: 'none', border: 'none', color: '#881337', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>

                {/* 3. Stepper Progress */}
                <div className="ro-section-card">
                  <div className="ro-section-header">
                    <Clock size={14} />
                    <span>Tiến trình giao &amp; nhận áo dài</span>
                  </div>

                  {(() => {
                    const status = currentItem.item.rentalFulfillment?.status || 'PENDING';
                    const steps = [
                      { key: 'PENDING', label: 'Chờ chuẩn bị' },
                      { key: 'READY_FOR_PICKUP', label: 'Sẵn sàng giao' },
                      { key: 'PICKED_UP', label: 'Khách đang thuê' },
                      { key: 'RETURNED', label: 'Đã nhận lại' },
                      { key: 'COMPLETED', label: 'Hoàn tất' },
                    ];
                    const activeIdx = Math.max(0, steps.findIndex((s) => s.key === status));

                    return (
                      <div className="ro-stepper">
                        {steps.map((st, idx) => {
                          const isDone = idx < activeIdx;
                          const isActive = idx === activeIdx;

                          return (
                            <div key={st.key} className="ro-stepper-item">
                              <div
                                className={`ro-stepper-circle ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                              >
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <span
                                className={`ro-stepper-label ${isActive ? 'active' : ''}`}
                              >
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Step Action Alert Box with Checklist */}
                  <div className="ro-step-action-box">
                    <div style={{ position: 'relative', zIndex: 2 }}>
                      <div className="ro-step-action-title">
                        {currentItem.item.rentalFulfillment?.status === 'READY_FOR_PICKUP'
                          ? 'Bước hiện tại: Sẵn sàng giao áo cho khách'
                          : currentItem.item.rentalFulfillment?.status === 'PICKED_UP'
                          ? 'Bước hiện tại: Khách đang trong thời gian thuê'
                          : currentItem.item.rentalFulfillment?.status === 'RETURNED'
                          ? 'Bước hiện tại: Đã nhận lại áo, kiểm tra giặt ủi'
                          : 'Bước hiện tại: Chờ chuẩn bị áo dài'}
                      </div>
                      <div className="ro-step-action-desc">
                        Hãy kiểm tra sản phẩm, chuẩn bị đúng mẫu, size và phụ kiện đi kèm theo hợp đồng.
                      </div>

                      <div className="ro-checklist-item">
                        <CheckCircle2 size={15} />
                        <span>Kiểm tra sản phẩm trong kho</span>
                      </div>
                      <div className="ro-checklist-item">
                        <CheckCircle2 size={15} />
                        <span>Chuẩn bị phụ kiện (mấn, quạt, túi, ...)</span>
                      </div>
                      <div className="ro-checklist-item">
                        <CheckCircle2 size={15} />
                        <span>Đóng gói sẵn sàng</span>
                      </div>
                    </div>
                    <Package
                      size={72}
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: -4,
                        color: '#D97706',
                        opacity: 0.15,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* TAB: SẢN PHẨM */}
            {activeDrawerTab === 'products' && (
              <div className="ro-section-card">
                <div className="ro-section-header">
                  <Shirt size={14} />
                  <span>Danh sách hiện vật trong đơn</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(currentItem.order.items || [currentItem.item]).map((it: any, idx: number) => (
                    <div
                      key={it._id || idx}
                      style={{
                        padding: '10px',
                        background: '#FFFFFF',
                        border: '1px solid #EBE4D8',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                      }}
                    >
                      <img
                        src={resolveProductImg(it)}
                        alt="Product"
                        style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', backgroundColor: '#F3F4F6' }}
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          if (el.src !== FALLBACK_AODAI_IMAGE) {
                            el.src = FALLBACK_AODAI_IMAGE;
                          }
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '13px', color: '#111827', display: 'block' }}>
                          {typeof it.productId === 'object' ? it.productId?.name : it.name || 'Áo dài'}
                        </strong>
                        <span style={{ fontSize: '11.5px', color: '#6B7280' }}>
                          Size: {it.size || 'M'} · Màu: {it.color || 'Trắng'} · SKU: {it.sku || 'AD-001'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: LỊCH TRÌNH */}
            {activeDrawerTab === 'schedule' && (
              <div className="ro-section-card">
                <div className="ro-section-header">
                  <Clock size={14} />
                  <span>Mốc thời gian quan trọng</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div>
                    <strong>Nhận áo:</strong> {parseSafeDate(currentItem.order.startDate).toLocaleString('vi-VN')}
                  </div>
                  <div>
                    <strong>Hạn trả áo:</strong> {parseSafeDate(currentItem.order.endDate).toLocaleString('vi-VN')}
                  </div>
                  <div>
                    <strong>Trạng thái:</strong> {getStatusBadge(currentItem.item.rentalFulfillment).label}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: THANH TOÁN */}
            {activeDrawerTab === 'payment' && (
              <div className="ro-section-card">
                <div className="ro-section-header">
                  <DollarSign size={14} />
                  <span>Chi tiết thanh toán &amp; Ký quỹ</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tổng giá trị đơn:</span>
                    <strong>{(currentItem.order.totalAmount || 2800000).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>Đã đặt cọc đảm bảo:</span>
                    <strong>{(currentItem.order.depositTotal || 1400000).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #EBE4D8', paddingTop: '6px' }}>
                    <span>Ký quỹ VibeHue:</span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>Đã bảo đảm</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BẰNG CHỨNG */}
            {activeDrawerTab === 'evidence' && (
              <div className="ro-section-card">
                <div className="ro-section-header">
                  <ImageIcon size={14} />
                  <span>Ảnh minh chứng giao nhận</span>
                </div>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 10px 0' }}>
                  Chụp ảnh hiện trạng áo dài lúc bàn giao cho khách và khi nhận lại để đối soát tiền cọc.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div style={{ aspectRatio: '1', border: '1px dashed #D1D5DB', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', cursor: 'pointer' }}>
                    <Camera size={20} />
                    <span style={{ fontSize: '10px', marginTop: 4 }}>+ Thêm ảnh</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Sticky Footer Actions */}
          <div className="ro-drawer-footer">
            <button
              type="button"
              onClick={() => {
                toast?.info?.('Đang kết nối tới quản trị viên để hỗ trợ hủy đơn.');
              }}
              className="ro-btn-cancel-order"
            >
              Hủy đơn
            </button>

            <a
              href={`tel:${currentItem.order.customerPhone || '0901234567'}`}
              className="ro-btn-contact"
              style={{ textDecoration: 'none', padding: '9px 12px' }}
            >
              <Phone size={14} />
              <span>Liên hệ khách</span>
            </a>

            <button
              type="button"
              onClick={handleAdvanceStep}
              disabled={isActionBusy}
              className="ro-btn-advance"
            >
              <span>
                {currentItem.item.rentalFulfillment?.status === 'READY_FOR_PICKUP'
                  ? 'Xác nhận đã giao ➔'
                  : currentItem.item.rentalFulfillment?.status === 'PICKED_UP'
                  ? 'Xác nhận đã nhận lại ➔'
                  : currentItem.item.rentalFulfillment?.status === 'RETURNED'
                  ? 'Hoàn tất tất toán'
                  : 'Đã chuẩn bị xong ➔'}
              </span>
            </button>
          </div>
        </aside>
      </>
      )}

      {/* Guideline Modal (Quy tắc vận hành & Ký quỹ an toàn) */}
      {isGuidelineModalOpen && (
        <div className="ro-drawer-backdrop" onClick={() => setIsGuidelineModalOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '560px',
              width: '90%',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px 28px',
              margin: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400E' }}>
                <ShieldCheck size={22} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 750 }}>
                  Quy Tắc Vận Hành &amp; Ký Quỹ An Toàn
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGuidelineModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0 }}>
                Nhằm bảo vệ quyền lợi của Nhà cung cấp và khách hàng khi thuê áo dài trên LUMÉ, xin vui lòng tuân thủ các bước sau:
              </p>
              <div style={{ padding: '12px', background: '#FAF8F5', borderRadius: '8px', border: '1px solid #E8E2D5' }}>
                <strong>1. Chuẩn bị &amp; Chụp ảnh bàn giao:</strong> Trước khi giao áo dài, chụp ít nhất 1 ảnh rõ nét hiện trạng áo và phụ kiện.
              </div>
              <div style={{ padding: '12px', background: '#FAF8F5', borderRadius: '8px', border: '1px solid #E8E2D5' }}>
                <strong>2. Kiểm tra khi nhận lại:</strong> Kiểm tra kỹ đường may, vết ố bẩn hoặc hư hỏng trước khi xác nhận đã nhận lại.
              </div>
              <div style={{ padding: '12px', background: '#FAF8F5', borderRadius: '8px', border: '1px solid #E8E2D5' }}>
                <strong>3. Hoàn trả tiền cọc:</strong> Sau khi xác nhận nhận lại và hoàn tất đơn, hệ thống VibeHue Escrow sẽ tự động giải tỏa tiền cọc cho khách trong vòng 24h.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setIsGuidelineModalOpen(false)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4A0E17',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
