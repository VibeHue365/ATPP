import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import {
  staffApi,
  type ProviderStaffItem,
  type ProviderStaffSummary,
} from '@/apis/staffApi';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { FontFamily } from '@/constants/theme';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { TagoMapView, type MapMarkerItem } from '@/components/map/TagoMapView';
import { ProviderJobNavigationModal } from '@/components/provider/ProviderJobNavigationModal';
import {
  estimateDriveMinutes,
  formatDistance,
  haversineKm,
  openExternalDirections,
  resolveEntityCoords,
  type LatLng,
} from '@/utils/geo';
import { getMediaUrl } from '@/utils/media';
import { openOrderCustomerChat } from '@/utils/chatNavigation';
import {
  getRentalItems,
  isPhotographyItem,
  resolveBookingDisplayState,
  type RentalStageKey,
  type StatusTone,
} from '@/utils/rentalState';
import {
  OrderDetailModal,
  type ProviderRentalActionType,
} from '@/components/provider/orders/OrderDetailModal';
import {
  ProviderOrderWorkflowModal,
  type ProviderWorkflowMode,
} from '@/components/provider/orders/ProviderOrderWorkflowModal';
import {
  ApproveStaffPickerModal,
  useApproveStaffPicker,
} from '@/components/provider/orders/ApproveStaffPickerModal';

type ScheduleFilterType = 'ALL' | 'PICKUP' | 'RETURN' | 'PHOTOSHOOT';

