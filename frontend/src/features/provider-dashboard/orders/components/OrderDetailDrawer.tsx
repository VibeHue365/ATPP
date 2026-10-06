import { useState, useEffect, useMemo } from 'react';
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
import { RentalEvidenceImage } from '../../../rentals/components/RentalEvidenceImage';

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
    { author: 'Hệ thống VibeHue Escrow', time: order?.orderDate || 'Khi xác nhận', text: 'Khách hàng hoàn tất đặt cọc qua VibeHue Escrow. Đơn được xác nhận tự động.' },
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
  const primaryItem = order.items?.[0];
  const rf = primaryItem?.rentalFulfillment;
  const photoItem = order.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId);
  const photoSchedule = (order.schedules || []).find((s: any) => s.scheduleType === 'PHOTOSHOOT');
  const shootDate = photoItem?.shootDate || photoSchedule?.startsAt || photoSchedule?.scheduledDate;

  const formatShortTime = (dateVal?: string | Date | null, fallback: string = 'Theo lịch') => {
    if (!dateVal) return fallback;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return typeof dateVal === 'string' ? dateVal : fallback;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatMilestoneDateTime = (dateVal?: string | Date | null, fallback: string = 'Theo lịch hẹn') => {
    if (!dateVal) return fallback;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return typeof dateVal === 'string' ? dateVal : fallback;
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    return `${day}/${month}/${year} • ${hours}:${mins}`;
  };

  // Master Stepper Configuration (8 steps with real dynamic timestamps)
  const masterSteps = [
    { label: 'Xác nhận', key: 'CONFIRMED', time: formatShortTime(order.rawOrderDate || order.createdAt, order.orderDate || 'Đã xác nhận') },
    { label: 'Chuẩn bị áo', key: 'PICKUP_PENDING', time: rf?.readyAt ? formatShortTime(rf.readyAt) : 'Chuẩn bị' },
    { label: 'Khách nhận áo', key: 'PICKED_UP', time: rf?.pickedUpAt ? formatShortTime(rf.pickedUpAt) : (rf?.pickupDueAt ? formatShortTime(rf.pickupDueAt) : 'Nhận đồ') },
    { label: 'Đang chụp', key: 'IN_PROGRESS', time: shootDate ? formatShortTime(shootDate) : 'Chụp ảnh', icon: Camera },
    { label: 'Bàn giao ảnh', key: 'AWAITING_REVIEW', time: order.photosApproved ? 'Đã duyệt' : (order.deliveredPhotos ? 'Đã giao' : 'Trả ảnh') },
    { label: 'Khách trả áo', key: 'RETURN_PENDING', time: rf?.returnedAt ? formatShortTime(rf.returnedAt) : (rf?.returnDueAt ? formatShortTime(rf.returnDueAt) : 'Trả đồ') },
    { label: 'Kiểm tra', key: 'RETURNED', time: rf?.returnedAt ? 'Đã kiểm tra' : 'Kiểm tra' },
    { label: 'Hoàn tất', key: 'COMPLETED', time: rawStatus === 'COMPLETED' ? (formatShortTime(rf?.completedAt, order.updatedDate || 'Hoàn tất')) : 'Dự kiến' },
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

  // Dynamic progress info & time remaining computation
  const progressInfo = useMemo(() => {
    if (isOrderCompleted) {
      return {
        step: '5/5',
        percent: 100,
        title: 'Tiến độ thực hiện (100%)',
        desc: 'Đơn hàng đã hoàn tất trọn vẹn, đã hoàn tất bàn giao và tất toán.',
        deadlineNum: 'Hoàn tất',
        deadlineColor: '#059669',
        deadlineTitle: 'Trạng thái đơn',
        deadlineDesc: 'Đơn hàng đã kết thúc thành công đúng cam kết chất lượng.',
      };
    }
    if (rawStatus === 'CANCELLED') {
      return {
        step: '0/5',
        percent: 0,
        title: 'Đơn đã hủy',
        desc: 'Đơn hàng đã bị hủy, không còn hiệu lực thực hiện.',
        deadlineNum: 'Đã hủy',
        deadlineColor: '#DC2626',
        deadlineTitle: 'Trạng thái đơn',
        deadlineDesc: 'Đơn hàng đã dừng quy trình.',
      };
    }

    // Compute remaining time from real dates
    const primaryItem = order.items?.[0];
    const targetDateStr = primaryItem?.rentalEndDate || order.endDate || primaryItem?.shootDate;
    let deadlineNum = 'Theo lịch';
    let deadlineColor = '#D97706';
    let deadlineTitle = 'Thời hạn dịch vụ';
    let deadlineDesc = 'Đang tiến hành theo đúng kế hoạch cam kết.';

    if (targetDateStr) {
      const targetTime = new Date(targetDateStr).getTime();
      if (!isNaN(targetTime)) {
        const diffMs = targetTime - Date.now();
        const diffHours = Math.round(diffMs / (1000 * 3600));
        if (diffMs < 0) {
          deadlineNum = 'Quá hạn';
          deadlineColor = '#DC2626';
          deadlineTitle = 'Hạn hoàn tất';
          deadlineDesc = 'Đã vượt quá thời hạn dự kiến, vui lòng kiểm tra thu hồi.';
        } else if (diffHours >= 24) {
          const days = Math.floor(diffHours / 24);
          deadlineNum = `${days} ngày`;
          deadlineColor = '#059669';
          deadlineTitle = 'Thời hạn dịch vụ';
          deadlineDesc = `Còn ${days} ngày đến thời điểm hẹn bàn giao/kết thúc.`;
        } else {
          deadlineNum = `${Math.max(1, diffHours)} giờ`;
          deadlineColor = '#D97706';
          deadlineTitle = 'Thời hạn dịch vụ';
          deadlineDesc = `Còn ${Math.max(1, diffHours)} giờ đến thời điểm bàn giao.`;
        }
      }
    }

    if (isAoDai) {
      const stepIdx = Math.min(4, aoDaiCurrentIdx);
      const stepNum = stepIdx + 1;
      const pct = Math.round((stepNum / 5) * 100);
      const descs = [
        'Đơn hàng đang ở giai đoạn chuẩn bị trang phục tại cửa hàng.',
        'Trang phục đã sẵn sàng, đang chờ khách hàng nhận đồ.',
        'Khách hàng đang trong thời gian thuê và trải nghiệm trang phục.',
        'Khách đã trả đồ, đang tiến hành kiểm tra và tất toán cọc.',
        'Đã hoàn tất quy trình thuê trang phục.',
      ];
      return {
        step: `${stepNum}/5`,
        percent: pct,
        title: `Tiến độ thực hiện (${pct}%)`,
        desc: descs[stepIdx] || 'Đang thực hiện đúng cam kết chất lượng.',
        deadlineNum,
        deadlineColor,
        deadlineTitle,
        deadlineDesc,
      };
    } else {
      const stepIdx = Math.min(4, photoCurrentIdx);
      const stepNum = stepIdx + 1;
      const pct = Math.round((stepNum / 5) * 100);
      const descs = [
        'Đang chờ đến lịch chụp ảnh theo khung giờ hẹn.',
        'Nhiếp ảnh gia đang trong quá trình thực hiện buổi chụp.',
        'Đã chụp xong, đang trong giai đoạn chỉnh sửa và bàn giao ảnh.',
        'Đang chờ khách hàng duyệt ảnh và xác nhận chất lượng.',
        'Đã hoàn tất buổi chụp và bàn giao sản phẩm trọn vẹn.',
      ];
      return {
        step: `${stepNum}/5`,
        percent: pct,
        title: `Tiến độ thực hiện (${pct}%)`,
        desc: descs[stepIdx] || 'Đang thực hiện đúng cam kết chất lượng.',
        deadlineNum,
        deadlineColor,
        deadlineTitle,
        deadlineDesc,
      };
    }
  }, [isOrderCompleted, rawStatus, isAoDai, aoDaiCurrentIdx, photoCurrentIdx, order]);

  // Real evidence items extracted from order items and rental fulfillment
  const evidenceItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      meta: string;
      statusText: string;
      statusBg: string;
      statusColor: string;
      fileId?: string;
      imageUrl?: string;
      itemId?: string;
    }> = [];

    (order.items || []).forEach((item: any, iIdx: number) => {
      const rf = item.rentalFulfillment;
      const itemName = item.name || item.productId?.name || `Trang phục #${iIdx + 1}`;
      if (rf?.pickupEvidence?.files?.length) {
        rf.pickupEvidence.files.forEach((f: any, fIdx: number) => {
          list.push({
            id: `pickup-${item._id}-${f.fileId || fIdx}`,
            title: `Ảnh bàn giao (${itemName}) #${fIdx + 1}`,
            meta: rf.pickupConditionNote ? `Tình trạng: ${rf.pickupConditionNote}` : 'Đã chụp lưu trữ khi giao cho khách',
            statusText: 'Đã bàn giao',
            statusBg: '#ECFDF5',
            statusColor: '#059669',
            fileId: f.fileId,
            itemId: item._id,
          });
        });
      }
      if (rf?.returnEvidence?.files?.length) {
        rf.returnEvidence.files.forEach((f: any, fIdx: number) => {
          list.push({
            id: `return-${item._id}-${f.fileId || fIdx}`,
            title: `Ảnh nhận lại & kiểm tra (${itemName}) #${fIdx + 1}`,
            meta: rf.returnConditionNote ? `Ghi chú: ${rf.returnConditionNote}` : 'Đã chụp khi khách hoàn trả',
            statusText: 'Đã nhận lại',
            statusBg: '#EFF6FF',
            statusColor: '#2563EB',
            fileId: f.fileId,
            itemId: item._id,
          });
        });
      }
    });

    if (order.pickupDamageReport?.evidencePhotos?.length) {
      order.pickupDamageReport.evidencePhotos.forEach((photoUrl: string, idx: number) => {
        list.push({
          id: `damage-${idx}`,
          title: `Ảnh khách báo lỗi đồ #${idx + 1}`,
          meta: order.pickupDamageReport?.description || 'Báo cáo sự cố từ khách hàng',
          statusText: 'Khách báo lỗi',
          statusBg: '#FEF2F2',
          statusColor: '#DC2626',
          imageUrl: photoUrl,
        });
      });
    }

    return list;
  }, [order]);

  // Dynamic schedule milestones generated from real booking, item, schedules & fulfillment data
  const dynamicMilestones = useMemo(() => {
    const list: Array<{
      time: string;
      title: string;
      desc: string;
      icon: any;
      color: string;
      bg: string;
      badgeText: string;
      badgeColor: string;
      badgeBg: string;
    }> = [];

    const orderTimeStr = formatMilestoneDateTime(order.rawOrderDate || order.createdAt, order.orderDate || 'Khi tạo đơn');
    const depositAmt = order.depositTotal || order.pricingSummary?.depositTotal || (order.totalAmount ? Math.round(order.totalAmount * 0.5) : 0);
    const itemName = primaryItem?.name || primaryItem?.productId?.name || order.productName || 'Trang phục Áo dài';
    const itemSize = primaryItem?.size || primaryItem?.selectedVariant?.size;
    const isPaid = rawStatus !== 'PENDING' && rawStatus !== 'PENDING_PAYMENT';

    // 1. Mốc 1: Đặt lịch & Đặt cọc Escrow
    list.push({
      time: orderTimeStr,
      title: 'Khách hàng đặt lịch & Thanh toán cọc giữ chỗ',
      desc: isPaid
        ? `Hệ thống xác nhận đã nhận cọc ${depositAmt > 0 ? `${depositAmt.toLocaleString('vi-VN')}đ` : 'giữ chỗ'} qua VibeHue Escrow QR.`
        : `Đang chờ khách hàng thanh toán cọc ${depositAmt > 0 ? `${depositAmt.toLocaleString('vi-VN')}đ` : ''} qua VibeHue Escrow.`,
      icon: CheckCircle,
      color: '#10B981',
      bg: '#ECFDF5',
      badgeText: isPaid ? '✓ Đã cọc Escrow' : '⏳ Chờ thanh toán',
      badgeColor: isPaid ? '#059669' : '#D97706',
      badgeBg: isPaid ? '#ECFDF5' : '#FFFBEB',
    });

    if (isAoDai || isCombo) {
      // 2. Mốc 2: Chuẩn bị trang phục tại cửa hàng
      const isReady = Boolean(rf?.readyAt) || ['PICKUP_PENDING', 'PICKED_UP', 'IN_PROGRESS', 'AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(rawStatus);
      const isPreparing = rawStatus === 'CONFIRMED' || rawStatus === 'DEPOSIT_PAID';
      list.push({
        time: rf?.readyAt
          ? formatMilestoneDateTime(rf.readyAt)
          : (rf?.pickupDueAt ? `Dự kiến: ${formatMilestoneDateTime(rf.pickupDueAt)}` : 'Dự kiến trước ngày nhận đồ'),
        title: `Chuẩn bị trang phục: ${itemName}${itemSize ? ` (Size ${itemSize})` : ''}`,
        desc: rf?.readyAt
          ? `Cửa hàng đã hoàn tất kiểm tra chất lượng trang phục, ủi phẳng và chuẩn bị sẵn phụ kiện đi kèm.`
          : `Nhân viên kiểm tra Áo dài, ủi phẳng và xếp phụ kiện chuẩn bị bàn giao cho khách.`,
        icon: Shirt,
        color: isReady ? '#15803D' : (isPreparing ? '#D97706' : '#64748B'),
        bg: isReady ? '#F0FDF4' : (isPreparing ? '#FFFBEB' : '#F8FAFC'),
        badgeText: isReady ? '✓ Đã sẵn sàng' : (isPreparing ? '● Đang chuẩn bị' : 'Chờ thực hiện'),
        badgeColor: isReady ? '#15803D' : (isPreparing ? '#D97706' : '#64748B'),
        badgeBg: isReady ? '#F0FDF4' : (isPreparing ? '#FFFBEB' : '#F1F5F9'),
      });

      // 3. Mốc 3: Khách nhận áo dài & Bàn giao đồ (Check-in nhận áo)
      const isPickedUp = Boolean(rf?.pickedUpAt) || ['PICKED_UP', 'IN_PROGRESS', 'AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(rawStatus);
      const isAwaitingPickup = rawStatus === 'PICKUP_PENDING';
      const pickupEvidenceCount = rf?.pickupEvidence?.files?.length || 0;
      list.push({
        time: rf?.pickedUpAt
          ? formatMilestoneDateTime(rf.pickedUpAt)
          : (rf?.pickupDueAt ? `Hạn nhận: ${formatMilestoneDateTime(rf.pickupDueAt)}` : 'Theo lịch hẹn bàn giao'),
        title: 'Khách nhận áo dài & Bàn giao đồ (Check-in nhận)',
        desc: rf?.pickedUpAt
          ? `Khách đã nhận đồ${pickupEvidenceCount > 0 ? ` (đã lưu ${pickupEvidenceCount} ảnh bằng chứng bàn giao)` : ''}. ${rf?.pickupConditionNote ? `Tình trạng: "${rf.pickupConditionNote}".` : 'Khách hàng thử áo và xác nhận đồ hoàn hảo.'}`
          : `Khách hàng nhận đồ tại điểm hẹn: ${order.pickupLocation || 'Cửa hàng'}. Nhân viên kiểm tra và chụp ảnh bằng chứng bàn giao.`,
        icon: Package,
        color: isPickedUp ? '#2563EB' : (isAwaitingPickup ? '#D97706' : '#64748B'),
        bg: isPickedUp ? '#EFF6FF' : (isAwaitingPickup ? '#FFFBEB' : '#F8FAFC'),
        badgeText: isPickedUp ? '✓ Đã bàn giao' : (isAwaitingPickup ? '● Chờ khách nhận' : 'Chờ thực hiện'),
        badgeColor: isPickedUp ? '#2563EB' : (isAwaitingPickup ? '#D97706' : '#64748B'),
        badgeBg: isPickedUp ? '#EFF6FF' : (isAwaitingPickup ? '#FFFBEB' : '#F1F5F9'),
      });
    }

    if (isPhoto || isCombo) {
      // 4. Mốc: Buổi chụp ảnh ngoại cảnh / studio (Check-in buổi chụp)
      const isShootDone = ['AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(rawStatus) || Boolean(order.deliveredPhotos);
      const isShooting = rawStatus === 'IN_PROGRESS';
      const shootTimeStr = shootDate
        ? `${formatMilestoneDateTime(shootDate)}${photoItem?.shootTimeSlot ? ` • ${photoItem.shootTimeSlot}` : ''}`
        : 'Theo khung giờ hẹn';
      const shootLocationStr = photoItem?.shootLocation || photoSchedule?.locationAddress || order.pickupLocation || 'Địa điểm hẹn tại Huế';

      list.push({
        time: shootTimeStr,
        title: `Buổi chụp ảnh: ${photoItem?.name || photoItem?.photographyPackageId?.name || order.productName || 'Chụp ảnh ngoại cảnh Cố Đô'}`,
        desc: `Địa điểm: ${shootLocationStr}. ${isShootDone ? 'Buổi chụp ảnh đã hoàn tất thành công.' : (isShooting ? 'Nhiếp ảnh gia đang trong quá trình thực hiện buổi chụp.' : 'Nhiếp ảnh gia có mặt đúng giờ hẹn và chuẩn bị thiết bị.')}`,
        icon: Camera,
        color: isShootDone ? '#10B981' : (isShooting ? '#BE123C' : '#64748B'),
        bg: isShootDone ? '#ECFDF5' : (isShooting ? '#FFF1F2' : '#F8FAFC'),
        badgeText: isShootDone ? '✓ Đã chụp xong' : (isShooting ? '● Đang chụp' : 'Chờ thực hiện'),
        badgeColor: isShootDone ? '#10B981' : (isShooting ? '#BE123C' : '#64748B'),
        badgeBg: isShootDone ? '#ECFDF5' : (isShooting ? '#FFF1F2' : '#F1F5F9'),
      });

      // 5. Mốc: Bàn giao bộ ảnh gốc
      const isDelivered = Boolean(order.deliveredPhotos) || isShootDone;
      list.push({
        time: isDelivered ? 'Đã bàn giao ảnh gốc' : 'Dự kiến sau 24h - 48h từ buổi chụp',
        title: 'Bàn giao bộ ảnh gốc cho khách chọn',
        desc: order.deliveryDriveUrl
          ? `Đã gửi liên kết Drive bộ ảnh: ${order.deliveryDriveUrl}`
          : 'Dự kiến tải lên toàn bộ file ảnh gốc chất lượng cao để khách chọn ảnh chỉnh sửa hậu kỳ.',
        icon: Clock,
        color: isDelivered ? '#10B981' : '#D97706',
        bg: isDelivered ? '#ECFDF5' : '#FFFBEB',
        badgeText: isDelivered ? '✓ Đã bàn giao' : 'Đang xử lý',
        badgeColor: isDelivered ? '#10B981' : '#D97706',
        badgeBg: isDelivered ? '#ECFDF5' : '#FFFBEB',
      });

      // 6. Mốc: Khách duyệt ảnh & Hậu kỳ
      const isApproved = Boolean(order.photosApproved) || rawStatus === 'COMBO_PHOTOS_APPROVED' || isOrderCompleted;
      list.push({
        time: isApproved ? 'Khách đã duyệt' : 'Dự kiến sau khi khách chọn ảnh',
        title: 'Khách hàng duyệt ảnh & Hoàn thiện hậu kỳ',
        desc: isApproved
          ? 'Khách hàng đã nghiệm thu và duyệt danh sách ảnh hoàn thiện đúng cam kết chất lượng.'
          : 'Đang chờ khách duyệt hoặc thợ ảnh đang tiến hành chỉnh màu/da theo yêu cầu.',
        icon: Sparkles,
        color: isApproved ? '#10B981' : '#8B5CF6',
        bg: isApproved ? '#ECFDF5' : '#F5F3FF',
        badgeText: isApproved ? '✓ Đã duyệt ảnh' : 'Chờ duyệt',
        badgeColor: isApproved ? '#10B981' : '#8B5CF6',
        badgeBg: isApproved ? '#ECFDF5' : '#F5F3FF',
      });
    }

    if (isAoDai || isCombo) {
      // 7. Mốc: Khách hàng hoàn trả áo dài & Kiểm tra hoàn cọc (Check-in trả đồ)
      const isReturned = Boolean(rf?.returnedAt) || ['RETURNED', 'COMPLETED'].includes(rawStatus);
      const isAwaitingReturn = rawStatus === 'RETURN_PENDING' || rawStatus === 'COMBO_PHOTOS_APPROVED';
      const returnEvidenceCount = rf?.returnEvidence?.files?.length || 0;
      list.push({
        time: rf?.returnedAt
          ? formatMilestoneDateTime(rf.returnedAt)
          : (rf?.returnDueAt ? `Hạn trả: ${formatMilestoneDateTime(rf.returnDueAt)}` : 'Hạn trả theo thỏa thuận'),
        title: 'Khách hàng hoàn trả áo dài & Kiểm tra đồ (Check-in trả)',
        desc: rf?.returnedAt
          ? `Đã nhận lại áo${returnEvidenceCount > 0 ? ` (đã chụp ${returnEvidenceCount} ảnh kiểm tra)` : ''}. ${rf?.returnConditionNote ? `Ghi chú: "${rf.returnConditionNote}".` : 'Kiểm tra áo không rách, không ố bẩn nặng để hoàn tất hoàn cọc.'}`
          : `Khách hàng hoàn trả áo dài tại cửa hàng. Nhân viên kiểm tra đối soát tình trạng vải, phụ kiện để hoàn cọc.`,
        icon: Shirt,
        color: isReturned ? '#10B981' : (isAwaitingReturn ? '#6D28D9' : '#64748B'),
        bg: isReturned ? '#ECFDF5' : (isAwaitingReturn ? '#F5F3FF' : '#F8FAFC'),
        badgeText: isReturned ? '✓ Đã nhận lại' : (isAwaitingReturn ? '● Chờ trả đồ' : 'Chờ thực hiện'),
        badgeColor: isReturned ? '#10B981' : (isAwaitingReturn ? '#6D28D9' : '#64748B'),
        badgeBg: isReturned ? '#ECFDF5' : (isAwaitingReturn ? '#F5F3FF' : '#F1F5F9'),
      });
    }

    // 8. Mốc cuối: Nghiệm thu hoàn tất & Tất toán cọc Escrow
    list.push({
      time: isOrderCompleted
        ? formatMilestoneDateTime(rf?.completedAt || order.updatedDate || order.orderDate, 'Đã hoàn tất')
        : 'Sau khi kiểm tra và nghiệm thu toàn bộ',
      title: 'Nghiệm thu dịch vụ & Tất toán Escrow',
      desc: isOrderCompleted
        ? `Đơn hàng đã hoàn tất thành công trọn vẹn. Hệ thống VibeHue Escrow đã giải ngân doanh thu cho nhà cung cấp${rf?.depositRefundAmount ? ` và hoàn lại ${rf.depositRefundAmount.toLocaleString('vi-VN')}đ cọc cho khách hàng.` : '.'}`
        : 'Khách hàng nghiệm thu dịch vụ và hệ thống VibeHue Escrow tự động giải ngân doanh thu cho nhà cung cấp.',
      icon: CheckCircle,
      color: isOrderCompleted ? '#10B981' : '#64748B',
      bg: isOrderCompleted ? '#ECFDF5' : '#F8FAFC',
      badgeText: isOrderCompleted ? '✓ Đã hoàn tất' : 'Chờ nghiệm thu',
      badgeColor: isOrderCompleted ? '#10B981' : '#64748B',
      badgeBg: isOrderCompleted ? '#ECFDF5' : '#F1F5F9',
    });

    return list;
  }, [order, rawStatus, isAoDai, isPhoto, isCombo, isOrderCompleted, primaryItem, rf, photoItem, photoSchedule, shootDate]);

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
              <span className="val">{order.customerName || 'Khách hàng'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Hotline:</span>
              <span className="val">{order.customerPhone || '—'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Email:</span>
              <span className="val">{order.customerEmail || '—'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Ngày đặt:</span>
              <span className="val">{order.orderDate}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Địa chỉ:</span>
              <span className="val">{order.pickupLocation || 'Tại cửa hàng'}</span>
            </div>
            <div className="p-dh-item">
              <span className="label">Thời hạn:</span>
              <span className="val" style={{ color: progressInfo.deadlineColor, fontWeight: 700 }}>
                {progressInfo.deadlineNum}
              </span>
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
                        background: `conic-gradient(#059669 0% ${progressInfo.percent}%, #e2e8f0 ${progressInfo.percent}% 100%)`,
                      }}
                    >
                      <div className="p-donut-inner">{progressInfo.step}</div>
                    </div>
                    <div className="p-score-info">
                      <h4>{progressInfo.title}</h4>
                      <p>{progressInfo.desc}</p>
                    </div>
                  </div>

                  <div className="p-score-card">
                    <div className="p-rev-num" style={{ color: progressInfo.deadlineColor }}>
                      {progressInfo.deadlineNum}
                    </div>
                    <div className="p-score-info">
                      <h4>{progressInfo.deadlineTitle}</h4>
                      <p>{progressInfo.deadlineDesc}</p>
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
                      <span className="info-val">{order.customerName || 'Khách hàng'}</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Phân loại khách hàng</span>
                      <span className="info-val" style={{ color: '#7E22CE', fontWeight: 700 }}>
                        ★ Khách hàng {order.customerType || 'thân thiết'}
                      </span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Số điện thoại liên hệ</span>
                      <span className="info-val">{order.customerPhone || '—'}</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Email tài khoản</span>
                      <span className="info-val">{order.customerEmail || '—'}</span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Thời gian sử dụng / Hẹn lịch</span>
                      <span className="info-val">
                        {(() => {
                          const primaryItem = order.items?.[0];
                          if (primaryItem?.rentalStartDate && primaryItem?.rentalEndDate) {
                            return `${new Date(primaryItem.rentalStartDate).toLocaleDateString('vi-VN')} → ${new Date(primaryItem.rentalEndDate).toLocaleDateString('vi-VN')}`;
                          }
                          if (primaryItem?.shootDate) {
                            return `${primaryItem.shootDate} (${primaryItem.timeSlot || 'Theo lịch'})`;
                          }
                          if (order.startDate && order.endDate) {
                            return `${new Date(order.startDate).toLocaleDateString('vi-VN')} → ${new Date(order.endDate).toLocaleDateString('vi-VN')}`;
                          }
                          return order.orderDate || 'Theo lịch hẹn';
                        })()}
                      </span>
                    </div>
                    <div className="p-info-item">
                      <span className="info-label">Địa điểm chụp &amp; Giao nhận</span>
                      <span className="info-val">{order.pickupLocation || 'Tại cửa hàng nhà cung cấp'}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      Ghi chú của khách hàng:
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#334155', fontStyle: 'italic' }}>
                      &quot;{order.customerNotes || 'Không có ghi chú thêm từ khách hàng.'}&quot;
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

                  {/* Real dynamic items */}
                  {(!order.items || order.items.length === 0) ? (
                    <div className="p-drawer-item-card">
                      <img src={traditionalAoDaiImg} alt={order.productName} className="p-drawer-item-img" />
                      <div className="p-drawer-item-info">
                        <div className="p-drawer-item-name">{order.productName || 'Sản phẩm/Dịch vụ đặt lịch'}</div>
                        <div className="p-drawer-item-specs">Số lượng: 1</div>
                      </div>
                      <div className="p-drawer-item-pricing">
                        <div className="p-drawer-item-price">{order.total}</div>
                      </div>
                    </div>
                  ) : (
                    order.items.map((item: any, idx: number) => {
                      const isProd = item.itemType === 'PRODUCT';
                      const itemName = item.name || item.productId?.name || item.photographyPackageId?.name || (isProd ? 'Áo dài truyền thống' : 'Gói chụp ảnh');
                      const itemImg = item.productId?.images?.[0] || item.photographyPackageId?.images?.[0] || (isProd ? traditionalAoDaiImg : photoPackageImg);
                      const linePrice = Number(item.subtotal || (item.unitPrice || item.price || 0) * (item.quantity || 1));
                      const depositAmt = Number(item.depositAmount || 0);

                      return (
                        <div key={item._id || idx} className="p-drawer-item-card" style={{ marginBottom: idx < order.items!.length - 1 ? '10px' : 0 }}>
                          <img
                            src={typeof itemImg === 'string' && itemImg.startsWith('http') ? itemImg : (isProd ? traditionalAoDaiImg : photoPackageImg)}
                            alt={itemName}
                            className="p-drawer-item-img"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = isProd ? traditionalAoDaiImg : photoPackageImg;
                            }}
                          />
                          <div className="p-drawer-item-info">
                            <div className="p-drawer-item-name">{itemName}</div>
                            <div className="p-drawer-item-specs">
                              {isProd ? (
                                <>
                                  {item.size ? `Size: ${item.size}` : ''}
                                  {item.color ? ` • Màu: ${item.color}` : ''}
                                  {` • SL: ${item.quantity || 1}`}
                                </>
                              ) : (
                                <>
                                  {item.shootDate ? `Lịch chụp: ${item.shootDate}` : 'Gói chụp ảnh chuyên nghiệp'}
                                  {item.timeSlot ? ` • ${item.timeSlot}` : ''}
                                  {` • SL: ${item.quantity || 1}`}
                                </>
                              )}
                            </div>
                            {isProd && item.rentalStartDate && item.rentalEndDate && (
                              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                                Thời gian thuê: <strong>{new Date(item.rentalStartDate).toLocaleDateString('vi-VN')}</strong> → <strong>{new Date(item.rentalEndDate).toLocaleDateString('vi-VN')}</strong>
                              </div>
                            )}
                          </div>
                          <div className="p-drawer-item-pricing">
                            <div className="p-drawer-item-price">{linePrice.toLocaleString('vi-VN')}đ</div>
                            {depositAmt > 0 && (
                              <div className="p-drawer-item-deposit">Cọc: {depositAmt.toLocaleString('vi-VN')}đ</div>
                            )}
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              backgroundColor: isOrderCompleted ? '#DCFCE7' : '#EFF6FF',
                              color: isOrderCompleted ? '#15803D' : '#1D4ED8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '4px'
                            }}>
                              {isOrderCompleted ? '✓ Đã hoàn tất' : (item.rentalFulfillment?.status ? `Trạng thái: ${item.rentalFulfillment.status}` : 'Đang xử lý')}
                            </span>
                          </div>
                        </div>
                      );
                    })
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
                      <span>Hồ sơ minh chứng ({evidenceItems.length + 1} tài liệu &amp; ảnh)</span>
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
                    {evidenceItems.length === 0 ? (
                      <div style={{ padding: '14px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block' }}>
                          Chưa có ảnh bàn giao hoặc kiểm tra đồ được tải lên.
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                          Ảnh sẽ tự động hiển thị tại đây khi hoàn tất xác nhận giao nhận hoặc khi khách trả đồ.
                        </span>
                      </div>
                    ) : (
                      evidenceItems.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-quick-doc-item"
                          onClick={() => {
                            if (doc.imageUrl) setSelectedEvidenceImage(doc.imageUrl);
                          }}
                        >
                          <div className="p-quick-doc-left">
                            <div className="p-quick-doc-thumb" style={{ overflow: 'hidden', position: 'relative', width: '38px', height: '38px', borderRadius: '6px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {doc.fileId && doc.itemId ? (
                                <RentalEvidenceImage
                                  bookingId={order._id}
                                  itemId={doc.itemId}
                                  fileId={doc.fileId}
                                  alt={doc.title}
                                  onPreview={(url) => setSelectedEvidenceImage(url)}
                                />
                              ) : doc.imageUrl ? (
                                <img src={doc.imageUrl} alt={doc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <FileText size={16} color="#475569" />
                              )}
                            </div>
                            <div className="p-quick-doc-info">
                              <span className="p-quick-doc-title">{doc.title}</span>
                              <span className="p-quick-doc-meta">{doc.meta}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '10.5px', fontWeight: 600, color: doc.statusColor, background: doc.statusBg, padding: '2px 8px', borderRadius: '4px' }}>
                            {doc.statusText}
                          </span>
                        </div>
                      ))
                    )}

                    <div className="p-quick-doc-item">
                      <div className="p-quick-doc-left">
                        <div className="p-quick-doc-icon" style={{ color: '#0284c7' }}>
                          <FileText size={16} />
                        </div>
                        <div className="p-quick-doc-info">
                          <span className="p-quick-doc-title">Biên bản điện tử đơn đặt lịch</span>
                          <span className="p-quick-doc-meta">Mã xác nhận đơn {order.id || `#VH-${order._id.slice(-5).toUpperCase()}`}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                        Đã xác thực
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
                      {order.rawStatus === 'PENDING' || order.rawStatus === 'PENDING_PAYMENT' ? 'Chờ thanh toán cọc' : '✓ Đã thanh toán Escrow'}
                    </span>
                  </div>

                  {(() => {
                    const grandTotal = order.totalAmount || Number((order.total || '').replace(/[^\d]/g, '')) || 0;
                    const depositPaid = order.pricingSummary?.depositAmount || Math.round(grandTotal * 0.5);
                    const assetDeposit = order.depositTotal || order.pricingSummary?.depositTotal || 0;
                    const remaining = Math.max(0, grandTotal - depositPaid);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                          <span>Tổng giá trị đơn hàng:</span>
                          <strong style={{ color: '#0F172A', fontSize: '14px' }}>{grandTotal.toLocaleString('vi-VN')}đ</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                          <span>Đặt cọc dịch vụ trước:</span>
                          <span style={{ fontWeight: 600, color: '#15803D' }}>
                            {depositPaid.toLocaleString('vi-VN')}đ {order.rawStatus !== 'PENDING' && order.rawStatus !== 'PENDING_PAYMENT' ? '(Đã thanh toán)' : '(Chờ thanh toán)'}
                          </span>
                        </div>
                        {assetDeposit > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                            <span>Tiền cọc tài sản trang phục:</span>
                            <span style={{ fontWeight: 600, color: '#0284C7' }}>
                              {assetDeposit.toLocaleString('vi-VN')}đ {isOrderCompleted ? '(Đã tất toán)' : '(Đang tạm giữ)'}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', fontWeight: 700 }}>
                          <span style={{ color: '#0F172A' }}>Còn lại cần thanh toán:</span>
                          <span style={{ color: '#D97706', fontSize: '14px' }}>
                            {isOrderCompleted ? '0đ (Đã thanh toán đủ)' : `${remaining.toLocaleString('vi-VN')}đ`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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

              {dynamicMilestones.map((milestone, idx) => {
                const IconComp = milestone.icon;
                return (
                  <div key={idx} className="p-schedule-milestone-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                      <div className="p-milestone-icon-wrap" style={{ backgroundColor: milestone.bg, color: milestone.color }}>
                        <IconComp size={18} />
                      </div>
                      <div className="p-milestone-content">
                        <div className="p-milestone-time">{milestone.time}</div>
                        <div className="p-milestone-title">{milestone.title}</div>
                        <div className="p-milestone-desc">{milestone.desc}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: milestone.badgeColor,
                        backgroundColor: milestone.badgeBg,
                        padding: '3px 10px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {milestone.badgeText}
                    </span>
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

                {order.items && order.items.length > 0 ? (
                  order.items.map((item: any, idx: number) => {
                    const itemName = item.name || item.productId?.name || item.photographyPackageId?.name || (item.itemType === 'PRODUCT' ? 'Áo dài' : 'Gói chụp ảnh');
                    const linePrice = Number(item.subtotal || (item.unitPrice || item.price || 0) * (item.quantity || 1));
                    return (
                      <div key={item._id || idx} className="p-payment-row">
                        <span>{itemName} (x{item.quantity || 1})</span>
                        <strong>{linePrice.toLocaleString('vi-VN')}đ</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-payment-row">
                    <span>{order.productName || 'Dịch vụ'}</span>
                    <strong>{order.total}</strong>
                  </div>
                )}

                {Boolean(order.depositTotal && order.depositTotal > 0) && (
                  <div className="p-payment-row">
                    <span>Tiền cọc tài sản trang phục (Áo dài)</span>
                    <strong>{Number(order.depositTotal).toLocaleString('vi-VN')}đ</strong>
                  </div>
                )}

                <div className="p-payment-row total">
                  <span>Tổng giá trị đơn hàng:</span>
                  <span style={{ color: '#BE123C', fontSize: '16px' }}>
                    {order.total || `${(order.totalAmount || 0).toLocaleString('vi-VN')}đ`}
                  </span>
                </div>
              </div>

              {(() => {
                const grandTotal = order.totalAmount || Number((order.total || '').replace(/[^\d]/g, '')) || 0;
                const depositPaid = order.pricingSummary?.depositAmount || Math.round(grandTotal * 0.5);
                const assetDeposit = order.depositTotal || order.pricingSummary?.depositTotal || 0;
                const remaining = Math.max(0, grandTotal - depositPaid);

                return (
                  <div className="p-payment-summary-box">
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      Trạng thái dòng tiền &amp; Ký quỹ Escrow
                    </span>

                    <div className="p-payment-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={14} color="#10B981" />
                        <span>Tiền cọc dịch vụ đã thu</span>
                      </span>
                      <strong style={{ color: '#10B981' }}>
                        {depositPaid.toLocaleString('vi-VN')}đ ({order.rawStatus !== 'PENDING' && order.rawStatus !== 'PENDING_PAYMENT' ? 'Đã thu qua Escrow' : 'Chờ thanh toán'})
                      </strong>
                    </div>

                    {assetDeposit > 0 && (
                      <div className="p-payment-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} color="#10B981" />
                          <span>Tiền cọc tài sản trang phục</span>
                        </span>
                        <strong style={{ color: '#0284C7' }}>
                          {assetDeposit.toLocaleString('vi-VN')}đ ({isOrderCompleted ? 'Đã tất toán' : 'Đang tạm giữ bảo đảm'})
                        </strong>
                      </div>
                    )}

                    <div className="p-payment-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Hourglass size={14} color="#D97706" />
                        <span>Số tiền còn lại cần thu</span>
                      </span>
                      <strong style={{ color: '#D97706' }}>
                        {isOrderCompleted ? '0đ (Đã thanh toán đủ)' : `${remaining.toLocaleString('vi-VN')}đ (Thanh toán tại chỗ)`}
                      </strong>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      Cổng ký quỹ: <strong>VibeHue Escrow Banking</strong> &nbsp;|&nbsp; Mã đơn: <strong>{order.id || `#VH-${order._id.slice(-5).toUpperCase()}`}</strong>
                    </div>
                  </div>
                );
              })()}

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
                {evidenceItems.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '36px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Chưa có ảnh minh chứng được tải lên
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                      Các ảnh bàn giao trước giao, ảnh nhận lại sau trả hoặc ảnh báo hỏng đồ sẽ tự động xuất hiện ở đây.
                    </div>
                  </div>
                ) : (
                  evidenceItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-evidence-card"
                      onClick={() => {
                        if (item.imageUrl) setSelectedEvidenceImage(item.imageUrl);
                      }}
                    >
                      <div className="p-evidence-thumb-wrap" style={{ position: 'relative', width: '100%', height: '150px', background: '#F1F5F9', overflow: 'hidden' }}>
                        {item.fileId && item.itemId ? (
                          <RentalEvidenceImage
                            bookingId={order._id}
                            itemId={item.itemId}
                            fileId={item.fileId}
                            alt={item.title}
                            onPreview={(url) => setSelectedEvidenceImage(url)}
                          />
                        ) : item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <FileText size={32} color="#94A3B8" />
                          </div>
                        )}
                        <span
                          className="p-evidence-badge"
                          style={{ backgroundColor: item.statusBg, color: item.statusColor }}
                        >
                          {item.statusText}
                        </span>
                      </div>
                      <div className="p-evidence-title">{item.title}</div>
                      <div className="p-evidence-meta">{item.meta}</div>
                    </div>
                  ))
                )}
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
