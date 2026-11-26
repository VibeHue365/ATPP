import { useState, useEffect, useMemo, useRef } from 'react';
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
  PackageCheck,
  Phone,
  Play,
  Printer,
  Send,
  Shield,
  ShieldCheck,
  Shirt,
  Sparkles,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type { Order } from '../types';
import traditionalAoDaiImg from '../../../../assets/images/onboarding_traditional.webp';
import { RentalEvidenceImage } from '../../../rentals/components/RentalEvidenceImage';
import { OrderStaffAssignmentCard } from './OrderStaffAssignmentCard';
import { getRentalFulfillmentMeta, normalizeBookingStatusCode } from '../../../../utils/bookingStatus';
import { BookingContractsSection } from '../../../../components/contracts/BookingContractsSection';
import Swal from 'sweetalert2';
import { httpClient } from '../../../../services/httpClient';
import { useSocket } from '../../../../context/SocketContext';
import { API_BASE_URL } from '../../../../config/env';

interface OrderDetailDrawerProps {
  order: Order | null;
  orders: Order[];
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
  resolveRescheduleRequest: (order: Order, item: any, approved: boolean) => Promise<void>;
  changeOrderStatus: (_id: string, apiStatus: string) => Promise<void>;
  onOpenIncidentReport: (order: Order) => void;
  onOpenChat: () => void;
  onOpenFulfillmentModal?: (bookingId: string) => void;
  toast: any;
  fetchOrders?: (silent?: boolean, force?: boolean) => Promise<void>;
}

// BookingItem is persisted with `rentalFrom` / `rentalTo`.  Some older
// responses used `rentalStartDate` / `rentalEndDate`, so read both shapes
// while the provider UI is displaying historic bookings as well.
const getRentalFrom = (item: any) =>
  item?.rentalFrom || item?.rentalStartDate || item?.rentalFulfillment?.rentalFrom || null;

const getRentalTo = (item: any) =>
  item?.rentalTo || item?.rentalEndDate || item?.rentalFulfillment?.rentalTo || null;

const formatBookingDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
};

