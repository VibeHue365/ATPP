import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateSelector } from '@/components/product/DateSelector';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import type { CartItem } from '@/types/cart';
import { getMediaUrl } from '@/utils/media';

const money = (value = 0) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

const COMMON_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const COLOR_MAP: Record<string, { name: string; hex: string; border?: string }> = {
  RED: { name: 'Đỏ Cố Đô', hex: '#BA0049' },
  PINK: { name: 'Hồng phấn', hex: '#F472B6' },
  GOLD: { name: 'Vàng kim', hex: '#D97706' },
  WHITE: { name: 'Trắng ngà', hex: '#FAFAFA', border: '#D1D5DB' },
  BLACK: { name: 'Đen tuyền', hex: '#1F2937' },
  BLUE: { name: 'Xanh lam', hex: '#2563EB' },
  GREEN: { name: 'Xanh ngọc', hex: '#059669' },
  YELLOW: { name: 'Vàng tươi', hex: '#EAB308' },
  PURPLE: { name: 'Tím Huế', hex: '#7C3AED' },
  ORANGE: { name: 'Cam đất', hex: '#EA580C' },
  'ĐỎ CUNG ĐÌNH': { name: 'Đỏ cung đình', hex: '#BA0049' },
  'VÀNG HOÀNG GIA': { name: 'Vàng hoàng gia', hex: '#D97706' },
  'TRẮNG NGỌC': { name: 'Trắng ngọc', hex: '#FAFAFA', border: '#D1D5DB' },
  'HỒNG ĐÀO': { name: 'Hồng đào', hex: '#F472B6' },
  'XANH CỔ VỊT': { name: 'Xanh cổ vịt', hex: '#005F73' },
};

function formatColorMeta(raw?: string | null): { name: string; hex: string; border?: string } {
  if (!raw) return { name: 'Tiêu chuẩn', hex: '#BA0049' };
  const key = raw.trim().toUpperCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  return { name: raw, hex: '#BA0049' };
}

