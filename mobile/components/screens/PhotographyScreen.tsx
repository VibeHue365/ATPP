import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TagoMapView, type TagoMapMarker } from '@/components/map/TagoMapView';
import { TagoDirectionsModal } from '@/components/map/TagoDirectionsModal';
import { PhotographyCard } from '@/components/photographer/PhotographyCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { usePhotographers, usePhotographyFilters } from '@/hooks/usePhotographers';
import type { PhotographerFilters, PhotographerSort } from '@/types/photographer';
import {
  VIETNAM_CITIES,
  detectCityPreset,
  estimateDriveMinutes,
  fetchAutoUserPosition,
  fetchRoadRoute,
  formatDistance,
  haversineKm,
  openExternalDirections,
  resolveEntityCoords,
  type RoadRouteResult,
} from '@/utils/geo';

const sortOptions: Array<{ value: PhotographerSort; label: string }> = [
  { value: 'rating_desc', label: 'Đánh giá cao nhất' },
  { value: 'reviews_desc', label: 'Nhiều đánh giá nhất' },
  { value: 'price_asc', label: 'Giá thấp → cao' },
  { value: 'price_desc', label: 'Giá cao → thấp' },
];

const quickCities = [
  { label: 'Toàn quốc', value: '' },
  { label: 'Huế', value: 'Huế' },
  { label: 'Đà Nẵng', value: 'Đà Nẵng' },
  { label: 'Hội An', value: 'Hội An' },
  { label: 'Hà Nội', value: 'Hà Nội' },
  { label: 'TP.HCM', value: 'Hồ Chí Minh' },
  { label: 'Đà Lạt', value: 'Đà Lạt' },
];