export function OrderDetailDrawer({
  order,
  orders,
  onClose,
  onSelectOrder,
  resolveRescheduleRequest,
  changeOrderStatus,
  onOpenIncidentReport,
  onOpenChat,
  onOpenFulfillmentModal,
  toast,
  fetchOrders,
}: OrderDetailDrawerProps) {
  void onOpenFulfillmentModal;
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'schedule' | 'payment' | 'incidents'>('overview');
  const [selectedEvidenceImage, setSelectedEvidenceImage] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [internalNoteInput, setInternalNoteInput] = useState('');
  const [internalNotesList, setInternalNotesList] = useState<Array<{ author: string; time: string; text: string }>>([
    { author: 'Hệ thống TàGo Escrow', time: order?.orderDate || 'Khi xác nhận', text: 'Khách hàng hoàn tất đặt cọc qua TàGo Escrow. Đơn được xác nhận tự động.' },
  ]);
  const [locallySubmittedPickupIds, setLocallySubmittedPickupIds] = useState<Set<string>>(new Set());
  const [locallyReturnedIds, setLocallyReturnedIds] = useState<Set<string>>(new Set());
  const [locallySettledIds, setLocallySettledIds] = useState<Set<string>>(new Set());
  const [identityCardInfo, setIdentityCardInfo] = useState<{
    hasIdentityCard?: boolean;
    hasFrontImage?: boolean;
    hasBackImage?: boolean;
    fullName?: string | null;
    idNumberMasked?: string | null;
  } | null>(null);
  const [cccdPreviewUrls, setCccdPreviewUrls] = useState<{ front?: string; back?: string }>({});

  useEffect(() => {
    if (!order?._id) {
      setIdentityCardInfo(null);
      setCccdPreviewUrls({});
      return;
    }
    let isSubscribed = true;
    const createdUrls: string[] = [];

    httpClient
      .get<any>(`/api/bookings/${order._id}/customer-identity`)
      .then(async (res) => {
        if (!isSubscribed) return;
        setIdentityCardInfo(res || null);
        if (res?.hasIdentityCard) {
          const urls: { front?: string; back?: string } = {};
          if (res.hasFrontImage) {
            try {
              const blob = await httpClient.getBlob(`/api/bookings/${order._id}/customer-identity/image/front`);
              const u = URL.createObjectURL(blob);
              createdUrls.push(u);
              urls.front = u;
            } catch {
              // ignore
            }
          }
          if (res.hasBackImage) {
            try {
              const blob = await httpClient.getBlob(`/api/bookings/${order._id}/customer-identity/image/back`);
              const u = URL.createObjectURL(blob);
              createdUrls.push(u);
              urls.back = u;
            } catch {
              // ignore
            }
          }
          if (isSubscribed) {
            setCccdPreviewUrls(urls);
          }
        } else {
          setCccdPreviewUrls({});
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setIdentityCardInfo(null);
          setCccdPreviewUrls({});
        }
      });

    return () => {
      isSubscribed = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [order?._id, (order as any)?.updatedAt]);

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

  const { socket } = useSocket();

  const onSelectOrderRef = useRef(onSelectOrder);
  onSelectOrderRef.current = onSelectOrder;
  const lastFetchedIdRef = useRef<string | null>(null);

  // Initial fetch when drawer opens: Immediately populate full booking details (incident, fulfillment, etc.)
  useEffect(() => {
    if (!order?._id || lastFetchedIdRef.current === order._id) return;
    lastFetchedIdRef.current = order._id;
    let isSubscribed = true;
    httpClient
      .get<any>('/api/bookings/' + order._id)
      .then((fresh) => {
        if (isSubscribed && fresh && onSelectOrderRef.current) {
          onSelectOrderRef.current(fresh);
        }
      })
      .catch((err) => {
        console.warn('Initial fetch for booking in drawer failed:', err);
      });
    return () => {
      isSubscribed = false;
    };
  }, [order?._id]);

  // Targeted event-driven refresh: Only refetch current booking if booking_updated matches this order
  useEffect(() => {
    if (!socket || !order?._id) return;
    const handler = async (payload: { bookingId: string }) => {
      if (payload?.bookingId === order._id) {
        try {
          const fresh = await httpClient.get<any>('/api/bookings/' + order._id);
          if (fresh && onSelectOrderRef.current) {
            onSelectOrderRef.current(fresh);
          }
        } catch (err) {
          console.warn('Failed to refetch current booking in drawer:', err);
        }
        fetchOrders?.(true);
      }
    };
    socket.on('booking_updated', handler);
    return () => {
      socket.off('booking_updated', handler);
    };
  }, [socket, order?._id, fetchOrders]);

  // Do not refetch on every focus/visibility event.  Testers commonly switch
  // between customer and provider tabs, which used to flood this endpoint and
  // hide a successful fulfillment action behind a 429 response. Socket events
  // and explicit post-action refreshes already keep this drawer current.

  if (!order) return null;

  const currentIndex = orders.findIndex((o) => o._id === order._id);
  const prevOrder = currentIndex > 0 ? orders[currentIndex - 1] : null;
  const nextOrder = currentIndex < orders.length - 1 ? orders[currentIndex + 1] : null;

  // Determine reschedule request
  const pendingRescheduleItem = order.items?.find(
    (item: any) => item?.rescheduleRequest?.status === 'PENDING'
  );

  const copyOrderId = () => {
    const code = order.id || `#TG-${order._id.slice(-5).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    toast.success('Đã sao chép mã đơn: ' + code);
  };

  const isCombo = order.bookingType === 'COMBO';
  const isPhoto = order.bookingType === 'PHOTOGRAPHY';
  const isAoDai = !isCombo && !isPhoto;
  const normalizedStatus = normalizeBookingStatusCode(order.rawStatus || order.status);
  const rawStatus = normalizedStatus || order.rawStatus || '';
  const isOrderCompleted = normalizedStatus === 'COMPLETED';
  const isCancelled = normalizedStatus === 'CANCELLED';
  const primaryItem = order.items?.[0];
  const primaryRentalItem = order.items?.find((item: any) =>
    item?.itemType === 'PRODUCT' || item?.productId || (!item?.itemType && !item?.photographyPackageId),
  ) || primaryItem;
  const rentalFrom = getRentalFrom(primaryRentalItem);
  const rentalTo = getRentalTo(primaryRentalItem);
  const rf = primaryItem?.rentalFulfillment;
  const photoItem = order.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId);
  const photoSchedule = (order.schedules || []).find((s: any) => s.scheduleType === 'PHOTOSHOOT');
  const shootDate = photoItem?.shootDate || photoSchedule?.startsAt || photoSchedule?.scheduledDate;

  // Single rental item detection for streamlined bottom bar actions
  const rentalItems = useMemo(() => {
    return (order.items || []).filter(
      (it: any) => it.itemType === 'PRODUCT' || it.productId || (!it.itemType && !it.photographyPackageId)
    );
  }, [order.items]);

  const isSingleRentalItem = (rentalItems.length === 1 || (rentalItems.length === 0 && isAoDai)) && !isPhoto;
  const singleRentalItem = rentalItems[0] || primaryItem;
  const singleRf = singleRentalItem?.rentalFulfillment;
  const singleFulfillmentStatus = (singleRf?.status || '').toUpperCase();
  const hasSubmittedPickupEvidence = (item: any) => {
    const fulfillment = item?.rentalFulfillment;
    return Boolean(
      fulfillment?.pickupEvidence?.files?.length ||
      fulfillment?.history?.some((entry: any) => entry?.action === 'PICKUP_EVIDENCE_SUBMITTED'),
    );
  };
  // The API may store provider handover uploads on the booking snapshot
  // (`handoverPhotos`) rather than on each rentalFulfillment item. Treat both
  // shapes as submitted so the handover action cannot be shown twice.
  const hasBookingHandoverEvidence = Boolean(
    Array.isArray((order as any)?.handoverPhotos) && (order as any).handoverPhotos.length > 0,
  );
  const allRentalHandoverEvidenceSubmitted =
    hasBookingHandoverEvidence || (rentalItems.length > 0 && rentalItems.every((item) =>
      locallySubmittedPickupIds.has(item?._id) || hasSubmittedPickupEvidence(item),
    ));
  const disputeResult = (order as any).disputeResult || (() => {
    const timeline = Array.isArray((order as any).statusTimeline) ? (order as any).statusTimeline : [];
    const resolved = [...timeline].reverse().find((entry: any) =>
      typeof entry?.note === 'string' && entry.note.includes('Admin giải quyết tranh chấp'),
    );
    return resolved ? { decisionLabel: resolved.note, resolvedAt: resolved.changedAt } : null;
  })();

  const customerReturnEvidence =
    singleRf?.customerReturnEvidence ||
    (order as any)?.customerReturnEvidence ||
    order?.items?.find((i: any) => i?.rentalFulfillment?.customerReturnEvidence)?.rentalFulfillment?.customerReturnEvidence ||
    null;

  const isSingleSettled = [
    'FULLY_RELEASED',
    'PARTIALLY_DEDUCTED',
    'FULLY_DEDUCTED',
  ].includes(singleRf?.depositSettlementStatus || '');
  const isSingleSettledLocally = isSingleSettled || locallySettledIds.has(singleRentalItem?._id);

  const hasIncidentPending =
    (order as any)?.incident?.status === 'PENDING_CUSTOMER' ||
    singleRf?.issueStatus === 'REPORTED';

  const hasDispute =
    (order as any)?.incident?.status === 'DISPUTED' ||
    (order as any)?.dispute?.status === 'OPEN' ||
    rawStatus === 'DISPUTED';

  const isSingleCleaning =
    ['RETURNED', 'COMPLETED'].includes(singleFulfillmentStatus) &&
    (singleRf?.inventoryStatus === 'CLEANING' ||
      singleRentalItem?.inventoryItem?.status === 'CLEANING' ||
      (singleFulfillmentStatus === 'RETURNED' && isSingleSettledLocally)) &&
    !hasIncidentPending &&
    !hasDispute &&
    !isOrderCompleted &&
    !isCancelled;

  const isCustomerReturnPending =
    isSingleRentalItem &&
    (singleFulfillmentStatus === 'CUSTOMER_RETURN_REQUESTED' ||
      (rawStatus === 'RETURN_PENDING' &&
        singleFulfillmentStatus !== 'RETURNED' &&
        singleFulfillmentStatus !== 'COMPLETED')) &&
    singleFulfillmentStatus !== 'RETURNED' &&
    singleFulfillmentStatus !== 'COMPLETED' &&
    !isSingleSettledLocally &&
    !hasIncidentPending &&
    !hasDispute;

  const isSingleReturnedAndInspecting =
    isSingleRentalItem &&
    (singleFulfillmentStatus === 'RETURNED' || locallyReturnedIds.has(singleRentalItem?._id)) &&
    !isSingleSettledLocally &&
    !isSingleCleaning &&
    !hasIncidentPending &&
    !hasDispute &&
    !isOrderCompleted &&
    !isCancelled;

  const isSingleInUse =
    isSingleRentalItem &&
    (singleFulfillmentStatus === 'PICKED_UP' || rawStatus === 'PICKED_UP') &&
    !['RETURNED', 'COMPLETED', 'CANCELLED', 'OVERDUE', 'LOST_ITEM'].includes(rawStatus) &&
    singleFulfillmentStatus !== 'CUSTOMER_RETURN_REQUESTED' &&
    !isCustomerReturnPending &&
    !isSingleReturnedAndInspecting &&
    !isSingleCleaning &&
    !isSingleSettledLocally &&
    !hasIncidentPending &&
    !hasDispute &&
    !isOrderCompleted &&
    !isCancelled;

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

  // Master Stepper Configuration tailored for each booking type:
  // 1. Ao Dai Rental: Xác nhận -> Chuẩn bị áo -> Khách nhận áo -> Khách trả áo -> Kiểm tra đồ -> Hoàn tất (6 steps)
  // 2. Photography: Xác nhận -> Đang chụp -> Bàn giao ảnh -> Khách duyệt ảnh -> Hoàn tất (5 steps)
  // 3. Combo: Xác nhận -> Chuẩn bị áo -> Khách nhận áo -> Đang chụp -> Bàn giao ảnh -> Khách trả áo -> Kiểm tra & Duyệt -> Hoàn tất (8 steps)
  const masterSteps = useMemo(() => {
    if (isAoDai) {
      return [
        { label: 'Xác nhận', key: 'CONFIRMED', time: formatShortTime(order.rawOrderDate || order.createdAt, order.orderDate || 'Đã xác nhận') },
        { label: 'Chuẩn bị áo', key: 'PICKUP_PENDING', time: rf?.readyAt ? formatShortTime(rf.readyAt) : 'Chuẩn bị' },
        { label: 'Khách nhận áo', key: 'PICKED_UP', time: rf?.pickedUpAt ? formatShortTime(rf.pickedUpAt) : (rf?.pickupDueAt ? formatShortTime(rf.pickupDueAt) : 'Nhận đồ') },
        { label: 'Khách trả áo', key: 'RETURN_PENDING', time: rf?.returnedAt ? formatShortTime(rf.returnedAt) : (rf?.returnDueAt ? formatShortTime(rf.returnDueAt) : 'Trả đồ') },
        { label: 'Kiểm tra đồ', key: 'RETURNED', time: rf?.returnedAt ? 'Đã kiểm tra' : 'Kiểm tra' },
        { label: 'Hoàn tất', key: 'COMPLETED', time: rawStatus === 'COMPLETED' ? (formatShortTime(rf?.completedAt, order.updatedDate || 'Hoàn tất')) : 'Dự kiến' },
      ];
    }

    if (isPhoto) {
      return [
        { label: 'Xác nhận', key: 'CONFIRMED', time: formatShortTime(order.rawOrderDate || order.createdAt, order.orderDate || 'Đã xác nhận') },
        { label: 'Đang chụp', key: 'IN_PROGRESS', time: shootDate ? formatShortTime(shootDate) : 'Chụp ảnh', icon: Camera },
        { label: 'Bàn giao ảnh', key: 'AWAITING_REVIEW', time: (order.deliveredPhotos?.length || order.deliveryDriveUrl || rawStatus === 'AWAITING_REVIEW' || isOrderCompleted) ? 'Đã giao' : 'Trả ảnh' },
        { label: 'Khách duyệt ảnh', key: 'COMBO_PHOTOS_APPROVED', time: (order.photosApproved || isOrderCompleted) ? 'Đã duyệt' : 'Chờ duyệt', icon: Sparkles },
        { label: 'Hoàn tất', key: 'COMPLETED', time: rawStatus === 'COMPLETED' ? (formatShortTime(order.updatedDate, 'Hoàn tất')) : 'Dự kiến' },
      ];
    }

    // COMBO (both rental & photography)
    return [
      { label: 'Xác nhận', key: 'CONFIRMED', time: formatShortTime(order.rawOrderDate || order.createdAt, order.orderDate || 'Đã xác nhận') },
      { label: 'Chuẩn bị áo', key: 'PREPARE_PENDING', time: rf?.readyAt ? formatShortTime(rf.readyAt) : 'Chuẩn bị' },
      { label: 'Khách nhận áo', key: 'PICKUP_PENDING', time: rf?.pickedUpAt ? formatShortTime(rf.pickedUpAt) : (rf?.pickupDueAt ? formatShortTime(rf.pickupDueAt) : 'Nhận đồ') },
      { label: 'Đang chụp', key: 'IN_PROGRESS', time: shootDate ? formatShortTime(shootDate) : 'Chụp ảnh', icon: Camera },
      { label: 'Bàn giao ảnh', key: 'AWAITING_REVIEW', time: (order.deliveredPhotos?.length || order.deliveryDriveUrl || ['AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(rawStatus) || isOrderCompleted) ? 'Đã giao' : 'Trả ảnh' },
      { label: 'Khách duyệt ảnh', key: 'COMBO_PHOTOS_APPROVED', time: (order.photosApproved || isOrderCompleted) ? 'Đã duyệt' : 'Chờ duyệt', icon: Sparkles },
      { label: 'Khách trả áo', key: 'RETURN_PENDING', time: rf?.returnedAt ? formatShortTime(rf.returnedAt) : (rf?.returnDueAt ? formatShortTime(rf.returnDueAt) : 'Trả đồ') },
      { label: 'Hoàn tất', key: 'COMPLETED', time: rawStatus === 'COMPLETED' ? (formatShortTime(rf?.completedAt, order.updatedDate || 'Hoàn tất')) : 'Dự kiến' },
    ];
  }, [isAoDai, isPhoto, order, rf, shootDate, rawStatus, isOrderCompleted]);

  // Active step computation

  const cancellationReason = useMemo(() => {
    if (order.cancellation?.reason) return order.cancellation.reason;
    if (order.cancellationReason) return order.cancellationReason;
    if (order.cancelReason) return order.cancelReason;
    if (order.statusTimeline && Array.isArray(order.statusTimeline)) {
      const cancelEntry = [...order.statusTimeline].reverse().find((e) => e.status === 'CANCELLED');
      if (cancelEntry?.note) return cancelEntry.note;
    }
    return '';
  }, [order]);

  const activeMasterIndex = useMemo(() => {
    if (isOrderCompleted) return masterSteps.length - 1;

    if (isAoDai) {
      if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT') return 0;
      if (rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') return 0;
      if (rawStatus === 'PICKUP_PENDING') return 1;
      if (rawStatus === 'PICKED_UP' || rawStatus === 'IN_PROGRESS' || rawStatus === 'OVERDUE') return 2;
      if (rawStatus === 'RETURN_PENDING') return 3;
      if (rawStatus === 'RETURNED' || rawStatus === 'COMBO_PHOTOS_APPROVED') return 4;
      return 0;
    }

    if (isPhoto) {
      if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT') return 0;
      if (rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') return 0;
      if (rawStatus === 'IN_PROGRESS') return 1;
      if (rawStatus === 'AWAITING_REVIEW') return 3;
      if (rawStatus === 'COMBO_PHOTOS_APPROVED' || order.photosApproved) return 3;
      return 0;
    }

    // COMBO:
    // 0: Xác nhận | 1: Chuẩn bị áo | 2: Khách nhận áo | 3: Đang chụp | 4: Bàn giao ảnh | 5: Khách duyệt ảnh | 6: Khách trả áo | 7: Hoàn tất
    if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT') return 0;
    if (rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') return 1;
    if (rawStatus === 'PICKUP_PENDING') return 2;
    if (rawStatus === 'PICKED_UP' || rawStatus === 'OVERDUE') return 3;
    if (rawStatus === 'IN_PROGRESS') return 3;
    if (rawStatus === 'AWAITING_REVIEW') return 4;
    if (rawStatus === 'COMBO_PHOTOS_APPROVED') return 6; // Đã duyệt ảnh -> đang chờ trả áo & nhận lại
    if (rawStatus === 'RETURN_PENDING' || rawStatus === 'RETURNED') return 6;
    if (rawStatus === 'COMPLETED') return 7;
    return 0;
  }, [isOrderCompleted, isAoDai, isPhoto, rawStatus, masterSteps.length, order.photosApproved]);

  const currentStepNumber = isOrderCompleted ? masterSteps.length : Math.min(masterSteps.length, activeMasterIndex + 1);

  // Sub-steppers: clean sequential progress without broken gaps
  let aoDaiCurrentIdx = 2;
  const allRentalsReturned = rentalItems.length > 0 && rentalItems.every((i) => ['RETURNED', 'COMPLETED'].includes(i.rentalFulfillment?.status));
  const allRentalsRequested = rentalItems.length > 0 && rentalItems.every((i) => ['CUSTOMER_RETURN_REQUESTED', 'RETURNED', 'COMPLETED'].includes(i.rentalFulfillment?.status));

  if (isOrderCompleted) {
    aoDaiCurrentIdx = 5;
  } else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT' || rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') {
    aoDaiCurrentIdx = 0;
  } else if (rawStatus === 'PICKUP_PENDING') {
    aoDaiCurrentIdx = 1;
  } else if (rawStatus === 'PICKED_UP' || rawStatus === 'IN_PROGRESS' || rawStatus === 'AWAITING_REVIEW') {
    aoDaiCurrentIdx = 2;
  } else if (rawStatus === 'COMBO_PHOTOS_APPROVED') {
    if (allRentalsReturned) {
      aoDaiCurrentIdx = 3;
    } else if (allRentalsRequested) {
      aoDaiCurrentIdx = 3;
    } else {
      aoDaiCurrentIdx = 2;
    }
  } else if (rawStatus === 'RETURN_PENDING' || rawStatus === 'RETURNED') {
    aoDaiCurrentIdx = 3;
  }

  const aoDaiStepsConfig = ['Chuẩn bị', 'Chờ nhận', 'Đang thuê', 'Nhận lại', 'Hoàn tất'];
  const aoDaiSubsteps = aoDaiStepsConfig.map((label, idx) => {
    if (isOrderCompleted || idx < aoDaiCurrentIdx) return { label, status: 'done' as const };
    if (idx === aoDaiCurrentIdx) return { label, status: 'active' as const };
    return { label, status: 'pending' as const };
  });

  let photoCurrentIdx = 1;
  if (isOrderCompleted) photoCurrentIdx = 5;
  else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_PAYMENT' || rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED' || rawStatus === 'PICKUP_PENDING') photoCurrentIdx = 0;
  else if (rawStatus === 'PICKED_UP') photoCurrentIdx = 0;
  else if (rawStatus === 'IN_PROGRESS') photoCurrentIdx = 1;
  else if (rawStatus === 'AWAITING_REVIEW') photoCurrentIdx = 2;
  else if (rawStatus === 'COMBO_PHOTOS_APPROVED') photoCurrentIdx = 3;
  else if (rawStatus === 'RETURN_PENDING' || rawStatus === 'RETURNED') photoCurrentIdx = (order.photosApproved ? 4 : 2);

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

  const handleConfirmOrder = async () => {
    if (isConfirming) return;
    try {
      setIsConfirming(true);
      await changeOrderStatus(order._id, 'CONFIRMED');
      if (onSelectOrder) {
        onSelectOrder({
          ...order,
          rawStatus: 'CONFIRMED',
          status: 'ĐANG THỰC HIỆN',
          updatedDate: 'Vừa xong',
        });
      }
    } catch (err) {
      console.error('Error confirming order:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  const [isConfirmingNoIncident, setIsConfirmingNoIncident] = useState(false);
  const [isCompletingCleaning, setIsCompletingCleaning] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isReceivingReturn, setIsReceivingReturn] = useState(false);
  const [isSendingPickupEvidence, setIsSendingPickupEvidence] = useState(false);

  // Evidence is private and may be omitted from the provider booking list.
  // Reconcile it once when opening a drawer so a completed handover cannot
  // incorrectly show the upload button again after a list refresh.
  useEffect(() => {
    const targetItem = singleRentalItem || order?.items?.[0];
    if (!order?._id || !targetItem?._id || hasSubmittedPickupEvidence(targetItem)) return;
    let active = true;
    httpClient
      .get<{ pickup?: Array<{ fileId: string; type?: string; uploadedAt?: string }> }>(
        `/api/bookings/${order._id}/items/${targetItem._id}/rental/evidence`,
      )
      .then((summary) => {
        if (!active || !summary?.pickup?.length) return;
        onSelectOrderRef.current({
          ...order,
          items: (order.items || []).map((item: any) => item._id === targetItem._id
            ? {
                ...item,
                rentalFulfillment: {
                  ...item.rentalFulfillment,
                  pickupEvidence: { files: summary.pickup },
                },
              }
            : item),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [order?._id, singleRentalItem?._id]);

  const handleMarkItemReady = async (item: any) => {
    if (!order?._id || !item?._id) return;
    if (item.rentalFulfillment?.status && item.rentalFulfillment?.status !== 'PENDING') {
      toast.info('Áo dài này đã ở trạng thái sẵn sàng bàn giao.');
      return;
    }
    setIsMarkingReady(true);
    try {
      await httpClient.post(`/api/bookings/${order._id}/items/${item._id}/rental/ready`, {});
      toast.success(`Đã chuẩn bị áo "${item.productName || item.product?.name || 'trang phục'}" xong!`);
      if (fetchOrders) await fetchOrders(true, true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Không thể cập nhật chuẩn bị áo');
    } finally {
      setIsMarkingReady(false);
    }
  };

  const handleMarkReady = async () => {
    if (!order?._id) return;
    const pendingRentalItems = rentalItems.filter(
      (it: any) => !it.rentalFulfillment?.status || it.rentalFulfillment?.status === 'PENDING'
    );
    if (pendingRentalItems.length === 0) {
      toast.info('Tất cả trang phục trong đơn đã được chuẩn bị xong.');
      return;
    }
    setIsMarkingReady(true);
    try {
      await Promise.all(
        pendingRentalItems.map((item: any) =>
          httpClient.post(`/api/bookings/${order._id}/items/${item._id}/rental/ready`, {})
        )
      );
      toast.success(
        pendingRentalItems.length > 1
          ? `Đã chuẩn bị xong ${pendingRentalItems.length} áo dài! Sẵn sàng bàn giao cho khách.`
          : 'Đã chuẩn bị áo xong! Sẵn sàng bàn giao cho khách.'
      );
      if (fetchOrders) await fetchOrders(true, true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Không thể cập nhật chuẩn bị áo');
    } finally {
      setIsMarkingReady(false);
    }
  };

  const handleViewCccd = async (bookingId: string) => {
    try {
      Swal.fire({
        title: 'Đang tải ảnh CCCD...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const res: any = await httpClient.get(`/api/bookings/${bookingId}/customer-identity`);
      if (!res?.hasIdentityCard) {
        Swal.fire({
          icon: 'info',
          title: 'Chưa có ảnh CCCD',
          text: 'Khách hàng chưa tải ảnh CCCD lên đơn hàng này. Vui lòng nhắc khách tải CCCD tại mục "Lịch của tôi > Thuê áo dài" trước khi bàn giao.',
          confirmButtonColor: '#881337',
        });
        return;
      }
      let frontUrl = '';
      let backUrl = '';
      if (res.hasFrontImage) {
        const frontBlob = await httpClient.getBlob(`/api/bookings/${bookingId}/customer-identity/image/front`);
        frontUrl = URL.createObjectURL(frontBlob);
      }
      if (res.hasBackImage) {
        const backBlob = await httpClient.getBlob(`/api/bookings/${bookingId}/customer-identity/image/back`);
        backUrl = URL.createObjectURL(backBlob);
      }

      Swal.fire({
        width: '560px',
        padding: '22px 24px 24px',
        html: `
          <div style="text-align: left; font-family: inherit; color: #1E293B;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 38px; height: 38px; border-radius: 10px; background: #FFF1F2; color: #881337; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 16.5px; font-weight: 800; color: #0F172A;">Căn cước công dân khách thuê</h3>
                  <p style="margin: 2px 0 0; font-size: 12px; color: #64748B;">Hồ sơ đối soát mã hóa AES-256 • Che bảo mật mặc định</p>
                </div>
              </div>
              <button type="button" id="toggle-provider-cccd-blur" style="background: #FFF1F2; border: 1px solid #FECDD3; color: #881337; border-radius: 8px; padding: 6px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                👁 Hiện rõ để đối soát
              </button>
            </div>

            <div style="background: #F8FAFC; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid #E2E8F0; font-size: 12.5px;">
              <div><strong>Họ và tên:</strong> ${res.fullName || order.customerName || 'Khách thuê'}</div>
              <div style="font-size: 11.5px; color: #059669; margin-top: 4px;">🔒 Bảo mật theo Nghị định 13/2023/NĐ-CP — Chỉ dùng đối soát đơn thuê giữa Shop &amp; Sàn TàGo.</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              ${frontUrl ? `
                <div class="provider-cccd-mask-box" style="position: relative; height: 150px; border-radius: 10px; overflow: hidden; border: 1.5px solid #CBD5E1; background: #0F172A; cursor: pointer;">
                  <img class="provider-cccd-mask-img" src="${frontUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(11px); transform: scale(1.06); transition: filter 0.2s ease, transform 0.2s ease;" />
                  <div class="provider-cccd-mask-overlay" style="position: absolute; inset: 0; background: rgba(15,23,42,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFF; font-size: 11.5px; font-weight: 700; text-align: center; padding: 8px;">
                    <span>🔒 Đã che bảo mật</span>
                    <span style="font-size: 10.5px; font-weight: 500; opacity: 0.9; margin-top: 2px;">Bấm để đối soát</span>
                  </div>
                  <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.68); color: #fff; font-size: 11px; font-weight: 600; text-align: center; padding: 3px;">Mặt trước</div>
                </div>
              ` : '<div style="color: #9CA3AF; font-size: 12px; padding: 20px; text-align: center; border: 1px dashed #CBD5E1; border-radius: 10px;">Chưa có mặt trước</div>'}
              ${backUrl ? `
                <div class="provider-cccd-mask-box" style="position: relative; height: 150px; border-radius: 10px; overflow: hidden; border: 1.5px solid #CBD5E1; background: #0F172A; cursor: pointer;">
                  <img class="provider-cccd-mask-img" src="${backUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(11px); transform: scale(1.06); transition: filter 0.2s ease, transform 0.2s ease;" />
                  <div class="provider-cccd-mask-overlay" style="position: absolute; inset: 0; background: rgba(15,23,42,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFF; font-size: 11.5px; font-weight: 700; text-align: center; padding: 8px;">
                    <span>🔒 Đã che bảo mật</span>
                    <span style="font-size: 10.5px; font-weight: 500; opacity: 0.9; margin-top: 2px;">Bấm để đối soát</span>
                  </div>
                  <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.68); color: #fff; font-size: 11px; font-weight: 600; text-align: center; padding: 3px;">Mặt sau</div>
                </div>
              ` : '<div style="color: #9CA3AF; font-size: 12px; padding: 20px; text-align: center; border: 1px dashed #CBD5E1; border-radius: 10px;">Chưa có mặt sau</div>'}
            </div>
          </div>
        `,
        confirmButtonText: 'Đóng',
        confirmButtonColor: '#881337',
        didOpen: (popup) => {
          let revealed = false;
          const toggleBtn = popup.querySelector('#toggle-provider-cccd-blur') as HTMLButtonElement | null;
          const applyState = () => {
            popup.querySelectorAll('.provider-cccd-mask-img').forEach((el) => {
              const img = el as HTMLElement;
              img.style.filter = revealed ? 'none' : 'blur(11px)';
              img.style.transform = revealed ? 'scale(1)' : 'scale(1.06)';
            });
            popup.querySelectorAll('.provider-cccd-mask-overlay').forEach((el) => {
              (el as HTMLElement).style.display = revealed ? 'none' : 'flex';
            });
            if (toggleBtn) {
              toggleBtn.textContent = revealed ? '🙈 Che lại' : '👁 Hiện rõ để đối soát';
            }
          };
          toggleBtn?.addEventListener('click', () => {
            revealed = !revealed;
            applyState();
          });
          popup.querySelectorAll('.provider-cccd-mask-box').forEach((box) => {
            box.addEventListener('click', () => {
              revealed = !revealed;
              applyState();
            });
          });
        },
        didClose: () => {
          if (frontUrl) URL.revokeObjectURL(frontUrl);
          if (backUrl) URL.revokeObjectURL(backUrl);
        },
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: err?.message || 'Không thể tải ảnh CCCD.' });
    }
  };

  const handleConfirmLostItem = async (bookingId: string) => {
    try {
      const result = await Swal.fire({
        title: 'Xác nhận mất trang phục (LOST_ITEM)?',
        html: `
          <div style="text-align: left; font-size: 13px; color: #374151;">
            <p style="color: #991B1B; font-weight: 600; margin-bottom: 10px;">
              ⚠️ Cảnh báo: Thao tác này sẽ áp dụng chế tài nghiêm ngặt đối với khách thuê:
            </p>
            <ul style="padding-left: 18px; margin-bottom: 12px; line-height: 1.6; color: #4B5563;">
              <li>Tịch thu toàn bộ tiền cọc chuyển vào ví thanh toán của Shop.</li>
              <li>Khóa vĩnh viễn tài khoản của khách (Blacklist).</li>
              <li>Trang phục sẽ được ẩn khỏi kho để không nhận đơn mới.</li>
              <li>Hồ sơ CCCD và hợp đồng điện tử có chữ ký SHA-256 được lưu vết để chuyển cơ quan chức năng theo Điều 175 BLHS nếu cần thiết.</li>
            </ul>
            <div style="margin-bottom: 10px;">
              <label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #1E293B;">
                Số lần đã liên hệ khách thất bại (tối thiểu 3 lần):
              </label>
              <input id="lost-contact-count" type="number" min="3" value="3" style="width: 100%; padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #1E293B;">
                Ghi chú / Lý do mất đồ:
              </label>
              <textarea id="lost-reason-note" placeholder="Ví dụ: Gọi 3 lần thuê bao không liên lạc được, quá 24h không trả áo." rows="3" style="width: 100%; padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 12px; box-sizing: border-box;"></textarea>
            </div>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#DC2626',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'Xác nhận Mất đồ & Tịch thu cọc',
        cancelButtonText: 'Hủy',
        preConfirm: () => {
          const countInput = document.getElementById('lost-contact-count') as HTMLInputElement | null;
          const noteInput = document.getElementById('lost-reason-note') as HTMLTextAreaElement | null;
          const count = Number(countInput?.value || 3);
          if (count < 3) {
            Swal.showValidationMessage('Theo quy chế sàn TàGo, Shop phải liên hệ khách tối thiểu 3 lần!');
            return false;
          }
          return {
            contactAttempts: count,
            reason: noteInput?.value?.trim() || 'Khách không trả áo và không thể liên lạc được.',
          };
        },
      });

      if (!result.isConfirmed || !result.value) return;

      Swal.fire({
        title: 'Đang xử lý tịch thu cọc & chế tài...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await httpClient.post(`/api/bookings/${bookingId}/overdue/confirm-lost`, result.value);
      toast.success('Đã xác nhận mất trang phục và tịch thu tiền cọc chuyển vào ví Shop!');
      Swal.close();

      if (fetchOrders) await fetchOrders(true, true);
      try {
        const fresh: any = await httpClient.get(`/api/bookings/${bookingId}`);
        if (fresh && onSelectOrderRef.current) {
          onSelectOrderRef.current({
            ...order,
            ...fresh,
            rawStatus: fresh.status || 'LOST_ITEM',
            overdueTracking: fresh.overdueTracking || (order as any).overdueTracking || null,
            dominoRecovery: fresh.dominoRecovery || (order as any).dominoRecovery || null,
          });
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: err?.response?.data?.message || err?.message || 'Không thể xác nhận mất đồ.',
      });
    }
  };

  const handleSimulateOverdue = async (bookingId: string) => {
    try {
      const res = await Swal.fire({
        title: '⚡ Demo: Giả lập đơn quá hạn',
        html: `
          <div style="text-align: left; font-size: 13px; color: #374151; line-height: 1.5;">
            <p style="margin: 0 0 12px;">Chọn mốc thời gian trễ để kiểm thử ngay luồng phạt quá hạn (+10% tiền cọc / 30 phút, trần 50% cọc) trước Hội đồng:</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 8px; cursor: pointer; background: #FFFBEB;">
                <input type="radio" name="sim-hours" value="1" checked />
                <span><strong>Trễ 1 giờ (T+1h)</strong> — Tính phạt quá hạn, chưa khóa tài khoản</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 8px; cursor: pointer; background: #FEF2F2;">
                <input type="radio" name="sim-hours" value="3" />
                <span><strong>Trễ 3 giờ (T+3h)</strong> — Phạt chạm trần + Khóa quyền đặt đơn mới</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 8px; cursor: pointer; background: #FEF2F2;">
                <input type="radio" name="sim-hours" value="25" />
                <span><strong>Trễ 25 giờ (T+25h)</strong> — Kích hoạt đề xuất Mất đồ (LOST_ITEM)</span>
              </label>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#D97706',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'Chạy giả lập ngay',
        cancelButtonText: 'Hủy',
        preConfirm: () => {
          const checked = document.querySelector('input[name="sim-hours"]:checked') as HTMLInputElement | null;
          return Number(checked?.value || 1);
        },
      });
      if (!res.isConfirmed) return;

      Swal.fire({
        title: 'Đang giả lập & quét phạt...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const simRes: any = await httpClient.post(`/api/bookings/${bookingId}/overdue/simulate`, {
        hoursOverdue: res.value,
      });

      if (fetchOrders) await fetchOrders(true, true);
      try {
        const fresh: any = await httpClient.get(`/api/bookings/${bookingId}`);
        if (fresh && onSelectOrderRef.current) {
          onSelectOrderRef.current({
            ...order,
            ...fresh,
            rawStatus: fresh.status || 'COMPLETED',
            overdueTracking: fresh.overdueTracking || null,
            dominoRecovery: fresh.dominoRecovery || (order as any).dominoRecovery || null,
          });
        }
      } catch {
        // ignore
      }

      const fee = simRes?.overdueTracking?.calculatedLateFee || 0;
      await Swal.fire({
        icon: 'warning',
        title: 'Đã kích hoạt trạng thái QUÁ HẠN!',
        text: `Đơn hàng đã chuyển OVERDUE. Phí phạt hiện tại: ${fee.toLocaleString('vi-VN')}đ.`,
        confirmButtonColor: '#881337',
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Không thể giả lập',
        text: err?.response?.data?.message || err?.message || 'Chỉ hỗ trợ ở môi trường Demo/Dev.',
      });
    }
  };

  const handleSubmitPickupEvidence = async () => {
    if (!order?._id) return;
    const targetItem = singleRentalItem || order.items?.[0];
    if (!targetItem?._id) return;
    if (isSendingPickupEvidence || (rentalItems.length > 0 && allRentalHandoverEvidenceSubmitted)) return;

    let cccdData: any = null;
    try {
      cccdData = await httpClient.get(`/api/bookings/${order._id}/customer-identity`);
    } catch {
      // ignore
    }
    const hasCccd = Boolean(cccdData?.hasIdentityCard);

    const result = await Swal.fire({
      title: 'Bàn giao áo dài tại quầy',
      html: `
        <div style="text-align: left; font-size: 13px;">
          ${hasCccd ? `
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 12px; color: #166534; display: flex; align-items: center; justify-content: space-between;">
              <span>✅ <strong>Khách đã tải CCCD:</strong> ${cccdData?.idNumberMasked || '*** (Đã xác thực)'}</span>
              <span style="font-size: 11px; background: #DCFCE7; padding: 2px 6px; border-radius: 4px;">Đã xác thực</span>
            </div>
          ` : `
            <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 12px; color: #92400E;">
              ⚠️ <strong>Khách chưa tải ảnh CCCD trên ứng dụng.</strong> Vui lòng nhắc khách mở mục <em>Lịch của tôi &gt; Thuê áo dài</em> để tải CCCD trước khi xác nhận bàn giao.
            </div>
          `}

          <strong style="color: #1F2937; font-size: 12.5px; display: block; margin-bottom: 6px;">
            👗 Ảnh tình trạng áo dài lúc bàn giao *
          </strong>
          <p style="margin: -2px 0 10px; color: #6b7280; font-size: 12px; line-height: 1.4;">
            Chụp rõ áo và phụ kiện trước khi bàn giao. Khách sẽ xem ảnh này để xác nhận nhận áo.
          </p>
          <label for="pickup-evidence-input" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 110px; padding: 14px; border: 1.5px dashed #b98a94; border-radius: 12px; background: #fff8f8; cursor: pointer; box-sizing: border-box;">
            <span style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #fbe9ed; color: #8e1b2e;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
            <strong style="margin-top: 8px; color: #4a2430; font-size: 13px;">Chọn ảnh áo bàn giao từ thiết bị</strong>
            <span style="margin-top: 4px; color: #8c827a; font-size: 11px;">JPG, PNG hoặc WEBP • Tối đa 5 ảnh</span>
            <input id="pickup-evidence-input" type="file" accept="image/jpeg,image/png,image/webp" multiple style="display: none;" />
          </label>
          <div id="pickup-evidence-summary" style="min-height: 20px; margin-top: 8px;"></div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Gửi ảnh bàn giao',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#881337',
      cancelButtonColor: '#6b7280',
      buttonsStyling: true,
      didOpen: () => {
        const input = document.getElementById('pickup-evidence-input') as HTMLInputElement | null;
        const summary = document.getElementById('pickup-evidence-summary');
        input?.addEventListener('change', () => {
          if (!summary) return;
          const files = Array.from(input.files || []);
          summary.innerHTML = '';
          if (!files.length) return;

          const label = document.createElement('div');
          label.textContent = `Đã chọn ${files.length} ảnh áo bàn giao`;
          label.style.cssText = 'margin: 2px 0 9px; color: #8e1b2e; font-size: 12px; font-weight: 700; text-align: center;';
          summary.appendChild(label);

          const previews = document.createElement('div');
          previews.style.cssText = 'display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;';
          files.forEach((file) => {
            const thumbnail = document.createElement('img');
            thumbnail.src = URL.createObjectURL(file);
            thumbnail.alt = file.name;
            thumbnail.title = file.name;
            thumbnail.style.cssText = 'width: 58px; height: 58px; object-fit: cover; border-radius: 9px; border: 2px solid #f1c9d1; box-shadow: 0 2px 5px rgba(80, 20, 35, .12);';
            previews.appendChild(thumbnail);
          });
          summary.appendChild(previews);
        });
      },
      preConfirm: () => {
        const input = document.getElementById('pickup-evidence-input') as HTMLInputElement | null;
        const files = Array.from(input?.files || []);
        if (!files.length) {
          Swal.showValidationMessage('Vui lòng chọn ít nhất một ảnh bàn giao áo dài.');
          return false;
        }
        if (files.length > 5) {
          Swal.showValidationMessage('Tối đa 5 ảnh cho một lần bàn giao.');
          return false;
        }

        return {
          evidenceFiles: files,
        };
      },
    });
    if (!result.isConfirmed || !result.value) return;

    setIsSendingPickupEvidence(true);
    try {
      const { evidenceFiles } = result.value;

      const pendingHandoverItems = rentalItems.filter(
        (it: any) => !locallySubmittedPickupIds.has(it._id) && !hasSubmittedPickupEvidence(it)
      );
      const itemsToSubmit = pendingHandoverItems.length > 0 ? pendingHandoverItems : [targetItem];

      let lastFileIds: string[] = [];
      for (const item of itemsToSubmit) {
        const formData = new FormData();
        evidenceFiles.forEach((file: File) => formData.append('images', file));
        const uploaded = await httpClient.post<{ files: Array<{ fileId: string }> }>(
          `/api/bookings/${order._id}/items/${item._id}/rental/evidence`,
          formData,
        );
        const fileIds = (uploaded.files || []).map((file) => file.fileId);
        lastFileIds = fileIds;
        await httpClient.post(`/api/bookings/${order._id}/items/${item._id}/rental/picked-up`, {
          fileIds,
        });
        setLocallySubmittedPickupIds((previous) => new Set(previous).add(item._id));
      }

      toast.success('Đã gửi ảnh bàn giao. Đang chờ khách xác nhận nhận áo.');
      onSelectOrderRef.current({
        ...order,
        handoverPhotos: lastFileIds,
        items: (order.items || []).map((item: any) =>
          itemsToSubmit.some((sub: any) => sub._id === item._id)
            ? {
                ...item,
                rentalFulfillment: {
                  ...item.rentalFulfillment,
                  pickupEvidence: { files: lastFileIds.map((fileId) => ({ fileId })) },
                },
              }
            : item
        ),
      });
      await fetchOrders?.(true, true);
      const fresh = await httpClient.get<any>(`/api/bookings/${order._id}`);
      if (fresh?.items?.some(hasSubmittedPickupEvidence)) onSelectOrderRef.current(fresh);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể gửi ảnh bàn giao.');
    } finally {
      setIsSendingPickupEvidence(false);
    }
  };

  const handleReceiveReturn = async (itemToProcess?: any) => {
    if (!order?._id) return;
    const targetItem = itemToProcess || singleRentalItem || order.items?.[0];
    if (!targetItem?._id) return;
    if (isReceivingReturn || locallyReturnedIds.has(targetItem._id)) return;

    const result = await Swal.fire({
      title: 'Xác nhận đã nhận lại áo dài',
      text: 'Xác nhận shop đã nhận lại áo để kiểm tra. Không cần gửi ảnh ở bước này. Nếu phát hiện hư hỏng hoặc thiếu phụ kiện, hãy chọn “Yêu cầu đền bù” ở bước kế tiếp và gửi ảnh bằng chứng khi đó.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#881337',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Xác nhận đã nhận & Kiểm tra',
      cancelButtonText: 'Đóng',
      background: 'white',
    });

    if (!result.isConfirmed) return;

    setIsReceivingReturn(true);
    try {
      await httpClient.post(
        `/bookings/${order._id}/items/${targetItem._id}/rental/returned`,
        { fileIds: [], note: 'Shop đã nhận lại áo và bắt đầu kiểm tra' }
      );

      toast.success('Đã xác nhận nhận lại áo! Hãy kiểm tra kỹ trang phục và chọn Hoàn cọc hoặc Yêu cầu đền bù.');
      setLocallyReturnedIds((previous) => new Set(previous).add(targetItem._id));
      if (fetchOrders) {
        await fetchOrders(true, true);
      }
      const fresh = await httpClient.get<any>('/api/bookings/' + order._id);
      if (fresh && onSelectOrderRef.current) {
        onSelectOrderRef.current(fresh);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Xác nhận nhận lại áo thất bại');
    } finally {
      setIsReceivingReturn(false);
    }
  };

  const handleConfirmNoIncident = async (itemToProcess?: any) => {
    const targetItem = itemToProcess || singleRentalItem;
    if (!order?._id || !targetItem?._id) return;
    if (isConfirmingNoIncident || locallySettledIds.has(targetItem._id)) return;

    const res = await Swal.fire({
      title: 'Xác nhận không có sự cố?',
      text: 'Áo dài và phụ kiện nguyên vẹn. Hệ thống sẽ tạo yêu cầu hoàn cọc cho khách hàng và chuyển trang phục sang trạng thái Giặt ủi (CLEANING).',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✓ Xác nhận hoàn cọc',
      cancelButtonText: 'Kiểm tra lại',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
    });

    if (!res.isConfirmed) return;

    setIsConfirmingNoIncident(true);
    try {
      await httpClient.post(
        `/api/bookings/${order._id}/items/${targetItem._id}/rental/confirm-no-incident`,
        { note: 'Không có sự cố từ thanh tác vụ nhanh' }
      );
      toast.success('Đã xác nhận không có sự cố và hoàn tất thủ tục hoàn cọc cho khách hàng!');
      setLocallySettledIds((previous) => new Set(previous).add(targetItem._id));
      if (fetchOrders) {
        await fetchOrders(true, true);
      }
      try {
        const fresh = await httpClient.get<any>('/api/bookings/' + order._id);
        if (fresh && onSelectOrderRef.current) {
          onSelectOrderRef.current(fresh);
        }
      } catch (e) {
        console.warn('Failed to refetch fresh booking:', e);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể xác nhận hoàn cọc.');
    } finally {
      setIsConfirmingNoIncident(false);
    }
  };

  const handleReceiveAllRentalReturns = async () => {
    if (!order?._id || !rentalItems.length) return;
    const pendingReturns = rentalItems.filter(
      (item) => !['RETURNED', 'COMPLETED'].includes(item.rentalFulfillment?.status),
    );
    if (!pendingReturns.length) return;

    const result = await Swal.fire({
      title: 'Xác nhận đã nhận lại áo dài',
      text: 'Xác nhận shop đã nhận lại áo để kiểm tra. Không cần gửi ảnh ở bước này. Nếu phát hiện hư hỏng hoặc thiếu phụ kiện, hãy chọn “Yêu cầu đền bù” ở bước kế tiếp và gửi ảnh bằng chứng khi đó.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#881337',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Xác nhận đã nhận & Kiểm tra',
      cancelButtonText: 'Đóng',
      background: 'white',
    });

    if (!result.isConfirmed) return;

    setIsReceivingReturn(true);
    try {
      for (const item of pendingReturns) {
        await httpClient.post(
          `/bookings/${order._id}/items/${item._id}/rental/returned`,
          { fileIds: [], note: 'Shop đã nhận lại áo và bắt đầu kiểm tra' }
        );
        setLocallyReturnedIds((prev) => new Set(prev).add(item._id));
      }
      toast.success('Đã xác nhận nhận lại áo! Hãy kiểm tra kỹ trang phục và chọn Hoàn cọc hoặc Yêu cầu đền bù.');
      if (fetchOrders) await fetchOrders(true, true);
      const fresh = await httpClient.get<any>('/api/bookings/' + order._id);
      if (fresh && onSelectOrderRef.current) {
        onSelectOrderRef.current(fresh);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể xác nhận nhận lại áo.');
    } finally {
      setIsReceivingReturn(false);
    }
  };

  const handleCleaningCompleted = async (itemToProcess?: any) => {
    const targetItem = itemToProcess || singleRentalItem;
    if (!order?._id || !targetItem?._id) return;

    const res = await Swal.fire({
      title: 'Hoàn tất giặt ủi sớm?',
      text: 'Xác nhận đã giặt ủi xong trang phục này sớm hơn dự kiến? Trang phục sẽ chuyển sang trạng thái SẴN SÀNG (AVAILABLE) và giải phóng các khung giờ đệm còn lại.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✓ Xác nhận giặt xong',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
    });

    if (!res.isConfirmed) return;

    setIsCompletingCleaning(true);
    try {
      await httpClient.post(
        `/api/bookings/${order._id}/items/${targetItem._id}/rental/cleaning-completed`,
        { note: 'Hoàn tất giặt ủi sớm từ thanh tác vụ nhanh' }
      );
      toast.success('Đã hoàn tất giặt ủi sớm, trang phục đã sẵn sàng cho lượt thuê tiếp theo!');
      if (fetchOrders) {
        await fetchOrders(true, true);
      }
      try {
        const fresh = await httpClient.get<any>('/api/bookings/' + order._id);
        if (fresh && onSelectOrderRef.current) {
          onSelectOrderRef.current(fresh);
        }
      } catch (e) {
        console.warn('Failed to refetch fresh booking:', e);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể hoàn tất giặt ủi.');
    } finally {
      setIsCompletingCleaning(false);
    }
  };

  const photoPackageImg = 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=300&q=80';

  // Dynamic progress info & time remaining computation
  const progressInfo = useMemo(() => {
    if (isOrderCompleted) {
      return {
        step: `${masterSteps.length}/${masterSteps.length}`,
        percent: 100,
        title: 'Tiến độ thực hiện (100%)',
        desc: isAoDai
          ? 'Đã hoàn tất quy trình thuê và tất toán cọc cho khách hàng.'
          : isPhoto
            ? 'Đã hoàn tất nghiệm thu bộ ảnh chất lượng cao.'
            : 'Đã hoàn tất trọn vẹn cả dịch vụ thuê áo và chụp ảnh.',
        deadlineNum: 'Hoàn tất',
        deadlineColor: '#059669',
        deadlineTitle: 'Trạng thái đơn',
        deadlineDesc: 'Đơn hàng đã kết thúc thành công đúng cam kết chất lượng.',
      };
    }
    if (rawStatus === 'CANCELLED' || isCancelled) {
      return {
        step: '0/5',
        percent: 0,
        title: 'Đơn đã hủy',
        desc: cancellationReason ? `Lý do: "${cancellationReason}"` : 'Đơn hàng đã bị hủy, không còn hiệu lực thực hiện.',
        deadlineNum: 'Đã hủy',
        deadlineColor: '#DC2626',
        deadlineTitle: 'Trạng thái đơn',
        deadlineDesc: cancellationReason ? `Lý do: ${cancellationReason}` : 'Đơn hàng đã dừng quy trình.',
      };
    }

    // Compute remaining time from real dates
    const primaryItem = order.items?.[0];
    const targetDateStr = getRentalTo(primaryRentalItem) || order.endDate || primaryItem?.shootDate;
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

    const totalStepCount = masterSteps.length;
    const stepNum = isOrderCompleted ? totalStepCount : Math.min(totalStepCount, activeMasterIndex + 1);
    const pct = Math.round((stepNum / totalStepCount) * 100);

    const descMapAoDai = [
      'Đơn hàng đã được xác nhận, tiền cọc được bảo chứng an toàn qua Escrow.',
      'Cửa hàng đang kiểm tra chất lượng, ủi phẳng và chuẩn bị trang phục.',
      'Khách hàng đã nhận đồ và đang trong thời gian thuê trải nghiệm.',
      'Khách hàng mang trang phục đến hoàn trả tại cửa hàng.',
      'Cửa hàng kiểm tra đối soát tình trạng đồ để tất toán hoàn cọc.',
      'Đã hoàn tất quy trình thuê và tất toán cọc cho khách hàng.',
    ];

    const descMapPhoto = [
      'Đơn chụp ảnh đã xác nhận lịch hẹn, cọc giữ chỗ an toàn qua Escrow.',
      'Nhiếp ảnh gia đang trong quá trình thực hiện buổi chụp.',
      'Đã chụp xong, đang chọn lọc và tải lên bộ ảnh gốc.',
      'Đang chờ khách hàng duyệt và chọn ảnh để hoàn thiện hậu kỳ.',
      'Đã hoàn tất nghiệm thu bộ ảnh chất lượng cao.',
    ];

    const descMapCombo = [
      'Đơn Combo đã xác nhận cọc, chuẩn bị thực hiện dịch vụ.',
      'Cửa hàng đang chuẩn bị trang phục áo dài cho buổi chụp.',
      'Khách đã nhận trang phục để chuẩn bị cho buổi chụp.',
      'Nhiếp ảnh gia đang thực hiện buổi chụp ngoại cảnh với áo dài.',
      'Đã tải bộ ảnh lên hệ thống để khách hàng chọn ảnh.',
      'Khách hàng hoàn trả trang phục sau buổi chụp.',
      'Kiểm tra tình trạng trang phục và nghiệm thu ảnh.',
      'Đã hoàn tất trọn vẹn cả dịch vụ thuê áo và chụp ảnh.',
    ];

    const currentDesc = isAoDai
      ? (descMapAoDai[activeMasterIndex] || 'Đang thực hiện đúng cam kết chất lượng.')
      : isPhoto
        ? (descMapPhoto[activeMasterIndex] || 'Đang thực hiện đúng cam kết chất lượng.')
        : (descMapCombo[activeMasterIndex] || 'Đang thực hiện đúng cam kết chất lượng.');

    return {
      step: `${stepNum}/${totalStepCount}`,
      percent: pct,
      title: `Tiến độ thực hiện (${pct}%)`,
      desc: currentDesc,
      deadlineNum,
      deadlineColor,
      deadlineTitle,
      deadlineDesc,
    };
  }, [isOrderCompleted, rawStatus, isAoDai, isPhoto, masterSteps, activeMasterIndex, order]);

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
        ? `Hệ thống xác nhận đã nhận cọc ${depositAmt > 0 ? `${depositAmt.toLocaleString('vi-VN')}đ` : 'giữ chỗ'} qua TàGo Escrow QR.`
        : `Đang chờ khách hàng thanh toán cọc ${depositAmt > 0 ? `${depositAmt.toLocaleString('vi-VN')}đ` : ''} qua TàGo Escrow.`,
      icon: CheckCircle,
      color: '#10B981',
      bg: '#ECFDF5',
      badgeText: isPaid ? '✓ Đã cọc Escrow' : '⏳ Chờ thanh toán',
      badgeColor: isPaid ? '#059669' : '#D97706',
      badgeBg: isPaid ? '#ECFDF5' : '#FFFBEB',
    });

    if (isAoDai || isCombo) {
      // 2. Mốc 2: Chuẩn bị trang phục tại cửa hàng
      const isReady = Boolean(rf?.readyAt) || ['PICKUP_PENDING', 'PICKED_UP', 'IN_PROGRESS', 'OVERDUE', 'AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(rawStatus);
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
      const isPickedUp = Boolean(rf?.pickedUpAt) || ['PICKED_UP', 'IN_PROGRESS', 'OVERDUE', 'AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED', 'RETURN_PENDING', 'RETURNED', 'COMPLETED'].includes(rawStatus);
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
        ? `Đơn hàng đã hoàn tất thành công trọn vẹn. Hệ thống TàGo Escrow đã giải ngân doanh thu cho nhà cung cấp${rf?.depositRefundAmount ? ` và hoàn lại ${rf.depositRefundAmount.toLocaleString('vi-VN')}đ cọc cho khách hàng.` : '.'}`
        : 'Khách hàng nghiệm thu dịch vụ và hệ thống TàGo Escrow tự động giải ngân doanh thu cho nhà cung cấp.',
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
                    {order.id || `#TG-${order._id.slice(-5).toUpperCase()}`}
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
                      backgroundColor: isCancelled ? '#FEF2F2' : isOrderCompleted ? '#ECFDF5' : '#EFF6FF',
                      color: isCancelled ? '#DC2626' : isOrderCompleted ? '#059669' : '#1D4ED8',
                      border: `1px solid ${isCancelled ? '#FECACA' : isOrderCompleted ? '#A7F3D0' : '#BFDBFE'}`,
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isCancelled ? '#DC2626' : isOrderCompleted ? '#059669' : '#2563EB' }} />
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
              <span className="val">{order.id || `#TG-${order._id.slice(-5).toUpperCase()}`}</span>
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
            {rentalFrom && (
              <div className="p-dh-item">
                <span className="label">Ngày nhận đồ:</span>
                <span className="val">{formatBookingDate(rentalFrom) || '—'}</span>
              </div>
            )}
            {rentalTo && (
              <div className="p-dh-item">
                <span className="label">Ngày trả đồ:</span>
                <span className="val">{formatBookingDate(rentalTo) || '—'}</span>
              </div>
            )}
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

                {/* Staff Assignment & Read-Only Chat Supervision */}
                {photoSchedule && (
                  <OrderStaffAssignmentCard
                    orderId={order._id}
                    bookingStatus={rawStatus}
                    schedule={photoSchedule}
                    toast={toast}
                    onOrderRefreshed={onSelectOrder}
                    fetchOrders={fetchOrders}
                  />
                )}

                {/* Cancellation Detail Box */}
                {isCancelled && (
                  <div
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1.5px solid #FECACA',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <XCircle size={18} color="#DC2626" />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#991B1B' }}>
                          Chi tiết hủy đơn hàng
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          border: '1px solid #FECACA',
                        }}
                      >
                        ĐÃ HỦY ĐƠN
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: '#7F1D1D', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <strong>Đối tượng hủy:</strong>{' '}
                        {cancellationReason?.includes('[KHÁCH VẮNG MẶT - NO SHOW]')
                          ? 'Nhà cung cấp (Báo cáo khách vắng mặt)'
                          : 'Khách hàng yêu cầu hủy'}
                      </div>
                      {order.cancellation?.cancelledAt && (
                        <div>
                          <strong>Thời gian hủy:</strong>{' '}
                          {formatMilestoneDateTime(order.cancellation.cancelledAt)}
                        </div>
                      )}
                    </div>

                    {/* Lý do hủy do khách hàng viết */}
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1.5px dashed #F87171',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FileText size={13} />
                        <span>Lý do hủy đơn do khách hàng viết:</span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#1F2937',
                          fontStyle: 'italic',
                          lineHeight: 1.5,
                          fontWeight: 500,
                        }}
                      >
                        &quot;{cancellationReason || 'Khách hàng không cung cấp lý do chi tiết.'}&quot;
                      </p>
                    </div>

                    {order.cancellation?.refundAmount !== undefined && order.cancellation.refundAmount !== null && (
                      <div style={{ fontSize: '12px', color: '#059669', fontWeight: 650 }}>
                        ✓ Số tiền hoàn cọc/số dư cho khách: <strong>{Number(order.cancellation.refundAmount).toLocaleString('vi-VN')}đ</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Overdue Alert Banner (Khách A) */}
                {(rawStatus === 'OVERDUE' || ((order as any).overdueTracking?.isOverdue && !['COMPLETED', 'CANCELLED', 'RETURNED', 'LOST_ITEM'].includes(rawStatus))) && (
                  <div
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1.5px solid #FCA5A5',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '14px',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={18} color="#DC2626" />
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#991B1B' }}>
                          ĐƠN THUÊ QUÁ HẠN TRẢ ÁO DÀI
                        </span>
                      </div>
                      <span
                        style={{
                          backgroundColor: '#FEE2E2',
                          color: '#B91C1C',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #FECACA',
                        }}
                      >
                        Trễ {Math.floor(((order as any).overdueTracking?.minutesOverdue || 0) / 60)}h {((order as any).overdueTracking?.minutesOverdue || 0) % 60}m
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: '#450A0A', lineHeight: 1.5, marginBottom: '12px' }}>
                      <div>• <strong>Phí quá hạn đang tính:</strong> +10% tiền cọc / 30 phút. Phạt hiện tại: <span style={{ color: '#DC2626', fontWeight: 700 }}>{((order as any).overdueTracking?.calculatedLateFee || 0).toLocaleString('vi-VN')}đ</span> (trần tối đa 50% cọc: {((order as any).overdueTracking?.maxLateFeeCap || 0).toLocaleString('vi-VN')}đ).</div>
                      <div>• <strong>Khóa quyền tạo đơn (T+2h):</strong> {(order as any).overdueTracking?.accountRestrictedAt ? <span style={{ color: '#DC2626', fontWeight: 600 }}>✓ Đã khóa tài khoản khách</span> : <span style={{ color: '#D97706' }}>Tự động khóa nếu trễ ≥ 2h</span>}</div>
                      <div>• <strong>Đề xuất mất đồ (T+24h):</strong> {(order as any).overdueTracking?.lostItemProposedAt ? <span style={{ color: '#DC2626', fontWeight: 600 }}>⚠️ Đã kích hoạt đề xuất LOST_ITEM</span> : <span style={{ color: '#6B7280' }}>Chờ kích hoạt nếu trễ ≥ 24h</span>}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => void handleConfirmLostItem(order._id)}
                        style={{
                          backgroundColor: '#DC2626',
                          color: '#FFF',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: 650,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <XCircle size={14} />
                        <span>Xác nhận mất đồ (LOST_ITEM)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed Overdue Settlement Summary Banner (Provider) */}
                {(() => {
                  const isCompletedOrder = ['COMPLETED', 'RETURNED'].includes(rawStatus);
                  const resolvedLateFee = Number(
                    (order as any).overdueTracking?.calculatedLateFee ?? order.pricingSummary?.lateFee ?? 0,
                  );
                  const wasOverdue = Boolean((order as any).overdueTracking?.isOverdue) || resolvedLateFee > 0;
                  if (!isCompletedOrder || !wasOverdue) return null;

                  const depositTotal = Number(order.pricingSummary?.depositTotal ?? 0);
                  const rawDepositRefunded = (order as any).overdueTracking?.depositRefundedAmount;
                  const resolvedDepositRefund =
                    typeof rawDepositRefunded === 'number' && rawDepositRefunded > 0
                      ? rawDepositRefunded
                      : Math.max(0, depositTotal - resolvedLateFee);
                  const minutesOverdue = Number((order as any).overdueTracking?.minutesOverdue || 0);

                  return (
                    <div
                      style={{
                        backgroundColor: '#FFFBEB',
                        border: '1.5px solid #FCD34D',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        marginBottom: '14px',
                        boxShadow: '0 2px 8px rgba(217, 119, 6, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={17} color="#D97706" />
                          <span style={{ fontSize: '13.5px', fontWeight: 750, color: '#92400E' }}>
                            ĐỐI SOÁT PHÍ QUÁ HẠN (ĐƠN ĐÃ HOÀN TẤT)
                          </span>
                        </div>
                        {minutesOverdue > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                            Trễ {Math.floor(minutesOverdue / 60)}h {minutesOverdue % 60}m
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#78350F', lineHeight: 1.55 }}>
                        <div>
                          • Đơn hàng này từng quá hạn trả áo và đã được khấu trừ{' '}
                          <strong style={{ color: '#B45309' }}>-{resolvedLateFee.toLocaleString('vi-VN')}đ</strong> tiền phạt từ tiền cọc của khách (đã cộng vào ví Shop).
                        </div>
                        <div>
                          • Phần tiền cọc còn lại đã hoàn trả về cho khách hàng:{' '}
                          <strong style={{ color: '#15803D' }}>{resolvedDepositRefund.toLocaleString('vi-VN')}đ</strong>.
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Lost Item Banner */}
                {rawStatus === 'LOST_ITEM' && (
                  <div
                    style={{
                      backgroundColor: '#450A0A',
                      color: '#FFF',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '14px',
                      boxShadow: '0 2px 10px rgba(69, 10, 10, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <XCircle size={20} color="#F87171" />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#FECACA' }}>
                        ĐƠN HÀNG ĐÃ XÁC NHẬN MẤT TRANG PHỤC (LOST_ITEM)
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#FCA5A5', lineHeight: 1.5 }}>
                      Toàn bộ tiền cọc đã được chuyển vào ví Shop để bù đắp giá trị áo dài. Tài khoản khách hàng đã bị khóa vĩnh viễn (Blacklist). Hồ sơ hợp đồng điện tử và CCCD của khách đã được lưu vết đối soát.
                    </div>
                  </div>
                )}

                {/* Domino Recovery Banner (Khách B) */}
                {(order as any).dominoRecovery?.hasConflict && (
                  <div
                    style={{
                      backgroundColor: (order as any).dominoRecovery?.status === 'SWAPPED' ? '#F0FDF4' : '#FFFBEB',
                      border: `1.5px solid ${(order as any).dominoRecovery?.status === 'SWAPPED' ? '#86EFAC' : '#FCD34D'}`,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Sparkles size={16} color={(order as any).dominoRecovery?.status === 'SWAPPED' ? '#16A34A' : '#D97706'} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: (order as any).dominoRecovery?.status === 'SWAPPED' ? '#166534' : '#92400E' }}>
                        DOMINO RECOVERY CHO KHÁCH THUÊ CA TIẾP THEO
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: (order as any).dominoRecovery?.status === 'SWAPPED' ? '#15803D' : '#78350F', lineHeight: 1.5 }}>
                      {(order as any).dominoRecovery?.status === 'SWAPPED' && (
                        <span>✓ Đã tự động điều phối chiếc áo cùng mẫu &amp; size mới tinh trống lịch cho đơn hàng này (Auto-Swap thành công).</span>
                      )}
                      {(order as any).dominoRecovery?.status === 'OFFERED' && (
                        <span>⚠️ Áo ca trước trễ hạn. Hệ thống đã mở đề xuất Top 3 mẫu tương đương cho Khách B (Đếm ngược 60 phút tự động hoàn tiền 100% nếu Shop không kịp bàn giao).</span>
                      )}
                      {(order as any).dominoRecovery?.status === 'ACCEPTED_ALTERNATIVE' && (
                        <span>✓ Khách hàng đã chọn đổi sang mẫu áo tương đương thay thế.</span>
                      )}
                      {(order as any).dominoRecovery?.status === 'REFUNDED' && (
                        <span>✓ Đơn hàng đã tự động hoàn tiền 100% cọc + phí thuê do trang phục ca trước không thể phục vụ.</span>
                      )}
                    </div>
                  </div>
                )}

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

                {/* Customer Return Evidence Alert */}
                {customerReturnEvidence && (
                  <div
                    style={{
                      backgroundColor: '#F0FDF4',
                      border: '1.5px solid #BBF7D0',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: '0 1px 3px rgba(22, 101, 52, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PackageCheck size={18} color="#166534" />
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#166534' }}>
                          Khách hàng đã báo trả áo &amp; gửi ảnh bằng chứng
                        </span>
                      </div>
                      {customerReturnEvidence.returnedAt && (
                        <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 600 }}>
                          {formatMilestoneDateTime(customerReturnEvidence.returnedAt)}
                        </span>
                      )}
                    </div>
                    {customerReturnEvidence.note && (
                      <div style={{ fontSize: '12.5px', color: '#14532D', fontStyle: 'italic', backgroundColor: '#DCFCE7', padding: '8px 12px', borderRadius: '8px' }}>
                        &ldquo;{customerReturnEvidence.note}&rdquo;
                      </div>
                    )}
                    {Array.isArray(customerReturnEvidence.files) && customerReturnEvidence.files.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>
                          Ảnh tình trạng áo khi khách trả ({customerReturnEvidence.files.length} ảnh):
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {customerReturnEvidence.files.map((photo: string, idx: number) => {
                            const url = photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedEvidenceImage(url)}
                                style={{
                                  border: '1px solid #86EFAC',
                                  borderRadius: '8px',
                                  padding: 0,
                                  background: 'none',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  width: '68px',
                                  height: '68px',
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Ảnh trả đồ ${idx + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Single Rental Cleaning In Progress Alert */}
                {isSingleRentalItem && isSingleCleaning && !isOrderCompleted && (
                  <div
                    style={{
                      backgroundColor: '#F0FDF4',
                      border: '1.5px solid #86EFAC',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(22, 101, 52, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sparkles size={20} color="#16A34A" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                          Áo dài nguyên vẹn — Tiền cọc đã được tạo lệnh hoàn trả
                        </div>
                        <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px' }}>
                          Trang phục đang trong quy trình giặt ủi (CLEANING). Bấm &ldquo;Hoàn tất giặt ủi&rdquo; để hoàn tất đơn hàng và mở lại trang phục cho thuê sớm.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-drawer-primary-btn"
                      style={{ padding: '8px 14px', fontSize: '12.5px', backgroundColor: '#059669', color: '#FFFFFF', whiteSpace: 'nowrap' }}
                      onClick={() => handleCleaningCompleted()}
                      disabled={isCompletingCleaning}
                    >
                      <Sparkles size={14} />
                      <span>{isCompletingCleaning ? 'Đang cập nhật...' : '✓ Hoàn tất giặt ủi – mở lịch sớm'}</span>
                    </button>
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
                        onClick={onOpenChat}
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
                          const startDate = getRentalFrom(primaryRentalItem);
                          const endDate = getRentalTo(primaryRentalItem);
                          if (startDate && endDate) {
                            return `${formatBookingDate(startDate)} → ${formatBookingDate(endDate)}`;
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
                    <div className="p-info-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="info-label">CCCD / Giấy tờ tùy thân</span>
                      <div className="info-val" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {identityCardInfo?.hasIdentityCard || order.customerIdentityCard?.hasIdentityCard || order.customerIdentityCard?.frontImage ? (
                            <span style={{ color: '#16A34A', fontWeight: 600, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 8px', borderRadius: '6px' }}>
                              <CheckCircle size={13} color="#16A34A" />
                              <span>
                                Đã xác thực CCCD
                                {identityCardInfo?.fullName ? ` • ${identityCardInfo.fullName}` : ''}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: '#D97706', fontSize: '12px', fontWeight: 500, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: '6px' }}>
                              Khách chưa tải CCCD
                            </span>
                          )}
                          {(identityCardInfo?.hasIdentityCard || cccdPreviewUrls.front || cccdPreviewUrls.back) && (
                            <button
                              type="button"
                              onClick={() => void handleViewCccd(order._id)}
                              style={{
                                background: '#FFF1F2',
                                border: '1px solid #FECDD3',
                                color: '#9F1239',
                                borderRadius: '6px',
                                padding: '3px 9px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Xem phóng to thông tin và ảnh CCCD đối soát bảo mật"
                            >
                              <Shield size={12} />
                              <span>Xem phóng to</span>
                            </button>
                          )}
                        </div>

                        {(cccdPreviewUrls.front || cccdPreviewUrls.back) && (
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {cccdPreviewUrls.front && (
                              <div
                                onClick={() => void handleViewCccd(order._id)}
                                title="Bấm để xem ảnh lớn"
                                style={{
                                  position: 'relative',
                                  width: '138px',
                                  height: '88px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  border: '1.5px solid #E2E8F0',
                                  backgroundColor: '#0F172A',
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                }}
                              >
                                <img
                                  src={cccdPreviewUrls.front}
                                  alt="CCCD mặt trước"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px)', transform: 'scale(1.08)' }}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#FFFFFF',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                  }}
                                >
                                  🔒 Đã che • Bấm xem
                                </div>
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'rgba(15, 23, 42, 0.72)',
                                    color: '#FFFFFF',
                                    fontSize: '10.5px',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    padding: '2px 4px',
                                  }}
                                >
                                  Mặt trước
                                </div>
                              </div>
                            )}
                            {cccdPreviewUrls.back && (
                              <div
                                onClick={() => void handleViewCccd(order._id)}
                                title="Bấm để xem ảnh lớn"
                                style={{
                                  position: 'relative',
                                  width: '138px',
                                  height: '88px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  border: '1.5px solid #E2E8F0',
                                  backgroundColor: '#0F172A',
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                }}
                              >
                                <img
                                  src={cccdPreviewUrls.back}
                                  alt="CCCD mặt sau"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px)', transform: 'scale(1.08)' }}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#FFFFFF',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                  }}
                                >
                                  🔒 Đã che • Bấm xem
                                </div>
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'rgba(15, 23, 42, 0.72)',
                                    color: '#FFFFFF',
                                    fontSize: '10.5px',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    padding: '2px 4px',
                                  }}
                                >
                                  Mặt sau
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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

                  {isCancelled && cancellationReason && (
                    <div style={{ borderTop: '1px dashed #FECACA', paddingTop: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
                        Lý do khách hủy đơn:
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#991B1B', fontStyle: 'italic', fontWeight: 600 }}>
                        &quot;{cancellationReason}&quot;
                      </p>
                    </div>
                  )}
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
                      const itemRentalFrom = getRentalFrom(item);
                      const itemRentalTo = getRentalTo(item);

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
                            {isProd && itemRentalFrom && itemRentalTo && (
                              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                                Thời gian thuê: <strong>{formatBookingDate(itemRentalFrom)}</strong> → <strong>{formatBookingDate(itemRentalTo)}</strong>
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
                              {isOrderCompleted ? '✓ Đã hoàn tất' : (item.rentalFulfillment?.status ? `Trạng thái: ${getRentalFulfillmentMeta(item.rentalFulfillment.status).label}` : 'Đang xử lý')}
                            </span>
                            {isProd && !isSingleRentalItem && !isCombo && !isOrderCompleted && (
                              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {(!item.rentalFulfillment?.status || item.rentalFulfillment?.status === 'PENDING') && (
                                  <button
                                    type="button"
                                    className="p-drawer-primary-btn"
                                    style={{ padding: '5px 10px', fontSize: '11.5px', backgroundColor: '#8E1B2E', color: '#FFFFFF' }}
                                    onClick={() => handleMarkItemReady(item)}
                                    disabled={isMarkingReady}
                                  >
                                    <Package size={12} />
                                    <span>✓ Chuẩn bị xong</span>
                                  </button>
                                )}
                                {(item.rentalFulfillment?.status === 'CUSTOMER_RETURN_REQUESTED' ||
                                  (['PICKED_UP', 'IN_PROGRESS'].includes(item.rentalFulfillment?.status) &&
                                    ['COMBO_PHOTOS_APPROVED', 'RETURN_PENDING'].includes(rawStatus))) && (
                                  <button
                                    type="button"
                                    className="p-drawer-primary-btn"
                                    style={{ padding: '5px 10px', fontSize: '11.5px', backgroundColor: '#881337', color: '#FFFFFF' }}
                                    onClick={() => handleReceiveReturn(item)}
                                    disabled={isReceivingReturn}
                                  >
                                    <PackageCheck size={12} />
                                    <span>{item.rentalFulfillment?.status === 'CUSTOMER_RETURN_REQUESTED' ? 'Xác nhận nhận lại áo' : 'Nhận lại áo & Kiểm tra'}</span>
                                  </button>
                                )}
                                {item.rentalFulfillment?.status === 'RETURNED' && !['FULLY_RELEASED', 'PARTIALLY_DEDUCTED', 'FULLY_DEDUCTED'].includes(item.rentalFulfillment?.depositSettlementStatus) && (
                                  <>
                                    <button
                                      type="button"
                                      className="p-drawer-primary-btn"
                                      style={{ padding: '5px 10px', fontSize: '11.5px', backgroundColor: '#059669', color: '#FFFFFF' }}
                                      onClick={() => handleConfirmNoIncident(item)}
                                    >
                                      <CheckCircle size={12} />
                                      <span>✓ Không sự cố</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="p-drawer-danger-btn"
                                      style={{ padding: '5px 10px', fontSize: '11.5px' }}
                                      onClick={() => onOpenIncidentReport(order)}
                                    >
                                      <AlertTriangle size={12} />
                                      <span>⚠️ Yêu cầu đền bù</span>
                                    </button>
                                  </>
                                )}
                                {['RETURNED', 'COMPLETED'].includes(item.rentalFulfillment?.status || '') &&
                                  (item.rentalFulfillment?.inventoryStatus === 'CLEANING' ||
                                    item.inventoryItem?.status === 'CLEANING' ||
                                    ['FULLY_RELEASED', 'PARTIALLY_DEDUCTED', 'FULLY_DEDUCTED'].includes(
                                      item.rentalFulfillment?.depositSettlementStatus,
                                    )) && (
                                  <button
                                    type="button"
                                    className="p-drawer-primary-btn"
                                    style={{ padding: '5px 10px', fontSize: '11.5px', backgroundColor: '#059669', color: '#FFFFFF' }}
                                    onClick={() => handleCleaningCompleted(item)}
                                  >
                                    <Sparkles size={12} />
                                    <span>✓ Giặt xong sớm</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Hợp đồng điện tử (Phạm vi đối tác) */}
                <div style={{ marginTop: '16px' }}>
                  <BookingContractsSection
                    bookingId={order._id}
                    bookingStatus={order.rawStatus || order.status}
                    viewerRole="provider"
                    title="Hợp đồng điện tử (Phạm vi đối tác)"
                    hideWhenEmpty={true}
                  />
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
                          <span className="p-quick-doc-meta">Mã xác nhận đơn {order.id || `#TG-${order._id.slice(-5).toUpperCase()}`}</span>
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
                          <span className="p-quick-doc-title">Hợp đồng ký quỹ TàGo Escrow</span>
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
                  {(() => {
                    const rawCode = String(order.rawStatus || '').toUpperCase();
                    const isUnpaidOrder = !rawCode || ['DRAFT', 'PENDING', 'PENDING_PAYMENT'].includes(rawCode);
                    const isCancelledOrder = rawCode === 'CANCELLED';
                    const isRefundedOrder = rawCode === 'REFUNDED' || rawCode === 'PARTIALLY_REFUNDED';
                    const isPaidStatus = !isUnpaidOrder && !isCancelledOrder && !isRefundedOrder;

                    const escrowBadge = isUnpaidOrder
                      ? { text: 'Chờ thanh toán cọc', color: '#B45309', background: '#FFFBEB' }
                      : isCancelledOrder
                      ? { text: 'Đơn đã hủy', color: '#B91C1C', background: '#FEF2F2' }
                      : rawCode === 'REFUNDED'
                      ? { text: 'Đã hoàn tiền', color: '#475569', background: '#F1F5F9' }
                      : rawCode === 'PARTIALLY_REFUNDED'
                      ? { text: 'Hoàn tiền một phần', color: '#B45309', background: '#FFFBEB' }
                      : isOrderCompleted
                      ? { text: '✓ Đã tất toán Escrow', color: '#059669', background: '#ECFDF5' }
                      : { text: '✓ Đã thanh toán Escrow', color: '#059669', background: '#ECFDF5' };

                    const grandTotal = order.pricingSummary?.grandTotal || order.totalAmount || Number((order.total || '').replace(/[^\d]/g, '')) || 0;
                    const assetDeposit = Number(order.depositTotal || order.pricingSummary?.depositTotal || 0);
                    const isRental = order.bookingType === 'AODAI_RENTAL';
                    const isPhoto = order.bookingType === 'PHOTOGRAPHY';
                    const isCombo = order.bookingType === 'COMBO';
                    const totalPaid = Number(order.paymentSummary?.totalPaid || 0);
                    const serviceAmount = Math.max(0, Number(order.pricingSummary?.subTotal || (grandTotal - assetDeposit)));

                    let serviceDepositPaid = 0;
                    let remaining = 0;

                    if (isCancelledOrder || isRefundedOrder) {
                      serviceDepositPaid = totalPaid > 0 ? Math.min(totalPaid, serviceAmount) : 0;
                      remaining = 0;
                    } else if (isOrderCompleted || order.paymentSummary?.paymentStatus === 'PAID') {
                      serviceDepositPaid = serviceAmount;
                      remaining = 0;
                    } else if (isRental) {
                      serviceDepositPaid = isPaidStatus ? serviceAmount : (totalPaid > 0 ? Math.max(0, totalPaid - assetDeposit) : 0);
                      remaining = isPaidStatus ? 0 : grandTotal;
                    } else if (isPhoto) {
                      const expectedDeposit = Number(order.pricingSummary?.amountDueNow || Math.round(serviceAmount * 0.2));
                      serviceDepositPaid = isPaidStatus ? (totalPaid > 0 ? totalPaid : expectedDeposit) : 0;
                      remaining = isPaidStatus ? Math.max(0, grandTotal - serviceDepositPaid) : grandTotal;
                    } else if (isCombo) {
                      const expectedDeposit = Number(order.pricingSummary?.amountDueNow || Math.round(serviceAmount * 0.5));
                      serviceDepositPaid = isPaidStatus ? (totalPaid > 0 ? Math.max(0, totalPaid - assetDeposit) : Math.max(0, expectedDeposit - assetDeposit)) : 0;
                      remaining = isPaidStatus ? Math.max(0, grandTotal - (totalPaid > 0 ? totalPaid : expectedDeposit)) : grandTotal;
                    } else {
                      serviceDepositPaid = totalPaid > 0 ? totalPaid : (isPaidStatus ? serviceAmount : 0);
                      remaining = isPaidStatus ? Math.max(0, grandTotal - serviceDepositPaid - assetDeposit) : grandTotal;
                    }

                    const serviceStatusNote = isCancelledOrder
                      ? '(Đơn đã hủy)'
                      : rawCode === 'REFUNDED'
                      ? '(Đã hoàn tiền)'
                      : rawCode === 'PARTIALLY_REFUNDED'
                      ? '(Hoàn tiền một phần)'
                      : isPaidStatus
                      ? '(Đã thanh toán)'
                      : '(Chờ thanh toán)';

                    const depositStatusNote = isOrderCompleted
                      ? '(Đã tất toán)'
                      : isCancelledOrder
                      ? '(Đơn đã hủy)'
                      : isRefundedOrder
                      ? '(Đã xử lý hoàn cọc)'
                      : isUnpaidOrder
                      ? '(Chờ thanh toán)'
                      : '(Đang tạm giữ Escrow)';

                    return (
                      <>
                        <div className="p-card-header">
                          <h3 className="p-card-title">
                            <ShieldCheck size={16} color="#881337" />
                            <span>Thông tin thanh toán &amp; Ký quỹ (Escrow)</span>
                          </h3>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: escrowBadge.color, background: escrowBadge.background, padding: '2px 8px', borderRadius: '6px' }}>
                            {escrowBadge.text}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                            <span>Tổng giá trị đơn hàng:</span>
                            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{grandTotal.toLocaleString('vi-VN')}đ</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                            <span>{isRental ? 'Tiền thuê trang phục:' : 'Đặt cọc dịch vụ trước:'}</span>
                            <span style={{ fontWeight: 600, color: isPaidStatus ? '#15803D' : '#64748B' }}>
                              {serviceDepositPaid.toLocaleString('vi-VN')}đ {serviceStatusNote}
                            </span>
                          </div>
                          {assetDeposit > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                              <span>Tiền cọc tài sản trang phục:</span>
                              <span style={{ fontWeight: 600, color: '#0284C7' }}>
                                {assetDeposit.toLocaleString('vi-VN')}đ {depositStatusNote}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', fontWeight: 700 }}>
                            <span style={{ color: '#0F172A' }}>Còn lại cần thanh toán:</span>
                            <span style={{ color: isCancelledOrder || isRefundedOrder ? '#64748B' : remaining === 0 ? '#10B981' : '#D97706', fontSize: '14px' }}>
                              {isCancelledOrder
                                ? 'Không thu (Đơn đã hủy)'
                                : rawCode === 'REFUNDED'
                                ? 'Đã hoàn tiền'
                                : rawCode === 'PARTIALLY_REFUNDED'
                                ? 'Đã hoàn một phần'
                                : remaining === 0
                                ? 'Đã thanh toán đủ'
                                : `${remaining.toLocaleString('vi-VN')}đ`}
                            </span>
                          </div>
                        </div>
                      </>
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
                    <div
                      className="p-master-progress-track"
                      style={{
                        position: 'absolute',
                        top: '13px',
                        left: `calc(100% / (${masterSteps.length} * 2))`,
                        right: `calc(100% / (${masterSteps.length} * 2))`,
                        height: '3px',
                        backgroundColor: '#E2E8F0',
                        zIndex: 1,
                        overflow: 'hidden',
                        borderRadius: '2px',
                      }}
                    >
                      <div
                        className="p-master-progress-fill"
                        style={{
                          height: '100%',
                          backgroundColor: '#881337',
                          width: isOrderCompleted
                            ? '100%'
                            : `${Math.min(100, Math.max(0, (activeMasterIndex / (masterSteps.length - 1)) * 100))}%`,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

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

                  {/* Dual Sub-steppers only for Combo orders */}
                  {isCombo && (
                    <div className="p-dual-substepper-grid">
                      <div className="p-substepper-box">
                        <div className="p-substepper-header">
                          <Shirt size={14} color="#15803D" />
                          <span>Tiến trình Áo dài</span>
                        </div>
                        <div className="p-substepper-row">
                          <div
                            className="p-substepper-track-wrap"
                            style={{
                              position: 'absolute',
                              top: '9px',
                              left: `calc(100% / (${aoDaiSubsteps.length} * 2))`,
                              right: `calc(100% / (${aoDaiSubsteps.length} * 2))`,
                              height: '2px',
                              backgroundColor: '#E2E8F0',
                              zIndex: 1,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              className="p-substepper-line-fill"
                              style={{
                                height: '100%',
                                backgroundColor: '#10B981',
                                width: isOrderCompleted
                                  ? '100%'
                                  : `${Math.min(100, Math.max(0, (aoDaiCurrentIdx / (aoDaiStepsConfig.length - 1)) * 100))}%`,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
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

                      <div className="p-substepper-box">
                        <div className="p-substepper-header">
                          <Camera size={14} color="#BE123C" />
                          <span>Tiến trình Chụp ảnh</span>
                        </div>
                        <div className="p-substepper-row">
                          <div
                            className="p-substepper-track-wrap"
                            style={{
                              position: 'absolute',
                              top: '9px',
                              left: `calc(100% / (${photoSubsteps.length} * 2))`,
                              right: `calc(100% / (${photoSubsteps.length} * 2))`,
                              height: '2px',
                              backgroundColor: '#E2E8F0',
                              zIndex: 1,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              className="p-substepper-line-fill photo"
                              style={{
                                height: '100%',
                                backgroundColor: '#BE123C',
                                width: isOrderCompleted
                                  ? '100%'
                                  : `${Math.min(100, Math.max(0, (photoCurrentIdx / (photoStepsConfig.length - 1)) * 100))}%`,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
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
                    </div>
                  )}
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
                    <span>Chính sách bảo chứng TàGo Escrow</span>
                  </h3>
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
                  • <strong>Bảo vệ tiền cọc:</strong> Khoản tiền cọc dịch vụ 1.400.000đ và cọc trang phục 1.000.000đ được khóa an toàn trên hợp đồng thông minh ký quỹ TàGo Escrow.<br />
                  • <strong>Giải ngân doanh thu:</strong> Doanh thu được tự động chuyển về ví đối tác của bạn ngay sau khi khách hàng xác nhận nhận đủ ảnh và hoàn trả áo dài nguyên vẹn.<br />
                  • <strong>Bảo hiểm sự cố:</strong> Trường hợp phát sinh hư hỏng, hệ thống trọng tài TàGo sẽ thụ lý bằng chứng hình ảnh trong vòng 24 giờ.
                </div>
              </div>

              {/* Hợp đồng điện tử (Phạm vi đối tác) */}
              <div style={{ marginTop: '16px' }}>
                <BookingContractsSection
                  bookingId={order._id}
                  bookingStatus={order.rawStatus || order.status}
                  viewerRole="provider"
                  title="Hợp đồng điện tử (Phạm vi đối tác)"
                  hideWhenEmpty={true}
                />
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
              {(() => {
                const rawCode = String(order.rawStatus || '').toUpperCase();
                const isUnpaidOrder = !rawCode || ['DRAFT', 'PENDING', 'PENDING_PAYMENT'].includes(rawCode);
                const isCancelledOrder = rawCode === 'CANCELLED';
                const isRefundedOrder = rawCode === 'REFUNDED' || rawCode === 'PARTIALLY_REFUNDED';
                const isPaidStatus = !isUnpaidOrder && !isCancelledOrder && !isRefundedOrder;

                const paymentBadge = isUnpaidOrder
                  ? { text: 'Chờ thanh toán cọc', color: '#B45309', background: '#FFFBEB' }
                  : isCancelledOrder
                  ? { text: 'Đơn đã hủy', color: '#B91C1C', background: '#FEF2F2' }
                  : rawCode === 'REFUNDED'
                  ? { text: 'Đã hoàn tiền', color: '#475569', background: '#F1F5F9' }
                  : rawCode === 'PARTIALLY_REFUNDED'
                  ? { text: 'Hoàn tiền một phần', color: '#B45309', background: '#FFFBEB' }
                  : isOrderCompleted
                  ? { text: '✓ Đã tất toán Escrow', color: '#059669', background: '#ECFDF5' }
                  : { text: '✓ Đã thanh toán cọc Escrow', color: '#059669', background: '#ECFDF5' };

                const grandTotal = order.pricingSummary?.grandTotal || order.totalAmount || Number((order.total || '').replace(/[^\d]/g, '')) || 0;
                const assetDeposit = Number(order.depositTotal || order.pricingSummary?.depositTotal || 0);
                const isRental = order.bookingType === 'AODAI_RENTAL';
                const isPhoto = order.bookingType === 'PHOTOGRAPHY';
                const isCombo = order.bookingType === 'COMBO';
                const totalPaid = Number(order.paymentSummary?.totalPaid || 0);
                const serviceAmount = Math.max(0, Number(order.pricingSummary?.subTotal || (grandTotal - assetDeposit)));

                let serviceDepositPaid = 0;
                let remaining = 0;

                if (isCancelledOrder || isRefundedOrder) {
                  serviceDepositPaid = totalPaid > 0 ? Math.min(totalPaid, serviceAmount) : 0;
                  remaining = 0;
                } else if (isOrderCompleted || order.paymentSummary?.paymentStatus === 'PAID') {
                  serviceDepositPaid = serviceAmount;
                  remaining = 0;
                } else if (isRental) {
                  serviceDepositPaid = isPaidStatus ? serviceAmount : (totalPaid > 0 ? Math.max(0, totalPaid - assetDeposit) : 0);
                  remaining = isPaidStatus ? 0 : grandTotal;
                } else if (isPhoto) {
                  const expectedDeposit = Number(order.pricingSummary?.amountDueNow || Math.round(serviceAmount * 0.2));
                  serviceDepositPaid = isPaidStatus ? (totalPaid > 0 ? totalPaid : expectedDeposit) : 0;
                  remaining = isPaidStatus ? Math.max(0, grandTotal - serviceDepositPaid) : grandTotal;
                } else if (isCombo) {
                  const expectedDeposit = Number(order.pricingSummary?.amountDueNow || Math.round(serviceAmount * 0.5));
                  serviceDepositPaid = isPaidStatus ? (totalPaid > 0 ? Math.max(0, totalPaid - assetDeposit) : Math.max(0, expectedDeposit - assetDeposit)) : 0;
                  remaining = isPaidStatus ? Math.max(0, grandTotal - (totalPaid > 0 ? totalPaid : expectedDeposit)) : grandTotal;
                } else {
                  serviceDepositPaid = totalPaid > 0 ? totalPaid : (isPaidStatus ? serviceAmount : 0);
                  remaining = isPaidStatus ? Math.max(0, grandTotal - serviceDepositPaid - assetDeposit) : grandTotal;
                }

                const serviceFlowNote = isCancelledOrder
                  ? 'Đơn đã hủy'
                  : rawCode === 'REFUNDED'
                  ? 'Đã hoàn tiền'
                  : rawCode === 'PARTIALLY_REFUNDED'
                  ? 'Hoàn tiền một phần'
                  : isPaidStatus
                  ? 'Đã thu qua Escrow'
                  : 'Chờ thanh toán';

                const depositFlowNote = isOrderCompleted
                  ? 'Đã tất toán'
                  : isCancelledOrder
                  ? 'Đơn đã hủy'
                  : isRefundedOrder
                  ? 'Đã xử lý hoàn cọc'
                  : isUnpaidOrder
                  ? 'Chờ thanh toán'
                  : 'Đang tạm giữ bảo đảm';

                return (
                  <>
                    <div className="p-payment-summary-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                          Bảng kê tài chính chi tiết
                        </span>
                        <span
                          className="p-payment-badge-paid"
                          style={{ color: paymentBadge.color, background: paymentBadge.background }}
                        >
                          {paymentBadge.text}
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

                      {Boolean(order.pricingSummary?.serviceFee && order.pricingSummary.serviceFee > 0) && (
                        <div className="p-payment-row">
                          <span>Phí dịch vụ / Vệ sinh</span>
                          <strong>{Number(order.pricingSummary.serviceFee).toLocaleString('vi-VN')}đ</strong>
                        </div>
                      )}

                      {Boolean((order.pricingSummary?.voucherDiscountTotal || order.pricingSummary?.discountAmount) && (order.pricingSummary.voucherDiscountTotal > 0 || order.pricingSummary.discountAmount > 0)) && (
                        <div className="p-payment-row" style={{ color: '#059669' }}>
                          <span>Ưu đãi giảm giá</span>
                          <strong>-{Number(order.pricingSummary.voucherDiscountTotal || order.pricingSummary.discountAmount).toLocaleString('vi-VN')}đ</strong>
                        </div>
                      )}

                      <div className="p-payment-row total">
                        <span>Tổng giá trị đơn hàng:</span>
                        <span style={{ color: '#BE123C', fontSize: '16px' }}>
                          {order.total || `${(order.totalAmount || 0).toLocaleString('vi-VN')}đ`}
                        </span>
                      </div>
                    </div>

                    <div className="p-payment-summary-box">
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        Trạng thái dòng tiền &amp; Ký quỹ Escrow
                      </span>

                      <div className="p-payment-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isPaidStatus ? <CheckCircle size={14} color="#10B981" /> : <Hourglass size={14} color="#D97706" />}
                          <span>{isRental ? 'Tiền thuê dịch vụ đã thu' : 'Tiền cọc dịch vụ đã thu'}</span>
                        </span>
                        <strong style={{ color: isPaidStatus ? '#10B981' : '#64748B' }}>
                          {serviceDepositPaid.toLocaleString('vi-VN')}đ ({serviceFlowNote})
                        </strong>
                      </div>

                      {assetDeposit > 0 && (
                        <div className="p-payment-row">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isPaidStatus ? <CheckCircle size={14} color="#10B981" /> : <Hourglass size={14} color="#D97706" />}
                            <span>Tiền cọc tài sản trang phục</span>
                          </span>
                          <strong style={{ color: '#0284C7' }}>
                            {assetDeposit.toLocaleString('vi-VN')}đ ({depositFlowNote})
                          </strong>
                        </div>
                      )}

                      <div className="p-payment-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {remaining === 0 && isPaidStatus ? <CheckCircle size={14} color="#10B981" /> : <Hourglass size={14} color="#D97706" />}
                          <span>Số tiền còn lại cần thu</span>
                        </span>
                        <strong style={{ color: isCancelledOrder || isRefundedOrder ? '#64748B' : remaining === 0 ? '#10B981' : '#D97706' }}>
                          {isCancelledOrder
                            ? 'Không thu (Đơn đã hủy)'
                            : rawCode === 'REFUNDED'
                            ? 'Đã hoàn tiền'
                            : rawCode === 'PARTIALLY_REFUNDED'
                            ? 'Đã hoàn một phần'
                            : remaining === 0
                            ? 'Đã thanh toán đủ'
                            : `${remaining.toLocaleString('vi-VN')}đ (${isPaidStatus ? 'Thanh toán tại chỗ' : 'Chờ thanh toán'})`}
                        </strong>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                        Cổng ký quỹ: <strong>TàGo Escrow Banking</strong> &nbsp;|&nbsp; Mã đơn: <strong>{order.id || `#TG-${order._id.slice(-5).toUpperCase()}`}</strong>
                      </div>
                    </div>
                  </>
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
              {disputeResult && (
                <div style={{ padding: '14px 16px', background: '#FFFBEA', border: '1px solid #F3C969', borderRadius: '10px', marginBottom: '12px', color: '#5B3A00' }}>
                  <div style={{ fontWeight: 800, fontSize: '13.5px', marginBottom: '8px' }}>⚖️ Kết quả giải quyết tranh chấp từ Admin</div>
                  <div style={{ display: 'grid', gap: '5px', fontSize: '12.5px' }}>
                    <div><strong>Phán quyết:</strong> {disputeResult.decisionLabel || disputeResult.decision || 'Đã xử lý'}</div>
                    {typeof disputeResult.compensationAmount === 'number' && <div><strong>Bồi thường Shop:</strong> {disputeResult.compensationAmount.toLocaleString('vi-VN')}đ</div>}
                    {typeof disputeResult.refundAmount === 'number' && <div><strong>Hoàn tiền khách:</strong> {disputeResult.refundAmount.toLocaleString('vi-VN')}đ</div>}
                    {disputeResult.notes && <div><strong>Ghi chú Admin:</strong> {disputeResult.notes}</div>}
                    {disputeResult.resolvedAt && <div style={{ color: '#8A6A35', fontSize: '11px' }}>Thời gian xử lý: {new Date(disputeResult.resolvedAt).toLocaleString('vi-VN')}</div>}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Ảnh bằng chứng giao nhận &amp; Kiểm tra
                </span>
                {!isCancelled && !isOrderCompleted && (
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
                )}
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

            {!isCancelled && !isOrderCompleted && !isSingleReturnedAndInspecting && !isCustomerReturnPending && !isSingleInUse && !hasIncidentPending && !hasDispute && (
              <button
                type="button"
                className="p-drawer-danger-btn"
                onClick={() => onOpenIncidentReport(order)}
                title="Báo cáo sự cố hoặc hư hỏng"
              >
                <AlertTriangle size={14} />
                <span>Báo sự cố</span>
              </button>
            )}

            {/* Direct 1-click interactions for Single Rental Item */}
            {/* 1. Đang cho thuê / Khách đang trải nghiệm (Chờ khách trả áo) */}
            {isSingleRentalItem && isSingleInUse && (
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 650,
                  color: '#0284C7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#F0F9FF',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #BAE6FD',
                }}
              >
                <Clock size={14} />
                <span>Khách đang trải nghiệm trang phục (Chờ khách trả áo)</span>
              </span>
            )}

            {/* 2. Khách đã trả áo -> Chờ Shop xác nhận nhận lại áo & kiểm tra */}
            {isSingleRentalItem && isCustomerReturnPending && (
              <>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 650,
                    color: '#D97706',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#FEF3C7',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #FDE68A',
                  }}
                >
                  <Clock size={14} />
                  <span>Khách đã trả áo - Chờ shop nhận &amp; kiểm tra</span>
                </span>
                <button
                  type="button"
                  className="p-drawer-primary-btn"
                  disabled={isReceivingReturn}
                  // Do not pass the React click event as the optional item argument.
                  // handleReceiveReturn treats its first argument as a booking item; passing
                  // the event made it return early because the event has no `_id`.
                  onClick={() => void handleReceiveReturn()}
                >
                  <PackageCheck size={14} />
                  <span>{isReceivingReturn ? 'Đang xử lý...' : 'Xác nhận đã nhận lại áo & kiểm tra'}</span>
                </button>
              </>
            )}

            {/* 3. Shop đã nhận lại áo (RETURNED) -> Báo sự cố nếu có */}
            {isSingleRentalItem && isSingleReturnedAndInspecting && (
              <button
                type="button"
                className="p-drawer-danger-btn"
                onClick={() => onOpenIncidentReport(order)}
                style={{ padding: '8px 14px', fontSize: '13px' }}
                title="Yêu cầu đền bù sự cố hư hỏng hoặc vi phạm"
              >
                <AlertTriangle size={14} />
                <span>⚠️ Yêu cầu đền bù</span>
              </button>
            )}

            {isSingleRentalItem && hasIncidentPending && (
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 650,
                  color: '#D97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#FFFBEB',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #FDE68A',
                }}
              >
                <Clock size={14} />
                <span>Đã gửi yêu cầu đền bù — Đang chờ khách hàng duyệt</span>
              </span>
            )}

            {isSingleRentalItem && hasDispute && (
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 650,
                  color: '#DC2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#FEF2F2',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #FECACA',
                }}
              >
                <AlertTriangle size={14} />
                <span>Đang có khiếu nại / tranh chấp — Admin đang xử lý</span>
              </span>
            )}

            {isSingleRentalItem && isSingleCleaning && !isOrderCompleted && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                style={{ backgroundColor: '#059669', border: 'none', color: '#FFFFFF' }}
                onClick={() => void handleCleaningCompleted()}
                disabled={isCompletingCleaning}
                title="Đánh dấu trang phục đã giặt ủi xong và sẵn sàng cho thuê sớm"
              >
                <Sparkles size={14} />
                <span>{isCompletingCleaning ? 'Đang cập nhật...' : '✓ Hoàn tất giặt ủi – mở lịch sớm'}</span>
              </button>
            )}

            {/* Primary contextual status button */}
            {rawStatus === 'DEPOSIT_PAID' && (
              <>
                <button
                  type="button"
                  className="p-drawer-primary-btn"
                  style={{ backgroundColor: '#1565C0' }}
                  onClick={handleConfirmOrder}
                  disabled={isConfirming}
                >
                  <CheckCircle size={14} />
                  <span>
                    {isConfirming
                      ? 'Đang xác nhận...'
                      : isPhoto
                        ? 'Chấp nhận lịch chụp'
                        : 'Xác nhận đơn hàng'}
                  </span>
                </button>
                {isPhoto && (
                  <button
                    type="button"
                    className="p-drawer-danger-btn"
                    onClick={() => changeOrderStatus(order._id, 'CANCELLED')}
                    title="Từ chối lịch chụp nếu không thể sắp xếp"
                  >
                    <X size={14} />
                    <span>Từ chối lịch chụp</span>
                  </button>
                )}
              </>
            )}

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
              <>
                <button
                  type="button"
                  className="p-drawer-primary-btn"
                  onClick={() => changeOrderStatus(order._id, 'AWAITING_REVIEW')}
                >
                  <Camera size={14} />
                  <span>Hoàn tất buổi chụp / Bàn giao ảnh</span>
                </button>
                {isCombo && (
                  <button
                    type="button"
                    className="p-card-edit-btn"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                    onClick={() => changeOrderStatus(order._id, 'RETURN_PENDING')}
                  >
                    <Package size={14} />
                    <span>Khách trả áo dài</span>
                  </button>
                )}
              </>
            )}

            {rawStatus === 'AWAITING_REVIEW' && (
              <>
                <span style={{ fontSize: '12.5px', fontWeight: 650, color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFBEB', padding: '7px 14px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  <Clock size={14} />
                  <span>Đã gửi ảnh • Chờ khách hàng duyệt nhận</span>
                </span>
                <button
                  type="button"
                  className="p-card-edit-btn"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                  onClick={() => changeOrderStatus(order._id, 'AWAITING_REVIEW')}
                  title="Cập nhật link Google Drive hoặc ảnh kết quả đã giao"
                >
                  <Camera size={14} />
                  <span>Cập nhật link ảnh</span>
                </button>
                {isCombo && (
                  <button
                    type="button"
                    className="p-card-edit-btn"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                    onClick={() => changeOrderStatus(order._id, 'RETURN_PENDING')}
                  >
                    <Package size={14} />
                    <span>Khách trả áo dài</span>
                  </button>
                )}
              </>
            )}

            {((rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') &&
              !isPhoto &&
              (rentalItems.length === 0 ||
                rentalItems.some((it: any) => !it.rentalFulfillment?.status || it.rentalFulfillment?.status === 'PENDING'))) && (
              <button
                type="button"
                className="p-drawer-primary-btn"
                onClick={handleMarkReady}
                disabled={isMarkingReady}
              >
                <Package size={14} />
                <span>{isMarkingReady ? 'Đang cập nhật...' : 'Chuẩn bị áo xong (Sẵn sàng nhận)'}</span>
              </button>
            )}

            {(rawStatus === 'PICKUP_PENDING' ||
              rawStatus === 'READY_FOR_PICKUP' ||
              ((rawStatus === 'DEPOSIT_PAID' || rawStatus === 'CONFIRMED') &&
                rentalItems.length > 0 &&
                rentalItems.every((it: any) => it.rentalFulfillment?.status && it.rentalFulfillment?.status !== 'PENDING'))) &&
              !isPhoto && (
              <>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 650,
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ECFDF5',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Áo đã chuẩn bị xong</span>
                </span>
                {allRentalHandoverEvidenceSubmitted ? (
                  <span
                    style={{
                      fontSize: '12.5px', fontWeight: 650, color: '#92400E', display: 'inline-flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#FFFBEB', padding: '7px 14px', borderRadius: '8px', border: '1px solid #FDE68A',
                    }}
                  >
                    <Clock size={14} />
                    <span>Đã gửi ảnh bàn giao • Chờ khách xác nhận</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="p-drawer-primary-btn"
                    onClick={() => void handleSubmitPickupEvidence()}
                    disabled={isSendingPickupEvidence}
                  >
                    <PackageCheck size={14} />
                    <span>{isSendingPickupEvidence ? 'Đang gửi ảnh...' : 'Chụp ảnh & gửi bàn giao cho khách'}</span>
                  </button>
                )}
              </>
            )}

            {rawStatus === 'PICKED_UP' && !isSingleRentalItem && (
              <>
                {isCombo && !order.photosApproved && (
                  <button
                    type="button"
                    className="p-drawer-primary-btn"
                    onClick={() => changeOrderStatus(order._id, 'SESSION_START')}
                  >
                    <Play size={14} />
                    <span>Bắt đầu buổi chụp</span>
                  </button>
                )}
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 650,
                    color: '#0284C7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#F0F9FF',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #BAE6FD',
                  }}
                >
                  <Clock size={14} />
                  <span>Khách đang trải nghiệm trang phục</span>
                </span>
              </>
            )}

            {rawStatus === 'COMBO_PHOTOS_APPROVED' && !isAoDai && (
              <span style={{ fontSize: '12.5px', fontWeight: 650, color: '#0369A1', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#E0F2FE', padding: '7px 14px', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
                <CheckCircle size={14} />
                <span>Khách đã duyệt ảnh</span>
              </span>
            )}

            {/* Đơn có nhiều áo dài hoặc đơn Combo: Khi có áo dài chưa nhận lại */}
            {!isSingleRentalItem && !hasIncidentPending && !hasDispute && !isOrderCompleted &&
              rentalItems.length > 0 &&
              rentalItems.some((i) => !['RETURNED', 'COMPLETED'].includes(i.rentalFulfillment?.status)) &&
              ['COMBO_PHOTOS_APPROVED', 'RETURN_PENDING'].includes(rawStatus) && (
              <>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 650,
                    color: '#D97706',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#FEF3C7',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #FDE68A',
                  }}
                >
                  <Clock size={14} />
                  <span>Khách đã trả áo - Chờ shop nhận &amp; kiểm tra</span>
                </span>
                <button
                  type="button"
                  className="p-drawer-primary-btn"
                  disabled={isReceivingReturn}
                  onClick={() => void handleReceiveAllRentalReturns()}
                >
                  <PackageCheck size={14} />
                  <span>{isReceivingReturn ? 'Đang xử lý...' : 'Xác nhận đã nhận lại áo & kiểm tra'}</span>
                </button>
              </>
            )}

            {/* Đơn có nhiều áo dài hoặc đơn Combo: Khi đã nhận lại tất cả áo dài -> Tất toán cọc */}
            {!isSingleRentalItem && !hasIncidentPending && !hasDispute && !isOrderCompleted &&
              rentalItems.length > 0 &&
              rentalItems.every((i) => ['RETURNED', 'COMPLETED'].includes(i.rentalFulfillment?.status)) &&
              rentalItems.some((i) => i.rentalFulfillment?.status === 'RETURNED' && !['FULLY_RELEASED', 'PARTIALLY_DEDUCTED', 'FULLY_DEDUCTED'].includes(i.rentalFulfillment?.depositSettlementStatus)) && (
              <button
                type="button"
                className="p-drawer-danger-btn"
                onClick={() => onOpenIncidentReport(order)}
                style={{ padding: '8px 14px', fontSize: '13px' }}
                title="Yêu cầu đền bù sự cố hư hỏng hoặc vi phạm"
              >
                <AlertTriangle size={14} />
                <span>⚠️ Yêu cầu đền bù</span>
              </button>
            )}

            {['PICKED_UP', 'RETURN_PENDING', 'OVERDUE'].includes(rawStatus) && (
              <button
                type="button"
                onClick={() => void handleSimulateOverdue(order._id)}
                style={{
                  backgroundColor: '#FFFBEB',
                  color: '#B45309',
                  border: '1px solid #FCD34D',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Giả lập đơn trễ hạn để test luồng trừ tiền trước Hội đồng"
              >
                <span>⚡ Demo: Giả lập trễ hạn</span>
              </button>
            )}

            {rawStatus === 'OVERDUE' && (
              <button
                type="button"
                className="p-drawer-danger-btn"
                onClick={() => void handleConfirmLostItem(order._id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <XCircle size={14} />
                <span>Xác nhận mất đồ (LOST_ITEM)</span>
              </button>
            )}

            {rawStatus === 'RETURNED' && !isSingleRentalItem && !isOrderCompleted && !isSingleCleaning && !hasIncidentPending && !hasDispute && (
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 650,
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ECFDF5',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #A7F3D0',
                }}
              >
                <Clock size={14} />
                <span>Đã nhận lại đồ — Đang kiểm tra hiện trạng &amp; tất toán cọc</span>
              </span>
            )}

            {isOrderCompleted && (
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle size={15} color="#10B981" />
                <span>Đơn đã hoàn tất</span>
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
                <span>TàGo Escrow • Bằng chứng xác thực</span>
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
                    onOpenChat();
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
