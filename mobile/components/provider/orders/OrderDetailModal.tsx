import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { TagoMapView } from '@/components/map/TagoMapView';
import {
  estimateDriveMinutes,
  formatDistance,
  haversineKm,
  openExternalDirections,
  resolveEntityCoords,
} from '@/utils/geo';
import { getMediaUrl } from '@/utils/media';

interface OrderDetailModalProps {
  visible: boolean;
  onClose: () => void;
  order: any | null;
  onAction: (order: any, nextStatus: string) => void;
  onRefundEscrow?: (order: any) => void;
  onOpenWorkflowModal?: (
    order: any,
    mode: 'HANDOVER' | 'DELIVER_PHOTOS' | 'REPORT_INCIDENT' | 'CANCEL_ORDER',
  ) => void;
  onOpenChat?: (bookingId: string) => void;
  onOpenNavigationMap?: (order: any) => void;
  actionLoading?: boolean;
}

export function OrderDetailModal({
  visible,
  onClose,
  order,
  onAction,
  onRefundEscrow,
  onOpenWorkflowModal,
  onOpenChat,
  onOpenNavigationMap,
  actionLoading = false,
}: OrderDetailModalProps) {
  if (!order) return null;

  const orderCode =
    order.bookingCode ||
    (order._id ? `#${order._id.slice(-8).toUpperCase()}` : '#BK-000');

  const customerName =
    order.customerId?.profile?.fullName ||
    order.contactInfo?.fullName ||
    'Khách hàng VibeHue';
  const customerPhone =
    order.customerId?.auth?.phone ||
    order.contactInfo?.phone ||
    '0901234567';
  const customerEmail =
    order.customerId?.auth?.email || order.contactInfo?.email;
  const avatarUrl = order.customerId?.profile?.avatarUrl;

  const status = order.status || 'CONFIRMED';
  const isRental = order.bookingType !== 'PHOTOGRAPHY';

  // Financials
  const subTotal =
    order.pricingSummary?.subTotal || order.totalAmount || 1000000;
  const depositTotal = order.pricingSummary?.depositTotal || 300000;
  const discountAmount = order.pricingSummary?.discountAmount || 0;
  const grandTotal =
    order.pricingSummary?.grandTotal || subTotal + depositTotal - discountAmount;

  // First item info
  const firstItem = order.items?.[0] || {};
  const itemName =
    firstItem.name ||
    firstItem.productName ||
    (isRental
      ? 'Áo Dài Ngũ Thân Cung Đình Gấm Tơ Tằm'
      : 'Combo Chụp Ảnh Hoàng Hôn Sông Hương');
  const itemImage =
    firstItem.productId?.images?.[0] ||
    firstItem.photographyPackageId?.images?.[0] ||
    firstItem.images?.[0] ||
    (isRental ? '/avatar_co_phong.svg' : '/partner_cover.jpg');

  const size = firstItem.selectedSize || firstItem.size || 'M';
  const color = firstItem.selectedColor || firstItem.color || 'Đỏ Hoàng Triều';

  const shootSnap =
    order.photoshootSchedule?.locationSnapshot ||
    firstItem.shootLocationSnapshot ||
    firstItem.pickupReturnLocationSnapshot ||
    order.location;
  const spotAddress =
    shootSnap?.addressLine ||
    shootSnap?.address ||
    firstItem.shootLocation ||
    firstItem.providerAddress ||
    'Đại Nội Huế (Hoàng Thành), TP. Huế';
  const spotCoords = resolveEntityCoords({
    id: order._id || 'order-spot',
    geo: shootSnap?.geo,
    address: { addressLine: spotAddress },
  });
  const providerOrigin = resolveEntityCoords(
    order.providerId || { address: { city: 'Huế', addressLine: 'Cung An Định, TP. Huế' } },
  );
  const spotDistKm = haversineKm(providerOrigin, spotCoords);
  const spotDriveMins = estimateDriveMinutes(spotDistKm);

  const handleCall = () => {
    if (customerPhone) {
      void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.codeRow}>
                <Text style={styles.orderCode}>{orderCode}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {isRental ? 'Áo dài' : 'Chụp ảnh'}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerSub}>Chi tiết đơn đặt & bàn giao</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color="#5F6874" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Status Timeline Stepper */}
            <View style={styles.stepperBox}>
              <Text style={styles.sectionHeading}>TIẾN TRÌNH ĐƠN HÀNG</Text>
              <View style={styles.stepperRow}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepDot, styles.stepDotDone]}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={styles.stepLabel}>Xác nhận</Text>
                </View>
                <View
                  style={[
                    styles.stepLine,
                    status !== 'CONFIRMED' && styles.stepLineActive,
                  ]}
                />
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      (status === 'PICKUP_PENDING' ||
                        status === 'PICKED_UP' ||
                        status === 'RETURN_PENDING' ||
                        status === 'RETURNED' ||
                        status === 'COMPLETED') &&
                        styles.stepDotDone,
                    ]}
                  >
                    <Text style={styles.stepNum}>2</Text>
                  </View>
                  <Text style={styles.stepLabel}>Sẵn sàng</Text>
                </View>
                <View
                  style={[
                    styles.stepLine,
                    (status === 'PICKED_UP' ||
                      status === 'RETURN_PENDING' ||
                      status === 'RETURNED' ||
                      status === 'COMPLETED') &&
                      styles.stepLineActive,
                  ]}
                />
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      (status === 'PICKED_UP' ||
                        status === 'RETURN_PENDING' ||
                        status === 'RETURNED' ||
                        status === 'COMPLETED') &&
                        styles.stepDotDone,
                    ]}
                  >
                    <Text style={styles.stepNum}>3</Text>
                  </View>
                  <Text style={styles.stepLabel}>Đang thuê</Text>
                </View>
                <View
                  style={[
                    styles.stepLine,
                    (status === 'RETURN_PENDING' ||
                      status === 'RETURNED' ||
                      status === 'COMPLETED') &&
                      styles.stepLineActive,
                  ]}
                />
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      status === 'COMPLETED'
                        ? styles.stepDotDone
                        : status === 'RETURN_PENDING'
                        ? styles.stepDotAmber
                        : styles.stepDotPending,
                    ]}
                  >
                    <Text style={styles.stepNum}>4</Text>
                  </View>
                  <Text style={styles.stepLabel}>Hoàn cọc</Text>
                </View>
              </View>
            </View>

            {/* Customer Contact Box */}
            <View style={styles.cardBox}>
              <Text style={styles.sectionHeading}>THÔNG TIN KHÁCH HÀNG</Text>
              <View style={styles.customerRow}>
                <View style={styles.avatarWrap}>
                  {avatarUrl ? (
                    <Image
                      source={getMediaUrl(avatarUrl)}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {customerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.custInfoCol}>
                  <View style={styles.custNameRow}>
                    <Text style={styles.custName}>{customerName}</Text>
                    <View style={styles.vipTag}>
                      <Text style={styles.vipTagText}>VIP</Text>
                    </View>
                  </View>
                  <Text style={styles.custPhone}>{customerPhone}</Text>
                  {customerEmail && (
                    <Text style={styles.custEmail}>{customerEmail}</Text>
                  )}
                </View>

                <View style={styles.custActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleCall}
                  >
                    <Ionicons name="call-outline" size={16} color="#111418" />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.contactBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      onClose();
                      onOpenChat?.(order._id);
                    }}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={16}
                      color="#111418"
                    />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Item Details Box */}
            <View style={styles.cardBox}>
              <Text style={styles.sectionHeading}>HIỆN VẬT & DỊCH VỤ</Text>
              <View style={styles.itemDetailCard}>
                <Image
                  source={getMediaUrl(itemImage)}
                  style={styles.itemThumb}
                />
                <View style={styles.itemTextCol}>
                  <Text style={styles.itemTitle}>{itemName}</Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.metaBadge}>Size {size}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaBadge}>{color}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaTag}>#TAG-042</Text>
                  </View>
                  <Text style={styles.locationNote}>
                    {isRental
                      ? `Điểm nhận/trả đồ: ${spotAddress}`
                      : `Điểm hẹn chụp: ${spotAddress}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Navigation & Photoshoot Map Box */}
            <View style={styles.cardBox}>
              <View style={styles.mapHeaderRow}>
                <Text style={styles.sectionHeading}>
                  {isRental ? 'BẢN ĐỒ ĐIỂM BÀN GIAO' : 'BẢN ĐỒ DẪN ĐƯỜNG TỚI CHỖ CHỤP'}
                </Text>
                <View style={styles.mapDistBadge}>
                  <Ionicons name="navigate" size={11} color="#8C1D40" />
                  <Text style={styles.mapDistText}>
                    {formatDistance(spotDistKm)} · ~{spotDriveMins}p
                  </Text>
                </View>
              </View>
              <Text style={styles.mapAddressLine}>{spotAddress}</Text>
              <View style={{ marginTop: 8, borderRadius: 14, overflow: 'hidden' }}>
                <TagoMapView
                  center={spotCoords}
                  zoom={14}
                  height={165}
                  userLocation={{
                    ...providerOrigin,
                    label: 'Studio của bạn',
                  }}
                  markers={[
                    {
                      id: order._id || 'spot',
                      lat: spotCoords.lat,
                      lng: spotCoords.lng,
                      title: customerName,
                      subtitle: `${formatDistance(spotDistKm)} · ~${spotDriveMins}p`,
                      badge: isRental ? 'Bàn giao' : 'Điểm chụp',
                      color: '#8C1D40',
                      isSelected: true,
                    },
                  ]}
                  routeLine={{
                    from: providerOrigin,
                    to: spotCoords,
                    color: '#8C1D40',
                  }}
                />
              </View>
              <View style={styles.mapBtnRow}>
                {onOpenNavigationMap && (
                  <Pressable
                    style={({ pressed }) => [styles.mapDriverBtn, pressed && styles.pressed]}
                    onPress={() => {
                      onClose();
                      onOpenNavigationMap(order);
                    }}>
                    <Ionicons name="map-outline" size={15} color="#8C1D40" />
                    <Text style={styles.mapDriverBtnText}>Chế độ Tài xế / Thợ chụp</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [styles.mapExternalBtn, pressed && styles.pressed]}
                  onPress={() =>
                    void openExternalDirections({
                      lat: spotCoords.lat,
                      lng: spotCoords.lng,
                      label: spotAddress,
                      originLat: providerOrigin.lat,
                      originLng: providerOrigin.lng,
                    })
                  }>
                  <Ionicons name="navigate" size={14} color="#FFFFFF" />
                  <Text style={styles.mapExternalBtnText}>Mở Google Maps</Text>
                </Pressable>
              </View>
            </View>

            {/* Financial Breakdown Box */}
            <View style={styles.cardBox}>
              <Text style={styles.sectionHeading}>CHI TIẾT THANH TOÁN</Text>
              <View style={styles.financeTable}>
                <View style={styles.financeRow}>
                  <Text style={styles.financeLabel}>Tiền thuê dịch vụ:</Text>
                  <Text style={styles.financeVal}>
                    {subTotal.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                <View style={styles.financeRow}>
                  <View style={styles.escrowLabelRow}>
                    <Ionicons name="lock-closed" size={13} color="#8C1D40" />
                    <Text style={styles.escrowLabel}>Tiền cọc giữ hộ (Escrow):</Text>
                  </View>
                  <Text style={styles.escrowVal}>
                    {depositTotal.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                {discountAmount > 0 && (
                  <View style={styles.financeRow}>
                    <Text style={styles.discountLabel}>Khuyến mãi giảm giá:</Text>
                    <Text style={styles.discountVal}>
                      -{discountAmount.toLocaleString('vi-VN')} đ
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.financeRowTotal}>
                  <Text style={styles.totalLabel}>Tổng tiền đã thanh toán:</Text>
                  <Text style={styles.totalVal}>
                    {grandTotal.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={13} color="#047857" />
                  <Text style={styles.paidBadgeText}>
                    Đã thanh toán an toàn qua PayOS / VietQR
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Sticky Action Bar (100% Web-synced State Machine) */}
          <View style={styles.bottomBar}>
            {(status === 'DEPOSIT_PAID' || status === 'PENDING' || status === 'PENDING_PAYMENT') && (
              <View style={styles.actionBtnGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryDangerBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'CANCEL_ORDER');
                    } else {
                      onAction(order, 'CANCELLED');
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Text style={styles.secondaryDangerBtnText}>Từ chối đơn</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (isRental && status === 'DEPOSIT_PAID' && onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'HANDOVER');
                    } else {
                      onAction(order, 'CONFIRMED');
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {isRental && status === 'DEPOSIT_PAID'
                      ? 'Bàn giao trang phục'
                      : 'Xác nhận đơn'}
                  </Text>
                </Pressable>
              </View>
            )}

            {status === 'CONFIRMED' && (
              <View style={styles.actionBtnGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryDangerBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'CANCEL_ORDER');
                    } else {
                      onAction(order, 'CANCELLED');
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Text style={styles.secondaryDangerBtnText}>Hủy đơn</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (isRental && onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'HANDOVER');
                    } else {
                      onAction(order, 'IN_PROGRESS');
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons
                    name={isRental ? 'camera-outline' : 'play-circle-outline'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primaryBtnText}>
                    {isRental ? 'Bàn giao áo (Tải ảnh)' : 'Bắt đầu buổi chụp'}
                  </Text>
                </Pressable>
              </View>
            )}

            {status === 'PICKUP_PENDING' && (
              <View style={styles.completedNotice}>
                <Ionicons name="time-outline" size={18} color="#B45309" />
                <Text style={[styles.completedNoticeText, { color: '#B45309' }]}>
                  Đã gửi ảnh bàn giao · Đang chờ khách hàng xác nhận nhận đồ trên ứng dụng
                </Text>
              </View>
            )}

            {status === 'IN_PROGRESS' && (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtnFull,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (onOpenWorkflowModal) {
                    onClose();
                    onOpenWorkflowModal(order, 'DELIVER_PHOTOS');
                  } else {
                    onAction(order, 'AWAITING_REVIEW');
                  }
                }}
                disabled={actionLoading}
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  Bàn giao ảnh chụp (Link Drive / Ảnh)
                </Text>
              </Pressable>
            )}

            {(status === 'PICKED_UP' || status === 'COMBO_PHOTOS_APPROVED') && (
              <View style={styles.actionBtnGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryDangerBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'REPORT_INCIDENT');
                    } else {
                      onClose();
                      onOpenChat?.(order._id);
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons name="warning-outline" size={16} color="#DC2626" />
                  <Text style={styles.secondaryDangerBtnText}>Báo sự cố</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onAction(order, 'RETURNED')}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-done-circle-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.primaryBtnText}>
                        Xác nhận đã trả đồ
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {status === 'RETURNED' && (
              <View style={styles.actionBtnGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryDangerBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'REPORT_INCIDENT');
                    } else {
                      onClose();
                      onOpenChat?.(order._id);
                    }
                  }}
                >
                  <Ionicons name="warning-outline" size={16} color="#DC2626" />
                  <Text style={styles.secondaryDangerBtnText}>Báo sự cố</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    onClose();
                    if (onRefundEscrow) {
                      onRefundEscrow(order);
                    } else {
                      onAction(order, 'COMPLETED');
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    Hoàn thành & Hoàn cọc
                  </Text>
                </Pressable>
              </View>
            )}

            {(status === 'RETURN_PENDING' || status === 'AWAITING_REVIEW') && (
              <View style={styles.completedNotice}>
                <Ionicons name="time-outline" size={18} color="#B45309" />
                <Text style={[styles.completedNoticeText, { color: '#B45309' }]}>
                  {status === 'AWAITING_REVIEW'
                    ? 'Đang chờ khách hàng xác nhận bộ ảnh đã bàn giao'
                    : 'Đang chờ khách hàng xác nhận phương án đền bù sự cố'}
                </Text>
              </View>
            )}

            {status === 'COMPLETED' && (
              <View style={styles.completedNotice}>
                <Ionicons name="checkmark-circle" size={18} color="#047857" />
                <Text style={styles.completedNoticeText}>
                  Đơn hàng đã hoàn tất · Tiền cọc đã được giải ngân an toàn
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderCode: {
    fontSize: 17,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '700',
    color: '#111418',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F4F5F7',
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#5F6874',
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#5F6874',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#8C1D40',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  stepperBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEEF1',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E4E6EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: '#047857',
  },
  stepDotAmber: {
    backgroundColor: '#D97706',
  },
  stepDotPending: {
    backgroundColor: '#E4E6EA',
  },
  stepNum: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
    color: '#5F6874',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E4E6EA',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  stepLineActive: {
    backgroundColor: '#047857',
  },
  cardBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEEF1',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8C1D40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  custInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  custNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  custName: {
    fontSize: 14.5,
    fontFamily: 'Inter_700Bold',
    color: '#111418',
  },
  vipTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#ECEEF1',
  },
  vipTagText: {
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
    color: '#5F6874',
  },
  custPhone: {
    fontSize: 12,
    fontFamily: 'SpaceMono-Regular',
    color: '#5F6874',
    marginTop: 2,
  },
  custEmail: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#8A8284',
    marginTop: 1,
  },
  custActions: {
    flexDirection: 'row',
    gap: 6,
  },
  contactBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DBE0E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetailCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#ECEEF1',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#111418',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  metaBadge: {
    fontSize: 11.5,
    fontFamily: 'Inter_400Regular',
    color: '#5F6874',
  },
  metaDot: {
    fontSize: 11,
    color: '#DBE0E6',
  },
  metaTag: {
    fontSize: 11.5,
    fontFamily: 'SpaceMono-Regular',
    color: '#8C1D40',
    fontWeight: '600',
  },
  locationNote: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#B45309',
    marginTop: 3,
  },
  financeTable: {
    gap: 8,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financeLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#5F6874',
  },
  financeVal: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#111418',
  },
  escrowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  escrowLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#8C1D40',
  },
  escrowVal: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#8C1D40',
  },
  discountLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#047857',
  },
  discountVal: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#047857',
  },
  divider: {
    height: 1,
    backgroundColor: '#ECEEF1',
    marginVertical: 4,
  },
  financeRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13.5,
    fontFamily: 'Inter_700Bold',
    color: '#111418',
  },
  totalVal: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#111418',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDFDF5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  paidBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#047857',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF1',
    backgroundColor: '#FFFFFF',
  },
  actionBtnGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBE0E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#5F6874',
  },
  secondaryDangerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryDangerBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#DC2626',
  },
  primaryBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#8C1D40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnFull: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#8C1D40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  amberBtnFull: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  amberBtnText: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  completedNoticeText: {
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
    color: '#047857',
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapDistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  mapDistText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    color: '#8C1D40',
  },
  mapAddressLine: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#334155',
    marginTop: 4,
    lineHeight: 17,
  },
  mapBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  mapDriverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  mapDriverBtnText: {
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
    color: '#8C1D40',
  },
  mapExternalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#8C1D40',
  },
  mapExternalBtnText: {
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
