import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatApi } from '@/apis/chatApi';
import { photographerApi } from '@/apis/photographerApi';
import { PhotographerReviews } from '@/components/photographer/PhotographerReviews';
import { PhotographyGallery } from '@/components/photographer/PhotographyGallery';
import { TagoLocationPicker } from '@/components/map/TagoLocationPicker';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { usePhotographerDetail } from '@/hooks/usePhotographerDetail';
import type { Photographer, PhotographyPackage, PhotographyQuote } from '@/types/photographer';
import { getApiErrorMessage } from '@/utils/apiError';
import { resolveEntityCoords } from '@/utils/geo';
import { getMediaUrl } from '@/utils/media';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const durationOf = (item?: PhotographyPackage | null) =>
  Math.max(item?.includedDurationMinutes ?? Math.round((item?.durationHours ?? 1) * 60), 30);
const imageOf = (item: Photographer, pack?: PhotographyPackage | null) =>
  pack?.images?.[0] ??
  item.coverImage ??
  item.media?.coverUrl ??
  item.portfolioItems?.[0]?.images?.[0] ??
  item.portfolio?.[0];
const fullAddress = (item: Photographer) =>
  [item.address?.addressLine, item.address?.ward, item.address?.district, item.address?.city]
    .filter(Boolean)
    .join(', ');

const PRESET_LOCATIONS = [
  {
    id: 'dai-noi',
    label: 'Đại Nội Huế',
    address: 'Đại Nội Huế (Hoàng Thành), Phú Hậu, TP. Huế',
    lat: 16.4698,
    lng: 107.5786,
  },
  {
    id: 'an-dinh',
    label: 'Cung An Định',
    address: 'Cung An Định, 179B Phan Đình Phùng, TP. Huế',
    lat: 16.4581,
    lng: 107.6001,
  },
  {
    id: 'lang-tu-duc',
    label: 'Lăng Tự Đức',
    address: 'Lăng Tự Đức (Khiêm Lăng), Thủy Xuân, TP. Huế',
    lat: 16.4331,
    lng: 107.5658,
  },
  {
    id: 'lang-minh-mang',
    label: 'Lăng Minh Mạng',
    address: 'Lăng Minh Mạng, Hương Thọ, TP. Huế',
    lat: 16.3879,
    lng: 107.5714,
  },
  {
    id: 'lang-khai-dinh',
    label: 'Lăng Khải Định',
    address: 'Lăng Khải Định, Thủy Bằng, TP. Huế',
    lat: 16.3991,
    lng: 107.5904,
  },
  {
    id: 'thien-mu',
    label: 'Chùa Thiên Mụ',
    address: 'Chùa Thiên Mụ, Kim Long, TP. Huế',
    lat: 16.4534,
    lng: 107.5451,
  },
  {
    id: 'truong-tien',
    label: 'Cầu Trường Tiền',
    address: 'Cầu Trường Tiền & Bờ sông Hương, Phú Hội, TP. Huế',
    lat: 16.4689,
    lng: 107.5889,
  },
  {
    id: 'hoi-an',
    label: 'Phố cổ Hội An',
    address: 'Phố cổ Hội An, Minh An, TP. Hội An',
    lat: 15.8771,
    lng: 108.3265,
  },
];

const PRESET_CONCEPTS = [
  'Hoàng cung triều Nguyễn',
  'Nàng thơ Cố đô Golden Hour',
  'Cổ phục Ngũ Thân truyền thống',
  'Cặp đôi Duyên dáng Kinh Kỳ',
  'Chân dung Điện ảnh Hoài cổ',
];

