import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { openOrderCustomerChat } from '@/utils/chatNavigation';
import { resolveRenderableMediaUrl } from '@/utils/media';
import {
  computeProviderOrderCounts,
  getRentalItems,
  isPhotographyItem,
  matchesProviderOrderFilter,
  resolveBookingDisplayState,
} from '@/utils/rentalState';

import {
  OrderFilterTabs,
  type OrderFilterKey,
} from '@/components/provider/orders/OrderFilterTabs';
import { OrderCard } from '@/components/provider/orders/OrderCard';
import { EscrowRefundModal } from '@/components/provider/orders/EscrowRefundModal';
import {
  OrderDetailModal,
  type ProviderRentalActionType,
} from '@/components/provider/orders/OrderDetailModal';
import {
  ProviderOrderWorkflowModal,
  type ProviderWorkflowMode,
} from '@/components/provider/orders/ProviderOrderWorkflowModal';

export default function ProviderOrdersScreen() {
  const { user } = useAuth();
  const { show } = useToast();
  const { bookingId: routeBookingId } = useLocalSearchParams<{
    bookingId?: string;
  }>();
  const { unreadCount, bookingSyncVersion, bumpBookingSync, pushLocalBanner } =
    useNotifications();
  const [headerAvatarFailed, setHeaderAvatarFailed] = useState(false);

  const userAvatarUri = !headerAvatarFailed
    ? resolveRenderableMediaUrl(user?.avatarUrl)
    : undefined;

  useEffect(() => {
    setHeaderAvatarFailed(false);
  }, [user?.avatarUrl]);

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OrderFilterKey>('all');

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<ProviderWorkflowMode>(null);
  const [workflowItemId, setWorkflowItemId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const handledDeepLinkRef = useRef<string | null>(null);

  // Fetch orders from backend
  const loadOrders = useCallback(
    async (silent = false) => {
      try {
        const data = await providerApi.getBookings();
        const nextList = Array.isArray(data) ? data : [];
        setOrders(nextList);
        setSelectedOrder((prev: any) =>
          prev?._id
            ? nextList.find((o) => o._id === prev._id) ?? prev
            : prev,
        );
      } catch {
        if (!silent) show('Không thể tải danh sách đơn hàng', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (bookingSyncVersion > 0) {
      void loadOrders(true);
    }
  }, [bookingSyncVersion, loadOrders]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders(true);
      const timer = setInterval(() => {
        void loadOrders(true);
      }, 6000);
      return () => clearInterval(timer);
    }, [loadOrders]),
  );

  useEffect(() => {
    if (!routeBookingId) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (orders.length === 0) return;
    if (handledDeepLinkRef.current === routeBookingId) return;
    const match = orders.find((o) => o._id === routeBookingId);
    if (match) {
      handledDeepLinkRef.current = routeBookingId;
      setSelectedOrder(match);
      setDetailModalVisible(true);
    }
  }, [routeBookingId, orders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadOrders(true);
  }, [loadOrders]);

  // Unified filter counts across all booking statuses
  const counts = useMemo(() => computeProviderOrderCounts(orders), [orders]);

  // Filter & search orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!matchesProviderOrderFilter(o, activeFilter)) return false;

        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLowerCase().replace(/^#/, '');
          const code = `${o.bookingCode || ''} ${o._id || ''} ${o._id ? o._id.slice(-6) : ''}`.toLowerCase();
          const custName = (
            o.customerId?.profile?.fullName ||
            o.contactInfo?.fullName ||
            ''
          ).toLowerCase();
          const phone = (
            o.customerId?.auth?.phone ||
            o.contactInfo?.phone ||
            ''
          ).toLowerCase();
          const itemsText = Array.isArray(o.items)
            ? o.items
                .map(
                  (it: any) =>
                    `${it.name || ''} ${it.productName || ''} ${it.productId?.name || ''} ${it.photographyPackageId?.name || ''}`,
                )
                .join(' ')
                .toLowerCase()
            : '';

          return (
            code.includes(query) ||
            custName.includes(query) ||
            phone.includes(query) ||
            itemsText.includes(query)
          );
        }

        return true;
      })
      .sort((a, b) => {
        const getPriority = (order: any): number => {
          const stage = resolveBookingDisplayState(order, 'provider').stage;
          switch (stage) {
            case 'DISPUTED':
            case 'INCIDENT_PENDING_CUSTOMER':
            case 'CUSTOMER_RETURN_REQUESTED':
            case 'RETURNED_NEEDS_INSPECTION':
              return 1;
            case 'CLEANING_AFTER_REFUND':
            case 'DEPOSIT_PAID':
            case 'PREPARING':
            case 'READY_NEEDS_HANDOVER_PHOTOS':
              return 2;
            case 'HANDOVER_AWAITING_CUSTOMER':
            case 'IN_RENTAL':
            case 'IN_PROGRESS':
            case 'AWAITING_REVIEW':
            case 'COMBO_PHOTOS_APPROVED':
              return 3;
            case 'PENDING_PAYMENT':
            case 'DRAFT':
              return 4;
            case 'COMPLETED':
              return 5;
            default:
              return 6;
          }
        };
        return getPriority(a) - getPriority(b);
      });
  }, [orders, activeFilter, searchQuery]);

  // Open Detail Modal & enrich with full item SKU detail
  const handlePressDetail = (order: any) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
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

  // Handle per-item / rental fulfillment workflow transitions
  const handleRentalAction = async (
    order: any,
    action: ProviderRentalActionType,
    itemId?: string,
  ) => {
    const myRentalItems = getRentalItems(order, true);
    const targetItem =
      (itemId ? myRentalItems.find((it) => it._id === itemId) : null) ??
      myRentalItems[0];
    const resolvedItemId = targetItem?._id;

    if (action === 'HANDOVER' || action === 'REPORT_INCIDENT') {
      setDetailModalVisible(false);
      setSelectedOrder(order);
      setWorkflowItemId(resolvedItemId || null);
      setWorkflowMode(action === 'HANDOVER' ? 'HANDOVER' : 'REPORT_INCIDENT');
      return;
    }

    if (!resolvedItemId) {
      show('Không tìm thấy sản phẩm thuê trong đơn để thao tác', 'error');
      return;
    }

    if (action === 'CONFIRM_NO_INCIDENT') {
      setDetailModalVisible(false);
      setSelectedOrder(order);
      setWorkflowItemId(resolvedItemId);
      setRefundModalVisible(true);
      return;
    }

    setActionLoading(true);
    try {
      if (action === 'READY') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter((it) => !it.rentalFulfillment?.status || it.rentalFulfillment.status === 'PENDING');
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markRentalReady(order._id, it._id);
        }
        show('Đã xác nhận soạn xong áo! Tiếp theo hãy chụp ảnh bàn giao.', 'success');
      } else if (action === 'RETURNED') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter((it) => it.rentalFulfillment?.status === 'CUSTOMER_RETURN_REQUESTED');
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markReturned(order._id, it._id, {
            note: 'Cửa hàng xác nhận đã nhận lại cổ phục từ khách.',
          });
        }
        show('Đã xác nhận nhận lại áo! Chờ kiểm tra để hoàn cọc.', 'success');
      } else if (action === 'CLEANING_COMPLETED') {
        const targets = itemId
          ? [targetItem]
          : myRentalItems.filter((it) => it.rentalFulfillment?.status === 'RETURNED');
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markCleaningCompleted(order._id, it._id);
        }
        show('Đã hoàn tất giặt ủi & mở khóa kho! Đơn hàng đã hoàn thành.', 'success');
      }
      bumpBookingSync(order._id);
      setDetailModalVisible(false);
      await loadOrders(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể thực hiện thao tác thuê đồ';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Primary action button pressed on a card (100% synced with RentalFulfillment + Photoshoot)
  const handlePressPrimaryAction = (order: any) => {
    const display = resolveBookingDisplayState(order, 'provider');
    const stage = display.stage;
    const isPhotoOnly = display.isPhotoshootOnly;

    if (stage === 'DEPOSIT_PAID') {
      void handleStatusChange(
        order,
        'CONFIRMED',
        isPhotoOnly
          ? 'Đã chấp nhận lịch chụp'
          : 'Đã xác nhận đơn và bắt đầu chuẩn bị cổ phục',
      );
      return;
    }

    if (stage === 'PREPARING') {
      if (isPhotoOnly) {
        void handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp');
      } else {
        void handleRentalAction(order, 'READY');
      }
      return;
    }

    if (stage === 'READY_NEEDS_HANDOVER_PHOTOS') {
      const target = getRentalItems(order, true).find(
        (it) => it.rentalFulfillment?.status === 'READY_FOR_PICKUP',
      );
      setSelectedOrder(order);
      setWorkflowItemId(target?._id || null);
      setWorkflowMode('HANDOVER');
      return;
    }

    if (stage === 'IN_RENTAL' && display.isCombo && !order.photosApproved) {
      void handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp Combo');
      return;
    }

    if (stage === 'IN_PROGRESS') {
      setSelectedOrder(order);
      setWorkflowItemId(null);
      setWorkflowMode('DELIVER_PHOTOS');
      return;
    }

    if (stage === 'CUSTOMER_RETURN_REQUESTED') {
      TagoAlert.alert(
        'Xác nhận đã nhận lại cổ phục',
        'Khách hàng đã mang áo đến trả tại tiệm? Chuyển sang bước kiểm tra hiện trạng để giải phóng tiền cọc.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận đã nhận lại',
            style: 'default',
            onPress: () => void handleRentalAction(order, 'RETURNED'),
          },
        ],
      );
      return;
    }

    if (stage === 'RETURNED_NEEDS_INSPECTION') {
      setSelectedOrder(order);
      setWorkflowItemId(null);
      setRefundModalVisible(true);
      return;
    }

    if (stage === 'CLEANING_AFTER_REFUND') {
      void handleRentalAction(order, 'CLEANING_COMPLETED');
      return;
    }

    handlePressDetail(order);
  };

  // Secondary action (Incident report, Cancel order, Reschedule approve/reject)
  const handlePressSecondaryAction = async (
    order: any,
    actionType: 'INCIDENT' | 'CANCEL' | 'RESCHEDULE_APPROVE' | 'RESCHEDULE_REJECT',
  ) => {
    if (actionType === 'INCIDENT') {
      const target = getRentalItems(order, true)[0];
      setSelectedOrder(order);
      setWorkflowItemId(target?._id || null);
      setWorkflowMode('REPORT_INCIDENT');
      return;
    }
    if (actionType === 'CANCEL') {
      setSelectedOrder(order);
      setWorkflowItemId(null);
      setWorkflowMode('CANCEL_ORDER');
      return;
    }

    const pendingItem = order.items?.find(
      (it: any) => it?.rescheduleRequest?.status === 'PENDING',
    );
    if (!pendingItem?._id) return;

    const approved = actionType === 'RESCHEDULE_APPROVE';
    try {
      await providerApi.resolveReschedule(order._id, pendingItem._id, {
        approved,
        note: approved
          ? 'Đối tác chấp thuận đổi lịch thuê'
          : 'Đối tác từ chối đổi lịch do trùng lịch đặt trước',
      });
      bumpBookingSync(order._id);
      show(
        approved ? 'Đã duyệt yêu cầu đổi lịch thuê!' : 'Đã từ chối yêu cầu đổi lịch.',
        'success',
      );
      void loadOrders(true);
    } catch {
      show('Không thể xử lý yêu cầu đổi lịch', 'error');
    }
  };

  // Perform status change (CONFIRMED / IN_PROGRESS / CANCELLED only)
  const handleStatusChange = async (order: any, nextStatus: string, note?: string) => {
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(order._id, nextStatus, note);
      bumpBookingSync(order._id);
      pushLocalBanner({
        title: `Đã cập nhật đơn #${order.bookingCode || ''}`,
        content: note || `Đơn hàng đã chuyển sang trạng thái ${nextStatus}.`,
        type: 'BOOKING_UPDATED',
        metadata: {
          bookingId: order._id,
          bookingCode: order.bookingCode,
          status: nextStatus,
          targetRole: 'provider',
        },
      });
      show(`Đã cập nhật trạng thái đơn #${order.bookingCode || ''}!`, 'success');
      setDetailModalVisible(false);
      void loadOrders(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể cập nhật trạng thái đơn hàng';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Escrow Release (calls confirm-no-incident per rental item!)
  const handleConfirmEscrowRefund = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      const myRentalItems = getRentalItems(selectedOrder, true);
      const targets = workflowItemId
        ? myRentalItems.filter((it) => it._id === workflowItemId)
        : myRentalItems.filter((it) => it.rentalFulfillment?.status === 'RETURNED');
      const finalTargets = targets.length > 0 ? targets : myRentalItems;

      if (finalTargets.length === 0) {
        show('Không tìm thấy áo dài thuê để xác nhận hoàn cọc', 'error');
        setActionLoading(false);
        return;
      }

      for (const it of finalTargets) {
        await providerApi.confirmNoIncident(
          selectedOrder._id,
          it._id,
          'Đã kiểm tra áo nguyên vẹn & xác nhận giải phóng cọc Escrow',
        );
      }

      show('Đã xác nhận không sự cố & hoàn cọc Escrow! Hãy hoàn tất giặt ủi để mở kho.', 'success');
      bumpBookingSync(selectedOrder._id);
      pushLocalBanner({
        title: `Đã hoàn cọc Escrow #${selectedOrder.bookingCode || ''}`,
        content: 'Cọc Escrow đã được giải phóng, trang phục chuyển sang trạng thái Đang giặt ủi.',
        type: 'ESCROW_RELEASED',
        metadata: {
          bookingId: selectedOrder._id,
          bookingCode: selectedOrder.bookingCode,
          status: 'RETURNED',
          stage: 'CLEANING_AFTER_REFUND',
          targetRole: 'provider',
        },
      });
      setRefundModalVisible(false);
      setWorkflowItemId(null);
      setSelectedOrder(null);
      void loadOrders(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi giải ngân tiền cọc';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 1. Header (Minimalist iOS / Airbnb Host styling) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.eyebrow}>TÀGO PARTNER PRO</Text>
            <Text style={styles.screenTitle}>Đơn hàng</Text>
          </View>

          <View style={styles.headerRightActions}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              onPress={() => router.push('/notifications' as Href)}
              accessibilityLabel="Thông báo"
            >
              <Ionicons name="notifications-outline" size={21} color="#5F6874" />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.profileBtn, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/profile' as Href)}
              accessibilityLabel="Tài khoản"
            >
              {userAvatarUri ? (
                <Image
                  source={{ uri: userAvatarUri }}
                  style={styles.profileBtnImg}
                  contentFit="cover"
                  onError={() => setHeaderAvatarFailed(true)}
                />
              ) : (
                <Ionicons name="person-outline" size={18} color="#5F6874" />
              )}
            </Pressable>
          </View>
        </View>

        {/* 2. Search Bar + Filter Trigger */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color="#5F6874" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
              placeholderTextColor="rgba(95, 104, 116, 0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={14}
                style={{ padding: 4 }}
                accessibilityLabel="Xóa tìm kiếm"
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [styles.tuneBtn, pressed && styles.pressed]}
            onPress={() => {
              // Quick reset or toggle
              if (activeFilter !== 'all') {
                setActiveFilter('all');
                show('Đã chuyển về xem tất cả đơn', 'info');
              } else {
                setActiveFilter('urgent');
                show('Đang lọc đơn cần xử lý gấp', 'info');
              }
            }}
            accessibilityLabel="Bộ lọc nâng cao"
          >
            <Ionicons
              name={activeFilter !== 'all' ? 'funnel' : 'options-outline'}
              size={19}
              color={activeFilter !== 'all' ? '#8C1D40' : '#5F6874'}
            />
          </Pressable>
        </View>
      </View>

      {/* 3. Filter Category Pills */}
      <OrderFilterTabs
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        counts={counts}
      />

      {/* 4. Orders Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8C1D40" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8C1D40"
              colors={['#8C1D40']}
            />
          }
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'Không tìm thấy đơn hàng phù hợp'
                  : 'Chưa có đơn hàng trong mục này'}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm mã đơn hoặc tên khách hàng.'
                  : 'Các đơn thuê áo dài và ca chụp phát sinh sẽ tự động hiển thị tại đây.'}
              </Text>
            </View>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                onPressDetail={handlePressDetail}
                onPressPrimaryAction={handlePressPrimaryAction}
                onPressSecondaryAction={handlePressSecondaryAction}
                onOpenChat={() => void openOrderCustomerChat(order)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* 5. Escrow Refund Modal */}
      <EscrowRefundModal
        visible={refundModalVisible}
        onClose={() => {
          setRefundModalVisible(false);
          setWorkflowItemId(null);
        }}
        onConfirm={handleConfirmEscrowRefund}
        customerName={
          selectedOrder?.customerId?.profile?.fullName ||
          selectedOrder?.contactInfo?.fullName ||
          'Khách hàng'
        }
        orderCode={selectedOrder?.bookingCode || '#BK-000'}
        amount={
          selectedOrder?.pricingSummary?.depositTotal ??
          selectedOrder?.depositAmount ??
          (Array.isArray(selectedOrder?.items)
            ? selectedOrder.items.reduce(
                (sum: number, it: any) =>
                  sum + (isPhotographyItem(it) ? 0 : (it.depositAmount ?? 0) * (it.quantity ?? 1)),
                0,
              )
            : 0)
        }
        loading={actionLoading}
      />

      {/* 6. Order Detail Modal Sheet */}
      <OrderDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        order={selectedOrder}
        onAction={handleStatusChange}
        onRentalAction={handleRentalAction}
        onRefundEscrow={(order) => {
          setDetailModalVisible(false);
          setSelectedOrder(order);
          setWorkflowItemId(null);
          setRefundModalVisible(true);
        }}
        onOpenWorkflowModal={(order, mode, itemId) => {
          setDetailModalVisible(false);
          setSelectedOrder(order);
          setWorkflowItemId(itemId || null);
          setWorkflowMode(mode);
        }}
        onOpenChat={() => void openOrderCustomerChat(selectedOrder)}
        actionLoading={actionLoading}
      />

      {/* 7. Unified Web-Synced Workflow Modal (Handover Photos / Drive Link / Incident / Cancel) */}
      <ProviderOrderWorkflowModal
        visible={Boolean(workflowMode)}
        mode={workflowMode}
        order={selectedOrder}
        targetItemId={workflowItemId}
        onClose={() => {
          setWorkflowMode(null);
          setWorkflowItemId(null);
        }}
        onSuccess={() => {
          setWorkflowMode(null);
          setWorkflowItemId(null);
          bumpBookingSync(selectedOrder?._id);
          void loadOrders(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#8C1D40',
    letterSpacing: 0.8,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#111418',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBE0E6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8C1D40',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E4E6EA',
    borderWidth: 1,
    borderColor: '#DBE0E6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileBtnImg: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBE0E6',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#111418',
    padding: 0,
  },
  tuneBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBE0E6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 14,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECEEF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#111418',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#5F6874',
    textAlign: 'center',
    lineHeight: 19,
  },
});
