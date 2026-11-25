import React, { useEffect, useState } from 'react';
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
import { formatDate } from '@/utils/booking';
import {
  getItemSkuOrCode,
  getPhotoItems,
  getRentalItems,
  hasPickupEvidence,
  isPhotographyItem,
  resolveBookingDisplayState,
  resolveRentalItemStage,
} from '@/utils/rentalState';
import type { ContractSummary } from '@/types/contract';
import { AuthorizedEvidenceImage } from '@/components/booking/AuthorizedEvidenceImage';
import { BookingFlowStepper } from '@/components/booking/BookingFlowStepper';
import { BookingContractsSection } from '@/components/contracts/BookingContractsSection';
import { ContractDetailModal } from '@/components/contracts/ContractDetailModal';
import { ContractPdfModal } from '@/components/contracts/ContractPdfModal';
import { OrderStaffAssignmentSection } from '@/components/provider/orders/OrderStaffAssignmentSection';

export type ProviderRentalActionType =
  | 'READY'
  | 'HANDOVER'
  | 'RETURNED'
  | 'CONFIRM_NO_INCIDENT'
  | 'CLEANING_COMPLETED'
  | 'REPORT_INCIDENT';

interface OrderDetailModalProps {
  visible: boolean;
  onClose: () => void;
  order: any | null;
  onAction: (order: any, nextStatus: string) => void;
  onRentalAction?: (
    order: any,
    action: ProviderRentalActionType,
    itemId?: string,
  ) => void;
  onRefundEscrow?: (order: any) => void;
  onOpenWorkflowModal?: (
    order: any,
    mode: 'HANDOVER' | 'DELIVER_PHOTOS' | 'REPORT_INCIDENT' | 'CANCEL_ORDER',
    targetItemId?: string,
  ) => void;
  onOpenChat?: (bookingId: string) => void;
  onOpenNavigationMap?: (order: any) => void;
  onOrderUpdated?: () => void;
  actionLoading?: boolean;
}

const INV_STATUS_LABEL: Record<string, string> = {
  RESERVED: 'Đã giữ cho đơn',
  RENTED_OUT: 'Đang cho khách thuê',
  RETURNED_PENDING_INSPECTION: 'Chờ kiểm tra',
  CLEANING: 'Đang giặt ủi',
  AVAILABLE: 'Sẵn sàng phục vụ',
  MAINTENANCE: 'Đang bảo trì',
  DAMAGED: 'Hư hỏng',
  LOST: 'Thất lạc',
};

