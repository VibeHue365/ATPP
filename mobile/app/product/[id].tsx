import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
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
import { photographerApi } from '@/apis/photographerApi';
import { DateSelector } from '@/components/product/DateSelector';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductInsights } from '@/components/product/ProductInsights';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useAvailability, useProductDetail } from '@/hooks/useProductDetail';
import type { Photographer } from '@/types/photographer';
import {
  applyCampaignToRate,
  calculateDailyRentalTotal,
  formatCampaignPercent,
  formatCampaignRange,
  isSurchargeCampaign,
  resolveHourlyRate,
} from '@/utils/campaignPricing';
import { getMediaUrl } from '@/utils/media';

const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

const COLOR_PALETTE: Record<string, { hex: string; name: string; border?: string }> = {
  RED: { hex: '#BA0049', name: 'Đỏ Cố Đô' },
  PINK: { hex: '#F472B6', name: 'Hồng phấn' },
  GOLD: { hex: '#D97706', name: 'Vàng kim' },
  WHITE: { hex: '#F9FAFB', name: 'Trắng ngà', border: '#D1D5DB' },
  BLACK: { hex: '#1F2937', name: 'Đen tuyền' },
  BLUE: { hex: '#2563EB', name: 'Xanh lam' },
  GREEN: { hex: '#059669', name: 'Xanh ngọc' },
  YELLOW: { hex: '#EAB308', name: 'Vàng tươi' },
  PURPLE: { hex: '#7C3AED', name: 'Tím Huế' },
  ORANGE: { hex: '#EA580C', name: 'Cam' },
};

function getColorMeta(raw: string) {
  const key = raw.trim().toUpperCase();
  return COLOR_PALETTE[key] || { hex: '#BA0049', name: raw };
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'FREE'];
function sortSizes(sizes: string[] = []) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.trim().toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.trim().toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function formatDateDisplay(iso: string) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}

const SIZE_CHART = [
  { size: 'S', height: '150–158 cm', weight: '40–47 kg', bust: '78–83 cm', waist: '60–65 cm' },
  { size: 'M', height: '155–163 cm', weight: '48–54 kg', bust: '84–88 cm', waist: '66–70 cm' },
  { size: 'L', height: '158–167 cm', weight: '55–61 kg', bust: '89–93 cm', waist: '71–76 cm' },
  { size: 'XL', height: '160–172 cm', weight: '62–68 kg', bust: '94–99 cm', waist: '77–83 cm' },
  { size: 'XXL', height: '165–178 cm', weight: '69–78 kg', bust: '100–106 cm', waist: '84–90 cm' },
];

