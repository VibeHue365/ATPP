import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useDestination } from '@/contexts/DestinationContext';
import { WeatherDetailModal } from '@/components/weather/WeatherDetailModal';
import { productApi } from '@/apis/productApi';
import { photographerApi } from '@/apis/photographerApi';
import { comboApi } from '@/apis/comboApi';
import { bookingApi } from '@/apis/bookingApi';
import { getMediaUrl } from '@/utils/media';
import type { Booking } from '@/types/booking';
import type { Product } from '@/types/product';
import type {
  Photographer,
  PhotographerConcept,
  PhotographerPackageCategory,
} from '@/types/photographer';
import { comboOriginalPrice, comboPublishedPrice, type ComboDeal } from '@/types/combo';

const formatVND = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;

interface LiveWeatherState {
  tempC: number;
  conditionLabel: string;
  goldenHourSlot: string;
}

function mapWeatherCodeToVi(code: number): string {
  if (code === 0) return 'Trời quang · Nắng đẹp';
  if (code === 1 || code === 2) return 'Nắng nhẹ · Ít mây';
  if (code === 3) return 'Trời mát · Nhiều mây';
  if (code >= 45 && code <= 48) return 'Sương mờ nhẹ';
  if (code >= 51 && code <= 67) return 'Mưa nhỏ rải rác';
  if (code >= 80 && code <= 82) return 'Mưa rào nhẹ';
  return 'Thời tiết dịu mát';
}