export function OrderDetailModal({
  visible,
  onClose,
  order,
  onAction,
  onRentalAction,
  onRefundEscrow,
  onOpenWorkflowModal,
  onOpenChat,
  onOpenNavigationMap,
  onOrderUpdated,
  actionLoading = false,
}: OrderDetailModalProps) {
  const [activeContractDetail, setActiveContractDetail] =
    useState<ContractSummary | null>(null);
  const [activeContractPdf, setActiveContractPdf] =
    useState<ContractSummary | null>(null);

  useEffect(() => {
    if (!visible) {
      setActiveContractDetail(null);
      setActiveContractPdf(null);
    }
  }, [visible]);

  if (!order) return null;

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
  const customerEmail =
    order.customerId?.auth?.email || order.contactInfo?.email;
  const avatarUrl = order.customerId?.profile?.avatarUrl;

  const display = resolveBookingDisplayState(order, 'provider');
  const stage = display.stage;
  const status = order.status || 'CONFIRMED';
  const isRental = display.hasRentalItems;
  const isCombo = display.isCombo;
  const isPhotoshootOnly = display.isPhotoshootOnly;

  const allItems: any[] = Array.isArray(order.items) ? order.items : [];
  const firstItem = allItems[0] || {};
  const myRentalItems = getRentalItems(order, true);
  const myPhotoItems = getPhotoItems(order, true);
  const targetRentalItemId =
    myRentalItems[0]?._id || allItems.find((it) => !isPhotographyItem(it))?._id;

  // Financials (no hardcoded mock fallbacks)
  const subTotal =
    order.pricingSummary?.subTotal ?? order.totalAmount ?? 0;
  const depositTotal =
    order.pricingSummary?.depositTotal ??
    order.depositAmount ??
    allItems.reduce(
      (sum, it) =>
        sum + (isPhotographyItem(it) ? 0 : (it.depositAmount ?? 0) * (it.quantity ?? 1)),
      0,
    );
  const discountAmount = order.pricingSummary?.discountAmount || 0;
  const grandTotal =
    order.pricingSummary?.grandTotal ?? Math.max(0, subTotal + depositTotal - discountAmount);

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
    <>
      <Modal
        visible={visible && !activeContractDetail && !activeContractPdf}
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
                    {isCombo ? 'Combo' : isPhotoshootOnly ? 'Chụp ảnh' : 'Áo dài'}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerSub}>{display.label}</Text>
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
            <BookingFlowStepper
              bookingType={order.bookingType || (isRental ? 'AODAI_RENTAL' : 'PHOTOGRAPHY')}
              status={status}
              booking={order}
              variant="provider"
            />

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
                      <Text style={styles.vipTagText}>KHÁCH</Text>
                    </View>
                  </View>
                  <Text style={styles.custPhone}>
                    {customerPhone || 'Liên hệ qua tin nhắn'}
                  </Text>
                  {customerEmail && (
                    <Text style={styles.custEmail}>{customerEmail}</Text>
                  )}
                </View>

                <View style={styles.custActions}>
                  {customerPhone ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.contactBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleCall}
                    >
                      <Ionicons name="call-outline" size={16} color="#111418" />
                    </Pressable>
                  ) : null}

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

            {/* Studio Owner Staff Dispatch & Chat Supervision */}
            <OrderStaffAssignmentSection
              order={order}
              onOrderUpdated={onOrderUpdated}
            />

            {/* All Item Details Box */}
            <View style={styles.cardBox}>
              <Text style={styles.sectionHeading}>
                HIỆN VẬT & DỊCH VỤ ({allItems.length})
              </Text>
              <View style={{ gap: 12 }}>
                {(allItems.length > 0 ? allItems : [firstItem]).map((it: any, idx: number) => {
                  const isPhotoItem = isPhotographyItem(it);
                  const itName =
                    it.name ||
                    it.productName ||
                    it.productId?.name ||
                    it.photographyPackageId?.name ||
                    it.packageSnapshot?.name ||
                    (isPhotoItem ? 'Gói Chụp Ảnh' : 'Áo Dài Cổ Phục');
                  const itImg =
                    it.productId?.images?.[0] ||
                    it.photographyPackageId?.images?.[0] ||
                    it.images?.[0] ||
                    it.image ||
                    (isPhotoItem ? '/partner_cover.jpg' : '/hong_lien_hoa.webp');
                  const sku = !isPhotoItem ? getItemSkuOrCode(it) : null;
                  const itStage = !isPhotoItem
                    ? resolveRentalItemStage(order, it)
                    : null;
                  const itDisplay =
                    !isPhotoItem && itStage
                      ? resolveBookingDisplayState({ ...order, items: [it] }, 'provider')
                      : null;
                  const invLabel =
                    !isPhotoItem && it.rentalFulfillment?.inventoryStatus
                      ? INV_STATUS_LABEL[it.rentalFulfillment.inventoryStatus] ||
                        it.rentalFulfillment.inventoryStatus
                      : null;
                  const itemPickupFiles: string[] = Array.isArray(
                    it.rentalFulfillment?.pickupEvidence?.files,
                  )
                    ? it.rentalFulfillment.pickupEvidence.files
                    : [];
                  const itemReturnFiles: string[] = Array.isArray(
                    it.rentalFulfillment?.customerReturnEvidence?.files,
                  )
                    ? it.rentalFulfillment.customerReturnEvidence.files
                    : [];

                  return (
                    <View
                      key={it._id || idx}
                      style={[
                        styles.itemDetailBlock,
                        idx > 0 && styles.itemDetailBlockDivider,
                      ]}
                    >
                      <View style={styles.itemDetailCard}>
                        <Image
                          source={getMediaUrl(itImg)}
                          style={styles.itemThumb}
                        />
                        <View style={styles.itemTextCol}>
                          <Text style={styles.itemTitle}>{itName}</Text>
                          {!isPhotoItem ? (
                            <View style={styles.itemMetaRow}>
                              {it.selectedSize || it.size ? (
                                <Text style={styles.metaBadge}>
                                  Size {it.selectedSize || it.size}
                                </Text>
                              ) : null}
                              {it.selectedColor || it.color ? (
                                <>
                                  <Text style={styles.metaDot}>•</Text>
                                  <Text style={styles.metaBadge}>
                                    {it.selectedColor || it.color}
                                  </Text>
                                </>
                              ) : null}
                              {sku ? (
                                <>
                                  <Text style={styles.metaDot}>•</Text>
                                  <Text style={styles.metaTag}>{sku}</Text>
                                </>
                              ) : null}
                            </View>
                          ) : (
                            <Text style={styles.locationNote}>
                              {it.shootDate ? `${formatDate(it.shootDate)} · ` : ''}
                              {it.shootTimeSlot || 'Theo khung giờ đặt'}
                            </Text>
                          )}

                          <Text style={styles.locationNote}>
                            {isPhotoItem
                              ? `Điểm hẹn chụp: ${it.shootLocation || spotAddress}`
                              : it.rentalFrom && it.rentalTo
                                ? `Thuê: ${formatDate(it.rentalFrom)} → ${formatDate(it.rentalTo)}`
                                : `Điểm nhận/trả đồ: ${spotAddress}`}
                          </Text>

                          {itDisplay && (
                            <View style={styles.itemStageBadgeRow}>
                              <View style={styles.itemStagePill}>
                                <Text style={styles.itemStagePillText}>
                                  {itDisplay.label}
                                </Text>
                              </View>
                              {invLabel && (
                                <Text style={styles.itemInvStatusText}>
                                  Kho: {invLabel}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      </View>

                      {itemPickupFiles.length > 0 && (
                        <View style={styles.itemEvidenceStrip}>
                          <Text style={styles.itemEvidenceLabel}>
                            Ảnh bàn giao tiệm đã gửi ({itemPickupFiles.length}):
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.handoverGalleryRow}
                          >
                            {itemPickupFiles.map((fileId, fIdx) => (
                              <AuthorizedEvidenceImage
                                key={`${fileId}-${fIdx}`}
                                bookingId={order._id}
                                itemId={it._id}
                                fileOrUrl={fileId}
                                style={styles.handoverPhotoThumb}
                              />
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {itemReturnFiles.length > 0 && (
                        <View style={styles.itemEvidenceStrip}>
                          <Text style={styles.itemEvidenceLabel}>
                            Ảnh hiện trạng lúc khách trả ({itemReturnFiles.length}):
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.handoverGalleryRow}
                          >
                            {itemReturnFiles.map((fileId, fIdx) => (
                              <AuthorizedEvidenceImage
                                key={`${fileId}-${fIdx}`}
                                bookingId={order._id}
                                itemId={it._id}
                                fileOrUrl={fileId}
                                style={styles.handoverPhotoThumb}
                              />
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {!isPhotoItem && it.isMyItem !== false && onRentalAction && (
                        <>
                          {itStage === 'PREPARING' && (
                            <Pressable
                              style={styles.inlineItemBtn}
                              onPress={() => onRentalAction(order, 'READY', it._id)}
                              disabled={actionLoading}
                            >
                              <Ionicons name="shirt-outline" size={14} color="#BA0049" />
                              <Text style={styles.inlineItemBtnText}>
                                Xác nhận đã soạn xong áo này
                              </Text>
                            </Pressable>
                          )}
                          {itStage === 'READY_NEEDS_HANDOVER_PHOTOS' && (
                            <Pressable
                              style={styles.inlineItemBtn}
                              onPress={() => onRentalAction(order, 'HANDOVER', it._id)}
                              disabled={actionLoading}
                            >
                              <Ionicons name="camera-outline" size={14} color="#BA0049" />
                              <Text style={styles.inlineItemBtnText}>
                                Tải ảnh bàn giao cho áo này
                              </Text>
                            </Pressable>
                          )}
                          {itStage === 'CUSTOMER_RETURN_REQUESTED' && (
                            <Pressable
                              style={styles.inlineItemBtn}
                              onPress={() => onRentalAction(order, 'RETURNED', it._id)}
                              disabled={actionLoading}
                            >
                              <Ionicons name="checkmark-done" size={14} color="#059669" />
                              <Text style={[styles.inlineItemBtnText, { color: '#059669' }]}>
                                Xác nhận đã nhận lại áo này
                              </Text>
                            </Pressable>
                          )}
                          {itStage === 'RETURNED_NEEDS_INSPECTION' && (
                            <Pressable
                              style={styles.inlineItemBtn}
                              onPress={() =>
                                onRentalAction(order, 'CONFIRM_NO_INCIDENT', it._id)
                              }
                              disabled={actionLoading}
                            >
                              <Ionicons name="cash-outline" size={14} color="#059669" />
                              <Text style={[styles.inlineItemBtnText, { color: '#059669' }]}>
                                Không sự cố & Hoàn cọc
                              </Text>
                            </Pressable>
                          )}
                          {itStage === 'CLEANING_AFTER_REFUND' && (
                            <Pressable
                              style={styles.inlineItemBtn}
                              onPress={() =>
                                onRentalAction(order, 'CLEANING_COMPLETED', it._id)
                              }
                              disabled={actionLoading}
                            >
                              <Ionicons name="sparkles-outline" size={14} color="#059669" />
                              <Text style={[styles.inlineItemBtnText, { color: '#059669' }]}>
                                Hoàn tất giặt ủi & Mở kho
                              </Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
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

                {(() => {
                  const totalPaid = Number(order.paymentSummary?.totalPaid ?? 0);
                  const isUnpaid =
                    (status === 'PENDING_PAYMENT' || status === 'DRAFT') && totalPaid <= 0;
                  const isCancelledOrRefunded = [
                    'CANCELLED',
                    'REFUNDED',
                    'PARTIALLY_REFUNDED',
                  ].includes(status);

                  if (isUnpaid) {
                    return (
                      <View style={[styles.paidBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="time-outline" size={13} color="#B45309" />
                        <Text style={[styles.paidBadgeText, { color: '#B45309' }]}>
                          Chờ khách ký hợp đồng & thanh toán qua PayOS
                        </Text>
                      </View>
                    );
                  }
                  if (isCancelledOrRefunded) {
                    return (
                      <View style={[styles.paidBadge, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="information-circle-outline" size={13} color="#475569" />
                        <Text style={[styles.paidBadgeText, { color: '#475569' }]}>
                          {display.label}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View style={styles.paidBadge}>
                      <Ionicons name="checkmark-circle" size={13} color="#047857" />
                      <Text style={styles.paidBadgeText}>
                        {totalPaid > 0
                          ? `Đã thanh toán ${totalPaid.toLocaleString('vi-VN')}đ qua PayOS / VietQR`
                          : 'Đã thanh toán an toàn qua PayOS / VietQR'}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* Handover photos preview if uploaded */}
            {Array.isArray(order.handoverPhotos) &&
              order.handoverPhotos.filter(Boolean).length > 0 && (
                <View style={styles.cardBox}>
                  <Text style={styles.sectionHeading}>
                    ẢNH BÀN GIAO HIỆN TRẠNG ({order.handoverPhotos.filter(Boolean).length})
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.handoverGalleryRow}
                  >
                    {order.handoverPhotos
                      .filter(Boolean)
                      .map((uri: string, idx: number) => (
                        <Image
                          key={`${uri}-${idx}`}
                          source={getMediaUrl(uri)}
                          style={styles.handoverPhotoThumb}
                          contentFit="cover"
                        />
                      ))}
                  </ScrollView>
                </View>
              )}

            {/* E-Contract V2 Read-only view for Provider */}
            {(isRental || order.contractFlowVersion === 2) && order._id && (
              <BookingContractsSection
                bookingId={order._id}
                bookingStatus={status}
                contractFlowVersion={order.contractFlowVersion}
                viewerRole="provider"
                onRequestOpenDetail={setActiveContractDetail}
                onRequestOpenPdf={setActiveContractPdf}
              />
            )}
          </ScrollView>

          {/* Bottom Sticky Action Bar (100% synced with RentalFulfillmentController) */}
          <View style={styles.bottomBar}>
            {stage === 'DEPOSIT_PAID' && (
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
                  onPress={() => onAction(order, 'CONFIRMED')}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {isPhotoshootOnly ? 'Chấp nhận lịch chụp' : 'Xác nhận & Chuẩn bị'}
                  </Text>
                </Pressable>
              </View>
            )}

            {stage === 'PREPARING' && (
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
                    if (!isPhotoshootOnly && onRentalAction) {
                      onRentalAction(order, 'READY', targetRentalItemId);
                    } else {
                      onAction(order, 'IN_PROGRESS');
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons
                    name={isPhotoshootOnly ? 'play-circle-outline' : 'shirt-outline'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primaryBtnText}>
                    {isPhotoshootOnly ? 'Bắt đầu buổi chụp' : 'Sẵn sàng giao đồ'}
                  </Text>
                </Pressable>
              </View>
            )}

            {stage === 'READY_NEEDS_HANDOVER_PHOTOS' && (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtnFull,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (onRentalAction) {
                    onRentalAction(order, 'HANDOVER', targetRentalItemId);
                  } else if (onOpenWorkflowModal) {
                    onClose();
                    onOpenWorkflowModal(order, 'HANDOVER', targetRentalItemId);
                  }
                }}
                disabled={actionLoading}
              >
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Bàn giao áo (Tải ảnh hiện trạng)</Text>
              </Pressable>
            )}

            {stage === 'HANDOVER_AWAITING_CUSTOMER' && (
              <View style={styles.completedNotice}>
                <Ionicons name="time-outline" size={18} color="#B45309" />
                <Text style={[styles.completedNoticeText, { color: '#B45309', flex: 1 }]}>
                  Đã gửi ảnh bàn giao · Đang chờ khách hàng kiểm tra & xác nhận nhận đồ
                </Text>
              </View>
            )}

            {stage === 'IN_RENTAL' &&
              (isCombo && !order.photosApproved && myPhotoItems.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtnFull,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onAction(order, 'IN_PROGRESS')}
                  disabled={actionLoading}
                >
                  <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Bắt đầu buổi chụp Combo</Text>
                </Pressable>
              ) : (
                <View style={styles.completedNotice}>
                  <Ionicons name="bag-check-outline" size={18} color="#047857" />
                  <Text style={[styles.completedNoticeText, { flex: 1 }]}>
                    Khách đang thuê cổ phục · Hệ thống sẽ thông báo khi khách gửi yêu cầu trả đồ
                  </Text>
                </View>
              ))}

            {stage === 'IN_PROGRESS' && (
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

            {stage === 'CUSTOMER_RETURN_REQUESTED' && (
              <View style={styles.actionBtnGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.secondaryBtnText}>Đóng</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: '#059669' },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (onRentalAction) {
                      onRentalAction(order, 'RETURNED', targetRentalItemId);
                    } else {
                      onAction(order, 'RETURNED');
                    }
                  }}
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
                      <Text style={styles.primaryBtnText}>Xác nhận đã nhận lại áo</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {stage === 'RETURNED_NEEDS_INSPECTION' && (
              <View style={styles.actionBtnGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryDangerBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (onOpenWorkflowModal) {
                      onClose();
                      onOpenWorkflowModal(order, 'REPORT_INCIDENT', targetRentalItemId);
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
                    } else if (onRentalAction) {
                      onRentalAction(order, 'CONFIRM_NO_INCIDENT', targetRentalItemId);
                    }
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Không sự cố · Hoàn cọc</Text>
                </Pressable>
              </View>
            )}

            {stage === 'CLEANING_AFTER_REFUND' && (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtnFull,
                  { backgroundColor: '#059669' },
                  pressed && styles.pressed,
                ]}
                onPress={() => onRentalAction?.(order, 'CLEANING_COMPLETED', targetRentalItemId)}
                disabled={actionLoading}
              >
                <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Hoàn tất giặt ủi & Mở kho</Text>
              </Pressable>
            )}

            {(stage === 'INCIDENT_PENDING_CUSTOMER' ||
              stage === 'AWAITING_REVIEW' ||
              stage === 'COMBO_PHOTOS_APPROVED' ||
              stage === 'PENDING_PAYMENT' ||
              stage === 'DISPUTED') && (
              <View style={styles.completedNotice}>
                <Ionicons
                  name={
                    stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED'
                      ? 'alert-circle-outline'
                      : 'time-outline'
                  }
                  size={18}
                  color={
                    stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED'
                      ? '#DC2626'
                      : '#B45309'
                  }
                />
                <Text
                  style={[
                    styles.completedNoticeText,
                    {
                      color:
                        stage === 'INCIDENT_PENDING_CUSTOMER' || stage === 'DISPUTED'
                          ? '#DC2626'
                          : '#B45309',
                      flex: 1,
                    },
                  ]}
                >
                  {display.nextStepText}
                </Text>
              </View>
            )}

            {stage === 'COMPLETED' && (
              <View style={styles.completedNotice}>
                <Ionicons name="checkmark-circle" size={18} color="#047857" />
                <Text style={styles.completedNoticeText}>
                  Đơn hàng đã hoàn tất · Tiền cọc đã được giải ngân an toàn
                </Text>
              </View>
            )}

            {(stage === 'CANCELLED' ||
              stage === 'REFUNDED' ||
              stage === 'PARTIALLY_REFUNDED') && (
              <View style={styles.completedNotice}>
                <Ionicons name="close-circle-outline" size={18} color="#64748B" />
                <Text style={[styles.completedNoticeText, { color: '#64748B' }]}>
                  {display.label}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      </Modal>

      <ContractDetailModal
        visible={visible && Boolean(activeContractDetail)}
        contractId={activeContractDetail?.contractId ?? null}
        versionId={activeContractDetail?.versionId ?? null}
        onClose={() => setActiveContractDetail(null)}
      />

      <ContractPdfModal
        visible={visible && Boolean(activeContractPdf)}
        contractId={activeContractPdf?.contractId ?? null}
        versionId={activeContractPdf?.versionId ?? null}
        contractCode={activeContractPdf?.contractCode}
        onClose={() => setActiveContractPdf(null)}
      />
    </>
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
  handoverGalleryRow: {
    gap: 8,
    paddingTop: 4,
  },
  handoverPhotoThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  itemDetailBlock: {
    gap: 8,
  },
  itemDetailBlockDivider: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  itemStageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  itemStagePill: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  itemStagePillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
  },
  itemInvStatusText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#475569',
  },
  itemEvidenceStrip: {
    marginTop: 4,
    gap: 4,
  },
  itemEvidenceLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#334155',
  },
  inlineItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlineItemBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
  },
});
