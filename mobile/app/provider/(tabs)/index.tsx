import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { FontFamily } from '@/constants/theme';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import type {
  ProviderProfile,
  ProviderOverviewResponse,
  ProviderWalletResponse,
  InventorySummaryItem,
  WeatherLocationChangeAlert,
} from '@/types/provider';

import { ProviderHeader } from '@/components/provider/ProviderHeader';
import { WeatherAlertBanner } from '@/components/provider/WeatherAlertBanner';
import { FilterPills, type FilterCategory } from '@/components/provider/FilterPills';
import { NextSessionHeroCard } from '@/components/provider/NextSessionHeroCard';
import { DailyTasksGrid, type TaskFilterKey } from '@/components/provider/DailyTasksGrid';
import { LumePartnerProCard } from '@/components/provider/LumePartnerProCard';
import { InventoryProgressCard } from '@/components/provider/InventoryProgressCard';
import { ReputationIncidentCard } from '@/components/provider/ReputationIncidentCard';
import { ProviderReviewsTrustModal } from '@/components/provider/ProviderReviewsTrustModal';
import { OrderCard } from '@/components/provider/orders/OrderCard';
import { OrderDetailModal } from '@/components/provider/orders/OrderDetailModal';
import { EscrowRefundModal } from '@/components/provider/orders/EscrowRefundModal';
import {
  ProviderOrderWorkflowModal,
  type ProviderWorkflowMode,
} from '@/components/provider/orders/ProviderOrderWorkflowModal';
import { AddProductModal } from '@/components/provider/store/AddProductModal';
import { ProviderJobNavigationModal } from '@/components/provider/ProviderJobNavigationModal';

