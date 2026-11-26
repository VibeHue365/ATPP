import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookingApi, type BookingIncident } from '@/apis/bookingApi';
import { chatApi } from '@/apis/chatApi';
import { checkoutApi } from '@/apis/checkoutApi';
import { contractApi } from '@/apis/contractApi';
import { BookingContractsSection } from '@/components/contracts/BookingContractsSection';
import { ContractReviewModal } from '@/components/contracts/ContractReviewModal';
import { RequireAuth } from '@/components/auth/RequireAuth';
import {
  AuthorizedEvidenceImage,
  buildEvidenceImageUri,
} from '@/components/booking/AuthorizedEvidenceImage';
import { BookingFlowStepper } from '@/components/booking/BookingFlowStepper';
import { CustomerIssuePanel } from '@/components/booking/CustomerIssuePanel';
import { CustomerRefundPanel } from '@/components/booking/CustomerRefundPanel';
import { BookingRouteMapCard } from '@/components/booking/BookingRouteMapCard';
import { LocationChangeModal } from '@/components/booking/LocationChangeModal';
import { RescheduleModal } from '@/components/booking/RescheduleModal';
import { HeritageWeatherCard } from '@/components/weather/HeritageWeatherCard';
import { PlanBSelectionModal } from '@/components/weather/PlanBSelectionModal';
import { WeatherCancellationModal } from '@/components/weather/WeatherCancellationModal';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import { useBookingDetail } from '@/hooks/useBookings';
import type { Booking, BookingItem, BookingSchedule } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  bookingStatus,
  bookingTitle,
  formatDate,
  formatDateTime,
  formatDepositSettlementLabel,
  getRentalLifecycleTimestamps,
  itemImage,
  itemName,
  itemProvider,
} from '@/utils/booking';
import { getMediaUrl } from '@/utils/media';
import {
  getItemSkuOrCode,
  getReturnEligibleRentalItems,
  isProductItem,
  resolveBookingDisplayState,
  resolveRentalItemStage,
} from '@/utils/rentalState';

const money = (value = 0) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

const actionStyles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  buttonText: { fontFamily: FontFamily.bodyBold, fontSize: 10.5, color: Colors.primary },
  pending: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.warning,
    marginVertical: 8,
  },
});

