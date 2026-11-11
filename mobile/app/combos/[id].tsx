import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { photographerApi } from '@/apis/photographerApi';
import { productApi } from '@/apis/productApi';
import { TagoLocationPicker } from '@/components/map/TagoLocationPicker';
import { AppButton } from '@/components/ui/AppButton';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useComboDetail } from '@/hooks/useCombos';
import { comboOriginalPrice, comboPublishedPrice } from '@/types/combo';
import type { PhotographyQuote } from '@/types/photographer';
import type { ProductCampaign } from '@/types/product';
import { getApiErrorMessage } from '@/utils/apiError';
import { applyCampaignToRate } from '@/utils/campaignPricing';
import { resolveEntityCoords } from '@/utils/geo';
import { getMediaUrl } from '@/utils/media';

const money = (value = 0) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const minutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};
const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

const COMBO_PRESET_SPOTS = [
  { label: 'Đại Nội Huế', address: 'Đại Nội Huế (Hoàng Thành), TP. Huế', lat: 16.4698, lng: 107.5786 },
  { label: 'Cung An Định', address: 'Cung An Định, 179B Phan Đình Phùng, TP. Huế', lat: 16.4581, lng: 107.6001 },
  { label: 'Lăng Tự Đức', address: 'Lăng Tự Đức, Thủy Xuân, TP. Huế', lat: 16.4331, lng: 107.5658 },
  { label: 'Chùa Thiên Mụ', address: 'Chùa Thiên Mụ, Kim Long, TP. Huế', lat: 16.4534, lng: 107.5451 },
];

