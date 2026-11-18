import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getMediaUrl } from '@/utils/media';
import { FontFamily } from '@/constants/theme';
import {
  getItemSkuOrCode,
  getPhotoItems,
  isPhotographyItem,
  resolveBookingDisplayState,
  resolveRentalItemStage,
} from '@/utils/rentalState';
import { formatDate } from '@/utils/booking';

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
  const shortWebId = order._id ? `#${order._id.slice(-6).toUpperCase()}` : '';
  const orderCode = order.bookingCode
    ? `${order.bookingCode}${shortWebId ? ` (${shortWebId})` : ''}`
    : shortWebId || '#BK-000';

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

  const display = resolveBookingDisplayState(order, 'provider');
  const stage = display.stage;
  const isCombo = display.isCombo;
  const isPhotoshootOnly = display.isPhotoshootOnly;

  const allItems: any[] = Array.isArray(order.items) ? order.items : [];
  const firstItem = allItems[0] || {};
  const myPhotoItems = getPhotoItems(order, true);

  const grandTotal =
    order.pricingSummary?.grandTotal ??
    order.pricingSummary?.subTotal ??
    order.totalAmount ??
    0;
  const depositTotal =
    order.pricingSummary?.depositTotal ??
    order.depositAmount ??
    allItems.reduce(
      (sum, it) =>
        sum + (isPhotographyItem(it) ? 0 : (it.depositAmount ?? 0) * (it.quantity ?? 1)),
      0,
    );

  const pendingRescheduleItem = allItems.find(
    (it: any) => it?.rescheduleRequest?.status === 'PENDING',
  );

  const statusLabel = display.label;
  const statusTone: 'rose' | 'amber' | 'emerald' | 'gray' =
    display.tone === 'error'
      ? 'rose'
      : display.tone === 'warning' || display.tone === 'info'
        ? 'amber'
        : display.tone === 'success'
          ? 'emerald'
          : 'gray';

  const handleCall = () => {
    if (customerPhone) {
      void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`);
    }
  };

  const renderActionButtons = () => {
    if (stage === 'DEPOSIT_PAID') {
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
              {isPhotoshootOnly ? 'Chấp nhận lịch chụp' : 'Xác nhận & Chuẩn bị'}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (stage === 'PREPARING') {
      if (isPhotoshootOnly && myPhotoItems.length === 0) {
        return (
          <Pressable
            style={({ pressed }) => [styles.fullOutlineBtn, pressed && styles.pressed]}
            onPress={() => onPressDetail(order)}
          >
            <Text style={styles.fullOutlineBtnText}>Xem chi tiết đơn</Text>
          </Pressable>
        );
      }
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
              name={isPhotoshootOnly ? 'play-circle-outline' : 'shirt-outline'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.primaryRoseBtnText}>
              {isPhotoshootOnly ? 'Bắt đầu buổi chụp' : 'Sẵn sàng giao đồ'}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (stage === 'READY_NEEDS_HANDOVER_PHOTOS') {
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
            <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>Bàn giao áo (Tải ảnh)</Text>
          </Pressable>
        </View>
      );
    }

    if (stage === 'HANDOVER_AWAITING_CUSTOMER') {
      return (
        <Pressable
          style={({ pressed }) => [styles.waitingPillBtn, pressed && styles.pressed]}
          onPress={() => onPressDetail(order)}
        >
          <Ionicons name="time-outline" size={15} color="#B45309" />
          <Text style={styles.waitingPillText} numberOfLines={1}>
            Đã gửi ảnh · Chờ khách xác nhận nhận áo
          </Text>
        </Pressable>
      );
    }

    if (stage === 'IN_RENTAL') {
      if (isCombo && !order.photosApproved && myPhotoItems.length > 0) {
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
        <Pressable
          style={({ pressed }) => [styles.waitingPillBtn, styles.emeraldWaitingBtn, pressed && styles.pressed]}
          onPress={() => onPressDetail(order)}
        >
          <Ionicons name="bag-check-outline" size={15} color="#047857" />
          <Text style={[styles.waitingPillText, { color: '#047857' }]} numberOfLines={1}>
            Khách đang giữ áo · Chờ yêu cầu trả đồ
          </Text>
        </Pressable>
      );
    }

    if (stage === 'CUSTOMER_RETURN_REQUESTED') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => onPressDetail(order)}
          >
            <Text style={styles.secondaryBtnText}>Chi tiết</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryEmeraldBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>Xác nhận đã nhận lại</Text>
          </Pressable>
        </View>
      );
    }

    if (stage === 'IN_PROGRESS') {
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

    if (stage === 'RETURNED_NEEDS_INSPECTION') {
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
            <Text style={styles.primaryRoseBtnText}>Không sự cố · Hoàn cọc</Text>
          </Pressable>
        </View>
      );
    }

    if (stage === 'CLEANING_AFTER_REFUND') {
      return (
        <View style={styles.twoBtnGrid}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => onPressDetail(order)}
          >
            <Text style={styles.secondaryBtnText}>Chi tiết</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryEmeraldBtn, pressed && styles.pressed]}
            onPress={() => onPressPrimaryAction(order)}
          >
            <Ionicons name="sparkles-outline" size={15} color="#FFFFFF" />
            <Text style={styles.primaryRoseBtnText}>Hoàn tất giặt ủi</Text>
          </Pressable>
        </View>
      );
    }

    if (
      stage === 'AWAITING_REVIEW' ||
      stage === 'INCIDENT_PENDING_CUSTOMER' ||
      stage === 'COMBO_PHOTOS_APPROVED' ||
      stage === 'DISPUTED' ||
      stage === 'PENDING_PAYMENT'
    ) {
      return (
        <Pressable
          style={({ pressed }) => [
            styles.waitingPillBtn,
            (stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED') && styles.roseWaitingBtn,
            pressed && styles.pressed,
          ]}
          onPress={() => onPressDetail(order)}
        >
          <Ionicons
            name={
              stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED'
                ? 'alert-circle-outline'
                : 'time-outline'
            }
            size={15}
            color={
              stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED'
                ? '#DC2626'
                : '#B45309'
            }
          />
          <Text
            style={[
              styles.waitingPillText,
              (stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED') && {
                color: '#DC2626',
              },
            ]}
            numberOfLines={1}
          >
            {display.shortLabel} · Xem chi tiết
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
          <Text style={styles.orderCode} numberOfLines={1}>
            {orderCode}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {isCombo ? 'Combo' : isPhotoshootOnly ? 'Chụp ảnh' : 'Áo dài'}
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
            numberOfLines={1}
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

      {/* 3. Items List Preview (all items in order so nothing is hidden) */}
      <Pressable style={styles.itemsStack} onPress={() => onPressDetail(order)}>
        {(allItems.length > 0 ? allItems : [firstItem]).map((it: any, idx: number) => {
          const isPhotoItem = isPhotographyItem(it);
          const name =
            it.name ||
            it.productName ||
            it.productId?.name ||
            it.photographyPackageId?.name ||
            it.packageSnapshot?.name ||
            (isPhotoItem ? 'Gói Chụp Ảnh' : 'Áo Dài Cổ Phục');
          const img =
            it.productId?.images?.[0] ||
            it.photographyPackageId?.images?.[0] ||
            it.images?.[0] ||
            it.image ||
            (isPhotoItem ? '/partner_cover.jpg' : '/hong_lien_hoa.webp');
          const sku = !isPhotoItem ? getItemSkuOrCode(it) : null;
          const sizeVal = it.selectedSize || it.size;
          const itemStage = !isPhotoItem ? resolveRentalItemStage(order, it) : null;
          const itemDisplay = !isPhotoItem && itemStage
            ? resolveBookingDisplayState({ ...order, items: [it] }, 'provider')
            : null;
          const dateLabel = isPhotoItem
            ? `${it.shootDate ? formatDate(it.shootDate) : 'Chưa rõ ngày'}${it.shootTimeSlot ? ` · ${it.shootTimeSlot}` : ''}`
            : it.rentalFrom && it.rentalTo
              ? `${formatDate(it.rentalFrom)} → ${formatDate(it.rentalTo)}`
              : 'Nhận đồ tại tiệm';

          return (
            <View
              key={it._id || idx}
              style={[styles.itemBox, idx > 0 && styles.itemBoxDivider]}
            >
              <Image source={{ uri: getMediaUrl(img) }} style={styles.itemThumb} />
              <View style={styles.itemTextCol}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {name}
                  </Text>
                  {itemDisplay && (
                    <Text style={styles.itemStageText} numberOfLines={1}>
                      {itemDisplay.shortLabel}
                    </Text>
                  )}
                </View>
                <View style={styles.metaRow}>
                  {!isPhotoItem ? (
                    <>
                      {sizeVal ? <Text style={styles.metaText}>Size {sizeVal}</Text> : null}
                      {sizeVal && sku ? <Text style={styles.metaDot}>•</Text> : null}
                      {sku ? <Text style={styles.tagText}>{sku}</Text> : null}
                      {(sizeVal || sku) ? <Text style={styles.metaDot}>•</Text> : null}
                    </>
                  ) : null}
                  <Text style={styles.noteText} numberOfLines={1}>
                    {dateLabel}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.nextStepHintRow}>
          <Ionicons
            name={display.actionRequired ? 'flash-outline' : 'information-circle-outline'}
            size={13}
            color={display.actionRequired ? '#BA0049' : '#64748B'}
          />
          <Text
            style={[
              styles.nextStepHintText,
              display.actionRequired && { color: '#9D174D' },
            ]}
            numberOfLines={2}
          >
            {display.nextStepText}
          </Text>
        </View>
      </Pressable>

      {/* 4. Financial & Actions */}
      <View style={styles.bottomSection}>
        <View style={styles.financeRow}>
          <Text style={styles.rentalPrice}>
            Tổng đơn:{' '}
            <Text style={styles.rentalPriceBold}>
              {Number(grandTotal || 0).toLocaleString('vi-VN')}đ
            </Text>
          </Text>

          {depositTotal > 0 && (
            <View style={styles.escrowBadge}>
              <Ionicons name="lock-closed" size={12} color="#BA0049" />
              <Text style={styles.escrowText}>
                Cọc Escrow:{' '}
                <Text style={styles.escrowBold}>
                  {Number(depositTotal || 0).toLocaleString('vi-VN')}đ
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
  itemsStack: {
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 9,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 8,
  },
  itemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemBoxDivider: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
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
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  itemStageText: {
    fontSize: 9.5,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nextStepHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
  },
  nextStepHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#475569',
    lineHeight: 15,
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
    paddingHorizontal: 10,
  },
  emeraldWaitingBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  roseWaitingBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
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
