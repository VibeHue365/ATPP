import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Gift,
  Hourglass,
  Maximize2,
  MessageSquare,
  Minimize2,
  Package,
  Phone,
  Play,
  Printer,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../types';
import traditionalAoDaiImg from '../../../../assets/images/onboarding_traditional.webp';

interface OrderDetailDrawerProps {
  order: Order | null;
  orders: Order[];
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
  resolveRescheduleRequest: (order: Order, item: any, approved: boolean) => Promise<void>;
  changeOrderStatus: (_id: string, apiStatus: string) => Promise<void>;
  onOpenIncidentReport: (order: Order) => void;
  toast: any;
}

export function OrderDetailDrawer({
  order,
  orders,
  onClose,
  onSelectOrder,
  resolveRescheduleRequest,
  changeOrderStatus,
  onOpenIncidentReport,
  toast,
}: OrderDetailDrawerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'schedule' | 'payment' | 'incidents'>('overview');
  const [selectedEvidenceImage, setSelectedEvidenceImage] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [internalNoteInput, setInternalNoteInput] = useState('');
  const [internalNotesList, setInternalNotesList] = useState<Array<{ author: string; time: string; text: string }>>([
    { author: 'Hệ thống VibeHue Escrow', time: '20/07 15:02', text: 'Khách hàng hoàn tất đặt cọc qua VibeHue Escrow. Đơn được xác nhận tự động.' },
    { author: 'Bạn (Nhà cung cấp)', time: '21/07 10:15', text: 'Đã chuẩn bị sẵn đồ size M và liên hệ thợ ảnh Trần Quang Huy.' },
  ]);

  const navigate = useNavigate();

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEvidenceImage) {
          setSelectedEvidenceImage(null);
        } else if (isContactModalOpen) {
          setIsContactModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEvidenceImage, isContactModalOpen, onClose]);

  if (!order) return null;

  const currentIndex = orders.findIndex((o) => o._id === order._id);
  const prevOrder = currentIndex > 0 ? orders[currentIndex - 1] : null;
  const nextOrder = currentIndex < orders.length - 1 ? orders[currentIndex + 1] : null;

  // Determine reschedule request
  const pendingRescheduleItem = order.items?.find(
    (item: any) => item?.rescheduleRequest?.status === 'PENDING'
  );

  const copyOrderId = () => {
    const code = order.id || `#VH-${order._id.slice(-5).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    toast.success('Đã sao chép mã đơn: ' + code);
  };

  const isCombo = order.bookingType === 'COMBO';
  const isPhoto = order.bookingType === 'PHOTOGRAPHY';
  const isAoDai = !isCombo && !isPhoto;
  const rawStatus = (order.rawStatus || '').toUpperCase();

  // Master Stepper Configuration (8 steps matching Figma)
  const masterSteps = [
    { label: 'Xác nhận', key: 'CONFIRMED', time: '20/07 15:02' },
    { label: 'Chuẩn bị áo', key: 'PICKUP_PENDING', time: '27/07 07:30' },
    { label: 'Khách nhận áo', key: 'PICKED_UP', time: '27/07 08:00' },
    { label: 'Đang chụp', key: 'IN_PROGRESS', time: '27/07 09:00', icon: Camera },
    { label: 'Bàn giao ảnh', key: 'AWAITING_REVIEW', time: 'DK 28/07' },
    { label: 'Khách trả áo', key: 'RETURN_PENDING', time: 'DK 29/07' },
    { label: 'Kiểm tra', key: 'RETURNED', time: 'DK 29/07' },
    { label: 'Hoàn tất', key: 'COMPLETED', time: 'DK 02/08' },
  ];

  // Active step computation (0 to 7)
  const isOrderCompleted = rawStatus === 'COMPLETED';
  let activeMasterIndex = 3;
  if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT') activeMasterIndex = 0;
  else if (rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') activeMasterIndex = 1;
  else if (rawStatus === 'PICKUP_PENDING') activeMasterIndex = 2;
  else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'PICKED_UP') activeMasterIndex = 3;
  else if (rawStatus === 'AWAITING_REVIEW') activeMasterIndex = 4;
  else if (rawStatus === 'RETURN_PENDING' || rawStatus === 'COMBO_PHOTOS_APPROVED') activeMasterIndex = 5;
  else if (rawStatus === 'RETURNED') activeMasterIndex = 6;
  else if (isOrderCompleted) activeMasterIndex = 7;

  const currentStepNumber = isOrderCompleted ? masterSteps.length : Math.min(masterSteps.length, activeMasterIndex + 1);

  // Sub-steppers: clean sequential progress without broken gaps
  let aoDaiCurrentIdx = 2;
  if (isOrderCompleted) aoDaiCurrentIdx = 5;
  else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT' || rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') aoDaiCurrentIdx = 0;
  else if (rawStatus === 'PICKUP_PENDING') aoDaiCurrentIdx = 1;
  else if (rawStatus === 'PICKED_UP' || rawStatus === 'IN_PROGRESS' || rawStatus === 'AWAITING_REVIEW' || rawStatus === 'COMBO_PHOTOS_APPROVED') aoDaiCurrentIdx = 2;
  else if (rawStatus === 'RETURN_PENDING') aoDaiCurrentIdx = 3;
  else if (rawStatus === 'RETURNED') aoDaiCurrentIdx = 4;

  const aoDaiStepsConfig = ['Chuẩn bị', 'Chờ nhận', 'Đang thuê', 'Nhận lại', 'Hoàn tất'];
  const aoDaiSubsteps = aoDaiStepsConfig.map((label, idx) => {
    if (isOrderCompleted || idx < aoDaiCurrentIdx) return { label, status: 'done' as const };
    if (idx === aoDaiCurrentIdx) return { label, status: 'active' as const };
    return { label, status: 'pending' as const };
  });

  let photoCurrentIdx = 1;
  if (isOrderCompleted) photoCurrentIdx = 5;
  else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT' || rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED' || rawStatus === 'PICKUP_PENDING') photoCurrentIdx = 0;
  else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'PICKED_UP') photoCurrentIdx = 1;
  else if (rawStatus === 'AWAITING_REVIEW') photoCurrentIdx = 2;
  else if (rawStatus === 'COMBO_PHOTOS_APPROVED' || rawStatus === 'RETURN_PENDING' || rawStatus === 'RETURNED') photoCurrentIdx = 3;

  const photoStepsConfig = ['Chờ chụp', 'Đang chụp', 'Bàn giao ảnh', 'Khách duyệt', 'Hoàn tất'];
  const photoSubsteps = photoStepsConfig.map((label, idx) => {
    if (isOrderCompleted || idx < photoCurrentIdx) return { label, status: 'done' as const };
    if (idx === photoCurrentIdx) return { label, status: 'active' as const };
    return { label, status: 'pending' as const };
  });

  const handleAddInternalNote = () => {
    if (!internalNoteInput.trim()) return;
    setInternalNotesList((prev) => [
      ...prev,
      {
        author: 'Bạn (Nhà cung cấp)',
        time: 'Vừa xong',
        text: internalNoteInput.trim(),
      },
    ]);
    setInternalNoteInput('');
    toast.success('Đã lưu ghi chú nội bộ');
  };

  const photoPackageImg = 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=300&q=80';

  return (
    <div className="p-drawer-backdrop" onClick={onClose}>
      <div
        className={`p-orders-drawer ${isMaximized ? 'maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        aria-label="Chi tiết đơn đặt lịch"
      >
        {/* ================================================================
            1. TOP NAVIGATION BAR (matching Admin Modal)
            ================================================================ */}
        <div className="p-drawer-topbar">
          <div className="p-drawer-topbar-left">
            <button type="button" className="p-back-btn" onClick={onClose}>
              <ChevronLeft size={16} />
              <span>Quay lại danh sách</span>
            </button>
          </div>

          <div className="p-drawer-topbar-right">
            <div className="p-nav-paginator">
              <button
                type="button"
                className="p-nav-arrow"
                disabled={!prevOrder}
                onClick={() => prevOrder && onSelectOrder(prevOrder)}
                title="Đơn trước"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                {currentIndex >= 0 ? currentIndex + 1 : 1} / {Math.max(1, orders.length)}
              </span>
              <button
                type="button"
                className="p-nav-arrow"
                disabled={!nextOrder}
                onClick={() => nextOrder && onSelectOrder(nextOrder)}
                title="Đơn tiếp theo"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              type="button"
              className="p-drawer-icon-btn"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Thu nhỏ giao diện (1180px)' : 'Mở rộng toàn màn hình'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              className="p-drawer-icon-btn"
              onClick={onClose}
              title="Đóng chi tiết (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ================================================================
            2. DETAIL HEADER CARD (Avatar, Service Name, Badges, Details Bar)
            ================================================================ */}
        <div className="p-drawer-header-card">
          <div className="p-dh-main">
            <div className="p-dh-left">
              <div className="p-dh-avatar-fallback">
                {order.customerInitials || (order.customerName ? order.customerName.slice(0, 2).toUpperCase() : 'KH')}
              </div>
              <div className="p-dh-name-group">
                <h2>
                  {order.productName || order.serviceName || (order.items?.[0]?.title) || (isPhoto ? 'Chụp Ảnh Áo Dài Nghệ Thuật - Nét Đẹp Huế Xưa' : 'Cho Thuê Áo Dài Truyền Thống Cố Đô')}
                </h2>
                <div className="p-dh-subgroup">
                  <span className="p-code-badge">
                    {order.id || `#VH-${order._id.slice(-5).toUpperCase()}`}
                    <button
                      type="button"
                      onClick={copyOrderId}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      title="Sao chép mã đơn"
                    >
                      <Copy size={12} />
                    </button>
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
                    <span>{order.status || 'Đang thực hiện'}</span>
                  </span>
                  {isAoDai && (
                    <span className="p-cap-badge p-cap-aodai">
                      <Shirt size={12} />
                      <span>Cho thuê Áo dài</span>
                    </span>
                  )}
                  {isPhoto && (
                    <span className="p-cap-badge p-cap-photo">
                      <Camera size={12} />
                      <span>Chụp ảnh</span>
                    </span>
                  )}
                  {isCombo && (
                    <span className="p-cap-badge p-cap-combo">
                      <Gift size={12} />
                      <span>Gói Combo</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-dh-details-bar">
            <div className="p-dh-item">
              <span className="label">Mã đơn:</span>
              <span className="val">{order.id || `#VH-${order._id.slice(-5).toUpperCase()}`}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Khách hàng:</span>
              <span className="val">{order.customerName || 'Nguyễn Thảo My'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Hotline:</span>
              <span className="val">{order.customerPhone || '0901 234 567'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Email:</span>
              <span className="val">{order.customerEmail || 'thaomy@gmail.com'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Ngày đặt:</span>
              <span className="val">{order.orderDate}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Địa chỉ:</span>
              <span className="val">{order.pickupLocation || 'Đại Nội Huế, 23 Đặng Thái Thân'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Thời hạn:</span>
              <span className="val" style={{ color: '#D97706', fontWeight: 700 }}>Còn 2 giờ 15 phút</span>
            </div>
          </div>
        </div>

        {/* ================================================================
            3. SUBTABS ROW (Full-width, prominent)
            ================================================================ */}
        <div className="p-drawer-subtabs">
          <button
            type="button"
            className={`p-subtab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Tổng quan
          </button>
          <button
            type="button"
            className={`p-subtab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Thông tin chi tiết
          </button>
          <button
            type="button"
            className={`p-subtab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Lịch trình &amp; Check-in
          </button>
          <button
            type="button"
            className={`p-subtab-btn ${activeTab === 'payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('payment')}
          >
            Thanh toán &amp; Cọc
          </button>
          <button
            type="button"
            className={`p-subtab-btn ${activeTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setActiveTab('incidents')}
          >
            Sự cố &amp; Bằng chứng
          </button>
        </div>

        {/* ================================================================
            4. SCROLLABLE DRAWER BODY
            ================================================================ */}
        <div className="p-drawer-body">
          {/* ============================================================
              TAB 1: TỔNG QUAN (2-Column Grid Layout matching Admin)
              ============================================================ */}
          {activeTab === 'overview' && (
            <div className="p-overview-layout">
              {/* CỘT TRÁI (Main Info, Score, Products) */}
              <div className="p-overview-col-left">
                {/* Metric Cards Grid */}
                <div className="p-score-grid">
                  <div className="p-score-card">
                    <div
                      className="p-donut-circle"
                      style={{
                        background: 'conic-gradient(#059669 0% 80%, #e2e8f0 80% 100%)',
                      }}
                    >
                      <div className="p-donut-inner">4/5</div>
                    </div>
                    <div className="p-score-info">
                      <h4>Tiến độ thực hiện (80%)</h4>
                      <p>Đơn hàng đang ở giai đoạn Đang chụp, đúng cam kết chất lượng.</p>
                    </div>
                  </div>

                  <div className="p-score-card">
                    <div className="p-rev-num" style={{ color: '#D97706' }}>
                      2h15m
                    </div>
                    <div className="p-score-info">
                      <h4>Thời hạn hoàn tất</h4>
                      <p>Còn 2 giờ 15 phút đến hạn hoàn tất buổi chụp và chuẩn bị file.</p>
                    </div>
                  </div>
                </div>

                {/* Reschedule Alert Banner */}
                {(pendingRescheduleItem || order.items?.some((i: any) => i?.rescheduleRequest?.status === 'PENDING') || (order as any).hasRescheduleDemo) && (
                  <div className="p-reschedule-box">
                    <div className="p-reschedule-top">
                      <span className="p-reschedule-title">
                        <Clock size={16} />
                        <span>Khách yêu cầu đổi lịch</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="p-reschedule-badge">Chờ bạn phản hồi</span>
                        <span style={{ fontSize: '11px', color: '#D97706', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={11} /> Còn 12 giờ
                        </span>
                      </div>
                    </div>

                    <div className="p-reschedule-details">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#94A3B8', textDecoration: 'line-through' }}>
                          Lịch cũ: 27/07/2024 • 08:00 - 12:00
                        </span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>
                          Lịch mới: 28/07/2024 • 09:00 - 13:00
                        </span>
                      </div>
                      <div style={{ marginTop: '5px', fontStyle: 'italic', color: '#475569', fontSize: '11.5px' }}>
                        Lý do: &quot;Em muốn dời sang ngày 28 vì có việc đột xuất. Mong anh/chị hỗ trợ ạ!&quot;
                      </div>
                    </div>

                    <div className="p-reschedule-actions">
                      <button
                        type="button"
                        className="p-reschedule-reject-btn"
                        onClick={() => {
                          if (pendingRescheduleItem) resolveRescheduleRequest(order, pendingRescheduleItem, false);
                          else toast.info('Đã gửi phản hồi từ chối yêu cầu đổi lịch.');
                        }}
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        className="p-reschedule-accept-btn"
                        onClick={() => {
                          if (pendingRescheduleItem) resolveRescheduleRequest(order, pendingRescheduleItem, true);
                          else toast.success('Đã chấp thuận yêu cầu đổi lịch của khách!');
                        }}
                      >
                        Chấp nhận
                      </button>
                    </div>
                  </div>
                )}

                {/* Pickup Damage Alert */}
                {order.pickupDamageReport && (
                  <div
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#991B1B' }}>
                        Khách hàng đã báo lỗi khi nhận đồ
                      </div>
                      <div style={{ fontSize: '12px', color: '#7F1D1D', marginTop: '2px' }}>
                        {order.pickupDamageReport.description || 'Có vết bẩn/sờn vải được khai báo lúc giao nhận đồ.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Card 1: Thông tin khách hàng & Giao nhận */}
                <div className="p-card-box">
                  <div className="p-card-header">
                    <h3 className="p-card-title">
                      <User size={16} color="#881337" />
                      <span>Thông tin khách hàng &amp; Giao nhận</span>
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="p-card-edit-btn"
                        onClick={() => navigate('/chat')}
                      >
                        <MessageSquare size={13} />
                        <span>Nhắn tin</span>
                      </button>
                      <a
                        href={`tel:${order.customerPhone || '0901234567'}`}
                        className="p-card-edit-btn"
                        style={{ textDecoration: 'none' }}
                      >
                        <Phone size={13} />
                        <span>Gọi khách</span>
                      </a>
                    </div>
                  </div>

                  <div className="p-info-grid-2">
                    <div className="p-info-item">
                      <span className="info-label">Họ và tên khách hàng</span>
                      <span className="info-val">{order.customerName || 'Nguyễn Thảo My'}</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Phân loại khách hàng</span>
                      <span className="info-val" style={{ color: '#7E22CE', fontWeight: 700 }}>
                        ★ Khách hàng thân thiết
                      </span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Số điện thoại liên hệ</span>
                      <span className="info-val">{order.customerPhone || '0901 234 567'}</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Email tài khoản</span>
                      <span className="info-val">{order.customerEmail || 'thaomy@gmail.com'}</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Ngày hẹn sử dụng</span>
                      <span className="info-val">27/07/2024 (08:00 - 12:00)</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Địa điểm chụp &amp; Giao nhận</span>
                      <span className="info-val">{order.pickupLocation || 'Đại Nội Huế, 23 Đặng Thái Thân'}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      Ghi chú của khách hàng:
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#334155', fontStyle: 'italic' }}>
                      &quot;{order.customerNotes || 'Chụp ảnh và thuê áo dài cho kỷ niệm tốt nghiệp tại Cung An Định và Đại Nội.'}&quot;
                    </p>
                  </div>
                </div>

                {/* Card 2: Chi tiết sản phẩm & Dịch vụ */}
                <div className="p-card-box">
                  <div className="p-card-header">
                    <h3 className="p-card-title">
                      <Package size={16} color="#881337" />
                      <span>Chi tiết sản phẩm &amp; Dịch vụ {isCombo ? '(Combo)' : ''}</span>
                    </h3>
                  </div>

                  {/* Item 1: Áo dài */}
                  <div className="p-drawer-item-card" style={{ marginBottom: '10px' }}>
                    <img src={traditionalAoDaiImg} alt="Áo dài" className="p-drawer-item-img" />
                    <div className="p-drawer-item-info">
                      <div className="p-drawer-item-name">
                        {order.bookingType === 'PHOTOGRAPHY' ? 'Trang phục tự chuẩn bị' : 'Áo dài Nhật Bình Trắng Ngọc'}
                      </div>
                      <div className="p-drawer-item-specs">
                        Size: M &nbsp;|&nbsp; Số lượng: 1 &nbsp;|&nbsp; Phụ kiện: Mấn đội đầu, Quạt gấm thêu tay
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                        Ngày nhận: <strong>27/07 • 08:00</strong> &nbsp;•&nbsp; Ngày trả: <strong>29/07 • 18:00</strong>
                      </div>
                    </div>
                    <div className="p-drawer-item-pricing">
                      <div className="p-drawer-item-price">800.000đ</div>
                      <div className="p-drawer-item-deposit">Cọc: 1.000.000đ</div>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                        ✓ Đã chuẩn bị
                      </span>
                    </div>
                  </div>

                  {/* Item 2: Chụp ảnh */}
                  {(isCombo || isPhoto) && (
                    <div className="p-drawer-item-card">
                      <img src={photoPackageImg} alt="Chụp ảnh" className="p-drawer-item-img" />
                      <div className="p-drawer-item-info">
                        <div className="p-drawer-item-name">Gói chụp ngoại cảnh Cố Đô</div>
                        <div className="p-drawer-item-specs" style={{ color: '#1E293B', fontWeight: 600 }}>
                          Nhiếp ảnh gia: Trần Quang Huy (Sony A7IV, Lens 85mm f/1.4 GM)
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Thời gian chụp: 09:00 - 12:00 &nbsp;|&nbsp; Địa điểm: Đại Nội Huế
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                          Số ảnh gốc: 80 - 100 ảnh &nbsp;|&nbsp; Ảnh chỉnh sửa: 20 ảnh chất lượng cao
                        </div>
                      </div>
                      <div className="p-drawer-item-pricing">
                        <div className="p-drawer-item-price">2.000.000đ</div>
                        <div className="p-drawer-item-deposit">Cọc: 1.000.000đ</div>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                          🕒 Đang thực hiện
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT PHẢI (Hồ sơ minh chứng, Thanh toán Escrow, Stepper, Ghi chú) */}
              <div className="p-overview-col-right">
                {/* Card 3: Hồ sơ minh chứng (5 tài liệu & ảnh) matching Admin */}
                <div className="p-card-box">
                  <div className="p-card-header">
                    <h3 className="p-card-title">
                      <FileText size={16} color="#881337" />
                      <span>Hồ sơ minh chứng (5 tài liệu &amp; ảnh)</span>
                    </h3>
                    <button
                      type="button"
                      className="p-card-edit-btn"
                      onClick={() => setActiveTab('incidents')}
                    >
                      <Eye size={12} />
                      <span>Xem tất cả</span>
                    </button>
                  </div>

                  <div className="p-quick-doc-list">
                    <div
                      className="p-quick-doc-item"
                      onClick={() => setSelectedEvidenceImage(traditionalAoDaiImg)}
                    >
                      <div className="p-quick-doc-left">
                        <div className="p-quick-doc-thumb">
                          <img src={traditionalAoDaiImg} alt="Áo dài" />
                        </div>
                        <div className="p-quick-doc-info">
                          <span className="p-quick-doc-title">Ảnh kiểm tra áo dài trước giao</span>
                          <span className="p-quick-doc-meta">Hình ảnh rõ nét, đầy đủ phụ kiện mấn • Bấm xem</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                        Đã kiểm tra (100%)
                      </span>
                    </div>

                    <div
                      className="p-quick-doc-item"
                      onClick={() => setSelectedEvidenceImage(photoPackageImg)}
                    >
                      <div className="p-quick-doc-left">
                        <div className="p-quick-doc-thumb">
                          <img src={photoPackageImg} alt="Buổi chụp" />
                        </div>
                        <div className="p-quick-doc-info">
                          <span className="p-quick-doc-title">Ảnh check-in hiện trường buổi chụp</span>
                          <span className="p-quick-doc-meta">Đại Nội Huế, thời tiết nắng đẹp • Bấm xem</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>
                        GPS Định vị
                      </span>
                    </div>

                    <div className="p-quick-doc-item">
                      <div className="p-quick-doc-left">
                        <div className="p-quick-doc-icon" style={{ color: '#0284c7' }}>
                          <FileText size={16} />
                        </div>
                        <div className="p-quick-doc-info">
                          <span className="p-quick-doc-title">Biên bản bàn giao trang phục</span>
                          <span className="p-quick-doc-meta">Mã xác nhận bàn giao #BB-37AB40</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                        Đã ký nhận
                      </span>
                    </div>

                    <div className="p-quick-doc-item">
                      <div className="p-quick-doc-left">
                        <div className="p-quick-doc-icon" style={{ color: '#d97706' }}>
                          <ShieldCheck size={16} />
                        </div>
                        <div className="p-quick-doc-info">
                          <span className="p-quick-doc-title">Hợp đồng ký quỹ VibeHue Escrow</span>
                          <span className="p-quick-doc-meta">Bảo đảm tiền cọc và giải ngân an toàn</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#15803D', background: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                        Đã bảo chứng
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Thông tin thanh toán & Escrow */}
                <div className="p-card-box">
                  <div className="p-card-header">
                    <h3 className="p-card-title">
                      <ShieldCheck size={16} color="#881337" />
                      <span>Thông tin thanh toán &amp; Ký quỹ (Escrow)</span>
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
                      ✓ Đã thanh toán Escrow
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Tổng giá trị đơn hàng:</span>
                      <strong style={{ color: '#0F172A', fontSize: '14px' }}>{order.total || '2.800.000đ'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Đặt cọc thanh toán trước (50%):</span>
                      <span style={{ fontWeight: 600, color: '#15803D' }}>1.400.000đ (Đã thanh toán)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Tiền cọc tài sản trang phục:</span>
                      <span style={{ fontWeight: 600, color: '#0284C7' }}>1.000.000đ (Đang tạm giữ)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', fontWeight: 700 }}>
                      <span style={{ color: '#0F172A' }}>Còn lại thanh toán tại chỗ:</span>
                      <span style={{ color: '#D97706', fontSize: '14px' }}>1.400.000đ</span>
                    </div>
                  </div>
                </div>

                {/* Card 5: Master Stepper Timeline */}
                <div className="p-card-box">
                  <div className="p-card-header">
                    <h3 className="p-card-title">
                      <Sparkles size={16} color="#881337" />
                      <span>Quy trình thực hiện ({currentStepNumber}/{masterSteps.length})</span>
                    </h3>
                  </div>

                  {/* Master 8-step connected timeline */}
                  <div className="p-master-stepper-track">
                    <div className="p-master-progress-bg" />
                    <div
                      className="p-master-progress-fill"
                      style={{
                        width: isOrderCompleted
                          ? '100%'
                          : `${Math.min(100, Math.max(0, (activeMasterIndex / (masterSteps.length - 1)) * 100))}%`,
                      }}
                    />

                    {masterSteps.map((step, idx) => {
                      const isDone = isOrderCompleted || idx < activeMasterIndex;
                      const isActive = !isOrderCompleted && idx === activeMasterIndex;
                      const IconComponent = step.icon;

                      return (
                        <div key={step.key} className="p-master-step">
                          <div className={`p-master-step-node ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                            {isDone ? (
                              <Check size={13} strokeWidth={2.8} />
                            ) : isActive && IconComponent ? (
                              <IconComponent size={13} />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span className={`p-master-step-label ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                            {step.label}
                          </span>
                          <span className="p-master-step-time">
                            {step.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dual Sub-steppers */}
                  <div className={`p-dual-substepper-grid ${!isCombo ? 'single' : ''}`}>
                    {(isCombo || !isPhoto) && (
                      <div className="p-substepper-box">
                        <div className="p-substepper-header">
                          <Shirt size={14} color="#15803D" />
                          <span>Tiến trình Áo dài</span>
                        </div>
                        <div className="p-substepper-row">
                          <div className="p-substepper-line" />
                          <div
                            className="p-substepper-line-fill"
                            style={{
                              width: isOrderCompleted
                                ? '100%'
                                : `${Math.min(100, Math.max(0, (aoDaiCurrentIdx / (aoDaiStepsConfig.length - 1)) * 100))}%`,
                            }}
                          />
                          {aoDaiSubsteps.map((sub, i) => (
                            <div key={i} className="p-substep-item">
                              <div className={`p-substep-dot ${sub.status}`}>
                                {sub.status === 'done' ? (
                                  <Check size={10} strokeWidth={3} />
                                ) : sub.status === 'active' ? (
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
                                ) : (
                                  ''
                                )}
                              </div>
                              <span className={`p-substep-title ${sub.status}`}>
                                {sub.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(isCombo || isPhoto) && (
                      <div className="p-substepper-box">
                        <div className="p-substepper-header">
                          <Camera size={14} color="#BE123C" />
                          <span>Tiến trình Chụp ảnh</span>
                        </div>
                        <div className="p-substepper-row">
                          <div className="p-substepper-line" />
                          <div
                            className="p-substepper-line-fill photo"
                            style={{
                              width: isOrderCompleted
                                ? '100%'
                                : `${Math.min(100, Math.max(0, (photoCurrentIdx / (photoStepsConfig.length - 1)) * 100))}%`,
                            }}
                          />
                          {photoSubsteps.map((sub, i) => (
                            <div key={i} className="p-substep-item">
                              <div className={`p-substep-dot ${sub.status}`}>
                                {sub.status === 'done' ? (
                                  <Check size={10} strokeWidth={3} />
                                ) : sub.status === 'active' ? (
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
                                ) : (
                                  ''
                                )}
                              </div>
                              <span className={`p-substep-title ${sub.status}`}>
                                {sub.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 6: Ghi chú nội bộ thẩm định & Điều phối matching Admin */}
                <div className="p-card-box">
                  <div className="p-card-header">
                    <h3 className="p-card-title">
                      <MessageSquare size={16} color="#881337" />
                      <span>Ghi chú nội bộ</span>
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {internalNotesList.map((note, idx) => (
                      <div key={idx} className="p-note-item">
                        <div className="p-note-content">
                          <div className="p-note-header">
                            <span className="p-note-author">{note.author}</span>
                            <span className="p-note-time">{note.time}</span>
                          </div>
                          <p className="p-note-text">{note.text}</p>
                        </div>
                      </div>
                    ))}

                    <div className="p-note-input-row">
                      <input
                        type="text"
                        className="p-note-input"
                        placeholder="Thêm ghi chú nội bộ (chỉ bạn và nhân viên nhìn thấy)..."
                        value={internalNoteInput}
                        onChange={(e) => setInternalNoteInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInternalNote();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="p-note-submit-btn"
                        onClick={handleAddInternalNote}
                      >
                        <Send size={13} />
                        <span>Lưu ghi chú</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              TAB 2: THÔNG TIN CHI TIẾT (DETAILS)
              ============================================================ */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="p-card-box">
                <div className="p-card-header">
                  <h3 className="p-card-title">
                    <Shirt size={16} color="#881337" />
                    <span>Quy cách &amp; Thông số trang phục Áo dài</span>
                  </h3>
                </div>
                <div className="p-info-grid-2">
                  <div className="p-info-item">
                    <span className="info-label">Mẫu trang phục</span>
                    <span className="info-val">Áo dài Nhật Bình thêu tay cao cấp</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Kích cỡ &amp; Thông số</span>
                    <span className="info-val">Size M (Ngực 86cm - Eo 68cm - Dài áo 135cm)</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Chất liệu vải</span>
                    <span className="info-val">Gấm hoàng cung dệt chỉ vàng, lụa tơ tằm mềm mại</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Phụ kiện đi kèm</span>
                    <span className="info-val">Mấn thêu đính ngọc, Quạt gấm Huế, Hài thêu truyền thống</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Quy chuẩn vệ sinh</span>
                    <span className="info-val">Hấp sấy tiệt trùng công nghệ ozone trước khi giao</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Tình trạng trang phục</span>
                    <span className="info-val" style={{ color: '#15803D', fontWeight: 700 }}>
                      ✓ Mới 98%, không sờn rách
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-card-box">
                <div className="p-card-header">
                  <h3 className="p-card-title">
                    <Camera size={16} color="#881337" />
                    <span>Thông số kỹ thuật buổi chụp ảnh</span>
                  </h3>
                </div>
                <div className="p-info-grid-2">
                  <div className="p-info-item">
                    <span className="info-label">Concept nghệ thuật</span>
                    <span className="info-val">Nét Đẹp Cố Đô Huế Xưa - Phong cách hoàng cung trang nhã</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Nhiếp ảnh gia chính</span>
                    <span className="info-val">Trần Quang Huy (5 năm kinh nghiệm chụp văn hóa Huế)</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Thiết bị tác nghiệp</span>
                    <span className="info-val">Sony Alpha A7IV, Lens Sony GM 85mm f/1.4, Đèn hắt sáng chuyên dụng</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Định dạng bàn giao</span>
                    <span className="info-val">File JPG gốc chuẩn màu 300 DPI + 20 file chỉnh sửa theo tone màu hoàng gia</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Kênh bàn giao</span>
                    <span className="info-val">Google Drive riêng tư được lưu trữ bảo đảm 30 ngày</span>
                  </div>
                  <div className="p-info-item">
                    <span className="info-label">Hỗ trợ tạo dáng</span>
                    <span className="info-val">Nhiếp ảnh gia hướng dẫn tạo dáng chuẩn phong thái quý tộc cung đình</span>
                  </div>
                </div>
              </div>

              <div className="p-card-box">
                <div className="p-card-header">
                  <h3 className="p-card-title">
                    <ShieldCheck size={16} color="#881337" />
                    <span>Chính sách bảo chứng VibeHue Escrow</span>
                  </h3>
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
                  • <strong>Bảo vệ tiền cọc:</strong> Khoản tiền cọc dịch vụ 1.400.000đ và cọc trang phục 1.000.000đ được khóa an toàn trên hợp đồng thông minh ký quỹ VibeHue Escrow.<br />
                  • <strong>Giải ngân doanh thu:</strong> Doanh thu được tự động chuyển về ví đối tác của bạn ngay sau khi khách hàng xác nhận nhận đủ ảnh và hoàn trả áo dài nguyên vẹn.<br />
                  • <strong>Bảo hiểm sự cố:</strong> Trường hợp phát sinh hư hỏng, hệ thống trọng tài VibeHue sẽ thụ lý bằng chứng hình ảnh trong vòng 24 giờ.
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              TAB 3: LỊCH TRÌNH & CHECK-IN (SCHEDULE)
              ============================================================ */}
          {activeTab === 'schedule' && (
            <div className="p-tab-schedule-container">
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Calendar size={16} />
                <span>Lịch trình chi tiết các mốc thực hiện &amp; Check-in</span>
              </div>

              {[
                {
                  time: '20/07/2024 • 14:32',
                  title: 'Khách hàng đặt lịch & Thanh toán cọc giữ chỗ',
                  desc: 'Hệ thống xác nhận đã nhận cọc 1.400.000đ qua VibeHue Escrow QR.',
                  icon: CheckCircle,
                  color: '#10B981',
                  bg: '#ECFDF5',
                },
                {
                  time: '27/07/2024 • 07:30',
                  title: 'Chuẩn bị trang phục tại cửa hàng',
                  desc: 'Nhân viên hoàn tất kiểm tra Áo dài Nhật Bình (Mã #AD-NB01, Size M), ủi phẳng và xếp phụ kiện.',
                  icon: Shirt,
                  color: '#15803D',
                  bg: '#F0FDF4',
                },
                {
                  time: '27/07/2024 • 08:00',
                  title: 'Khách nhận áo dài & Bàn giao đồ',
                  desc: 'Khách hàng thử áo tại cửa hàng và ký nhận tình trạng trang phục hoàn hảo.',
                  icon: Package,
                  color: '#2563EB',
                  bg: '#EFF6FF',
                },
                {
                  time: '27/07/2024 • 09:00 - 12:00',
                  title: 'Buổi chụp ảnh ngoại cảnh Cố Đô Huế',
                  desc: 'Địa điểm: Đại Nội Huế (Ngọ Môn, Điện Thái Hòa). Nhiếp ảnh gia: Trần Quang Huy.',
                  icon: Camera,
                  color: '#BE123C',
                  bg: '#FFF1F2',
                },
                {
                  time: '28/07/2024 • 12:00 (Hạn chót)',
                  title: 'Bàn giao bộ ảnh gốc qua Google Drive',
                  desc: 'Dự kiến từ 80 - 100 file ảnh gốc chất lượng cao cho khách chọn 20 ảnh chỉnh sửa.',
                  icon: Clock,
                  color: '#D97706',
                  bg: '#FFFBEB',
                },
                {
                  time: '29/07/2024 • 18:00 (Hạn chót)',
                  title: 'Khách hàng hoàn trả áo dài & Kiểm tra hoàn cọc',
                  desc: 'Kiểm tra áo không rách, không ố bẩn nặng để hoàn trả cọc 1.000.000đ.',
                  icon: Shirt,
                  color: '#6D28D9',
                  bg: '#F5F3FF',
                },
                {
                  time: '02/08/2024 • 17:00 (Hạn chót)',
                  title: 'Bàn giao 20 ảnh đã chỉnh sửa & Hoàn tất đơn',
                  desc: 'Khách hàng nghiệm thu ảnh và hệ thống giải ngân doanh thu cho nhà cung cấp.',
                  icon: CheckCircle,
                  color: '#10B981',
                  bg: '#ECFDF5',
                },
              ].map((milestone, idx) => {
                const IconComp = milestone.icon;
                return (
                  <div key={idx} className="p-schedule-milestone-card">
                    <div className="p-milestone-icon-wrap" style={{ backgroundColor: milestone.bg, color: milestone.color }}>
                      <IconComp size={18} />
                    </div>
                    <div className="p-milestone-content">
                      <div className="p-milestone-time">{milestone.time}</div>
                      <div className="p-milestone-title">{milestone.title}</div>
                      <div className="p-milestone-desc">{milestone.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================
              TAB 4: THANH TOÁN & CỌC (PAYMENT)
              ============================================================ */}
          {activeTab === 'payment' && (
            <div className="p-tab-payment-container">
              <div className="p-payment-summary-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Bảng kê tài chính chi tiết
                  </span>
                  <span className="p-payment-badge-paid">
                    ✓ Đã thanh toán cọc Escrow
                  </span>
                </div>

                <div className="p-payment-row">
                  <span>Thuê Áo dài Nhật Bình Trắng Ngọc (3 ngày)</span>
                  <strong>800.000đ</strong>
                </div>
                <div className="p-payment-row">
                  <span>Gói chụp ngoại cảnh Cố Đô (1 buổi 3 giờ)</span>
                  <strong>2.000.000đ</strong>
                </div>
                <div className="p-payment-row">
                  <span>Tiền cọc tài sản trang phục (Áo dài)</span>
                  <strong>1.000.000đ</strong>
                </div>

                <div className="p-payment-row total">
                  <span>Tổng giá trị đơn hàng:</span>
                  <span style={{ color: '#BE123C', fontSize: '16px' }}>
                    {order.total || '2.800.000đ'}
                  </span>
                </div>
              </div>

              <div className="p-payment-summary-box">
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Trạng thái dòng tiền &amp; Ký quỹ Escrow
                </span>

                <div className="p-payment-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} color="#10B981" />
                    <span>Tiền cọc dịch vụ đã thu (50%)</span>
                  </span>
                  <strong style={{ color: '#10B981' }}>1.400.000đ (Đã thu qua Escrow)</strong>
                </div>

                <div className="p-payment-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} color="#10B981" />
                    <span>Tiền cọc tài sản áo dài đã thu</span>
                  </span>
                  <strong style={{ color: '#10B981' }}>1.000.000đ (Đang tạm giữ bảo đảm)</strong>
                </div>

                <div className="p-payment-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hourglass size={14} color="#D97706" />
                    <span>Số tiền còn lại cần thu khi gặp</span>
                  </span>
                  <strong style={{ color: '#D97706' }}>1.400.000đ (Thu khi chụp)</strong>
                </div>

                <div className="p-payment-row" style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '8px' }}>
                  <span style={{ color: '#64748B' }}>Dự kiến hoàn trả cọc áo dài:</span>
                  <strong style={{ color: '#2563EB' }}>1.000.000đ (Sau kiểm tra áo)</strong>
                </div>

                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Cổng ký quỹ: <strong>VibeHue Escrow Banking</strong> &nbsp;|&nbsp; Mã giao dịch: <strong>#TXN-200724881</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="p-drawer-secondary-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => toast.success('Đang tạo và in phiếu thu biên lai...')}
                >
                  <Printer size={14} />
                  <span>In hóa đơn thu chi</span>
                </button>
                <button
                  type="button"
                  className="p-drawer-secondary-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => toast.success('Đã tải tệp PDF biên nhận.')}
                >
                  <Download size={14} />
                  <span>Tải biên nhận PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================
              TAB 5: SỰ CỐ & BẰNG CHỨNG (INCIDENTS)
              ============================================================ */}
          {activeTab === 'incidents' && (
            <div className="p-tab-incidents-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Ảnh bằng chứng giao nhận &amp; Kiểm tra
                </span>
                <button
                  type="button"
                  onClick={() => onOpenIncidentReport(order)}
                  style={{
                    background: 'none',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>Tạo báo cáo sự cố</span>
                </button>
              </div>

              {order.pickupDamageReport && (
                <div style={{ padding: '12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309', fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>Báo cáo sự cố từ khách: &quot;{order.pickupDamageReport.description}&quot;</span>
                  </div>
                  {order.pickupDamageReport.evidencePhotos && order.pickupDamageReport.evidencePhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {order.pickupDamageReport.evidencePhotos.map((photo: string, pIdx: number) => (
                        <div
                          key={pIdx}
                          className="p-evidence-card-mini"
                          onClick={() => setSelectedEvidenceImage(photo)}
                          title="Bấm để xem ảnh phóng to"
                        >
                          <img src={photo} alt={`Ảnh hỏng ${pIdx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="p-evidence-grid">
                {[
                  {
                    title: 'Áo dài trước khi giao khách',
                    time: '27/07 07:35',
                    src: traditionalAoDaiImg,
                    badge: 'Đã kiểm duyệt',
                    badgeColor: '#10B981',
                    badgeBg: '#ECFDF5',
                  },
                  {
                    title: 'Check-in buổi chụp tại Ngọ Môn',
                    time: '27/07 09:10',
                    src: photoPackageImg,
                    badge: 'Hiện trường',
                    badgeColor: '#2563EB',
                    badgeBg: '#EFF6FF',
                  },
                  {
                    title: 'Kiểm tra áo khi khách trả',
                    time: '29/07 18:15',
                    src: traditionalAoDaiImg,
                    badge: 'Đang chờ',
                    badgeColor: '#D97706',
                    badgeBg: '#FFFBEB',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-evidence-card"
                    onClick={() => setSelectedEvidenceImage(item.src)}
                  >
                    <div className="p-evidence-thumb-wrap">
                      <img src={item.src} alt={item.title} />
                      <span
                        className="p-evidence-badge"
                        style={{ backgroundColor: item.badgeBg, color: item.badgeColor }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <div className="p-evidence-title">{item.title}</div>
                    <div className="p-evidence-meta">{item.time} • Bấm để xem ảnh phóng to</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            5. FIXED STICKY ACTION FOOTER BAR (matching Admin Modal)
            ================================================================ */}
        <div className="p-drawer-footer">
          <div className="p-footer-left">
            Lần cập nhật cuối: <strong>{order.updatedDate || order.orderDate}</strong>
          </div>

          <div className="p-footer-actions">
            <button
              type="button"
              className="p-card-edit-btn"
              style={{ padding: '8px 14px', fontSize: '13px' }}
              onClick={() => window.print()}
            >
              <Printer size={14} />
              <span>In phiếu hẹn</span>
            </button>

            <button
              type="button"
              className="p-drawer-danger-btn"
              onClick={() => onOpenIncidentReport(order)}
              title="Báo cáo sự cố hoặc hư hỏng"
            >
              <AlertTriangle size={14} />
              <span>Báo sự cố</span>
            </button>

            {/* Primary contextual status button */}
            {rawStatus === 'CONFIRMED' && isPhoto && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={() => changeOrderStatus(order._id, 'SESSION_START')}
              >
                <Play size={14} />
                <span>Bắt đầu buổi chụp</span>
              </button>
            )}

            {(rawStatus === 'IN_PROGRESS' || (!rawStatus && isCombo)) && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={() => changeOrderStatus(order._id, 'AWAITING_REVIEW')}
              >
                <Camera size={14} />
                <span>Hoàn tất buổi chụp</span>
              </button>
            )}

            {rawStatus === 'AWAITING_REVIEW' && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={() => changeOrderStatus(order._id, 'COMBO_PHOTOS_APPROVED')}
              >
                <CheckCircle size={14} />
                <span>Bàn giao ảnh chụp</span>
              </button>
            )}

            {(rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') && !isPhoto && !isCombo && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={() => changeOrderStatus(order._id, 'PICKUP_PENDING')}
              >
                <Package size={14} />
                <span>Báo chờ nhận đồ</span>
              </button>
            )}

            {rawStatus === 'PICKUP_PENDING' && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={() => changeOrderStatus(order._id, 'PICKED_UP')}
              >
                <Package size={14} />
                <span>Khách nhận đồ</span>
              </button>
            )}

            {rawStatus === 'RETURNED' && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={() => changeOrderStatus(order._id, 'COMPLETED')}
              >
                <CheckCircle size={14} />
                <span>Hoàn tất đơn hàng</span>
              </button>
            )}

            {rawStatus === 'COMPLETED' && (
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#10B981' }}>
                ✓ Đơn đã hoàn tất
              </span>
            )}
          </div>
        </div>

        {/* ================================================================
            6. LIGHTBOX MODAL FOR PHOTO PREVIEW
            ================================================================ */}
        {selectedEvidenceImage && (
          <div className="p-lightbox-backdrop" onClick={() => setSelectedEvidenceImage(null)}>
            <div className="p-lightbox-content" onClick={(e) => e.stopPropagation()}>
              <div className="p-lightbox-header">
                <span className="p-lightbox-title">
                  <Camera size={15} color="#881337" />
                  <span>Ảnh bằng chứng đối soát</span>
                </span>
                <button
                  type="button"
                  className="p-lightbox-close-btn"
                  onClick={() => setSelectedEvidenceImage(null)}
                  title="Đóng xem ảnh"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-lightbox-img-wrap">
                <img src={selectedEvidenceImage} alt="Phóng to bằng chứng" />
              </div>
              <div className="p-lightbox-footer">
                <span>VibeHue Escrow • Bằng chứng xác thực</span>
                <a
                  href={selectedEvidenceImage}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#881337', fontWeight: 600, textDecoration: 'none' }}
                >
                  Mở ảnh gốc ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            7. CONTACT CUSTOMER MODAL
            ================================================================ */}
        {isContactModalOpen && (
          <div className="p-lightbox-backdrop" onClick={() => setIsContactModalOpen(false)}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '24px',
                width: '360px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>

              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 16px 0' }}>
                Liên hệ khách hàng
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div className="p-cust-avatar-fallback" style={{ width: '44px', height: '44px', fontSize: '15px' }}>
                  {order.customerInitials || 'TM'}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    {order.customerName || 'Nguyễn Thảo My'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {order.customerPhone || '0901 234 567'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href={`tel:${order.customerPhone || '0901234567'}`}
                  className="p-drawer-primary-btn"
                  style={{
                    textDecoration: 'none',
                    justifyContent: 'center',
                    backgroundColor: '#16A34A',
                  }}
                >
                  <Phone size={15} />
                  <span>Gọi điện thoại ({order.customerPhone || '0901 234 567'})</span>
                </a>

                <button
                  type="button"
                  className="p-drawer-secondary-btn"
                  style={{ justifyContent: 'center' }}
                  onClick={() => {
                    setIsContactModalOpen(false);
                    navigate('/chat');
                  }}
                >
                  <MessageSquare size={15} />
                  <span>Mở cửa sổ chat</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderDetailDrawer;
