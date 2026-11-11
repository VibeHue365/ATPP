import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { TagoAlert } from '@/components/ui/TagoAlertModal';

import {
  OrderFilterTabs,
  type OrderFilterKey,
  type OrderFilterCounts,
} from '@/components/provider/orders/OrderFilterTabs';
import { OrderCard } from '@/components/provider/orders/OrderCard';
import { EscrowRefundModal } from '@/components/provider/orders/EscrowRefundModal';
import { OrderDetailModal } from '@/components/provider/orders/OrderDetailModal';
import {
  ProviderOrderWorkflowModal,
  type ProviderWorkflowMode,
} from '@/components/provider/orders/ProviderOrderWorkflowModal';

export default function ProviderOrdersScreen() {
  const { show } = useToast();
  const { unreadCount } = useNotifications();

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
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch orders from backend
  const loadOrders = useCallback(async () => {
    try {
      const data = await providerApi.getBookings();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      show('Không thể tải danh sách đơn hàng', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadOrders();
  }, [loadOrders]);

  // Compute filter counts dynamically from database records
  const counts: OrderFilterCounts = useMemo(() => {
    let urgent = 0;
    let pickup = 0;
    let rented = 0;
    let refund = 0;
    let completed = 0;

    orders.forEach((o) => {
      const s = o.status || 'CONFIRMED';
      if (s === 'RETURN_PENDING' || s === 'RETURNED' || s === 'PICKUP_PENDING') {
        urgent++;
      }
      if (s === 'PICKUP_PENDING' || s === 'CONFIRMED') {
        pickup++;
      }
      if (s === 'PICKED_UP' || s === 'IN_PROGRESS') {
        rented++;
      }
      if (s === 'RETURN_PENDING' || s === 'RETURNED') {
        refund++;
      }
      if (s === 'COMPLETED' || s === 'CANCELLED') {
        completed++;
      }
    });

    return {
      all: orders.length,
      urgent,
      pickup,
      rented,
      refund,
      completed,
    };
  }, [orders]);

  // Filter & search orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = o.status || 'CONFIRMED';

      // 1. Filter Tab match
      if (activeFilter === 'urgent') {
        if (s !== 'RETURN_PENDING' && s !== 'RETURNED' && s !== 'PICKUP_PENDING') {
          return false;
        }
      } else if (activeFilter === 'pickup') {
        if (s !== 'PICKUP_PENDING' && s !== 'CONFIRMED') {
          return false;
        }
      } else if (activeFilter === 'rented') {
        if (s !== 'PICKED_UP' && s !== 'IN_PROGRESS') {
          return false;
        }
      } else if (activeFilter === 'refund') {
        if (s !== 'RETURN_PENDING' && s !== 'RETURNED') {
          return false;
        }
      } else if (activeFilter === 'completed') {
        if (s !== 'COMPLETED' && s !== 'CANCELLED') {
          return false;
        }
      }

      // 2. Search Query match
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const code = (o.bookingCode || o._id || '').toLowerCase();
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
        const firstItemName = (
          o.items?.[0]?.name ||
          o.items?.[0]?.productName ||
          ''
        ).toLowerCase();

        return (
          code.includes(query) ||
          custName.includes(query) ||
          phone.includes(query) ||
          firstItemName.includes(query)
        );
      }

      return true;
    }).sort((a, b) => {
      const getPriority = (status?: string): number => {
        switch (status) {
          case 'RETURN_PENDING':
          case 'RETURNED':
            return 1; // Cần kiểm tra & hoàn cọc ngay
          case 'PICKUP_PENDING':
          case 'CONFIRMED':
          case 'PENDING':
            return 2; // Chờ chuẩn bị & giao đồ
          case 'PICKED_UP':
          case 'IN_PROGRESS':
            return 3; // Đang thuê
          case 'COMPLETED':
            return 4; // Đã hoàn tất
          case 'CANCELLED':
            return 5; // Đã hủy
          default:
            return 4;
        }
      };
      return getPriority(a.status) - getPriority(b.status);
    });
  }, [orders, activeFilter, searchQuery]);

  // Open Detail Modal
  const handlePressDetail = (order: any) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
  };

  // Primary action button pressed on a card (100% synced with Web state machine)
  const handlePressPrimaryAction = (order: any) => {
    const s = order.status || 'CONFIRMED';
    const isPhoto = order.bookingType === 'PHOTOGRAPHY';
    const isCombo =
      order.bookingType === 'COMBO' ||
      (order.items?.some((i: any) => i.itemType === 'PRODUCT' || i.productId) &&
        order.items?.some(
          (i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId,
        ));

    if (s === 'DEPOSIT_PAID' || s === 'PENDING' || s === 'PENDING_PAYMENT') {
      if (isPhoto) {
        void handleStatusChange(order, 'CONFIRMED', 'Đã chấp nhận lịch chụp');
      } else {
        setSelectedOrder(order);
        setWorkflowMode('HANDOVER');
      }
    } else if (s === 'CONFIRMED') {
      if (isPhoto) {
        void handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp');
      } else {
        setSelectedOrder(order);
        setWorkflowMode('HANDOVER');
      }
    } else if (s === 'PICKED_UP' || s === 'COMBO_PHOTOS_APPROVED') {
      if (isCombo && s === 'PICKED_UP' && !order.photosApproved) {
        void handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp Combo');
      } else {
        TagoAlert.alert(
          'Xác nhận khách đã trả đồ',
          'Khách hàng đã hoàn trả trang phục đầy đủ tại tiệm? Chuyển sang trạng thái Đã trả đồ (RETURNED)?',
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Xác nhận đã trả đồ',
              style: 'default',
              onPress: () =>
                handleStatusChange(order, 'RETURNED', 'Khách đã hoàn trả trang phục tại tiệm'),
            },
          ],
        );
      }
    } else if (s === 'IN_PROGRESS') {
      setSelectedOrder(order);
      setWorkflowMode('DELIVER_PHOTOS');
    } else if (s === 'RETURNED') {
      setSelectedOrder(order);
      setRefundModalVisible(true);
    } else {
      handlePressDetail(order);
    }
  };

  // Secondary action (Incident report, Cancel order, Reschedule approve/reject)
  const handlePressSecondaryAction = async (
    order: any,
    actionType: 'INCIDENT' | 'CANCEL' | 'RESCHEDULE_APPROVE' | 'RESCHEDULE_REJECT',
  ) => {
    if (actionType === 'INCIDENT') {
      setSelectedOrder(order);
      setWorkflowMode('REPORT_INCIDENT');
      return;
    }
    if (actionType === 'CANCEL') {
      setSelectedOrder(order);
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
      show(
        approved ? 'Đã duyệt yêu cầu đổi lịch thuê!' : 'Đã từ chối yêu cầu đổi lịch.',
        'success',
      );
      void loadOrders();
    } catch {
      show('Không thể xử lý yêu cầu đổi lịch', 'error');
    }
  };

  // Perform status change
  const handleStatusChange = async (order: any, nextStatus: string, note?: string) => {
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(order._id, nextStatus, note);
      show(`Đã cập nhật trạng thái đơn #${order.bookingCode || ''}!`, 'success');
      setDetailModalVisible(false);
      void loadOrders();
    } catch {
      show('Không thể cập nhật trạng thái đơn hàng', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Escrow Release
  const handleConfirmEscrowRefund = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(
        selectedOrder._id,
        'COMPLETED',
        'Đã kiểm tra áo nguyên vẹn & giải ngân tiền cọc',
      );
      show('Đã hoàn cọc và hoàn tất đơn hàng thành công!', 'success');
      setRefundModalVisible(false);
      setSelectedOrder(null);
      void loadOrders();
    } catch {
      show('Lỗi khi giải ngân tiền cọc', 'error');
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
              <Ionicons name="person-outline" size={18} color="#5F6874" />
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
                onOpenChat={(id) => router.push(`/chat?bookingId=${id}` as Href)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* 5. Escrow Refund Modal */}
      <EscrowRefundModal
        visible={refundModalVisible}
        onClose={() => setRefundModalVisible(false)}
        onConfirm={handleConfirmEscrowRefund}
        customerName={
          selectedOrder?.customerId?.profile?.fullName ||
          selectedOrder?.contactInfo?.fullName ||
          'Khách hàng'
        }
        orderCode={selectedOrder?.bookingCode || '#BK-000'}
        amount={selectedOrder?.pricingSummary?.depositTotal || 300000}
        loading={actionLoading}
      />

      {/* 6. Order Detail Modal Sheet */}
      <OrderDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        order={selectedOrder}
        onAction={handleStatusChange}
        onRefundEscrow={(order) => {
          setSelectedOrder(order);
          setRefundModalVisible(true);
        }}
        onOpenWorkflowModal={(order, mode) => {
          setSelectedOrder(order);
          setWorkflowMode(mode);
        }}
        onOpenChat={(id) => router.push(`/chat?bookingId=${id}` as Href)}
        actionLoading={actionLoading}
      />

      {/* 7. Unified Web-Synced Workflow Modal (Handover Photos / Drive Link / Incident / Cancel) */}
      <ProviderOrderWorkflowModal
        visible={Boolean(workflowMode)}
        mode={workflowMode}
        order={selectedOrder}
        onClose={() => setWorkflowMode(null)}
        onSuccess={() => {
          setWorkflowMode(null);
          void loadOrders();
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
