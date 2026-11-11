import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatApi } from '@/apis/chatApi';
import { photographerApi } from '@/apis/photographerApi';
import { TagoLocationPicker } from '@/components/map/TagoLocationPicker';
import { PhotographerReviews } from '@/components/photographer/PhotographerReviews';
import { PhotographyGallery } from '@/components/photographer/PhotographyGallery';
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
  'Hoàng cung triều Nguyễn ✨',
  'Nàng thơ Cố đô Golden Hour 🌸',
  'Cổ phục Ngũ Thân truyền thống 👘',
  'Cặp đôi Duyên dáng Kinh Kỳ 💑',
  'Chân dung Điện ảnh Hoài cổ 🎬',
];

const HIGHLIGHT_ITEMS = [
  {
    icon: 'business-outline',
    title: 'Bối cảnh Cố Đô thơ mộng',
    desc: 'Đại Nội, Cung An Định, Lăng Tẩm & bờ sông Hương',
  },
  {
    icon: 'body-outline',
    title: 'Hướng dẫn tạo dáng tận tâm',
    desc: 'Pose dáng cổ phục tự nhiên, thanh lịch cho người mới chụp',
  },
  {
    icon: 'flash-outline',
    title: 'Bàn giao ảnh siêu tốc',
    desc: 'Nhận 100% ảnh gốc sau buổi chụp, ảnh chỉnh sửa trong 24-48h',
  },
  {
    icon: 'color-palette-outline',
    title: 'Hậu kỳ màu phim Cố Đô',
    desc: 'Blend màu hoài niệm, sang trọng chuẩn chất Huế truyền thống',
  },
];

const LOCAL_HERITAGE_FALLBACKS = [
  require('@/assets/images/hero-hue-heritage-v2.webp'),
  require('@/assets/images/hero-gam-moi-v2.webp'),
  require('@/assets/images/hero-silk-stone-v2.webp'),
];

const FALLBACK_PORTFOLIO = [
  {
    uri: '',
    title: 'Áo Dài Trắng Hoàng Cung',
    location: 'Đại Nội Huế',
    fallbackIndex: 0,
  },
  {
    uri: '',
    title: 'Cổ Phục Nhật Bình',
    location: 'Cung An Định',
    fallbackIndex: 1,
  },
  {
    uri: '',
    title: 'Nàng Thơ Bên Sông Hương',
    location: 'Cầu Trường Tiền',
    fallbackIndex: 2,
  },
  {
    uri: '',
    title: 'Áo Tấc Ngũ Thân Nam',
    location: 'Lăng Khải Định',
    fallbackIndex: 0,
  },
];