function formatRentalDates(from?: string | null, to?: string | null, rentalType?: string | null) {
  if (rentalType === 'HOURLY') {
    if (!from) return 'Thuê theo giờ trong ngày';
    const parts = from.split('-');
    const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : from;
    return `${dateFormatted} · Thuê theo giờ`;
  }
  if (!from) return 'Chưa chọn ngày';
  const fParts = from.split('-');
  const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}` : from;
  if (!to || to === from) {
    const year = fParts.length === 3 ? `/${fParts[0]}` : '';
    return `${fDisplay}${year} (1 ngày)`;
  }
  const tParts = to.split('-');
  const tDisplay = tParts.length === 3 ? `${tParts[2]}/${tParts[1]}/${tParts[0]}` : to;
  const d1 = new Date(`${from}T00:00:00`).getTime();
  const d2 = new Date(`${to}T00:00:00`).getTime();
  const days = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
  return `${fDisplay} – ${tDisplay} (${days} ngày)`;
}

const HERITAGE_LOCATIONS = [
  'Đại Nội Huế',
  'Lăng Khải Định',
  'Chùa Thiên Mụ',
  'Cung An Định',
  'Cầu Tràng Tiền',
  'Phố cổ Hội An',
];

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, ready, removeItem, updateItem } = useCart();
  const { show } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Inline Edit Modal state
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editSize, setEditSize] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editLocation, setEditLocation] = useState('');

  useEffect(() => {
    setSelectedIds((current) =>
      items.map((item) => item.id).filter((id) => current.length === 0 || current.includes(id))
    );
  }, [items]);

  const selected = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const rentalItems = selected.filter((item) => item.itemType === 'PRODUCT');
  const photoItems = selected.filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE');

  const rentalFee = rentalItems.reduce(
    (sum, item) => sum + (item.basePrice ?? 0) * item.quantity,
    0
  );
  const refundableDeposit = rentalItems.reduce(
    (sum, item) => sum + (item.depositAmount ?? 0) * item.quantity,
    0
  );
  const photographyFee = photoItems.reduce(
    (sum, item) => sum + (item.basePrice ?? 0) * item.quantity,
    0
  );

  const comboDiscount =
    photographyFee > 0 && rentalFee > 0 ? Math.round((rentalFee + photographyFee) * 0.1) : 0;
  const total = rentalFee + refundableDeposit + photographyFee - comboDiscount;
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const linkedIds = (item: CartItem) =>
    item.comboId
      ? items.filter((value) => value.comboId === item.comboId).map((value) => value.id)
      : [item.id];

  const toggleItem = (item: CartItem) => {
    const ids = linkedIds(item);
    const active = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      active ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]
    );
  };

  const removeLinked = (item: CartItem) => {
    Alert.alert(
      'Xóa dịch vụ',
      `Bạn có chắc chắn muốn xóa "${item.name ?? 'dịch vụ này'}" khỏi giỏ hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            linkedIds(item).forEach(removeItem);
            show('Đã xóa dịch vụ khỏi giỏ hàng', 'info');
          },
        },
      ]
    );
  };

  const removeSelected = () => {
    if (!selected.length) return;
    Alert.alert(
      'Xóa mục đã chọn',
      `Bạn có chắc muốn xóa ${selected.length} dịch vụ đã chọn khỏi giỏ hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: () => {
            selected.forEach((item) => removeItem(item.id));
            setSelectedIds([]);
            show('Đã xóa các dịch vụ đã chọn', 'info');
          },
        },
      ]
    );
  };

  const openEditModal = (item: CartItem) => {
    setEditingItem(item);
    setEditSize(item.size ?? 'M');
    setEditColor(item.color ?? 'RED');
    setEditFrom(item.rentalFrom ?? '');
    setEditTo(item.rentalTo ?? item.rentalFrom ?? '');
    setEditLocation(item.shootLocation ?? 'Đại Nội Huế');
  };

  const saveEditItem = () => {
    if (!editingItem) return;
    if (editingItem.itemType === 'PRODUCT') {
      if (!editFrom || !editTo) {
        show('Vui lòng chọn ngày nhận và trả áo', 'error');
        return;
      }
      const days = Math.max(
        1,
        Math.round(
          (new Date(`${editTo}T00:00:00`).getTime() - new Date(`${editFrom}T00:00:00`).getTime()) /
            86400000
        ) + 1
      );
      const unitPrice = Number(editingItem.metadata?.unitPrice ?? editingItem.basePrice ?? 0);
      const nextBasePrice =
        editingItem.rentalType === 'HOURLY' ? editingItem.basePrice : unitPrice * days;

      updateItem(editingItem.id, {
        size: editSize,
        color: editColor,
        rentalFrom: editFrom,
        rentalTo: editTo,
        basePrice: nextBasePrice,
        metadata: {
          ...editingItem.metadata,
          rentalDays: days,
        },
      });
      show('Đã cập nhật tùy chọn thuê cổ phục', 'success');
    } else {
      updateItem(editingItem.id, {
        shootLocation: editLocation.trim() || editingItem.shootLocation,
      });
      show('Đã cập nhật địa điểm chụp ảnh', 'success');
    }
    setEditingItem(null);
  };

  const proceed = () => {
    if (!selected.length) return;
    if (selected.filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE').length > 1) {
      show('Vui lòng thanh toán từng gói chụp riêng biệt để đảm bảo giữ chỗ chính xác', 'error');
      return;
    }
    router.push({
      pathname: '/checkout',
      params: { ids: selected.map((item) => item.id).join(',') },
    } as unknown as Href);
  };

  if (!ready) return <LoadingState label="Đang tải giỏ hàng của bạn..." />;

  const hasOnlyAoDai = rentalItems.length > 0 && photoItems.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#1B1C1C" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Giỏ Hàng Dịch Vụ</Text>
          <Text style={styles.headerSub}>
            {items.length > 0 ? `${items.length} dịch vụ · TàGo Cố Đô` : 'TàGo Cố Đô'}
          </Text>
        </View>

        {selected.length > 0 ? (
          <Pressable style={styles.clearBtn} onPress={removeSelected} hitSlop={8}>
            <Ionicons name="trash-outline" size={17} color="#DC2626" />
            <Text style={styles.clearBtnText}>Xóa</Text>
          </Pressable>
        ) : (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{items.length}</Text>
          </View>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={42} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.emptyMessage}>
            Hãy chọn bộ cổ phục ưng ý hoặc gói chụp ảnh di sản để bắt đầu hành trình hóa thân tại Cố đô.
          </Text>
          <Pressable
            style={styles.emptyCtaBtn}
            onPress={() => router.replace('/' as Href)}>
            <Text style={styles.emptyCtaText}>Khám phá cổ phục ngay</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>

          {/* Quick Categories Suggestions */}
          <View style={styles.quickExploreBox}>
            <Text style={styles.quickExploreTitle}>GỢI Ý KHÁM PHÁ NHANH</Text>
            <View style={styles.quickTagsWrap}>
              {['Áo Dài Nhật Bình', 'Áo Tấc Ngũ Thân', 'Gói chụp Hoàng Cung', 'Cổ phục cưới'].map(
                (tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => router.replace('/' as Href)}
                    style={styles.quickTag}>
                    <Ionicons name="sparkles" size={12} color={Colors.primary} />
                    <Text style={styles.quickTagText}>{tag}</Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Promo / Combo Callout Banner */}
            {photographyFee > 0 && rentalFee > 0 ? (
              <View style={styles.comboBanner}>
                <View style={styles.comboBannerLeft}>
                  <View style={styles.comboIconBox}>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comboBannerTitle}>ƯU ĐÃI COMBO ĐÃ KÍCH HOẠT</Text>
                    <Text style={styles.comboBannerDesc}>
                      Tự động giảm ngay 10% khi đặt Cổ phục kèm Gói chụp ảnh di sản (-{money(comboDiscount)})
                    </Text>
                  </View>
                </View>
                <View style={styles.comboTag}>
                  <Text style={styles.comboTagText}>-10%</Text>
                </View>
              </View>
            ) : hasOnlyAoDai ? (
              <Pressable
                style={styles.upsellBanner}
                onPress={() => router.push('/(tabs)/photographers' as Href)}>
                <View style={styles.upsellIconBox}>
                  <Ionicons name="camera" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upsellTitle}>Mẹo tiết kiệm 10% đơn hàng</Text>
                  <Text style={styles.upsellDesc}>
                    Đặt thêm Thợ ảnh Cố Đô để lưu trọn khoảnh khắc và nhận giảm 10% toàn bộ dịch vụ.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D97706" />
              </Pressable>
            ) : null}

            {/* Select All Bar */}
            <View style={styles.selectAllRow}>
              <Pressable
                style={styles.selectAllBtn}
                onPress={() => setSelectedIds(allSelected ? [] : items.map((item) => item.id))}>
                <Check active={allSelected} />
                <Text style={styles.selectAllText}>
                  Chọn tất cả ({items.length} dịch vụ)
                </Text>
              </Pressable>
              <Text style={styles.selectedCountText}>
                Đã chọn: <Text style={{ color: Colors.primary, fontFamily: FontFamily.bodyBold }}>{selected.length}</Text>/{items.length}
              </Text>
            </View>

            {/* Cart Items List */}
            {items.map((item) => (
              <CartRow
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                onToggle={() => toggleItem(item)}
                onRemove={() => removeLinked(item)}
                onEdit={() => openEditModal(item)}
                onQuantity={(quantity) => updateItem(item.id, { quantity })}
              />
            ))}

            {/* TàGo Voucher Box */}
            <View style={styles.voucherBox}>
              <View style={styles.voucherLeft}>
                <View style={styles.voucherIconBox}>
                  <Ionicons name="ticket-outline" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.voucherTitle}>Mã ưu đãi TàGo</Text>
                  <Text style={styles.voucherSub}>
                    {comboDiscount > 0
                      ? 'Đã áp dụng giảm 10% Combo Cổ Đô'
                      : 'Ưu đãi và voucher tự động áp dụng'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.voucherApplyBtn}
                onPress={() =>
                  show(
                    comboDiscount > 0
                      ? 'Ưu đãi Combo -10% tốt nhất đã được kích hoạt!'
                      : 'Hệ thống đã tự động tính mức giá ưu đãi nhất cho bạn.',
                    'info'
                  )
                }>
                <Text style={styles.voucherApplyText}>
                  {comboDiscount > 0 ? 'Đã áp dụng' : 'Xem ưu đãi'}
                </Text>
                <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
              </Pressable>
            </View>

            {/* Pricing Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="receipt-outline" size={18} color="#1B1C1C" />
                <Text style={styles.summaryTitle}>Tóm tắt chi phí dự kiến</Text>
              </View>

              <View style={styles.summaryList}>
                <SummaryRow
                  label={`Tiền thuê cổ phục (${rentalItems.length} bộ)`}
                  value={money(rentalFee)}
                />
                {photographyFee > 0 && (
                  <SummaryRow
                    label={`Gói chụp ảnh di sản (${photoItems.length} gói)`}
                    value={money(photographyFee)}
                  />
                )}
                {comboDiscount > 0 && (
                  <SummaryRow
                    label="Chiết khấu đặt Combo (10%)"
                    value={`-${money(comboDiscount)}`}
                    accent
                  />
                )}
                <View style={styles.depositSummaryRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.summaryLabel}>Tiền cọc giữ đồ</Text>
                      <View style={styles.refundTag}>
                        <Ionicons name="shield-checkmark" size={10} color="#059669" />
                        <Text style={styles.refundTagText}>Hoàn 100% khi trả</Text>
                      </View>
                    </View>
                    <Text style={styles.depositNotice}>
                      Khoản bảo chứng này sẽ hoàn lại đầy đủ ngay sau khi trả áo
                    </Text>
                  </View>
                  <Text style={[styles.summaryValue, { color: '#059669', fontFamily: FontFamily.bodyBold }]}>
                    {money(refundableDeposit)}
                  </Text>
                </View>

                <View style={styles.dashedDivider} />

                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>Tổng cần thanh toán</Text>
                    {refundableDeposit > 0 && (
                      <Text style={styles.totalDepositSub}>
                        (Gồm {money(refundableDeposit)} tiền cọc hoàn lại)
                      </Text>
                    )}
                  </View>
                  <Text style={styles.totalValue}>{money(total)}</Text>
                </View>
              </View>

              {/* Peace of Mind Guarantee Banner */}
              <View style={styles.guaranteeBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guaranteeTitle}>Cam kết an tâm từ TàGo</Text>
                  <Text style={styles.guaranteeDesc}>
                    • Hoàn trả 100% tiền cọc ngay khi tiệm nhận và đối soát trang phục.{'\n'}
                    • Hỗ trợ thử và chỉnh sửa bóp nới nhẹ số đo miễn phí tại tiệm khi nhận đồ.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Checkout Bar */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomLabel}>
                Tổng thanh toán ({selected.length} dịch vụ):
              </Text>
              <Text style={styles.bottomTotal}>{money(total)}</Text>
              {refundableDeposit > 0 && (
                <Text style={styles.bottomDepositNote}>
                  Đã gồm cọc: {money(refundableDeposit)}
                </Text>
              )}
            </View>

            <Pressable
              disabled={!selected.length}
              onPress={proceed}
              style={[styles.checkoutBtn, !selected.length && styles.checkoutDisabled]}>
              <Text style={styles.checkoutBtnText}>
                Tiếp tục thanh toán ({selected.length})
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </>
      )}

      {/* Inline Edit Cart Item Modal */}
      <Modal
        visible={Boolean(editingItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>CHỈNH SỬA TÙY CHỌN DỊCH VỤ</Text>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {editingItem?.name}
                </Text>
              </View>
              <Pressable onPress={() => setEditingItem(null)} style={styles.modalCloseBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color="#1B1C1C" />
              </Pressable>
            </View>

            {editingItem?.itemType === 'PRODUCT' ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
                {/* Size Selection */}
                <View>
                  <Text style={styles.modalSectionLabel}>KÍCH CỠ (SIZE)</Text>
                  <View style={styles.chipRow}>
                    {COMMON_SIZES.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setEditSize(s)}
                        style={[styles.sizeChip, editSize === s && styles.sizeChipActive]}>
                        <Text style={[styles.sizeChipText, editSize === s && styles.sizeChipTextActive]}>
                          Size {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Color Selection with Color Swatches */}
                <View>
                  <Text style={styles.modalSectionLabel}>MÀU SẮC TRANG PHỤC</Text>
                  <View style={styles.colorChipRow}>
                    {Object.entries(COLOR_MAP)
                      .slice(0, 7)
                      .map(([key, meta]) => {
                        const isChosen = editColor.toUpperCase() === key;
                        return (
                          <Pressable
                            key={key}
                            onPress={() => setEditColor(key)}
                            style={[styles.colorChip, isChosen && styles.colorChipActive]}>
                            <View
                              style={[
                                styles.colorDot,
                                { backgroundColor: meta.hex },
                                meta.border ? { borderWidth: 1, borderColor: meta.border } : null,
                              ]}
                            />
                            <Text
                              style={[
                                styles.colorChipText,
                                isChosen && styles.colorChipTextActive,
                              ]}>
                              {meta.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>

                {/* Rental Date Range */}
                <View>
                  <Text style={styles.modalSectionLabel}>THỜI GIAN NHẬN & TRẢ CỔ PHỤC</Text>
                  <DateSelector
                    start={editFrom}
                    end={editTo}
                    onChange={(a, b) => {
                      setEditFrom(a);
                      setEditTo(b || a);
                    }}
                  />
                </View>

                <AppButton title="Lưu thay đổi tùy chọn" onPress={saveEditItem} />
              </ScrollView>
            ) : (
              <View style={{ gap: 16, paddingBottom: 24 }}>
                <View>
                  <Text style={styles.modalSectionLabel}>ĐỊA ĐIỂM CHỤP ẢNH TẠI CỐ ĐÔ</Text>
                  <TextInput
                    value={editLocation}
                    onChangeText={setEditLocation}
                    placeholder="Nhập địa điểm hẹn chụp..."
                    style={styles.modalTextInput}
                  />
                </View>

                <View>
                  <Text style={styles.modalSubLabel}>Gợi ý địa điểm danh thắng đẹp:</Text>
                  <View style={styles.locationTagRow}>
                    {HERITAGE_LOCATIONS.map((loc) => (
                      <Pressable
                        key={loc}
                        onPress={() => setEditLocation(loc)}
                        style={[
                          styles.locationTag,
                          editLocation === loc && styles.locationTagActive,
                        ]}>
                        <Ionicons
                          name="location-sharp"
                          size={11}
                          color={editLocation === loc ? '#FFFFFF' : Colors.primary}
                        />
                        <Text
                          style={[
                            styles.locationTagText,
                            editLocation === loc && styles.locationTagTextActive,
                          ]}>
                          {loc}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <AppButton title="Cập nhật địa điểm chụp" onPress={saveEditItem} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// Cart Row Item Component
// -------------------------------------------------------------
function CartRow({
  item,
  selected,
  onToggle,
  onRemove,
  onEdit,
  onQuantity,
}: {
  item: CartItem;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onQuantity: (value: number) => void;
}) {
  const photo = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const colorMeta = formatColorMeta(item.color);
  const rentalDateText = photo
    ? `${item.shootDate ?? 'Chưa hẹn'} · ${item.shootTimeSlot ?? 'Ca chụp linh hoạt'}`
    : formatRentalDates(item.rentalFrom, item.rentalTo, item.rentalType);

  const shopName =
    (item.metadata?.shopName as string) ||
    (item.metadata?.storeName as string) ||
    (photo ? 'Huế Studio Nhiếp Ảnh' : 'Tiệm Cổ Phục Huế');

  return (
    <View style={styles.card}>
      {/* Shop Row Header */}
      <View style={styles.cardShopHeader}>
        <View style={styles.shopLeft}>
          <Ionicons name="storefront-outline" size={13} color="#8F8E8E" />
          <Text style={styles.shopName} numberOfLines={1}>
            {shopName}
          </Text>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={10} color="#059669" />
            <Text style={styles.verifiedText}>Đã xác minh</Text>
          </View>
        </View>

        <View style={styles.cardHeaderActions}>
          <Pressable onPress={onEdit} hitSlop={8} style={styles.cardEditBtn}>
            <Ionicons name="pencil" size={12} color={Colors.primary} />
            <Text style={styles.cardEditBtnText}>Sửa</Text>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={8} style={styles.cardDeleteBtn}>
            <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.cardDivider} />

      {/* Main Item Row */}
      <View style={styles.cardMainRow}>
        {/* Checkbox */}
        <Pressable onPress={onToggle} style={styles.cardCheckWrap} hitSlop={6}>
          <Check active={selected} />
        </Pressable>

        {/* Thumbnail Image */}
        <View style={styles.imageWrap}>
          <Image
            source={getMediaUrl(item.image)}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.itemTypeBadge}>
            <Text style={styles.itemTypeBadgeText}>
              {photo ? 'THỢ ẢNH' : 'CỔ PHỤC'}
            </Text>
          </View>
        </View>

        {/* Item Details */}
        <View style={styles.itemBody}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Specs / Variant Pill */}
          {!photo ? (
            <Pressable onPress={onEdit} style={styles.variantPill} hitSlop={4}>
              <View
                style={[
                  styles.variantDot,
                  { backgroundColor: colorMeta.hex },
                  colorMeta.border ? { borderWidth: 1, borderColor: colorMeta.border } : null,
                ]}
              />
              <Text style={styles.variantText} numberOfLines={1}>
                {colorMeta.name} · Size {item.size ?? 'M'}
              </Text>
              <Ionicons name="chevron-down" size={11} color="#5F5E5E" />
            </Pressable>
          ) : (
            <View style={styles.locationPill}>
              <Ionicons name="location-outline" size={11} color={Colors.primary} />
              <Text style={styles.locationPillText} numberOfLines={1}>
                {item.shootLocation || 'Huế'}
              </Text>
            </View>
          )}

          {/* Rental / Shoot Date Line */}
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={11} color={Colors.primary} />
            <Text style={styles.dateText} numberOfLines={1}>
              {rentalDateText}
            </Text>
          </View>

          {/* Price & Stepper Row */}
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceText}>{money(item.basePrice)}</Text>
              {!photo && (item.depositAmount ?? 0) > 0 ? (
                <View style={styles.depositPill}>
                  <Ionicons name="shield-checkmark" size={9} color="#059669" />
                  <Text style={styles.depositPillText}>
                    Cọc {money(item.depositAmount)} (hoàn 100%)
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Quantity Stepper */}
            {!photo && (
              <View style={styles.quantityBox}>
                <Pressable
                  disabled={item.quantity <= 1}
                  onPress={() => onQuantity(Math.max(1, item.quantity - 1))}
                  style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnDisabled]}
                  hitSlop={4}>
                  <Ionicons
                    name="remove"
                    size={13}
                    color={item.quantity <= 1 ? '#D1D5DB' : Colors.primary}
                  />
                </Pressable>
                <Text style={styles.quantityNum}>{item.quantity}</Text>
                <Pressable
                  onPress={() => onQuantity(item.quantity + 1)}
                  style={styles.qtyBtn}
                  hitSlop={4}>
                  <Ionicons name="add" size={13} color={Colors.primary} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Complimentary Perks Footer Bar */}
      <View style={styles.cardPerksBar}>
        <Ionicons name="sparkles" size={11} color="#D97706" />
        <Text style={styles.cardPerksText}>
          {photo
            ? 'Tặng 100% file ảnh gốc & 20 ảnh hậu kỳ chuyên sâu'
            : 'Miễn phí mấn, guốc mộc & hỗ trợ bóp nới nhẹ số đo tại tiệm'}
        </Text>
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// Checkbox Component
// -------------------------------------------------------------
function Check({ active }: { active: boolean }) {
  return (
    <View style={[styles.checkCircle, active && styles.checkCircleActive]}>
      {active && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
    </View>
  );
}

// -------------------------------------------------------------
// Summary Row Component
// -------------------------------------------------------------
function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.accentValue]}>{value}</Text>
    </View>
  );
}

// -------------------------------------------------------------
// Styles
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F6' },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FAF8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1B1C1C',
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8F8E8E',
    marginTop: 1,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: Colors.primary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  clearBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#DC2626',
  },
  content: {
    padding: 14,
    paddingBottom: 135,
    gap: 12,
  },

  // Banner styles
  comboBanner: {
    backgroundColor: '#FFF0F3',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  comboBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  comboIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboBannerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: Colors.primary,
  },
  comboBannerDesc: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    lineHeight: 14,
    color: '#8A0035',
    marginTop: 1,
  },
  comboTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comboTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },

  upsellBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upsellIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#92400E',
  },
  upsellDesc: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#B45309',
    marginTop: 1,
  },

  // Select all row
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectAllText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  selectedCountText: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
  },

  // Checkbox
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  // Item Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    padding: 12,
    ...Shadow,
  },
  cardShopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  shopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  shopName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
    maxWidth: 160,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    color: '#059669',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cardEditBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
  },
  cardDeleteBtn: {
    padding: 3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F0EF',
    marginBottom: 10,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardCheckWrap: {
    paddingTop: 36,
  },
  imageWrap: {
    position: 'relative',
    width: 82,
    height: 106,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FAF5F5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemTypeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(27,28,28,0.78)',
    borderRadius: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  itemTypeBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14.5,
    lineHeight: 19,
    color: '#1B1C1C',
  },
  variantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 1,
  },
  variantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  variantText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    color: '#4B5563',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 1,
  },
  locationPillText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    color: Colors.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    color: '#5F5E5E',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceText: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: Colors.primary,
  },
  depositPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  depositPillText: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#059669',
  },
  quantityBox: {
    height: 30,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 999,
    backgroundColor: '#FAFAF9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  quantityNum: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
    minWidth: 14,
    textAlign: 'center',
  },
  cardPerksBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F7F5F4',
  },
  cardPerksText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8A5A1C',
  },

  // Voucher box
  voucherBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voucherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  voucherIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  voucherSub: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8F8E8E',
    marginTop: 1,
  },
  voucherApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  voucherApplyText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },

  // Summary card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFECEB',
    padding: 16,
    ...Shadow,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  summaryTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1B1C1C',
  },
  summaryList: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F5E5E',
  },
  summaryValue: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  accentValue: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyBold,
  },
  depositSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginTop: 2,
  },
  refundTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  refundTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#059669',
  },
  depositNotice: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#047857',
    marginTop: 3,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#1B1C1C',
  },
  totalDepositSub: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8F8E8E',
    marginTop: 2,
  },
  totalValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: Colors.primary,
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 14,
    padding: 11,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  guaranteeTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#92400E',
    marginBottom: 2,
  },
  guaranteeDesc: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#B45309',
  },

  // Bottom Checkout Bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadow,
  },
  bottomInfo: {
    flex: 1,
  },
  bottomLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
  },
  bottomTotal: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: Colors.primary,
    marginTop: 1,
  },
  bottomDepositNote: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#059669',
  },
  checkoutBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  checkoutDisabled: {
    opacity: 0.45,
  },
  checkoutBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#1B1C1C',
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#5F5E5E',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 8,
  },
  emptyCtaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  quickExploreBox: {
    marginTop: 28,
    width: '100%',
    alignItems: 'center',
  },
  quickExploreTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: '#8F8E8E',
    marginBottom: 10,
  },
  quickTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  quickTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  quickTagText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#1B1C1C',
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,28,28,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  modalEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: Colors.primary,
  },
  modalTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: '#1B1C1C',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#5F5E5E',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAF8F8',
  },
  sizeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizeChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  sizeChipTextActive: {
    color: '#FFFFFF',
  },
  colorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAF8F8',
  },
  colorChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorChipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#1B1C1C',
  },
  colorChipTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  modalTextInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAF8F8',
    paddingHorizontal: 12,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#1B1C1C',
  },
  modalSubLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
    marginBottom: 8,
  },
  locationTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FAF8F8',
  },
  locationTagActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  locationTagText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#1B1C1C',
  },
  locationTagTextActive: {
    color: '#FFFFFF',
  },
});
