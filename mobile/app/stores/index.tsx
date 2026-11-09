import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { geocodingApi, type GeocodingPlaceResult } from '@/apis/geocodingApi';
import { storeApi } from '@/apis/storeApi';
import { TagoMapView, type TagoMapMarker } from '@/components/map/TagoMapView';
import { TagoDirectionsModal, type DestinationInfo } from '@/components/map/TagoDirectionsModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import type { ProviderStore } from '@/types/store';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  CANONICAL_CITIES,
  VIETNAM_CITIES,
  detectNearestCanonicalCity,
  estimateDriveMinutes,
  fetchAutoUserPosition,
  fetchRoadRoute,
  formatDistance,
  getCanonicalCityByCode,
  haversineKm,
  isValidLatLng,
  matchStoreToCity,
  resolveEntityCoords,
  setCachedUserPosition,
  type AutoUserPosition,
  type RoadRouteResult,
} from '@/utils/geo';
import { reverseGeocodeLabel } from '@/services/userLocation';
import { getMediaUrl } from '@/utils/media';

type FilterType = 'ALL' | 'RENTAL' | 'PHOTO' | 'SALE' | 'TOP_RATED';
type ViewMode = 'LIST' | 'MAP';

const FILTERS: Array<{ id: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'ALL', label: 'Tất cả tiệm', icon: 'storefront-outline' },
  { id: 'RENTAL', label: 'Cổ phục & Áo dài', icon: 'shirt-outline' },
  { id: 'PHOTO', label: 'Studio & Nhiếp ảnh', icon: 'camera-outline' },
  { id: 'SALE', label: 'Đang ưu đãi', icon: 'flame-outline' },
  { id: 'TOP_RATED', label: 'Đánh giá 4.5★+', icon: 'star-outline' },
];

const RADIUS_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Mọi khoảng cách', value: null },
  { label: 'Dưới 3 km', value: 3 },
  { label: 'Dưới 10 km', value: 10 },
  { label: 'Dưới 25 km', value: 25 },
];

