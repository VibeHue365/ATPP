import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkoutApi } from '@/apis/checkoutApi';
import { productApi } from '@/apis/productApi';
import {
  promotionApi,
  type PromotionValidation,
  type PublicPromotion,
} from '@/apis/promotionApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { pendingCheckoutStorage } from '@/services/pendingCheckout';
import type { CartItem } from '@/types/cart';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

const money = (value = 0) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
const validObjectId = (value?: string | null) => Boolean(value && /^[0-9a-f]{24}$/i.test(value));

export default function CheckoutRoute() {
  return (
    <RequireAuth>
      <CheckoutScreen />
    </RequireAuth>
  );
}

function CheckoutScreen() {
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const selectedIds = useMemo(() => ids.split(',').filter(Boolean), [ids]);
  const { items } = useCart();
  const { user } = useAuth();
  const { show } = useToast();

  const selected = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const addresses = user?.addresses ?? [];
  const defaultAddrIndex = Math.max(
    0,
    addresses.findIndex((item) => item.isDefault)
  );
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(
    addresses.length > 0 ? defaultAddrIndex : -1
  );
  const activeAddress =
    selectedAddressIndex >= 0 && addresses[selectedAddressIndex]
      ? addresses[selectedAddressIndex]
      : null;

  const [note, setNote] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromotionValidation | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState<PublicPromotion[]>([]);
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);

  const rentals = selected.filter((item) => item.itemType === 'PRODUCT');
  const photos = selected.filter((item) => item.itemType === 'PHOTOGRAPHY_PACKAGE');

  const providerIds = useMemo(
    () => [
      ...new Set(
        selected.map((item) => String(item.metadata?.providerId ?? '')).filter(Boolean)
      ),
    ],
    [selected]
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      promotionApi.listPublic().catch(() => []),
      ...providerIds.map((pid) => promotionApi.listByProvider(pid).catch(() => [])),
    ]).then((lists) => {
      if (!active) return;
      const merged = lists.flat().filter(Boolean);
      const unique = [...new Map(merged.map((v) => [v.code, v])).values()];
      setAvailableVouchers(unique);
    });
    return () => {
      active = false;
    };
  }, [providerIds.join(',')]);

  const rentalFee = rentals.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
  const deposit = rentals.reduce((sum, item) => sum + (item.depositAmount ?? 0) * item.quantity, 0);
  const photoFee = photos.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
  const comboDiscount =
    photos.length > 0 && rentals.length > 0 ? Math.round((rentalFee + photoFee) * 0.1) : 0;
  const beforeDiscount = rentalFee + deposit + photoFee;
  const rawDiscount =
    appliedPromo?.discountType === 'PERCENTAGE'
      ? Math.round((beforeDiscount * appliedPromo.discountValue) / 100)
      : (appliedPromo?.discountValue ?? 0);
  const promotionDiscount = Math.min(
    rawDiscount,
    appliedPromo?.maxDiscountAmount ?? rawDiscount,
    beforeDiscount
  );
  const discount = comboDiscount + promotionDiscount;
  const total = Math.max(0, beforeDiscount - discount);

  const validate = () => {
    if (!selected.length) return 'Giỏ hàng không còn sản phẩm đã chọn.';
    if (!fullName.trim() || !phone.trim() || !email.trim())
      return 'Vui lòng nhập đầy đủ họ tên, số điện thoại và email.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Địa chỉ email không hợp lệ.';
    if (photos.length > 1) return 'Vui lòng thanh toán từng gói chụp riêng biệt.';
    const badRental = rentals.find(
      (item) =>
        !validObjectId(item.productId) ||
        !item.rentalFrom ||
        !item.rentalTo ||
        !item.size ||
        !item.color
    );
    if (badRental)
      return `Cổ phục “${badRental.name ?? 'trong giỏ'}” đang thiếu lịch thuê, size hoặc màu.`;
    const photo = photos[0];
    if (
      photo &&
      (!validObjectId(photo.photographyPackageId) ||
        !photo.shootDate ||
        !photo.shootTimeSlot ||
        !photo.shootLocation)
    )
      return 'Gói chụp đang thiếu ngày giờ hoặc địa điểm chụp.';
    if (!agreed) return 'Bạn cần đồng ý với chính sách thanh toán và đặt dịch vụ của TàGo.';
    return null;
  };

  const resume = async () => {
    const signature = [...selectedIds].sort().join('|');
    const pending = (await pendingCheckoutStorage.all()).find(
      (item) => [...item.cartItemIds].sort().join('|') === signature
    );
    if (!pending) return false;
    try {
      const status = await checkoutApi.status(pending.paymentCode);
      if (
        status.paymentStatus === 'FAILED' ||
        status.paymentStatus === 'CANCELLED' ||
        status.bookingStatus === 'CANCELLED'
      ) {
        await pendingCheckoutStorage.remove(pending.paymentCode);
        return false;
      }
      if (status.paymentStatus === 'PENDING' && pending.checkoutUrl && Platform.OS !== 'web') {
        router.replace({
          pathname: '/payment/webview',
          params: { code: pending.paymentCode, url: pending.checkoutUrl },
        } as unknown as Href);
      } else {
        router.replace({
          pathname: '/payment/result',
          params: { code: pending.paymentCode },
        } as unknown as Href);
      }
      return true;
    } catch {
      return false;
    }
  };

  const applyPromoCode = async (codeToValidate?: string) => {
    const code = (codeToValidate ?? promoCode).trim().toUpperCase();
    if (photos.length) {
      show('Đơn có gói chụp đã được hưởng ưu đãi Combo trực tiếp', 'error');
      return;
    }
    if (!code) return;
    setPromoLoading(true);
    try {
      const result = await promotionApi.validate(code, beforeDiscount, providerIds);
      setAppliedPromo(result);
      setPromoCode(result.code);
      setVoucherModalOpen(false);
      show(`Đã áp dụng mã ưu đãi ${result.code}`, 'success');
    } catch (error) {
      setAppliedPromo(null);
      show(getApiErrorMessage(error, 'Mã ưu đãi chưa đủ điều kiện áp dụng'), 'error');
    } finally {
      setPromoLoading(false);
    }
  };

  const submit = async () => {
    const issue = validate();
    if (issue) {
      show(issue, 'error');
      return;
    }
    setLoading(true);
    try {
      if (await resume()) return;
      await Promise.all(
        rentals.map(async (item) => {
          const result = await productApi.availability(item.productId!, {
            size: item.size!,
            color: item.color!,
            rentalFrom: item.rentalFrom!,
            rentalTo: item.rentalTo!,
            quantity: item.quantity,
            rentalType: item.rentalType ?? 'DAILY',
            startTime: item.startTime ?? undefined,
            endTime: item.endTime ?? undefined,
          });
          if (!result.available)
            throw new Error(result.message ?? `${item.name} không còn đủ số lượng.`);
        })
      );
      let bookingId: string;
      let purpose: 'FULL_PAYMENT' | 'DEPOSIT_PAYMENT' = 'FULL_PAYMENT';
      if (photos.length) {
        const rawPhoto = photos[0];
        const photo: CartItem = {
          ...rawPhoto,
          shootLocationLatitude: Number.isFinite(rawPhoto.shootLocationLatitude)
            ? rawPhoto.shootLocationLatitude
            : 16.4698,
          shootLocationLongitude: Number.isFinite(rawPhoto.shootLocationLongitude)
            ? rawPhoto.shootLocationLongitude
            : 107.5786,
          customRequests: note.trim() || rawPhoto.customRequests,
        };
        const hold = await checkoutApi.createPhotographyHold(photo, rentals);
        bookingId = hold.bookingId;
        purpose = 'DEPOSIT_PAYMENT';
      } else {
        const booking = await checkoutApi.createRentalBooking(rentals, appliedPromo?.code);
        bookingId = booking._id;
      }
      const payment = await checkoutApi.createPaymentLink(bookingId, purpose);
      if (!payment.paymentCode) throw new Error('Hệ thống chưa tạo được mã thanh toán.');
      const checkoutUrl = payment.payos?.checkoutUrl ?? null;
      await pendingCheckoutStorage.save({
        paymentCode: payment.paymentCode,
        bookingId,
        cartItemIds: selectedIds,
        checkoutUrl,
        createdAt: new Date().toISOString(),
      });
      show('Đã khóa lịch giữ chỗ, đang mở cổng thanh toán', 'success');
      if (checkoutUrl && !checkoutUrl.includes('/checkout/result')) {
        if (Platform.OS === 'web') {
          await Linking.openURL(checkoutUrl);
          router.replace({
            pathname: '/payment/result',
            params: { code: payment.paymentCode },
          } as unknown as Href);
        } else {
          router.replace({
            pathname: '/payment/webview',
            params: { code: payment.paymentCode, url: checkoutUrl },
          } as unknown as Href);
        }
        return;
      }
      router.replace({
        pathname: '/payment/result',
        params: { code: payment.paymentCode },
      } as unknown as Href);
    } catch (error) {
      show(getApiErrorMessage(error, 'Không thể tạo giao dịch thanh toán'), 'error');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.brand}>TàGo</Text>
          <Text style={styles.headerTitle}>XÁC NHẬN & THANH TOÁN</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.fullName
              ?.split(' ')
              .map((v) => v[0])
              .slice(-2)
              .join('')
              .toUpperCase() || 'TG'}
          </Text>
        </View>
      </View>

      <Progress />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.eyebrow}>HOÀN TẤT ĐẶT LỊCH</Text>
          <Text style={styles.title}>Xác nhận thông tin dịch vụ</Text>
          <Text style={styles.subtitle}>
            Hệ thống kiểm tra lịch trống thời gian thực trước khi tạo mã giữ chỗ độc quyền cho bạn.
          </Text>
        </View>

        <Section title={`Dịch vụ đã chọn (${selected.length})`}>
          {selected.map((item) => (
            <ServiceRow key={item.id} item={item} />
          ))}
        </Section>

        <Section title="Thông tin người đặt lịch">
          <Field label="HỌ VÀ TÊN *" value={fullName} onChangeText={setFullName} />
          <Field
            label="SỐ ĐIỆN THOẠI LIÊN HỆ *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Field
            label="EMAIL NHẬN VÉ ĐIỆN TỬ *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Section>

        {rentals.length > 0 && (
          <Section title="Địa điểm nhận áo & liên hệ">
            {addresses.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                <Pressable
                  onPress={() => setSelectedAddressIndex(-1)}
                  style={[
                    styles.addrChip,
                    selectedAddressIndex === -1 && styles.addrChipActive,
                  ]}>
                  <Ionicons
                    name="storefront-outline"
                    size={13}
                    color={selectedAddressIndex === -1 ? '#FFFFFF' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.addrChipText,
                      selectedAddressIndex === -1 && styles.addrChipTextActive,
                    ]}>
                    Nhận tại tiệm
                  </Text>
                </Pressable>
                {addresses.map((addr, idx) => {
                  const active = selectedAddressIndex === idx;
                  return (
                    <Pressable
                      key={`${addr.label}-${idx}`}
                      onPress={() => setSelectedAddressIndex(idx)}
                      style={[styles.addrChip, active && styles.addrChipActive]}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={active ? '#FFFFFF' : Colors.primary}
                      />
                      <Text style={[styles.addrChipText, active && styles.addrChipTextActive]}>
                        {addr.label || `Địa chỉ ${idx + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.address}>
              <View style={styles.addressIconWrap}>
                <Ionicons name="location" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>
                  {activeAddress ? activeAddress.label : 'Nhận và thử đồ trực tiếp tại Tiệm'}
                </Text>
                <Text style={styles.addressText}>
                  {activeAddress
                    ? [
                        activeAddress.addressLine,
                        activeAddress.ward,
                        activeAddress.district,
                        activeAddress.city,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    : rentals[0].providerAddress ??
                      'Địa chỉ chi tiết của tiệm hiển thị ngay trong vé đặt lịch.'}
                </Text>
              </View>
            </View>
          </Section>
        )}

        {/* Voucher Section with Picker Modal */}
        <Section title="Mã ưu đãi & Voucher TàGo">
          <View style={styles.promoRow}>
            <TextInput
              editable={!photos.length}
              value={promoCode}
              onChangeText={(value) => {
                setPromoCode(value.toUpperCase());
                setAppliedPromo(null);
              }}
              placeholder={
                photos.length
                  ? 'Đã áp dụng ưu đãi gói chụp / Combo'
                  : 'Nhập mã giảm giá (VD: TAGO10)'
              }
              placeholderTextColor="#8F8E8E"
              style={[styles.promoInput, photos.length > 0 && styles.inputDisabled]}
            />
            <AppButton
              title="Áp dụng"
              fullWidth={false}
              loading={promoLoading}
              disabled={photos.length > 0 || !promoCode.trim()}
              onPress={() => void applyPromoCode()}
            />
          </View>

          {!photos.length && availableVouchers.length > 0 && (
            <Pressable
              style={styles.openVoucherPickerBtn}
              onPress={() => setVoucherModalOpen(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ionicons name="ticket" size={16} color={Colors.primary} />
                <Text style={styles.openVoucherPickerText}>
                  Chọn từ Kho Voucher có sẵn ({availableVouchers.length} mã)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
            </Pressable>
          )}

          {appliedPromo && (
            <View style={styles.promoSuccessBox}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.promoSuccess}>
                Đã áp dụng {appliedPromo.code} ({appliedPromo.name}) · Giảm{' '}
                {money(promotionDiscount)}
              </Text>
              <Pressable
                onPress={() => {
                  setAppliedPromo(null);
                  setPromoCode('');
                }}>
                <Text style={styles.removePromoText}>Bỏ</Text>
              </Pressable>
            </View>
          )}
        </Section>

        <Section title="Ghi chú cho Tiệm / Studio">
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Ví dụ: Giờ dự kiến ghé tiệm lấy đồ, yêu cầu phụ kiện đi kèm..."
            placeholderTextColor="#8F8E8E"
            style={styles.note}
          />
        </Section>

        <Pressable style={styles.agreement} onPress={() => setAgreed((value) => !value)}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Ionicons name="checkmark" size={14} color={Colors.white} />}
          </View>
          <Text style={styles.agreementText}>
            Tôi xác nhận thông tin lịch hẹn, chi phí thuê, tiền cọc giữ đồ và đồng ý với chính sách bảo vệ khách hàng của TàGo.
          </Text>
        </Pressable>

        <Section title="Chi tiết thanh toán">
          <Summary label="Phí thuê cổ phục" value={rentalFee} />
          <Summary label="Gói chụp ảnh & phụ phí" value={photoFee} />
          {comboDiscount > 0 && (
            <Summary label="Ưu đãi đặt kèm Combo (10%)" value={-comboDiscount} accent />
          )}
          <Summary label="Tiền cọc giữ đồ (Hoàn 100%)" value={deposit} accent />
          <Summary label="Phí dịch vụ nền tảng" value={0} />
          {promotionDiscount > 0 && (
            <Summary label={`Voucher (${appliedPromo?.code})`} value={-promotionDiscount} accent />
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán giữ lịch</Text>
            <Text style={styles.total}>{money(total)}</Text>
          </View>
          <View style={styles.holdNote}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
            <Text style={styles.holdText}>
              Số tiền cọc và thanh toán được bảo vệ qua tài khoản ký quỹ TàGo Escrow cho đến khi hoàn tất dịch vụ.
            </Text>
          </View>
        </Section>
      </ScrollView>

      <View style={styles.bottom}>
        <AppButton
          title={`Thanh toán ${money(total)}  →`}
          loading={loading}
          disabled={!selected.length}
          onPress={submit}
        />
      </View>

      {/* Voucher Picker Modal */}
      <Modal
        visible={voucherModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVoucherModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>KHO ƯU ĐÃI TÀGO</Text>
                <Text style={styles.modalTitle}>Chọn Voucher giảm giá</Text>
              </View>
              <Pressable onPress={() => setVoucherModalOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#1B1C1C" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {availableVouchers.map((v) => {
                const eligible = !v.minOrderValue || beforeDiscount >= v.minOrderValue;
                return (
                  <View
                    key={v._id}
                    style={[styles.voucherItem, !eligible && { opacity: 0.55 }]}>
                    <View style={styles.voucherLeftIcon}>
                      <Ionicons name="ticket" size={22} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voucherItemCode}>{v.code}</Text>
                      <Text style={styles.voucherItemName}>{v.name}</Text>
                      <Text style={styles.voucherItemMeta}>
                        {v.discountType === 'PERCENTAGE'
                          ? `Giảm ${v.discountValue}%`
                          : `Giảm ${money(v.discountValue)}`}
                        {v.minOrderValue ? ` · Đơn tối thiểu ${money(v.minOrderValue)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      disabled={!eligible || promoLoading}
                      onPress={() => void applyPromoCode(v.code)}
                      style={[styles.useVoucherBtn, !eligible && styles.inputDisabled]}>
                      <Text style={styles.useVoucherBtnText}>
                        {eligible ? 'Dùng ngay' : 'Chưa đủ ĐK'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Progress() {
  return (
    <View style={styles.progress}>
      {['Giỏ hàng', 'Xác nhận', 'Thanh toán', 'Vé điện tử'].map((label, index) => (
        <View key={label} style={styles.progressItem}>
          <View style={[styles.progressDot, index < 2 && styles.progressActive]}>
            <Text style={[styles.progressNo, index < 2 && styles.progressNoActive]}>
              {index === 0 ? '✓' : index + 1}
            </Text>
          </View>
          <Text style={[styles.progressLabel, index === 1 && styles.progressLabelActive]}>
            {label}
          </Text>
        </View>
      ))}
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
function ServiceRow({ item }: { item: CartItem }) {
  const photo = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  return (
    <View style={styles.service}>
      <Image source={getMediaUrl(item.image)} style={styles.serviceImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <Text style={styles.serviceMeta}>
          {photo
            ? `${item.shootDate} · ${item.shootTimeSlot}`
            : `${item.rentalFrom} → ${item.rentalTo} · Size ${item.size}`}
        </Text>
        <Text style={styles.servicePrice}>
          {money(
            (item.basePrice ?? 0) * item.quantity +
              (photo ? 0 : (item.depositAmount ?? 0) * item.quantity)
          )}
        </Text>
      </View>
    </View>
  );
}
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="#8F8E8E" style={styles.input} {...input} />
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
    <View style={styles.summary}>
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
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginTop: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.primary },
  progress: {
    height: 68,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  progressItem: { alignItems: 'center', gap: 4 },
  progressDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  progressNo: { fontFamily: FontFamily.bodyBold, fontSize: 10.5, color: '#8F8E8E' },
  progressNoActive: { color: Colors.white },
  progressLabel: { fontFamily: FontFamily.body, fontSize: 9.5, color: '#8F8E8E' },
  progressLabelActive: { fontFamily: FontFamily.bodyBold, color: Colors.primary },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: Colors.primary,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 25,
    lineHeight: 32,
    color: '#1B1C1C',
    marginTop: 2,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 20,
    padding: 16,
    gap: 11,
    ...Shadow,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  service: { flexDirection: 'row', gap: 11, paddingVertical: 4 },
  serviceImage: {
    width: 64,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
  },
  serviceName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#1B1C1C',
  },
  serviceMeta: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#5F5E5E',
    marginTop: 3,
  },
  servicePrice: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.primary,
    marginTop: 5,
  },
  field: { gap: 5 },
  fieldLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: '#5F5E5E',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#1B1C1C',
    backgroundColor: '#FBF9F9',
  },
  addrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  addrChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  addrChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#1B1C1C',
  },
  addrChipTextActive: {
    color: '#FFFFFF',
  },
  address: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFD9E2',
    backgroundColor: '#FFF0F3',
    borderRadius: 14,
  },
  addressIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTitle: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#1B1C1C' },
  addressText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 2,
  },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#1B1C1C',
    backgroundColor: '#FBF9F9',
  },
  inputDisabled: { opacity: 0.5 },
  openVoucherPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  openVoucherPickerText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  promoSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EDF9F2',
    padding: 10,
    borderRadius: 12,
  },
  promoSuccess: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.success,
  },
  removePromoText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.error,
  },
  note: {
    minHeight: 84,
    textAlignVertical: 'top',
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    backgroundColor: '#FBF9F9',
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#1B1C1C',
  },
  agreement: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  agreementText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: 12, color: '#5F5E5E' },
  summaryValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: '#1B1C1C' },
  accent: { color: Colors.primary, fontFamily: FontFamily.bodyBold },
  divider: { height: 1, backgroundColor: '#EFECEB', marginVertical: 6 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#1B1C1C' },
  total: { fontFamily: FontFamily.displayBold, fontSize: 21, color: Colors.primary },
  holdNote: {
    flexDirection: 'row',
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: '#FFD9E2',
    backgroundColor: '#FFF0F3',
    borderRadius: 12,
    marginTop: 6,
  },
  holdText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#5F5E5E',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,28,28,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '80%',
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
    fontSize: 20,
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
  voucherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  voucherLeftIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherItemCode: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: Colors.primary,
  },
  voucherItemName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
    marginTop: 1,
  },
  voucherItemMeta: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  useVoucherBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  useVoucherBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
});
