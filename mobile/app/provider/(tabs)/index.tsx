import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { chatApi } from '@/apis/chatApi';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { FontFamily } from '@/constants/theme';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { appStorage } from '@/utils/storage';
import { openOrderCustomerChat } from '@/utils/chatNavigation';
import {
  getRentalItems,
  isPhotographyItem,
  resolveBookingDisplayState,
} from '@/utils/rentalState';
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
import {
  OrderDetailModal,
  type ProviderRentalActionType,
} from '@/components/provider/orders/OrderDetailModal';
import { EscrowRefundModal } from '@/components/provider/orders/EscrowRefundModal';
import {
  ProviderOrderWorkflowModal,
  type ProviderWorkflowMode,
} from '@/components/provider/orders/ProviderOrderWorkflowModal';
import {
  ApproveStaffPickerModal,
  useApproveStaffPicker,
} from '@/components/provider/orders/ApproveStaffPickerModal';
import { setPendingProductFormState } from '@/utils/providerFormBridge';
import { ProviderJobNavigationModal } from '@/components/provider/ProviderJobNavigationModal';

const PROVIDER_ONLINE_PREF_KEY = 'vh_provider_online_display';

export default function ProviderDashboardScreen() {
  const { show } = useToast();
  const { unreadCount, bookingSyncVersion, bumpBookingSync, pushLocalBanner } =
    useNotifications();
  const approveStaffPicker = useApproveStaffPicker();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real backend states
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [overview, setOverview] = useState<ProviderOverviewResponse | null>(null);
  const [walletData, setWalletData] = useState<ProviderWalletResponse | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventorySummaryItem[] | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Filter states
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [activeTaskFilter, setActiveTaskFilter] = useState<TaskFilterKey>('ALL');

  // Interactive Management Modals
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<ProviderWorkflowMode>(null);
  const [workflowItemId, setWorkflowItemId] = useState<string | null>(null);
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
      const [profRes, overRes, walletRes, invRes, bookRes, chatRes, onlinePref] =
        await Promise.allSettled([
          providerApi.getMe(),
          providerApi.getOverview(),
          providerApi.getWallet(),
          providerApi.getInventorySummary(),
          providerApi.getBookings(),
          chatApi.rooms(),
          appStorage.get(PROVIDER_ONLINE_PREF_KEY),
        ]);

      if (profRes.status === 'fulfilled' && profRes.value) {
        setProfile(profRes.value);
        if (onlinePref.status === 'fulfilled' && onlinePref.value !== null) {
          setIsOnline(onlinePref.value !== '0');
        } else {
          setIsOnline(profRes.value.isAcceptingBookings ?? true);
        }
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

      if (chatRes.status === 'fulfilled' && Array.isArray(chatRes.value)) {
        const totalUnread = chatRes.value.reduce(
          (sum, room) => sum + Number(room.unreadCount || 0),
          0,
        );
        setUnreadChatCount(totalUnread);
      }

      if (bookRes.status === 'fulfilled' && Array.isArray(bookRes.value)) {
        setBookings(bookRes.value);
        setSelectedOrder((prev: any) =>
          prev?._id
            ? bookRes.value.find((b: any) => b._id === prev._id) ?? prev
            : prev,
        );

        let foundWeather: WeatherLocationChangeAlert | null = null;
        for (const b of bookRes.value) {
          const photoshootSchedule =
            b?.photoshootSchedule ||
            b?.schedules?.find((s: any) => s.scheduleType === 'PHOTOSHOOT');
          if (
            photoshootSchedule?.locationChangeRequest &&
            photoshootSchedule.locationChangeRequest.status === 'PENDING'
          ) {
            foundWeather = {
              bookingId: b._id,
              scheduleId: photoshootSchedule._id,
              currentLocationName:
                b.location?.address ||
                photoshootSchedule.locationAddress ||
                'Điểm chụp tại Huế',
              suggestedLocation:
                photoshootSchedule.locationChangeRequest.requestedLocation?.address ||
                photoshootSchedule.locationChangeRequest.address ||
                'Điểm chụp thay thế trong mái vòm / Studio',
              rainStopDuration: 'Đề xuất đổi điểm chụp do thời tiết',
              status: 'PENDING',
            };
            break;
          }
        }
        setWeatherAlert(foundWeather);
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

  useEffect(() => {
    if (bookingSyncVersion > 0) {
      void fetchAllData();
    }
  }, [bookingSyncVersion, fetchAllData]);

  useFocusEffect(
    useCallback(() => {
      void fetchAllData();
      return undefined;
    }, [fetchAllData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchAllData();
  }, [fetchAllData]);

  // Toggle store availability locally without triggering forbidden field errors
  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    await appStorage.set(PROVIDER_ONLINE_PREF_KEY, nextState ? '1' : '0');
    show(
      nextState
        ? 'Đã bật hiển thị sẵn sàng nhận đơn & lịch chụp'
        : 'Đã tạm ẩn trạng thái nhận đơn trên ứng dụng',
      'success',
    );
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

  // Start photoshoot session (guarded so DEPOSIT_PAID must be confirmed first)
  const handleStartSession = async (bookingId?: string) => {
    if (!bookingId) {
      show('Không tìm thấy mã đơn ca chụp để cập nhật', 'error');
      return;
    }
    const matched = bookings.find((b) => b._id === bookingId);
    if (matched) {
      const stage = resolveBookingDisplayState(matched, 'provider').stage;
      if (stage === 'PENDING_PAYMENT' || stage === 'DRAFT') {
        show('Đơn hàng này khách chưa thanh toán cọc, chưa thể xác nhận hoặc bắt đầu.', 'info');
        return;
      }
      if (stage === 'DEPOSIT_PAID') {
        TagoAlert.alert(
          'Cần xác nhận nhận lịch trước',
          'Khách đã thanh toán cọc nhưng bạn chưa xác nhận nhận lịch này. Bạn muốn xác nhận nhận lịch ngay?',
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Xác nhận nhận lịch',
              onPress: () =>
                void handleStatusChange(
                  matched,
                  'CONFIRMED',
                  'Đã xác nhận nhận lịch chụp',
                ),
            },
          ],
        );
        return;
      }
    }

    TagoAlert.alert(
      'Bắt đầu ca chụp',
      'Bạn đang gặp khách và sẵn sàng bắt đầu ca chụp ảnh?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Bắt đầu ngay',
          style: 'default',
          onPress: async () => {
            try {
              await providerApi.startSession(bookingId);
              bumpBookingSync(bookingId);
              show('Đã bắt đầu ca chụp thành công!', 'success');
              void fetchAllData();
            } catch (e: any) {
              const msg = e?.response?.data?.message || 'Không thể cập nhật trạng thái ca chụp';
              show(Array.isArray(msg) ? msg[0] : msg, 'error');
            }
          },
        },
      ],
    );
  };

  // Show transparent wallet reconciliation guidance instead of a simulated withdrawal
  const handleWithdraw = () => {
    const available = walletData?.wallet?.availableBalance ?? 0;
    TagoAlert.alert(
      'Đối soát & Rút doanh thu ví TàGo',
      `Số dư khả dụng hiện tại: ${available.toLocaleString('vi-VN')} đ.\nTiền cọc Escrow đang tạm giữ: ${escrowHeldAmount.toLocaleString('vi-VN')} đ.\n\nKhoản doanh thu khả dụng được hệ thống TàGo tổng hợp đối soát định kỳ về tài khoản ngân hàng đã liên kết. Nếu cần đối soát sớm, vui lòng liên hệ TàGo Care.`,
      [{ text: 'Đã hiểu', style: 'default' }],
    );
  };

  // Order Management Actions right on Home screen (100% synced with RentalFulfillment + Photoshoot)
  const submitStatusChange = async (
    order: any,
    nextStatus: string,
    note?: string,
    assignedStaffId?: string,
    assignedStaffName?: string,
  ) => {
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
          : `Đã cập nhật trạng thái đơn #${order.bookingCode || ''}!`,
        'success',
      );
      approveStaffPicker.close();
      setDetailModalVisible(false);
      void fetchAllData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể cập nhật trạng thái đơn hàng';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (order: any, nextStatus: string, note?: string) => {
    if (nextStatus === 'CONFIRMED') {
      try {
        const openedPicker = await approveStaffPicker.checkNeedsStaffPicker(order, note);
        if (openedPicker) {
          setDetailModalVisible(false);
          return;
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message || 'Không thể tải danh sách thợ chụp rảnh';
        show(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }
    }
    await submitStatusChange(order, nextStatus, note);
  };

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
          : myRentalItems.filter(
              (it) => !it.rentalFulfillment?.status || it.rentalFulfillment.status === 'PENDING',
            );
        for (const it of targets.length ? targets : [targetItem]) {
          await providerApi.markRentalReady(order._id, it._id);
        }
        show('Đã soạn xong áo! Hãy tải ảnh hiện trạng để bàn giao.', 'success');
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
      setDetailModalVisible(false);
      void fetchAllData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể thực hiện thao tác thuê đồ';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenOrderDetail = (order: any) => {
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

  const handlePressPrimaryOrderAction = (order: any) => {
    const display = resolveBookingDisplayState(order, 'provider');
    const stage = display.stage;
    const isPhotoOnly = display.isPhotoshootOnly;

    setSelectedOrder(order);

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
        TagoAlert.alert(
          'Bắt đầu buổi chụp',
          'Xác nhận bắt đầu ca chụp ảnh cho khách hàng?',
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Bắt đầu ngay',
              onPress: () =>
                void handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp'),
            },
          ],
        );
      } else {
        void handleRentalAction(order, 'READY');
      }
      return;
    }

    if (stage === 'READY_NEEDS_HANDOVER_PHOTOS') {
      const target = getRentalItems(order, true).find(
        (it) => it.rentalFulfillment?.status === 'READY_FOR_PICKUP',
      );
      setWorkflowItemId(target?._id || null);
      setWorkflowMode('HANDOVER');
      return;
    }

    if (stage === 'IN_RENTAL' && display.isCombo && !order.photosApproved) {
      void handleStatusChange(order, 'IN_PROGRESS', 'Bắt đầu buổi chụp Combo');
      return;
    }

    if (stage === 'IN_PROGRESS') {
      setWorkflowItemId(null);
      setWorkflowMode('DELIVER_PHOTOS');
      return;
    }

    if (stage === 'CUSTOMER_RETURN_REQUESTED') {
      TagoAlert.alert(
        'Xác nhận đã nhận lại cổ phục',
        'Khách hàng đã mang áo trả lại tại tiệm? Chuyển sang kiểm tra để giải phóng tiền cọc.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận đã nhận lại',
            onPress: () => void handleRentalAction(order, 'RETURNED'),
          },
        ],
      );
      return;
    }

    if (stage === 'RETURNED_NEEDS_INSPECTION') {
      setWorkflowItemId(null);
      setRefundModalVisible(true);
      return;
    }

    if (stage === 'CLEANING_AFTER_REFUND') {
      void handleRentalAction(order, 'CLEANING_COMPLETED');
      return;
    }

    handleOpenOrderDetail(order);
  };

  const handlePressSecondaryOrderAction = (
    order: any,
    action: 'INCIDENT' | 'CANCEL' | 'RESCHEDULE_APPROVE' | 'RESCHEDULE_REJECT',
  ) => {
    setSelectedOrder(order);
    if (action === 'INCIDENT') {
      const target = getRentalItems(order, true)[0];
      setWorkflowItemId(target?._id || null);
      setWorkflowMode('REPORT_INCIDENT');
    } else if (action === 'CANCEL') {
      setWorkflowItemId(null);
      setWorkflowMode('CANCEL_ORDER');
    } else if (action === 'RESCHEDULE_APPROVE' || action === 'RESCHEDULE_REJECT') {
      const pendingItem = order.items?.find(
        (it: any) => it?.rescheduleRequest?.status === 'PENDING',
      );
      if (!pendingItem?._id) {
        show('Không tìm thấy item yêu cầu đổi lịch', 'error');
        return;
      }
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
                await providerApi.resolveReschedule(order._id, pendingItem._id, {
                  approved,
                  note: approved
                    ? 'Đối tác chấp thuận đổi lịch thuê'
                    : 'Đối tác từ chối đổi lịch do trùng lịch',
                });
                bumpBookingSync(order._id);
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
      const myRentalItems = getRentalItems(selectedOrder, true);
      const targets = workflowItemId
        ? myRentalItems.filter((it) => it._id === workflowItemId)
        : myRentalItems.filter((it) => it.rentalFulfillment?.status === 'RETURNED');
      const finalTargets = targets.length > 0 ? targets : myRentalItems;

      if (finalTargets.length === 0) {
        show('Không tìm thấy áo dài thuê để hoàn cọc', 'error');
        setActionLoading(false);
        return;
      }

      for (const it of finalTargets) {
        await providerApi.confirmNoIncident(
          selectedOrder._id,
          it._id,
          'Đã kiểm tra áo nguyên vẹn & giải ngân tiền cọc Escrow',
        );
      }
      bumpBookingSync(selectedOrder._id);
      pushLocalBanner({
        title: `Đã hoàn cọc Escrow #${selectedOrder.bookingCode || ''}`,
        content: 'Cọc Escrow đã được giải phóng, trang phục đang chờ hoàn tất giặt ủi.',
        type: 'ESCROW_RELEASED',
        metadata: {
          bookingId: selectedOrder._id,
          bookingCode: selectedOrder.bookingCode,
          status: 'RETURNED',
          stage: 'CLEANING_AFTER_REFUND',
          targetRole: 'provider',
        },
      });
      show('Đã xác nhận không sự cố & hoàn cọc Escrow!', 'success');
      setRefundModalVisible(false);
      setWorkflowItemId(null);
      setSelectedOrder(null);
      void fetchAllData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Lỗi khi giải ngân tiền cọc';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Single consistent active bookings source & task counters
  const activeOrders = useMemo(() => {
    return bookings.filter(
      (b) =>
        !['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(
          String(b.status || '').toUpperCase(),
        ),
    );
  }, [bookings]);

  const dashboardCounts = useMemo(() => {
    let rentalTotal = 0;
    let photoTotal = 0;
    let prepareCount = 0;
    let activeRentalsCount = 0;
    let returnsDueCount = 0;
    let shootActiveCount = 0;
    let incidentCount = 0;

    for (const b of activeOrders) {
      const display = resolveBookingDisplayState(b, 'provider');
      const s = display.stage;
      if (!display.isPhotoshootOnly) rentalTotal += 1;
      if (display.isPhotoshootOnly || display.isCombo) photoTotal += 1;

      if (
        !display.isPhotoshootOnly &&
        ['DEPOSIT_PAID', 'PREPARING', 'READY_NEEDS_HANDOVER_PHOTOS', 'HANDOVER_AWAITING_CUSTOMER'].includes(
          s,
        )
      ) {
        prepareCount += 1;
      }
      if (s === 'IN_RENTAL') activeRentalsCount += 1;
      if (
        [
          'CUSTOMER_RETURN_REQUESTED',
          'INCIDENT_PENDING_CUSTOMER',
          'RETURNED_NEEDS_INSPECTION',
          'CLEANING_AFTER_REFUND',
          'DISPUTED',
        ].includes(s)
      ) {
        returnsDueCount += 1;
      }
      if (display.isPhotoshootOnly || display.isCombo) {
        shootActiveCount += 1;
      }
      if (s === 'INCIDENT_PENDING_CUSTOMER' || s === 'DISPUTED') {
        incidentCount += 1;
      }
    }

    return {
      allTotal: activeOrders.length,
      rentalTotal,
      photoTotal,
      prepareCount,
      activeRentalsCount,
      returnsDueCount,
      shootActiveCount,
      incidentCount,
    };
  }, [activeOrders]);

  // Filter & sort active/manageable bookings identically to the counts above
  const actionableBookings = useMemo(() => {
    const getStatusPriority = (order: any): number => {
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
        default:
          return 4;
      }
    };

    return activeOrders
      .filter((b) => {
        const display = resolveBookingDisplayState(b, 'provider');
        const stage = display.stage;

        if (filterCategory === 'PHOTOSHOOT' && !display.isPhotoshootOnly && !display.isCombo) {
          return false;
        }
        if (filterCategory === 'RENTAL' && display.isPhotoshootOnly) {
          return false;
        }

        if (activeTaskFilter === 'PREPARE_CLOTHES') {
          return (
            !display.isPhotoshootOnly &&
            [
              'DEPOSIT_PAID',
              'PREPARING',
              'READY_NEEDS_HANDOVER_PHOTOS',
              'HANDOVER_AWAITING_CUSTOMER',
            ].includes(stage)
          );
        }
        if (activeTaskFilter === 'PICKUP_TODAY') {
          return stage === 'IN_RENTAL';
        }
        if (activeTaskFilter === 'RETURN_DUE') {
          return [
            'CUSTOMER_RETURN_REQUESTED',
            'INCIDENT_PENDING_CUSTOMER',
            'RETURNED_NEEDS_INSPECTION',
            'CLEANING_AFTER_REFUND',
            'DISPUTED',
          ].includes(stage);
        }
        if (activeTaskFilter === 'SHOOT_TODAY') {
          return display.isPhotoshootOnly || display.isCombo;
        }

        return true;
      })
      .sort((a, b) => {
        const prioDiff = getStatusPriority(a) - getStatusPriority(b);
        if (prioDiff !== 0) return prioDiff;

        const dateA = new Date(
          a.items?.[0]?.rentalTo ||
            a.items?.[0]?.shootDate ||
            a.items?.[0]?.rentalFrom ||
            a.updatedAt ||
            a.createdAt ||
            0,
        ).getTime();
        const dateB = new Date(
          b.items?.[0]?.rentalTo ||
            b.items?.[0]?.shootDate ||
            b.items?.[0]?.rentalFrom ||
            b.updatedAt ||
            b.createdAt ||
            0,
        ).getTime();
        return dateA - dateB;
      });
  }, [activeOrders, filterCategory, activeTaskFilter]);

  const escrowHeldAmount = useMemo(() => {
    return activeOrders.reduce((sum, b) => {
      const stage = resolveBookingDisplayState(b, 'provider').stage;
      if (
        [
          'HANDOVER_AWAITING_CUSTOMER',
          'IN_RENTAL',
          'CUSTOMER_RETURN_REQUESTED',
          'INCIDENT_PENDING_CUSTOMER',
          'RETURNED_NEEDS_INSPECTION',
          'DISPUTED',
          'IN_PROGRESS',
          'AWAITING_REVIEW',
          'COMBO_PHOTOS_APPROVED',
        ].includes(stage)
      ) {
        const dep =
          b.pricingSummary?.depositTotal ??
          b.depositAmount ??
          (Array.isArray(b.items)
            ? b.items.reduce(
                (s: number, it: any) =>
                  s + (isPhotographyItem(it) ? 0 : (it.depositAmount ?? 0) * (it.quantity ?? 1)),
                0,
              )
            : 0);
        return sum + Number(dep || 0);
      }
      return sum;
    }, 0);
  }, [activeOrders]);

  const nextSessionState = useMemo(() => {
    const candidates = [
      ...(overview?.upcomingSchedules || []),
      ...(overview?.todaySchedules || []),
    ];
    for (const candidate of candidates) {
      const matchedOrder = bookings.find(
        (b) => b._id === candidate.bookingId || b._id === candidate.id,
      );
      if (matchedOrder) {
        const st = String(matchedOrder.status || '').toUpperCase();
        if (
          [
            'DRAFT',
            'PENDING_PAYMENT',
            'IN_PROGRESS',
            'AWAITING_REVIEW',
            'COMBO_PHOTOS_APPROVED',
            'COMPLETED',
            'CANCELLED',
            'REFUNDED',
            'PARTIALLY_REFUNDED',
          ].includes(st)
        ) {
          continue;
        }
        const display = resolveBookingDisplayState(matchedOrder, 'provider');
        const phone =
          matchedOrder.customerId?.auth?.phone ||
          matchedOrder.contactInfo?.phone ||
          candidate.customer?.phone;
        const enrichedSession = {
          ...candidate,
          customer: {
            ...candidate.customer,
            phone: phone || undefined,
          },
        };
        return {
          session: enrichedSession,
          matchedOrder,
          requiresConfirmation: display.stage === 'DEPOSIT_PAID',
          canStartSession:
            display.stage === 'PREPARING' ||
            (display.stage === 'IN_RENTAL' && display.isCombo),
        };
      }
      if (!candidate.bookingId) {
        return {
          session: candidate,
          matchedOrder: null,
          requiresConfirmation: false,
          canStartSession: false,
        };
      }
    }
    return {
      session: null,
      matchedOrder: null,
      requiresConfirmation: false,
      canStartSession: false,
    };
  }, [overview?.upcomingSchedules, overview?.todaySchedules, bookings]);

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BA0049" />
      </View>
    );
  }
  const nextSession = nextSessionState.session;
  const navTargetOrder = navOrder || nextSessionState.matchedOrder;
  const navTargetStage = navTargetOrder
    ? resolveBookingDisplayState(navTargetOrder, 'provider').stage
    : null;
  const isShopVerified = Boolean(
    profile?.isVerified ||
      profile?.verificationStatus === 'APPROVED' ||
      profile?.status === 'APPROVED',
  );
  const refundOrderAmount =
    selectedOrder?.pricingSummary?.depositTotal ??
    selectedOrder?.depositAmount ??
    (Array.isArray(selectedOrder?.items)
      ? selectedOrder.items.reduce(
          (sum: number, it: any) =>
            sum + (isPhotographyItem(it) ? 0 : (it.depositAmount ?? 0) * (it.quantity ?? 1)),
          0,
        )
      : 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header with Store Identity, Weather & Online Switch, Mode Switcher */}
      <ProviderHeader
        profile={profile}
        unreadNotificationsCount={unreadCount}
        unreadChatCount={unreadChatCount}
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
            onPress={() => {
              setPendingProductFormState({
                editingProduct: null,
                onSaved: () => void fetchAllData(),
              });
              router.push('/provider/product-form' as Href);
            }}
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
            <View style={styles.quickIconWrap}>
              <View style={[styles.quickIconBox, { backgroundColor: '#F5F3F3' }]}>
                <Ionicons name="receipt-outline" size={19} color="#1B1C1C" />
              </View>
              {activeOrders.length > 0 && (
                <View style={styles.quickCountBadge}>
                  <Text style={styles.quickCountBadgeText}>
                    {activeOrders.length > 99 ? '99+' : activeOrders.length}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              Đơn hàng
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
          allCount={dashboardCounts.allTotal}
          photoshootCount={dashboardCounts.photoTotal}
          rentalCount={dashboardCounts.rentalTotal}
        />

        {/* 5. Today's Tasks Bento Grid (4 Cards - Interactive Filter) */}
        <DailyTasksGrid
          kpis={overview?.kpis}
          counts={{
            prepareCount: dashboardCounts.prepareCount,
            activeRentalsCount: dashboardCounts.activeRentalsCount,
            returnsDueCount: dashboardCounts.returnsDueCount,
            todaySchedulesCount: dashboardCounts.shootActiveCount,
          }}
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
            requiresConfirmation={nextSessionState.requiresConfirmation}
            canStartSession={nextSessionState.canStartSession}
            onConfirmBooking={() => {
              if (nextSessionState.matchedOrder) {
                void handleStatusChange(
                  nextSessionState.matchedOrder,
                  'CONFIRMED',
                  'Đã xác nhận nhận lịch chụp',
                );
              }
            }}
            onStartSession={() => void handleStartSession(nextSession?.bookingId)}
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
              <Text style={styles.seeAllOrdersText}>Tất cả đơn ({bookings.length})</Text>
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
                  onPressDetail={(o) => handleOpenOrderDetail(o)}
                  onPressPrimaryAction={handlePressPrimaryOrderAction}
                  onPressSecondaryAction={handlePressSecondaryOrderAction}
                  onOpenChat={() => void openOrderCustomerChat(order)}
                />
              ))}

              {actionableBookings.length > 3 && (
                <Pressable
                  style={({ pressed }) => [styles.moreOrdersBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push('/provider/orders' as Href)}
                >
                  <Text style={styles.moreOrdersText}>
                    Xem thêm {actionableBookings.length - 3} đơn đang hoạt động
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#BA0049" />
                </Pressable>
              )}
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
          badgeText={isShopVerified ? 'Chuẩn đối tác TàGo' : 'Đang hoàn thiện xác minh'}
          incidentText={
            dashboardCounts.incidentCount > 0
              ? `Có ${dashboardCounts.incidentCount} đơn đang có sự cố cần theo dõi`
              : 'Chưa ghi nhận sự cố hay khiếu nại'
          }
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
        onRentalAction={handleRentalAction}
        onOpenWorkflowModal={(order, mode, itemId) => {
          setDetailModalVisible(false);
          setSelectedOrder(order);
          setWorkflowItemId(itemId || null);
          setWorkflowMode(mode);
        }}
        onRefundEscrow={(order) => {
          setDetailModalVisible(false);
          setSelectedOrder(order);
          setWorkflowItemId(null);
          setRefundModalVisible(true);
        }}
        onOpenChat={() => {
          setDetailModalVisible(false);
          void openOrderCustomerChat(selectedOrder);
        }}
        onOpenNavigationMap={(order) => {
          setNavOrder(order);
          setNavModalVisible(true);
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
            void submitStatusChange(
              approveStaffPicker.pendingOrder,
              'CONFIRMED',
              approveStaffPicker.pendingNote,
              staffId,
              staffName,
            );
          }
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
        requiresConfirmation={navTargetStage === 'DEPOSIT_PAID'}
        canStartSession={
          navTargetStage === 'PREPARING' ||
          (navTargetStage === 'IN_RENTAL' &&
            Boolean(navTargetOrder?.items?.some(isPhotographyItem)))
        }
        onConfirmBooking={() => {
          if (navTargetOrder) {
            void handleStatusChange(
              navTargetOrder,
              'CONFIRMED',
              'Đã xác nhận nhận lịch chụp',
            );
          }
        }}
        onStartSession={(bId) => handleStartSession(bId)}
        onOpenChat={(ord) => void openOrderCustomerChat(ord || navTargetOrder)}
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
  quickIconWrap: {
    position: 'relative',
  },
  quickIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCountBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  quickCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: FontFamily.bodyBold,
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  moreOrdersBtn: {
    marginTop: 2,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FAD1E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  moreOrdersText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
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