function formatStoreAddress(store: ProviderStore): string {
  const addr = store.address ?? store.rentalSettings?.pickupLocation;
  const parts = [addr?.addressLine, addr?.ward, addr?.district, addr?.city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Việt Nam';
}

export default function StoresDirectoryScreen() {
  const params = useLocalSearchParams<{ mode?: string; city?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>(
    params.mode === 'map' ? 'MAP' : 'MAP',
  );
  const [stores, setStores] = useState<ProviderStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const initialCityCode = useMemo(() => {
    if (!params.city) return 'ALL';
    const c = CANONICAL_CITIES.find(
      (x) => x.code === params.city || x.name.toLowerCase() === params.city?.toLowerCase(),
    );
    return c ? c.code : 'ALL';
  }, [params.city]);

  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedCityCode, setSelectedCityCode] = useState<string>(initialCityCode);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number | null>(null);

  // User position (Auto-detected via Device GPS / Network IP)
  const [userPos, setUserPos] = useState<AutoUserPosition>({
    lat: 16.0685,
    lng: 108.2215,
    label: 'Đang định vị...',
    cityCode: 'da-nang',
    source: 'default',
  });
  const [addressQuery, setAddressQuery] = useState('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<GeocodingPlaceResult[]>([]);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [directionDest, setDirectionDest] = useState<DestinationInfo | null>(null);

  // User's active city name hint (e.g. 'Đà Nẵng', 'Huế', 'Hà Nội'...)
  const currentCityName = useMemo(() => {
    if (selectedCityCode !== 'ALL') {
      const c = CANONICAL_CITIES.find((x) => x.code === selectedCityCode);
      if (c) return c.name;
    }
    const detected = detectNearestCanonicalCity(userPos.lat, userPos.lng);
    return detected.name || 'Đà Nẵng';
  }, [selectedCityCode, userPos.lat, userPos.lng]);

  // Live debounced autocomplete as user types address (Grab / Traveloka style)
  useEffect(() => {
    const q = addressQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setIsSearchingLocation(false);
      setLastSearchedQuery('');
      return;
    }
    let cancelled = false;
    setIsSearchingLocation(true);
    const timer = setTimeout(async () => {
      try {
        const list = await geocodingApi.smartSearch(q, currentCityName);
        if (!cancelled) {
          setPlaceResults(Array.isArray(list) ? list : []);
          setLastSearchedQuery(q);
        }
      } catch {
        if (!cancelled) {
          setPlaceResults([]);
          setLastSearchedQuery(q);
        }
      } finally {
        if (!cancelled) setIsSearchingLocation(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressQuery, currentCityName]);

  // Selected store on Grab/Traveloka Map + road route
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);

  // Auto-detect real location on mount: attempts GPS first (prompting permission if needed)
  useEffect(() => {
    let active = true;
    fetchAutoUserPosition({ requestPermission: true }).then((pos) => {
      if (active) {
        setUserPos(pos);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleUserGpsDetected = useCallback(
    async (coord: { lat: number; lng: number; accuracyM?: number }) => {
      const nearest = detectNearestCanonicalCity(coord.lat, coord.lng);
      const streetLabel = await reverseGeocodeLabel(coord.lat, coord.lng);
      const label = streetLabel || `${nearest.name} · GPS`;
      const pos: AutoUserPosition = {
        lat: coord.lat,
        lng: coord.lng,
        label,
        cityCode: nearest.code,
        source: 'gps',
        accuracyM: coord.accuracyM,
        isGps: true,
      };
      setUserPos(pos);
      setCachedUserPosition(pos);
    },
    [],
  );

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await storeApi.list();
      setStores(Array.isArray(list) ? list : []);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể tải danh bạ cửa hàng'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Canonical city chips with accurate store counts (no duplicates, no mismatched names)
  const cityChips = useMemo(() => {
    const counts = new Map<string, number>();
    CANONICAL_CITIES.forEach((c) => counts.set(c.code, 0));
    stores.forEach((st) => {
      for (const c of CANONICAL_CITIES) {
        if (matchStoreToCity(st, c.code)) {
          counts.set(c.code, (counts.get(c.code) || 0) + 1);
          break;
        }
      }
    });

    return [
      { code: 'ALL', name: 'Toàn quốc', count: stores.length },
      ...CANONICAL_CITIES.map((c) => ({
        code: c.code,
        name: c.name,
        count: counts.get(c.code) || 0,
      })),
    ];
  }, [stores]);

  // Enrich stores with coordinates & distance from userPos
  const enrichedStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores
      .map((store) => {
        const coords = resolveEntityCoords(store);
        const distanceKm = haversineKm(userPos.lat, userPos.lng, coords.lat, coords.lng);
        const driveMins = estimateDriveMinutes(distanceKm);
        return {
          store,
          coords,
          distanceKm,
          driveMins,
        };
      })
      .filter(({ store, distanceKm }) => {
        if (q) {
          const nameMatch = store.businessName?.toLowerCase().includes(q);
          const addrMatch = formatStoreAddress(store).toLowerCase().includes(q);
          if (!nameMatch && !addrMatch) return false;
        }
        if (selectedCityCode !== 'ALL') {
          if (!matchStoreToCity(store, selectedCityCode)) return false;
        }
        if (maxRadiusKm !== null && distanceKm > maxRadiusKm) {
          return false;
        }
        const caps = store.capabilities ?? [];
        if (activeFilter === 'RENTAL' && !caps.includes('AODAI_RENTAL') && caps.length > 0) {
          return false;
        }
        if (activeFilter === 'PHOTO' && !caps.includes('PHOTOGRAPHY')) {
          return false;
        }
        if (
          activeFilter === 'SALE' &&
          !store.activeCampaign &&
          !(store.comboDiscountPercent && store.comboDiscountPercent > 0)
        ) {
          return false;
        }
        if (activeFilter === 'TOP_RATED' && (store.rating?.averageRating ?? 5) < 4.5) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [stores, query, selectedCityCode, maxRadiusKm, activeFilter, userPos]);

  // Auto-select nearest store when list updates
  useEffect(() => {
    if (enrichedStores.length > 0) {
      const stillExists = enrichedStores.some((x) => x.store._id === selectedStoreId);
      if (!stillExists) {
        setSelectedStoreId(enrichedStores[0].store._id);
      }
    } else {
      setSelectedStoreId(null);
      setRoadRoute(null);
    }
  }, [enrichedStores, selectedStoreId]);

  const activeStoreEntry = useMemo(
    () =>
      enrichedStores.find((x) => x.store._id === selectedStoreId) ??
      enrichedStores[0] ??
      null,
    [enrichedStores, selectedStoreId],
  );

  // Map camera center: smoothly pans to active store or canonical city center
  const mapCenter = useMemo(() => {
    if (activeStoreEntry) {
      return activeStoreEntry.coords;
    }
    if (selectedCityCode !== 'ALL') {
      const city = getCanonicalCityByCode(selectedCityCode);
      if (city) return { lat: city.lat, lng: city.lng };
    }
    return { lat: userPos.lat, lng: userPos.lng };
  }, [activeStoreEntry, selectedCityCode, userPos]);

  // Fetch OSRM road route from userPos -> activeStoreEntry
  useEffect(() => {
    if (!activeStoreEntry) {
      setRoadRoute(null);
      return;
    }
    let cancelled = false;
    fetchRoadRoute(
      { lat: userPos.lat, lng: userPos.lng },
      activeStoreEntry.coords,
    ).then((res) => {
      if (!cancelled) setRoadRoute(res);
    });
    return () => {
      cancelled = true;
    };
  }, [userPos.lat, userPos.lng, activeStoreEntry?.store._id]);

  const mapMarkers = useMemo<TagoMapMarker[]>(
    () =>
      enrichedStores.map(({ store, coords, distanceKm }) => {
        const rating = store.rating?.averageRating
          ? store.rating.averageRating.toFixed(1)
          : '5.0';
        const shortName =
          store.businessName.length > 18
            ? store.businessName.slice(0, 16) + '…'
            : store.businessName;
        return {
          id: store._id,
          lat: coords.lat,
          lng: coords.lng,
          title: shortName,
          badgeText: `★${rating} · ${formatDistance(distanceKm)}`,
        };
      }),
    [enrichedStores],
  );

  const handleSelectCity = (code: string) => {
    setSelectedCityCode(code);
  };

  const handleSearchUserLocation = async () => {
    const q = addressQuery.trim();
    if (q.length < 2) return;
    setIsSearchingLocation(true);
    try {
      const list = await geocodingApi.smartSearch(q, currentCityName);
      if (Array.isArray(list) && list.length > 0) {
        const place = list[0];
        const lat = Number(place.lat);
        const lng = Number(place.lon);
        if (isValidLatLng(lat, lng)) {
          const parts = place.display_name.split(',').map((p) => p.trim());
          const mainTitle = parts.slice(0, 2).join(', ');
          const pos: AutoUserPosition = {
            lat,
            lng,
            label: mainTitle,
            cityCode: detectNearestCanonicalCity(lat, lng).code,
            source: 'manual',
          };
          setUserPos(pos);
          setCachedUserPosition(pos);
          setPlaceResults([]);
          setShowLocationSearch(false);
          setAddressQuery('');
          setLastSearchedQuery('');
          return;
        }
      }
      setPlaceResults(Array.isArray(list) ? list : []);
      setLastSearchedQuery(q);
    } catch {
      setPlaceResults([]);
      setLastSearchedQuery(q);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Top Header with List / Map Grab-Traveloka Switch */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#1E1418" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TÀGO NEARBY & NATIONWIDE</Text>
          <Text style={s.title} numberOfLines={1}>
            Tiệm Áo Dài & Studio Gần Bạn
          </Text>
        </View>
        <View style={s.modeToggle}>
          <Pressable
            style={[s.modeBtn, viewMode === 'MAP' && s.modeBtnActive]}
            onPress={() => setViewMode('MAP')}>
            <Ionicons
              name="map"
              size={14}
              color={viewMode === 'MAP' ? '#FFFFFF' : '#BA0049'}
            />
            <Text style={[s.modeBtnText, viewMode === 'MAP' && s.modeBtnTextActive]}>
              Bản đồ
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, viewMode === 'LIST' && s.modeBtnActive]}
            onPress={() => setViewMode('LIST')}>
            <Ionicons
              name="list"
              size={14}
              color={viewMode === 'LIST' ? '#FFFFFF' : '#BA0049'}
            />
            <Text style={[s.modeBtnText, viewMode === 'LIST' && s.modeBtnTextActive]}>
              Danh sách
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Search & Nationwide Location Controls */}
      <View style={s.searchSection}>
        {/* Current User Location Bar (Grab / Traveloka style) */}
        <View style={s.locationBarRow}>
          <Pressable
            style={s.userPosPill}
            onPress={() => setShowLocationSearch((v) => !v)}>
            <View style={s.blueDot} />
            <Text style={s.userPosText} numberOfLines={1}>
              Điểm đứng: <Text style={{ fontFamily: FontFamily.bodyBold }}>{userPos.label}</Text>
            </Text>
            <Ionicons name="chevron-down" size={14} color={Colors.primary} />
          </Pressable>

          <Pressable
            style={s.locateMeBtn}
            onPress={async () => {
              const pos = await fetchAutoUserPosition({ requestPermission: true, forceRefresh: true });
              setUserPos(pos);
              setSelectedCityCode('ALL');
            }}>
            <Ionicons name="locate" size={13} color="#BA0049" />
            <Text style={s.locateMeBtnText}>Gần tôi</Text>
          </Pressable>

          {/* Radius Filter Pill */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}>
            {RADIUS_OPTIONS.map((opt) => {
              const active = maxRadiusKm === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  style={[s.radiusPill, active && s.radiusPillActive]}
                  onPress={() => setMaxRadiusKm(opt.value)}>
                  <Text style={[s.radiusPillText, active && s.radiusPillTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {userPos.source === 'ip' ? (
          <View style={s.ipHintBanner}>
            <Ionicons name="information-circle" size={14} color="#B45309" />
            <Text style={s.ipHintText} numberOfLines={1}>
              Vị trí ước lượng theo mạng. Bật GPS để chính xác tới số nhà.
            </Text>
            <Pressable
              style={s.ipHintBtn}
              onPress={async () => {
                const pos = await fetchAutoUserPosition({ requestPermission: true, forceRefresh: true });
                setUserPos(pos);
              }}>
              <Text style={s.ipHintBtnText}>Bật GPS</Text>
            </Pressable>
          </View>
        ) : null}

        {showLocationSearch ? (
          <View style={s.customLocationDrawer}>
            <View style={s.customLocInputRow}>
              <Ionicons name="locate-outline" size={16} color={Colors.primary} />
              <TextInput
                value={addressQuery}
                onChangeText={setAddressQuery}
                onSubmitEditing={() => void handleSearchUserLocation()}
                placeholder="Nhập khách sạn / vị trí bạn đang đứng trên toàn quốc..."
                placeholderTextColor="#9A8890"
                style={s.customLocInput}
                returnKeyType="search"
                autoFocus
              />
              {isSearchingLocation ? (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={{ marginRight: 6 }}
                />
              ) : addressQuery.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setAddressQuery('');
                    setLastSearchedQuery('');
                    setPlaceResults([]);
                  }}
                  style={{ padding: 4, marginRight: 4 }}>
                  <Ionicons name="close-circle" size={16} color="#8F8E8E" />
                </Pressable>
              ) : null}
              <Pressable
                style={s.customLocBtn}
                onPress={() => void handleSearchUserLocation()}>
                <Text style={s.customLocBtnText}>Đặt vị trí</Text>
              </Pressable>
            </View>

            {isSearchingLocation ? (
              <View style={s.searchingHintRow}>
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={s.searchingHintText}>Đang tra cứu gợi ý địa chỉ...</Text>
              </View>
            ) : null}

            {!isSearchingLocation &&
            addressQuery.trim().length >= 2 &&
            lastSearchedQuery === addressQuery.trim() &&
            placeResults.length === 0 ? (
              <View style={s.searchingHintRow}>
                <Text style={s.searchingHintText}>
                  Không tìm thấy gợi ý phù hợp. Hãy thử thêm tên thành phố (Đà Nẵng, Huế, TP.HCM...)
                </Text>
              </View>
            ) : null}

            {placeResults.map((place) => {
              const parts = place.display_name.split(',').map((p) => p.trim());
              const mainTitle = parts.slice(0, 2).join(', ');
              const subTitle = parts.slice(2).join(', ');
              return (
                <Pressable
                  key={place.place_id}
                  style={s.placeItem}
                  onPress={() => {
                    const lat = Number(place.lat);
                    const lng = Number(place.lon);
                    if (isValidLatLng(lat, lng)) {
                      const pos: AutoUserPosition = {
                        lat,
                        lng,
                        label: mainTitle,
                        cityCode: detectNearestCanonicalCity(lat, lng).code,
                        source: 'manual',
                      };
                      setUserPos(pos);
                      setCachedUserPosition(pos);
                      setPlaceResults([]);
                      setShowLocationSearch(false);
                      setAddressQuery('');
                      setLastSearchedQuery('');
                    }
                  }}>
                  <View style={s.placeIconWrap}>
                    <Ionicons name="location" size={14} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.placeItemTitle} numberOfLines={1}>
                      {mainTitle}
                    </Text>
                    {subTitle ? (
                      <Text style={s.placeItemSub} numberOfLines={1}>
                        {subTitle}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#C4B0B9" />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Nationwide City Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}>
          {cityChips.map((chip) => {
            const active = selectedCityCode === chip.code;
            return (
              <Pressable
                key={chip.code}
                style={[s.cityPill, active && s.cityPillActive]}
                onPress={() => handleSelectCity(chip.code)}>
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={active ? '#FFFFFF' : Colors.primary}
                />
                <Text style={[s.cityPillText, active && s.cityPillTextActive]}>
                  {chip.name}{chip.count > 0 ? ` (${chip.count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color="#8C7A82" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm tên tiệm áo dài, studio hoặc tên đường, tỉnh thành..."
            placeholderTextColor="#9A8890"
            style={s.searchInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#8C7A82" />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}>
          {FILTERS.map((item) => {
            const active = activeFilter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setActiveFilter(item.id)}
                style={[s.filterChip, active && s.filterChipActive]}>
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={active ? '#FFFFFF' : '#5C474F'}
                />
                <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState label="Đang định vị và quét các tiệm cổ phục gần bạn..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : viewMode === 'MAP' ? (
        /* GRAB / TRAVELOKA INTERACTIVE MAP EXPLORER */
        <View style={s.mapScreenWrap}>
          <TagoMapView
            center={mapCenter}
            zoom={selectedCityCode === 'ALL' && !activeStoreEntry ? 12 : 14}
            height={360}
            userLocation={userPos}
            markers={mapMarkers}
            selectedMarkerId={activeStoreEntry?.store._id ?? null}
            onSelectMarker={(id) => setSelectedStoreId(id)}
            radiusCircle={
              maxRadiusKm
                ? { lat: userPos.lat, lng: userPos.lng, radiusKm: maxRadiusKm }
                : null
            }
            routePoints={roadRoute?.points ?? null}
            onUserGpsDetected={handleUserGpsDetected}
          />

          {/* Selected Store Highlight & Horizontal Nearest Stores Carousel */}
          <View style={s.bottomSheet}>
            <View style={s.sheetHeaderRow}>
              <Text style={s.sheetHeaderTitle}>
                Tìm thấy {enrichedStores.length} tiệm · Sắp xếp gần bạn nhất
              </Text>
              {roadRoute ? (
                <View style={s.routeMetricPill}>
                  <Ionicons name="navigate" size={12} color="#FFFFFF" />
                  <Text style={s.routeMetricText}>
                    {formatDistance(roadRoute.distanceKm)} · ~{roadRoute.durationMinutes} phút
                  </Text>
                </View>
              ) : null}
            </View>

            {enrichedStores.length === 0 ? (
              <View style={s.emptyMapBox}>
                <Text style={s.emptyMapTitle}>
                  Chưa có tiệm nào trong phạm vi lọc hiện tại
                </Text>
                <Pressable
                  style={s.resetMapBtn}
                  onPress={() => {
                    setSelectedCityCode('ALL');
                    setMaxRadiusKm(null);
                    setActiveFilter('ALL');
                    setQuery('');
                  }}>
                  <Text style={s.resetMapBtnText}>Xem toàn bộ các tiệm trên toàn quốc</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.carouselRow}>
                {enrichedStores.map(({ store, coords, distanceKm, driveMins }, index) => {
                  const isSelected = store._id === activeStoreEntry?.store._id;
                  const rawThumb =
                    store.media?.coverUrl ||
                    store.media?.images?.[0] ||
                    store.media?.logoUrl;
                  const thumb = rawThumb ? getMediaUrl(rawThumb) : null;
                  const rating = store.rating?.averageRating
                    ? store.rating.averageRating.toFixed(1)
                    : '5.0';

                  return (
                    <Pressable
                      key={store._id}
                      style={[s.mapStoreCard, isSelected && s.mapStoreCardActive]}
                      onPress={() => setSelectedStoreId(store._id)}>
                      <View style={s.mapCardTop}>
                        <View style={s.mapThumbWrap}>
                          <View style={s.mapThumbFallback}>
                            <Ionicons name="storefront" size={22} color="#BA0049" />
                          </View>
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={[s.mapThumb, StyleSheet.absoluteFill]}
                              contentFit="cover"
                            />
                          ) : null}
                          {index === 0 ? (
                            <View style={s.nearestTag}>
                              <Text style={s.nearestTagText}>GẦN NHẤT</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={s.mapStoreName} numberOfLines={1}>
                            {store.businessName}
                          </Text>
                          <View style={s.mapDistanceRow}>
                            <Ionicons name="navigate-circle" size={14} color="#BA0049" />
                            <Text style={s.mapDistanceText}>
                              Cách bạn {formatDistance(distanceKm)} · ~{driveMins} phút
                            </Text>
                          </View>
                          <Text style={s.mapAddressText} numberOfLines={1}>
                            {formatStoreAddress(store)}
                          </Text>
                          <Text style={s.mapRatingText}>
                            ★ {rating} · {store.productCount ?? 0} mẫu cổ phục
                          </Text>
                        </View>
                      </View>

                      <View style={s.mapCardActions}>
                        <Pressable
                          style={s.directionBtn}
                          onPress={() => {
                            setSelectedStoreId(store._id);
                            setDirectionDest({
                              lat: coords.lat,
                              lng: coords.lng,
                              title: store.businessName || 'Tiệm Cổ Phục',
                              address: formatStoreAddress(store),
                            });
                          }}>
                          <Ionicons name="navigate-outline" size={14} color="#BA0049" />
                          <Text style={s.directionBtnText}>Chỉ đường</Text>
                        </Pressable>

                        <Pressable
                          style={s.enterStoreBtn}
                          onPress={() => router.push(`/store/${store._id}` as Href)}>
                          <Text style={s.enterStoreBtnText}>Vào gian hàng</Text>
                          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={enrichedStores}
          keyExtractor={(item) => item.store._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor="#BA0049"
            />
          }
          contentContainerStyle={s.list}
          renderItem={({ item: { store: item, coords, distanceKm, driveMins }, index }) => {
            const rawCover =
              item.media?.coverUrl || item.media?.images?.[0] || item.media?.logoUrl;
            const rawLogo = item.media?.logoUrl || item.media?.images?.[0];
            const cover = rawCover ? getMediaUrl(rawCover) : null;
            const logo = rawLogo ? getMediaUrl(rawLogo) : null;
            const rating = item.rating?.averageRating
              ? item.rating.averageRating.toFixed(1)
              : '5.0';
            const reviews = item.rating?.reviewCount ?? item.rating?.totalReviews ?? 0;
            const address = formatStoreAddress(item);
            const caps = item.capabilities ?? ['AODAI_RENTAL'];

            return (
              <Pressable
                style={s.card}
                onPress={() => router.push(`/store/${item._id}` as Href)}>
                <View style={s.coverWrap}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={s.coverImg} contentFit="cover" />
                  ) : (
                    <View style={s.coverFallback}>
                      <Ionicons name="sparkles-outline" size={32} color="#BA0049" />
                    </View>
                  )}
                  <View style={s.coverOverlay} />

                  <View style={s.topBadgeRow}>
                    <View style={s.verifiedBadge}>
                      <Ionicons name="navigate" size={12} color="#BA0049" />
                      <Text style={s.verifiedBadgeText}>
                        {index === 0 ? 'Gần bạn nhất · ' : ''}
                        {formatDistance(distanceKm)} (~{driveMins}p)
                      </Text>
                    </View>
                    {item.activeCampaign ? (
                      <View style={s.saleBadge}>
                        <Ionicons name="flame" size={12} color="#FFFFFF" />
                        <Text style={s.saleBadgeText}>
                          {item.activeCampaign.occasion} -{item.activeCampaign.discountPercent}%
                        </Text>
                      </View>
                    ) : item.comboDiscountPercent ? (
                      <View style={s.saleBadge}>
                        <Ionicons name="pricetag" size={11} color="#FFFFFF" />
                        <Text style={s.saleBadgeText}>Combo -{item.comboDiscountPercent}%</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={s.cardBody}>
                  <View style={s.identityRow}>
                    <View style={s.logoBox}>
                      {logo ? (
                        <Image source={{ uri: logo }} style={s.logoImg} contentFit="cover" />
                      ) : (
                        <Text style={s.logoLetter}>
                          {(item.businessName || 'T').slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.storeName} numberOfLines={1}>
                        {item.businessName}
                      </Text>
                      <View style={s.metaRow}>
                        <Ionicons name="star" size={13} color="#D97706" />
                        <Text style={s.ratingText}>{rating}</Text>
                        <Text style={s.dot}>·</Text>
                        <Text style={s.metaText}>{reviews} đánh giá</Text>
                        {item.productCount != null && (
                          <>
                            <Text style={s.dot}>·</Text>
                            <Text style={s.metaText}>{item.productCount} thiết kế</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={s.addressRow}>
                    <Ionicons name="location-outline" size={15} color="#BA0049" />
                    <Text style={s.addressText} numberOfLines={1}>
                      {address}
                    </Text>
                  </View>

                  <View style={s.footerRow}>
                    <View style={s.capGroup}>
                      {caps.includes('AODAI_RENTAL') && (
                        <View style={s.capPill}>
                          <Text style={s.capPillText}>Cổ phục & Áo dài</Text>
                        </View>
                      )}
                      {caps.includes('PHOTOGRAPHY') && (
                        <View style={[s.capPill, s.capPillPhoto]}>
                          <Text style={[s.capPillText, s.capPillPhotoText]}>
                            Nhiếp ảnh Di sản
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        style={s.directionSmallBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          setDirectionDest({
                            lat: coords.lat,
                            lng: coords.lng,
                            title: item.businessName || 'Tiệm Cổ Phục',
                            address,
                          });
                        }}>
                        <Ionicons name="navigate-outline" size={14} color="#BA0049" />
                        <Text style={s.directionSmallText}>Chỉ đường</Text>
                      </Pressable>
                      <View style={s.visitBtn}>
                        <Text style={s.visitBtnText}>Ghé tiệm</Text>
                        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="Không tìm thấy cửa hàng phù hợp"
              message="Hãy thử đổi tỉnh/thành phố, mở rộng bán kính hoặc xóa từ khóa tìm kiếm."
            />
          }
        />
      )}

      <TagoDirectionsModal
        visible={Boolean(directionDest)}
        onClose={() => setDirectionDest(null)}
        destination={directionDest}
        origin={{
          lat: userPos.lat,
          lng: userPos.lng,
          label: userPos.label || 'Vị trí của bạn',
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6EA',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#1E1418',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFF0F5',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeBtnActive: {
    backgroundColor: '#BA0049',
  },
  modeBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6EA',
    gap: 8,
  },
  locationBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  userPosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    maxWidth: 210,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  userPosText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#1E3A8A',
  },
  locateMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  locateMeBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
  },
  ipHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ipHintText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#92400E',
  },
  ipHintBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
  },
  ipHintBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  radiusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#EFE6EA',
  },
  radiusPillActive: {
    backgroundColor: '#FFF0F5',
    borderColor: '#BA0049',
  },
  radiusPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#5C474F',
  },
  radiusPillTextActive: {
    color: '#BA0049',
    fontFamily: FontFamily.bodyBold,
  },
  customLocationDrawer: {
    marginHorizontal: 14,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#EFE6EA',
    gap: 6,
  },
  customLocInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customLocInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#1E1418',
  },
  customLocBtn: {
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  customLocBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  searchingHintRow: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchingHintText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
    fontStyle: 'italic',
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#EFE6EA',
  },
  placeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeItemTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1E1418',
  },
  placeItemSub: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#7A6870',
    marginTop: 1,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF5F8',
    borderWidth: 1,
    borderColor: '#F3D2DF',
  },
  cityPillActive: {
    backgroundColor: '#1E1418',
    borderColor: '#1E1418',
  },
  cityPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#BA0049',
  },
  cityPillTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    marginHorizontal: 14,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#ECE0E5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#1E1418',
  },
  filterRow: {
    paddingHorizontal: 14,
    gap: 7,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#ECE0E5',
  },
  filterChipActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  filterChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5C474F',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  mapScreenWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  bottomSheet: {
    flex: 1,
    gap: 8,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sheetHeaderTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1E1418',
  },
  routeMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  routeMetricText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  carouselRow: {
    gap: 12,
    paddingBottom: 12,
  },
  mapStoreCard: {
    width: 295,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EFE6EA',
    gap: 10,
    ...Shadow,
  },
  mapStoreCardActive: {
    borderColor: '#BA0049',
    backgroundColor: '#FFFDFD',
  },
  mapCardTop: {
    flexDirection: 'row',
    gap: 10,
  },
  mapThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFF0F5',
    position: 'relative',
  },
  mapThumb: {
    width: '100%',
    height: '100%',
  },
  mapThumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearestTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#BA0049',
    paddingVertical: 2,
    alignItems: 'center',
  },
  nearestTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  mapStoreName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1E1418',
  },
  mapDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapDistanceText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#BA0049',
  },
  mapAddressText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6E5A62',
  },
  mapRatingText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#D97706',
  },
  mapCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  directionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  directionBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#BA0049',
  },
  enterStoreBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#BA0049',
  },
  enterStoreBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  emptyMapBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EFE6EA',
  },
  emptyMapTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#5C474F',
  },
  resetMapBtn: {
    backgroundColor: '#BA0049',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resetMapBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  list: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFE6EA',
    ...Shadow,
  },
  coverWrap: {
    height: 142,
    backgroundColor: '#F5EBF0',
    position: 'relative',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF2F6',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 10, 14, 0.16)',
  },
  topBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  verifiedBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
  },
  saleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#BA0049',
  },
  saleBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    borderWidth: 1.5,
    borderColor: '#F3C4D5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoLetter: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#BA0049',
  },
  storeName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: '#1E1418',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  ratingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#B45309',
  },
  dot: {
    color: '#BBAAB1',
    fontSize: 12,
  },
  metaText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#7A6870',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF6F8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addressText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#4F3E45',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  capGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  capPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: '#FFF0F5',
  },
  capPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#BA0049',
  },
  capPillPhoto: {
    backgroundColor: '#F3F0FF',
  },
  capPillPhotoText: {
    color: '#6D28D9',
  },
  directionSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  directionSmallText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#BA0049',
  },
  visitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#BA0049',
  },
  visitBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