function recommendAoDaiSize(
  heightCm: number,
  weightKg: number,
  bustCm?: number,
  waistCm?: number,
  availableSizes: string[] = []
): { size: string; reason: string; matchedInStock: boolean } {
  let score = 0;
  if (weightKg <= 47 && heightCm <= 158) score = 0;
  else if (weightKg <= 54 && heightCm <= 164) score = 1;
  else if (weightKg <= 61 && heightCm <= 168) score = 2;
  else if (weightKg <= 68 && heightCm <= 174) score = 3;
  else score = 4;

  if (bustCm && bustCm > 94) score = Math.max(score, 3);
  else if (bustCm && bustCm > 88) score = Math.max(score, 2);
  else if (bustCm && bustCm > 83) score = Math.max(score, 1);

  if (waistCm && waistCm > 77) score = Math.max(score, 3);
  else if (waistCm && waistCm > 71) score = Math.max(score, 2);
  else if (waistCm && waistCm > 65) score = Math.max(score, 1);

  const order = ['S', 'M', 'L', 'XL', 'XXL'];
  const ideal = order[Math.min(score, order.length - 1)];
  const normalizedAvailable = availableSizes.map((s) => s.trim().toUpperCase());

  if (normalizedAvailable.length === 0 || normalizedAvailable.includes(ideal)) {
    return {
      size: ideal,
      reason: `Phù hợp chuẩn phom cổ phục với chiều cao ${heightCm}cm, cân nặng ${weightKg}kg${bustCm ? `, vòng ngực ${bustCm}cm` : ''}.`,
      matchedInStock: true,
    };
  }

  const closest =
    availableSizes.find((s) => order.indexOf(s.toUpperCase()) >= score) ??
    availableSizes[availableSizes.length - 1] ??
    ideal;

  return {
    size: closest,
    reason: `Phom chuẩn của bạn là ${ideal}, hiện mẫu này còn size gần nhất là ${closest} (cổ phục dáng suông dễ mặc).`,
    matchedInStock: false,
  };
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { product, reviews, related, loading, error, reload } = useProductDetail(id);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [mode, setMode] = useState<'DAILY' | 'HOURLY'>('DAILY');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [suggestedPhotographers, setSuggestedPhotographers] = useState<Photographer[]>([]);

  // AI Size Modal state
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [heightInput, setHeightInput] = useState('160');
  const [weightInput, setWeightInput] = useState('50');
  const [bustInput, setBustInput] = useState('');
  const [waistInput, setWaistInput] = useState('');

  const { addItem, count } = useCart();
  const { show } = useToast();
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();

  useEffect(() => {
    let active = true;
    photographerApi
      .list({ page: 1, limit: 6, sort: 'rating_desc' })
      .then((res) => {
        if (active) setSuggestedPhotographers(res.data ?? []);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  const chosenSize = size || product?.sizes?.[0] || '';
  const chosenColor = color || product?.colors?.[0] || '';

  const input = useMemo(
    () =>
      product && start && (mode === 'HOURLY' || end)
        ? {
            size: chosenSize,
            color: chosenColor,
            rentalFrom: start,
            rentalTo: mode === 'HOURLY' ? start : end,
            quantity: 1,
            rentalType: mode,
            startTime: mode === 'HOURLY' ? startTime : undefined,
            endTime: mode === 'HOURLY' ? endTime : undefined,
          }
        : null,
    [product, start, end, mode, chosenSize, chosenColor, startTime, endTime]
  );

  const availability = useAvailability(id, input);

  const aiRecommendation = useMemo(() => {
    const h = Number(heightInput);
    const w = Number(weightInput);
    const b = bustInput ? Number(bustInput) : undefined;
    const wa = waistInput ? Number(waistInput) : undefined;
    if (!Number.isFinite(h) || h < 120 || h > 210 || !Number.isFinite(w) || w < 30 || w > 130) {
      return null;
    }
    return recommendAoDaiSize(h, w, b, wa, product?.sizes ?? []);
  }, [heightInput, weightInput, bustInput, waistInput, product?.sizes]);

  if (loading) return <LoadingState label="Đang tải thông tin cổ phục..." />;
  if (error || !product)
    return <ErrorState message={error ?? 'Không tìm thấy sản phẩm'} onRetry={reload} />;

  const provider = typeof product.providerId === 'object' ? product.providerId : undefined;
  const liked = isFavorite('PRODUCT', product._id);

  const favorite = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as Href);
      return;
    }
    try {
      await toggleFavorite('PRODUCT', product._id);
      show(liked ? 'Đã bỏ khỏi yêu thích' : 'Đã lưu vào bộ sưu tập yêu thích', 'success');
    } catch {
      show('Không thể cập nhật yêu thích', 'error');
    }
  };

  // Giá theo ngày thuê, áp chiến dịch giảm/phụ thu của shop cùng công thức với backend (VIB-43).
  const campaign = product.activeCampaign;
  const surcharge = isSurchargeCampaign(campaign);
  const hourlyRate = applyCampaignToRate(
    resolveHourlyRate(product.basePrice, product.hourlyPrice),
    campaign,
    start || new Date()
  );
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const rentalHours = Math.max(1, (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60);
  const daily =
    mode === 'DAILY' && start && end
      ? calculateDailyRentalTotal(product.basePrice, campaign, start, end)
      : null;
  const rentalDays = daily?.days ?? 1;

  const currentRentalPrice =
    mode === 'HOURLY'
      ? hourlyRate * rentalHours
      : (daily?.total ?? applyCampaignToRate(product.basePrice, campaign, start || new Date()));

  const add = (goToCart = false) => {
    if (!start || (mode === 'DAILY' && !end)) {
      show('Vui lòng chọn ngày nhận và ngày trả trang phục', 'error');
      return;
    }
    if (availability.state !== 'available') {
      show(availability.result?.message ?? 'Lịch thuê chưa được xác nhận còn trống', 'error');
      return;
    }

    addItem({
      itemType: 'PRODUCT',
      productId: product._id,
      name: product.name,
      image: product.images?.[0],
      basePrice: currentRentalPrice,
      depositAmount: product.depositAmount,
      size: chosenSize,
      color: chosenColor,
      rentalFrom: start,
      rentalTo: mode === 'HOURLY' ? start : end,
      rentalType: mode,
      startTime: mode === 'HOURLY' ? startTime : null,
      endTime: mode === 'HOURLY' ? endTime : null,
      providerAddress: provider?.address?.addressLine,
      metadata: {
        providerId: provider?._id,
        unitPrice: mode === 'HOURLY' ? hourlyRate : Math.round(currentRentalPrice / rentalDays),
        rentalDays,
        rentalHours,
      },
    });
    show('Đã thêm cổ phục vào giỏ hàng', 'success');
    if (goToCart) {
      router.push('/cart' as Href);
    }
  };

  const sortedSizes = sortSizes(product.sizes ?? []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Top Header Floating Navigation */}
      <Header liked={liked} count={count} onFavorite={favorite} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* 1. Hero Lookbook Gallery */}
        <ProductGallery images={product.images ?? []} />

        <View style={s.pad}>
          {/* 2. Provider identity & Verified Badge */}
          <View style={s.storeMetaRow}>
            <Pressable
              disabled={!provider?._id}
              onPress={() => router.push(`/store/${provider?._id}` as Href)}
              style={s.storeChip}
            >
              <View style={s.storeIconCircle}>
                <Ionicons name="storefront" size={12} color={Colors.primary} />
              </View>
              <Text style={s.providerName} numberOfLines={1}>
                {provider?.businessName ?? 'TÀGO ATELIER'}
              </Text>
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
              <Ionicons name="chevron-forward" size={11} color="#8F8E8E" />
            </Pressable>

            <View style={s.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={s.ratingText}>
                {product.rating?.averageRating?.toFixed(1) ?? '5.0'}
              </Text>
              <Text style={s.ratingReviewsCount}>({product.rating?.totalReviews ?? 0})</Text>
            </View>
          </View>

          {/* 3. Product Name Title */}
          <Text style={s.title}>{product.name}</Text>

          {/* 4. Price & Deposit Banner */}
          <View style={s.priceContainer}>
            <View style={s.priceRow}>
              <Text style={s.priceValue}>{money(product.basePrice)}</Text>
              <Text style={s.priceUnit}> /ngày</Text>
            </View>
            {campaign ? (
              <Text style={[s.campaignNote, surcharge && s.surchargeNote]}>
                {surcharge ? 'Phụ thu' : 'Ưu đãi'} {formatCampaignPercent(campaign)} · {campaign.occasion} (
                {formatCampaignRange(campaign)})
              </Text>
            ) : null}
            <View style={s.depositBadgePill}>
              <Ionicons name="shield-checkmark" size={12} color="#059669" />
              <Text style={s.depositBadgeText}>
                Cọc giữ đồ: {money(product.depositAmount ?? 0)} (Hoàn 100%)
              </Text>
            </View>
          </View>

          {/* 5. AI Innovation Quick Bar */}
          <View style={s.aiQuickBar}>
            <Pressable
              style={s.aiQuickBtn}
              onPress={() =>
                router.push({
                  pathname: '/virtual-tryon',
                  params: {
                    productId: product._id,
                    name: product.name,
                    image: product.images?.[0] ?? '',
                  },
                } as unknown as Href)
              }
            >
              <View style={s.aiIconWrap}>
                <Ionicons name="camera-outline" size={15} color="#BA0049" />
              </View>
              <View style={s.aiQuickBtnCol}>
                <Text style={s.aiQuickBtnTitle}>Thử Đồ AI 2D</Text>
                <Text style={s.aiQuickBtnSub}>Ướm lên ảnh chân dung</Text>
              </View>
              <Ionicons name="chevron-forward" size={13} color="#BA0049" />
            </Pressable>

            <View style={s.aiBarDivider} />

            <Pressable style={s.aiQuickBtn} onPress={() => setSizeModalOpen(true)}>
              <View style={[s.aiIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <MaterialCommunityIcons name="human-male-height" size={16} color="#7C3AED" />
              </View>
              <View style={s.aiQuickBtnCol}>
                <Text style={s.aiQuickBtnTitle}>AI Tư Vấn Size</Text>
                <Text style={s.aiQuickBtnSub}>Gợi ý chuẩn số đo</Text>
              </View>
              <Ionicons name="chevron-forward" size={13} color="#7C3AED" />
            </Pressable>
          </View>

          <ProductInsights product={product} />
        </View>

        {/* 6. Selection Section: Hình thức, Màu sắc, Size, Lịch */}
        <View style={s.selectorSection}>
          {/* Mode Switch (Ngày vs Giờ) */}
          <View style={s.modeToggleWrap}>
            <Pressable
              style={[s.modeToggleBtn, mode === 'DAILY' && s.modeToggleBtnActive]}
              onPress={() => {
                setMode('DAILY');
                setStart('');
                setEnd('');
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={mode === 'DAILY' ? '#FFFFFF' : '#5F5E5E'}
              />
              <Text
                style={[s.modeToggleBtnText, mode === 'DAILY' && s.modeToggleBtnTextActive]}
              >
                Thuê theo ngày
              </Text>
            </Pressable>

            <Pressable
              style={[s.modeToggleBtn, mode === 'HOURLY' && s.modeToggleBtnActive]}
              onPress={() => {
                setMode('HOURLY');
                setStart('');
                setEnd('');
              }}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={mode === 'HOURLY' ? '#FFFFFF' : '#5F5E5E'}
              />
              <Text
                style={[s.modeToggleBtnText, mode === 'HOURLY' && s.modeToggleBtnTextActive]}
              >
                Thuê theo giờ
              </Text>
            </Pressable>
          </View>

          {/* Color Swatches */}
          {product.colors && product.colors.length > 0 && (
            <View style={s.selectorGroup}>
              <View style={s.selectorTitleRow}>
                <Text style={s.selectorTitle}>MÀU SẮC</Text>
                <Text style={s.selectorSelectedVal}>
                  {getColorMeta(chosenColor).name}
                </Text>
              </View>
              <View style={s.colorSwatchesRow}>
                {product.colors.map((c) => {
                  const meta = getColorMeta(c);
                  const isSelected = chosenColor === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      style={[
                        s.colorSwatchItem,
                        isSelected && s.colorSwatchItemActive,
                      ]}
                    >
                      <View
                        style={[
                          s.colorCircle,
                          { backgroundColor: meta.hex },
                          meta.border ? { borderWidth: 1, borderColor: meta.border } : null,
                        ]}
                      />
                      <Text
                        style={[
                          s.colorSwatchLabel,
                          isSelected && s.colorSwatchLabelActive,
                        ]}
                      >
                        {meta.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Size Pills */}
          <View style={s.selectorGroup}>
            <View style={s.selectorTitleRow}>
              <Text style={s.selectorTitle}>CHỌN KÍCH CỠ (SIZE)</Text>
              <Pressable style={s.sizeGuideBtn} onPress={() => setSizeModalOpen(true)}>
                <Ionicons name="resize-outline" size={12} color={Colors.primary} />
                <Text style={s.sizeGuideText}>Bảng size & số đo ›</Text>
              </Pressable>
            </View>
            <View style={s.sizePillsRow}>
              {sortedSizes.map((item) => {
                const isSelected = chosenSize === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setSize(item)}
                    style={[s.sizePill, isSelected && s.sizePillActive]}
                  >
                    <Text style={[s.sizePillText, isSelected && s.sizePillTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Date & Time Selector */}
          <View style={s.selectorGroup}>
            <View style={s.selectorTitleRow}>
              <Text style={s.selectorTitle}>LỊCH TRÌNH THUÊ</Text>
              <Text style={s.selectorHelpHint}>
                {mode === 'DAILY' ? 'Chọn ngày nhận & ngày trả' : 'Chọn ngày & khung giờ'}
              </Text>
            </View>

            {/* Date Range Card */}
            <View style={s.dateRangeCard}>
              <View style={s.dateRangeCol}>
                <Text style={s.dateRangeLabel}>NGÀY NHẬN</Text>
                <Text style={[s.dateRangeVal, !start && s.dateRangeValPlaceholder]}>
                  {start ? formatDateDisplay(start) : 'Chọn ngày'}
                </Text>
              </View>

              <View style={s.dateRangeArrowWrap}>
                <Ionicons name="arrow-forward" size={16} color="#BA0049" />
                <Text style={s.dateRangeSummaryText}>
                  {mode === 'DAILY'
                    ? start && end
                      ? `${rentalDays} ngày`
                      : '—'
                    : '1 buổi'}
                </Text>
              </View>

              <View style={s.dateRangeCol}>
                <Text style={s.dateRangeLabel}>
                  {mode === 'HOURLY' ? 'GIỜ THUÊ' : 'NGÀY TRẢ'}
                </Text>
                <Text style={[s.dateRangeVal, !(mode === 'HOURLY' ? startTime : end) && s.dateRangeValPlaceholder]}>
                  {mode === 'HOURLY'
                    ? `${startTime}–${endTime}`
                    : end
                    ? formatDateDisplay(end)
                    : 'Chọn ngày'}
                </Text>
              </View>
            </View>

            <DateSelector
              start={start}
              end={mode === 'HOURLY' ? start : end}
              onChange={(a, b) => {
                setStart(a);
                setEnd(b);
              }}
            />

            {mode === 'HOURLY' && (
              <View style={s.timeSlotsRow}>
                {['08:00–10:00', '10:00–12:00', '14:00–16:00', '16:00–18:00'].map((slot) => {
                  const [a, b] = slot.split('–');
                  const isSelected = startTime === a;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => {
                        setStartTime(a);
                        setEndTime(b);
                      }}
                      style={[s.timeSlotPill, isSelected && s.timeSlotPillActive]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isSelected ? '#FFFFFF' : '#5F5E5E'}
                      />
                      <Text style={[s.timeSlotText, isSelected && s.timeSlotTextActive]}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Availability state={availability.state} result={availability.result} />
          </View>

          {/* Store Pickup Location */}
          <View style={s.pickupCard}>
            <View style={s.pickupIconCircle}>
              <Ionicons name="location-sharp" size={16} color="#BA0049" />
            </View>
            <View style={s.pickupTextCol}>
              <Text style={s.pickupTitle}>Nhận và trả trang phục tại tiệm</Text>
              <Text style={s.pickupAddress} numberOfLines={2}>
                {provider?.address?.addressLine ??
                  'Địa chỉ chi tiết hiển thị sau khi hoàn tất thanh toán cọc'}
              </Text>
            </View>
          </View>
        </View>

        {/* 7. Package Inclusions & Heritage Info */}
        <View style={s.heritageSection}>
          <Text style={s.heritageHeading}>Trọn bộ trang phục bao gồm</Text>
          <View style={s.inclusionsGrid}>
            <View style={s.inclusionItem}>
              <MaterialCommunityIcons name="hanger" size={16} color="#BA0049" />
              <Text style={s.inclusionText}>Áo dài cổ phục chuẩn phom</Text>
            </View>
            <View style={s.inclusionItem}>
              <MaterialCommunityIcons name="layers-outline" size={16} color="#BA0049" />
              <Text style={s.inclusionText}>Quần lụa tơ tằm mềm mại</Text>
            </View>
            <View style={s.inclusionItem}>
              <Ionicons name="sparkles-outline" size={15} color="#BA0049" />
              <Text style={s.inclusionText}>Mấn đội đầu / Khăn vấn</Text>
            </View>
            <View style={s.inclusionItem}>
              <MaterialIcons name="auto-awesome" size={15} color="#BA0049" />
              <Text style={s.inclusionText}>Phụ kiện phối kèm (Quạt, kiềng)</Text>
            </View>
          </View>

          <View style={s.dividerLine} />

          <Text style={s.heritageHeading}>Chi tiết & Chất liệu</Text>
          <Text style={s.heritageBody}>
            {product.description ||
              'Trang phục cổ phục được các nghệ nhân may đo tỉ mỉ, chất vải gấm Cung Đình dệt nổi chỉ kim, lưu giữ trọn vẹn nét đẹp văn hóa xứ Huế.'}
          </Text>

          <View style={s.dividerLine} />

          <Text style={s.heritageHeading}>Cam kết & Chính sách thuê TàGo</Text>
          {[
            'Giữ lịch độc quyền ngay sau khi thanh toán cọc',
            'Hỗ trợ thử và chỉnh sửa nhẹ kích cỡ tại tiệm khi nhận đồ',
            'Trang phục đã được giặt hấp thơm tho trước khi bàn giao',
            'Hoàn trả 100% tiền cọc ngay sau khi trả đồ & đối soát',
          ].map((v, i) => (
            <View key={v} style={s.policyRow}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={s.policyText}>{v}</Text>
            </View>
          ))}
        </View>

        {/* 8. Suggested Photographers (COMPACT HORIZONTAL CAROUSEL) */}
        {suggestedPhotographers.length > 0 && (
          <View style={s.relatedSection}>
            <View style={s.relatedHeaderRow}>
              <View>
                <Text style={s.relatedEyebrow}>TRỌN VẸN KHOẢNH KHẮC</Text>
                <Text style={s.relatedTitle}>Gợi ý Thợ ảnh cùng concept</Text>
              </View>
              <Pressable onPress={() => router.push('/(tabs)/photography' as Href)}>
                <Text style={s.seeAllLink}>Xem tất cả ›</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.miniPhotoCarouselScroll}
            >
              {suggestedPhotographers.map((photographer) => {
                const pack = photographer.defaultPackage ?? photographer.packages?.[0];
                const rawCover =
                  photographer.coverImage ||
                  pack?.images?.[0] ||
                  photographer.media?.coverUrl ||
                  photographer.media?.images?.[0];
                const coverUri = getMediaUrl(rawCover);
                const price = pack?.price ?? 0;
                const avgRating = photographer.rating?.averageRating ?? 5.0;

                return (
                  <Pressable
                    key={photographer._id}
                    style={s.miniPhotoCard}
                    onPress={() =>
                      router.push(
                        `/photographer/${photographer._id}?packageId=${pack?._id ?? ''}` as unknown as Href
                      )
                    }
                  >
                    <View style={s.miniPhotoImgWrap}>
                      {coverUri ? (
                        <Image
                          source={coverUri}
                          style={s.miniPhotoImg}
                          contentFit="cover"
                          transition={180}
                        />
                      ) : (
                        <View style={[s.miniPhotoImg, s.placeholderCenter]}>
                          <Ionicons name="camera" size={24} color="#BA0049" />
                        </View>
                      )}
                      <View style={s.miniPhotoRatingPill}>
                        <Ionicons name="star" size={10} color="#F59E0B" />
                        <Text style={s.miniPhotoRatingText}>{avgRating.toFixed(1)}</Text>
                      </View>
                    </View>
                    <View style={s.miniPhotoBody}>
                      <Text style={s.miniPhotoName} numberOfLines={1}>
                        {photographer.businessName || 'Studio Cố Đô'}
                      </Text>
                      <Text style={s.miniPhotoSpecialty} numberOfLines={1}>
                        {pack?.name || 'Gói chụp cổ phục'}
                      </Text>
                      <View style={s.miniPhotoFooter}>
                        <Text style={s.miniPhotoPrice}>
                          {price > 0 ? money(price) : 'Liên hệ'}
                        </Text>
                        <View style={s.miniPhotoCtaBtn}>
                          <Text style={s.miniPhotoCtaText}>Ghép thợ</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 9. Reviews Section */}
        <ProductReviews reviews={reviews} rating={product.rating?.averageRating ?? 0} />

        {/* 10. Related Products */}
        {related.length > 0 && (
          <View style={[s.relatedSection, s.relatedProductsSection]}>
            <View style={s.relatedHeaderRow}>
              <View>
                <Text style={s.relatedEyebrow}>BỘ SƯU TẬP CÙNG PHONG CÁCH</Text>
                <Text style={s.relatedTitle}>Cổ phục tương tự</Text>
              </View>
            </View>
            <View style={s.grid}>
              {related.map((item) => (
                <ProductCard key={item._id} product={item} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 11. Bottom Sticky Action Bar */}
      <View style={s.bottomBar}>
        <Pressable style={s.bottomCartBtn} onPress={() => router.push('/cart' as Href)}>
          <Ionicons name="bag-handle-outline" size={20} color={Colors.primary} />
          {count > 0 ? (
            <View style={s.bottomCartBadge}>
              <Text style={s.bottomCartBadgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          disabled={availability.state === 'checking' || availability.state === 'unavailable'}
          style={[
            s.bottomSecondaryBtn,
            (availability.state === 'checking' || availability.state === 'unavailable') &&
              s.bottomBtnDisabled,
          ]}
          onPress={() => add(false)}
        >
          <Ionicons name="cart-outline" size={17} color={Colors.primary} />
          <Text style={s.bottomSecondaryBtnText}>Thêm giỏ</Text>
        </Pressable>

        <Pressable
          disabled={availability.state === 'checking' || availability.state === 'unavailable'}
          style={[
            s.bottomPrimaryBtn,
            (availability.state === 'checking' || availability.state === 'unavailable') &&
              s.bottomBtnDisabled,
          ]}
          onPress={() => add(true)}
        >
          <Text style={s.bottomPrimaryBtnText}>THUÊ NGAY</Text>
          <Text style={s.bottomPrimaryBtnPrice}>• {money(currentRentalPrice)}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* AI Size Calculator & Size Chart Modal */}
      <Modal
        visible={sizeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSizeModalOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalEyebrow}>AI FIT ASSISTANT</Text>
                <Text style={s.modalTitle}>Gợi ý Size & Bảng số đo Cổ phục</Text>
              </View>
              <Pressable onPress={() => setSizeModalOpen(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color="#1B1C1C" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <View style={s.measureGrid}>
                <View style={s.measureField}>
                  <Text style={s.measureLabel}>CHIỀU CAO (CM) *</Text>
                  <TextInput
                    value={heightInput}
                    onChangeText={setHeightInput}
                    keyboardType="numeric"
                    placeholder="160"
                    style={s.measureInput}
                  />
                </View>
                <View style={s.measureField}>
                  <Text style={s.measureLabel}>CÂN NẶNG (KG) *</Text>
                  <TextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="numeric"
                    placeholder="50"
                    style={s.measureInput}
                  />
                </View>
                <View style={s.measureField}>
                  <Text style={s.measureLabel}>VÒNG NGỰC (CM)</Text>
                  <TextInput
                    value={bustInput}
                    onChangeText={setBustInput}
                    keyboardType="numeric"
                    placeholder="84 (Tùy chọn)"
                    style={s.measureInput}
                  />
                </View>
                <View style={s.measureField}>
                  <Text style={s.measureLabel}>VÒNG EO (CM)</Text>
                  <TextInput
                    value={waistInput}
                    onChangeText={setWaistInput}
                    keyboardType="numeric"
                    placeholder="66 (Tùy chọn)"
                    style={s.measureInput}
                  />
                </View>
              </View>

              {aiRecommendation ? (
                <View style={s.aiResultBox}>
                  <View style={s.aiResultHeader}>
                    <View style={s.aiSizeBadge}>
                      <Text style={s.aiSizeBadgeText}>SIZE {aiRecommendation.size}</Text>
                    </View>
                    <Text style={s.aiResultTitle}>Đề xuất phù hợp nhất cho bạn</Text>
                  </View>
                  <Text style={s.aiResultReason}>{aiRecommendation.reason}</Text>
                  <Pressable
                    style={s.applySizeBtn}
                    onPress={() => {
                      setSize(aiRecommendation.size);
                      setSizeModalOpen(false);
                      show(`Đã chọn size ${aiRecommendation.size}`, 'success');
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={s.applySizeBtnText}>
                      Áp dụng Size {aiRecommendation.size}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={s.chartHeading}>BẢNG THÔNG SỐ ĐO CỔ PHỤC CHUẨN</Text>
              <View style={s.chartTable}>
                <View style={[s.chartRow, s.chartHeaderRow]}>
                  <Text style={[s.chartHeaderCell, s.chartSizeCol, { flex: 0.6 }]}>Size</Text>
                  <Text style={s.chartHeaderCell}>Chiều cao</Text>
                  <Text style={s.chartHeaderCell}>Cân nặng</Text>
                  <Text style={s.chartHeaderCell}>Ngực / Eo</Text>
                </View>
                {SIZE_CHART.map((row) => (
                  <View
                    key={row.size}
                    style={[
                      s.chartRow,
                      aiRecommendation?.size === row.size && s.chartRowHighlight,
                    ]}
                  >
                    <Text style={[s.chartCell, s.chartSizeCol, { flex: 0.6 }]}>{row.size}</Text>
                    <Text style={s.chartCell}>{row.height}</Text>
                    <Text style={s.chartCell}>{row.weight}</Text>
                    <Text style={s.chartCell}>
                      {row.bust.replace(' cm', '')} / {row.waist}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({
  liked,
  count,
  onFavorite,
}: {
  liked: boolean;
  count: number;
  onFavorite: () => void;
}) {
  return (
    <View style={s.top}>
      <Pressable onPress={() => router.back()} style={s.roundBtn}>
        <Ionicons name="chevron-back" size={20} color="#1B1C1C" />
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={s.brandTitle}>TàGo</Text>
        <Text style={s.brandSubtitle}>CỔ PHỤC & DI SẢN</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onFavorite} style={s.roundBtn}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={19}
            color={liked ? Colors.primary : '#1B1C1C'}
          />
        </Pressable>
        <Pressable onPress={() => router.push('/cart' as Href)} style={s.roundBtn}>
          <Ionicons name="bag-handle-outline" size={19} color="#1B1C1C" />
          {count > 0 ? (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{count > 9 ? '9+' : count}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

function Availability({
  state,
  result,
}: {
  state: string;
  result: { availableQuantity: number; message?: string } | null;
}) {
  if (state === 'idle') return null;
  if (state === 'checking')
    return (
      <View style={s.notice}>
        <Text style={s.noticeText}>Đang kiểm tra lịch trống tại tiệm...</Text>
      </View>
    );
  if (state === 'available')
    return (
      <View style={[s.notice, s.noticeOk]}>
        <StatusBadge label="Còn lịch trống" tone="success" />
        <Text style={s.noticeOkText}>
          Còn {result?.availableQuantity ?? 1} bộ sẵn sàng cho ngày bạn chọn.
        </Text>
      </View>
    );
  return (
    <View style={[s.notice, s.noticeBad]}>
      <StatusBadge label="Tạm hết lịch" tone="error" />
      <Text style={s.noticeBadText}>
        {result?.message ?? 'Vui lòng đổi ngày, giờ hoặc chọn kích cỡ khác.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  content: { paddingBottom: 110 },
  placeholderCenter: { alignItems: 'center', justifyContent: 'center' },

  /* Top Navigation */
  top: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 190, 195, 0.25)',
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  brandTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8F8E8E',
  },

  /* Product Details & Hero */
  pad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  storeIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#1B1C1C',
    maxWidth: 130,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#B45309',
  },
  ratingReviewsCount: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8F8E8E',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    lineHeight: 28,
    color: '#1B1C1C',
    marginTop: 10,
  },

  /* Price Container */
  priceContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 22,
    color: '#BA0049',
  },
  priceUnit: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#8F8E8E',
  },
  campaignNote: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.success,
    marginTop: 4,
  },
  surchargeNote: {
    color: Colors.warning,
  },
  depositBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF9F2',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  depositBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    color: '#059669',
  },

  /* AI Innovation Quick Bar */
  aiQuickBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1.5,
  },
  aiQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiQuickBtnCol: {
    flex: 1,
  },
  aiQuickBtnTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  aiQuickBtnSub: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#8F8E8E',
    marginTop: 1,
  },
  aiBarDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#EFECEB',
    marginHorizontal: 10,
    alignSelf: 'center',
  },

  /* Selection Section */
  selectorSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
    gap: 16,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },

  /* Mode Toggle */
  modeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#F5F3F3',
    borderRadius: 12,
    padding: 3,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeToggleBtnActive: {
    backgroundColor: '#BA0049',
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  modeToggleBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  modeToggleBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },

  /* Selector Sub-Groups */
  selectorGroup: {
    gap: 8,
  },
  selectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
    letterSpacing: 0.5,
  },
  selectorSelectedVal: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#BA0049',
  },
  selectorHelpHint: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8F8E8E',
  },

  /* Color Swatches */
  colorSwatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  colorSwatchItemActive: {
    borderColor: '#BA0049',
    backgroundColor: '#FFF0F3',
  },
  colorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorSwatchLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
  },
  colorSwatchLabelActive: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },

  /* Size Pills */
  sizeGuideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sizeGuideText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.primary,
  },
  sizePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizePill: {
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePillActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  sizePillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  sizePillTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },

  /* Date Range Card */
  dateRangeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(186, 0, 73, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateRangeCol: {
    flex: 1,
  },
  dateRangeLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#8F8E8E',
    letterSpacing: 0.6,
  },
  dateRangeVal: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
    marginTop: 2,
  },
  dateRangeValPlaceholder: {
    color: '#BA0049',
    fontFamily: FontFamily.bodyMedium,
    fontStyle: 'italic',
  },
  dateRangeArrowWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  dateRangeSummaryText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#BA0049',
    marginTop: 2,
  },
  timeSlotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  timeSlotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  timeSlotPillActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  timeSlotText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
  },
  timeSlotTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },

  /* Availability Notice */
  notice: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#F5F3F3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  noticeOk: { backgroundColor: '#EDF9F2' },
  noticeBad: { backgroundColor: '#FDECEE' },
  noticeOkText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.success,
    flex: 1,
  },
  noticeBadText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.error,
    flex: 1,
  },

  /* Pickup Card */
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF0F3',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  pickupIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupTextCol: {
    flex: 1,
  },
  pickupTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  pickupAddress: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 1,
  },

  /* Heritage Inclusions & Policies */
  heritageSection: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1.5,
  },
  heritageHeading: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    color: '#1B1C1C',
    marginBottom: 8,
  },
  inclusionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inclusionItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  inclusionText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    color: '#1B1C1C',
    flex: 1,
  },
  dividerLine: {
    height: 1,
    backgroundColor: 'rgba(227, 190, 195, 0.25)',
    marginVertical: 14,
  },
  heritageBody: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  policyText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#1B1C1C',
    flex: 1,
  },

  /* Suggested Photographers (Compact Carousel) */
  relatedSection: {
    paddingTop: 16,
  },
  relatedProductsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.25)',
  },
  relatedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  relatedEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.primary,
  },
  relatedTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    marginTop: 2,
  },
  seeAllLink: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  miniPhotoCarouselScroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  miniPhotoCard: {
    width: 210,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  miniPhotoImgWrap: {
    width: '100%',
    height: 115,
    position: 'relative',
    backgroundColor: '#EFEDED',
  },
  miniPhotoImg: {
    width: '100%',
    height: '100%',
  },
  miniPhotoRatingPill: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(27, 28, 28, 0.72)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  miniPhotoRatingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  miniPhotoBody: {
    padding: 10,
    gap: 3,
  },
  miniPhotoName: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    color: '#1B1C1C',
  },
  miniPhotoSpecialty: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8F8E8E',
  },
  miniPhotoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.22)',
  },
  miniPhotoPrice: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#BA0049',
  },
  miniPhotoCtaBtn: {
    backgroundColor: '#BA0049',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  miniPhotoCtaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },

  /* Related Products Grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },

  /* Bottom Sticky Bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.3)',
    ...Shadow,
  },
  bottomCartBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bottomCartBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    color: '#FFFFFF',
  },
  bottomSecondaryBtn: {
    height: 44,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  bottomSecondaryBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  bottomPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  bottomPrimaryBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  bottomPrimaryBtnPrice: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#FFD9DE',
  },
  bottomBtnDisabled: { opacity: 0.45 },

  /* Size Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 28, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  modalEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  modalTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    marginTop: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  measureField: {
    width: '48%',
    gap: 4,
  },
  measureLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#5F5E5E',
  },
  measureInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 10,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  aiResultBox: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiSizeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  aiSizeBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  aiResultTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  aiResultReason: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
  },
  applySizeBtn: {
    marginTop: 4,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applySizeBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  chartHeading: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: '#8F8E8E',
    marginTop: 4,
  },
  chartTable: {
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  chartRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  chartHeaderRow: {
    backgroundColor: '#F5F3F3',
    borderTopWidth: 0,
  },
  chartRowHighlight: {
    backgroundColor: '#FFF0F3',
  },
  chartCell: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
  },
  chartHeaderCell: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#1B1C1C',
  },
  chartSizeCol: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
});