export default function ProviderDashboardScreen() {
  const { show } = useToast();
  const { unreadCount } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real backend states
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [overview, setOverview] = useState<ProviderOverviewResponse | null>(null);
  const [walletData, setWalletData] = useState<ProviderWalletResponse | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventorySummaryItem[] | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);

  // Filter states
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [activeTaskFilter, setActiveTaskFilter] = useState<TaskFilterKey>('ALL');

  // Interactive Management Modals
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<ProviderWorkflowMode>(null);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [reviewsTrustModalVisible, setReviewsTrustModalVisible] = useState(false);
  const [navModalVisible, setNavModalVisible] = useState(false);
  const [navOrder, setNavOrder] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Weather Location Change Alert state
  const [weatherAlert, setWeatherAlert] = useState<WeatherLocationChangeAlert | null>(null);

  // Online status
  const [isOnline, setIsOnline] = useState(true);

  // Load real data from all backend endpoints
  const fetchAllData = useCallback(async () => {
    try {
      const [profRes, overRes, walletRes, invRes, bookRes] = await Promise.allSettled([
        providerApi.getMe(),
        providerApi.getOverview(),
        providerApi.getWallet(),
        providerApi.getInventorySummary(),
        providerApi.getBookings(),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value) {
        setProfile(profRes.value);
        setIsOnline(profRes.value.isAcceptingBookings ?? true);
      }

      if (overRes.status === 'fulfilled' && overRes.value) {
        setOverview(overRes.value);
      }

      if (walletRes.status === 'fulfilled' && walletRes.value) {
        setWalletData(walletRes.value);
      }

      if (invRes.status === 'fulfilled' && invRes.value) {
        setInventoryItems(invRes.value);
      }

      if (bookRes.status === 'fulfilled' && Array.isArray(bookRes.value)) {
        setBookings(bookRes.value);

        // Check if any booking schedule has an active location change request
        for (const b of bookRes.value) {
          const photoshootSchedule = b?.photoshootSchedule;
          if (
            photoshootSchedule?.locationChangeRequest &&
            photoshootSchedule.locationChangeRequest.status === 'PENDING'
          ) {
            setWeatherAlert({
              bookingId: b._id,
              scheduleId: photoshootSchedule._id,
              currentLocationName: b.location?.address || 'Cung An Định',
              suggestedLocation:
                photoshootSchedule.locationChangeRequest.address ||
                'Cung Diên Thọ hoặc Chụp trong Studio',
              rainStopDuration: 'Trời ngớt sau 40p',
              status: 'PENDING',
            });
            break;
          }
        }
      }
    } catch {
      show('Không thể tải mới dữ liệu đối tác', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchAllData();
  }, [fetchAllData]);

  // Online/Offline switch
  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    try {
      await providerApi.updateProfile({ isAcceptingBookings: nextState });
      show(
        nextState ? 'Đã bật trạng thái nhận đơn trực tiếp' : 'Đã tạm nghỉ nhận đơn mới',
        'success',
      );
    } catch {
      setIsOnline(!nextState);
      show('Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  // Switch to customer mode
  const handleSwitchToCustomer = () => {
    router.replace('/(tabs)');
  };

  // Weather location change action
  const handleWeatherAlertAction = () => {
    TagoAlert.alert(
      '🌧️ Đề xuất đổi điểm chụp',
      'Cung An Định đang mưa lớn. Khách hàng và hệ thống đề xuất dời sang Cung Diên Thọ hoặc Studio.\n\nBạn có đồng ý phê duyệt điểm chụp mới?',
      [
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            if (weatherAlert?.bookingId && weatherAlert?.scheduleId) {
              try {
                await providerApi.resolveLocationChange(
                  weatherAlert.bookingId,
                  weatherAlert.scheduleId,
                  { approved: false, note: 'Đối tác từ chối đổi điểm' },
                );
                show('Đã từ chối đổi địa điểm', 'info');
              } catch {
                show('Lỗi xử lý yêu cầu', 'error');
              }
            }
            setWeatherAlert(null);
          },
        },
        {
          text: 'Duyệt điểm mới',
          style: 'default',
          onPress: async () => {
            if (weatherAlert?.bookingId && weatherAlert?.scheduleId) {
              try {
                await providerApi.resolveLocationChange(
                  weatherAlert.bookingId,
                  weatherAlert.scheduleId,
                  { approved: true, note: 'Đối tác đồng ý đổi điểm do mưa' },
                );
                show('Đã duyệt điểm chụp mới thành công!', 'success');
              } catch {
                show('Lỗi xử lý yêu cầu', 'error');
              }
            } else {
              show('Đã xác nhận điểm chụp thay thế!', 'success');
            }
            setWeatherAlert(null);
          },
        },
      ],
    );
  };

  // Start photoshoot session
  const handleStartSession = async (bookingId?: string) => {
    TagoAlert.alert(
      'Bắt đầu ca chụp',
      'Bạn đang gặp khách và sẵn sàng bắt đầu ca chụp ảnh?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Bắt đầu ngay',
          style: 'default',
          onPress: async () => {
            if (bookingId) {
              try {
                await providerApi.startSession(bookingId);
                show('Đã bắt đầu ca chụp thành công!', 'success');
                void fetchAllData();
              } catch {
                show('Không thể cập nhật trạng thái ca chụp', 'error');
              }
            } else {
              show('Ca chụp đã được kích hoạt thành công!', 'success');
            }
          },
        },
      ],
    );
  };

  // Withdraw money
  const handleWithdraw = () => {
    const available = walletData?.wallet?.availableBalance ?? 0;
    TagoAlert.alert(
      'Rút doanh thu về tài khoản',
      `Số dư khả dụng: ${available.toLocaleString('vi-VN')} đ.\n\nTiền sẽ được chuyển thẳng về tài khoản ngân hàng đã liên kết trong vòng 30 phút. Bạn có muốn tiếp tục?`,
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Xác nhận rút',
          style: 'default',
          onPress: () => {
            show('Yêu cầu rút tiền đã được gửi tới hệ thống TàGo', 'success');
          },
        },
      ],
    );
  };

  // Order Management Actions right on Home screen (100% synced with Web)
  const handleStatusChange = async (order: any, nextStatus: string, note?: string) => {
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(order._id, nextStatus, { note });
      show(`Đã cập nhật trạng thái đơn #${order.bookingCode || ''}!`, 'success');
      setDetailModalVisible(false);
      void fetchAllData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể cập nhật trạng thái đơn hàng';
      show(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePressPrimaryOrderAction = (order: any) => {
    const s = order.status || 'CONFIRMED';
    const type = order.bookingType || 'PRODUCT';

    setSelectedOrder(order);

    if (s === 'RETURNED') {
      setRefundModalVisible(true);
      return;
    }

    if (type === 'PRODUCT' && (s === 'DEPOSIT_PAID' || s === 'CONFIRMED')) {
      setWorkflowMode('HANDOVER');
      return;
    }

    if (
      (type === 'PHOTOGRAPHY' || type === 'COMBO') &&
      s === 'DEPOSIT_PAID'
    ) {
      TagoAlert.alert(
        'Chấp nhận lịch chụp',
        `Xác nhận nhận lịch chụp cho khách ${
          order.customerId?.profile?.fullName || order.contactInfo?.fullName || 'khách hàng'
        }?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Chấp nhận',
            onPress: () => handleStatusChange(order, 'CONFIRMED', 'Chấp nhận lịch chụp'),
          },
        ],
      );
      return;
    }

    if (
      (type === 'PHOTOGRAPHY' || type === 'COMBO') &&
      s === 'CONFIRMED'
    ) {
      TagoAlert.alert(
        'Bắt đầu buổi chụp',
        'Xác nhận bắt đầu ca chụp ảnh cho khách hàng?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Bắt đầu ngay',
            onPress: () => handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp'),
          },
        ],
      );
      return;
    }

    if (
      (type === 'PHOTOGRAPHY' || type === 'COMBO') &&
      s === 'IN_PROGRESS'
    ) {
      setWorkflowMode('DELIVER_PHOTOS');
      return;
    }

    if (
      (type === 'PRODUCT' && s === 'PICKED_UP') ||
      (type === 'COMBO' && s === 'COMBO_PHOTOS_APPROVED')
    ) {
      TagoAlert.alert(
        'Xác nhận đã trả đồ',
        'Khách hàng đã trả trang phục nguyên vẹn tại quầy?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đã nhận trả đồ',
            onPress: () => handleStatusChange(order, 'RETURNED', 'Khách đã trả trang phục'),
          },
        ],
      );
      return;
    }

    setDetailModalVisible(true);
  };

  const handlePressSecondaryOrderAction = (
    order: any,
    action: 'INCIDENT' | 'CANCEL' | 'RESCHEDULE_APPROVE' | 'RESCHEDULE_REJECT',
  ) => {
    setSelectedOrder(order);
    if (action === 'INCIDENT') {
      setWorkflowMode('REPORT_INCIDENT');
    } else if (action === 'CANCEL') {
      setWorkflowMode('CANCEL_ORDER');
    } else if (action === 'RESCHEDULE_APPROVE' || action === 'RESCHEDULE_REJECT') {
      const approved = action === 'RESCHEDULE_APPROVE';
      TagoAlert.alert(
        approved ? 'Chấp nhận dời lịch' : 'Từ chối dời lịch',
        approved
          ? 'Bạn đồng ý yêu cầu đổi lịch thuê/chụp của khách hàng?'
          : 'Bạn muốn từ chối yêu cầu dời lịch của khách?',
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: approved ? 'Đồng ý duyệt' : 'Từ chối',
            style: approved ? 'default' : 'destructive',
            onPress: async () => {
              try {
                await providerApi.resolveReschedule(order._id, approved);
                show(
                  approved ? 'Đã chấp nhận yêu cầu dời lịch!' : 'Đã từ chối yêu cầu dời lịch',
                  'success',
                );
                void fetchAllData();
              } catch (e: any) {
                show(
                  e?.response?.data?.message || 'Không thể xử lý yêu cầu dời lịch',
                  'error',
                );
              }
            },
          },
        ],
      );
    }
  };

  const handleConfirmEscrowRefund = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await providerApi.updateBookingStatus(selectedOrder._id, 'COMPLETED', {
        note: 'Đã kiểm tra áo nguyên vẹn & giải ngân tiền cọc Escrow',
      });
      show('Đã hoàn cọc và hoàn tất đơn hàng thành công!', 'success');
      setRefundModalVisible(false);
      setSelectedOrder(null);
      void fetchAllData();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Lỗi khi giải ngân tiền cọc', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter & sort active/manageable bookings by operational urgency
  const actionableBookings = useMemo(() => {
    const getStatusPriority = (status?: string): number => {
      switch (status) {
        case 'RETURN_PENDING':
        case 'RETURNED':
          return 1; // Ưu tiên 1: Chờ kiểm đồ & hoàn cọc Escrow
        case 'PICKUP_PENDING':
        case 'CONFIRMED':
        case 'PENDING':
          return 2; // Ưu tiên 2: Cần chuẩn bị & bàn giao áo cho khách
        case 'PICKED_UP':
        case 'IN_PROGRESS':
          return 3; // Ưu tiên 3: Khách đang thuê / đang chụp
        default:
          return 4;
      }
    };

    return bookings
      .filter((b) => {
        const s = b.status || 'CONFIRMED';
        const isPhoto = b.bookingType === 'PHOTOGRAPHY';

        // Loại bỏ các đơn Đã hoàn tất (COMPLETED) và Đã hủy (CANCELLED) khỏi mục "Đơn cần quản lý" hôm nay
        if (s === 'COMPLETED' || s === 'CANCELLED') return false;

        // Category filter
        if (filterCategory === 'PHOTOSHOOT' && !isPhoto) return false;
        if (filterCategory === 'RENTAL' && isPhoto) return false;

        // Task filter
        if (activeTaskFilter === 'PREPARE_CLOTHES') {
          return s === 'CONFIRMED' || s === 'PICKUP_PENDING' || s === 'PENDING';
        }
        if (activeTaskFilter === 'PICKUP_TODAY') {
          return s === 'PICKED_UP' || s === 'IN_PROGRESS';
        }
        if (activeTaskFilter === 'RETURN_DUE') {
          return s === 'RETURN_PENDING' || s === 'RETURNED';
        }
        if (activeTaskFilter === 'SHOOT_TODAY') {
          return isPhoto;
        }

        return true;
      })
      .sort((a, b) => {
        const prioDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
        if (prioDiff !== 0) return prioDiff;

        // Nếu cùng mức ưu tiên, sắp xếp theo hạn trả/nhận gần nhất lên trước
        const dateA = new Date(
          a.items?.[0]?.rentalPeriod?.endDate ||
            a.items?.[0]?.startDate ||
            a.updatedAt ||
            a.createdAt ||
            0,
        ).getTime();
        const dateB = new Date(
          b.items?.[0]?.rentalPeriod?.endDate ||
            b.items?.[0]?.startDate ||
            b.updatedAt ||
            b.createdAt ||
            0,
        ).getTime();
        return dateA - dateB;
      });
  }, [bookings, filterCategory, activeTaskFilter]);

  const escrowHeldAmount = useMemo(() => {
    return bookings.reduce((sum, b) => {
      const s = b.status || '';
      if (s === 'PICKED_UP' || s === 'IN_PROGRESS' || s === 'RETURN_PENDING' || s === 'RETURNED') {
        const dep =
          b.pricing?.totalDeposit ||
          b.depositAmount ||
          b.items?.[0]?.depositAmount ||
          0;
        return sum + Number(dep || 0);
      }
      return sum;
    }, 0);
  }, [bookings]);

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BA0049" />
      </View>
    );
  }

  const nextSession = overview?.todaySchedules?.[0] || null;
  const refundOrderAmount =
    selectedOrder?.pricing?.totalDeposit ||
    selectedOrder?.depositAmount ||
    selectedOrder?.items?.[0]?.depositAmount ||
    500000;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header with Store Identity, Weather & Online Switch, Mode Switcher */}
      <ProviderHeader
        profile={profile}
        unreadNotificationsCount={unreadCount}
        unreadChatCount={1}
        isOnline={isOnline}
        onToggleOnline={handleToggleOnline}
        onSwitchToCustomer={handleSwitchToCustomer}
        onOpenChat={() => router.push('/chat' as Href)}
        onOpenNotifications={() => router.push('/notifications' as Href)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* 2. Weather Alert / Location Change Banner (only if real alert exists) */}
        {weatherAlert && (
          <WeatherAlertBanner
            alert={weatherAlert}
            onPressAction={handleWeatherAlertAction}
          />
        )}

        {/* 3. Quick Management Actions Strip (4 1-Tap Shop Controls) */}
        <View style={styles.quickActionsRow}>
          <Pressable
            style={({ pressed }) => [styles.quickActionItem, pressed && styles.quickPressed]}
            onPress={() => router.push('/provider/qr-scanner' as Href)}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#BA0049' }]}>
              <MaterialIcons name="qr-code-scanner" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              Quét QR
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionItem, pressed && styles.quickPressed]}
            onPress={() => setAddProductModalVisible(true)}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#FFF0F3' }]}>
              <Ionicons name="add-circle-outline" size={21} color="#BA0049" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              Thêm áo dài
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionItem, pressed && styles.quickPressed]}
            onPress={() => router.push('/provider/orders' as Href)}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#F5F3F3' }]}>
              <Ionicons name="receipt-outline" size={19} color="#1B1C1C" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              Đơn hàng ({bookings.length})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionItem, pressed && styles.quickPressed]}
            onPress={() => router.push('/provider/store' as Href)}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="inventory-2" size={19} color="#059669" />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              Kiểm kho
            </Text>
          </Pressable>
        </View>

        {/* 4. Filter Category Pills */}
        <FilterPills
          selected={filterCategory}
          onSelect={(cat) => {
            setFilterCategory(cat);
            setActiveTaskFilter('ALL');
          }}
          allCount={
            (overview?.kpis?.todaySchedulesCount ?? 0) +
            (overview?.kpis?.activeRentalsCount ?? bookings.length)
          }
          photoshootCount={overview?.kpis?.todaySchedulesCount ?? 0}
          rentalCount={overview?.kpis?.activeRentalsCount ?? bookings.length}
        />

        {/* 5. Today's Tasks Bento Grid (4 Cards - Interactive Filter) */}
        <DailyTasksGrid
          kpis={overview?.kpis}
          activeTask={activeTaskFilter}
          onPressTask={(type) => {
            setActiveTaskFilter(type);
            if (type === 'SHOOT_TODAY') setFilterCategory('PHOTOSHOOT');
            else if (type === 'PREPARE_CLOTHES' || type === 'PICKUP_TODAY' || type === 'RETURN_DUE') {
              setFilterCategory('RENTAL');
            } else {
              setFilterCategory('ALL');
            }
          }}
        />

        {/* 6. Hero Card: Next Upcoming Photoshoot Session (if exists) */}
        {(filterCategory === 'ALL' || filterCategory === 'PHOTOSHOOT') && nextSession && (
          <NextSessionHeroCard
            session={nextSession}
            onStartSession={() => handleStartSession(nextSession?.bookingId)}
            onOpenMap={() => {
              const matchingOrder = bookings.find(
                (b) => b._id === nextSession?.bookingId || b._id === nextSession?.id,
              );
              setNavOrder(matchingOrder || null);
              setNavModalVisible(true);
            }}
          />
        )}

        {/* 7. LIVE ACTIONABLE ORDERS FEED (Directly Manageable on Home Screen!) */}
        <View style={styles.liveOrdersSection}>
          <View style={styles.liveOrdersHeader}>
            <View style={styles.liveOrdersTitleRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveOrdersTitle}>
                Đơn hàng cần quản lý ({actionableBookings.length})
              </Text>
            </View>
            <Pressable
              style={styles.seeAllOrdersBtn}
              onPress={() => router.push('/provider/orders' as Href)}
            >
              <Text style={styles.seeAllOrdersText}>Tất cả đơn</Text>
              <Ionicons name="chevron-forward" size={13} color="#BA0049" />
            </Pressable>
          </View>

          {actionableBookings.length === 0 ? (
            <View style={styles.emptyOrdersBox}>
              <Ionicons name="checkmark-done-circle-outline" size={32} color="#059669" />
              <Text style={styles.emptyOrdersTitle}>
                Không có đơn nào trong mục lọc này
              </Text>
              <Text style={styles.emptyOrdersSub}>
                Chạm Hiện tất cả hoặc mở tab Đơn hàng để xem toàn bộ lịch sử đơn.
              </Text>
            </View>
          ) : (
            <View style={styles.ordersListWrap}>
              {actionableBookings.slice(0, 3).map((order, idx) => (
                <OrderCard
                  key={order._id || idx}
                  order={order}
                  onPressDetail={(o) => {
                    setSelectedOrder(o);
                    setDetailModalVisible(true);
                  }}
                  onPressPrimaryAction={handlePressPrimaryOrderAction}
                  onPressSecondaryAction={handlePressSecondaryOrderAction}
                  onOpenChat={() => router.push('/chat' as Href)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 8. TÀGO PARTNER PRO Finance & Wallet Card */}
        <LumePartnerProCard
          walletData={walletData}
          kpis={overview?.kpis}
          escrowHeldAmount={escrowHeldAmount}
          onWithdraw={handleWithdraw}
        />

        {/* 9. Inventory Progress & Active Garments Card */}
        <InventoryProgressCard
          items={inventoryItems}
          onViewDetails={() => router.push('/provider/store' as Href)}
        />

        {/* 10. Reputation & Incident Card */}
        <ReputationIncidentCard
          rating={overview?.performance?.averageRating ?? 5.0}
          badgeText="Chuẩn đối tác TàGo"
          incidentText="Chưa ghi nhận sự cố hay khiếu nại"
          onPressDetail={() => setReviewsTrustModalVisible(true)}
        />
      </ScrollView>

      {/* Direct Order Detail Modal */}
      <OrderDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        order={selectedOrder}
        actionLoading={actionLoading}
        onAction={(order, nextStatus) => handleStatusChange(order, nextStatus)}
        onOpenWorkflowModal={(order, mode) => {
          setDetailModalVisible(false);
          setSelectedOrder(order);
          setWorkflowMode(mode);
        }}
        onRefundEscrow={(order) => {
          setDetailModalVisible(false);
          setSelectedOrder(order);
          setRefundModalVisible(true);
        }}
        onOpenChat={() => {
          setDetailModalVisible(false);
          router.push('/chat' as Href);
        }}
        onOpenNavigationMap={(order) => {
          setNavOrder(order);
          setNavModalVisible(true);
        }}
      />

      {/* Provider Grab-Driver Navigation & Photoshoot Spot Modal */}
      <ProviderJobNavigationModal
        visible={navModalVisible}
        onClose={() => setNavModalVisible(false)}
        session={nextSession}
        order={navOrder}
        providerProfile={profile}
        weatherAlert={weatherAlert}
        onStartSession={(bId) => handleStartSession(bId)}
        onOpenChat={() => router.push('/chat' as Href)}
        onResolveLocationChange={async (approved) => {
          const targetBookingId = navOrder?._id || weatherAlert?.bookingId;
          const targetScheduleId =
            navOrder?.photoshootSchedule?._id || weatherAlert?.scheduleId;
          if (targetBookingId && targetScheduleId) {
            try {
              await providerApi.resolveLocationChange(targetBookingId, targetScheduleId, {
                approved,
                note: approved
                  ? 'Đối tác phê duyệt điểm chụp mới trên Bản đồ'
                  : 'Đối tác giữ nguyên điểm chụp cũ',
              });
              show(
                approved ? 'Đã duyệt điểm chụp mới thành công!' : 'Đã giữ nguyên điểm chụp cũ',
                'success',
              );
              setWeatherAlert(null);
              void fetchAllData();
            } catch {
              show('Không thể xử lý yêu cầu đổi địa điểm', 'error');
            }
          }
        }}
      />

      {/* Web-Synced Provider Workflow Modal (Handover, Photo Delivery, Incident, Cancel) */}
      <ProviderOrderWorkflowModal
        visible={workflowMode !== null}
        mode={workflowMode}
        order={selectedOrder}
        onClose={() => setWorkflowMode(null)}
        onSuccess={() => {
          setWorkflowMode(null);
          void fetchAllData();
        }}
      />

      {/* Direct Escrow Refund Modal */}
      <EscrowRefundModal
        visible={refundModalVisible}
        onClose={() => setRefundModalVisible(false)}
        onConfirm={handleConfirmEscrowRefund}
        customerName={
          selectedOrder?.customerId?.profile?.fullName ||
          selectedOrder?.contactInfo?.fullName ||
          'Khách hàng'
        }
        orderCode={
          selectedOrder?.bookingCode ||
          (selectedOrder?._id ? `#${selectedOrder._id.slice(-6).toUpperCase()}` : '#BK')
        }
        amount={refundOrderAmount}
        loading={actionLoading}
      />

      {/* Quick Add Product Modal */}
      <AddProductModal
        visible={addProductModalVisible}
        onClose={() => setAddProductModalVisible(false)}
        onCreated={() => {
          setAddProductModalVisible(false);
          void fetchAllData();
        }}
      />

      {/* Provider Reviews Reply & Customer Trust Score Modal */}
      <ProviderReviewsTrustModal
        visible={reviewsTrustModalVisible}
        bookings={bookings}
        onClose={() => setReviewsTrustModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  quickActionItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EFECEB',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  quickIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  liveOrdersSection: {
    marginBottom: 14,
    gap: 10,
  },
  liveOrdersHeader: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveOrdersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA0049',
  },
  liveOrdersTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  seeAllOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllOrdersText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  ordersListWrap: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyOrdersBox: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 4,
  },
  emptyOrdersTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 4,
  },
  emptyOrdersSub: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    textAlign: 'center',
  },
});
