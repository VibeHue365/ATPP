import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
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
import { OrderDetailModal } from '@/components/provider/orders/OrderDetailModal';
import {
  ProviderOrderWorkflowModal,
  type ProviderWorkflowMode,
} from '@/components/provider/orders/ProviderOrderWorkflowModal';

type ScheduleFilterType = 'ALL' | 'PICKUP' | 'RETURN' | 'PHOTOSHOOT';

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
  depositAmount: number;
  rawOrder?: any;
}

export default function ProviderSchedulesScreen() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewSchedules, setOverviewSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  const [typeFilter, setTypeFilter] = useState<ScheduleFilterType>('ALL');
  const [selectedDayKey, setSelectedDayKey] = useState<string>('ALL_DAYS');
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [navModalVisible, setNavModalVisible] = useState(false);
  const [navOrder, setNavOrder] = useState<any | null>(null);
  const [providerProfile, setProviderProfile] = useState<any | null>(null);
  const [workflowMode, setWorkflowMode] = useState<ProviderWorkflowMode>(null);
  const [actionLoading, setActionLoading] = useState(false);
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
      const [overRes, bookRes, schedRes, meRes] = await Promise.allSettled([
        providerApi.getOverview(),
        providerApi.getBookings(),
        providerApi.listSchedules(),
        providerApi.getMe(),
      ]);

      if (overRes.status === 'fulfilled' && overRes.value?.todaySchedules) {
        setOverviewSchedules(overRes.value.todaySchedules);
      }
      if (bookRes.status === 'fulfilled' && Array.isArray(bookRes.value)) {
        setBookings(bookRes.value);
      }
      if (meRes.status === 'fulfilled' && meRes.value) {
        setProviderProfile(meRes.value);
      }
      if (schedRes.status === 'fulfilled' && Array.isArray(schedRes.value)) {
        const blocked = schedRes.value
          .filter((s: any) => s.isAvailable === false && s.date)
          .map((s: any) => new Date(s.date).toISOString().slice(0, 10));
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadScheduleData();
  }, [loadScheduleData]);

  // Build unified timeline from real bookings + overview schedules
  const timelineItems: UnifiedTimelineItem[] = useMemo(() => {
    const list: UnifiedTimelineItem[] = [];
    const seenIds = new Set<string>();

    bookings.forEach((b) => {
      if (b.status === 'CANCELLED' || b.status === 'COMPLETED') return;
      const code =
        b.bookingCode || (b._id ? `#${b._id.slice(-6).toUpperCase()}` : '#BK');
      const custName =
        b.customerId?.profile?.fullName ||
        b.contactInfo?.fullName ||
        'Khách hàng TàGo';
      const custPhone =
        b.customerId?.auth?.phone || b.contactInfo?.phone || '';
      const firstItem = b.items?.[0];
      const itemTitle =
        firstItem?.name ||
        firstItem?.productName ||
        firstItem?.productId?.name ||
        firstItem?.photographyPackageId?.title ||
        firstItem?.photographyPackageId?.name ||
        b.packageTitle ||
        'Thuê Cổ Phục Áo Dài Huế';
      const itemSize =
        firstItem?.selectedSize || firstItem?.size
          ? ` (Size ${firstItem?.selectedSize || firstItem?.size})`
          : '';
      const rawImg =
        firstItem?.productId?.images?.[0] ||
        firstItem?.photographyPackageId?.images?.[0] ||
        firstItem?.images?.[0] ||
        firstItem?.imageUrl ||
        firstItem?.image ||
        firstItem?.product?.images?.[0] ||
        null;
      const deposit =
        b.pricingSummary?.depositTotal ||
        b.pricing?.totalDeposit ||
        b.depositAmount ||
        firstItem?.depositAmount ||
        0;

      const startRaw =
        firstItem?.rentalPeriod?.startDate ||
        firstItem?.startDate ||
        b.startDate ||
        b.createdAt;
      const endRaw =
        firstItem?.rentalPeriod?.endDate ||
        firstItem?.endDate ||
        b.endDate ||
        startRaw;

      const startDateObj = startRaw ? new Date(startRaw) : new Date();
      const endDateObj = endRaw ? new Date(endRaw) : new Date();

      const startDayKey = startDateObj.toISOString().slice(0, 10);
      const endDayKey = endDateObj.toISOString().slice(0, 10);

      const shootSnap =
        b.photoshootSchedule?.locationSnapshot ||
        firstItem?.shootLocationSnapshot ||
        firstItem?.pickupReturnLocationSnapshot ||
        b.location;
      const addrText =
        shootSnap?.addressLine ||
        shootSnap?.address ||
        firstItem?.shootLocation ||
        firstItem?.providerAddress ||
        'Đại Nội Huế (Hoàng Thành), TP. Huế';
      const resolvedCoords = resolveEntityCoords({
        id: b._id,
        geo: shootSnap?.geo,
        address: { addressLine: addrText },
      });

      if (b.bookingType === 'PHOTOGRAPHY') {
        const id = `photo-${b._id}`;
        seenIds.add(id);
        list.push({
          id,
          bookingId: b._id,
          bookingCode: code,
          type: 'PHOTOSHOOT',
          timeLabel: '15:00',
          dateStr: startDayKey,
          dateDisplay: startDateObj.toLocaleDateString('vi-VN'),
          customerName: custName,
          customerPhone: custPhone,
          serviceTitle: `${itemTitle}${itemSize}`,
          locationAddress: addrText,
          coords: resolvedCoords,
          productImage: rawImg,
          status: b.status || 'CONFIRMED',
          depositAmount: deposit,
          rawOrder: b,
        });
      } else if (
        b.status === 'PICKED_UP' ||
        b.status === 'IN_PROGRESS' ||
        b.status === 'RETURN_PENDING' ||
        b.status === 'RETURNED'
      ) {
        // Return event (for currently rented or return pending orders)
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
          depositAmount: deposit,
          rawOrder: b,
        });
      } else {
        // Pickup event (for DEPOSIT_PAID, CONFIRMED, PICKUP_PENDING)
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
          depositAmount: deposit,
          rawOrder: b,
        });
      }
    });

    overviewSchedules.forEach((s, idx) => {
      const id = s.id || `sched-${idx}`;
      if (!seenIds.has(id)) {
        const dt = s.startsAt ? new Date(s.startsAt) : new Date();
        const addrText =
          s.locationAddress || s.locationName || 'Cung An Định, TP. Huế';
        const resolvedCoords = resolveEntityCoords({
          id,
          address: { addressLine: addrText },
        });
        list.push({
          id,
          bookingId: s.bookingId || '',
          bookingCode: s.bookingCode || '#VH',
          type: s.type || 'PHOTOSHOOT',
          timeLabel: s.timeLabel || '14:30',
          dateStr: dt.toISOString().slice(0, 10),
          dateDisplay: dt.toLocaleDateString('vi-VN'),
          customerName: s.customer?.name || 'Khách hàng',
          customerPhone: s.customer?.phone || '',
          serviceTitle: s.serviceName || 'Lịch hẹn tại tiệm',
          locationAddress: addrText,
          coords: resolvedCoords,
          productImage: s.customer?.avatarUrl || null,
          status: s.status || 'CONFIRMED',
          depositAmount: 0,
        });
      }
    });

    return list;
  }, [bookings, overviewSchedules]);

  // Build 7-day strip around today + unique dates from bookings
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
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const count = timelineItems.filter((it) => it.dateStr === key).length;
      result.push({
        key,
        dayLabel: i === 0 ? 'Hôm nay' : dayNames[d.getDay()],
        dateNum: `${d.getDate()}/${d.getMonth() + 1}`,
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
      return true;
    });
  }, [timelineItems, selectedDayKey, typeFilter]);

  const handleStatusUpdate = async (order: any, nextStatus: string, note?: string) => {
    if (!order?._id) return;
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(order._id, nextStatus, { note });
      show(`Đã cập nhật lịch hẹn đơn #${order.bookingCode || ''}!`, 'success');
      setDetailVisible(false);
      void loadScheduleData();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể cập nhật trạng thái', 'error');
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
      selectedDayKey === 'ALL_DAYS'
        ? new Date().toISOString().slice(0, 10)
        : selectedDayKey;
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

  const handleQuickTimelineAction = (item: UnifiedTimelineItem) => {
    if (!item.rawOrder) {
      router.push('/provider/qr-scanner' as Href);
      return;
    }
    const s = item.status;
    setSelectedOrder(item.rawOrder);

    if (item.type === 'PICKUP' && (s === 'CONFIRMED' || s === 'DEPOSIT_PAID')) {
      setWorkflowMode('HANDOVER');
    } else if (item.type === 'RETURN' && s === 'PICKED_UP') {
      TagoAlert.alert(
        'Xác nhận đã trả đồ',
        `Khách ${item.customerName} đã mang trả cổ phục tại quầy?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đã nhận trả đồ',
            onPress: () =>
              handleStatusUpdate(
                item.rawOrder,
                'RETURNED',
                'Khách đã trả trang phục tại quầy',
              ),
          },
        ],
      );
    } else if (s === 'RETURNED') {
      TagoAlert.alert(
        'Hoàn thành & Hoàn cọc',
        `Xác nhận hoàn cọc và đóng đơn cho khách ${item.customerName}?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Hoàn thành đơn',
            onPress: () =>
              handleStatusUpdate(
                item.rawOrder,
                'COMPLETED',
                'Đã kiểm nhận đồ nguyên vẹn & hoàn cọc',
              ),
          },
        ],
      );
    } else {
      setDetailVisible(true);
    }
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
                      <View
                        style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}
                      >
                        <Text style={[styles.typeBadgeText, { color: typeBadgeColor }]}>
                          {typeLabel}
                        </Text>
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
                            onPress={() => {
                              setSelectedOrder(item.rawOrder);
                              setDetailVisible(true);
                            }}
                          >
                            <Text style={styles.detailOutlineText} numberOfLines={1}>
                              Chi tiết
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      <Pressable
                        style={styles.primaryBtn}
                        onPress={() => handleQuickTimelineAction(item)}
                      >
                        <Text style={styles.primaryBtnText} numberOfLines={1}>
                          {isPickup &&
                          (item.status === 'CONFIRMED' || item.status === 'DEPOSIT_PAID')
                            ? 'Bàn giao đồ'
                            : isPickup && item.status === 'PICKUP_PENDING'
                              ? 'Chờ duyệt'
                              : isReturn &&
                                  (item.status === 'PICKED_UP' || item.status === 'IN_PROGRESS')
                                ? 'Nhận trả đồ'
                                : isReturn &&
                                    (item.status === 'RETURNED' ||
                                      item.status === 'RETURN_PENDING')
                                  ? 'Hoàn cọc'
                                  : 'Xử lý lịch'}
                        </Text>
                        <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                      </Pressable>
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
        onOpenWorkflowModal={(order, mode) => {
          setDetailVisible(false);
          setSelectedOrder(order);
          setWorkflowMode(mode);
        }}
        onOpenChat={() => {
          setDetailVisible(false);
          router.push('/chat' as Href);
        }}
        onOpenNavigationMap={(order) => {
          setNavOrder(order);
          setNavModalVisible(true);
        }}
      />

      <ProviderJobNavigationModal
        visible={navModalVisible}
        onClose={() => setNavModalVisible(false)}
        order={navOrder}
        providerProfile={providerProfile}
        onOpenChat={() => router.push('/chat' as Href)}
        onStartSession={(bookingId) => {
          if (bookingId) {
            void providerApi
              .startSession(bookingId)
              .then(() => {
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
        onClose={() => setWorkflowMode(null)}
        onSuccess={() => {
          setWorkflowMode(null);
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
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
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
        </View>
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
});