export default function PhotographyScreen() {
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [concept, setConcept] = useState('');
  const [sort, setSort] = useState<PhotographerSort>('rating_desc');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 16.0685,
    lng: 108.2215,
  });
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string | null>(null);
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);
  const [directionDest, setDirectionDest] = useState<{
    lat: number;
    lng: number;
    title: string;
    address?: string;
  } | null>(null);

  const { concepts, categories } = usePhotographyFilters();

  useEffect(() => {
    let active = true;
    fetchAutoUserPosition().then((pos) => {
      if (active) {
        setUserCoords({ lat: pos.lat, lng: pos.lng });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (location) {
      const preset = detectCityPreset(location);
      setUserCoords({ lat: preset.lat, lng: preset.lng });
    }
  }, [location]);

  const filters = useMemo<PhotographerFilters>(
    () => ({
      q: search || undefined,
      location: location || undefined,
      packageCategoryId: categoryId || undefined,
      concept: concept || undefined,
      minRating,
      maxPrice,
      sort,
      page,
      limit: 8,
    }),
    [search, location, categoryId, concept, minRating, maxPrice, sort, page]
  );

  const { items, loading, error, total, totalPages, reload } = usePhotographers(filters);

  const enrichedItems = useMemo(() => {
    return items
      .map((item) => {
        const coords = resolveEntityCoords(item);
        const distanceKm = haversineKm(userCoords.lat, userCoords.lng, coords.lat, coords.lng);
        const driveMins = estimateDriveMinutes(distanceKm);
        return { item, coords, distanceKm, driveMins };
      })
      .sort((a, b) => (viewMode === 'MAP' ? a.distanceKm - b.distanceKm : 0));
  }, [items, userCoords, viewMode]);

  useEffect(() => {
    if (enrichedItems.length > 0 && !enrichedItems.some((e) => e.item._id === selectedPhotographerId)) {
      setSelectedPhotographerId(enrichedItems[0].item._id);
    }
  }, [enrichedItems, selectedPhotographerId]);

  const activeMapItem = useMemo(
    () => enrichedItems.find((e) => e.item._id === selectedPhotographerId) ?? enrichedItems[0] ?? null,
    [enrichedItems, selectedPhotographerId],
  );

  useEffect(() => {
    if (viewMode !== 'MAP' || !activeMapItem) {
      setRoadRoute(null);
      return;
    }
    let cancelled = false;
    fetchRoadRoute(userCoords, activeMapItem.coords).then((r) => {
      if (!cancelled) setRoadRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [viewMode, userCoords, activeMapItem?.item._id]);

  const mapMarkers = useMemo<TagoMapMarker[]>(
    () =>
      enrichedItems.map(({ item, coords, distanceKm }) => ({
        id: item._id,
        lat: coords.lat,
        lng: coords.lng,
        title: (item.businessName || item.fullName || 'Studio').slice(0, 16),
        badgeText: `★${(item.rating?.averageRating ?? 5).toFixed(1)} · ${formatDistance(distanceKm)}`,
      })),
    [enrichedItems],
  );

  const submit = () => {
    setPage(1);
    setSearch(draftSearch.trim());
  };

  const reset = () => {
    setSearch('');
    setDraftSearch('');
    setLocation('');
    setCategoryId('');
    setConcept('');
    setMinRating(undefined);
    setMaxPrice(undefined);
    setSort('rating_desc');
    setPage(1);
  };

  const hasFilters = Boolean(
    search ||
      location ||
      categoryId ||
      concept ||
      minRating ||
      maxPrice ||
      sort !== 'rating_desc'
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <BrandHeader />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroTagPill}>
              <Ionicons name="camera" size={13} color={Colors.primary} />
              <Text style={styles.heroTagText}>NHIẾP ẢNH GIA & STUDIO CỐ ĐÔ</Text>
            </View>
            <View style={styles.goldenHourBadge}>
              <MaterialIcons name="wb-twilight" size={12} color="#D97706" />
              <Text style={styles.goldenHourText}>Giờ vàng 15:30–17:30</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Đặt Lịch Chụp Cổ Phục</Text>
          <Text style={styles.heroSubtitle}>
            Kết nối trực tiếp với các nhiếp ảnh gia di sản tại Đại Nội, Lăng Tự Đức, Cung An Định
            kèm báo giá tự động và bảo chứng ảnh bàn giao.
          </Text>

          {/* Search & Filter Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={Colors.primary} />
              <TextInput
                value={draftSearch}
                onChangeText={setDraftSearch}
                onSubmitEditing={submit}
                returnKeyType="search"
                placeholder="Tìm studio, gói chụp, Đại Nội..."
                placeholderTextColor="#8F8E8E"
                style={styles.input}
              />
              {draftSearch.length > 0 && (
                <Pressable
                  onPress={() => {
                    setDraftSearch('');
                    if (search) {
                      setSearch('');
                      setPage(1);
                    }
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#8F8E8E" />
                </Pressable>
              )}
            </View>

            <Pressable
              style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
              onPress={() => setFilterOpen(true)}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={hasFilters ? '#FFFFFF' : Colors.primary}
              />
              <Text style={[styles.filterBtnText, hasFilters && { color: '#FFFFFF' }]}>
                Lọc
              </Text>
            </Pressable>
          </View>

          {/* Quick City Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityScroll}
          >
            {quickCities.map((c) => {
              const active = location === c.value;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => {
                    setLocation(c.value);
                    setPage(1);
                  }}
                  style={[styles.cityPill, active && styles.cityPillActive]}
                >
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={active ? Colors.primary : '#5F5E5E'}
                  />
                  <Text style={[styles.cityPillText, active && styles.cityPillTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Categories Scroll */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            <Chip
              label="Tất cả gói chụp"
              active={!categoryId}
              onPress={() => {
                setCategoryId('');
                setPage(1);
              }}
            />
            {categories.map((item) => (
              <Chip
                key={item.id}
                label={`${item.name}${item.packageCount ? ` (${item.packageCount})` : ''}`}
                active={categoryId === item.id}
                onPress={() => {
                  setCategoryId(categoryId === item.id ? '' : item.id);
                  setPage(1);
                }}
              />
            ))}
          </ScrollView>
        )}

        {/* Concepts Scroll */}
        {concepts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.conceptsScroll}
          >
            {concepts.slice(0, 10).map((item) => (
              <Chip
                key={item.code}
                label={`# ${item.label}`}
                active={concept === item.code}
                small
                onPress={() => {
                  setConcept(concept === item.code ? '' : item.code);
                  setPage(1);
                }}
              />
            ))}
          </ScrollView>
        )}

        {/* Combo Banner Shortcut */}
        <Pressable
          style={styles.comboPromoBanner}
          onPress={() => router.push('/combos' as Href)}
        >
          <View style={styles.comboPromoLeft}>
            <View style={styles.comboPromoIcon}>
              <MaterialIcons name="auto-awesome" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.comboPromoOverline}>TIẾT KIỆM ĐẾN 20%</Text>
              <Text style={styles.comboPromoTitle}>
                Ghép Combo Áo Dài + Thợ Ảnh Trọn Gói
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>

        {/* Results Header */}
        <View style={styles.resultHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{total} Gói Chụp & Nhiếp Ảnh Gia</Text>
            <Text style={styles.sectionSubtitle}>
              Lịch trống & khoảng cách được đồng bộ theo thời gian thực
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable
              style={[
                styles.resetPill,
                viewMode === 'MAP' && { backgroundColor: Colors.primary },
              ]}
              onPress={() => setViewMode((v) => (v === 'MAP' ? 'LIST' : 'MAP'))}
            >
              <Ionicons
                name={viewMode === 'MAP' ? 'list' : 'map'}
                size={13}
                color={viewMode === 'MAP' ? '#FFFFFF' : Colors.primary}
              />
              <Text
                style={[
                  styles.resetPillText,
                  viewMode === 'MAP' && { color: '#FFFFFF' },
                ]}
              >
                {viewMode === 'MAP' ? 'Xem Danh sách' : 'Bản đồ Gần Bạn'}
              </Text>
            </Pressable>
            {hasFilters && (
              <Pressable style={styles.resetPill} onPress={reset}>
                <Ionicons name="refresh" size={13} color={Colors.primary} />
                <Text style={styles.resetPillText}>Đặt lại</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Map Explorer Mode for Photographers */}
        {viewMode === 'MAP' && !loading && !error && enrichedItems.length > 0 && (
          <View style={{ gap: 10, marginBottom: 8 }}>
            <TagoMapView
              center={activeMapItem ? activeMapItem.coords : userCoords}
              zoom={13}
              height={280}
              userLocation={{ ...userCoords, label: 'Vị trí của bạn' }}
              markers={mapMarkers}
              selectedMarkerId={activeMapItem?.item._id ?? null}
              onSelectMarker={(id) => setSelectedPhotographerId(id)}
              routePoints={roadRoute?.points ?? null}
              radiusCircle={
                activeMapItem?.item.serviceRadiusKm
                  ? {
                      lat: activeMapItem.coords.lat,
                      lng: activeMapItem.coords.lng,
                      radiusKm: activeMapItem.item.serviceRadiusKm,
                    }
                  : null
              }
              onUserGpsDetected={(coord) => setUserCoords(coord)}
            />
            {activeMapItem && (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1.5,
                  borderColor: Colors.primary,
                  gap: 8,
                  ...Shadow,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FontFamily.displayBold, fontSize: 16, color: '#1B1C1C' }}>
                      {activeMapItem.item.businessName || activeMapItem.item.fullName}
                    </Text>
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.primary, marginTop: 2 }}>
                      Cách bạn {formatDistance(activeMapItem.distanceKm)} · ~{activeMapItem.driveMins} phút di chuyển
                      {activeMapItem.item.serviceRadiusKm
                        ? ` · Phục vụ bán kính ${activeMapItem.item.serviceRadiusKm}km`
                        : ''}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 999,
                      backgroundColor: '#FFF0F3',
                      borderWidth: 1,
                      borderColor: '#F3C4D5',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                    onPress={() => {
                      const addr = [
                        activeMapItem.item.address?.addressLine,
                        activeMapItem.item.address?.ward,
                        activeMapItem.item.address?.district,
                        activeMapItem.item.address?.city,
                      ]
                        .filter(Boolean)
                        .join(', ');
                      setDirectionDest({
                        lat: activeMapItem.coords.lat,
                        lng: activeMapItem.coords.lng,
                        title: activeMapItem.item.businessName || activeMapItem.item.fullName || 'Studio',
                        address: addr || 'Việt Nam',
                      });
                    }}
                  >
                    <Ionicons name="navigate-outline" size={14} color={Colors.primary} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.primary }}>
                      Chỉ đường tới Studio
                    </Text>
                  </Pressable>
                  <Pressable
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 999,
                      backgroundColor: Colors.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                    onPress={() => router.push(`/photographer/${activeMapItem.item._id}` as Href)}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: '#FFFFFF' }}>
                      Xem gói chụp
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {/* List */}
        {loading ? (
          <LoadingState label="Đang tải danh sách gói chụp..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Chưa tìm thấy gói chụp phù hợp"
            message="Hãy thử đổi khu vực, mức giá hoặc xóa bộ lọc để xem tất cả nhiếp ảnh gia."
          />
        ) : (
          <View style={styles.list}>
            {items.map((item) => {
              const dist = enrichedItems.find((e) => e.item._id === item._id)?.distanceKm;
              return (
                <PhotographyCard
                  key={item._id}
                  photographer={item}
                  distanceKm={dist}
                />
              );
            })}
          </View>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <View style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              onPress={() => setPage((value) => Math.max(1, value - 1))}
              style={[styles.pageBtn, page <= 1 && styles.disabled]}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            </Pressable>
            <View style={styles.pageIndicator}>
              <Text style={styles.pageText}>
                Trang {page} / {totalPages}
              </Text>
            </View>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
              style={[styles.pageBtn, page >= totalPages && styles.disabled]}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <AppModal
        visible={filterOpen}
        title="Bộ lọc Gói chụp & Studio"
        onClose={() => setFilterOpen(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <FilterTitle label="Sắp xếp theo" />
          <View style={styles.modalChips}>
            {sortOptions.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                active={sort === item.value}
                onPress={() => {
                  setSort(item.value);
                  setPage(1);
                }}
              />
            ))}
          </View>

          <FilterTitle label="Ngân sách tối đa" />
          <View style={styles.modalChips}>
            <Chip
              label="Tất cả mức giá"
              active={!maxPrice}
              onPress={() => setMaxPrice(undefined)}
            />
            <Chip
              label="Dưới 1.5 triệu"
              active={maxPrice === 1_500_000}
              onPress={() => setMaxPrice(1_500_000)}
            />
            <Chip
              label="Dưới 2.5 triệu"
              active={maxPrice === 2_500_000}
              onPress={() => setMaxPrice(2_500_000)}
            />
            <Chip
              label="Dưới 5 triệu"
              active={maxPrice === 5_000_000}
              onPress={() => setMaxPrice(5_000_000)}
            />
          </View>

          <FilterTitle label="Điểm đánh giá" />
          <View style={styles.modalChips}>
            <Chip
              label="Tất cả"
              active={!minRating}
              onPress={() => setMinRating(undefined)}
            />
            <Chip
              label="Từ 4.0 ★"
              active={minRating === 4}
              onPress={() => setMinRating(4)}
            />
            <Chip
              label="Từ 4.5 ★"
              active={minRating === 4.5}
              onPress={() => setMinRating(4.5)}
            />
          </View>

          <View style={styles.modalActions}>
            <AppButton title="Đặt lại mặc định" variant="secondary" onPress={reset} />
            <AppButton
              title={`Áp dụng (${total} kết quả)`}
              onPress={() => setFilterOpen(false)}
            />
          </View>
        </ScrollView>
      </AppModal>

      <TagoDirectionsModal
        visible={Boolean(directionDest)}
        onClose={() => setDirectionDest(null)}
        destination={directionDest}
        origin={{
          lat: userCoords.lat,
          lng: userCoords.lng,
          label: 'Vị trí của bạn',
        }}
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  small,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterTitle({ label }: { label: string }) {
  return <Text style={styles.filterTitle}>{label}</Text>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrap: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 38,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    gap: 10,
    ...Shadow,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  goldenHourBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  goldenHourText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#B45309',
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 25,
    lineHeight: 32,
    color: '#1B1C1C',
  },
  heroSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#5F5E5E',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  searchBox: {
    flex: 1,
    height: 46,
    backgroundColor: '#F5F3F3',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#1B1C1C',
  },
  filterBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  cityScroll: {
    gap: 8,
    paddingTop: 2,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F3F3',
  },
  cityPillActive: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cityPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  cityPillTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 12,
  },
  conceptsScroll: {
    gap: 7,
    paddingRight: 12,
    marginTop: -4,
  },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  chipSmall: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#F5F3F3',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  comboPromoBanner: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    ...Shadow,
  },
  comboPromoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  comboPromoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboPromoOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFD9DE',
    letterSpacing: 0.8,
  },
  comboPromoTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: '#1B1C1C',
  },
  sectionSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  resetPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  list: {
    gap: 14,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  pageText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  disabled: {
    opacity: 0.35,
  },
  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
    marginTop: 14,
    marginBottom: 8,
  },
  modalActions: {
    gap: 10,
    marginTop: 22,
    paddingBottom: 8,
  },
});