function ItemDetailWithActions({
  booking,
  item,
  incident,
  canReschedule,
  onReschedule,
  onRequestReturnItem,
  timeSlotFallback,
}: {
  booking: Booking;
  item: BookingItem;
  incident?: BookingIncident | null;
  canReschedule: boolean;
  onReschedule: () => void;
  onRequestReturnItem?: () => void;
  timeSlotFallback?: string | null;
}) {
  const request = item.rescheduleRequest;
  const isRental = isProductItem(item);
  const canReturnThisItem =
    isRental && item.rentalFulfillment?.status === 'PICKED_UP';
  return (
    <View>
      <ItemDetail
        booking={booking}
        item={item}
        incident={incident}
        timeSlotFallback={timeSlotFallback}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {request && ['PENDING', 'PROCESSING'].includes(request.status) ? (
          <Text style={actionStyles.pending}>⏳ Yêu cầu đổi lịch đang chờ tiệm xác nhận</Text>
        ) : canReschedule ? (
          <Pressable onPress={onReschedule} style={actionStyles.button}>
            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
            <Text style={actionStyles.buttonText}>Yêu cầu đổi ngày hẹn</Text>
          </Pressable>
        ) : null}
        {canReturnThisItem && onRequestReturnItem ? (
          <Pressable onPress={onRequestReturnItem} style={actionStyles.button}>
            <Ionicons name="return-down-back-outline" size={13} color={Colors.primary} />
            <Text style={actionStyles.buttonText}>Yêu cầu trả áo này</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function Route() {
  return (
    <RequireAuth>
      <BookingDetail />
    </RequireAuth>
  );
}

function BookingDetail() {
  const { id, openContract } = useLocalSearchParams<{
    id: string;
    openContract?: string;
  }>();
  const { item: booking, loading, refreshing, error, reload, pullRefresh } = useBookingDetail(id);
  const { show } = useToast();
  const { bookingSyncVersion, bumpBookingSync, pushLocalBanner } = useNotifications();
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [autoHandledContract, setAutoHandledContract] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (
      openContract === '1' &&
      !autoHandledContract &&
      booking &&
      booking.status === 'PENDING_PAYMENT' &&
      booking.contractFlowVersion === 2
    ) {
      setAutoHandledContract(true);
      setContractModalOpen(true);
    }
  }, [openContract, autoHandledContract, booking]);
  const [reason, setReason] = useState('');
  const [rescheduleItem, setRescheduleItem] = useState<BookingItem | null>(null);
  const [locationSchedule, setLocationSchedule] = useState<BookingSchedule | null>(null);
  const [planBModalOpen, setPlanBModalOpen] = useState(false);
  const [weatherCancelModalOpen, setWeatherCancelModalOpen] = useState(false);
  const [incidentInfo, setIncidentInfo] = useState<BookingIncident | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnItem, setReturnItem] = useState<BookingItem | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
  const [returnUploading, setReturnUploading] = useState(false);
  const [chatOpeningKey, setChatOpeningKey] = useState<string | null>(null);

  if (loading) return <LoadingState label="Đang tải chi tiết vé đặt lịch..." />;
  if (error || !booking)
    return <ErrorState message={error ?? 'Không tìm thấy đơn đặt lịch'} onRetry={reload} />;

  const displayState = resolveBookingDisplayState(booking, 'customer', incidentInfo);
  const status = bookingStatus[booking.status] ?? {
    label: displayState.label,
    tone: displayState.tone,
  };
  const photoItems = booking.items.filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE');
  const rentalItems = booking.items.filter((item) => isProductItem(item));
  const pickedUpItems = getReturnEligibleRentalItems(booking);
  const providers = [
    ...new Map(
      booking.items
        .map((item) => itemProvider(item))
        .filter(Boolean)
        .map((provider) => [provider!._id, provider!])
    ).values(),
  ];

  const continuePayment = async () => {
    setActionLoading(true);
    try {
      if (booking.contractFlowVersion === 2 || rentalItems.length > 0) {
        const readiness = await contractApi
          .getBookingReadiness(booking._id)
          .catch(() => null);
        if (readiness && readiness.requirement === 'REQUIRED' && !readiness.ready) {
          setContractModalOpen(true);
          return;
        }
      }

      const pending = (await checkoutApi.pending()).find(
        (item) => item.bookingId === booking._id
      );
      if (pending) {
        router.push({
          pathname: '/payment/result',
          params: { code: pending.paymentCode },
        } as unknown as Href);
        return;
      }

      const purpose =
        booking.bookingType === 'PHOTOGRAPHY' || booking.bookingType === 'COMBO'
          ? 'DEPOSIT_PAYMENT'
          : 'FULL_PAYMENT';
      const payment = await checkoutApi.createPaymentLink(booking._id, purpose);
      if (!payment.paymentCode) {
        throw new Error('Không tìm thấy giao dịch thanh toán đang chờ.');
      }
      const checkoutUrl = payment.payos?.checkoutUrl ?? null;
      if (checkoutUrl) {
        if (Platform.OS === 'web') {
          await Linking.openURL(checkoutUrl);
          router.push({
            pathname: '/payment/result',
            params: { code: payment.paymentCode },
          } as unknown as Href);
        } else {
          router.push({
            pathname: '/payment/webview',
            params: { code: payment.paymentCode, url: checkoutUrl },
          } as unknown as Href);
        }
        return;
      }

      router.push({
        pathname: '/payment/result',
        params: { code: payment.paymentCode },
      } as unknown as Href);
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể mở giao dịch đang chờ'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPickup = async () => {
    setActionLoading(true);
    try {
      await bookingApi.confirmPickup(booking._id);
      bumpBookingSync(booking._id);
      pushLocalBanner({
        title: 'Đã xác nhận nhận cổ phục',
        content: `Đơn #${booking.bookingCode} đã chuyển sang trạng thái Đang thuê cổ phục.`,
        type: 'HANDOVER_CONFIRMED',
        metadata: { bookingId: booking._id, status: 'PICKED_UP', stage: 'IN_RENTAL', targetRole: 'customer' },
      });
      show('Đã xác nhận nhận cổ phục thành công', 'success');
      await reload();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể xác nhận nhận áo'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmComplete = async () => {
    setActionLoading(true);
    try {
      await bookingApi.confirmComplete(booking._id);
      bumpBookingSync(booking._id);
      pushLocalBanner({
        title: 'Đơn hàng hoàn tất',
        content: `Bạn đã xác nhận hài lòng cho đơn #${booking.bookingCode}.`,
        type: 'BOOKING_COMPLETED',
        metadata: { bookingId: booking._id, status: 'COMPLETED', targetRole: 'customer' },
      });
      show('Đã xác nhận hài lòng và hoàn tất dịch vụ', 'success');
      await reload();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể xác nhận hoàn tất'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openReturnModal = (targetItem?: BookingItem) => {
    const defaultItem =
      targetItem ??
      pickedUpItems.find((it) => it.rentalFulfillment?.status === 'PICKED_UP') ??
      pickedUpItems[0] ??
      null;
    setReturnItem(defaultItem);
    setReturnNote('');
    setReturnPhotos([]);
    setReturnModalOpen(true);
  };

  const pickReturnPhotos = async (fromCamera = false) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show(
        fromCamera
          ? 'Cần cấp quyền camera để chụp ảnh áo dài lúc trả'
          : 'Cần cấp quyền thư viện ảnh để tải ảnh trả đồ',
        'error',
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: 5,
          quality: 0.8,
        });
    if (result.canceled || !result.assets?.length) return;

    setReturnUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const asset of result.assets) {
        const body = new FormData();
        body.append(
          'file',
          asset.file ??
            ({
              uri: asset.uri,
              name: asset.fileName ?? `return-${Date.now()}.jpg`,
              type: asset.mimeType ?? 'image/jpeg',
            } as unknown as Blob),
        );
        const uploaded = await bookingApi.uploadEvidence(body);
        if (uploaded?.url) uploadedUrls.push(uploaded.url);
      }
      setReturnPhotos((prev) => [...prev, ...uploadedUrls].slice(0, 5));
      show('Đã tải ảnh hiện trạng trả đồ', 'success');
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể tải ảnh trả đồ'), 'error');
    } finally {
      setReturnUploading(false);
    }
  };

  const submitCustomerReturn = async () => {
    if (returnPhotos.length === 0) {
      show('Vui lòng tải ít nhất 1 ảnh tình trạng áo dài trước khi trả', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await bookingApi.customerReturn(booking._id, {
        evidencePhotos: returnPhotos,
        note: returnNote.trim() || undefined,
        bookingItemId: returnItem?._id,
      });
      setReturnModalOpen(false);
      setReturnPhotos([]);
      setReturnNote('');
      bumpBookingSync(booking._id);
      pushLocalBanner({
        title: 'Đã gửi yêu cầu trả cổ phục',
        content: `Đơn #${booking.bookingCode} đã chuyển sang Chờ tiệm xác nhận nhận lại đồ.`,
        type: 'RETURN',
        metadata: {
          bookingId: booking._id,
          bookingCode: booking.bookingCode,
          status: 'RETURN_PENDING',
          stage: 'CUSTOMER_RETURN_REQUESTED',
          targetRole: 'customer',
        },
      });
      show('Đã gửi yêu cầu trả cổ phục cho cửa hàng!', 'success');
      await reload();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể gửi yêu cầu trả cổ phục'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const cancel = async () => {
    if (!reason.trim()) {
      show('Vui lòng nhập lý do hủy lịch', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const result = await bookingApi.cancel(booking._id, reason.trim());
      setCancelOpen(false);
      setReason('');
      const refund = result.refundAmount ?? result.booking?.cancellation?.refundAmount ?? 0;
      const message = result.isFreeCancel
        ? 'Đã hủy miễn phí' + (refund ? ' · Hoàn ' + money(refund) : '')
        : refund
          ? 'Đã hủy · Dự kiến hoàn ' + money(refund)
          : result.penaltyReason
            ? 'Đã hủy · ' + result.penaltyReason
            : 'Đã hủy đơn hàng';
      show(message, 'success');
      await reload();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể hủy đơn'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const canCancel = ['DRAFT', 'PENDING_PAYMENT', 'DEPOSIT_PAID', 'CONFIRMED'].includes(
    booking.status
  );
  const canReschedule = ['DEPOSIT_PAID', 'CONFIRMED'].includes(booking.status);
  const photoshootSchedule =
    booking.schedules?.find(
      (item) =>
        item.scheduleType === 'PHOTOSHOOT' &&
        item.status !== 'CANCELLED' &&
        item.status !== 'EXPIRED',
    ) ?? booking.schedules?.find((item) => item.scheduleType === 'PHOTOSHOOT');
  const assignedStaff = photoshootSchedule?.assignedStaffSnapshot;

  const openDirectChat = async (
    targetUserId: string | null | undefined,
    title: string,
    key: string,
  ) => {
    if (!targetUserId) {
      show('Tài khoản nhận tin nhắn hiện chưa được kích hoạt', 'info');
      return;
    }
    setChatOpeningKey(key);
    try {
      const room = await chatApi.createRoom(targetUserId);
      if (room?.id) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: room.id, name: title },
        } as unknown as Href);
        return;
      }
      router.push('/chat' as Href);
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể mở cuộc trò chuyện'), 'error');
    } finally {
      setChatOpeningKey(null);
    }
  };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(
    booking.bookingCode
  )}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.round} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerLabel}>VÉ ĐẶT LỊCH TÀGO</Text>
          <Text style={styles.headerCode}>#{booking.bookingCode}</Text>
        </View>
        <Pressable style={styles.round} onPress={() => setQrModalOpen(true)}>
          <Ionicons name="qr-code-outline" size={19} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void pullRefresh()}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Hero Card */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroType}>
              {booking.bookingType === 'AODAI_RENTAL'
                ? 'THUÊ CỔ PHỤC'
                : booking.bookingType === 'PHOTOGRAPHY'
                  ? 'NHIẾP ẢNH DI SẢN'
                  : 'COMBO TRỌN GÓI'}
            </Text>
            <StatusBadge label={displayState.label} tone={displayState.tone} />
          </View>
          <Text style={styles.heroTitle}>{bookingTitle(booking)}</Text>
          <Text style={styles.heroDate}>
            {formatDate(booking.items[0]?.shootDate ?? photoshootSchedule?.scheduledDate ?? booking.items[0]?.rentalFrom)}{' '}
            {booking.items[0]?.shootTimeSlot || photoshootSchedule?.timeSlot ? `· ${booking.items[0]?.shootTimeSlot || photoshootSchedule?.timeSlot}` : ''}
          </Text>
          <View style={styles.heroStats}>
            <HeroStat label="DỊCH VỤ" value={`${booking.items.length} mục`} />
            <HeroStat label="ĐÃ THANH TOÁN" value={money(booking.paymentSummary?.totalPaid)} />
            <HeroStat label="TỔNG ĐƠN" value={money(booking.pricingSummary?.grandTotal)} />
          </View>
        </View>

        {/* Electronic QR Pass Card */}
        <Pressable style={styles.qrTicketCard} onPress={() => setQrModalOpen(true)}>
          <View style={styles.qrThumbWrap}>
            <Image source={qrUrl} style={styles.qrThumb} contentFit="contain" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.qrPassBadge}>
              <Ionicons name="qr-code" size={12} color={Colors.primary} />
              <Text style={styles.qrPassBadgeText}>VÉ ĐIỆN TỬ CHECK-IN TẠI TIỆM</Text>
            </View>
            <Text style={styles.qrPassTitle}>Mã vé: #{booking.bookingCode}</Text>
            <Text style={styles.qrPassSub}>
              Đưa mã QR này cho chủ tiệm quét khi nhận đồ, trả đồ hoặc bắt đầu ca chụp.
            </Text>
          </View>
          <View style={styles.qrZoomBtn}>
            <Ionicons name="expand-outline" size={18} color={Colors.primary} />
          </View>
        </Pressable>

        <BookingFlowStepper
          bookingType={booking.bookingType}
          status={booking.status}
          booking={{ ...booking, activeIncident: incidentInfo ?? booking.activeIncident }}
          variant="customer"
        />

        <ActionNotice booking={booking} incident={incidentInfo} />

        {photoItems.length > 0 && (
          <HeritageWeatherCard
            bookingId={booking._id}
            shootDate={
              photoItems[0].shootDate
                ? new Date(photoItems[0].shootDate).toISOString().split('T')[0]
                : photoshootSchedule?.scheduledDate
                  ? new Date(photoshootSchedule.scheduledDate).toISOString().split('T')[0]
                  : ''
            }
            timeSlot={photoItems[0].shootTimeSlot || photoshootSchedule?.timeSlot || '09:00 - 11:00'}
            spotId={(photoItems[0] as any).spotId}
            spotName={photoItems[0].shootLocation || photoshootSchedule?.locationAddress || 'Di tích Huế'}
            weatherRescheduleCount={(booking as any).weatherRescheduleCount || 0}
            hasPendingWeatherAction={(booking as any).hasPendingWeatherAction || false}
            onOpenPlanB={() => setPlanBModalOpen(true)}
            onOpenCancellation={() => setWeatherCancelModalOpen(true)}
          />
        )}

        <Section
          title={booking.bookingType === 'COMBO' ? 'Chi tiết gói Combo' : 'Thông tin dịch vụ'}>
          {booking.items.map((item) => (
            <ItemDetailWithActions
              key={item._id}
              booking={booking}
              item={item}
              incident={incidentInfo}
              canReschedule={canReschedule}
              onReschedule={() => setRescheduleItem(item)}
              onRequestReturnItem={() => openReturnModal(item)}
              timeSlotFallback={photoshootSchedule?.timeSlot}
            />
          ))}
        </Section>

        {providers.map((provider) => (
          <View key={provider._id} style={styles.provider}>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
              onPress={() => router.push(`/store/${provider._id}` as Href)}>
              <View style={styles.providerAvatar}>
                <Text style={styles.providerInitial}>
                  {provider.businessName?.charAt(0) ?? 'T'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>TIỆM / STUDIO PHỤ TRÁCH</Text>
                <Text style={styles.providerName}>{provider.businessName ?? 'TàGo Partner'}</Text>
                <Text style={styles.providerSub}>
                  ★ {(provider.rating?.averageRating ?? 5.0).toFixed(1)} · Xem gian hàng ›
                </Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => router.push(`/store/${provider._id}` as Href)}
                style={styles.contact}>
                <Ionicons name="storefront-outline" size={17} color={Colors.primary} />
              </Pressable>
              {!!provider.userId && (
                <Pressable
                  disabled={chatOpeningKey === `provider-${provider._id}`}
                  onPress={() =>
                    void openDirectChat(
                      provider.userId,
                      provider.businessName ?? 'Studio',
                      `provider-${provider._id}`,
                    )
                  }
                  style={styles.contact}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.primary} />
                </Pressable>
              )}
              {!!provider.contact?.phone && (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${provider.contact?.phone}`)}
                  style={styles.contact}>
                  <Ionicons name="call-outline" size={17} color={Colors.primary} />
                </Pressable>
              )}
            </View>
          </View>
        ))}

        {photoItems.length > 0 && (
          <View style={styles.staffAssignedCard}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.smallLabel}>NHIẾP ẢNH GIA PHỤ TRÁCH</Text>
              {assignedStaff ? (
                <>
                  <Text style={styles.providerName}>{assignedStaff.name}</Text>
                  <Text style={styles.staffAssignedSub}>
                    {assignedStaff.specialty || 'Nhiếp ảnh gia chuyên trách Studio'}
                  </Text>
                  {photoshootSchedule?.shootFinishedAt ? (
                    <Text style={styles.staffProgressBadge}>
                      ✓ Đã hoàn tất buổi chụp lúc{' '}
                      {formatDateTime(photoshootSchedule.shootFinishedAt)}
                    </Text>
                  ) : photoshootSchedule?.checkedInAt ? (
                    <Text style={styles.staffProgressBadge}>
                      ✓ Thợ đã check-in lúc{' '}
                      {formatDateTime(photoshootSchedule.checkedInAt)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.staffPendingText}>
                  Studio đang điều phối thợ chụp phụ trách cho lịch hẹn của bạn.
                </Text>
              )}
            </View>

            {assignedStaff && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {!!assignedStaff.phone && (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `tel:${assignedStaff.phone!.replace(/[^0-9+]/g, '')}`,
                      )
                    }
                    style={styles.contact}
                  >
                    <Ionicons name="call-outline" size={17} color={Colors.primary} />
                  </Pressable>
                )}
                <Pressable
                  disabled={chatOpeningKey === 'assigned-staff'}
                  onPress={() =>
                    void openDirectChat(
                      assignedStaff.linkedUserId || assignedStaff.staffId,
                      assignedStaff.name,
                      'assigned-staff',
                    )
                  }
                  style={styles.chatStaffBtn}
                >
                  <Ionicons name="chatbubble-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.chatStaffText}>Chat với thợ</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <Section
          title={
            photoItems.length
              ? 'Bản đồ chỉ đường đến chỗ chụp & điểm hẹn'
              : 'Bản đồ chỉ đường đến điểm nhận & trả cổ phục'
          }>
          <BookingRouteMapCard
            booking={booking}
            canChangeLocation={Boolean(
              photoItems.length > 0 &&
                canReschedule &&
                photoshootSchedule &&
                !['PENDING', 'PROCESSING'].includes(
                  photoshootSchedule.locationChangeRequest?.status ?? '',
                ),
            )}
            onPressChangeLocation={() => {
              if (photoshootSchedule) setLocationSchedule(photoshootSchedule);
            }}
          />
        </Section>

        <Section title={rentalItems.length ? 'Tiến trình dịch vụ' : 'Tiến trình lịch hẹn'}>
          <Timeline booking={booking} />
        </Section>

        {rentalItems.length > 0 && (() => {
          const evidenceTimes = getRentalLifecycleTimestamps(booking);
          const legacyHandover = Array.isArray(booking.handoverPhotos)
            ? booking.handoverPhotos.filter(Boolean)
            : [];
          const itemPickupEntries = rentalItems.flatMap((it) =>
            (it.rentalFulfillment?.pickupEvidence?.files ?? []).map((fileId) => ({
              itemId: it._id,
              fileId,
            })),
          );
          const itemReturnEntries = rentalItems.flatMap((it) =>
            (it.rentalFulfillment?.customerReturnEvidence?.files ?? []).map((fileId) => ({
              itemId: it._id,
              fileId,
            })),
          );
          const hasAnyPickupPhotos =
            itemPickupEntries.length > 0 || legacyHandover.length > 0;
          return (
            <Section title="Bằng chứng bàn giao & hoàn trả">
              <View style={styles.evidence}>
                <Evidence
                  label="Chuẩn bị đồ"
                  done={Boolean(evidenceTimes.readyAt)}
                  timestamp={evidenceTimes.readyAt}
                />
                <Evidence
                  label="Bàn giao áo"
                  done={Boolean(evidenceTimes.pickedUpAt)}
                  timestamp={evidenceTimes.pickedUpAt}
                />
                <Evidence
                  label="Gửi trả đồ"
                  done={Boolean(evidenceTimes.customerReturnRequestedAt || evidenceTimes.returnedAt)}
                  timestamp={evidenceTimes.customerReturnRequestedAt || evidenceTimes.returnedAt}
                />
                <Evidence
                  label="Tiệm nhận lại"
                  done={Boolean(evidenceTimes.returnedAt)}
                  timestamp={evidenceTimes.returnedAt}
                />
              </View>

              {hasAnyPickupPhotos && (
                <View style={styles.handoverWrap}>
                  <Text style={styles.handoverLabel}>
                    Ảnh hiện trạng bàn giao từ cửa hàng (
                    {itemPickupEntries.length || legacyHandover.length} ảnh)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.photos}
                  >
                    {itemPickupEntries.length > 0
                      ? itemPickupEntries.map((entry, idx) => (
                          <Pressable
                            key={`${entry.fileId}-${idx}`}
                            onPress={() =>
                              setPreviewPhotoUrl(
                                buildEvidenceImageUri(
                                  booking._id,
                                  entry.fileId,
                                  entry.itemId,
                                ),
                              )
                            }
                          >
                            <AuthorizedEvidenceImage
                              bookingId={booking._id}
                              itemId={entry.itemId}
                              fileOrUrl={entry.fileId}
                              style={styles.handoverThumb}
                            />
                          </Pressable>
                        ))
                      : legacyHandover.map((rawUrl, idx) => {
                          const uri = getMediaUrl(rawUrl) || rawUrl;
                          return (
                            <Pressable
                              key={`${rawUrl}-${idx}`}
                              onPress={() => setPreviewPhotoUrl(uri)}
                            >
                              <Image
                                source={{ uri }}
                                style={styles.handoverThumb}
                                contentFit="cover"
                              />
                            </Pressable>
                          );
                        })}
                  </ScrollView>
                </View>
              )}

              {itemReturnEntries.length > 0 && (
                <View style={styles.handoverWrap}>
                  <Text style={styles.handoverLabel}>
                    Ảnh tình trạng lúc khách trả đồ ({itemReturnEntries.length} ảnh)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.photos}
                  >
                    {itemReturnEntries.map((entry, idx) => (
                      <Pressable
                        key={`${entry.fileId}-${idx}`}
                        onPress={() =>
                          setPreviewPhotoUrl(
                            buildEvidenceImageUri(booking._id, entry.fileId, entry.itemId),
                          )
                        }
                      >
                        <AuthorizedEvidenceImage
                          bookingId={booking._id}
                          itemId={entry.itemId}
                          fileOrUrl={entry.fileId}
                          style={styles.handoverThumb}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </Section>
          );
        })()}

        {(booking.contractFlowVersion === 2 || rentalItems.length > 0) && (
          <BookingContractsSection
            bookingId={booking._id}
            bookingStatus={booking.status}
            contractFlowVersion={booking.contractFlowVersion}
            viewerRole="customer"
            onOpenSign={() => setContractModalOpen(true)}
            refreshTrigger={bookingSyncVersion}
          />
        )}

        {rentalItems.length > 0 && (
          <CustomerIssuePanel
            booking={booking}
            onIncidentChange={setIncidentInfo}
            onSuccess={async () => {
              bumpBookingSync(booking._id);
              await reload();
            }}
          />
        )}

        <Section title="Chi tiết thanh toán & Tiền cọc">
          <Price label="Chi phí dịch vụ" value={booking.pricingSummary?.subTotal} />
          {Boolean(booking.pricingSummary?.overtimeFee) && (
            <Price
              label="Phí tăng giờ chụp"
              value={booking.pricingSummary?.overtimeFee}
              accent
            />
          )}
          <Price label="Ưu đãi giảm giá" value={-(booking.pricingSummary?.discountAmount ?? 0)} />
          <Price
            label="Tiền cọc giữ đồ (Hoàn 100%)"
            value={booking.pricingSummary?.depositTotal}
            accent
          />
          <Price label="Đã thanh toán" value={booking.paymentSummary?.totalPaid} success />
          {Boolean(booking.paymentSummary?.totalRefunded) && (
            <Price label="Đã hoàn tiền" value={booking.paymentSummary?.totalRefunded} success />
          )}
          <View style={styles.line} />
          <Price label="Tổng thanh toán" value={booking.pricingSummary?.grandTotal} strong />
          {booking.rentalDepositRefund ? (
            <View style={styles.refund}>
              <Text style={styles.refundTitle}>
                Tiền cọc hoàn lại dự kiến: {money(booking.rentalDepositRefund.amount)}
              </Text>
              <Text style={styles.refundText}>
                Trạng thái Escrow: {formatDepositSettlementLabel(booking.rentalDepositRefund.status)}
              </Text>
            </View>
          ) : booking.depositSettlementStatus ? (
            <View style={styles.refund}>
              <Text style={styles.refundTitle}>Đối soát tiền cọc Escrow</Text>
              <Text style={styles.refundText}>
                Trạng thái: {formatDepositSettlementLabel(booking.depositSettlementStatus)}
              </Text>
            </View>
          ) : null}
          {Boolean(booking.cancellation?.refundAmount) && (
            <View style={styles.refund}>
              <Text style={styles.refundTitle}>
                Hoàn tiền khi hủy: {money(booking.cancellation?.refundAmount ?? 0)}
              </Text>
            </View>
          )}
        </Section>

        {(booking.paymentSummary?.totalPaid ?? 0) > 0 &&
          !['RETURNED', 'COMPLETED', 'CANCELLED', 'DISPUTED'].includes(booking.status) && (
            <CustomerRefundPanel bookingId={booking._id} />
          )}

        {!!booking.deliveredPhotos?.length && (
          <Section title="Album ảnh đã bàn giao">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photos}>
              {booking.deliveredPhotos.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={getMediaUrl(uri)}
                  style={styles.delivered}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
            {!!booking.deliveryDriveUrl && (
              <AppButton
                title="Mở Google Drive tải ảnh gốc"
                variant="secondary"
                onPress={() => void Linking.openURL(booking.deliveryDriveUrl!)}
              />
            )}
          </Section>
        )}

        <Section title="Chính sách & Bảo vệ TàGo Care">
          <Policy label="Hỗ trợ đổi lịch miễn phí trước 24 giờ" />
          <Policy label="Bảo vệ tiền cọc 100% qua TàGo Escrow" />
          <Policy label="Hỗ trợ đổi lịch khi thời tiết xấu tại Huế" />
          {!!booking.cancellation?.reason && (
            <View style={styles.cancelInfo}>
              <Text style={styles.cancelTitle}>Lý do hủy đơn</Text>
              <Text style={styles.cancelText}>{booking.cancellation.reason}</Text>
            </View>
          )}
        </Section>

        {canCancel && (
          <AppButton
            title="Yêu cầu hủy lịch hẹn"
            variant="ghost"
            onPress={() => setCancelOpen(true)}
          />
        )}
        <Text style={styles.help}>
          Cần hỗ trợ khẩn cấp? Cung cấp mã vé #{booking.bookingCode} cho đội ngũ TàGo Care.
        </Text>
      </ScrollView>

      <View style={styles.bottom}>
        {booking.status === 'PENDING_PAYMENT' && (
          <AppButton
            title={
              booking.contractFlowVersion === 2
                ? 'Ký hợp đồng & Thanh toán ngay'
                : 'Tiếp tục thanh toán ngay'
            }
            loading={actionLoading}
            onPress={() => void continuePayment()}
          />
        )}
        {booking.status === 'PICKUP_PENDING' &&
          displayState.stage === 'HANDOVER_AWAITING_CUSTOMER' && (
            <AppButton
              title="Xác nhận đã nhận cổ phục"
              loading={actionLoading}
              onPress={() => void confirmPickup()}
            />
          )}
        {booking.status === 'PICKUP_PENDING' &&
          displayState.stage === 'READY_NEEDS_HANDOVER_PHOTOS' && (
            <AppButton
              title="Hiển thị Mã QR (Chờ tiệm tải ảnh bàn giao)"
              onPress={() => setQrModalOpen(true)}
            />
          )}
        {booking.status === 'AWAITING_REVIEW' && (
          <AppButton
            title="Xác nhận hài lòng & Hoàn tất"
            loading={actionLoading}
            onPress={() => void confirmComplete()}
          />
        )}
        {pickedUpItems.length > 0 &&
          ['IN_RENTAL', 'COMBO_PHOTOS_APPROVED'].includes(displayState.stage) && (
            <View style={styles.bottomSplit}>
              <View style={{ flex: 1 }}>
                <AppButton
                  title="Yêu cầu trả cổ phục"
                  loading={actionLoading}
                  onPress={() => openReturnModal()}
                />
              </View>
              <Pressable style={styles.bottomQrBtn} onPress={() => setQrModalOpen(true)}>
                <Ionicons name="qr-code-outline" size={20} color={Colors.primary} />
              </Pressable>
            </View>
          )}
        {!(
          booking.status === 'PENDING_PAYMENT' ||
          booking.status === 'PICKUP_PENDING' ||
          booking.status === 'AWAITING_REVIEW' ||
          (pickedUpItems.length > 0 &&
            ['IN_RENTAL', 'COMBO_PHOTOS_APPROVED'].includes(displayState.stage))
        ) && (
          <AppButton
            title="Hiển thị Mã QR Vé Điện Tử"
            onPress={() => setQrModalOpen(true)}
          />
        )}
      </View>

      {/* Fullscreen QR Ticket Modal */}
      <Modal
        visible={qrModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalOpen(false)}>
        <View style={styles.qrModalBackdrop}>
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalEyebrow}>TÀGO ELECTRONIC PASS</Text>
              <Text style={styles.qrModalTitle}>Vé Điện Tử Check-in</Text>
            </View>
            <View style={styles.qrLargeBox}>
              <Image source={qrUrl} style={styles.qrLargeImage} contentFit="contain" />
            </View>
            <View style={styles.qrCodePill}>
              <Text style={styles.qrCodePillText}>#{booking.bookingCode}</Text>
            </View>
            <Text style={styles.qrModalSub}>
              Đưa mã này cho nhân viên Tiệm hoặc Nhiếp ảnh gia quét trên ứng dụng TàGo Partner Pro để xác nhận bàn giao hoặc trả đồ.
            </Text>
            <AppButton title="Đóng mã QR" onPress={() => setQrModalOpen(false)} />
          </View>
        </View>
      </Modal>

      <AppModal
        visible={cancelOpen}
        title="Xác nhận hủy lịch hẹn"
        onClose={() => setCancelOpen(false)}>
        <Text style={styles.modalCopy}>
          Hủy trước hơn 24 giờ được hoàn 100% tiền cọc; hủy sát giờ có thể phát sinh phí giữ lịch theo chính sách của tiệm.
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="Nhập lý do hủy lịch của bạn..."
          placeholderTextColor="#8F8E8E"
          style={styles.reason}
        />
        <View style={styles.modalActions}>
          <AppButton title="Giữ lại lịch" variant="secondary" onPress={() => setCancelOpen(false)} />
          <AppButton
            title="Xác nhận hủy đơn"
            variant="danger"
            loading={actionLoading}
            onPress={() => void cancel()}
          />
        </View>
      </AppModal>

      <RescheduleModal
        visible={Boolean(rescheduleItem)}
        booking={booking}
        item={rescheduleItem}
        onClose={() => setRescheduleItem(null)}
        onSuccess={reload}
      />
      <LocationChangeModal
        visible={Boolean(locationSchedule)}
        bookingId={booking._id}
        schedule={locationSchedule}
        onClose={() => setLocationSchedule(null)}
        onSuccess={reload}
      />

      {photoItems.length > 0 && (
        <>
          <PlanBSelectionModal
            visible={planBModalOpen}
            onClose={() => setPlanBModalOpen(false)}
            bookingId={booking._id}
            originalSpotName={photoItems[0].shootLocation || photoshootSchedule?.locationAddress || 'Di tích Huế'}
            originalTravelFee={(photoItems[0] as any).travelFee || 0}
            originalDate={
              photoItems[0].shootDate
                ? new Date(photoItems[0].shootDate).toISOString().split('T')[0]
                : photoshootSchedule?.scheduledDate
                  ? new Date(photoshootSchedule.scheduledDate).toISOString().split('T')[0]
                  : ''
            }
            originalTimeSlot={photoItems[0].shootTimeSlot || photoshootSchedule?.timeSlot || '09:00 - 11:00'}
            weatherRescheduleCount={(booking as any).weatherRescheduleCount || 0}
            onSuccess={() => {
              bumpBookingSync();
              void reload();
            }}
          />

          <WeatherCancellationModal
            visible={weatherCancelModalOpen}
            onClose={() => setWeatherCancelModalOpen(false)}
            bookingId={booking._id}
            bookingCode={booking.bookingCode}
            weatherRescheduleCount={(booking as any).weatherRescheduleCount || 0}
            onSuccess={() => {
              bumpBookingSync();
              void reload();
            }}
          />
        </>
      )}

      <ContractReviewModal
        visible={contractModalOpen}
        bookingId={booking._id}
        holdExpiresAt={booking.holdExpiresAt ?? null}
        onClose={() => setContractModalOpen(false)}
        onReadyToPay={() => {
          setContractModalOpen(false);
          bumpBookingSync();
          void reload();
          void continuePayment();
        }}
        onDeclinedOrCancelled={() => {
          setContractModalOpen(false);
          bumpBookingSync();
          void reload();
        }}
      />

      <AppModal
        visible={returnModalOpen}
        title="Gửi yêu cầu trả cổ phục"
        onClose={() => setReturnModalOpen(false)}
      >
        <Text style={styles.modalCopy}>
          Chụp hoặc chọn 1–5 ảnh hiện trạng áo dài lúc trả để làm bằng chứng đối soát hoàn 100% tiền cọc Escrow.
        </Text>
        {pickedUpItems.length > 1 && (
          <View style={styles.returnItemList}>
            <Text style={styles.returnLabel}>Chọn áo dài trả:</Text>
            {pickedUpItems.map((it) => {
              const selected = returnItem?._id === it._id;
              return (
                <Pressable
                  key={it._id}
                  onPress={() => setReturnItem(it)}
                  style={[styles.returnItemPill, selected && styles.returnItemPillActive]}
                >
                  <Text
                    style={[
                      styles.returnItemPillText,
                      selected && { color: Colors.primary, fontFamily: FontFamily.bodyBold },
                    ]}
                    numberOfLines={1}
                  >
                    {itemName(it)} ({getItemSkuOrCode(it) ?? 'Áo dài'})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <TextInput
          value={returnNote}
          onChangeText={setReturnNote}
          multiline
          placeholder="Ghi chú tình trạng trang phục khi trả (tùy chọn)..."
          placeholderTextColor="#8F8E8E"
          style={styles.reason}
        />
        <View style={styles.returnPhotoActions}>
          <Pressable
            style={styles.returnUploadBtn}
            onPress={() => void pickReturnPhotos(true)}
            disabled={returnUploading}
          >
            <Ionicons name="camera-outline" size={16} color={Colors.primary} />
            <Text style={styles.returnUploadText}>Chụp ảnh</Text>
          </Pressable>
          <Pressable
            style={styles.returnUploadBtn}
            onPress={() => void pickReturnPhotos(false)}
            disabled={returnUploading}
          >
            <Ionicons name="images-outline" size={16} color={Colors.primary} />
            <Text style={styles.returnUploadText}>
              Thư viện ({returnPhotos.length}/5)
            </Text>
          </Pressable>
        </View>
        {!!returnPhotos.length && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photos}
          >
            {returnPhotos.map((uri, idx) => (
              <Image
                key={`${uri}-${idx}`}
                source={{ uri: getMediaUrl(uri) || uri }}
                style={styles.returnThumb}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        )}
        <View style={styles.modalActions}>
          <AppButton
            title="Hủy"
            variant="secondary"
            onPress={() => setReturnModalOpen(false)}
          />
          <AppButton
            title={returnUploading ? 'Đang tải ảnh...' : 'Xác nhận gửi yêu cầu trả'}
            loading={actionLoading || returnUploading}
            onPress={() => void submitCustomerReturn()}
          />
        </View>
      </AppModal>

      <Modal
        visible={Boolean(previewPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhotoUrl(null)}
      >
        <View style={styles.photoPreviewOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPreviewPhotoUrl(null)}
          />
          {previewPhotoUrl ? (
            <AuthorizedEvidenceImage
              bookingId={booking._id}
              fileOrUrl={previewPhotoUrl}
              style={styles.photoPreviewImg}
              contentFit="contain"
            />
          ) : null}
          <AppButton
            title="Đóng ảnh"
            fullWidth={false}
            onPress={() => setPreviewPhotoUrl(null)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
const INVENTORY_STATUS_VI: Record<string, string> = {
  RESERVED: 'Đã giữ cho đơn',
  RENTED_OUT: 'Đang cho thuê',
  RETURNED_PENDING_INSPECTION: 'Chờ kiểm tra',
  CLEANING: 'Đang giặt ủi',
  AVAILABLE: 'Sẵn sàng phục vụ',
  MAINTENANCE: 'Đang bảo trì',
  DAMAGED: 'Hư hỏng',
  LOST: 'Thất lạc',
};

function ItemDetail({
  booking,
  item,
  incident,
  timeSlotFallback,
}: {
  booking: Booking;
  item: BookingItem;
  incident?: BookingIncident | null;
  timeSlotFallback?: string | null;
}) {
  const photo = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const effectiveTimeSlot = item.shootTimeSlot || timeSlotFallback;
  const skuCode = !photo ? getItemSkuOrCode(item) : null;
  const itemStage = !photo
    ? resolveRentalItemStage(booking, item, incident)
    : null;
  const stageBadge =
    !photo && itemStage
      ? resolveBookingDisplayState(
          { ...booking, items: [item] },
          'customer',
          incident,
        )
      : null;
  const invLabel =
    !photo && item.rentalFulfillment?.inventoryStatus
      ? INVENTORY_STATUS_VI[item.rentalFulfillment.inventoryStatus] ||
        item.rentalFulfillment.inventoryStatus
      : null;

  return (
    <View style={styles.item}>
      <Image source={getMediaUrl(itemImage(item))} style={styles.itemImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <View style={styles.itemTopRow}>
          <Text style={styles.itemKind}>{photo ? 'GÓI CHỤP ẢNH' : 'THUÊ CỔ PHỤC'}</Text>
          {skuCode && <Text style={styles.itemSkuBadge}>{skuCode}</Text>}
        </View>
        <Text style={styles.itemName}>{itemName(item)}</Text>
        <Text style={styles.itemMeta}>
          {photo
            ? `${formatDate(item.shootDate)} · ${effectiveTimeSlot ?? 'Chưa có giờ'}`
            : `${formatDate(item.rentalFrom)} → ${formatDate(item.rentalTo)}`}
        </Text>
        <Text style={styles.itemMeta}>
          {photo
            ? item.shootConcept || item.shootLocation
            : `Size ${item.selectedSize ?? '—'} · ${item.selectedColor ?? '—'} · SL ${item.quantity}`}
        </Text>
        {stageBadge && (
          <View style={styles.itemStageRow}>
            <StatusBadge label={stageBadge.shortLabel} tone={stageBadge.tone} />
            {invLabel && <Text style={styles.itemInvText}>Kho: {invLabel}</Text>}
          </View>
        )}
        <Text style={styles.itemPrice}>
          {money(item.unitPrice * item.quantity + (photo ? 0 : (item.depositAmount ?? 0) * item.quantity))}
        </Text>
      </View>
    </View>
  );
}

function ActionNotice({
  booking,
  incident,
}: {
  booking: Booking;
  incident?: BookingIncident | null;
}) {
  const display = resolveBookingDisplayState(booking, 'customer', incident);
  let title = display.label;
  let copy = display.nextStepText;
  const tone =
    display.tone === 'neutral' ? 'info' : display.tone;

  if (display.stage === 'PENDING_PAYMENT') {
    title =
      booking.contractFlowVersion === 2
        ? 'Cần ký Hợp đồng điện tử & Thanh toán giữ lịch'
        : 'Cần hoàn tất thanh toán để giữ lịch';
    copy = booking.holdExpiresAt
      ? `Phiên giữ chỗ có hiệu lực đến ${formatDateTime(booking.holdExpiresAt)}.${
          booking.contractFlowVersion === 2
            ? ' Vui lòng xác nhận hợp đồng trước khi chuyển qua PayOS.'
            : ''
        }`
      : copy;
  } else if (display.stage === 'CANCELLED') {
    copy = booking.cancellation?.reason
      ? `Lý do: ${booking.cancellation.reason}`
      : 'Đơn hàng không còn hiệu lực.';
  }

  const value = { title, copy, tone };
  const color =
    value.tone === 'success'
      ? Colors.success
      : value.tone === 'warning'
        ? Colors.warning
        : value.tone === 'error'
          ? Colors.error
          : '#2563EB';
  return (
    <View
      style={[
        styles.notice,
        {
          backgroundColor:
            value.tone === 'success'
              ? '#EDF9F2'
              : value.tone === 'warning'
                ? '#FFFBEB'
                : value.tone === 'error'
                  ? '#FEF2F2'
                  : '#EFF6FF',
        },
      ]}>
      <Ionicons
        name={
          value.tone === 'success'
            ? 'checkmark-circle'
            : value.tone === 'error'
              ? 'alert-circle'
              : 'information-circle'
        }
        size={21}
        color={color}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.noticeTitle, { color }]}>{value.title}</Text>
        <Text style={styles.noticeCopy}>{value.copy}</Text>
      </View>
    </View>
  );
}
function Timeline({ booking }: { booking: Booking }) {
  const entries = booking.statusTimeline?.length
    ? booking.statusTimeline
    : [{ status: booking.status, changedAt: booking.updatedAt ?? booking.createdAt ?? '' }];
  return (
    <View>
      {entries.map((entry, index) => {
        const value = bookingStatus[entry.status];
        return (
          <View key={`${entry.status}-${index}`} style={styles.timeline}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineDot,
                  index === entries.length - 1 && styles.timelineCurrent,
                ]}
              />
              {index < entries.length - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineBody}>
              <Text style={styles.timelineTitle}>{value?.label ?? entry.status}</Text>
              <Text style={styles.timelineDate}>{formatDateTime(entry.changedAt)}</Text>
              {!!entry.note && <Text style={styles.timelineNote}>{entry.note}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}
function Evidence({
  label,
  done,
  timestamp,
}: {
  label: string;
  done: boolean;
  timestamp?: string | null;
}) {
  return (
    <View style={[styles.evidenceBox, done && styles.evidenceDone]}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'camera-outline'}
        size={22}
        color={done ? Colors.success : '#8F8E8E'}
      />
      <Text style={[styles.evidenceText, done && { color: Colors.success }]}>{label}</Text>
      <Text style={styles.evidenceState}>{done ? 'Đã xác nhận' : 'Chưa có'}</Text>
      {done && timestamp ? (
        <Text style={styles.evidenceTime} numberOfLines={2}>
          {formatDateTime(timestamp)}
        </Text>
      ) : null}
    </View>
  );
}
function Price({
  label,
  value,
  accent,
  success,
  strong,
}: {
  label: string;
  value?: number;
  accent?: boolean;
  success?: boolean;
  strong?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, strong && styles.strong]}>{label}</Text>
      <Text
        style={[
          styles.priceValue,
          accent && { color: Colors.primary },
          success && { color: Colors.success },
          strong && styles.totalPrice,
        ]}>
        {money(value)}
      </Text>
    </View>
  );
}
function Policy({ label }: { label: string }) {
  return (
    <View style={styles.policy}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
        <Text style={styles.policyText}>{label}</Text>
      </View>
      <Ionicons name="checkmark" size={16} color={Colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: '#8F8E8E',
    textAlign: 'center',
  },
  headerCode: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 2,
  },
  content: { padding: 16, paddingBottom: 110, gap: 13 },
  hero: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    ...Shadow,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroType: { fontFamily: FontFamily.bodyBold, fontSize: 9, letterSpacing: 1, color: '#FFE0E8' },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    lineHeight: 29,
    color: Colors.white,
    marginTop: 10,
  },
  heroDate: { fontFamily: FontFamily.bodyMedium, fontSize: 11.5, color: '#FFE0E8', marginTop: 6 },
  heroStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  heroStat: { flex: 1 },
  heroStatLabel: { fontFamily: FontFamily.bodyBold, fontSize: 8, color: '#FFD0DC' },
  heroStatValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.white,
    marginTop: 4,
  },
  qrTicketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFD9E2',
    ...Shadow,
  },
  qrThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrThumb: {
    width: 56,
    height: 56,
  },
  qrPassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qrPassBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: Colors.primary,
  },
  qrPassTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#1B1C1C',
  },
  qrPassSub: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#5F5E5E',
  },
  qrZoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  noticeTitle: { fontFamily: FontFamily.bodyBold, fontSize: 12 },
  noticeCopy: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 3,
  },
  section: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    marginBottom: 4,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F3',
  },
  itemImage: {
    width: 70,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
  },
  itemKind: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.primary },
  itemName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: '#1B1C1C',
    marginTop: 3,
  },
  itemMeta: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#5F5E5E',
    marginTop: 3,
  },
  itemPrice: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.primary,
    marginTop: 5,
  },
  provider: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadow,
  },
  providerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: Colors.primary,
  },
  smallLabel: { fontFamily: FontFamily.bodyBold, fontSize: 8.5, color: '#8F8E8E' },
  providerName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
    marginTop: 2,
  },
  providerSub: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: Colors.primary,
    marginTop: 2,
  },
  contact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  location: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  locationName: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#1B1C1C' },
  locationAddress: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 2,
  },
  timeline: { flexDirection: 'row', minHeight: 62 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    marginTop: 4,
  },
  timelineCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: '#FFD9E2',
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#EFECEB' },
  timelineBody: { flex: 1, paddingLeft: 8, paddingBottom: 12 },
  timelineTitle: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#1B1C1C' },
  timelineDate: { fontFamily: FontFamily.body, fontSize: 10, color: '#8F8E8E', marginTop: 2 },
  timelineNote: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#5F5E5E',
    marginTop: 3,
  },
  evidence: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  evidenceBox: {
    flex: 1,
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  evidenceDone: { backgroundColor: '#EDF9F2', borderColor: '#BCE5CF', borderStyle: 'solid' },
  evidenceText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#5F5E5E',
    textAlign: 'center',
  },
  evidenceState: { fontFamily: FontFamily.body, fontSize: 9.5, color: '#8F8E8E' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceLabel: { fontFamily: FontFamily.body, fontSize: 12, color: '#5F5E5E' },
  priceValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: '#1B1C1C' },
  strong: { fontFamily: FontFamily.bodyBold, color: '#1B1C1C' },
  totalPrice: { fontFamily: FontFamily.displayBold, fontSize: 20, color: Colors.primary },
  line: { height: 1, backgroundColor: '#EFECEB', marginVertical: 6 },
  refund: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    marginTop: 8,
  },
  refundTitle: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: '#B45309' },
  refundText: { fontFamily: FontFamily.body, fontSize: 10, color: '#5F5E5E', marginTop: 2 },
  photos: { gap: 8, paddingVertical: 8 },
  delivered: {
    width: 125,
    height: 115,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
  },
  policy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F3',
  },
  policyText: { fontFamily: FontFamily.bodyMedium, fontSize: 11.5, color: '#1B1C1C' },
  cancelInfo: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FDECEE',
    marginTop: 9,
  },
  cancelTitle: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.error },
  cancelText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 3,
  },
  help: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#8F8E8E',
    textAlign: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    ...Shadow,
  },
  modalCopy: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
    marginBottom: 12,
  },
  reason: {
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    padding: 12,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#1B1C1C',
    marginBottom: 12,
  },
  modalActions: { gap: 9 },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,28,28,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 14,
    ...Shadow,
  },
  qrModalHeader: {
    alignItems: 'center',
    gap: 2,
  },
  qrModalEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: Colors.primary,
  },
  qrModalTitle: {
    fontFamily: FontFamily.display,
    fontSize: 23,
    color: '#1B1C1C',
  },
  qrLargeBox: {
    width: 230,
    height: 230,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFD9E2',
    backgroundColor: '#FFFFFF',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLargeImage: {
    width: 200,
    height: 200,
  },
  qrCodePill: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  qrCodePillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
  qrModalSub: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#5F5E5E',
    textAlign: 'center',
  },
  handoverWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2EFED',
    gap: 6,
  },
  handoverLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: Colors.text,
  },
  handoverThumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
  },
  evidenceTime: {
    fontFamily: FontFamily.body,
    fontSize: 8.5,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  photoPreviewImg: {
    width: '100%',
    height: '72%',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemSkuBadge: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: Colors.primary,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  itemInvText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: '#5F5E5E',
  },
  bottomSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomQrBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnItemList: {
    marginBottom: 10,
    gap: 6,
  },
  returnLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1B1C1C',
  },
  returnItemPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  returnItemPillActive: {
    backgroundColor: '#FFF0F3',
    borderColor: Colors.primary,
  },
  returnItemPillText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  returnPhotoActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  returnUploadBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: '#FFF9FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  returnUploadText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.primary,
  },
  returnThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#FFF0F3',
  },
  staffAssignedCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadow,
  },
  staffAssignedSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5F5E5E',
  },
  staffProgressBadge: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#047857',
    marginTop: 2,
  },
  staffPendingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 2,
  },
  chatStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 11,
    height: 38,
    borderRadius: 19,
  },
  chatStaffText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
});
