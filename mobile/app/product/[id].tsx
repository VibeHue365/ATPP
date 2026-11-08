import { Ionicons } from '@expo/vector-icons';
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
import { PhotographyCard } from '@/components/photographer/PhotographyCard';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useAvailability, useProductDetail } from '@/hooks/useProductDetail';
import type { Photographer } from '@/types/photographer';

const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

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
      .list({ page: 1, limit: 2, sort: 'rating_desc' })
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

  const add = (goToCart = false) => {
    if (!start || (mode === 'DAILY' && !end)) {
      show('Vui lòng chọn đầy đủ ngày thuê cổ phục', 'error');
      return;
    }
    if (availability.state !== 'available') {
      show(availability.result?.message ?? 'Lịch thuê chưa được xác nhận còn trống', 'error');
      return;
    }
    const dailyPrice = product.discountedPrice ?? product.basePrice;
    const days =
      mode === 'DAILY'
        ? Math.max(
            1,
            Math.round(
              (new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) /
                86400000
            ) + 1
          )
        : 1;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const hours = Math.max(1, (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60);
    const rentalPrice =
      mode === 'HOURLY'
        ? (product.hourlyPrice ?? Math.round(product.basePrice * 0.3)) * hours
        : dailyPrice * days;

    addItem({
      itemType: 'PRODUCT',
      productId: product._id,
      name: product.name,
      image: product.images?.[0],
      basePrice: rentalPrice,
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
        unitPrice:
          mode === 'HOURLY'
            ? product.hourlyPrice ?? Math.round(product.basePrice * 0.3)
            : dailyPrice,
        rentalDays: days,
        rentalHours: hours,
      },
    });
    show('Đã thêm cổ phục vào giỏ hàng', 'success');
    if (goToCart) {
      router.push('/cart' as Href);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header liked={liked} count={count} onFavorite={favorite} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <ProductGallery images={product.images ?? []} />

        <View style={s.pad}>
          {/* Store Banner Pill */}
          <Pressable
            disabled={!provider?._id}
            onPress={() => router.push(`/store/${provider?._id}` as Href)}
            style={s.storeLink}>
            <View style={s.storeLinkLeft}>
              <View style={s.storeBadgeIcon}>
                <Ionicons name="storefront" size={14} color={Colors.primary} />
              </View>
              <Text style={s.provider} numberOfLines={1}>
                {provider?.businessName ?? 'TÀGO ATELIER'}
              </Text>
              <View style={s.verifiedPill}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={s.verified}>Đã xác minh</Text>
              </View>
            </View>
            {provider?._id ? <Text style={s.viewStore}>Xem tiệm ›</Text> : null}
          </Pressable>

          <Text style={s.title}>{product.name}</Text>

          <View style={s.ratingRow}>
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={s.ratingText}>
                {product.rating?.averageRating?.toFixed(1) ?? '5.0'}
              </Text>
              <Text style={s.muted}>({product.rating?.totalReviews ?? 0} đánh giá)</Text>
            </View>
            {product.style ? (
              <View style={s.categoryTag}>
                <Text style={s.categoryTagText}>{product.style}</Text>
              </View>
            ) : null}
          </View>

          <Text style={s.description}>{product.description}</Text>

          <ProductInsights product={product} />

          {/* Price & Deposit Card */}
          <View style={s.priceCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>GIÁ THUÊ NIÊM YẾT</Text>
              <View style={s.priceRow}>
                <Text style={s.price}>{money(product.discountedPrice ?? product.basePrice)}</Text>
                <Text style={s.per}> /ngày</Text>
              </View>
              {product.discountedPrice && product.discountedPrice < product.basePrice ? (
                <Text style={s.oldPrice}>{money(product.basePrice)}</Text>
              ) : null}
            </View>
            <View style={s.deposit}>
              <Text style={s.label}>TIỀN CỌC GIỮ ĐỒ</Text>
              <Text style={s.depositValue}>{money(product.depositAmount ?? 0)}</Text>
              <View style={s.refundPill}>
                <Ionicons name="shield-checkmark-outline" size={11} color={Colors.success} />
                <Text style={s.refund}>Hoàn cọc 100%</Text>
              </View>
            </View>
          </View>

          {/* AI Virtual Try-on & AI Size Assistant Banner */}
          <View style={s.aiToolsRow}>
            <Pressable style={s.aiToolBtn} onPress={() => setSizeModalOpen(true)}>
              <View style={s.aiToolIcon}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.aiToolTitle}>AI Tư vấn chọn Size</Text>
                <Text style={s.aiToolSub}>Đo chiều cao & cân nặng</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
            </Pressable>

            <Pressable
              style={[s.aiToolBtn, s.aiToolBtnSecondary]}
              onPress={() =>
                router.push({
                  pathname: '/virtual-tryon',
                  params: { productId: product._id, name: product.name, image: product.images?.[0] ?? '' },
                } as unknown as Href)
              }>
              <View style={[s.aiToolIcon, { backgroundColor: '#1B1C1C' }]}>
                <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.aiToolTitle}>Thử đồ ảo AI 2D</Text>
                <Text style={s.aiToolSub}>Ướm thử lên ảnh của bạn</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#1B1C1C" />
            </Pressable>
          </View>
        </View>

        <OptionGroup
          title="HÌNH THỨC THUÊ"
          options={['DAILY', 'HOURLY']}
          value={mode}
          labels={['Thuê theo ngày', 'Thuê theo giờ']}
          onChange={(v) => {
            setMode(v as 'DAILY' | 'HOURLY');
            setStart('');
            setEnd('');
          }}
        />

        <OptionGroup
          title="MÀU SẮC"
          options={product.colors}
          value={chosenColor}
          onChange={setColor}
        />

        <View style={s.sizeHeaderRow}>
          <Text style={s.sectionNoTop}>CHỌN KÍCH CỠ (SIZE)</Text>
          <Pressable style={s.sizeGuideBtn} onPress={() => setSizeModalOpen(true)}>
            <Ionicons name="resize-outline" size={13} color={Colors.primary} />
            <Text style={s.sizeGuideText}>Bảng size & AI đo số đo ›</Text>
          </Pressable>
        </View>
        <View style={s.options}>
          {product.sizes.map((item) => (
            <Pressable
              key={item}
              onPress={() => setSize(item)}
              style={[s.option, chosenSize === item && s.selected]}>
              <Text style={[s.optionText, chosenSize === item && s.selectedText]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.section}>THỜI GIAN THUÊ</Text>
        <DateSelector
          start={start}
          end={mode === 'HOURLY' ? start : end}
          onChange={(a, b) => {
            setStart(a);
            setEnd(b);
          }}
        />

        {mode === 'HOURLY' && (
          <View style={s.timeRow}>
            {['08:00–10:00', '10:00–12:00', '14:00–16:00', '16:00–18:00'].map((slot) => {
              const [a, b] = slot.split('–');
              return (
                <Pressable
                  key={slot}
                  onPress={() => {
                    setStartTime(a);
                    setEndTime(b);
                  }}
                  style={[s.time, startTime === a && s.selected]}>
                  <Text style={[s.optionText, startTime === a && s.selectedText]}>{slot}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Availability state={availability.state} result={availability.result} />

        {/* Store Pickup Info */}
        <View style={s.pickup}>
          <View style={s.pickupIconWrap}>
            <Ionicons name="location" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pickupTitle}>Nhận và trả trang phục tại tiệm</Text>
            <Text style={s.pickupSub}>
              {provider?.address?.addressLine ?? 'Địa chỉ chi tiết hiển thị sau khi xác nhận đặt lịch'}
            </Text>
          </View>
        </View>

        {/* Description & Policy */}
        <View style={s.info}>
          <Text style={s.sectionNoMargin}>Chi tiết trang phục & Chất liệu</Text>
          <Text style={s.body}>
            {product.description || 'Trang phục cổ phục được tuyển chọn và bảo quản tiêu chuẩn tại Huế.'}
          </Text>
          <Text style={s.sectionNoMargin}>Cam kết & Chính sách thuê TàGo</Text>
          {[
            'Giữ lịch độc quyền ngay sau khi thanh toán cọc',
            'Hỗ trợ thử và chỉnh sửa nhẹ kích cỡ tại tiệm khi nhận đồ',
            'Trang phục đã được giặt hấp thơm tho trước khi bàn giao',
            'Hoàn trả 100% tiền cọc ngay sau khi trả đồ & đối soát',
          ].map((v, i) => (
            <View key={v} style={s.policy}>
              <View style={s.policyNoBadge}>
                <Text style={s.policyNo}>0{i + 1}</Text>
              </View>
              <Text style={s.policyText}>{v}</Text>
            </View>
          ))}
        </View>

        <ProductReviews reviews={reviews} rating={product.rating?.averageRating ?? 0} />

        {/* Suggested Photographers */}
        {suggestedPhotographers.length > 0 && (
          <View style={s.related}>
            <View style={s.relatedHeaderRow}>
              <View>
                <Text style={s.relatedEyebrow}>TRỌN VẸN KHOẢNH KHẮC</Text>
                <Text style={s.relatedTitle}>Gợi ý Thợ ảnh chụp cùng cổ phục</Text>
              </View>
              <Pressable onPress={() => router.push('/(tabs)/photography' as Href)}>
                <Text style={s.seeAllLink}>Xem tất cả ›</Text>
              </Pressable>
            </View>
            <View style={{ gap: 14 }}>
              {suggestedPhotographers.map((p) => (
                <PhotographyCard key={p._id} photographer={p} />
              ))}
            </View>
          </View>
        )}

        {/* Related Products */}
        {related.length > 0 && (
          <View style={s.related}>
            <Text style={s.relatedEyebrow}>BỘ SƯU TẬP CÙNG PHONG CÁCH</Text>
            <Text style={s.relatedTitle}>Cổ phục liên quan</Text>
            <View style={s.grid}>
              {related.map((item) => (
                <ProductCard key={item._id} product={item} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={s.bottom}>
        <Pressable style={s.cartIcon} onPress={() => router.push('/cart' as Href)}>
          <Ionicons name="bag-handle-outline" size={22} color={Colors.primary} />
          {count > 0 ? (
            <View style={s.cartBadge}>
              <Text style={s.cartBadgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          disabled={availability.state === 'checking' || availability.state === 'unavailable'}
          style={[
            s.secondaryCta,
            (availability.state === 'checking' || availability.state === 'unavailable') &&
              s.disabled,
          ]}
          onPress={() => add(false)}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={s.secondaryCtaText}>Thêm giỏ</Text>
        </Pressable>

        <Pressable
          disabled={availability.state === 'checking' || availability.state === 'unavailable'}
          style={[
            s.cta,
            (availability.state === 'checking' || availability.state === 'unavailable') &&
              s.disabled,
          ]}
          onPress={() => add(true)}>
          <Text style={s.ctaText}>THUÊ NGAY</Text>
          <Ionicons name="arrow-forward" size={17} color={Colors.white} />
        </Pressable>
      </View>

      {/* AI Size Calculator & Size Chart Modal */}
      <Modal
        visible={sizeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSizeModalOpen(false)}>
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
                      show(`Đã chọn Size ${aiRecommendation.size} theo gợi ý AI`, 'success');
                    }}>
                    <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                    <Text style={s.applySizeBtnText}>
                      Áp dụng Size {aiRecommendation.size} ngay
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={s.muted}>
                  Nhập chiều cao (120–210cm) và cân nặng (30–130kg) để AI tính size chuẩn.
                </Text>
              )}

              <Text style={s.chartHeading}>BẢNG QUY ĐỔI KÍCH CỠ CỔ PHỤC CHUẨN</Text>
              <View style={s.chartTable}>
                <View style={[s.chartRow, s.chartHeaderRow]}>
                  <Text style={[s.chartCell, s.chartHeaderCell, { flex: 0.6 }]}>Size</Text>
                  <Text style={[s.chartCell, s.chartHeaderCell]}>Cao</Text>
                  <Text style={[s.chartCell, s.chartHeaderCell]}>Nặng</Text>
                  <Text style={[s.chartCell, s.chartHeaderCell]}>Ngực / Eo</Text>
                </View>
                {SIZE_CHART.map((row) => (
                  <View
                    key={row.size}
                    style={[
                      s.chartRow,
                      aiRecommendation?.size === row.size && s.chartRowHighlight,
                    ]}>
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
      <Pressable onPress={() => router.back()} style={s.round}>
        <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={s.brand}>TàGo</Text>
        <Text style={s.tagline}>CỔ PHỤC & DI SẢN</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onFavorite} style={s.round}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={Colors.primary}
          />
        </Pressable>
        <Pressable onPress={() => router.push('/cart' as Href)} style={s.round}>
          <Ionicons name="bag-handle-outline" size={20} color="#1B1C1C" />
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

function OptionGroup({
  title,
  options,
  value,
  onChange,
  labels,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labels?: string[];
}) {
  return (
    <View>
      <Text style={s.section}>{title}</Text>
      <View style={s.options}>
        {options.map((item, i) => (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[s.option, value === item && s.selected]}>
            <Text style={[s.optionText, value === item && s.selectedText]}>
              {labels?.[i] ?? item}
            </Text>
          </Pressable>
        ))}
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
      <View style={[s.notice, s.ok]}>
        <StatusBadge label="Còn lịch trống" tone="success" />
        <Text style={s.okText}>Còn {result?.availableQuantity ?? 1} bộ sẵn sàng cho ngày bạn chọn.</Text>
      </View>
    );
  return (
    <View style={[s.notice, s.bad]}>
      <StatusBadge label="Tạm hết lịch" tone="error" />
      <Text style={s.badText}>
        {result?.message ?? 'Vui lòng đổi ngày, giờ hoặc chọn kích cỡ khác.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  content: { paddingBottom: 112 },
  top: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
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
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: Colors.primary,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: '#8F8E8E',
  },
  pad: { padding: 16 },
  storeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storeLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  storeBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  provider: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
    flexShrink: 1,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDF9F2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verified: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9.5,
    color: Colors.success,
  },
  viewStore: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    lineHeight: 33,
    color: '#1B1C1C',
    marginTop: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#B45309',
  },
  categoryTag: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryTagText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.primary,
  },
  description: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#5F5E5E',
    marginTop: 10,
  },
  muted: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
  },
  priceCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EFECEB',
    marginTop: 14,
    ...Shadow,
  },
  label: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: '#8F8E8E',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  price: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 22,
    color: Colors.primary,
  },
  per: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
  },
  oldPrice: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  deposit: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: '#EFECEB',
    paddingLeft: 18,
    justifyContent: 'center',
  },
  depositValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#1B1C1C',
    marginTop: 4,
  },
  refundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  refund: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.success,
  },
  aiToolsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  aiToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 14,
    padding: 10,
  },
  aiToolBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EFECEB',
  },
  aiToolIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiToolTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  aiToolSub: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#5F5E5E',
  },
  sizeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 9,
  },
  sectionNoTop: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  sizeGuideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sizeGuideText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  section: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 9,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  option: {
    minWidth: 64,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  selected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  time: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  notice: {
    margin: 16,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#F5F3F3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
  },
  ok: { backgroundColor: '#EDF9F2' },
  bad: { backgroundColor: '#FDECEE' },
  okText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: Colors.success,
    flex: 1,
  },
  badText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: Colors.error,
    flex: 1,
  },
  pickup: {
    marginHorizontal: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF0F3',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  pickupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  pickupSub: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  info: {
    margin: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionNoMargin: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    marginBottom: 8,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 20,
    color: '#5F5E5E',
    marginBottom: 18,
  },
  policy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  policyNoBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyNo: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
  },
  policyText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#1B1C1C',
  },
  related: { paddingHorizontal: 16, paddingTop: 12 },
  relatedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  relatedEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: Colors.primary,
  },
  relatedTitle: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: '#1B1C1C',
    marginTop: 2,
    marginBottom: 10,
  },
  seeAllLink: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    ...Shadow,
  },
  cartIcon: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  secondaryCta: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryCtaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  cta: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  disabled: { opacity: 0.45 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 28, 0.5)',
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
    letterSpacing: 1.2,
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
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  measureField: {
    width: '48%',
    gap: 5,
  },
  measureLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#5F5E5E',
  },
  measureInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 12,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  aiResultBox: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiSizeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiSizeBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  aiResultTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  aiResultReason: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
  },
  applySizeBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applySizeBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  chartHeading: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#8F8E8E',
    marginTop: 4,
  },
  chartTable: {
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    overflow: 'hidden',
  },
  chartRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
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
    fontSize: 11,
    color: '#5F5E5E',
  },
  chartHeaderCell: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#1B1C1C',
  },
  chartSizeCol: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
});
