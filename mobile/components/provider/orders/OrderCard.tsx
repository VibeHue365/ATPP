import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getMediaUrl } from '@/utils/media';
import { FontFamily } from '@/constants/theme';

interface OrderCardProps {
  order: any;
  onPressDetail: (order: any) => void;
  onPressPrimaryAction: (order: any) => void;
  onPressSecondaryAction?: (order: any, actionType: 'INCIDENT' | 'CANCEL' | 'RESCHEDULE_APPROVE' | 'RESCHEDULE_REJECT') => void;
  onOpenChat?: (bookingId: string) => void;
}

export function OrderCard({
  order,
  onPressDetail,
  onPressPrimaryAction,
  onPressSecondaryAction,
  onOpenChat,
}: OrderCardProps) {
  const orderCode =
    order.bookingCode ||
    (order._id ? `#${order._id.slice(-8).toUpperCase()}` : '#BK-000');

  const customerName =
    order.customerId?.profile?.fullName ||
    order.contactInfo?.fullName ||
    'Khách hàng TàGo';
  const customerPhone =
    order.customerId?.auth?.phone ||
    order.customerId?.profile?.phoneNumber ||
    order.contactInfo?.phone ||
    order.customerPhone ||
    '';
  const avatarUrl =
    order.customerId?.profile?.avatarUrl || order.customerId?.avatar;

  const status = order.status || 'CONFIRMED';
  const isCombo =
    order.bookingType === 'COMBO' ||
    (order.items?.some((i: any) => i.itemType === 'PRODUCT' || i.productId) &&
      order.items?.some(
        (i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId,
      ));
  const isPhotoshoot = order.bookingType === 'PHOTOGRAPHY';

  const firstItem = order.items?.[0] || {};
  const itemName =
    firstItem.name ||
    firstItem.productName ||
    firstItem.productId?.name ||
    firstItem.photographyPackageId?.name ||
    (isPhotoshoot
      ? 'Gói Chụp Ảnh Di Sản Cố Đô'
      : 'Áo Dài Ngũ Thân Cung Đình');
  const itemImage =
    firstItem.productId?.images?.[0] ||
    firstItem.photographyPackageId?.images?.[0] ||
    firstItem.images?.[0] ||
    firstItem.image ||
    (isPhotoshoot ? '/partner_cover.jpg' : '/hong_lien_hoa.webp');

  const size = firstItem.selectedSize || firstItem.size || 'M';
  const tagCode = firstItem.inventoryItemId
    ? `#TAG-${firstItem.inventoryItemId.toString().slice(-3).toUpperCase()}`
    : '#TAG-042';

  const subTotal =
    order.pricingSummary?.subTotal ||
    order.pricingSummary?.grandTotal ||
    order.totalAmount ||
    0;
  const depositTotal =
    order.pricingSummary?.depositTotal ||
    order.depositAmount ||
    firstItem.depositAmount ||
    0;

  // Check if any item has a PENDING reschedule request (just like Web OrderActionDropdown)
  const pendingRescheduleItem = order.items?.find(
    (it: any) => it?.rescheduleRequest?.status === 'PENDING',
  );

  // Web-aligned Status Label & Tone
  let statusLabel = 'Đang thực hiện';
  let statusTone: 'rose' | 'amber' | 'emerald' | 'gray' = 'emerald';

  switch (status) {
    case 'PENDING':
    case 'PENDING_PAYMENT':
      statusLabel = 'Chờ xác nhận';
      statusTone = 'amber';
      break;
    case 'DEPOSIT_PAID':
      statusLabel = 'Đã đặt cọc · Chờ duyệt';
      statusTone = 'rose';
      break;
    case 'CONFIRMED':
      statusLabel = isPhotoshoot ? 'Đã duyệt lịch chụp' : 'Chuẩn bị trang phục';
      statusTone = 'emerald';
      break;
    case 'PICKUP_PENDING':
      statusLabel = 'Chờ khách duyệt nhận đồ';
      statusTone = 'amber';
      break;
    case 'PICKED_UP':
      statusLabel = 'Đang thuê';
      statusTone = 'amber';
      break;
    case 'IN_PROGRESS':
      statusLabel = 'Đang chụp ảnh';
      statusTone = 'amber';
      break;
    case 'AWAITING_REVIEW':
      statusLabel = 'Chờ khách duyệt ảnh';
      statusTone = 'amber';
      break;
    case 'COMBO_PHOTOS_APPROVED':
      statusLabel = 'Đã duyệt ảnh · Chờ trả đồ';
      statusTone = 'emerald';
      break;
    case 'RETURN_PENDING':
      statusLabel = 'Chờ khách duyệt sự cố';
      statusTone = 'rose';
      break;
    case 'RETURNED':
      statusLabel = 'Đã trả đồ · Chờ hoàn tất';
      statusTone = 'rose';
      break;
    case 'DISPUTED':
      statusLabel = 'Đang tranh chấp';
      statusTone = 'rose';
      break;
    case 'COMPLETED':
      statusLabel = 'Đã hoàn tất';
      statusTone = 'gray';
      break;
    case 'CANCELLED':
      statusLabel = 'Đã hủy';
      statusTone = 'gray';
      break;
  }

  const handleCall = () => {
    if (customerPhone) {
      void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`);
    }
  };

  // Determine Primary Action Button Label & Style (100% synced with Web OrderActionDropdown)
  const renderActionButtons = () => {
    // 1. DEPOSIT_PAID
    if (status === 'DEPOSIT_PAID' || status === 'PENDING') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryDangerBtn, pressed && styles.pressed]}
            onPress={() =>
              onPressSecondaryAction
                ? onPressSecondaryAction(order, 'CANCEL')
                : onPressDetail(order)
            }
          >
            <Text style={styles.secondaryDangerBtnText}>Từ chối</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryRoseBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>
              {isPhotoshoot ? 'Chấp nhận lịch chụp' : 'Bàn giao trang phục'}
            </Text>
          </Pressable>
        </View>
      );
    }

    // 2. CONFIRMED
    if (status === 'CONFIRMED') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => onPressDetail(order)}
          >
            <Text style={styles.secondaryBtnText}>Chi tiết</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryRoseBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons
              name={isPhotoshoot ? 'play-circle-outline' : 'camera-outline'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.primaryRoseBtnText}>
              {isPhotoshoot ? 'Bắt đầu buổi chụp' : 'Bàn giao áo (Tải ảnh)'}
            </Text>
          </Pressable>
        </View>
      );
    }

    // 3. PICKUP_PENDING (Waiting for customer to confirm pickup)
    if (status === 'PICKUP_PENDING') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.waitingPillBtn, pressed && styles.pressed]}
            onPress={() => onPressDetail(order)}
          >
            <Ionicons name="time-outline" size={15} color="#B45309" />
            <Text style={styles.waitingPillText}>
              Chờ khách xác nhận nhận đồ...
            </Text>
          </Pressable>
        </View>
      );
    }

    // 4. PICKED_UP / COMBO_PHOTOS_APPROVED
    if (status === 'PICKED_UP' || status === 'COMBO_PHOTOS_APPROVED') {
      if (isCombo && status === 'PICKED_UP' && !order.photosApproved) {
        return (
          <View style={styles.twoBtnGrid}>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => onPressDetail(order)}
            >
              <Text style={styles.secondaryBtnText}>Chi tiết</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryRoseBtn, pressed && styles.pressed]}
              onPress={() => onPressPrimaryAction(order)}
            >
              <Ionicons name="play-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryRoseBtnText}>Bắt đầu buổi chụp</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryDangerBtn, pressed && styles.pressed]}
            onPress={() =>
              onPressSecondaryAction
                ? onPressSecondaryAction(order, 'INCIDENT')
                : onPressDetail(order)
            }
          >
            <Ionicons name="warning-outline" size={14} color="#DC2626" />
            <Text style={styles.secondaryDangerBtnText}>Báo sự cố</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryEmeraldBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>Xác nhận đã trả đồ</Text>
          </Pressable>
        </View>
      );
    }

    // 5. IN_PROGRESS (Photoshoot / Combo shooting)
    if (status === 'IN_PROGRESS') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => onPressDetail(order)}
          >
            <Text style={styles.secondaryBtnText}>Chi tiết</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryRoseBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>Bàn giao ảnh chụp</Text>
          </Pressable>
        </View>
      );
    }

    // 6. RETURNED -> Ready to finalize COMPLETED & release Escrow
    if (status === 'RETURNED') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryDangerBtn, pressed && styles.pressed]}
            onPress={() =>
              onPressSecondaryAction
                ? onPressSecondaryAction(order, 'INCIDENT')
                : onPressDetail(order)
            }
          >
            <Ionicons name="warning-outline" size={14} color="#DC2626" />
            <Text style={styles.secondaryDangerBtnText}>Báo sự cố</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryRoseBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>
              Hoàn thành & Hoàn cọc
            </Text>
          </Pressable>
        </View>
      );
    }

    // 7. AWAITING_REVIEW or RETURN_PENDING
    if (status === 'AWAITING_REVIEW' || status === 'RETURN_PENDING') {
      return (
        <Pressable
          style={({ pressed }) => [styles.waitingPillBtn, pressed && styles.pressed]}
          onPress={() => onPressDetail(order)}
        >
          <Ionicons name="time-outline" size={15} color="#B45309" />
          <Text style={styles.waitingPillText}>
            {status === 'AWAITING_REVIEW'
              ? 'Đang chờ khách duyệt nhận ảnh · Xem chi tiết'
              : 'Đang chờ khách xác nhận đền bù sự cố · Xem chi tiết'}
          </Text>
        </Pressable>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [styles.fullOutlineBtn, pressed && styles.pressed]}
        onPress={() => onPressDetail(order)}
      >
        <Text style={styles.fullOutlineBtnText}>Xem chi tiết đơn</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {/* 1. Top Row: Order ID + Type Badge + Status Pill */}
      <View style={styles.topRow}>
        <View style={styles.codeGroup}>
          <Text style={styles.orderCode}>{orderCode}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {isCombo ? 'Combo' : isPhotoshoot ? 'Chụp ảnh' : 'Áo dài'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            statusTone === 'rose' && styles.statusPillRose,
            statusTone === 'amber' && styles.statusPillAmber,
            statusTone === 'emerald' && styles.statusPillEmerald,
            statusTone === 'gray' && styles.statusPillGray,
          ]}
        >
          <View
            style={[
              styles.pulseDot,
              statusTone === 'rose' && styles.pulseDotRose,
              statusTone === 'amber' && styles.pulseDotAmber,
              statusTone === 'emerald' && styles.pulseDotEmerald,
              statusTone === 'gray' && styles.pulseDotGray,
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              statusTone === 'rose' && styles.statusTextRose,
              statusTone === 'amber' && styles.statusTextAmber,
              statusTone === 'emerald' && styles.statusTextEmerald,
              statusTone === 'gray' && styles.statusTextGray,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Pending Reschedule Request Alert Banner (if customer requested reschedule) */}
      {pendingRescheduleItem && (
        <View style={styles.rescheduleBanner}>
          <View style={styles.rescheduleTop}>
            <Ionicons name="calendar" size={14} color="#B45309" />
            <Text style={styles.rescheduleTitle}>
              Khách gửi yêu cầu đổi lịch thuê
            </Text>
          </View>
          <View style={styles.rescheduleActions}>
            <Pressable
              style={styles.rescheduleRejectBtn}
              onPress={() => onPressSecondaryAction?.(order, 'RESCHEDULE_REJECT')}
            >
              <Text style={styles.rescheduleRejectText}>Từ chối</Text>
            </Pressable>
            <Pressable
              style={styles.rescheduleApproveBtn}
              onPress={() => onPressSecondaryAction?.(order, 'RESCHEDULE_APPROVE')}
            >
              <Text style={styles.rescheduleApproveText}>Duyệt đổi lịch</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 2. Customer Row */}
      <View style={styles.customerRow}>
        <View style={styles.customerLeft}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: getMediaUrl(avatarUrl) }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {customerName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.customerTextCol}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {customerName}
              </Text>
              <View style={styles.vipTag}>
                <Text style={styles.vipTagText}>KHÁCH</Text>
              </View>
            </View>
            <Text style={styles.phoneText}>
              {customerPhone || 'Liên hệ qua tin nhắn'}
            </Text>
          </View>
        </View>

        <View style={styles.contactGroup}>
          {customerPhone ? (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              onPress={handleCall}
              accessibilityLabel="Gọi điện"
            >
              <Ionicons name="call-outline" size={16} color="#1B1C1C" />
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={() => onOpenChat?.(order._id)}
            accessibilityLabel="Nhắn tin"
          >
            <Ionicons name="chatbubble-outline" size={16} color="#1B1C1C" />
          </Pressable>
        </View>
      </View>

      {/* 3. Item Preview Row */}
      <Pressable style={styles.itemBox} onPress={() => onPressDetail(order)}>
        <Image source={{ uri: getMediaUrl(itemImage) }} style={styles.itemThumb} />
        <View style={styles.itemTextCol}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {itemName}
          </Text>
          <View style={styles.metaRow}>
            {!isPhotoshoot && (
              <>
                <Text style={styles.metaText}>Size {size}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.tagText}>{tagCode}</Text>
                <Text style={styles.metaDot}>•</Text>
              </>
            )}
            <Text style={styles.noteText} numberOfLines={1}>
              {status === 'PICKUP_PENDING'
                ? 'Đã gửi ảnh bàn giao'
                : status === 'RETURNED'
                  ? 'Khách đã trả đồ'
                  : isPhotoshoot
                    ? 'Lịch chụp ngoại cảnh'
                    : 'Nhận đồ tại tiệm'}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* 4. Financial & Actions */}
      <View style={styles.bottomSection}>
        <View style={styles.financeRow}>
          <Text style={styles.rentalPrice}>
            Tổng đơn:{' '}
            <Text style={styles.rentalPriceBold}>
              {subTotal.toLocaleString('vi-VN')}đ
            </Text>
          </Text>

          {depositTotal > 0 && (
            <View style={styles.escrowBadge}>
              <Ionicons name="lock-closed" size={12} color="#BA0049" />
              <Text style={styles.escrowText}>
                Cọc Escrow:{' '}
                <Text style={styles.escrowBold}>
                  {depositTotal.toLocaleString('vi-VN')}đ
                </Text>
              </Text>
            </View>
          )}
        </View>

        <View style={styles.buttonsRow}>{renderActionButtons()}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 20,
    padding: 15,
    gap: 11,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderCode: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  typeBadge: {
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5F5E5E',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusPillRose: {
    backgroundColor: '#FFF0F3',
  },
  statusPillAmber: {
    backgroundColor: '#FFFBEB',
  },
  statusPillEmerald: {
    backgroundColor: '#ECFDF5',
  },
  statusPillGray: {
    backgroundColor: '#F5F3F3',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pulseDotRose: { backgroundColor: '#BA0049' },
  pulseDotAmber: { backgroundColor: '#D97706' },
  pulseDotEmerald: { backgroundColor: '#059669' },
  pulseDotGray: { backgroundColor: '#9CA3AF' },
  statusPillText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
  },
  statusTextRose: { color: '#BA0049' },
  statusTextAmber: { color: '#B45309' },
  statusTextEmerald: { color: '#059669' },
  statusTextGray: { color: '#5F5E5E' },
  rescheduleBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rescheduleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  rescheduleTitle: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#B45309',
  },
  rescheduleActions: {
    flexDirection: 'row',
    gap: 6,
  },
  rescheduleRejectBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rescheduleRejectText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#B45309',
  },
  rescheduleApproveBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  rescheduleApproveText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 38,
    height: 38,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  customerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  vipTag: {
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  vipTagText: {
    fontSize: 9,
    fontFamily: FontFamily.bodyBold,
    color: '#5F5E5E',
  },
  phoneText: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
  },
  contactGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 9,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  itemThumb: {
    width: 48,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#EFECEB',
  },
  itemTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  metaDot: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  tagText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  noteText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#B45309',
  },
  bottomSection: {
    gap: 10,
  },
  financeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rentalPrice: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  rentalPriceBold: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  escrowText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#BA0049',
  },
  escrowBold: {
    fontFamily: FontFamily.bodyBold,
  },
  buttonsRow: {
    width: '100%',
  },
  twoBtnGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  secondaryDangerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  secondaryDangerBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#DC2626',
  },
  primaryRoseBtn: {
    flex: 1.6,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#BA0049',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryEmeraldBtn: {
    flex: 1.6,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryRoseBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  waitingPillBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  waitingPillText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#B45309',
  },
  fullOutlineBtn: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullOutlineBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