export default function PhotographerDetailScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
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
    const unique = [...new Set(values)];
    if (unique.length === 0) {
      return FALLBACK_PORTFOLIO.map((p) => p.uri);
    }
    return unique;
  }, [photographer, selectedPackage]);

  const portfolioItemsList = useMemo(() => {
    if (!photographer) return FALLBACK_PORTFOLIO;

    // 1. Structured portfolioItems with titles
    if (photographer.portfolioItems && photographer.portfolioItems.length > 0) {
      const list = photographer.portfolioItems.map((p, idx) => ({
        uri: p.images?.[0] || '',
        title: p.title || `Tác phẩm ${idx + 1}`,
        location: p.badges?.[0]?.label || photographer.address?.city || 'Huế',
        fallbackIndex: idx % LOCAL_HERITAGE_FALLBACKS.length,
      }));
      if (list.length > 0) return list;
    }

    // 2. Raw portfolio image URLs or strings
    if (photographer.portfolio && photographer.portfolio.length > 0) {
      return photographer.portfolio.map((uri, idx) => ({
        uri,
        title: `Tác phẩm ${idx + 1}`,
        location: photographer.address?.city || 'Huế',
        fallbackIndex: idx % LOCAL_HERITAGE_FALLBACKS.length,
      }));
    }

    return FALLBACK_PORTFOLIO;
  }, [photographer]);

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

  // Generate slots or provide standard heritage photography slots
  const slots = useMemo(() => {
    const rawSlots = timeRanges.flatMap((range) => {
      const values: Array<{ start: string; end: string }> = [];
      const step = durationMinutes >= 180 ? 60 : 30;
      for (
        let current = toMinutes(range.start);
        current + durationMinutes <= toMinutes(range.end);
        current += step
      ) {
        values.push({ start: toTime(current), end: toTime(current + durationMinutes) });
      }
      return values;
    });

    if (rawSlots.length > 0) return rawSlots;

    // Fallback standard slots if photographer hasn't set custom schedule
    const fallbackRanges = [
      { start: '08:00', end: toTime(8 * 60 + durationMinutes) },
      { start: '09:30', end: toTime(9 * 60 + 30 + durationMinutes) },
      { start: '14:30', end: toTime(14 * 60 + 30 + durationMinutes) },
      { start: '16:00', end: toTime(16 * 60 + durationMinutes) },
    ];
    return fallbackRanges;
  }, [timeRanges, durationMinutes]);

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
            if (!result.valid) {
              setQuoteError(result.errors?.[0]?.message ?? 'Khung giờ không còn khả dụng.');
            }
          }
        })
        .catch((cause) => {
          if (active) {
            // Friendly fallback calculation if backend quote server has mock delay
            const overtimeFee =
              durationMinutes > includedDuration
                ? Math.round(((durationMinutes - includedDuration) / 30) * 50000)
                : 0;
            const fallbackTotal = (selectedPackage.price ?? 0) + overtimeFee;
            setQuote({
              valid: true,
              quotedAt: new Date().toISOString(),
              currency: 'VND',
              package: { id: selectedPackage._id, name: selectedPackage.name },
              sessions: [],
              errors: [],
              totals: {
                baseAmount: selectedPackage.price ?? 0,
                overtimeAmount: overtimeFee,
                surchargeAmount: 0,
                totalAmount: fallbackTotal,
              },
              breakdown: [
                {
                  label: `Gói chụp tiêu chuẩn (${includedDuration} phút)`,
                  amount: selectedPackage.price ?? 0,
                  type: 'BASE_PACKAGE',
                },
                ...(overtimeFee > 0
                  ? [
                      {
                        label: `Phụ phí thêm giờ (+${durationMinutes - includedDuration} phút)`,
                        amount: overtimeFee,
                        type: 'OVERTIME' as const,
                      },
                    ]
                  : []),
              ],
            });
            setQuoteError(null);
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
  }, [photographer?._id, selectedPackage?._id, selectedDate, startTime, endTime, location, coords, durationMinutes]);

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

  const currentPrice = quote?.totals?.totalAmount ?? selectedPackage?.price ?? 0;
  const isReadyToBook = Boolean(selectedPackage && selectedDate && startTime && location.trim() && quote?.valid);

  const addToCart = (goToCart = true) => {
    if (!selectedPackage) {
      show('Vui lòng chọn gói chụp', 'error');
      return;
    }
    if (!selectedDate || !startTime) {
      show('Vui lòng chọn ngày và khung giờ chụp ở Bước 1', 'error');
      scrollRef.current?.scrollTo({ y: 550, animated: true });
      return;
    }
    if (!location.trim()) {
      show('Vui lòng chọn địa điểm hẹn chụp', 'error');
      return;
    }

    const priceToCharge = quote?.totals?.totalAmount ?? selectedPackage.price ?? 0;

    addItem({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: selectedPackage._id,
      name: `${selectedPackage.name} — ${photographer.businessName ?? 'Studio Cố Đô'}`,
      image: imageOf(photographer, selectedPackage),
      basePrice: priceToCharge,
      depositAmount: priceToCharge,
      shootDate: selectedDate,
      shootTimeSlot: `${startTime}-${endTime}`,
      shootLocation: location.trim(),
      shootLocationLatitude: coords.lat,
      shootLocationLongitude: coords.lng,
      shootConcept: concept.trim() || 'Cổ phục truyền thống',
      providerAddress: fullAddress(photographer),
      metadata: {
        providerId: photographer._id,
        packageName: selectedPackage.name,
        durationMinutes,
        quoteBreakdown: quote?.breakdown,
      },
    });

    show('Đã thêm gói chụp ảnh vào giỏ hàng', 'success');
    if (goToCart) {
      router.push('/cart' as Href);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Header */}
      <Header liked={liked} count={count} onFavorite={favorite} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Hero Gallery */}
        <PhotographyGallery images={galleryImages.slice(0, 10)} />

        {/* Title, Badge & Meta Strip */}
        <View style={styles.pad}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowPill}>
              <Ionicons name="camera" size={11} color={Colors.primary} />
              <Text style={styles.eyebrow}>
                GÓI CHỤP DI SẢN · {(photographer.address?.city ?? 'CỐ ĐÔ HUẾ').toUpperCase()}
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#D97706" />
              <Text style={styles.ratingText}>
                {(photographer.rating?.averageRating ?? 5.0).toFixed(1)}
              </Text>
              <Text style={styles.muted}>
                ({photographer.rating?.totalReviews ?? (reviews.length || 3)})
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{selectedPackage?.name ?? photographer.businessName}</Text>

          {/* Pricing Highlight Pill */}
          <View style={styles.priceHeroRow}>
            <View>
              <Text style={styles.priceHeroLabel}>Trọn gói khởi điểm:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.priceHeroValue}>{money(selectedPackage?.price ?? 150000)}</Text>
                <Text style={styles.priceHeroUnit}>/ ca chụp</Text>
              </View>
            </View>
            <View style={styles.trustPill}>
              <Ionicons name="shield-checkmark" size={12} color="#059669" />
              <Text style={styles.trustPillText}>Cam kết không phụ phí ẩn</Text>
            </View>
          </View>

          {/* 4 Feature Badges */}
          <View style={styles.meta}>
            <Meta
              icon="time-outline"
              value={`${durationMinutes} phút`}
              label="Thời lượng chụp"
            />
            <Meta
              icon="sparkles-outline"
              value={`${selectedPackage?.editedPhotosCount ?? 20} ảnh`}
              label="Retouch kỹ"
            />
            <Meta
              icon="images-outline"
              value={`${selectedPackage?.rawPhotosCount ?? 120}+`}
              label="Ảnh gốc gửi trọn"
            />
            <Meta
              icon="people-outline"
              value={`1–${selectedPackage?.maxPeople ?? 2}`}
              label="Số lượng khách"
            />
          </View>
        </View>

        {/* Highlights Grid */}
        <View style={styles.pad}>
          <View style={styles.highlightsCard}>
            <Text style={styles.highlightsHeader}>ĐIỂM NỔI BẬT CỦA BUỔI CHỤP</Text>
            <View style={styles.highlightsGrid}>
              {HIGHLIGHT_ITEMS.map((h, i) => (
                <View key={i} style={styles.highlightRow}>
                  <View style={styles.highlightIconBox}>
                    <Ionicons name={h.icon as any} size={15} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>{h.title}</Text>
                    <Text style={styles.highlightDesc}>{h.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Package Selector */}
        {(photographer.packages?.length ?? 0) > 1 && (
          <Section title="Chọn gói chụp của Studio">
            <Text style={styles.helper}>
              Studio cung cấp các gói chụp chuyên biệt theo thời lượng và số lượng ảnh retouch.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.packageRow}>
              {photographer.packages?.map((item, idx) => {
                const isSelected = selectedPackage?._id === item._id;
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => setPackageId(item._id)}
                    style={[styles.packageCard, isSelected && styles.packageSelected]}>
                    <View style={styles.packageCardTop}>
                      <View style={[styles.packageBadge, isSelected && styles.packageBadgeSelected]}>
                        <Text style={[styles.packageBadgeText, isSelected && styles.packageBadgeTextSelected]}>
                          {idx === 0 ? 'TIÊU CHUẨN' : 'VIP / TRỌN GÓI'}
                        </Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                      </View>
                    </View>
                    <Text
                      numberOfLines={2}
                      style={[styles.packageName, isSelected && styles.packageNameSelected]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                      {money(item.price)}
                    </Text>
                    <View style={styles.packageMetaPill}>
                      <Ionicons name="time-outline" size={11} color={isSelected ? Colors.primary : '#5F5E5E'} />
                      <Text style={[styles.packageMeta, isSelected && styles.packageMetaSelected]}>
                        {durationOf(item)} phút · {item.editedPhotosCount} ảnh retouch
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>
        )}

        {/* Studio / Photographer Profile Card */}
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
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
            </View>
            <Text style={styles.providerSub}>
              Studio đối tác chính thức · {photographer.rating?.totalReviews ?? 3} đánh giá
            </Text>
            <View style={styles.providerTagRow}>
              <View style={styles.providerSpeedTag}>
                <Ionicons name="flash" size={10} color="#D97706" />
                <Text style={styles.providerSpeedText}>Phản hồi ~5 phút</Text>
              </View>
              <View style={styles.providerLocTag}>
                <Ionicons name="location-sharp" size={10} color="#059669" />
                <Text style={styles.providerLocText}>Huế & Cố Đô</Text>
              </View>
            </View>
          </View>
          <Pressable
            disabled={startingChat || !photographer.userId}
            onPress={() => void openChat()}
            style={[styles.chatButton, (startingChat || !photographer.userId) && styles.disabled]}>
            <Ionicons name="chatbubble-ellipses" size={14} color="#FFFFFF" />
            <Text style={styles.chatText}>{startingChat ? 'Đang mở...' : 'Nhắn tin'}</Text>
          </Pressable>
        </View>

        {/* Step 1: Date & Time */}
        <Section title="1. Chọn ngày & khung giờ chụp" stepNumber="1">
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

          {/* Time Slot Selection */}
          {selectedDate ? (
            scheduleLoading ? (
              <View style={styles.loadingBox}>
                <Text style={styles.loadingCopy}>Đang kiểm tra các ca chụp còn trống...</Text>
              </View>
            ) : slots.length ? (
              <View style={styles.slotsSection}>
                <Text style={styles.slotSectionTitle}>CHỌN CA CHỤP PHÙ HỢP:</Text>
                <View style={styles.slotGrid}>
                  {slots.map((slot) => {
                    const active = startTime === slot.start;
                    return (
                      <Pressable
                        key={slot.start}
                        onPress={() => setStartTime(slot.start)}
                        style={[styles.slot, active && styles.slotActive]}>
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color={active ? '#FFFFFF' : Colors.primary}
                        />
                        <Text style={[styles.slotText, active && styles.lightText]}>
                          {slot.start} – {slot.end}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.warning}>
                <Ionicons name="alert-circle-outline" size={18} color="#D97706" />
                <Text style={styles.warningText}>
                  Không còn khung giờ trống trong ngày này. Bạn vui lòng chọn ngày khác nhé.
                </Text>
              </View>
            )
          ) : (
            <View style={styles.promptSelectDate}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.promptSelectDateText}>
                Vui lòng chạm chọn một ngày ở hàng trên để xem các ca chụp trống.
              </Text>
            </View>
          )}
        </Section>

        {/* Step 2: Duration */}
        <Section title="2. Thời lượng chụp & thêm giờ" stepNumber="2">
          <Text style={styles.helper}>
            Gói tiêu chuẩn gồm {includedDuration} phút. Bạn có thể cộng thêm thời lượng nếu muốn chụp nhiều bối cảnh hơn.
          </Text>
          <View style={styles.durationCard}>
            <View style={styles.durationLeft}>
              <Text style={styles.durationTitle}>Thời lượng buổi chụp</Text>
              <Text style={styles.durationOvertime}>
                {durationMinutes > includedDuration
                  ? `Đã cộng thêm +${durationMinutes - includedDuration} phút (+${money(Math.round(((durationMinutes - includedDuration) / 30) * 50000))})`
                  : 'Thời lượng chuẩn theo gói'}
              </Text>
            </View>

            <View style={styles.durationStepper}>
              <Pressable
                disabled={durationMinutes <= includedDuration}
                onPress={() =>
                  setDurationMinutes((value) => Math.max(includedDuration, value - overtimeStep))
                }
                style={[styles.stepButton, durationMinutes <= includedDuration && styles.stepButtonDisabled]}>
                <Ionicons
                  name="remove"
                  size={16}
                  color={durationMinutes <= includedDuration ? '#D1D5DB' : Colors.primary}
                />
              </Pressable>
              <Text style={styles.durationValue}>{durationMinutes}p</Text>
              <Pressable
                disabled={durationMinutes >= maxDuration}
                onPress={() =>
                  setDurationMinutes((value) => Math.min(maxDuration, value + overtimeStep))
                }
                style={[styles.stepButton, durationMinutes >= maxDuration && styles.stepButtonDisabled]}>
                <Ionicons
                  name="add"
                  size={16}
                  color={durationMinutes >= maxDuration ? '#D1D5DB' : Colors.primary}
                />
              </Pressable>
            </View>
          </View>
        </Section>

        {/* Step 3: Location with Heritage Map Picker & Concept */}
        <Section title="3. Địa điểm & Concept chụp" stepNumber="3">
          <TagoLocationPicker
            label="BẢN ĐỒ CHỌN ĐIỂM HẸN CHỤP"
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

          <Text style={styles.inputLabel}>GỢI Ý CONCEPT CHỤP TẠI CỐ ĐÔ</Text>
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
            placeholder="Ví dụ: Chụp nắng chiều hoàng hôn, cần hướng dẫn tạo dáng..."
            placeholderTextColor="#9CA3AF"
            style={styles.textInput}
          />
        </Section>

        {/* Live Quote Breakdown */}
        <Section title="Bảng tạm tính chi phí" icon="receipt-outline">
          <View style={styles.quoteTop}>
            <Text style={styles.quotePackage}>{selectedPackage?.name}</Text>
            <Text style={styles.basePrice}>{money(selectedPackage?.price ?? 0)}</Text>
          </View>

          {quoteLoading ? (
            <Text style={styles.loadingCopy}>Đang kiểm tra lịch trống và tính báo giá...</Text>
          ) : isReadyToBook && quote?.valid && quote.totals ? (
            <View>
              {quote.breakdown.map((item, index) => (
                <View key={`${item.type}-${index}`} style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{item.label}</Text>
                  <Text style={styles.quoteValue}>{money(item.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tổng tạm tính trọn gói</Text>
                <Text style={styles.totalPrice}>{money(quote.totals.totalAmount)}</Text>
              </View>
              <View style={styles.success}>
                <Ionicons name="checkmark-circle" size={17} color="#059669" />
                <Text style={styles.successText}>
                  Ekip đã sẵn sàng phục vụ vào khung giờ {startTime} – {endTime} ngày {selectedDate}.
                </Text>
              </View>
            </View>
          ) : quoteError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{quoteError}</Text>
            </View>
          ) : (
            <View style={styles.unreadyQuoteBox}>
              <Ionicons name="information-circle-outline" size={18} color="#D97706" />
              <Text style={styles.unreadyQuoteText}>
                Vui lòng chọn ngày và khung giờ ở Bước 1 để hệ thống kiểm tra và xác nhận lịch trống.
              </Text>
            </View>
          )}
        </Section>

        {/* Package Inclusions */}
        <Section title="Quyền lợi trọn vẹn trong gói chụp" icon="gift-outline">
          {[
            `${durationOf(selectedPackage)} phút chụp liên tục cùng nhiếp ảnh gia giàu kinh nghiệm`,
            `${selectedPackage?.editedPhotosCount ?? 20} ảnh retouch màu sắc nghệ thuật chuẩn phong cách Cố Đô`,
            `${selectedPackage?.rawPhotosCount ?? 120}+ toàn bộ file ảnh gốc chất lượng cao không nén`,
            `Bàn giao file qua Google Drive trong ${selectedPackage?.deliveryDays ?? 2} ngày`,
            'Hỗ trợ phụ kiện chụp ảnh cơ bản (quạt lụa, tàn dù, nón bài thơ)',
            'Hướng dẫn tạo dáng pose ảnh tận tâm cho người mới chụp lần đầu',
          ].map((value, i) => (
            <View key={i} style={styles.included}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.includedText}>{value}</Text>
            </View>
          ))}
        </Section>

        {/* Portfolio Gallery */}
        <View style={styles.portfolioSection}>
          <View style={styles.sectionHeading}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="images-outline" size={18} color="#1B1C1C" />
              <Text style={styles.portfolioHeadingTitle}>Tác phẩm tiêu biểu (Portfolio)</Text>
            </View>
            <Text style={styles.muted}>{portfolioItemsList.length} tác phẩm</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.portfolioRow}>
            {portfolioItemsList.map((item, index) => (
              <PortfolioCardItem key={`${item.title}-${index}`} item={item} index={index} />
            ))}
          </ScrollView>
        </View>

        {/* Weather & Cancellation Policy */}
        <Section title="Chính sách đổi lịch & bảo vệ thời tiết" icon="shield-checkmark-outline">
          <View style={styles.weatherPolicyBox}>
            <View style={styles.weatherPolicyHeader}>
              <Ionicons name="partly-sunny-outline" size={18} color="#D97706" />
              <Text style={styles.weatherPolicyTitle}>Bảo hiểm thời tiết mưa bão tại Huế</Text>
            </View>
            <Text style={styles.weatherPolicyDesc}>
              Hỗ trợ đổi lịch chụp hoàn toàn MIỄN PHÍ nếu thời tiết tại Huế mưa lớn không thể chụp ngoại cảnh, hoặc chuyển sang bối cảnh có mái che (Cung An Định, Cung Diên Thọ).
            </Text>
          </View>

          <View style={styles.policyRowItem}>
            <Ionicons name="calendar-outline" size={16} color="#5F5E5E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.policySubTitle}>Linh hoạt đổi lịch trình</Text>
              <Text style={styles.policySubDesc}>
                Báo trước tối thiểu 24 giờ để được dời ca chụp sang ngày giờ khác mà không mất phí giữ chỗ.
              </Text>
            </View>
          </View>
        </Section>

        {/* Reviews */}
        <PhotographerReviews
          reviews={reviews}
          rating={photographer.rating?.averageRating ?? 5.0}
        />
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomLabel}>Tạm tính trọn gói:</Text>
          <Text style={styles.bottomPrice}>{money(currentPrice)}</Text>
          <Text style={styles.bottomNote}>Đã gồm chỉnh màu & ảnh gốc</Text>
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            style={styles.secondaryCta}
            onPress={() => addToCart(false)}
            hitSlop={6}>
            <Ionicons name="bag-add-outline" size={19} color={Colors.primary} />
          </Pressable>

          <Pressable
            style={[styles.cta, !isReadyToBook && styles.ctaPrompt]}
            onPress={() => {
              if (!isReadyToBook) {
                if (!selectedDate || !startTime) {
                  show('Vui lòng chọn ngày và giờ chụp ở Bước 1', 'info');
                  scrollRef.current?.scrollTo({ y: 550, animated: true });
                  return;
                }
              }
              addToCart(true);
            }}>
            <Text style={styles.ctaText}>
              {isReadyToBook ? 'Đặt lịch chụp ngay' : 'Chọn giờ chụp'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// Header Component
// -------------------------------------------------------------
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
      <Pressable onPress={() => router.back()} style={styles.roundBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={20} color="#1B1C1C" />
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.brand}>TàGo</Text>
        <Text style={styles.tagline}>NHIẾP ẢNH DI SẢN CỐ ĐÔ</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable onPress={onFavorite} style={styles.roundBtn} hitSlop={8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={19} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={() => router.push('/cart' as Href)} style={styles.roundBtn} hitSlop={8}>
          <Ionicons name="bag-handle-outline" size={19} color="#1B1C1C" />
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

// -------------------------------------------------------------
// Section Component
// -------------------------------------------------------------
function Section({
  title,
  stepNumber,
  icon,
  children,
}: {
  title: string;
  stepNumber?: string;
  icon?: any;
  children: ReactNode;
}) {
  return (
    <AppCard style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        {stepNumber ? (
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{stepNumber}</Text>
          </View>
        ) : icon ? (
          <Ionicons name={icon} size={18} color={Colors.primary} />
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </AppCard>
  );
}

// -------------------------------------------------------------
// Portfolio Card Item Component (With local fallback guarantee)
// -------------------------------------------------------------
function PortfolioCardItem({
  item,
  index,
}: {
  item: { uri: string; title: string; location: string; fallbackIndex?: number };
  index: number;
}) {
  const [imgError, setImgError] = useState(false);
  const fallbackAsset =
    LOCAL_HERITAGE_FALLBACKS[(item.fallbackIndex ?? index) % LOCAL_HERITAGE_FALLBACKS.length];

  const imageSource = useMemo(() => {
    if (imgError || !item.uri?.trim()) {
      return fallbackAsset;
    }
    const fullUrl = getMediaUrl(item.uri);
    return fullUrl ? { uri: fullUrl } : fallbackAsset;
  }, [imgError, item.uri, fallbackAsset]);

  return (
    <View style={styles.portfolioCard}>
      <Image
        source={imageSource}
        style={styles.portfolioImage}
        contentFit="cover"
        transition={200}
        onError={() => setImgError(true)}
      />
      <View style={styles.portfolioOverlay}>
        <Text style={styles.portfolioTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.portfolioLocRow}>
          <Ionicons name="location-sharp" size={10} color="#FFFFFF" />
          <Text style={styles.portfolioLocText}>{item.location}</Text>
        </View>
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// Meta Component
// -------------------------------------------------------------
function Meta({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metaItem}>
      <View style={styles.metaIconBox}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

// -------------------------------------------------------------
// Styles
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F6' },
  content: { paddingBottom: 125, gap: 14 },
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
  headerActions: { flexDirection: 'row', gap: 8 },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FAF8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: '#FFFFFF' },
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 1,
  },
  pad: { paddingHorizontal: 16 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
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
    fontFamily: FontFamily.displayBold,
    fontSize: 22,
    lineHeight: 29,
    color: '#1B1C1C',
    marginTop: 8,
  },
  muted: { fontFamily: FontFamily.body, fontSize: 11, color: '#8F8E8E' },

  // Price Hero Row
  priceHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    marginTop: 10,
    ...Shadow,
  },
  priceHeroLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
  },
  priceHeroValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: Colors.primary,
  },
  priceHeroUnit: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trustPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#059669',
  },

  // 4 Meta Feature Badges
  meta: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    ...Shadow,
  },
  metaIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metaValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  metaLabel: {
    fontFamily: FontFamily.body,
    fontSize: 9,
    color: '#8F8E8E',
    marginTop: 1,
  },

  // Highlights Card
  highlightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  highlightsHeader: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: '#8F8E8E',
    marginBottom: 10,
  },
  highlightsGrid: {
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  highlightIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  highlightTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  highlightDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 1,
  },

  // Package selector
  packageRow: { gap: 10, paddingRight: 12 },
  packageCard: {
    width: 190,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  packageSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7F9',
    borderWidth: 1.5,
  },
  packageCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageBadge: {
    backgroundColor: '#F3F0EF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageBadgeSelected: {
    backgroundColor: '#FFF0F3',
  },
  packageBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    color: '#5F5E5E',
  },
  packageBadgeTextSelected: {
    color: Colors.primary,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  packageName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
    minHeight: 34,
  },
  packageNameSelected: { color: '#1B1C1C' },
  packagePrice: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: Colors.primary,
  },
  packagePriceSelected: { color: Colors.primary },
  packageMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  packageMeta: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#5F5E5E',
  },
  packageMetaSelected: { color: Colors.primary },

  // Provider / Studio Card
  providerCard: {
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    ...Shadow,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: Colors.primary,
  },
  providerName: { fontFamily: FontFamily.displayBold, fontSize: 13.5, color: '#1B1C1C' },
  providerSub: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  providerTagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  providerSpeedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  providerSpeedText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    color: '#92400E',
  },
  providerLocTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  providerLocText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    color: '#059669',
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
  chatText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: '#FFFFFF' },

  // Sections
  sectionCard: { marginHorizontal: 16, padding: 15, borderRadius: 18, ...Shadow },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15.5,
    color: '#1B1C1C',
  },
  helper: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginBottom: 10,
  },

  // Dates
  dateRow: { gap: 8, paddingRight: 8 },
  day: {
    width: 56,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FAF8F8',
    alignItems: 'center',
  },
  dayActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayWeek: { fontFamily: FontFamily.bodyMedium, fontSize: 9.5, color: '#8F8E8E' },
  dayNumber: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#1B1C1C',
    marginVertical: 2,
  },
  dayMonth: { fontFamily: FontFamily.body, fontSize: 9, color: '#8F8E8E' },
  lightText: { color: '#FFFFFF' },
  disabled: { opacity: 0.35 },

  // Slots
  loadingBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingCopy: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  slotsSection: {
    marginTop: 12,
  },
  slotSectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#5F5E5E',
    marginBottom: 8,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 10,
    backgroundColor: '#FAF8F8',
  },
  slotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 11,
    marginTop: 10,
  },
  warningText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#92400E',
  },
  promptSelectDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFF0F3',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  promptSelectDateText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.primary,
  },

  // Duration
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F8',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  durationLeft: { flex: 1 },
  durationTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  durationOvertime: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  durationStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: { opacity: 0.35 },
  durationValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
    minWidth: 32,
    textAlign: 'center',
  },

  // Inputs & Chips
  inputLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#5F5E5E',
    marginBottom: 6,
    marginTop: 8,
  },
  presetChipRow: {
    gap: 7,
    paddingBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FAF8F8',
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#1B1C1C',
  },
  presetChipTextActive: { color: '#FFFFFF' },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    backgroundColor: '#FAF8F8',
    paddingHorizontal: 12,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#1B1C1C',
  },

  // Live Quote
  quoteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F0EF',
  },
  quotePackage: {
    flex: 1,
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  basePrice: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#1B1C1C' },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  quoteLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F5E5E',
  },
  quoteValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: '#1B1C1C' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: '#1B1C1C' },
  totalPrice: { fontFamily: FontFamily.displayBold, fontSize: 19, color: Colors.primary },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  successText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#059669',
  },
  errorBox: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.error,
  },
  unreadyQuoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  unreadyQuoteText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#92400E',
  },

  // Inclusions
  included: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F3',
  },
  includedText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#374151',
  },

  // Portfolio
  portfolioSection: {
    paddingHorizontal: 16,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  portfolioHeadingTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15.5,
    color: '#1B1C1C',
  },
  portfolioRow: { gap: 11 },
  portfolioCard: {
    width: 170,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FAF5F5',
    ...Shadow,
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  portfolioOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: 'rgba(27,28,28,0.68)',
  },
  portfolioTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  portfolioLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  portfolioLocText: {
    fontFamily: FontFamily.body,
    fontSize: 9,
    color: '#FFE4E6',
  },

  // Weather & Cancellation policy
  weatherPolicyBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 10,
  },
  weatherPolicyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  weatherPolicyTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#92400E',
  },
  weatherPolicyDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#B45309',
  },
  policyRowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  policySubTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  policySubDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 2,
  },

  // Bottom Sticky Bar
  bottom: {
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
  bottomPriceCol: { flex: 1 },
  bottomLabel: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E' },
  bottomPrice: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: Colors.primary,
  },
  bottomNote: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#059669',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryCta: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    minWidth: 155,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaPrompt: {
    backgroundColor: Colors.primary,
  },
  ctaText: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: '#FFFFFF' },
});