export default function ComboDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item: combo, loading, error, reload } = useComboDetail(id);
  const { addItem, count } = useCart();
  const { show } = useToast();

  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [customSpot, setCustomSpot] = useState<{ address: string; lat: number; lng: number } | null>(
    null
  );
  const [ranges, setRanges] = useState<Array<{ start: string; end: string }>>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [quote, setQuote] = useState<PhotographyQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<ProductCampaign | null>(null);

  // Combo không trả chiến dịch giá của shop; lấy từ chi tiết áo để giá trong giỏ khớp backend (VIB-43).
  useEffect(() => {
    if (!combo?.productId?._id) return;
    let active = true;
    productApi
      .detail(combo.productId._id)
      .then((value) => {
        if (active) setCampaign(value.activeCampaign ?? null);
      })
      .catch(() => {
        if (active) setCampaign(null);
      });
    return () => {
      active = false;
    };
  }, [combo?.productId?._id]);

  const dates = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const value = new Date();
        value.setDate(value.getDate() + index + 1);
        return {
          value: iso(value),
          day: value.getDate(),
          month: value.getMonth() + 1,
          week: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][value.getDay()],
        };
      }),
    []
  );

  const duration = Math.max(Math.round((combo?.photographyPackageId?.durationHours ?? 1) * 60), 30);
  const end = start ? time(minutes(start) + duration) : '';

  const providerAddress = combo
    ? [
        combo.providerId?.address?.addressLine,
        combo.providerId?.address?.ward,
        combo.providerId?.address?.district,
        combo.providerId?.address?.city,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const providerCoords = useMemo(
    () => (combo?.providerId ? resolveEntityCoords(combo.providerId) : { lat: 16.4698, lng: 107.5786 }),
    [combo?.providerId]
  );
  const effectiveLat = customSpot?.lat ?? providerCoords.lat;
  const effectiveLng = customSpot?.lng ?? providerCoords.lng;
  const effectiveAddress =
    customSpot?.address || providerAddress || 'Đại Nội Huế (Hoàng Thành), TP. Huế';

  const slots = useMemo(
    () =>
      ranges.flatMap((range) => {
        const result: Array<{ start: string; end: string }> = [];
        for (
          let value = minutes(range.start);
          value + duration <= minutes(range.end);
          value += duration >= 180 ? 60 : 30
        )
          result.push({ start: time(value), end: time(value + duration) });
        return result;
      }),
    [ranges, duration]
  );

  useEffect(() => {
    if (!combo) return;
    setSize(combo.productId?.sizes?.[0] ?? '');
    setColor(combo.productId?.colors?.[0] ?? '');
  }, [combo?._id]);

  useEffect(() => {
    if (!combo) return;
    let active = true;
    const months = [...new Set(dates.map((value) => value.value.slice(0, 7)))];
    Promise.all(
      months.map((month) =>
        photographerApi
          .monthAvailability(combo.providerId._id, month, combo.photographyPackageId._id)
          .catch(() => null)
      )
    ).then((values) => {
      if (!active) return;
      const next: Record<string, string> = {};
      values.forEach((value) =>
        value?.days?.forEach((day) => {
          next[day.date] = day.status;
        })
      );
      setStatuses(next);
    });
    return () => {
      active = false;
    };
  }, [combo?._id]);

  useEffect(() => {
    if (!combo || !date) {
      setRanges([]);
      setStart('');
      return;
    }
    let active = true;
    setScheduleLoading(true);
    setStart('');
    setQuote(null);
    photographerApi
      .timeRanges(combo.providerId._id, date)
      .then((value) => {
        if (active) setRanges(value.timeRanges ?? []);
      })
      .catch(() => {
        if (active) setRanges([]);
      })
      .finally(() => {
        if (active) setScheduleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [combo?._id, date]);

  useEffect(() => {
    if (!combo || !date || !start || !effectiveAddress) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError(null);
      photographerApi
        .quote(combo.providerId._id, combo.photographyPackageId._id, [
          {
            clientId: 'mobile-combo-session',
            startsAt: `${date}T${start}:00+07:00`,
            endsAt: `${date}T${end}:00+07:00`,
            locationAddress: effectiveAddress,
            locationLatitude: effectiveLat,
            locationLongitude: effectiveLng,
          },
        ])
        .then((value) => {
          if (active) {
            setQuote(value);
            if (!value.valid)
              setQuoteError(value.errors?.[0]?.message ?? 'Khung giờ không khả dụng');
          }
        })
        .catch((cause) => {
          if (active) setQuoteError(getApiErrorMessage(cause, 'Không thể kiểm tra lịch'));
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [combo?._id, date, start, end, effectiveAddress, effectiveLat, effectiveLng]);

  if (loading) return <LoadingState label="Đang tải chi tiết gói Combo..." />;
  if (error || !combo || !combo.productId?.name || !combo.photographyPackageId?.name)
    return (
      <ErrorState
        message={error ?? 'Gói Combo này hiện không khả dụng do dịch vụ đang được cập nhật.'}
        onRetry={reload}
      />
    );

  const images = [
    combo.image,
    ...(combo.images ?? []),
    ...(combo.photographyPackageId.images ?? []),
    ...(combo.productId.images ?? []),
  ].filter((value): value is string => Boolean(value));
  const remaining = Math.max(0, combo.maxUsage - (combo.usedCount ?? 0));

  const isUnavailablePackage = Boolean(
    quoteError &&
      (quoteError.includes('Không tìm thấy gói chụp') ||
        quoteError.includes('không hoạt động') ||
        quoteError.includes('không hợp lệ'))
  );

  const realDiscountPercent =
    comboOriginalPrice(combo) > 0
      ? Math.max(
          1,
          Math.round(
            ((comboOriginalPrice(combo) - comboPublishedPrice(combo)) /
              comboOriginalPrice(combo)) *
              100
          )
        )
      : combo.discountPercent;

  const add = () => {
    if (!size || !color || !date || !start) {
      show('Vui lòng chọn đủ size, màu, ngày và giờ chụp', 'error');
      return;
    }
    if (!quote?.valid || !quote.totals) {
      show(quoteError ?? 'Lịch chưa được hệ thống xác nhận còn trống', 'error');
      return;
    }
    if (remaining < 1) {
      show('Combo đã hết lượt sử dụng ưu đãi', 'error');
      return;
    }
    const metadata = {
      comboPromotionId: combo._id,
      comboName: combo.name,
      publishedDiscountPercent: combo.discountPercent,
      backendComboDiscountPercent: 10,
    };
    addItem({
      itemType: 'PRODUCT',
      comboId: combo._id,
      productId: combo.productId._id,
      name: combo.productId.name,
      image: combo.productId.images?.[0] ?? combo.image,
      basePrice: applyCampaignToRate(combo.productId.basePrice, campaign, date),
      depositAmount: combo.productId.depositAmount ?? 0,
      size,
      color,
      rentalType: 'DAILY',
      rentalFrom: date,
      rentalTo: date,
      providerAddress: effectiveAddress,
      quantity: combo.aoDaiQuantity ?? 1,
      metadata: { ...metadata, providerId: combo.providerId._id },
    });
    addItem({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      comboId: combo._id,
      photographyPackageId: combo.photographyPackageId._id,
      name: `${combo.photographyPackageId.name} — ${combo.providerId.businessName ?? 'Studio'}`,
      image: combo.photographyPackageId.images?.[0] ?? combo.image,
      basePrice: quote.totals.totalAmount,
      depositAmount: quote.totals.totalAmount,
      shootDate: date,
      shootTimeSlot: `${start}-${end}`,
      shootLocation: effectiveAddress,
      shootLocationLatitude: effectiveLat,
      shootLocationLongitude: effectiveLng,
      shootConcept: `Combo: ${combo.name}`,
      providerAddress: effectiveAddress,
      quantity: 1,
      metadata: {
        ...metadata,
        providerId: combo.providerId._id,
        quoteBreakdown: quote.breakdown,
      },
    });
    show('Đã thêm trọn bộ Combo vào giỏ hàng', 'success');
    router.push('/cart' as Href);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable style={s.circle} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.brand}>TàGo Combo</Text>
          <Text style={s.headerSub}>TRỌN GÓI CỔ PHỤC & CHỤP ẢNH</Text>
        </View>
        <Pressable style={s.circle} onPress={() => router.push('/cart' as Href)}>
          <Ionicons name="bag-handle-outline" size={20} color="#1B1C1C" />
          {count > 0 && (
            <View style={s.count}>
              <Text style={s.countText}>{count}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {images.length ? (
            images.slice(0, 8).map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={getMediaUrl(uri)}
                style={s.heroImage}
                contentFit="cover"
              />
            ))
          ) : (
            <View style={[s.heroImage, s.noImage]}>
              <Ionicons name="images-outline" size={42} color="#8F8E8E" />
            </View>
          )}
        </ScrollView>

        <View style={s.intro}>
          <View style={s.discount}>
            <Ionicons name="sparkles" size={11} color={Colors.primary} />
            <Text style={s.discountText}>TIẾT KIỆM {combo.discountPercent}%</Text>
          </View>
          <Text style={s.title}>{combo.name}</Text>
          <Text style={s.rating}>
            ★ {(combo.providerId.rating?.averageRating ?? 5.0).toFixed(1)}{' '}
            <Text style={s.muted}>
              · {combo.providerId.businessName} · {combo.providerId.address?.city ?? 'Cố đô Huế'}
            </Text>
          </Text>
          <Text style={s.description}>
            {combo.description ??
              `${combo.productId.name} kết hợp ${combo.photographyPackageId.name}.`}
          </Text>
          <View style={s.priceLine}>
            <View>
              <Text style={s.old}>{money(comboOriginalPrice(combo))}</Text>
              <Text style={s.price}>{money(comboPublishedPrice(combo))}</Text>
            </View>
            <View style={s.remainingBadge}>
              <Text style={s.remaining}>Còn {remaining} suất ưu đãi</Text>
            </View>
          </View>
        </View>

        <Section title="Trọn bộ Combo bao gồm">
          <Service
            icon="shirt-outline"
            title={combo.productId.name}
            detail={`${combo.aoDaiQuantity ?? 1} bộ cổ phục · ${combo.productId.materials?.join(', ') || 'Chất liệu lụa/gấm cao cấp'}`}
          />
          <Service
            icon="camera-outline"
            title={combo.photographyPackageId.name}
            detail={`${duration} phút chụp · ${combo.photographyPackageId.editedPhotosCount ?? 15} ảnh retouch nghệ thuật`}
          />
          {combo.inclusions?.map((value) => (
            <View key={value} style={s.inclusion}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={s.inclusionText}>{value}</Text>
            </View>
          ))}
        </Section>

        <Section title="1. Chọn biến thể Cổ phục">
          <Text style={s.label}>KÍCH CỠ (SIZE)</Text>
          <View style={s.options}>
            {(combo.productId.sizes ?? ['S', 'M', 'L']).map((value) => (
              <Option key={value} value={value} active={size === value} onPress={() => setSize(value)} />
            ))}
          </View>
          <Text style={s.label}>MÀU SẮC</Text>
          <View style={s.options}>
            {(combo.productId.colors ?? ['Đỏ cung đình']).map((value) => (
              <Option
                key={value}
                value={value}
                active={color === value}
                onPress={() => setColor(value)}
              />
            ))}
          </View>
        </Section>

        <Section title="2. Chọn ngày chụp & nhận áo">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dateRow}>
            {dates.map((value) => {
              const unavailable =
                statuses[value.value] !== undefined && statuses[value.value] !== 'AVAILABLE';
              return (
                <Pressable
                  key={value.value}
                  disabled={unavailable}
                  onPress={() => setDate(value.value)}
                  style={[
                    s.day,
                    date === value.value && s.dayActive,
                    unavailable && s.disabled,
                  ]}>
                  <Text style={[s.dayText, date === value.value && s.light]}>{value.week}</Text>
                  <Text style={[s.dayNo, date === value.value && s.light]}>{value.day}</Text>
                  <Text style={[s.dayText, date === value.value && s.light]}>
                    Th {value.month}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!!date &&
            (scheduleLoading ? (
              <Text style={s.helper}>Đang tải các khung giờ trống...</Text>
            ) : slots.length ? (
              <View style={s.options}>
                {slots.map((value) => (
                  <Option
                    key={value.start}
                    value={`${value.start}–${value.end}`}
                    active={start === value.start}
                    onPress={() => setStart(value.start)}
                  />
                ))}
              </View>
            ) : (
              <Text style={s.warning}>Không còn khung giờ trống trong ngày này.</Text>
            ))}
        </Section>

        <Section title="3. Điểm hẹn chụp & nhận trang phục">
          <TagoLocationPicker
            label="BẢN ĐỒ CHỌN ĐIỂM HẸN CHỤP (TOÀN QUỐC)"
            value={{
              address: effectiveAddress,
              lat: effectiveLat,
              lng: effectiveLng,
            }}
            onChange={(next) => setCustomSpot(next)}
            providerCoords={providerCoords}
            providerLabel={combo.providerId.businessName ?? 'Studio'}
            serviceRadiusKm={25}
          />
        </Section>

        {isUnavailablePackage ? (
          <View style={s.unavailableCard}>
            <View style={s.unavailableHeader}>
              <Ionicons name="alert-circle" size={20} color="#D97706" />
              <Text style={s.unavailableTitle}>Gói Combo Đang Tạm Ngưng Nhận Lịch</Text>
            </View>
            <Text style={s.unavailableDesc}>
              {quoteError}. Studio hiện đang tạm dừng nhận lịch hẹn mới hoặc đang cập nhật lại thông tin dịch vụ. Bạn vui lòng chọn ngày khác hoặc khám phá các gói Combo khác đang sẵn sàng.
            </Text>
            <Pressable style={s.exploreOtherBtn} onPress={() => router.back()}>
              <Ionicons name="compass-outline" size={16} color="#FFFFFF" />
              <Text style={s.exploreOtherBtnText}>Khám phá các Combo sẵn có khác</Text>
            </Pressable>
          </View>
        ) : (
          <Section title="Bảng tạm tính Combo">
            <Row label="Tổng giá gốc lẻ" value={money(comboOriginalPrice(combo))} />
            <Row
              label={`Ưu đãi gói Combo (${realDiscountPercent}%)`}
              value={`-${money(comboOriginalPrice(combo) - comboPublishedPrice(combo))}`}
            />
            <View style={s.divider} />
            <Row label="Giá trọn gói Combo" value={money(comboPublishedPrice(combo))} strong />
            <Text style={s.notice}>
              Khi thanh toán giữ chỗ đồng thời cổ phục và gói chụp, hệ thống tự động kích hoạt chiết khấu Combo và khóa lịch ngay lập tức.
            </Text>
            {quoteLoading && <Text style={s.helper}>Đang xác nhận lịch trống và báo giá...</Text>}
            {quoteError && <Text style={s.warning}>{quoteError}</Text>}
            {quote?.valid && (
              <Text style={s.success}>✓ Hệ thống đã xác nhận lịch chụp và cổ phục còn trống.</Text>
            )}
          </Section>
        )}
      </ScrollView>

      <View style={s.bottom}>
        <View>
          <Text style={s.bottomLabel}>
            {isUnavailablePackage ? 'Trạng thái' : 'Trọn gói Combo'}
          </Text>
          <Text
            style={[
              s.bottomPrice,
              isUnavailablePackage && { color: '#B45309', fontSize: 15 },
            ]}
          >
            {isUnavailablePackage ? 'Tạm ngưng nhận lịch' : money(comboPublishedPrice(combo))}
          </Text>
        </View>
        <AppButton
          title={isUnavailablePackage ? 'Tạm ngưng nhận lịch' : 'Đặt Combo ngay'}
          fullWidth={false}
          disabled={!quote?.valid || quoteLoading || remaining < 1 || isUnavailablePackage}
          onPress={add}
        />
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Service({
  icon,
  title,
  detail,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
}) {
  return (
    <View style={s.service}>
      <View style={s.serviceIcon}>
        <Ionicons name={icon} size={21} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.serviceTitle}>{title}</Text>
        <Text style={s.helper}>{detail}</Text>
      </View>
    </View>
  );
}
function Option({
  value,
  active,
  onPress,
}: {
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.option, active && s.optionActive]}>
      <Text style={[s.optionText, active && s.light]}>{value}</Text>
    </Pressable>
  );
}
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, strong && s.strong]}>{label}</Text>
      <Text style={[s.rowValue, strong && s.total]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  circle: {
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
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8F8E8E',
    textAlign: 'center',
  },
  count: {
    position: 'absolute',
    right: -3,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.white },
  content: { paddingBottom: 120, gap: 13 },
  heroImage: { width: 390, height: 260, backgroundColor: '#FFF0F3' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  intro: { padding: 16 },
  discount: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  discountText: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.primary },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    lineHeight: 33,
    color: '#1B1C1C',
    marginTop: 10,
  },
  rating: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 7,
  },
  muted: { fontFamily: FontFamily.body, color: '#8F8E8E' },
  description: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#5F5E5E',
    marginTop: 8,
  },
  priceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  old: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
    textDecorationLine: 'line-through',
  },
  price: { fontFamily: FontFamily.displayBold, fontSize: 24, color: Colors.primary },
  remainingBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  remaining: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: '#B45309' },
  section: {
    marginHorizontal: 16,
    padding: 16,
    gap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 18,
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
  service: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: '#1B1C1C' },
  helper: { fontFamily: FontFamily.body, fontSize: 11, lineHeight: 16, color: '#5F5E5E' },
  inclusion: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  inclusionText: { fontFamily: FontFamily.bodyMedium, fontSize: 11.5, color: '#5F5E5E' },
  label: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: '#8F8E8E',
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 999,
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11.5, color: '#1B1C1C' },
  light: { color: Colors.white },
  dateRow: { gap: 8 },
  day: {
    width: 56,
    height: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF9F9',
  },
  dayActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontFamily: FontFamily.body, fontSize: 9.5, color: '#8F8E8E' },
  dayNo: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#1B1C1C',
    marginVertical: 2,
  },
  disabled: { opacity: 0.32 },
  warning: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.warning,
  },
  success: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.success },
  address: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  addressText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    color: '#1B1C1C',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { fontFamily: FontFamily.body, fontSize: 12, color: '#5F5E5E' },
  rowValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: '#1B1C1C' },
  strong: { fontFamily: FontFamily.bodyBold, color: '#1B1C1C' },
  total: { fontFamily: FontFamily.displayBold, fontSize: 19, color: Colors.primary },
  divider: { height: 1, backgroundColor: '#EFECEB' },
  notice: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#5F5E5E',
    padding: 11,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  unavailableCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    gap: 10,
    ...Shadow,
  },
  unavailableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unavailableTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#92400E',
  },
  unavailableDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#78350F',
  },
  exploreOtherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  exploreOtherBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 80,
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadow,
  },
  bottomLabel: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E' },
  bottomPrice: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    color: Colors.primary,
    marginTop: 2,
  },
});