export default function PhotographerDetailScreen() {
  const params = useLocalSearchParams<{ id: string; packageId?: string }>();
  const { photographer, reviews, loading, error, reload } = usePhotographerDetail(params.id);
  const [packageId, setPackageId] = useState(params.packageId ?? '');
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 16.4698,
    lng: 107.5786,
  });
  const [concept, setConcept] = useState('');
  const [monthStatuses, setMonthStatuses] = useState<Record<string, string>>({});
  const [timeRanges, setTimeRanges] = useState<Array<{ start: string; end: string }>>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [quote, setQuote] = useState<PhotographyQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const { addItem, count } = useCart();
  const { show } = useToast();
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();

  const selectedPackage = useMemo(
    () =>
      photographer?.packages?.find((item) => item._id === packageId) ??
      photographer?.defaultPackage ??
      photographer?.packages?.[0] ??
      null,
    [photographer, packageId]
  );
  const includedDuration = durationOf(selectedPackage);
  const overtimeStep = Math.max(selectedPackage?.overtimeIncrementMinutes ?? 30, 30);
  const maxDuration = includedDuration + Math.max(selectedPackage?.maxOvertimeMinutes ?? 0, 0);
  const endTime = startTime ? toTime(toMinutes(startTime) + durationMinutes) : '';
  const liked = photographer ? isFavorite('PROVIDER', photographer._id) : false;

  const dates = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index + 1);
        return {
          value: iso(date),
          day: date.getDate(),
          month: date.getMonth() + 1,
          week: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()],
        };
      }),
    []
  );

  const galleryImages = useMemo(() => {
    if (!photographer) return [];
    const values = [
      selectedPackage?.images ?? [],
      photographer.media?.images ?? [],
      photographer.portfolioItems?.flatMap((item) => item.images) ?? [],
      photographer.portfolio ?? [],
      [photographer.coverImage ?? '', photographer.media?.coverUrl ?? ''],
    ]
      .flat()
      .filter(Boolean) as string[];
    return [...new Set(values)];
  }, [photographer, selectedPackage]);

  const portfolioImages = useMemo(
    () =>
      photographer
        ? [
            ...new Set([
              ...(photographer.portfolioItems?.flatMap((item) => item.images) ?? []),
              ...(photographer.portfolio ?? []),
            ]),
          ]
        : [],
    [photographer]
  );

  useEffect(() => {
    if (!selectedPackage) return;
    setPackageId(selectedPackage._id);
    setDurationMinutes(durationOf(selectedPackage));
    setSelectedDate('');
    setStartTime('');
    setQuote(null);
    setQuoteError(null);
  }, [selectedPackage?._id]);

  useEffect(() => {
    if (photographer && !location) {
      const addr = fullAddress(photographer);
      const resolved = resolveEntityCoords(photographer);
      setLocation(addr || PRESET_LOCATIONS[0].address);
      setCoords({ lat: resolved.lat, lng: resolved.lng });
    }
  }, [photographer]);

  useEffect(() => {
    if (!photographer || !selectedPackage) return;
    let active = true;
    const months = [...new Set(dates.map((item) => item.value.slice(0, 7)))];
    Promise.all(
      months.map((month) =>
        photographerApi
          .monthAvailability(photographer._id, month, selectedPackage._id)
          .catch(() => null)
      )
    ).then((responses) => {
      if (!active) return;
      const next: Record<string, string> = {};
      responses.forEach((response) =>
        response?.days?.forEach((day) => {
          next[day.date] = day.status;
        })
      );
      setMonthStatuses(next);
    });
    return () => {
      active = false;
    };
  }, [photographer?._id, selectedPackage?._id]);

  useEffect(() => {
    if (!photographer || !selectedDate) {
      setTimeRanges([]);
      setStartTime('');
      return;
    }
    let active = true;
    setScheduleLoading(true);
    setStartTime('');
    setQuote(null);
    photographerApi
      .timeRanges(photographer._id, selectedDate)
      .then((response) => {
        if (active) setTimeRanges(response.timeRanges ?? []);
      })
      .catch(() => {
        if (active) setTimeRanges([]);
      })
      .finally(() => {
        if (active) setScheduleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [photographer?._id, selectedDate]);

  const slots = useMemo(
    () =>
      timeRanges.flatMap((range) => {
        const values: Array<{ start: string; end: string }> = [];
        const step = durationMinutes >= 180 ? 60 : 30;
        for (
          let current = toMinutes(range.start);
          current + durationMinutes <= toMinutes(range.end);
          current += step
        )
          values.push({ start: toTime(current), end: toTime(current + durationMinutes) });
        return values;
      }),
    [timeRanges, durationMinutes]
  );

  useEffect(() => {
    if (!photographer || !selectedPackage || !selectedDate || !startTime || !location.trim()) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError(null);
      photographerApi
        .quote(photographer._id, selectedPackage._id, [
          {
            clientId: 'mobile-main-session',
            startsAt: `${selectedDate}T${startTime}:00+07:00`,
            endsAt: `${selectedDate}T${endTime}:00+07:00`,
            locationAddress: location.trim(),
            locationLatitude: coords.lat,
            locationLongitude: coords.lng,
          },
        ])
        .then((result) => {
          if (active) {
            setQuote(result);
            if (!result.valid)
              setQuoteError(result.errors?.[0]?.message ?? 'Khung giờ không còn khả dụng.');
          }
        })
        .catch((cause) => {
          if (active) {
            setQuote(null);
            setQuoteError(getApiErrorMessage(cause, 'Không thể kiểm tra lịch và báo giá'));
          }
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [photographer?._id, selectedPackage?._id, selectedDate, startTime, endTime, location, coords]);

  if (loading) return <LoadingState label="Đang tải thông tin gói chụp..." />;
  if (error || !photographer)
    return <ErrorState message={error ?? 'Không tìm thấy nhiếp ảnh gia'} onRetry={reload} />;

  const favorite = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as Href);
      return;
    }
    try {
      await toggleFavorite('PROVIDER', photographer._id);
      show(liked ? 'Đã bỏ khỏi yêu thích' : 'Đã lưu vào bộ sưu tập yêu thích', 'success');
    } catch {
      show('Không thể cập nhật yêu thích', 'error');
    }
  };

  const openChat = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as Href);
      return;
    }
    if (!photographer.userId) {
      show('Studio chưa bật tính năng trò chuyện trực tuyến', 'error');
      return;
    }
    setStartingChat(true);
    try {
      const room = await chatApi.createRoom(String(photographer.userId));
      router.push({
        pathname: '/chat/[id]',
        params: { id: room.id, name: photographer.businessName ?? 'Studio' },
      } as unknown as Href);
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể bắt đầu trò chuyện'), 'error');
    } finally {
      setStartingChat(false);
    }
  };

  const addToCart = (goToCart = true) => {
    if (!selectedPackage || !selectedDate || !startTime || !location.trim()) {
      show('Vui lòng chọn đủ gói, ngày, giờ và địa điểm chụp', 'error');
      return;
    }
    if (!quote?.valid || !quote.totals) {
      show(quoteError ?? 'Báo giá chưa hợp lệ, vui lòng kiểm tra lại lịch', 'error');
      return;
    }
    addItem({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: selectedPackage._id,
      name: `${selectedPackage.name} — ${photographer.businessName ?? 'Studio'}`,
      image: imageOf(photographer, selectedPackage),
      basePrice: quote.totals.totalAmount,
      depositAmount: quote.totals.totalAmount,
      shootDate: selectedDate,
      shootTimeSlot: `${startTime}-${endTime}`,
      shootLocation: location.trim(),
      shootLocationLatitude: coords.lat,
      shootLocationLongitude: coords.lng,
      shootConcept: concept.trim() || null,
      providerAddress: fullAddress(photographer),
      metadata: {
        providerId: photographer._id,
        packageName: selectedPackage.name,
        durationMinutes,
        quoteBreakdown: quote.breakdown,
      },
    });
    show('Đã thêm gói chụp vào giỏ hàng', 'success');
    if (goToCart) {
      router.push('/cart' as Href);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header liked={liked} count={count} onFavorite={favorite} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <PhotographyGallery images={galleryImages.slice(0, 12)} />

        <View style={styles.pad}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowPill}>
              <Ionicons name="camera" size={11} color={Colors.primary} />
              <Text style={styles.eyebrow}>
                GÓI CHỤP · {(photographer.address?.city ?? 'CỐ ĐÔ HUẾ').toUpperCase()}
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {(photographer.rating?.averageRating ?? 5.0).toFixed(1)}
              </Text>
              <Text style={styles.muted}>
                ({photographer.rating?.totalReviews ?? reviews.length})
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{selectedPackage?.name ?? photographer.businessName}</Text>
          <Text style={styles.description}>
            {selectedPackage?.description ??
              photographer.quote ??
              'Một buổi chụp được chuẩn bị chỉn chu cùng đội ngũ nhiếp ảnh gia am hiểu ánh sáng và kiến trúc Cố đô.'}
          </Text>

          <View style={styles.meta}>
            <Meta icon="time-outline" value={`${durationMinutes} phút`} label="Thời lượng" />
            <Meta
              icon="Sparkles-outline"
              iconFallback="color-wand-outline"
              value={`${selectedPackage?.editedPhotosCount ?? 15} ảnh`}
              label="Retouch kỹ"
            />
            <Meta
              icon="images-outline"
              value={`${selectedPackage?.rawPhotosCount ?? 120}+`}
              label="Ảnh gốc"
            />
            <Meta
              icon="people-outline"
              value={`1–${selectedPackage?.maxPeople ?? 2}`}
              label="Số khách"
            />
          </View>
        </View>

        {(photographer.packages?.length ?? 0) > 1 && (
          <Section title="Chọn gói chụp của Studio">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.packageRow}>
              {photographer.packages?.map((item) => {
                const isSelected = selectedPackage?._id === item._id;
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => setPackageId(item._id)}
                    style={[styles.packageCard, isSelected && styles.packageSelected]}>
                    <Text
                      numberOfLines={2}
                      style={[styles.packageName, isSelected && styles.packageNameSelected]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.packagePrice, isSelected && styles.packageNameSelected]}>
                      {money(item.price)}
                    </Text>
                    <Text style={[styles.packageMeta, isSelected && styles.packageMetaSelected]}>
                      {durationOf(item)} phút · {item.editedPhotosCount} ảnh retouch
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>
        )}

        {/* Studio / Photographer Card */}
        <View style={styles.providerCard}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerInitial}>
              {(photographer.businessName ?? 'T').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.providerName}>
                {photographer.businessName ?? 'TàGo Studio'}
              </Text>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            </View>
            <Text style={styles.providerSub}>
              Studio đối tác chính thức · {photographer.rating?.totalReviews ?? 0} đánh giá
            </Text>
          </View>
          <Pressable
            disabled={startingChat || !photographer.userId}
            onPress={() => void openChat()}
            style={[styles.chatButton, (startingChat || !photographer.userId) && styles.disabled]}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.white} />
            <Text style={styles.chatText}>{startingChat ? 'Đang mở...' : 'Nhắn tin'}</Text>
          </Pressable>
        </View>

        {/* Step 1: Date & Time */}
        <Section title="1. Chọn ngày & khung giờ chụp">
          <Text style={styles.helper}>
            Chọn ngày bạn muốn chụp để xem các khung giờ trống thực tế của ekip.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}>
            {dates.map((item) => {
              const unavailable =
                monthStatuses[item.value] !== undefined &&
                monthStatuses[item.value] !== 'AVAILABLE';
              const active = selectedDate === item.value;
              return (
                <Pressable
                  key={item.value}
                  disabled={unavailable}
                  onPress={() => setSelectedDate(item.value)}
                  style={[
                    styles.day,
                    active && styles.dayActive,
                    unavailable && styles.disabled,
                  ]}>
                  <Text style={[styles.dayWeek, active && styles.lightText]}>{item.week}</Text>
                  <Text style={[styles.dayNumber, active && styles.lightText]}>{item.day}</Text>
                  <Text style={[styles.dayMonth, active && styles.lightText]}>Th {item.month}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedDate ? (
            scheduleLoading ? (
              <Text style={styles.loadingCopy}>Đang kiểm tra các ca chụp còn trống...</Text>
            ) : slots.length ? (
              <View style={styles.slotGrid}>
                {slots.map((slot) => (
                  <Pressable
                    key={slot.start}
                    onPress={() => setStartTime(slot.start)}
                    style={[styles.slot, startTime === slot.start && styles.slotActive]}>
                    <Text style={[styles.slotText, startTime === slot.start && styles.lightText]}>
                      {slot.start}–{slot.end}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.warning}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                <Text style={styles.warningText}>
                  Không còn khung giờ trống trong ngày này. Bạn vui lòng chọn ngày khác nhé.
                </Text>
              </View>
            )
          ) : null}
        </Section>

        {/* Step 2: Duration */}
        <Section title="2. Thời lượng chụp & thêm giờ">
          <Text style={styles.helper}>
            Gói tiêu chuẩn gồm {includedDuration} phút. Nếu tăng thêm giờ, hệ thống sẽ tự động tính phụ phí.
          </Text>
          <View style={styles.durationRow}>
            <Pressable
              disabled={durationMinutes <= includedDuration}
              onPress={() =>
                setDurationMinutes((value) => Math.max(includedDuration, value - overtimeStep))
              }
              style={[styles.stepButton, durationMinutes <= includedDuration && styles.disabled]}>
              <Ionicons name="remove" size={20} color={Colors.primary} />
            </Pressable>
            <View style={styles.durationCenter}>
              <Text style={styles.duration}>{durationMinutes} phút</Text>
              <Text style={styles.overtime}>
                {durationMinutes > includedDuration
                  ? `Đã cộng thêm +${durationMinutes - includedDuration} phút`
                  : 'Trong thời lượng tiêu chuẩn của gói'}
              </Text>
            </View>
            <Pressable
              disabled={durationMinutes >= maxDuration}
              onPress={() =>
                setDurationMinutes((value) => Math.min(maxDuration, value + overtimeStep))
              }
              style={[styles.stepButton, durationMinutes >= maxDuration && styles.disabled]}>
              <Ionicons name="add" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          {maxDuration === includedDuration && (
            <Text style={styles.noAddon}>Gói chụp này áp dụng thời lượng cố định.</Text>
          )}
        </Section>

        {/* Step 3: Location with Heritage Map Picker & Concept */}
        <Section title="3. Địa điểm & Concept chụp">
          <TagoLocationPicker
            label="BẢN ĐỒ CHỌN ĐIỂM HẸN CHỤP (TOÀN QUỐC)"
            value={{
              address: location || fullAddress(photographer) || 'Đại Nội Huế (Hoàng Thành), TP. Huế',
              lat: coords.lat,
              lng: coords.lng,
            }}
            onChange={(next) => {
              setLocation(next.address);
              setCoords({ lat: next.lat, lng: next.lng });
            }}
            providerCoords={resolveEntityCoords(photographer)}
            providerLabel={photographer.businessName ?? 'Studio'}
            serviceRadiusKm={photographer.photographySettings?.serviceRadiusKm ?? 25}
          />

          <Text style={styles.inputLabel}>GỢI Ý CONCEPT CHỤP</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetChipRow}>
            {PRESET_CONCEPTS.map((c) => {
              const active = concept === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setConcept(active ? '' : c)}
                  style={[styles.presetChip, active && styles.presetChipActive]}>
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.inputLabel}>GHI CHÚ CHO NHIẾP ẢNH GIA</Text>
          <TextInput
            value={concept}
            onChangeText={setConcept}
            placeholder="Ví dụ: Chụp nắng chiều, cần hướng dẫn tạo dáng cổ phục..."
            placeholderTextColor={Colors.textMuted}
            style={styles.textInput}
          />
        </Section>

        {/* Live Quote Breakdown */}
        <Section title="Bảng tạm tính chi phí">
          <View style={styles.quoteTop}>
            <Text style={styles.quotePackage}>{selectedPackage?.name}</Text>
            <Text style={styles.basePrice}>{money(selectedPackage?.price ?? 0)}</Text>
          </View>
          {quoteLoading ? (
            <Text style={styles.loadingCopy}>Đang kiểm tra lịch trống và tính báo giá...</Text>
          ) : quote?.valid && quote.totals ? (
            <View>
              {quote.breakdown.map((item, index) => (
                <View key={`${item.type}-${index}`} style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{item.label}</Text>
                  <Text style={styles.quoteValue}>{money(item.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tổng tạm tính</Text>
                <Text style={styles.totalPrice}>{money(quote.totals.totalAmount)}</Text>
              </View>
              <View style={styles.success}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.successText}>
                  Khung giờ còn trống và báo giá đã được hệ thống xác nhận.
                </Text>
              </View>
            </View>
          ) : quoteError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{quoteError}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              Vui lòng chọn ngày và khung giờ ở Bước 1 để hệ thống kiểm tra lịch trống.
            </Text>
          )}
        </Section>

        {/* Package Inclusions */}
        <Section title="Quyền lợi trong gói chụp">
          {[
            `${durationOf(selectedPackage)} phút chụp liên tục cùng nhiếp ảnh gia`,
            `${selectedPackage?.editedPhotosCount ?? 15} ảnh retouch màu sắc nghệ thuật`,
            `${selectedPackage?.rawPhotosCount ?? 120}+ toàn bộ file ảnh gốc chất lượng cao`,
            `Bàn giao file qua Google Drive trong ${selectedPackage?.deliveryDays ?? 3} ngày`,
            ...(photographer.equipment?.slice(0, 3) ?? []),
          ].map((value) => (
            <View key={value} style={styles.included}>
              <Ionicons name="checkmark-circle" size={17} color={Colors.success} />
              <Text style={styles.includedText}>{value}</Text>
            </View>
          ))}
        </Section>

        {/* Portfolio */}
        {portfolioImages.length > 0 && (
          <View style={styles.portfolio}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Tác phẩm tiêu biểu (Portfolio)</Text>
              <Text style={styles.muted}>{portfolioImages.length} ảnh</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.portfolioRow}>
              {portfolioImages.slice(0, 10).map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.portfolioImageWrap}>
                  <PhotographyThumb uri={uri} />
                  <Text style={styles.photoNumber}>Ảnh {index + 1}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Policies */}
        <Section title="Chính sách đổi lịch & bảo vệ khách hàng">
          <Text style={styles.policyTitle}>Đổi lịch do thời tiết hoặc lịch trình</Text>
          <Text style={styles.policy}>
            {photographer.policies?.cancellationPolicy ??
              'Hỗ trợ đổi lịch miễn phí khi báo trước tối thiểu 24 giờ hoặc khi thời tiết tại Huế mưa lớn không thể chụp ngoại cảnh.'}
          </Text>
          {!!selectedPackage?.travelFeeNotes && (
            <>
              <Text style={styles.policyTitle}>Phụ phí di chuyển ngoại thành</Text>
              <Text style={styles.policy}>{selectedPackage.travelFeeNotes}</Text>
            </>
          )}
        </Section>

        <PhotographerReviews reviews={reviews} rating={photographer.rating?.averageRating ?? 0} />
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottom}>
        <View>
          <Text style={styles.bottomLabel}>Tạm tính trọn gói</Text>
          <Text style={styles.bottomPrice}>
            {money(quote?.totals?.totalAmount ?? selectedPackage?.price ?? 0)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            disabled={quoteLoading || quote?.valid !== true}
            style={[
              styles.secondaryCta,
              (quoteLoading || quote?.valid !== true) && styles.ctaDisabled,
            ]}
            onPress={() => addToCart(false)}>
            <Ionicons name="bag-add-outline" size={17} color={Colors.primary} />
          </Pressable>
          <Pressable
            disabled={quoteLoading || quote?.valid !== true}
            style={[styles.cta, (quoteLoading || quote?.valid !== true) && styles.ctaDisabled]}
            onPress={() => addToCart(true)}>
            <Text style={styles.ctaText}>Đặt lịch chụp</Text>
            <Ionicons name="arrow-forward" size={17} color={Colors.white} />
          </Pressable>
        </View>
      </View>
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
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.round}>
        <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.brand}>TàGo</Text>
        <Text style={styles.tagline}>NHIẾP ẢNH DI SẢN</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable onPress={onFavorite} style={styles.round}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={() => router.push('/cart' as Href)} style={styles.round}>
          <Ionicons name="bag-handle-outline" size={20} color="#1B1C1C" />
          {count > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{Math.min(count, 9)}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppCard style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </AppCard>
  );
}

function Meta({
  icon,
  iconFallback,
  value,
  label,
}: {
  icon: string;
  iconFallback?: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const iconName = (iconFallback ?? icon) as keyof typeof Ionicons.glyphMap;
  return (
    <View style={styles.metaItem}>
      <Ionicons name={iconName} size={17} color={Colors.primary} />
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function PhotographyThumb({ uri }: { uri: string }) {
  return (
    <Image
      source={getMediaUrl(uri)}
      style={styles.portfolioImage}
      contentFit="cover"
      transition={180}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  content: { paddingBottom: 112, gap: 14 },
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
  headerActions: { flexDirection: 'row', gap: 8 },
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
  cartBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 99,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.white },
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
    textAlign: 'center',
  },
  pad: { paddingHorizontal: 16 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: Colors.primary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#B45309',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 25,
    lineHeight: 32,
    color: '#1B1C1C',
    marginTop: 8,
  },
  muted: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E' },
  description: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#5F5E5E',
    marginTop: 8,
  },
  meta: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
  },
  metaValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1B1C1C',
    marginTop: 4,
  },
  metaLabel: {
    fontFamily: FontFamily.body,
    fontSize: 9,
    color: '#8F8E8E',
    marginTop: 1,
  },
  sectionCard: { marginHorizontal: 16, padding: 16, borderRadius: 18 },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    marginBottom: 10,
  },
  helper: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 17,
    color: '#5F5E5E',
    marginBottom: 10,
  },
  packageRow: { gap: 10, paddingRight: 12 },
  packageCard: {
    width: 180,
    minHeight: 100,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  packageSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  packageName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 17,
    color: '#1B1C1C',
  },
  packageNameSelected: { color: Colors.white },
  packagePrice: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: Colors.primary,
    marginTop: 7,
  },
  packageMeta: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8F8E8E',
    marginTop: 4,
  },
  packageMetaSelected: { color: '#FFE0E8' },
  providerCard: {
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadow,
  },
  providerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: Colors.primary,
  },
  providerName: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#1B1C1C' },
  providerSub: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  chatButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chatText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.white },
  dateRow: { gap: 8, paddingRight: 8 },
  day: {
    width: 56,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
  },
  dayActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayWeek: { fontFamily: FontFamily.bodyMedium, fontSize: 9.5, color: '#8F8E8E' },
  dayNumber: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#1B1C1C',
    marginVertical: 2,
  },
  dayMonth: { fontFamily: FontFamily.body, fontSize: 9, color: '#8F8E8E' },
  lightText: { color: Colors.white },
  disabled: { opacity: 0.35 },
  loadingCopy: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#5F5E5E',
    paddingVertical: 12,
  },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slot: {
    width: '31%',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
  },
  slotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: '#1B1C1C' },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  warningText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.warning,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationCenter: { alignItems: 'center' },
  duration: { fontFamily: FontFamily.bodyBold, fontSize: 16, color: '#1B1C1C' },
  overtime: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  noAddon: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 8,
  },
  inputLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: '#5F5E5E',
    marginBottom: 6,
    marginTop: 4,
  },
  presetChipRow: {
    gap: 7,
    paddingBottom: 10,
  },
  presetChip: {
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
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 12,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#1B1C1C',
    marginBottom: 10,
  },
  quoteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  quotePackage: {
    flex: 1,
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  basePrice: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#1B1C1C' },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  quoteLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  quoteValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 11.5, color: '#1B1C1C' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    paddingTop: 11,
    marginTop: 3,
  },
  totalLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#1B1C1C' },
  totalPrice: { fontFamily: FontFamily.displayBold, fontSize: 21, color: Colors.primary },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EDF9F2',
    padding: 10,
    borderRadius: 12,
    marginTop: 11,
  },
  successText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.success,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#FDECEE',
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.error,
  },
  included: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F3',
  },
  includedText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
  },
  portfolio: { paddingHorizontal: 16 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  portfolioRow: { gap: 10 },
  portfolioImageWrap: { width: 155, height: 130 },
  portfolioImage: {
    width: 155,
    height: 130,
    borderRadius: 16,
    backgroundColor: '#FFF0F3',
  },
  photoNumber: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9.5,
    color: Colors.white,
    backgroundColor: 'rgba(27,28,28,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  policyTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
    marginTop: 4,
  },
  policy: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    lineHeight: 18,
    color: '#5F5E5E',
    marginTop: 4,
    marginBottom: 10,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
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
  bottomLabel: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E' },
  bottomPrice: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    color: Colors.primary,
    marginTop: 2,
  },
  secondaryCta: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    minWidth: 165,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.white },
});
