import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookingApi } from '@/apis/bookingApi';
import { checkoutApi } from '@/apis/checkoutApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { CustomerIssuePanel } from '@/components/booking/CustomerIssuePanel';
import { CustomerRefundPanel } from '@/components/booking/CustomerRefundPanel';
import { BookingRouteMapCard } from '@/components/booking/BookingRouteMapCard';
import { LocationChangeModal } from '@/components/booking/LocationChangeModal';
import { RescheduleModal } from '@/components/booking/RescheduleModal';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import { useBookingDetail } from '@/hooks/useBookings';
import type { Booking, BookingItem, BookingSchedule } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  bookingStatus,
  bookingTitle,
  formatDate,
  formatDateTime,
  itemImage,
  itemName,
  itemProvider,
} from '@/utils/booking';
import { getMediaUrl } from '@/utils/media';

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
  item,
  canReschedule,
  onReschedule,
}: {
  item: BookingItem;
  canReschedule: boolean;
  onReschedule: () => void;
}) {
  const request = item.rescheduleRequest;
  return (
    <View>
      <ItemDetail item={item} />
      {request && ['PENDING', 'PROCESSING'].includes(request.status) ? (
        <Text style={actionStyles.pending}>⏳ Yêu cầu đổi lịch đang chờ tiệm xác nhận</Text>
      ) : canReschedule ? (
        <Pressable onPress={onReschedule} style={actionStyles.button}>
          <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
          <Text style={actionStyles.buttonText}>Yêu cầu đổi ngày hẹn</Text>
        </Pressable>
      ) : null}
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item: booking, loading, error, reload } = useBookingDetail(id);
  const { show } = useToast();
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rescheduleItem, setRescheduleItem] = useState<BookingItem | null>(null);
  const [locationSchedule, setLocationSchedule] = useState<BookingSchedule | null>(null);

  if (loading) return <LoadingState label="Đang tải chi tiết vé đặt lịch..." />;
  if (error || !booking)
    return <ErrorState message={error ?? 'Không tìm thấy đơn đặt lịch'} onRetry={reload} />;

  const status = bookingStatus[booking.status] ?? {
    label: booking.status,
    tone: 'neutral' as const,
  };
  const photoItems = booking.items.filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE');
  const rentalItems = booking.items.filter((item) => item.itemType === 'PRODUCT');
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
      const pending = (await checkoutApi.pending()).find(
        (item) => item.bookingId === booking._id
      );
      if (!pending) throw new Error('Không tìm thấy giao dịch thanh toán đang chờ.');
      router.push({
        pathname: '/payment/result',
        params: { code: pending.paymentCode },
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
      show('Đã xác nhận hài lòng và hoàn tất dịch vụ', 'success');
      await reload();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể xác nhận hoàn tất'), 'error');
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
  const photoshootSchedule = booking.schedules?.find((item) => item.scheduleType === 'PHOTOSHOOT');
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <StatusBadge label={status.label} tone={status.tone} />
          </View>
          <Text style={styles.heroTitle}>{bookingTitle(booking)}</Text>
          <Text style={styles.heroDate}>
            {formatDate(booking.items[0]?.shootDate ?? booking.items[0]?.rentalFrom)}{' '}
            {booking.items[0]?.shootTimeSlot ? `· ${booking.items[0].shootTimeSlot}` : ''}
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

        <ActionNotice booking={booking} />

        <Section
          title={booking.bookingType === 'COMBO' ? 'Chi tiết gói Combo' : 'Thông tin dịch vụ'}>
          {booking.items.map((item) => (
            <ItemDetailWithActions
              key={item._id}
              item={item}
              canReschedule={canReschedule}
              onReschedule={() => setRescheduleItem(item)}
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
              {provider.contact?.phone && (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${provider.contact?.phone}`)}
                  style={styles.contact}>
                  <Ionicons name="call-outline" size={17} color={Colors.primary} />
                </Pressable>
              )}
            </View>
          </View>
        ))}

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

        {rentalItems.length > 0 && (
          <Section title="Bằng chứng bàn giao & hoàn trả">
            <View style={styles.evidence}>
              <Evidence
                label="Chuẩn bị đồ"
                done={rentalItems.some((item) => Boolean(item.rentalFulfillment?.readyAt))}
              />
              <Evidence
                label="Bàn giao áo"
                done={rentalItems.some((item) => Boolean(item.rentalFulfillment?.pickedUpAt))}
              />
              <Evidence
                label="Hoàn trả đồ"
                done={rentalItems.some((item) => Boolean(item.rentalFulfillment?.returnedAt))}
              />
            </View>
          </Section>
        )}

        {rentalItems.length > 0 && <CustomerIssuePanel booking={booking} onSuccess={reload} />}

        <Section title="Chi tiết thanh toán & Tiền cọc">
          <Price label="Chi phí dịch vụ" value={booking.pricingSummary?.subTotal} />
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
          {booking.rentalDepositRefund && (
            <View style={styles.refund}>
              <Text style={styles.refundTitle}>
                Tiền cọc hoàn lại dự kiến: {money(booking.rentalDepositRefund.amount)}
              </Text>
              <Text style={styles.refundText}>
                Trạng thái: {booking.rentalDepositRefund.status}
              </Text>
            </View>
          )}
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
            {booking.deliveryDriveUrl && (
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
          {booking.cancellation?.reason && (
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
            title="Tiếp tục thanh toán ngay"
            loading={actionLoading}
            onPress={() => void continuePayment()}
          />
        )}
        {booking.status === 'PICKUP_PENDING' && (
          <AppButton
            title="Xác nhận đã nhận cổ phục"
            loading={actionLoading}
            onPress={() => void confirmPickup()}
          />
        )}
        {booking.status === 'AWAITING_REVIEW' && (
          <AppButton
            title="Xác nhận hài lòng & Hoàn tất"
            loading={actionLoading}
            onPress={() => void confirmComplete()}
          />
        )}
        {!['PENDING_PAYMENT', 'PICKUP_PENDING', 'AWAITING_REVIEW'].includes(booking.status) && (
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
function ItemDetail({ item }: { item: BookingItem }) {
  const photo = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  return (
    <View style={styles.item}>
      <Image source={getMediaUrl(itemImage(item))} style={styles.itemImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemKind}>{photo ? 'GÓI CHỤP ẢNH' : 'THUÊ CỔ PHỤC'}</Text>
        <Text style={styles.itemName}>{itemName(item)}</Text>
        <Text style={styles.itemMeta}>
          {photo
            ? `${formatDate(item.shootDate)} · ${item.shootTimeSlot ?? 'Chưa có giờ'}`
            : `${formatDate(item.rentalFrom)} → ${formatDate(item.rentalTo)}`}
        </Text>
        <Text style={styles.itemMeta}>
          {photo
            ? item.shootConcept || item.shootLocation
            : `Size ${item.selectedSize ?? '—'} · ${item.selectedColor ?? '—'} · SL ${item.quantity}`}
        </Text>
        <Text style={styles.itemPrice}>
          {money(item.unitPrice * item.quantity + (photo ? 0 : (item.depositAmount ?? 0) * item.quantity))}
        </Text>
      </View>
    </View>
  );
}
function ActionNotice({ booking }: { booking: Booking }) {
  const map: Partial<
    Record<string, { title: string; copy: string; tone: 'warning' | 'success' | 'info' }>
  > = {
    PENDING_PAYMENT: {
      title: 'Cần hoàn tất thanh toán để giữ lịch',
      copy: booking.holdExpiresAt
        ? `Phiên giữ chỗ có hiệu lực đến ${formatDateTime(booking.holdExpiresAt)}.`
        : 'Giao dịch đang chờ thanh toán.',
      tone: 'warning',
    },
    PICKUP_PENDING: {
      title: 'Cổ phục đã sẵn sàng tại tiệm',
      copy: 'Hãy ghé tiệm đúng hẹn, đưa mã QR vé điện tử để nhận trang phục.',
      tone: 'info',
    },
    AWAITING_REVIEW: {
      title: 'Album ảnh đã được bàn giao',
      copy: 'Hãy kiểm tra ảnh và bấm Xác nhận hài lòng để hoàn tất đơn hàng.',
      tone: 'warning',
    },
    CONFIRMED: {
      title: 'Lịch hẹn đã được xác nhận',
      copy: 'Tiệm đã khóa lịch riêng cho bạn và đang chuẩn bị trang phục / ekip.',
      tone: 'success',
    },
  };
  const value = map[booking.status];
  if (!value) return null;
  const color =
    value.tone === 'success' ? Colors.success : value.tone === 'warning' ? Colors.warning : '#2563EB';
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
                : '#EFF6FF',
        },
      ]}>
      <Ionicons
        name={value.tone === 'success' ? 'checkmark-circle' : 'information-circle'}
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
function Evidence({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={[styles.evidenceBox, done && styles.evidenceDone]}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'camera-outline'}
        size={22}
        color={done ? Colors.success : '#8F8E8E'}
      />
      <Text style={[styles.evidenceText, done && { color: Colors.success }]}>{label}</Text>
      <Text style={styles.evidenceState}>{done ? 'Đã xác nhận' : 'Chưa có'}</Text>
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
});
