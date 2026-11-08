import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
const COMMON_COLORS = ['Đỏ cung đình', 'Vàng hoàng gia', 'Trắng ngọc', 'Hồng đào', 'Xanh cổ vịt'];

export default function CartScreen() {
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
  const rentalFee = selected
    .filter((item) => item.itemType === 'PRODUCT')
    .reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
  const refundableDeposit = selected
    .filter((item) => item.itemType === 'PRODUCT')
    .reduce((sum, item) => sum + (item.depositAmount ?? 0) * item.quantity, 0);
  const photographyFee = selected
    .filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE')
    .reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
  const comboDiscount =
    photographyFee > 0 && rentalFee > 0 ? Math.round((rentalFee + photographyFee) * 0.1) : 0;
  const total = rentalFee + refundableDeposit + photographyFee - comboDiscount;
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const linkedIds = (item: CartItem) =>
    item.comboId ? items.filter((value) => value.comboId === item.comboId).map((value) => value.id) : [item.id];

  const toggleItem = (item: CartItem) => {
    const ids = linkedIds(item);
    const active = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      active ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]
    );
  };

  const removeLinked = (item: CartItem) => {
    linkedIds(item).forEach(removeItem);
    show('Đã xóa dịch vụ khỏi giỏ hàng', 'info');
  };

  const openEditModal = (item: CartItem) => {
    setEditingItem(item);
    setEditSize(item.size ?? 'M');
    setEditColor(item.color ?? '');
    setEditFrom(item.rentalFrom ?? '');
    setEditTo(item.rentalTo ?? item.rentalFrom ?? '');
    setEditLocation(item.shootLocation ?? '');
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
      show('Đã cập nhật địa điểm chụp', 'success');
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.brand}>TàGo</Text>
          <Text style={styles.headerTitle}>GIỎ HÀNG DỊCH VỤ</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            title="Giỏ hàng đang trống"
            message="Hãy chọn bộ cổ phục ưng ý hoặc gói chụp ảnh di sản để bắt đầu hành trình tại Cố đô."
          />
          <AppButton title="Khám phá dịch vụ ngay" onPress={() => router.replace('/' as Href)} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.topActionRow}>
              <Pressable
                style={styles.selectAll}
                onPress={() => setSelectedIds(allSelected ? [] : items.map((item) => item.id))}>
                <Check active={allSelected} />
                <Text style={styles.selectText}>Chọn tất cả ({items.length} dịch vụ)</Text>
              </Pressable>
              {photographyFee > 0 && rentalFee > 0 ? (
                <View style={styles.comboUnlockedPill}>
                  <Ionicons name="sparkles" size={12} color={Colors.primary} />
                  <Text style={styles.comboUnlockedText}>Đã mở khóa giảm 10% Combo</Text>
                </View>
              ) : null}
            </View>

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

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Tóm tắt chi phí dự kiến</Text>
              <Summary label="Phí thuê cổ phục" value={rentalFee} />
              <Summary label="Gói chụp ảnh di sản" value={photographyFee} />
              {comboDiscount > 0 && (
                <Summary label="Chiết khấu đặt kèm Combo (10%)" value={-comboDiscount} accent />
              )}
              <Summary label="Tiền cọc giữ đồ (Hoàn 100%)" value={refundableDeposit} accent />
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tổng cần thanh toán dự kiến</Text>
                <Text style={styles.total}>{money(total)}</Text>
              </View>
              <View style={styles.depositNoteBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#B45309" />
                <Text style={styles.depositNote}>
                  Đặt đồng thời cổ phục và gói chụp được giảm tự động 10%. Tiền cọc giữ đồ được hoàn trả 100% sau khi hoàn trả trang phục.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottom}>
            <View>
              <Text style={styles.bottomLabel}>Đã chọn {selected.length} dịch vụ</Text>
              <Text style={styles.bottomTotal}>{money(total)}</Text>
            </View>
            <Pressable
              disabled={!selected.length}
              onPress={proceed}
              style={[styles.checkout, !selected.length && styles.disabled]}>
              <Text style={styles.checkoutText}>Tiếp tục thanh toán</Text>
              <Ionicons name="arrow-forward" size={17} color={Colors.white} />
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
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>CHỈNH SỬA NHANH</Text>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {editingItem?.name}
                </Text>
              </View>
              <Pressable onPress={() => setEditingItem(null)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#1B1C1C" />
              </Pressable>
            </View>

            {editingItem?.itemType === 'PRODUCT' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                <View>
                  <Text style={styles.fieldLabel}>CHỌN LẠI KÍCH CỠ (SIZE)</Text>
                  <View style={styles.chipRow}>
                    {COMMON_SIZES.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setEditSize(s)}
                        style={[styles.chip, editSize === s && styles.chipActive]}>
                        <Text style={[styles.chipText, editSize === s && styles.chipTextActive]}>
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>MÀU SẮC</Text>
                  <View style={styles.chipRow}>
                    {[
                      ...new Set([editingItem.color, ...COMMON_COLORS].filter(Boolean) as string[]),
                    ].map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setEditColor(c)}
                        style={[styles.chip, editColor === c && styles.chipActive]}>
                        <Text style={[styles.chipText, editColor === c && styles.chipTextActive]}>
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>NGÀY NHẬN & TRẢ CỔ PHỤC</Text>
                  <DateSelector
                    start={editFrom}
                    end={editTo}
                    onChange={(a, b) => {
                      setEditFrom(a);
                      setEditTo(b || a);
                    }}
                  />
                </View>

                <AppButton title="Lưu thay đổi" onPress={saveEditItem} />
              </ScrollView>
            ) : (
              <View style={{ gap: 14 }}>
                <Text style={styles.fieldLabel}>ĐỊA ĐIỂM HẸN CHỤP</Text>
                <TextInput
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Nhập địa chỉ chụp..."
                  style={styles.textInput}
                />
                <AppButton title="Cập nhật địa điểm" onPress={saveEditItem} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={{ paddingTop: 4 }}>
        <Check active={selected} />
      </Pressable>
      <Image source={getMediaUrl(item.image)} style={styles.image} contentFit="cover" />
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <View style={styles.typePill}>
            <Text style={styles.itemType}>
              {item.comboId ? 'COMBO · ' : ''}
              {photo ? 'GÓI CHỤP ẢNH' : 'THUÊ CỔ PHỤC'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={onEdit} hitSlop={8} style={styles.editBtn}>
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editBtnText}>Sửa</Text>
            </Pressable>
            <Pressable onPress={onRemove} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color="#8F8E8E" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemMeta}>
          <Ionicons name="calendar-outline" size={11} color={Colors.primary} />{' '}
          {photo
            ? `${item.shootDate} · ${item.shootTimeSlot}`
            : `${item.rentalFrom} → ${item.rentalTo}`}
        </Text>
        <Text style={styles.itemMeta}>
          <Ionicons
            name={photo ? 'location-outline' : 'shirt-outline'}
            size={11}
            color="#5F5E5E"
          />{' '}
          {photo ? item.shootLocation : `Size ${item.size} · ${item.color}`}
        </Text>

        <View style={styles.priceLine}>
          <View>
            <Text style={styles.price}>{money(item.basePrice)}</Text>
            {!photo && (item.depositAmount ?? 0) > 0 ? (
              <Text style={styles.depositSub}>+ Cọc giữ đồ {money(item.depositAmount)}</Text>
            ) : null}
          </View>
          {!photo && (
            <View style={styles.quantity}>
              <Pressable
                disabled={item.quantity <= 1}
                onPress={() => onQuantity(Math.max(1, item.quantity - 1))}>
                <Ionicons name="remove" size={16} color={Colors.primary} />
              </Pressable>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <Pressable onPress={() => onQuantity(item.quantity + 1)}>
                <Ionicons name="add" size={16} color={Colors.primary} />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function Check({ active }: { active: boolean }) {
  return (
    <View style={[styles.check, active && styles.checkActive]}>
      {active && <Ionicons name="checkmark" size={14} color={Colors.white} />}
    </View>
  );
}

function Summary({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.accent]}>{money(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: Colors.primary,
    textAlign: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 2,
  },
  count: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.primary },
  empty: { flex: 1, padding: 20, justifyContent: 'center', gap: 18 },
  content: { padding: 16, paddingBottom: 125, gap: 12 },
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  selectText: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: '#1B1C1C' },
  comboUnlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  comboUnlockedText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFECEB',
    padding: 13,
    flexDirection: 'row',
    gap: 11,
    ...Shadow,
  },
  image: {
    width: 78,
    height: 100,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
  },
  itemBody: { flex: 1 },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typePill: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  itemType: { fontFamily: FontFamily.bodyBold, fontSize: 8.5, color: Colors.primary },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  editBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
  },
  itemName: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    lineHeight: 21,
    color: '#1B1C1C',
    marginTop: 5,
  },
  itemMeta: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#5F5E5E',
    marginTop: 3,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: Colors.primary },
  depositSub: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8F8E8E',
    marginTop: 1,
  },
  quantity: {
    height: 32,
    minWidth: 88,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 999,
    backgroundColor: '#FBF9F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  quantityText: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#1B1C1C' },
  summary: {
    marginTop: 4,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 20,
    ...Shadow,
  },
  summaryTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: 12, color: '#5F5E5E' },
  summaryValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: '#1B1C1C' },
  accent: { color: Colors.primary, fontFamily: FontFamily.bodyBold },
  divider: { height: 1, backgroundColor: '#EFECEB', marginVertical: 9 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#1B1C1C' },
  total: { fontFamily: FontFamily.displayBold, fontSize: 21, color: Colors.primary },
  depositNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 11,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  depositNote: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#B45309',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadow,
  },
  bottomLabel: { fontFamily: FontFamily.body, fontSize: 11, color: '#8F8E8E' },
  bottomTotal: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 19,
    color: Colors.primary,
    marginTop: 2,
  },
  checkout: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.white },
  disabled: { opacity: 0.45 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,28,28,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    gap: 14,
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
    letterSpacing: 1,
    color: Colors.primary,
  },
  modalTitle: {
    fontFamily: FontFamily.display,
    fontSize: 19,
    color: '#1B1C1C',
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#5F5E5E',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 12,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#1B1C1C',
  },
});