function toVnDayKey(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface UnifiedTimelineItem {
  id: string;
  bookingId: string;
  bookingCode: string;
  type: 'PICKUP' | 'RETURN' | 'PHOTOSHOOT';
  timeLabel: string;
  dateStr: string;
  dateDisplay: string;
  customerName: string;
  customerPhone: string;
  serviceTitle: string;
  locationAddress: string;
  coords: LatLng;
  productImage?: string | null;
  status: string;
  stage?: RentalStageKey;
  stageLabel?: string;
  stageTone?: StatusTone;
  depositAmount: number;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  checkedInAt?: string | null;
  shootFinishedAt?: string | null;
  rawOrder?: any;
}

export default function ProviderSchedulesScreen() {
  const { show } = useToast();
  const { bookingSyncVersion, bumpBookingSync } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewSchedules, setOverviewSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);

  const [typeFilter, setTypeFilter] = useState<ScheduleFilterType>('ALL');
  const [staffMembers, setStaffMembers] = useState<ProviderStaffItem[]>([]);
  const [staffSummary, setStaffSummary] = useState<ProviderStaffSummary | null>(null);
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [selectedDayKey, setSelectedDayKey] = useState<string>('ALL_DAYS');
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [navModalVisible, setNavModalVisible] = useState(false);
  const [navOrder, setNavOrder] = useState<any | null>(null);
  const [providerProfile, setProviderProfile] = useState<any | null>(null);
  const [workflowMode, setWorkflowMode] = useState<ProviderWorkflowMode>(null);
  const [workflowItemId, setWorkflowItemId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const approveStaffPicker = useApproveStaffPicker();
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  // Recurring Working Hours & Date Block Modal state
  const [scheduleConfigVisible, setScheduleConfigVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState('Tiệm đầy lịch / Tạm nghỉ');
  const [selectedScheduleDays, setSelectedScheduleDays] = useState<number[]>([
    1, 2, 3, 4, 5, 6, 0,
  ]);
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('20:00');
  const [savingScheduleConfig, setSavingScheduleConfig] = useState(false);

  const loadScheduleData = useCallback(async () => {
    try {
      const [overRes, bookRes, schedRes, meRes, staffRes] = await Promise.allSettled([
        providerApi.getOverview(),
        providerApi.getBookings(),
        providerApi.listSchedules(),
        providerApi.getMe(),
        staffApi.listMine(),
      ]);

      if (overRes.status === 'fulfilled' && overRes.value) {
        const upcoming =
          overRes.value.upcomingSchedules || overRes.value.todaySchedules || [];
        setOverviewSchedules(Array.isArray(upcoming) ? upcoming : []);
      }
      if (bookRes.status === 'fulfilled' && Array.isArray(bookRes.value)) {
        setBookings(bookRes.value);
        setBookingsLoaded(true);
        setSelectedOrder((prev: any) =>
          prev?._id
            ? bookRes.value.find((b: any) => b._id === prev._id) ?? prev
            : prev,
        );
      }
      if (meRes.status === 'fulfilled' && meRes.value) {
        setProviderProfile(meRes.value);
      }
      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value?.items)) {
        setStaffMembers(staffRes.value.items);
        setStaffSummary(staffRes.value.summary ?? null);
      }
      if (schedRes.status === 'fulfilled' && Array.isArray(schedRes.value)) {
        const blocked = schedRes.value
          .filter((s: any) => s.isAvailable === false && s.date)
          .map((s: any) => toVnDayKey(s.date))
          .filter(Boolean);
        setBlockedDates(blocked);
      }
    } catch {
      show('Không thể tải lịch hẹn đối tác', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    void loadScheduleData();
  }, [loadScheduleData]);

  useEffect(() => {
    if (bookingSyncVersion > 0) {
      void loadScheduleData();
    }
  }, [bookingSyncVersion, loadScheduleData]);

  useFocusEffect(
    useCallback(() => {
      void loadScheduleData();
      return undefined;
    }, [loadScheduleData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadScheduleData();
  }, [loadScheduleData]);

  // Build unified timeline from real bookings + overview schedules
  const timelineItems: UnifiedTimelineItem[] = useMemo(() => {
    const list: UnifiedTimelineItem[] = [];
    const seenIds = new Set<string>();
    const bookingById = new Map<string, any>();
    const hiddenBookingStatuses = new Set([
      'DRAFT',
      'PENDING_PAYMENT',
      'CANCELLED',
      'COMPLETED',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
    ]);

    bookings.forEach((b) => {
      if (b?._id) bookingById.set(String(b._id), b);
      const upperStatus = String(b.status || '').toUpperCase();
      if (hiddenBookingStatuses.has(upperStatus)) {
        return;
      }

      const display = resolveBookingDisplayState(b, 'provider');
      const code =
        b.bookingCode || (b._id ? `#${b._id.slice(-6).toUpperCase()}` : '#BK');
      const custName =
        b.customerId?.profile?.fullName ||
        b.contactInfo?.fullName ||
        'Khách hàng TàGo';
      const custPhone =
        b.customerId?.auth?.phone || b.contactInfo?.phone || '';

      const rentalItems = getRentalItems(b, true);
      const firstRentalItem: any = rentalItems[0];
      const firstPhotoItem: any = (Array.isArray(b.items) ? b.items : []).find((it: any) =>
        isPhotographyItem(it),
      );
      const primaryItem: any = firstRentalItem || firstPhotoItem || b.items?.[0];

      const itemTitle =
        primaryItem?.name ||
        primaryItem?.productName ||
        primaryItem?.productId?.name ||
        primaryItem?.photographyPackageId?.title ||
        primaryItem?.photographyPackageId?.name ||
        b.packageTitle ||
        'Thuê Cổ Phục Áo Dài Huế';
      const itemSize =
        primaryItem?.selectedSize || primaryItem?.size
          ? ` (Size ${primaryItem?.selectedSize || primaryItem?.size})`
          : '';
      const rawImg =
        primaryItem?.productId?.images?.[0] ||
        primaryItem?.photographyPackageId?.images?.[0] ||
        primaryItem?.images?.[0] ||
        primaryItem?.imageUrl ||
        primaryItem?.image ||
        primaryItem?.product?.images?.[0] ||
        null;

      const rentalDeposit = rentalItems.reduce(
        (sum: number, it: any) => sum + Number(it.depositAmount || 0) * Number(it.quantity || 1),
        0,
      );
      const deposit =
        rentalDeposit > 0
          ? rentalDeposit
          : Number(b.pricingSummary?.depositTotal ?? b.depositAmount ?? 0);

      const photoSched =
        b.photoshootSchedule ||
        (Array.isArray(b.schedules)
          ? b.schedules.find(
              (s: any) =>
                s?.scheduleType === 'PHOTOSHOOT' &&
                s?.status !== 'CANCELLED' &&
                s?.status !== 'EXPIRED',
            )
          : null);

      const startRaw =
        firstRentalItem?.rentalFrom ||
        firstRentalItem?.rentalPeriod?.startDate ||
        firstRentalItem?.startDate ||
        firstPhotoItem?.shootDate ||
        photoSched?.startsAt ||
        photoSched?.scheduledDate ||
        b.startDate ||
        b.createdAt;
      const endRaw =
        firstRentalItem?.rentalTo ||
        firstRentalItem?.rentalPeriod?.endDate ||
        firstRentalItem?.endDate ||
        photoSched?.endsAt ||
        b.endDate ||
        startRaw;

      const startDateObj = startRaw ? new Date(startRaw) : new Date();
      const endDateObj = endRaw ? new Date(endRaw) : new Date();

      const startDayKey = toVnDayKey(startDateObj);
      const endDayKey = toVnDayKey(endDateObj);
      const photoDayKey =
        photoSched?.providerLocalDate ||
        toVnDayKey(
          firstPhotoItem?.shootDate ||
            photoSched?.startsAt ||
            photoSched?.scheduledDate ||
            startDateObj,
        );

      const shootTimeLabel =
        firstPhotoItem?.shootTimeSlot ||
        photoSched?.timeSlot ||
        (photoSched?.startsAt
          ? new Date(photoSched.startsAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '15:00');

      const shootSnap =
        b.photoshootSchedule?.locationSnapshot ||
        firstPhotoItem?.shootLocationSnapshot ||
        firstRentalItem?.pickupReturnLocationSnapshot ||
        b.location;
      const addrText =
        shootSnap?.addressLine ||
        shootSnap?.address ||
        firstPhotoItem?.shootLocation ||
        firstRentalItem?.providerAddress ||
        'Đại Nội Huế (Hoàng Thành), TP. Huế';
      const resolvedCoords = resolveEntityCoords({
        id: b._id,
        geo: shootSnap?.geo,
        address: { addressLine: addrText },
      });

      if (display.isPhotoshootOnly || (display.isCombo && photoSched)) {
        const photoTitle =
          firstPhotoItem?.name ||
          firstPhotoItem?.photographyPackageId?.title ||
          firstPhotoItem?.photographyPackageId?.name ||
          itemTitle;
        const photoId = `photo-${b._id}`;
        seenIds.add(photoId);
        list.push({
          id: photoId,
          bookingId: b._id,
          bookingCode: code,
          type: 'PHOTOSHOOT',
          timeLabel: shootTimeLabel,
          dateStr: photoDayKey || startDayKey,
          dateDisplay: new Date(
            firstPhotoItem?.shootDate || photoSched?.startsAt || startDateObj,
          ).toLocaleDateString('vi-VN'),
          customerName: custName,
          customerPhone: custPhone,
          serviceTitle: photoTitle,
          locationAddress: addrText,
          coords: resolvedCoords,
          productImage:
            firstPhotoItem?.photographyPackageId?.images?.[0] || rawImg,
          status: b.status || 'CONFIRMED',
          stage: display.stage,
          stageLabel: display.shortLabel,
          stageTone: display.tone,
          depositAmount: display.isPhotoshootOnly ? 0 : deposit,
          assignedStaffId:
            photoSched?.assignedStaffId ||
            photoSched?.assignedStaffSnapshot?.staffId ||
            null,
          assignedStaffName: photoSched?.assignedStaffSnapshot?.name || null,
          checkedInAt: photoSched?.checkedInAt || null,
          shootFinishedAt: photoSched?.shootFinishedAt || null,
          rawOrder: b,
        });
      }

      if (!display.isPhotoshootOnly) {
        const isReturnPhase = [
          'IN_RENTAL',
          'CUSTOMER_RETURN_REQUESTED',
          'INCIDENT_PENDING_CUSTOMER',
          'RETURNED_NEEDS_INSPECTION',
          'CLEANING_AFTER_REFUND',
          'DISPUTED',
        ].includes(display.stage);

        if (isReturnPhase) {
          const returnId = `return-${b._id}`;
          seenIds.add(returnId);
          list.push({
            id: returnId,
            bookingId: b._id,
            bookingCode: code,
            type: 'RETURN',
            timeLabel: '17:30',
            dateStr: endDayKey,
            dateDisplay: endDateObj.toLocaleDateString('vi-VN'),
            customerName: custName,
            customerPhone: custPhone,
            serviceTitle: `Trả đồ & Hoàn cọc: ${itemTitle}${itemSize}`,
            locationAddress: addrText,
            coords: resolvedCoords,
            productImage: rawImg,
            status: b.status || 'PICKED_UP',
            stage: display.stage,
            stageLabel: display.shortLabel,
            stageTone: display.tone,
            depositAmount: deposit,
            rawOrder: b,
          });
        } else {
          const pickupId = `pickup-${b._id}`;
          seenIds.add(pickupId);
          list.push({
            id: pickupId,
            bookingId: b._id,
            bookingCode: code,
            type: 'PICKUP',
            timeLabel: '09:00',
            dateStr: startDayKey,
            dateDisplay: startDateObj.toLocaleDateString('vi-VN'),
            customerName: custName,
            customerPhone: custPhone,
            serviceTitle: `Nhận đồ: ${itemTitle}${itemSize}`,
            locationAddress: addrText,
            coords: resolvedCoords,
            productImage: rawImg,
            status: b.status || 'CONFIRMED',
            stage: display.stage,
            stageLabel: display.shortLabel,
            stageTone: display.tone,
            depositAmount: deposit,
            rawOrder: b,
          });
        }
      }
    });

    overviewSchedules.forEach((s, idx) => {
      const id = s.id || `sched-${idx}`;
      const bId = String(s.bookingId || '');
      const matchedOrder = bId ? bookingById.get(bId) : undefined;
      if (bId && matchedOrder) {
        const matchedStatus = String(matchedOrder.status || '').toUpperCase();
        if (hiddenBookingStatuses.has(matchedStatus)) {
          return;
        }
      }
      // If `bookings` loaded cleanly and this overview schedule still references an unknown/closed booking, skip orphan card
      if (bId && !matchedOrder && bookingsLoaded) {
        return;
      }
      const itemType = s.type || 'PHOTOSHOOT';
      const alreadyHasBooking =
        bId && list.some((it) => it.bookingId === bId && it.type === itemType);
      if (!seenIds.has(id) && !alreadyHasBooking) {
        const dt = s.startsAt ? new Date(s.startsAt) : new Date();
        const addrText =
          s.locationAddress || s.locationName || 'Địa điểm theo đơn hàng';
        const resolvedCoords = resolveEntityCoords({
          id,
          address: { addressLine: addrText },
        });
        const display = matchedOrder
          ? resolveBookingDisplayState(matchedOrder, 'provider')
          : null;
        list.push({
          id,
          bookingId: bId,
          bookingCode: s.bookingCode || matchedOrder?.bookingCode || '#TG',
          type: itemType,
          timeLabel: s.timeLabel || 'Theo lịch hẹn',
          dateStr: s.providerLocalDate || toVnDayKey(dt),
          dateDisplay: dt.toLocaleDateString('vi-VN'),
          customerName:
            matchedOrder?.customerId?.profile?.fullName ||
            matchedOrder?.contactInfo?.fullName ||
            s.customer?.name ||
            'Khách hàng TàGo',
          customerPhone:
            matchedOrder?.customerId?.auth?.phone ||
            matchedOrder?.contactInfo?.phone ||
            s.customer?.phone ||
            '',
          serviceTitle: s.serviceName || 'Lịch hẹn dịch vụ TàGo',
          locationAddress: addrText,
          coords: resolvedCoords,
          productImage: s.customer?.avatarUrl || null,
          status: matchedOrder?.status || s.status || 'CONFIRMED',
          stage: display?.stage,
          stageLabel: display?.shortLabel,
          stageTone: display?.tone,
          depositAmount: 0,
          assignedStaffId:
            s.assignedStaffId || s.assignedStaffSnapshot?.staffId || null,
          assignedStaffName: s.assignedStaffSnapshot?.name || null,
          rawOrder: matchedOrder,
        });
      }
    });

    return list;
  }, [bookings, bookingsLoaded, overviewSchedules]);

  // Build 7-day strip around today (Asia/Ho_Chi_Minh)
  const dayPills = useMemo(() => {
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const result: Array<{
      key: string;
      dayLabel: string;
      dateNum: string;
      count: number;
    }> = [];

    const today = new Date();
    for (let i = -1; i <= 5; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const key = toVnDayKey(d);
      const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
      const count = timelineItems.filter((it) => it.dateStr === key).length;
      result.push({
        key,
        dayLabel: i === 0 ? 'Hôm nay' : dayNames[vnDate.getUTCDay()],
        dateNum: `${vnDate.getUTCDate()}/${vnDate.getUTCMonth() + 1}`,
        count,
      });
    }
    return result;
  }, [timelineItems]);

  const filteredItems = useMemo(() => {
    return timelineItems.filter((it) => {
      if (selectedDayKey !== 'ALL_DAYS' && it.dateStr !== selectedDayKey) {
        return false;
      }
      if (typeFilter !== 'ALL' && it.type !== typeFilter) {
        return false;
      }
      if (staffFilter !== 'ALL') {
        if (it.type !== 'PHOTOSHOOT') return false;
        if (staffFilter === 'UNASSIGNED') {
          if (it.assignedStaffId) return false;
        } else if (String(it.assignedStaffId || '') !== staffFilter) {
          return false;
        }
      }
      return true;
    });
  }, [timelineItems, selectedDayKey, typeFilter, staffFilter]);

  const handleOpenDetail = (order: any) => {
    setSelectedOrder(order);
    setDetailVisible(true);
    if (order?._id) {
      void providerApi
        .getBookingDetail(order._id)
        .then((detail) => {
          if (detail?._id === order._id) {
            setSelectedOrder((prev: any) =>
              prev?._id === detail._id
                ? { ...prev, ...detail, incident: prev.incident ?? detail.activeIncident }
                : prev,
            );
          }
        })
        .catch(() => undefined);
    }
  };

  const submitStatusUpdate = async (
    order: any,
    nextStatus: string,
    note?: string,
    assignedStaffId?: string,
    assignedStaffName?: string,
  ) => {
    if (!order?._id) return;
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(
        order._id,
        nextStatus,
        assignedStaffId ? { note, assignedStaffId } : { note },
      );
      bumpBookingSync(order._id);
      show(
        assignedStaffName
          ? `Đã chấp nhận đơn #${order.bookingCode || ''} & phân công ${assignedStaffName}!`
          : `Đã cập nhật lịch hẹn đơn #${order.bookingCode || ''}!`,
        'success',
      );
      approveStaffPicker.close();
      setDetailVisible(false);
      void loadScheduleData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể cập nhật trạng thái';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (order: any, nextStatus: string, note?: string) => {
    if (!order?._id) return;
    if (nextStatus === 'CONFIRMED') {
      try {
        const openedPicker = await approveStaffPicker.checkNeedsStaffPicker(order, note);
        if (openedPicker) {
          setDetailVisible(false);
          return;
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message || 'Không thể tải danh sách thợ chụp rảnh';
        show(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }
    }
    await submitStatusUpdate(order, nextStatus, note);
  };

  const handleRentalAction = async (
    order: any,
    action: ProviderRentalActionType,
    itemId?: string,
  ) => {
    if (!order?._id) return;
    const myRentalItems = getRentalItems(order, true);
    const targetItem =
      (itemId ? myRentalItems.find((it) => it._id === itemId) : undefined) ||
      myRentalItems[0];

    if (!targetItem?._id) {
      show('Không tìm thấy sản phẩm cổ phục thuộc quyền shop', 'error');
      return;
    }

    if (action === 'HANDOVER') {
      setDetailVisible(false);
      setSelectedOrder(order);
      setWorkflowItemId(targetItem._id);
      setWorkflowMode('HANDOVER');
      return;
    }

    if (action === 'REPORT_INCIDENT') {
      setDetailVisible(false);
      setSelectedOrder(order);
      setWorkflowItemId(targetItem._id);
      setWorkflowMode('REPORT_INCIDENT');
      return;
    }

    setActionLoading(true);
    try {
      if (action === 'READY') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter(
              (it) => !it.rentalFulfillment?.status || it.rentalFulfillment.status === 'PENDING',
            );
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markRentalReady(order._id, it._id);
        }
        show('Đã xác nhận soạn xong áo! Hãy tải ảnh bàn giao.', 'success');
      } else if (action === 'RETURNED') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter(
              (it) => it.rentalFulfillment?.status === 'CUSTOMER_RETURN_REQUESTED',
            );
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markReturned(order._id, it._id, {
            note: 'Cửa hàng xác nhận đã nhận lại cổ phục từ khách.',
          });
        }
        show('Đã xác nhận nhận lại áo! Hãy kiểm tra & hoàn cọc.', 'success');
      } else if (action === 'CONFIRM_NO_INCIDENT') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter((it) => it.rentalFulfillment?.status === 'RETURNED');
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.confirmNoIncident(
            order._id,
            it._id,
            'Đã kiểm tra đồ nguyên vẹn & giải ngân hoàn cọc',
          );
        }
        show('Đã xác nhận không sự cố & hoàn cọc Escrow!', 'success');
      } else if (action === 'CLEANING_COMPLETED') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter((it) => it.rentalFulfillment?.status === 'RETURNED');
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markCleaningCompleted(order._id, it._id);
        }
        show('Đã hoàn tất giặt ủi & mở khóa kho!', 'success');
      }
      bumpBookingSync(order._id);
      setDetailVisible(false);
      void loadScheduleData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể xử lý thao tác thuê đồ';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleScheduleDay = (day: number) => {
    setSelectedScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSaveRecurringWorkingHours = async () => {
    if (selectedScheduleDays.length === 0) {
      show('Vui lòng chọn ít nhất 1 ngày mở cửa trong tuần', 'error');
      return;
    }
    setSavingScheduleConfig(true);
    try {
      await providerApi.saveRecurringSchedules({
        dayOfWeeks: selectedScheduleDays,
        workingHours: [{ start: openTime.trim() || '08:00', end: closeTime.trim() || '20:00' }],
        capability: 'AODAI_RENTAL',
      });
      show(
        `Đã lưu giờ mở cửa cố định (${openTime} - ${closeTime}) cho ${selectedScheduleDays.length} ngày/tuần!`,
        'success',
      );
      setScheduleConfigVisible(false);
      void loadScheduleData();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể lưu lịch cố định', 'error');
    } finally {
      setSavingScheduleConfig(false);
    }
  };

  const handleBlockDayAction = () => {
    setBlockModalVisible(true);
  };

  const handleConfirmBlockDate = async () => {
    const targetDay =
      selectedDayKey === 'ALL_DAYS' ? toVnDayKey(new Date()) : selectedDayKey;
    const isBlocked = blockedDates.includes(targetDay);

    setSavingScheduleConfig(true);
    try {
      await providerApi.blockDate({
        date: targetDay,
        isOffDay: !isBlocked,
        isAvailable: isBlocked,
        customSlots: [],
        capability: 'AODAI_RENTAL',
        reason: isBlocked ? 'Mở lại lịch' : blockReason.trim() || 'Tiệm bận / Đầy lịch',
      });
      show(
        isBlocked
          ? `Đã mở lại lịch ngày ${targetDay}`
          : `Đã khóa lịch bận ngày ${targetDay}`,
        'success',
      );
      setBlockModalVisible(false);
      void loadScheduleData();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể cập nhật lịch bận', 'error');
    } finally {
      setSavingScheduleConfig(false);
    }
  };

  const handleQuickTimelineAction = async (item: UnifiedTimelineItem) => {
    if (!item.rawOrder) {
      if (item.bookingId) {
        setActionLoading(true);
        try {
          const detail = await providerApi.getBookingDetail(item.bookingId);
          if (detail?._id) {
            setSelectedOrder(detail);
            setDetailVisible(true);
            return;
          }
        } catch {
          // Fall through to gentle notice below
        } finally {
          setActionLoading(false);
        }
      }
      show('Không tìm thấy thông tin đơn hàng để xử lý thủ công', 'info');
      return;
    }

    const order = item.rawOrder;
    const display = resolveBookingDisplayState(order, 'provider');
    const stage = display.stage;
    const firstRental = getRentalItems(order, true)[0];

    setSelectedOrder(order);

    if (stage === 'DEPOSIT_PAID') {
      TagoAlert.alert(
        'Xác nhận nhận lịch hẹn',
        `Bạn đồng ý tiếp nhận lịch hẹn ${item.bookingCode} từ khách ${item.customerName}?\nSau khi xác nhận mới có thể bắt đầu ca chụp hoặc soạn cổ phục.`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Từ chối lịch',
            style: 'destructive',
            onPress: () => {
              setWorkflowItemId(null);
              setWorkflowMode('CANCEL_ORDER');
            },
          },
          {
            text: 'Xác nhận nhận lịch',
            onPress: () =>
              void handleStatusUpdate(
                order,
                'CONFIRMED',
                display.isPhotoshootOnly
                  ? 'Đã chấp nhận lịch chụp'
                  : 'Đã xác nhận đơn và chuẩn bị cổ phục',
              ),
          },
        ],
      );
      return;
    }

    if (stage === 'PREPARING') {
      if (item.type === 'PHOTOSHOOT' && !display.isCombo) {
        TagoAlert.alert(
          'Bắt đầu ca chụp',
          `Xác nhận bắt đầu buổi chụp cho khách ${item.customerName}?`,
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Bắt đầu ngay',
              onPress: () => void handleStatusUpdate(order, 'IN_PROGRESS', 'Bắt đầu ca chụp'),
            },
          ],
        );
      } else {
        void handleRentalAction(order, 'READY', firstRental?._id);
      }
      return;
    }

    if (stage === 'READY_NEEDS_HANDOVER_PHOTOS') {
      setWorkflowItemId(firstRental?._id || null);
      setWorkflowMode('HANDOVER');
      return;
    }

    if (stage === 'CUSTOMER_RETURN_REQUESTED') {
      TagoAlert.alert(
        'Xác nhận đã nhận trả đồ',
        `Khách ${item.customerName} đã giao lại cổ phục tại quầy?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đã nhận trả đồ',
            onPress: () => void handleRentalAction(order, 'RETURNED', firstRental?._id),
          },
        ],
      );
      return;
    }

    if (stage === 'RETURNED_NEEDS_INSPECTION') {
      TagoAlert.alert(
        'Kiểm tra & Hoàn cọc Escrow',
        `Xác nhận áo nguyên vẹn và giải ngân hoàn cọc cho khách ${item.customerName}?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Hoàn cọc ngay',
            onPress: () =>
              void handleRentalAction(order, 'CONFIRM_NO_INCIDENT', firstRental?._id),
          },
        ],
      );
      return;
    }

    if (stage === 'CLEANING_AFTER_REFUND') {
      TagoAlert.alert(
        'Hoàn tất giặt ủi & Nhập kho',
        'Xác nhận cổ phục đã giặt ủi xong và sẵn sàng mở kho cho thuê lại?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Hoàn tất giặt ủi',
            onPress: () =>
              void handleRentalAction(order, 'CLEANING_COMPLETED', firstRental?._id),
          },
        ],
      );
      return;
    }

    if (stage === 'IN_PROGRESS' || stage === 'AWAITING_REVIEW') {
      setWorkflowItemId(null);
      setWorkflowMode('DELIVER_PHOTOS');
      return;
    }

    if (stage === 'COMBO_PHOTOS_APPROVED') {
      TagoAlert.alert(
        'Hoàn tất đơn hàng',
        'Ảnh đã được khách duyệt xong. Xác nhận hoàn tất toàn bộ đơn hàng?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Hoàn tất đơn',
            onPress: () =>
              void handleStatusUpdate(order, 'COMPLETED', 'Đã hoàn tất toàn bộ dịch vụ'),
          },
        ],
      );
      return;
    }

    handleOpenDetail(order);
  };

  const providerOrigin = useMemo(
    () =>
      resolveEntityCoords(
        providerProfile || {
          address: { city: 'Huế', addressLine: 'Cung An Định, TP. Huế' },
        },
      ),
    [providerProfile],
  );

  const routeMarkers = useMemo<MapMarkerItem[]>(
    () =>
      filteredItems.map((it, idx) => {
        const dist = haversineKm(providerOrigin, it.coords);
        return {
          id: it.id,
          lat: it.coords.lat,
          lng: it.coords.lng,
          title: `${it.timeLabel} · ${it.customerName}`,
          subtitle: `${it.locationAddress.split(',')[0]} (${formatDistance(dist)})`,
          stepNumber: idx + 1,
          color:
            it.type === 'PHOTOSHOOT'
              ? '#910C3F'
              : it.type === 'PICKUP'
                ? '#0284C7'
                : '#059669',
          isSelected: idx === 0,
        };
      }),
    [filteredItems, providerOrigin],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleCol}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              TÀGO PARTNER PRO
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              Lịch hẹn & Lộ trình
            </Text>
          </View>

          <View style={styles.headerActionsRow}>
            <Pressable
              style={[
                styles.qrQuickBtn,
                viewMode === 'MAP' && {
                  backgroundColor: '#BA0049',
                  borderColor: '#BA0049',
                },
              ]}
              onPress={() => setViewMode((v) => (v === 'LIST' ? 'MAP' : 'LIST'))}
            >
              <Ionicons
                name={viewMode === 'MAP' ? 'list-outline' : 'map-outline'}
                size={14}
                color={viewMode === 'MAP' ? '#FFFFFF' : '#BA0049'}
              />
              <Text
                style={[
                  styles.qrQuickBtnText,
                  viewMode === 'MAP' && { color: '#FFFFFF' },
                ]}
              >
                {viewMode === 'MAP' ? 'Danh sách' : 'Bản đồ lộ trình'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.qrQuickBtn}
              onPress={() => setScheduleConfigVisible(true)}
            >
              <Ionicons name="time-outline" size={14} color="#BA0049" />
              <Text style={styles.qrQuickBtnText}>Giờ mở cửa</Text>
            </Pressable>

            <Pressable
              style={styles.qrQuickBtn}
              onPress={() => router.push('/provider/staff' as Href)}
            >
              <Ionicons name="people-outline" size={14} color="#BA0049" />
              <Text style={styles.qrQuickBtnText}>Đội ngũ</Text>
            </Pressable>

            <Pressable style={styles.qrQuickBtn} onPress={handleBlockDayAction}>
              <Ionicons name="calendar-clear-outline" size={14} color="#BA0049" />
              <Text style={styles.qrQuickBtnText}>Khóa lịch</Text>
            </Pressable>
          </View>
        </View>

        {/* Horizontal 7-Day Strip + All Days Option */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScrollWrap}
          contentContainerStyle={styles.calendarStrip}
        >
          <Pressable
            style={[
              styles.dayCard,
              selectedDayKey === 'ALL_DAYS' && styles.dayCardActive,
            ]}
            onPress={() => setSelectedDayKey('ALL_DAYS')}
          >
            <Text
              style={[
                styles.dayLabel,
                selectedDayKey === 'ALL_DAYS' && styles.dayTextActive,
              ]}
            >
              Tất cả
            </Text>
            <Text
              style={[
                styles.dayDate,
                selectedDayKey === 'ALL_DAYS' && styles.dayTextActive,
              ]}
            >
              {timelineItems.length} lịch
            </Text>
          </Pressable>

          {dayPills.map((d) => {
            const active = selectedDayKey === d.key;
            return (
              <Pressable
                key={d.key}
                style={[styles.dayCard, active && styles.dayCardActive]}
                onPress={() => setSelectedDayKey(d.key)}
              >
                <Text style={[styles.dayLabel, active && styles.dayTextActive]}>
                  {d.dayLabel}
                </Text>
                <Text style={[styles.dayDate, active && styles.dayTextActive]}>
                  {d.dateNum}
                </Text>
                {d.count > 0 && (
                  <View
                    style={[
                      styles.dayDot,
                      active ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#BA0049' },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Filter Type Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScrollWrap}
          contentContainerStyle={styles.typeFilterRow}
        >
          {(
            [
              { key: 'ALL', label: `Tất cả (${timelineItems.length})` },
              {
                key: 'PICKUP',
                label: `Hẹn lấy áo (${timelineItems.filter((i) => i.type === 'PICKUP').length})`,
              },
              {
                key: 'RETURN',
                label: `Hẹn trả đồ (${timelineItems.filter((i) => i.type === 'RETURN').length})`,
              },
              {
                key: 'PHOTOSHOOT',
                label: `Ca chụp (${timelineItems.filter((i) => i.type === 'PHOTOSHOOT').length})`,
              },
            ] as const
          ).map((f) => {
            const active = typeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.typePill, active && styles.typePillActive]}
                onPress={() => setTypeFilter(f.key)}
              >
                <Text style={[styles.typePillText, active && styles.typePillTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Staff Filter Pills */}
        {staffMembers.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScrollWrap}
            contentContainerStyle={styles.typeFilterRow}
          >
            <Pressable
              style={[
                styles.typePill,
                staffFilter === 'ALL' && styles.staffPillActive,
              ]}
              onPress={() => setStaffFilter('ALL')}
            >
              <Text
                style={[
                  styles.typePillText,
                  staffFilter === 'ALL' && styles.typePillTextActive,
                ]}
              >
                Mọi thợ chụp
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typePill,
                staffFilter === 'UNASSIGNED' && styles.staffPillActive,
              ]}
              onPress={() => setStaffFilter('UNASSIGNED')}
            >
              <Text
                style={[
                  styles.typePillText,
                  staffFilter === 'UNASSIGNED' && styles.typePillTextActive,
                ]}
              >
                Chưa phân thợ (
                {
                  timelineItems.filter(
                    (it) => it.type === 'PHOTOSHOOT' && !it.assignedStaffId,
                  ).length
                }
                )
              </Text>
            </Pressable>

            {staffMembers.map((st) => {
              const active = staffFilter === st._id;
              return (
                <Pressable
                  key={st._id}
                  style={[styles.typePill, active && styles.staffPillActive]}
                  onPress={() => setStaffFilter(st._id)}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      active && styles.typePillTextActive,
                    ]}
                  >
                    {st.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#BA0049" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#BA0049"
              colors={['#BA0049']}
            />
          }
        >
          {/* Per-Slot Capacity Load Summary for Studio Owner (when a day is selected or shoots exist) */}
          {selectedDayKey !== 'ALL_DAYS' && staffMembers.length > 0 && (() => {
            const activeStaffPool = staffMembers.filter((st) => st.status === 'ACTIVE');
            const baseCap = Math.max(
              1,
              staffSummary?.effectiveCapacity ?? (activeStaffPool.length || 1),
            );
            const maxDaily = staffSummary?.maxDailySessions ?? null;
            const dayShoots = timelineItems.filter(
              (it) =>
                it.type === 'PHOTOSHOOT' &&
                it.dateStr === selectedDayKey &&
                it.status !== 'CANCELLED' &&
                it.status !== 'REFUNDED',
            );

            const grouped = new Map<
              string,
              { label: string; count: number; unassigned: number }
            >();
            for (const sh of dayShoots) {
              const label = (sh.timeLabel || 'Theo lịch hẹn').replace('-', ' – ');
              const prev = grouped.get(label) || { label, count: 0, unassigned: 0 };
              prev.count += 1;
              if (!sh.assignedStaffId) prev.unassigned += 1;
              grouped.set(label, prev);
            }
            const rows = Array.from(grouped.values()).sort((a, b) =>
              a.label.localeCompare(b.label),
            );
            const dailyRem =
              maxDaily && maxDaily > 0 ? Math.max(0, maxDaily - dayShoots.length) : null;

            return (
              <View style={styles.slotLoadCard}>
                <View style={styles.slotLoadHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="layers-outline" size={14} color="#8E1B2E" />
                    <Text style={styles.slotLoadTitle}>TẢI SUẤT KHUNG GIỜ TRONG NGÀY</Text>
                  </View>
                  <View
                    style={[
                      styles.slotLoadDailyPill,
                      dailyRem === 0 && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotLoadDailyText,
                        dailyRem === 0 && { color: '#B91C1C' },
                      ]}
                    >
                      {maxDaily
                        ? `Ngày: ${dayShoots.length}/${maxDaily} ca`
                        : `${dayShoots.length} ca · Tối đa ${baseCap}/giờ`}
                    </Text>
                  </View>
                </View>

                {rows.length === 0 ? (
                  <Text style={styles.slotLoadEmpty}>
                    Chưa có ca chụp nào — toàn bộ khung giờ mở tối đa {baseCap} suất/giờ.
                  </Text>
                ) : (
                  <View style={{ gap: 7 }}>
                    {rows.map((row) => {
                      const rawRem = Math.max(0, baseCap - row.count);
                      const rem = dailyRem !== null ? Math.min(rawRem, dailyRem) : rawRem;
                      const isFull = rem <= 0;
                      const isLast = !isFull && rem === 1 && baseCap > 1;
                      const fillPct = Math.min(100, Math.round((row.count / baseCap) * 100));

                      return (
                        <View
                          key={row.label}
                          style={[
                            styles.slotLoadRow,
                            isFull && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                          ]}
                        >
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={styles.slotLoadTime}>{row.label}</Text>
                            <View style={styles.slotLoadBarBg}>
                              <View
                                style={[
                                  styles.slotLoadBarFill,
                                  {
                                    width: `${fillPct}%`,
                                    backgroundColor: isFull
                                      ? '#DC2626'
                                      : isLast
                                        ? '#EA580C'
                                        : '#10B981',
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 3 }}>
                            <View
                              style={[
                                styles.slotLoadBadge,
                                isFull
                                  ? { backgroundColor: '#FEE2E2' }
                                  : isLast
                                    ? { backgroundColor: '#FFEDD5' }
                                    : { backgroundColor: '#ECFDF5' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.slotLoadBadgeText,
                                  isFull
                                    ? { color: '#B91C1C' }
                                    : isLast
                                      ? { color: '#C2410C' }
                                      : { color: '#047857' },
                                ]}
                              >
                                {isFull
                                  ? `Đã kín (${row.count}/${baseCap})`
                                  : `Nhận ${row.count}/${baseCap} · Còn ${rem}`}
                              </Text>
                            </View>
                            {row.unassigned > 0 && (
                              <Text style={styles.slotLoadUnassigned}>
                                {row.unassigned} đơn chờ phân thợ
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Daily Multi-Stop Route Map Banner / View */}
          {filteredItems.length > 0 && (
            <View style={styles.routeMapBannerCard}>
              <View style={styles.routeMapHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeMapEyebrow}>
                    BẢN ĐỒ LỘ TRÌNH DI CHUYỂN TRONG NGÀY
                  </Text>
                  <Text style={styles.routeMapTitle}>
                    {filteredItems.length} điểm hẹn ({filteredItems.filter((i) => i.type === 'PHOTOSHOOT').length} ca chụp · {filteredItems.filter((i) => i.type !== 'PHOTOSHOOT').length} lấy/trả đồ)
                  </Text>
                </View>
                <Pressable
                  style={styles.routeMapToggleBtn}
                  onPress={() => setViewMode((v) => (v === 'MAP' ? 'LIST' : 'MAP'))}>
                  <Ionicons
                    name={viewMode === 'MAP' ? 'chevron-up' : 'map'}
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.routeMapToggleText}>
                    {viewMode === 'MAP' ? 'Thu gọn' : 'Mở Bản đồ'}
                  </Text>
                </Pressable>
              </View>

              {viewMode === 'MAP' && (
                <View style={{ marginTop: 10, gap: 10 }}>
                  <View style={{ borderRadius: 16, overflow: 'hidden' }}>
                    <TagoMapView
                      center={filteredItems[0]?.coords || providerOrigin}
                      zoom={13}
                      height={270}
                      userLocation={{
                        ...providerOrigin,
                        label: providerProfile?.businessName || 'Studio xuất phát',
                      }}
                      markers={routeMarkers}
                      routeLine={{
                        from: providerOrigin,
                        to:
                          filteredItems[filteredItems.length - 1]?.coords ||
                          providerOrigin,
                        points: [
                          providerOrigin,
                          ...filteredItems.map((it) => it.coords),
                        ],
                        color: '#910C3F',
                      }}
                      onMarkerPress={(id) => {
                        const found = filteredItems.find((it) => it.id === id);
                        if (found) {
                          setNavOrder(found.rawOrder || null);
                          setNavModalVisible(true);
                        }
                      }}
                    />
                  </View>
                  <Text style={styles.routeMapHint}>
                    💡 Chạm vào từng trạm đánh số (1, 2, 3...) trên bản đồ để mở chế độ dẫn đường tới chỗ khách.
                  </Text>
                </View>
              )}
            </View>
          )}

          {filteredItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="calendar-outline" size={30} color="#BA0049" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có lịch hẹn trong ngày này</Text>
              <Text style={styles.emptySub}>
                Chạm vào mục "Tất cả" trên thanh lịch để xem toàn bộ lịch hẹn lấy/trả cổ phục sắp tới.
              </Text>
              {selectedDayKey !== 'ALL_DAYS' && (
                <Pressable
                  style={styles.showAllBtn}
                  onPress={() => setSelectedDayKey('ALL_DAYS')}
                >
                  <Text style={styles.showAllBtnText}>Xem tất cả lịch hẹn</Text>
                </Pressable>
              )}
            </View>
          ) : (
            filteredItems.map((item) => {
              const isPickup = item.type === 'PICKUP';
              const isReturn = item.type === 'RETURN';

              const typeBadgeBg = isPickup
                ? '#FFF0F3'
                : isReturn
                  ? '#ECFDF5'
                  : '#FFFBEB';
              const typeBadgeColor = isPickup
                ? '#BA0049'
                : isReturn
                  ? '#059669'
                  : '#B45309';
              const typeLabel = isPickup
                ? 'Hẹn lấy cổ phục'
                : isReturn
                  ? 'Hẹn trả & Hoàn cọc'
                  : 'Ca chụp ngoại cảnh';

              const toneStyle =
                item.stageTone === 'success'
                  ? { bg: '#ECFDF5', text: '#047857' }
                  : item.stageTone === 'warning'
                    ? { bg: '#FEF3C7', text: '#B45309' }
                    : item.stageTone === 'error'
                      ? { bg: '#FEE2E2', text: '#B91C1C' }
                      : item.stageTone === 'info'
                        ? { bg: '#E0F2FE', text: '#0369A1' }
                        : { bg: '#F5F5F4', text: '#57534E' };
              const actionButtonLabel =
                item.stage === 'DEPOSIT_PAID'
                  ? 'Xác nhận lịch'
                  : item.stage === 'PREPARING'
                    ? item.type === 'PHOTOSHOOT'
                      ? 'Bắt đầu chụp'
                      : 'Soạn xong áo'
                    : item.stage === 'READY_NEEDS_HANDOVER_PHOTOS'
                      ? 'Bàn giao (Ảnh)'
                      : item.stage === 'HANDOVER_AWAITING_CUSTOMER'
                        ? 'Chờ khách xác nhận'
                        : item.stage === 'IN_RENTAL'
                          ? 'Đang thuê'
                          : item.stage === 'CUSTOMER_RETURN_REQUESTED'
                            ? 'Nhận trả đồ'
                            : item.stage === 'RETURNED_NEEDS_INSPECTION'
                              ? 'Hoàn cọc Escrow'
                              : item.stage === 'CLEANING_AFTER_REFUND'
                                ? 'Xong giặt ủi'
                                : item.stage === 'INCIDENT_PENDING_CUSTOMER' ||
                                    item.stage === 'DISPUTED'
                                  ? 'Xem sự cố'
                                  : item.stage === 'IN_PROGRESS' ||
                                      item.stage === 'AWAITING_REVIEW'
                                    ? 'Trả file ảnh'
                                    : item.stage === 'COMBO_PHOTOS_APPROVED'
                                      ? 'Hoàn tất đơn'
                                      : 'Xem chi tiết';

              return (
                <View key={item.id} style={styles.timelineRow}>
                  {/* Left Time Column */}
                  <View style={styles.timeCol}>
                    <Text style={styles.timeText}>{item.timeLabel}</Text>
                    <Text style={styles.dateSmallText}>{item.dateDisplay}</Text>
                    <View style={styles.timelineLine} />
                  </View>

                  {/* Right Schedule Detail Card */}
                  <View style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                        <View
                          style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}
                        >
                          <Text style={[styles.typeBadgeText, { color: typeBadgeColor }]}>
                            {typeLabel}
                          </Text>
                        </View>
                        {item.stageLabel ? (
                          <View
                            style={[styles.stagePill, { backgroundColor: toneStyle.bg }]}
                          >
                            <Text style={[styles.stagePillText, { color: toneStyle.text }]}>
                              {item.stageLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.bookingCodeText}>{item.bookingCode}</Text>
                    </View>

                    <View style={styles.cardBodyRow}>
                      {item.productImage ? (
                        <Image
                          source={{ uri: getMediaUrl(item.productImage) }}
                          style={styles.itemThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.itemThumbFallback}>
                          <MaterialIcons name="checkroom" size={22} color="#BA0049" />
                        </View>
                      )}

                      <View style={styles.cardInfoCol}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {item.customerName}
                        </Text>
                        <Text style={styles.serviceText} numberOfLines={2}>
                          {item.serviceTitle}
                        </Text>
                        <Pressable
                          style={styles.locationMiniRow}
                          onPress={() => {
                            setNavOrder(item.rawOrder || null);
                            setNavModalVisible(true);
                          }}>
                          <Ionicons name="location" size={12} color="#BA0049" />
                          <Text style={styles.locationMiniText} numberOfLines={1}>
                            {item.locationAddress} · Cách{' '}
                            {formatDistance(haversineKm(providerOrigin, item.coords))}
                          </Text>
                        </Pressable>
                        {item.depositAmount > 0 && (
                          <Text style={styles.depositHint}>
                            Cọc giữ hộ Escrow: {item.depositAmount.toLocaleString('vi-VN')} đ
                          </Text>
                        )}
                        {item.type === 'PHOTOSHOOT' && (
                          <View style={styles.staffBadgeRow}>
                            <View
                              style={[
                                styles.staffAssignedBadge,
                                item.assignedStaffName
                                  ? styles.staffAssignedBadgeOk
                                  : styles.staffAssignedBadgeWarn,
                              ]}
                            >
                              <Ionicons
                                name={
                                  item.assignedStaffName
                                    ? 'camera-outline'
                                    : 'alert-circle-outline'
                                }
                                size={11}
                                color={
                                  item.assignedStaffName ? '#047857' : '#B45309'
                                }
                              />
                              <Text
                                style={[
                                  styles.staffAssignedBadgeText,
                                  {
                                    color: item.assignedStaffName
                                      ? '#047857'
                                      : '#B45309',
                                  },
                                ]}
                              >
                                {item.assignedStaffName
                                  ? `Thợ: ${item.assignedStaffName}`
                                  : 'Chưa phân thợ'}
                              </Text>
                            </View>
                            {item.shootFinishedAt ? (
                              <Text style={styles.staffFieldStatusText}>
                                · Đã xong chụp
                              </Text>
                            ) : item.checkedInAt ? (
                              <Text style={styles.staffFieldStatusText}>
                                · Đã check-in
                              </Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Action Row */}
                    <View style={styles.cardFooterRow}>
                      <View style={styles.footerLeftGroup}>
                        <Pressable
                          style={styles.navQuickBtn}
                          onPress={() => {
                            if (item.rawOrder) {
                              setNavOrder(item.rawOrder);
                              setNavModalVisible(true);
                            } else {
                              void openExternalDirections({
                                lat: item.coords.lat,
                                lng: item.coords.lng,
                                label: item.locationAddress,
                                originLat: providerOrigin.lat,
                                originLng: providerOrigin.lng,
                              });
                            }
                          }}>
                          <Ionicons name="navigate" size={13} color="#BA0049" />
                          <Text style={styles.navQuickBtnText} numberOfLines={1}>
                            Chỉ đường
                          </Text>
                        </Pressable>

                        {item.customerPhone ? (
                          <Pressable
                            style={styles.callBtn}
                            onPress={() =>
                              void Linking.openURL(
                                `tel:${item.customerPhone.replace(/[^0-9+]/g, '')}`,
                              )
                            }
                          >
                            <Ionicons name="call-outline" size={14} color="#1B1C1C" />
                            <Text style={styles.callBtnText} numberOfLines={1}>
                              Gọi
                            </Text>
                          </Pressable>
                        ) : null}

                        {item.rawOrder && (
                          <Pressable
                            style={styles.detailOutlineBtn}
                            onPress={() => handleOpenDetail(item.rawOrder)}
                          >
                            <Text style={styles.detailOutlineText} numberOfLines={1}>
                              Chi tiết
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                        {item.stage === 'DEPOSIT_PAID' && item.rawOrder ? (
                          <Pressable
                            style={styles.rejectOutlineBtn}
                            onPress={() => {
                              setSelectedOrder(item.rawOrder);
                              setWorkflowItemId(null);
                              setWorkflowMode('CANCEL_ORDER');
                            }}
                          >
                            <Text style={styles.rejectOutlineText} numberOfLines={1}>
                              Từ chối
                            </Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          style={styles.primaryBtn}
                          onPress={() => void handleQuickTimelineAction(item)}
                        >
                          <Text style={styles.primaryBtnText} numberOfLines={1}>
                            {actionButtonLabel}
                          </Text>
                          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <OrderDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        order={selectedOrder}
        actionLoading={actionLoading}
        onAction={(order, nextStatus) => handleStatusUpdate(order, nextStatus)}
        onRentalAction={handleRentalAction}
        onOpenWorkflowModal={(order, mode, itemId) => {
          setDetailVisible(false);
          setSelectedOrder(order);
          setWorkflowItemId(itemId || null);
          setWorkflowMode(mode);
        }}
        onOpenChat={() => {
          setDetailVisible(false);
          void openOrderCustomerChat(selectedOrder);
        }}
        onOpenNavigationMap={(order) => {
          setDetailVisible(false);
          setNavOrder(order);
          setNavModalVisible(true);
        }}
        onOrderUpdated={() => {
          if (selectedOrder?._id) {
            void providerApi
              .getBookingDetail(selectedOrder._id)
              .then((detail) => {
                if (detail?._id === selectedOrder._id) {
                  setSelectedOrder((prev: any) =>
                    prev?._id === detail._id
                      ? { ...prev, ...detail, incident: prev.incident ?? detail.activeIncident }
                      : prev,
                  );
                }
              })
              .catch(() => undefined);
          }
          void loadScheduleData();
        }}
      />

      <ApproveStaffPickerModal
        visible={approveStaffPicker.visible}
        bookingCode={approveStaffPicker.pendingOrder?.bookingCode}
        dateKey={approveStaffPicker.dateKey}
        timeSlot={approveStaffPicker.timeSlot}
        staff={approveStaffPicker.staff}
        loading={approveStaffPicker.loading}
        submitting={actionLoading}
        onClose={approveStaffPicker.close}
        onConfirm={(staffId, staffName) => {
          if (approveStaffPicker.pendingOrder) {
            void submitStatusUpdate(
              approveStaffPicker.pendingOrder,
              'CONFIRMED',
              approveStaffPicker.pendingNote,
              staffId,
              staffName,
            );
          }
        }}
      />

      <ProviderJobNavigationModal
        visible={navModalVisible}
        onClose={() => setNavModalVisible(false)}
        order={navOrder}
        providerProfile={providerProfile}
        requiresConfirmation={
          navOrder
            ? resolveBookingDisplayState(navOrder, 'provider').stage === 'DEPOSIT_PAID'
            : false
        }
        canStartSession={
          navOrder
            ? ['PREPARING', 'IN_RENTAL'].includes(
                resolveBookingDisplayState(navOrder, 'provider').stage,
              )
            : false
        }
        onConfirmBooking={() => {
          if (navOrder) {
            void handleStatusUpdate(navOrder, 'CONFIRMED', 'Đã xác nhận nhận lịch chụp');
          }
        }}
        onOpenChat={(ord) => void openOrderCustomerChat(ord || navOrder)}
        onStartSession={(bookingId) => {
          const target = navOrder || (bookingId ? bookings.find((b) => b._id === bookingId) : null);
          if (target) {
            const st = resolveBookingDisplayState(target, 'provider').stage;
            if (st === 'DEPOSIT_PAID') {
              void handleStatusUpdate(target, 'CONFIRMED', 'Đã xác nhận nhận lịch chụp');
              return;
            }
          }
          if (bookingId) {
            void providerApi
              .startSession(bookingId)
              .then(() => {
                bumpBookingSync(bookingId);
                show('Đã bắt đầu ca chụp thành công!', 'success');
                void loadScheduleData();
              })
              .catch(() => show('Không thể cập nhật trạng thái ca chụp', 'error'));
          }
        }}
      />

      <ProviderOrderWorkflowModal
        visible={workflowMode !== null}
        mode={workflowMode}
        order={selectedOrder}
        targetItemId={workflowItemId}
        onClose={() => {
          setWorkflowMode(null);
          setWorkflowItemId(null);
        }}
        onSuccess={() => {
          const updatedId = selectedOrder?._id;
          setWorkflowMode(null);
          setWorkflowItemId(null);
          bumpBookingSync(updatedId);
          void loadScheduleData();
        }}
      />

      {/* Recurring Working Hours Modal (Web CalendarPanel Parity) */}
      <Modal
        visible={scheduleConfigVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleConfigVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setScheduleConfigVisible(false)}
          />
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={styles.eyebrow}>LỊCH LÀM VIỆC CỐ ĐỊNH</Text>
                <Text style={styles.title}>Giờ mở cửa tiệm theo tuần</Text>
              </View>
              <Pressable onPress={() => setScheduleConfigVisible(false)}>
                <Ionicons name="close" size={22} color="#1B1C1C" />
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 12,
                fontFamily: FontFamily.bodySemiBold,
                color: '#5F5E5E',
              }}
            >
              Chọn các thứ mở cửa đón khách trong tuần:
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { day: 1, label: 'Thứ 2' },
                { day: 2, label: 'Thứ 3' },
                { day: 3, label: 'Thứ 4' },
                { day: 4, label: 'Thứ 5' },
                { day: 5, label: 'Thứ 6' },
                { day: 6, label: 'Thứ 7' },
                { day: 0, label: 'Chủ Nhật' },
              ].map((d) => {
                const active = selectedScheduleDays.includes(d.day);
                return (
                  <Pressable
                    key={d.day}
                    onPress={() => toggleScheduleDay(d.day)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 99,
                      backgroundColor: active ? '#BA0049' : '#FBF9F9',
                      borderWidth: 1,
                      borderColor: active ? '#BA0049' : '#EFECEB',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: FontFamily.bodyBold,
                        color: active ? '#FFFFFF' : '#1B1C1C',
                      }}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: FontFamily.bodyBold,
                    color: '#1B1C1C',
                    marginBottom: 6,
                  }}
                >
                  Giờ mở cửa (HH:mm)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#FBF9F9',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    fontFamily: FontFamily.bodyBold,
                  }}
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="08:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: FontFamily.bodyBold,
                    color: '#1B1C1C',
                    marginBottom: 6,
                  }}
                >
                  Giờ đóng cửa (HH:mm)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#FBF9F9',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    fontFamily: FontFamily.bodyBold,
                  }}
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="20:00"
                />
              </View>
            </View>

            <Pressable
              style={{
                backgroundColor: '#BA0049',
                height: 46,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 6,
              }}
              disabled={savingScheduleConfig}
              onPress={handleSaveRecurringWorkingHours}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontFamily: FontFamily.bodyBold,
                }}
              >
                {savingScheduleConfig
                  ? 'Đang lưu cấu hình...'
                  : 'Lưu giờ mở cửa cố định'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Custom TàGo Block Date Modal (Thay thế Alert.alert mặc định của Android) */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBlockModalVisible(false)}
          />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 20,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FFF0F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="calendar-clear" size={20} color="#BA0049" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>QUẢN LÝ LỊCH TIỆM</Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: FontFamily.bodyBold,
                    color: '#1B1C1C',
                  }}
                >
                  Khóa lịch bận theo ngày
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 13,
                fontFamily: FontFamily.body,
                color: '#5F5E5E',
                lineHeight: 19,
              }}
            >
              Ngày áp dụng:{' '}
              <Text style={{ fontFamily: FontFamily.bodyBold, color: '#BA0049' }}>
                {selectedDayKey === 'ALL_DAYS'
                  ? new Date().toLocaleDateString('vi-VN')
                  : new Date(selectedDayKey).toLocaleDateString('vi-VN')}
              </Text>
              {'\n'}Khách hàng sẽ không thể đặt lịch thuê hoặc chụp mới vào ngày này.
            </Text>

            <TextInput
              style={{
                backgroundColor: '#FBF9F9',
                borderWidth: 1,
                borderColor: '#EFECEB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 13,
                fontFamily: FontFamily.body,
                color: '#1B1C1C',
              }}
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="Nhập lý do (VD: Tiệm kín lịch / Nghỉ lễ)"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#F5F3F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setBlockModalVisible(false)}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: FontFamily.bodySemiBold,
                    color: '#5F5E5E',
                  }}
                >
                  Đóng
                </Text>
              </Pressable>

              <Pressable
                style={{
                  flex: 1.3,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#BA0049',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                disabled={savingScheduleConfig}
                onPress={handleConfirmBlockDate}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: FontFamily.bodyBold,
                    color: '#FFFFFF',
                  }}
                >
                  {savingScheduleConfig ? 'Đang lưu...' : 'Xác nhận khóa lịch'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },
  header: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    gap: 10,
  },
  horizontalScrollWrap: {
    width: '100%',
    flexGrow: 0,
  },
  headerTopRow: {
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    letterSpacing: -0.3,
  },
  qrQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  qrQuickBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  calendarStrip: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayCard: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCardActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  dayLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5F5E5E',
  },
  dayDate: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  typeFilterRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  typePill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#F5F3F3',
  },
  typePillActive: {
    backgroundColor: '#1B1C1C',
  },
  typePillText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5F5E5E',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    textAlign: 'center',
    lineHeight: 18,
  },
  showAllBtn: {
    marginTop: 8,
    backgroundColor: '#BA0049',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 99,
  },
  showAllBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeCol: {
    width: 50,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  dateSmallText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: '#FFD9DE',
    marginTop: 6,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 10,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
  },
  stagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  stagePillText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
  },
  bookingCodeText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#5F5E5E',
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemThumb: {
    width: 52,
    height: 60,
    borderRadius: 11,
    backgroundColor: '#F5F3F3',
  },
  itemThumbFallback: {
    width: 52,
    height: 60,
    borderRadius: 11,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  customerName: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  serviceText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  depositHint: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#059669',
    marginTop: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    paddingTop: 10,
  },
  footerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  callBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#1B1C1C',
  },
  detailOutlineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  detailOutlineText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5F5E5E',
  },
  rejectOutlineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  rejectOutlineText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#DC2626',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 99,
    flexShrink: 1,
  },
  primaryBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  routeMapBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  routeMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  routeMapEyebrow: {
    fontSize: 9.5,
    fontFamily: FontFamily.bodyBold,
    letterSpacing: 0.7,
    color: '#BA0049',
  },
  routeMapTitle: {
    fontSize: 13.5,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 2,
  },
  routeMapToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  routeMapToggleText: {
    fontSize: 11.5,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  routeMapHint: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    lineHeight: 16,
  },
  locationMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationMiniText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
  },
  navQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  navQuickBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  staffPillActive: {
    backgroundColor: '#BA0049',
  },
  staffBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  staffAssignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  staffAssignedBadgeOk: {
    backgroundColor: '#ECFDF5',
  },
  staffAssignedBadgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  staffAssignedBadgeText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bodyBold,
  },
  staffFieldStatusText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bodySemiBold,
    color: '#0369A1',
  },
  slotLoadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7DAC9',
    padding: 13,
    marginBottom: 12,
    gap: 9,
  },
  slotLoadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotLoadTitle: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#8E1B2E',
    letterSpacing: 0.4,
  },
  slotLoadDailyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FCF9F2',
    borderWidth: 1,
    borderColor: '#E7DAC9',
  },
  slotLoadDailyText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bodyBold,
    color: '#6B5E54',
  },
  slotLoadEmpty: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#6B5E54',
  },
  slotLoadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#ECE5DB',
  },
  slotLoadTime: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1F2937',
  },
  slotLoadBarBg: {
    height: 5,
    width: 96,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  slotLoadBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  slotLoadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  slotLoadBadgeText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bodyBold,
  },
  slotLoadUnassigned: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#B45309',
  },
});