function computeGoldenHourRange(sunsetIso?: string): string {
  if (!sunsetIso) return '16:00 - 17:30';
  const sunsetDate = new Date(sunsetIso);
  if (Number.isNaN(sunsetDate.getTime())) return '16:00 - 17:30';
  const startDate = new Date(sunsetDate.getTime() - 90 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(startDate.getHours())}:${pad(startDate.getMinutes())} - ${pad(
    sunsetDate.getHours()
  )}:${pad(sunsetDate.getMinutes())}`;
}

export default function CustomerHomeScreen() {
  const { user, loading: authLoading, isAuthenticated, isFavorite, toggleFavorite } = useAuth();
  const { count: cartCount } = useCart();
  const { unreadCount, reload: reloadNotifications } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>('Tất cả');

  // Real API states
  const [products, setProducts] = useState<Product[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [concepts, setConcepts] = useState<PhotographerConcept[]>([]);
  const [packageCategories, setPackageCategories] = useState<PhotographerPackageCategory[]>([]);
  const [combos, setCombos] = useState<ComboDeal[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const { destination, openDestinationPicker } = useDestination();
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);
  const [weather, setWeather] = useState<LiveWeatherState | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic weather re-fetch when destination changes
  useEffect(() => {
    let active = true;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${destination.lat}&longitude=${destination.lng}&current=temperature_2m,weather_code&daily=sunset&timezone=Asia%2FHo_Chi_Minh`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (!active || !json?.current) return;
        setWeather({
          tempC: Math.round(Number(json.current.temperature_2m ?? 27)),
          conditionLabel: mapWeatherCodeToVi(Number(json.current.weather_code ?? 1)),
          goldenHourSlot: computeGoldenHourRange(json?.daily?.sunset?.[0]),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [destination.lat, destination.lng, destination.code]);

  const fetchAllHomeData = useCallback(async () => {
    const fetchProductsPromise = (
      isAuthenticated
        ? productApi
            .personalized({ page: 1, limit: 12 })
            .catch(() => productApi.list({ page: 1, limit: 12 }))
        : productApi.list({ page: 1, limit: 12 })
    )
      .then((res) => res.data ?? [])
      .catch(() => productApi.featured(12).catch(() => [] as Product[]));

    const fetchPhotographersPromise = photographerApi
      .list({ page: 1, limit: 8, sort: 'rating_desc' })
      .then((res) => res.data ?? [])
      .catch(() => [] as Photographer[]);

    const fetchConceptsPromise = photographerApi
      .concepts()
      .then((res) => res.data ?? [])
      .catch(() => [] as PhotographerConcept[]);

    const fetchCategoriesPromise = photographerApi
      .categories()
      .then((res) => (res.data ?? []).filter((c) => c.status === 'ACTIVE'))
      .catch(() => [] as PhotographerPackageCategory[]);

    const fetchCombosPromise = comboApi.list().catch(() => [] as ComboDeal[]);

    const fetchBookingsPromise = isAuthenticated
      ? bookingApi
          .list()
          .then((list) => {
            if (!Array.isArray(list) || list.length === 0) return null;
            return (
              list.find(
                (b) =>
                  b.status === 'CONFIRMED' ||
                  b.status === 'PICKUP_PENDING' ||
                  b.status === 'PICKED_UP' ||
                  b.status === 'IN_PROGRESS' ||
                  b.status === 'DEPOSIT_PAID'
              ) ?? null
            );
          })
          .catch(() => null)
      : Promise.resolve(null);

    const fetchWeatherPromise = fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${destination.lat}&longitude=${destination.lng}&current=temperature_2m,weather_code&daily=sunset&timezone=Asia%2FHo_Chi_Minh`
    )
      .then((r) => r.json())
      .then((json) => {
        if (json?.current) {
          return {
            tempC: Math.round(Number(json.current.temperature_2m ?? 27)),
            conditionLabel: mapWeatherCodeToVi(Number(json.current.weather_code ?? 1)),
            goldenHourSlot: computeGoldenHourRange(json?.daily?.sunset?.[0]),
          } as LiveWeatherState;
        }
        return null;
      })
      .catch(() => null);

    const [
      loadedProducts,
      loadedPhotographers,
      loadedConcepts,
      loadedCategories,
      loadedCombos,
      loadedBooking,
      loadedWeather,
    ] = await Promise.all([
      fetchProductsPromise,
      fetchPhotographersPromise,
      fetchConceptsPromise,
      fetchCategoriesPromise,
      fetchCombosPromise,
      fetchBookingsPromise,
      fetchWeatherPromise,
    ]);

    setProducts(loadedProducts);
    setPhotographers(loadedPhotographers);
    setConcepts(loadedConcepts);
    setPackageCategories(loadedCategories);
    setCombos(loadedCombos);
    setActiveBooking(loadedBooking);
    if (loadedWeather) setWeather(loadedWeather);
  }, [isAuthenticated, destination.lat, destination.lng]);

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    setLoading(true);
    fetchAllHomeData().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [authLoading, fetchAllHomeData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchAllHomeData(), reloadNotifications()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearchSubmit = () => {
    router.push('/(tabs)/rentals');
  };

  const handleToggleFavorite = async (productId: string) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    try {
      await toggleFavorite('PRODUCT', productId);
    } catch {
      // ignore
    }
  };

  // Extract dynamic style/category filters from real products
  const styleFilterTabs = useMemo(() => {
    const stylesSet = new Set<string>();
    products.forEach((p) => {
      if (p.style && p.style.trim()) {
        stylesSet.add(p.style.trim());
      }
      p.customTags?.forEach((tag) => {
        if (tag.label && tag.label.trim()) {
          stylesSet.add(tag.label.trim());
        }
      });
    });
    return ['Tất cả', ...Array.from(stylesSet).slice(0, 6)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesTab =
        selectedStyleFilter === 'Tất cả' ||
        p.style?.toLowerCase() === selectedStyleFilter.toLowerCase() ||
        p.customTags?.some(
          (t) => t.label?.toLowerCase() === selectedStyleFilter.toLowerCase()
        );
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.style ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, selectedStyleFilter, searchQuery]);

  // Top spotlight recommendation from real API data (prefer top Combo, else top Product)
  const topRecommendation = useMemo(() => {
    if (combos.length > 0) {
      const topCombo = combos[0];
      const remaining = Math.max(1, (topCombo.maxUsage || 10) - (topCombo.usedCount || 0));
      const rawCover =
        topCombo.image ||
        topCombo.images?.[0] ||
        topCombo.productId?.images?.[0] ||
        topCombo.photographyPackageId?.images?.[0];
      return {
        type: 'COMBO' as const,
        id: topCombo._id,
        title: topCombo.name,
        description:
          topCombo.description ||
          `${topCombo.productId?.name || 'Cổ phục'} kết hợp ${
            topCombo.photographyPackageId?.name || 'gói chụp ngoại cảnh'
          }${topCombo.location ? ` tại ${topCombo.location}` : ''}.`,
        slotLabel: `• Còn ${remaining} suất ưu đãi`,
        price: comboPublishedPrice(topCombo),
        unitLabel: '/combo',
        image: getMediaUrl(rawCover),
      };
    }
    if (products.length > 0) {
      const topProd = products[0];
      const matchReason =
        topProd.recommendation?.reasons?.[0] ||
        topProd.description ||
        `Mẫu ${topProd.style || 'cổ phục'} được yêu thích tại ${
          typeof topProd.providerId === 'object'
            ? topProd.providerId?.businessName || 'Cố đô Huế'
            : 'Cố đô Huế'
        }.`;
      return {
        type: 'PRODUCT' as const,
        id: topProd._id,
        title: topProd.name,
        description: matchReason,
        slotLabel:
          topProd.sizes?.length > 0
            ? `• Sẵn size ${topProd.sizes.join(', ')}`
            : '• Sẵn sàng tại tiệm',
        price: topProd.discountedPrice ?? topProd.basePrice,
        unitLabel: '/ngày',
        image: getMediaUrl(topProd.images?.[0]),
      };
    }
    return null;
  }, [combos, products]);

  // Real active booking reminder details
  const activeBookingReminder = useMemo(() => {
    if (!activeBooking) return null;
    const firstItem = activeBooking.items?.[0];
    const itemName =
      (typeof firstItem?.productId === 'object' && firstItem?.productId?.name) ||
      (typeof firstItem?.photographyPackageId === 'object' &&
        firstItem?.photographyPackageId?.name) ||
      firstItem?.packageSnapshot?.name ||
      `Đơn #${activeBooking.bookingCode}`;

    const firstSchedule = activeBooking.schedules?.[0];
    const timeStr =
      firstSchedule?.timeSlot ||
      firstItem?.shootTimeSlot ||
      (firstItem?.rentalFrom
        ? new Date(firstItem.rentalFrom).toLocaleDateString('vi-VN')
        : activeBooking.bookingCode);

    const providerObj =
      typeof firstItem?.providerId === 'object'
        ? firstItem.providerId
        : typeof activeBooking.providerIds?.[0] === 'object'
        ? activeBooking.providerIds[0]
        : null;

    const locationStr =
      firstItem?.pickupReturnLocationSnapshot?.address ||
      firstItem?.shootLocation ||
      firstSchedule?.locationAddress ||
      providerObj?.businessName ||
      `Mã đơn #${activeBooking.bookingCode}`;

    return {
      id: activeBooking._id,
      title: `${timeStr} · ${itemName}`,
      subtitle: locationStr,
    };
  }, [activeBooking]);

  // Pool of real photography images from loaded photographers to pair with categories that lack a coverImage field
  const realCategoryCoverPool = useMemo(() => {
    const imgs: string[] = [];
    photographers.forEach((p) => {
      const candidate =
        p.defaultPackage?.images?.[0] ||
        p.coverImage ||
        p.media?.coverUrl ||
        p.media?.images?.[0] ||
        p.portfolioItems?.[0]?.images?.[0] ||
        p.portfolio?.[0];
      const resolved = getMediaUrl(candidate);
      if (resolved && !imgs.includes(resolved)) {
        imgs.push(resolved);
      }
    });
    return imgs;
  }, [photographers]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerBrandGroup}>
          <Image
            source={require('@/assets/images/logo-transparent.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <Pressable
            style={styles.destinationSelector}
            onPress={openDestinationPicker}
          >
            <Ionicons name="compass" size={15} color="#BA0049" />
            <View style={styles.destinationTextWrap}>
              <Text style={styles.destinationOverline}>ĐIỂM ĐẾN</Text>
              <View style={styles.destinationTitleRow}>
                <Text style={styles.destinationTitle}>{destination.name}</Text>
                <Ionicons name="chevron-down" size={12} color="#5F5E5E" />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={styles.headerActions}>
          {/* Notification Button */}
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => {
              if (authLoading) return;
              if (isAuthenticated) router.push('/notifications');
              else router.push('/(auth)/login');
            }}
          >
            <Ionicons name="notifications-outline" size={20} color="#1B1C1C" />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </Pressable>

          {/* Cart / Bag Button */}
          <Pressable style={styles.headerIconBtn} onPress={() => router.push('/cart')}>
            <Ionicons name="bag-handle-outline" size={20} color="#1B1C1C" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Profile Avatar Button */}
          <Pressable
            style={styles.avatarButton}
            onPress={() => {
              if (authLoading) return;
              if (isAuthenticated) router.push('/(tabs)/profile');
              else router.push('/(auth)/login');
            }}
          >
            {getMediaUrl(user?.avatarUrl) ? (
              <Image
                source={getMediaUrl(user?.avatarUrl)}
                style={styles.avatarImg}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#BA0049"
            colors={['#BA0049']}
          />
        }
      >
        {/* SECTION 1: Live Trip Context & Real-Time Weather Widget */}
        {weather && (
          <View style={styles.section1Container}>
            <Pressable
              style={styles.weatherWidgetCard}
              onPress={() => setShowWeatherDetail(true)}
            >
              <View style={styles.weatherLeft}>
                <View style={styles.weatherIconBox}>
                  <MaterialIcons name="wb-twilight" size={20} color="#BA0049" />
                </View>
                <View style={styles.weatherInfoWrap}>
                  <View style={styles.weatherTitleRow}>
                    <Text style={styles.weatherTitle}>
                      {`${destination.shortName} ${weather.tempC}°C · ${weather.conditionLabel}`}
                    </Text>
                    <View style={styles.onlinePulseDot} />
                  </View>
                  <Text style={styles.weatherSubtitle} numberOfLines={1}>
                    {`Khung giờ vàng hôm nay ${weather.goldenHourSlot} · Chạm xem gợi ý cổ phục`}
                  </Text>
                </View>
              </View>

              <View style={styles.weatherActionPill}>
                <Text style={styles.weatherActionText}>Chi tiết</Text>
                <Ionicons name="chevron-forward" size={12} color="#BA0049" />
              </View>
            </Pressable>
          </View>
        )}

        {/* SECTION 2: Smart Intent Search Hub & Quick Actions + Real Live Booking Reminder */}
        <View style={styles.section2Container}>
          {/* Search Bar with AI Stylist Button */}
          <View style={styles.searchBarRow}>
            <Ionicons name="search" size={20} color="#BA0049" style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Tìm áo dài, thợ ảnh, bối cảnh..."
              placeholderTextColor="rgba(95, 94, 94, 0.7)"
              style={styles.searchInput}
              returnKeyType="search"
            />
            <Pressable
              style={styles.aiStylistBtn}
              onPress={() => router.push('/ai-assistant')}
            >
              <MaterialIcons name="auto-awesome" size={14} color="#FFFFFF" />
              <Text style={styles.aiStylistBtnText}>AI Stylist</Text>
            </Pressable>
          </View>

          {/* 4-Column Quick Actions Grid */}
          <View style={styles.quickActionGrid}>
            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/rentals')}
            >
              <View style={styles.quickActionIconCircle}>
                <MaterialCommunityIcons name="hanger" size={20} color="#BA0049" />
              </View>
              <Text style={styles.quickActionLabel}>{'Thuê Áo\nDài'}</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/photography')}
            >
              <View style={styles.quickActionIconCircle}>
                <Ionicons name="camera-outline" size={20} color="#BA0049" />
              </View>
              <Text style={styles.quickActionLabel}>{'Đặt Thợ\nẢnh'}</Text>
            </Pressable>

            <Pressable style={styles.quickActionCard} onPress={() => router.push('/combos')}>
              {combos.length > 0 && combos[0]?.discountPercent ? (
                <View style={styles.quickActionDiscountBadge}>
                  <Text style={styles.quickActionDiscountText}>
                    -{combos[0].discountPercent}%
                  </Text>
                </View>
              ) : null}
              <View style={styles.quickActionIconCircle}>
                <MaterialIcons name="auto-awesome" size={20} color="#BA0049" />
              </View>
              <Text style={styles.quickActionLabel}>{'Combo\nTrọn Gói'}</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/bookings')}
            >
              <View style={styles.quickActionIconCircle}>
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={20}
                  color="#BA0049"
                />
              </View>
              <Text style={styles.quickActionLabel}>{'Lịch Hẹn\nCủa Tôi'}</Text>
            </Pressable>
          </View>

          {/* Grab / Traveloka Style Nearby Store Map Entry */}
          <Pressable
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFF5F8',
              borderWidth: 1,
              borderColor: '#F3C4D5',
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
            onPress={() => router.push('/stores?mode=map' as Href)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#BA0049',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="map" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FontFamily.bodyBold,
                    fontSize: 12.5,
                    color: '#1E1418',
                  }}
                >
                  Bản đồ Tiệm Áo Dài & Studio Gần Bạn Nhất
                </Text>
                <Text
                  style={{
                    fontFamily: FontFamily.body,
                    fontSize: 11,
                    color: '#6E5A62',
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  Tìm tiệm quanh vị trí của bạn trên toàn quốc & dẫn đường 1 chạm
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#BA0049',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  fontFamily: FontFamily.bodyBold,
                  fontSize: 10.5,
                  color: '#FFFFFF',
                }}
              >
                Mở Map
              </Text>
              <Ionicons name="navigate" size={12} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Real Live Booking Reminder Pill — ONLY rendered when user has an active booking */}
          {activeBookingReminder && (
            <Pressable
              style={styles.liveBookingPill}
              onPress={() => router.push(`/booking/${activeBookingReminder.id}`)}
            >
              <View style={styles.liveBookingLeft}>
                <View style={styles.liveBookingIconCircle}>
                  <MaterialIcons name="event-available" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.liveBookingTextWrap}>
                  <Text style={styles.liveBookingTitle} numberOfLines={1}>
                    {activeBookingReminder.title}
                  </Text>
                  <Text style={styles.liveBookingSubtitle} numberOfLines={1}>
                    {activeBookingReminder.subtitle}
                  </Text>
                </View>
              </View>
              <View style={styles.qrActionBtn}>
                <Text style={styles.qrActionBtnText}>Xem đơn</Text>
                <MaterialIcons name="qr-code-2" size={14} color="#FFFFFF" />
              </View>
            </Pressable>
          )}
        </View>

        {loading && products.length === 0 && photographers.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#BA0049" />
            <Text style={styles.loadingText}>Đang tải dữ liệu thực tế từ hệ thống...</Text>
          </View>
        ) : (
          <>
            {/* SECTION 3: Smart Recommendation Engine (Real Top Combo or Top Product) */}
            {topRecommendation && (
              <View style={styles.section3Container}>
                <Pressable
                  style={styles.perfectSuggestionCard}
                  onPress={() =>
                    topRecommendation.type === 'COMBO'
                      ? router.push(`/combos/${topRecommendation.id}`)
                      : router.push(`/product/${topRecommendation.id}`)
                  }
                >
                  <View style={styles.suggestionHeaderRow}>
                    <View style={styles.suggestionTagPill}>
                      <Ionicons name="flash" size={12} color="#BA0049" />
                      <Text style={styles.suggestionTagText}>GỢI Ý HOÀN HẢO HÔM NAY</Text>
                    </View>
                    <Text style={styles.suggestionSlotLeft}>{topRecommendation.slotLabel}</Text>
                  </View>

                  <View style={styles.suggestionBodyRow}>
                    {topRecommendation.image ? (
                      <Image
                        source={topRecommendation.image}
                        style={styles.suggestionThumb}
                        contentFit="cover"
                        transition={180}
                      />
                    ) : (
                      <View style={[styles.suggestionThumb, styles.placeholderCenter]}>
                        <MaterialCommunityIcons name="hanger" size={26} color="#BA0049" />
                      </View>
                    )}
                    <View style={styles.suggestionInfoCol}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {topRecommendation.title}
                      </Text>
                      <Text style={styles.suggestionDesc} numberOfLines={2}>
                        {topRecommendation.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.suggestionFooterRow}>
                    <View>
                      <Text style={styles.priceLabelSmall}>Giá ưu đãi chỉ từ</Text>
                      <View style={styles.priceValueRow}>
                        <Text style={styles.pricePrimaryBold}>
                          {formatVND(topRecommendation.price)}
                        </Text>
                        <Text style={styles.priceUnitText}> {topRecommendation.unitLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.primaryPillCta}>
                      <Text style={styles.primaryPillCtaText}>Xem chi tiết</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </View>
                  </View>
                </Pressable>
              </View>
            )}

            {/* SECTION 4: Tủ Áo Dài Di Sản (100% Real Products from API) */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWrap}>
                  <Text style={styles.sectionHeading}>Tủ Áo Dài Di Sản</Text>
                  <Text style={styles.sectionSubheading}>
                    {products.length > 0
                      ? `${products.length} mẫu cổ phục & áo dài xác minh từ các nhà cung cấp`
                      : 'Danh sách mẫu cổ phục & áo dài xác minh'}
                  </Text>
                </View>
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => router.push('/(tabs)/rentals')}
                >
                  <Text style={styles.seeAllText}>Tất cả</Text>
                  <Ionicons name="chevron-forward" size={14} color="#BA0049" />
                </Pressable>
              </View>

              {/* Dynamic Category / Style Filter Chips from Real Products */}
              {styleFilterTabs.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipsScroll}
                >
                  {styleFilterTabs.map((tab) => {
                    const active = selectedStyleFilter === tab;
                    return (
                      <Pressable
                        key={tab}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => setSelectedStyleFilter(tab)}
                      >
                        <Text
                          style={[styles.filterChipText, active && styles.filterChipTextActive]}
                        >
                          {tab}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {filteredProducts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyBoxText}>
                    Chưa có mẫu áo dài nào khớp với bộ lọc hiện tại.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalCardsScroll}
                >
                  {filteredProducts.map((product) => {
                    const favored = isFavorite('PRODUCT', product._id);
                    const providerName =
                      typeof product.providerId === 'object'
                        ? product.providerId?.businessName
                        : undefined;
                    const primaryBadge =
                      product.badges?.[0]?.label ||
                      (product.activeCampaign
                        ? `Giảm ${product.activeCampaign.discountPercent}%`
                        : product.materials?.[0] || product.style);
                    const sizesInfo =
                      product.sizes && product.sizes.length > 0
                        ? `Sẵn size ${product.sizes.join(', ')}`
                        : 'Sẵn tại cửa hàng';
                    const storeOverlay = providerName
                      ? `${providerName} · ${sizesInfo}`
                      : sizesInfo;
                    const displayPrice = product.discountedPrice ?? product.basePrice;
                    const avgRating = product.rating?.averageRating;
                    const totalReviews = product.rating?.totalReviews ?? 0;
                    const productImgUrl = getMediaUrl(product.images?.[0]);

                    return (
                      <Pressable
                        key={product._id}
                        style={styles.aoDaiCard}
                        onPress={() => router.push(`/product/${product._id}`)}
                      >
                        <View style={styles.aoDaiImageWrap}>
                          {productImgUrl ? (
                            <Image
                              source={productImgUrl}
                              style={styles.aoDaiImage}
                              contentFit="cover"
                              transition={180}
                            />
                          ) : (
                            <View style={[styles.aoDaiImage, styles.placeholderCenter]}>
                              <MaterialCommunityIcons name="hanger" size={36} color="#BA0049" />
                            </View>
                          )}

                          {/* Top Left Badge from API */}
                          {primaryBadge ? (
                            <View style={[styles.aoDaiTopBadge, styles.aoDaiTopBadgeHot]}>
                              <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                              <Text style={styles.aoDaiTopBadgeText} numberOfLines={1}>
                                {primaryBadge}
                              </Text>
                            </View>
                          ) : null}

                          {/* Favorite Heart Button */}
                          <Pressable
                            style={styles.favoriteBtn}
                            onPress={() => handleToggleFavorite(product._id)}
                          >
                            <Ionicons
                              name={favored ? 'heart' : 'heart-outline'}
                              size={16}
                              color={favored ? '#BA0049' : '#1B1C1C'}
                            />
                          </Pressable>

                          {/* Bottom Store & Sizes Pill from API */}
                          <View style={styles.aoDaiStoreOverlayPill}>
                            <MaterialIcons name="storefront" size={12} color="#FDE047" />
                            <Text style={styles.aoDaiStoreOverlayText} numberOfLines={1}>
                              {storeOverlay}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.aoDaiCardBody}>
                          <View style={styles.aoDaiMetaRow}>
                            <Text style={styles.aoDaiCategoryText} numberOfLines={1}>
                              {product.style || providerName || 'Cổ phục Huế'}
                            </Text>
                            {avgRating !== undefined && avgRating > 0 ? (
                              <View style={styles.ratingRow}>
                                <Ionicons name="star" size={12} color="#F59E0B" />
                                <Text style={styles.ratingValueText}>
                                  {avgRating.toFixed(1)}
                                </Text>
                                <Text style={styles.ratingCountText}>({totalReviews})</Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={styles.aoDaiTitle} numberOfLines={1}>
                            {product.name}
                          </Text>

                          <View style={styles.aoDaiFooterRow}>
                            <View style={styles.priceValueRow}>
                              <Text style={styles.aoDaiPriceText}>
                                {formatVND(displayPrice)}
                              </Text>
                              <Text style={styles.priceUnitText}> /ngày</Text>
                            </View>
                            <View style={styles.aoDaiPlusBtn}>
                              <Ionicons name="add" size={18} color="#FFFFFF" />
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* SECTION 5: Bối Cảnh & Concept Chụp Nổi Bật (100% Real Concepts / Categories + Resolved Media URLs) */}
            {(concepts.length > 0 || packageCategories.length > 0) && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                    <Text style={styles.sectionHeading}>Bối Cảnh & Concept Chụp</Text>
                    <Text style={styles.sectionSubheading}>
                      Dữ liệu concept & danh mục gói chụp thực tế từ các studio
                    </Text>
                  </View>
                  <Ionicons name="compass-outline" size={22} color="#BA0049" />
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalCardsScroll}
                >
                  {concepts.length > 0
                    ? concepts.map((concept, idx) => {
                        const conceptImgUrl =
                          getMediaUrl(concept.coverImage) ||
                          realCategoryCoverPool[idx % Math.max(1, realCategoryCoverPool.length)];
                        return (
                          <Pressable
                            key={concept.code}
                            style={styles.photoSpotCard}
                            onPress={() => router.push('/(tabs)/photography')}
                          >
                            <View style={styles.photoSpotImageWrap}>
                              {conceptImgUrl ? (
                                <Image
                                  source={conceptImgUrl}
                                  style={styles.photoSpotImage}
                                  contentFit="cover"
                                  transition={180}
                                />
                              ) : (
                                <View style={[styles.photoSpotImage, styles.placeholderCenter]}>
                                  <Ionicons name="camera-outline" size={32} color="#BA0049" />
                                </View>
                              )}
                              <View style={styles.photoSpotGradientOverlay} />

                              <View style={styles.photoSpotTimePill}>
                                <Ionicons name="camera" size={12} color="#BA0049" />
                                <Text style={styles.photoSpotTimeText}>
                                  {concept.photographerCount} nhiếp ảnh gia
                                </Text>
                              </View>

                              <View style={styles.photoSpotBottomCapt}>
                                <Text style={styles.photoSpotTitle} numberOfLines={1}>
                                  {concept.label}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.photoSpotFooter}>
                              <View style={styles.photoSpotMatchRow}>
                                <MaterialCommunityIcons
                                  name="camera-iris"
                                  size={14}
                                  color="#BA0049"
                                />
                                <Text style={styles.photoSpotMatchText} numberOfLines={1}>
                                  {concept.photographerCount} studio đang mở
                                </Text>
                              </View>
                              <View style={styles.photoSpotLinkRow}>
                                <Text style={styles.photoSpotLinkText}>Khám phá</Text>
                                <Ionicons name="arrow-forward" size={12} color="#BA0049" />
                              </View>
                            </View>
                          </Pressable>
                        );
                      })
                    : packageCategories.map((cat, idx) => {
                        const catCoverUrl =
                          realCategoryCoverPool[idx % Math.max(1, realCategoryCoverPool.length)];
                        return (
                          <Pressable
                            key={cat.id}
                            style={styles.photoSpotCard}
                            onPress={() => router.push('/(tabs)/photography')}
                          >
                            <View style={styles.photoSpotImageWrap}>
                              {catCoverUrl ? (
                                <Image
                                  source={catCoverUrl}
                                  style={styles.photoSpotImage}
                                  contentFit="cover"
                                  transition={180}
                                />
                              ) : (
                                <View style={[styles.photoSpotImage, styles.placeholderCenter]}>
                                  <Ionicons name="images-outline" size={36} color="#BA0049" />
                                </View>
                              )}
                              <View style={styles.photoSpotGradientOverlay} />
                              <View style={styles.photoSpotTimePill}>
                                <Ionicons name="camera" size={12} color="#BA0049" />
                                <Text style={styles.photoSpotTimeText}>
                                  {cat.packageCount} gói chụp
                                </Text>
                              </View>
                              <View style={styles.photoSpotBottomCapt}>
                                <Text style={styles.photoSpotTitle} numberOfLines={1}>
                                  {cat.name}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.photoSpotFooter}>
                              <View style={styles.photoSpotMatchRow}>
                                <MaterialCommunityIcons
                                  name="camera-iris"
                                  size={14}
                                  color="#BA0049"
                                />
                                <Text style={styles.photoSpotMatchText} numberOfLines={1}>
                                  Danh mục gói chụp xác minh
                                </Text>
                              </View>
                              <View style={styles.photoSpotLinkRow}>
                                <Text style={styles.photoSpotLinkText}>Xem gói</Text>
                                <Ionicons name="arrow-forward" size={12} color="#BA0049" />
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                </ScrollView>
              </View>
            )}

            {/* SECTION 6: Combo Trọn Gói Nổi Bật (100% Real Combos from /combo-promotions/public) */}
            {combos.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                    <View style={styles.titleWithBadgeRow}>
                      <Text style={styles.sectionHeading}>Combo Trọn Gói Nổi Bật</Text>
                      {combos[0]?.discountPercent ? (
                        <View style={styles.discountSectionPill}>
                          <Text style={styles.discountSectionPillText}>
                            -{combos[0].discountPercent}%
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.sectionSubheading}>
                      Kết hợp thuê cổ phục & gói chụp ảnh từ các đối tác TàGo
                    </Text>
                  </View>
                  <Pressable style={styles.seeAllBtn} onPress={() => router.push('/combos')}>
                    <Text style={styles.seeAllText}>Tất cả</Text>
                    <Ionicons name="chevron-forward" size={14} color="#BA0049" />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalCardsScroll}
                >
                  {combos.map((combo: ComboDeal) => {
                    const origPrice = comboOriginalPrice(combo);
                    const pubPrice = comboPublishedPrice(combo);
                    const rawCover =
                      combo.image ||
                      combo.images?.[0] ||
                      combo.productId?.images?.[0] ||
                      combo.photographyPackageId?.images?.[0];
                    const coverUri = getMediaUrl(rawCover);
                    const bottomLabel =
                      combo.location ||
                      (combo.photographyPackageId?.editedPhotosCount
                        ? `${combo.photographyPackageId.editedPhotosCount} ảnh chỉnh màu`
                        : combo.providerId?.businessName || 'Trọn gói Áo + Chụp');

                    return (
                      <Pressable
                        key={combo._id}
                        style={styles.comboCard}
                        onPress={() => router.push(`/combos/${combo._id}`)}
                      >
                        <View style={styles.comboImageWrap}>
                          {coverUri ? (
                            <Image
                              source={coverUri}
                              style={styles.comboImage}
                              contentFit="cover"
                              transition={180}
                            />
                          ) : (
                            <View style={[styles.comboImage, styles.placeholderCenter]}>
                              <MaterialIcons name="auto-awesome" size={32} color="#BA0049" />
                            </View>
                          )}
                          <View style={styles.photoSpotGradientOverlay} />

                          {combo.discountPercent > 0 && (
                            <View style={[styles.comboTopBadge, styles.aoDaiTopBadgeHot]}>
                              <MaterialIcons name="local-offer" size={11} color="#FFFFFF" />
                              <Text style={styles.aoDaiTopBadgeText}>
                                Tiết kiệm {combo.discountPercent}%
                              </Text>
                            </View>
                          )}

                          <View style={styles.comboBottomGlassPill}>
                            <Ionicons name="camera-outline" size={12} color="#FDE047" />
                            <Text style={styles.aoDaiStoreOverlayText} numberOfLines={1}>
                              {bottomLabel}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.comboBody}>
                          <Text style={styles.comboTitle} numberOfLines={1}>
                            {combo.name}
                          </Text>
                          <Text style={styles.comboDescription} numberOfLines={2}>
                            {combo.description ||
                              `${combo.productId?.name ?? 'Cổ phục'} + ${
                                combo.photographyPackageId?.name ?? 'Gói chụp ngoại cảnh'
                              }`}
                          </Text>

                          <View style={styles.comboFooterRow}>
                            <View>
                              {origPrice > pubPrice && (
                                <Text style={styles.strikethroughPrice}>
                                  {formatVND(origPrice)}
                                </Text>
                              )}
                              <Text style={styles.comboPriceText}>{formatVND(pubPrice)}</Text>
                            </View>
                            <View style={styles.bookComboBtn}>
                              <Text style={styles.bookComboBtnText}>Đặt Combo</Text>
                              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* SECTION 7: Nhiếp Ảnh Gia Tuyển Chọn (100% Real Photographers from /api/photographers) */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWrap}>
                  <View style={styles.titleWithBadgeRow}>
                    <Text style={styles.sectionHeading}>Nhiếp Ảnh Gia Tuyển Chọn</Text>
                    <View style={styles.proHostBadge}>
                      <MaterialIcons name="verified" size={12} color="#BA0049" />
                      <Text style={styles.proHostBadgeText}>Đã xác minh</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSubheading}>
                    {photographers.length > 0
                      ? `${photographers.length} nhiếp ảnh gia & studio đang hoạt động`
                      : 'Danh sách nhiếp ảnh gia & studio đối tác'}
                  </Text>
                </View>
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => router.push('/(tabs)/photography')}
                >
                  <Text style={styles.seeAllText}>Tất cả</Text>
                  <Ionicons name="chevron-forward" size={14} color="#BA0049" />
                </Pressable>
              </View>

              {photographers.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyBoxText}>
                    Hiện chưa có nhiếp ảnh gia nào trong danh sách.
                  </Text>
                </View>
              ) : (
                <View style={styles.photographerStack}>
                  {photographers.map((photographer: Photographer) => {
                    const name = photographer.businessName || 'Studio Nhiếp Ảnh';
                    const avgRating = photographer.rating?.averageRating;
                    const totalReviews = photographer.rating?.totalReviews ?? 0;
                    const defaultPkg =
                      photographer.defaultPackage || photographer.packages?.[0];
                    const price = defaultPkg?.price ?? 0;
                    const durationLabel = defaultPkg?.durationHours
                      ? `/buổi ${defaultPkg.durationHours}h`
                      : '/gói chụp';

                    // Collect all valid image URLs through getMediaUrl()
                    const rawPortfolioList: Array<string | undefined | null> = [
                      ...(photographer.defaultPackage?.images ?? []),
                      photographer.coverImage,
                      photographer.media?.coverUrl,
                      ...(photographer.media?.images ?? []),
                      ...(photographer.portfolio ?? []),
                    ];
                    if (Array.isArray(photographer.portfolioItems)) {
                      photographer.portfolioItems.forEach((pItem) => {
                        if (Array.isArray(pItem.images)) {
                          rawPortfolioList.push(...pItem.images);
                        }
                      });
                    }
                    if (Array.isArray(photographer.packages)) {
                      photographer.packages.forEach((pkg) => {
                        if (Array.isArray(pkg.images)) {
                          rawPortfolioList.push(...pkg.images);
                        }
                      });
                    }

                    const uniqueResolvedImages: string[] = [];
                    rawPortfolioList.forEach((raw) => {
                      const resolved = getMediaUrl(raw);
                      if (resolved && !uniqueResolvedImages.includes(resolved)) {
                        uniqueResolvedImages.push(resolved);
                      }
                    });

                    const avatarUri = uniqueResolvedImages[0];
                    const previewThumbs = uniqueResolvedImages.slice(0, 3);

                    const locationTag =
                      photographer.address?.district ||
                      photographer.address?.city ||
                      (photographer.activePackageCount
                        ? `${photographer.activePackageCount} gói chụp`
                        : null);

                    return (
                      <Pressable
                        key={photographer._id}
                        style={styles.photographerCard}
                        onPress={() => router.push(`/photographer/${photographer._id}`)}
                      >
                        <View style={styles.photographerTopRow}>
                          <View style={styles.photographerLeftRow}>
                            <View style={styles.photographerAvatarWrap}>
                              {avatarUri ? (
                                <Image
                                  source={avatarUri}
                                  style={styles.photographerAvatar}
                                  contentFit="cover"
                                  transition={180}
                                />
                              ) : (
                                <View
                                  style={[styles.photographerAvatar, styles.placeholderCenter]}
                                >
                                  <Ionicons name="camera" size={20} color="#BA0049" />
                                </View>
                              )}
                              {photographer.isBookable !== false && (
                                <View style={styles.photographerOnlineDot} />
                              )}
                            </View>
                            <View style={styles.photographerMetaCol}>
                              <View style={styles.photographerNameRow}>
                                <Text style={styles.photographerName} numberOfLines={1}>
                                  {name}
                                </Text>
                                {photographer.activePackageCount ? (
                                  <View style={styles.photographerRoleBadge}>
                                    <Text style={styles.photographerRoleBadgeText}>
                                      {photographer.activePackageCount} gói
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <View style={styles.photographerStatsRow}>
                                {avgRating !== undefined && avgRating > 0 ? (
                                  <>
                                    <Ionicons name="star" size={13} color="#F59E0B" />
                                    <Text style={styles.photographerRatingText}>
                                      {avgRating.toFixed(1)}
                                    </Text>
                                    <Text style={styles.photographerDotSep}>•</Text>
                                  </>
                                ) : null}
                                <Text style={styles.photographerMetaText}>
                                  {totalReviews} đánh giá
                                </Text>
                                {defaultPkg?.name ? (
                                  <>
                                    <Text style={styles.photographerDotSep}>•</Text>
                                    <Text
                                      style={styles.photographerSpecialtyText}
                                      numberOfLines={1}
                                    >
                                      {defaultPkg.name}
                                    </Text>
                                  </>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          {locationTag ? (
                            <View style={styles.styleToneChip}>
                              <Text style={styles.styleToneChipText}>{locationTag}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Real Portfolio Preview (1, 2, or 3 images cleanly formatted) */}
                        {previewThumbs.length > 0 ? (
                          <View style={styles.portfolioGrid}>
                            {previewThumbs.map((imgUri, pIdx) => (
                              <Image
                                key={`${photographer._id}-port-${pIdx}`}
                                source={imgUri}
                                style={[
                                  styles.portfolioThumb,
                                  previewThumbs.length === 1 && styles.portfolioThumbSingle,
                                ]}
                                contentFit="cover"
                                transition={180}
                              />
                            ))}
                          </View>
                        ) : photographer.quote ? (
                          <Text style={styles.photographerQuoteText} numberOfLines={2}>
                            “{photographer.quote}”
                          </Text>
                        ) : null}

                        <View style={styles.photographerFooterRow}>
                          <View>
                            <Text style={styles.priceLabelSmall}>Chỉ từ</Text>
                            <View style={styles.priceValueRow}>
                              <Text style={styles.aoDaiPriceText}>
                                {price > 0 ? formatVND(price) : 'Liên hệ'}
                              </Text>
                              {price > 0 && (
                                <Text style={styles.priceUnitText}> {durationLabel}</Text>
                              )}
                            </View>
                          </View>
                          <Pressable
                            style={styles.photographerBookBtn}
                            onPress={() => router.push(`/photographer/${photographer._id}`)}
                          >
                            <MaterialIcons name="event-available" size={14} color="#FFFFFF" />
                            <Text style={styles.photographerBookBtnText}>Xem lịch trống</Text>
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {weather && (
        <WeatherDetailModal
          visible={showWeatherDetail}
          onClose={() => setShowWeatherDetail(false)}
          cityName={destination.name}
          cityCode={destination.code}
          tempC={weather.tempC}
          conditionLabel={weather.conditionLabel}
          goldenHourSlot={weather.goldenHourSlot}
          heroSpot={destination.heroSpot}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(251, 249, 249, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(227, 190, 195, 0.25)',
  },
  headerBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 84,
    height: 30,
  },
  destinationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
  },
  destinationTextWrap: {
    flexDirection: 'column',
  },
  destinationOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#5F5E5E',
    lineHeight: 11,
  },
  destinationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  destinationTitle: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    color: '#1B1C1C',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA0049',
    borderWidth: 1.5,
    borderColor: '#FBF9F9',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
  },
  placeholderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3F3',
  },
  emptyBox: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
  },
  emptyBoxText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
  },

  /* SECTION 1: Weather Widget */
  section1Container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  weatherWidgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3F3',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  weatherIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherInfoWrap: {
    flex: 1,
  },
  weatherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  onlinePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  weatherSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
    marginTop: 2,
  },
  weatherActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.45)',
  },
  weatherActionText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
  },

  /* SECTION 2: Search Hub + Quick Actions + Live Booking */
  section2Container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.5)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: '#1B1C1C',
    paddingVertical: 4,
  },
  aiStylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  aiStylistBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  quickActionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.28)',
    position: 'relative',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  quickActionDiscountBadge: {
    position: 'absolute',
    top: -6,
    right: 6,
    backgroundColor: '#BA0049',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    zIndex: 2,
  },
  quickActionDiscountText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    color: '#FFFFFF',
  },
  quickActionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 217, 222, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1B1C1C',
    textAlign: 'center',
    lineHeight: 14,
  },
  liveBookingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 217, 222, 0.45)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(186, 0, 73, 0.2)',
  },
  liveBookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  liveBookingIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBookingTextWrap: {
    flex: 1,
  },
  liveBookingTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  liveBookingSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: '#5F5E5E',
    marginTop: 1,
  },
  qrActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  qrActionBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },

  /* SECTION 3: Gợi Ý Hoàn Hảo Hôm Nay */
  section3Container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  perfectSuggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(186, 0, 73, 0.16)',
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  suggestionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  suggestionTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD9DE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  suggestionTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#BA0049',
    letterSpacing: 0.4,
  },
  suggestionSlotLeft: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
  },
  suggestionBodyRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  suggestionThumb: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: '#EFEDED',
  },
  suggestionInfoCol: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    color: '#1B1C1C',
  },
  suggestionDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
    marginTop: 4,
    lineHeight: 16,
  },
  suggestionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.25)',
  },
  priceLabelSmall: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#5F5E5E',
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pricePrimaryBold: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#BA0049',
  },
  priceUnitText: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#5F5E5E',
  },
  primaryPillCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#BA0049',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  primaryPillCtaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  /* Shared Section Styles */
  sectionContainer: {
    paddingTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionHeading: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
  },
  sectionSubheading: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#BA0049',
  },

  /* Filter Chips */
  filterChipsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F5F3F3',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
  },
  filterChipActive: {
    backgroundColor: '#1B1C1C',
    borderColor: '#1B1C1C',
  },
  filterChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },

  /* Horizontal Carousels */
  horizontalCardsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 14,
  },

  /* Ao Dai Cards */
  aoDaiCard: {
    width: 236,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.3)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  aoDaiImageWrap: {
    width: '100%',
    height: 280,
    backgroundColor: '#EFEDED',
    position: 'relative',
  },
  aoDaiImage: {
    width: '100%',
    height: '100%',
  },
  aoDaiTopBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    maxWidth: 165,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aoDaiTopBadgeHot: {
    backgroundColor: 'rgba(186, 0, 73, 0.92)',
  },
  aoDaiTopBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aoDaiStoreOverlayPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27, 28, 28, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  aoDaiStoreOverlayText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: '#FFFFFF',
    flex: 1,
  },
  aoDaiCardBody: {
    padding: 12,
  },
  aoDaiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  aoDaiCategoryText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
    flex: 1,
    marginRight: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingValueText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1B1C1C',
  },
  ratingCountText: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#5F5E5E',
  },
  aoDaiTitle: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    color: '#1B1C1C',
  },
  aoDaiFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.25)',
  },
  aoDaiPriceText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#BA0049',
  },
  aoDaiPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* SECTION 5: Concepts / Photo Spots */
  photoSpotCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.3)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  photoSpotImageWrap: {
    width: '100%',
    height: 144,
    position: 'relative',
    backgroundColor: '#EFEDED',
  },
  photoSpotImage: {
    width: '100%',
    height: '100%',
  },
  photoSpotGradientOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  photoSpotTimePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoSpotTimeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#1B1C1C',
  },
  photoSpotBottomCapt: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
  },
  photoSpotTitle: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    color: '#FFFFFF',
  },
  photoSpotSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  photoSpotFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  photoSpotMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 8,
  },
  photoSpotMatchText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5B3F43',
  },
  photoSpotLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  photoSpotLinkText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
  },

  /* SECTION 6: Featured Combos */
  discountSectionPill: {
    backgroundColor: '#FFD9DE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  discountSectionPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#BA0049',
  },
  comboCard: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.35)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  comboImageWrap: {
    width: '100%',
    height: 156,
    position: 'relative',
    backgroundColor: '#EFEDED',
  },
  comboImage: {
    width: '100%',
    height: '100%',
  },
  comboTopBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  comboBottomGlassPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27, 28, 28, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  comboBody: {
    padding: 14,
  },
  comboTitle: {
    fontFamily: FontFamily.display,
    fontSize: 15.5,
    color: '#1B1C1C',
  },
  comboDescription: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5F5E5E',
    marginTop: 4,
    lineHeight: 16,
  },
  comboFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.25)',
  },
  strikethroughPrice: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#5F5E5E',
    textDecorationLine: 'line-through',
  },
  comboPriceText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#BA0049',
  },
  bookComboBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bookComboBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },

  /* SECTION 7: Curated Photographers */
  proHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.45)',
  },
  proHostBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#5F5E5E',
  },
  photographerStack: {
    paddingHorizontal: 16,
    gap: 12,
  },
  photographerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(227, 190, 195, 0.32)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  photographerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  photographerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  photographerAvatarWrap: {
    position: 'relative',
  },
  photographerAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EFEDED',
    borderWidth: 2,
    borderColor: '#FFD9DE',
  },
  photographerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  photographerMetaCol: {
    flex: 1,
  },
  photographerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  photographerName: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    color: '#1B1C1C',
    flexShrink: 1,
  },
  photographerRoleBadge: {
    backgroundColor: '#FFD9DE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  photographerRoleBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#BA0049',
  },
  photographerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  photographerRatingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#1B1C1C',
  },
  photographerDotSep: {
    fontSize: 10,
    color: '#5F5E5E',
  },
  photographerMetaText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5F5E5E',
  },
  photographerSpecialtyText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#BA0049',
  },
  styleToneChip: {
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  styleToneChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#5B3F43',
  },
  photographerQuoteText: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
    fontStyle: 'italic',
    marginTop: 10,
  },
  portfolioGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  portfolioThumb: {
    flex: 1,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#EFEDED',
  },
  portfolioThumbSingle: {
    height: 140,
  },
  photographerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 190, 195, 0.25)',
  },
  photographerBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#BA0049',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  photographerBookBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
});
