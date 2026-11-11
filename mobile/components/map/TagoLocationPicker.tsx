import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { geocodingApi, type GeocodingPlaceResult } from '@/apis/geocodingApi';
import { TagoMapView } from '@/components/map/TagoMapView';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import {
  VIETNAM_CITIES,
  detectCityPreset,
  formatDistance,
  haversineKm,
  isValidLatLng,
} from '@/utils/geo';

export interface TagoLocationValue {
  address: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

export interface TagoLocationResolved {
  address: string;
  latitude: number;
  longitude: number;
  lat: number;
  lng: number;
}

interface TagoLocationPickerProps {
  value: TagoLocationValue;
  onChange: (next: TagoLocationResolved) => void;
  title?: string;
  label?: string;
  subtitle?: string;
  /** Optional provider base studio coordinates to check against serviceRadiusKm */
  providerBaseCoords?: { lat: number; lng: number } | null;
  providerCoords?: { lat: number; lng: number } | null;
  providerLabel?: string;
  serviceRadiusKm?: number | null;
  /** Highlight indoor spots (useful when changing location due to rain) */
  preferIndoorSpots?: boolean;
  mapHeight?: number;
}

export function TagoLocationPicker({
  value,
  onChange,
  title,
  label,
  subtitle = 'Tìm địa chỉ trên toàn quốc hoặc chạm/kéo ghim trực tiếp trên bản đồ.',
  providerBaseCoords,
  providerCoords,
  serviceRadiusKm,
  preferIndoorSpots = false,
  mapHeight = 230,
}: TagoLocationPickerProps) {
  const effectiveTitle = title || label || 'Ghim địa điểm trên bản đồ';
  const effectiveProviderCoords = providerBaseCoords || providerCoords || null;
  const valLat = Number(value.latitude ?? value.lat ?? 16.4698);
  const valLng = Number(value.longitude ?? value.lng ?? 107.5786);

  const emitChange = (next: { address: string; lat: number; lng: number }) => {
    onChange({
      address: next.address,
      latitude: next.lat,
      longitude: next.lng,
      lat: next.lat,
      lng: next.lng,
    });
  };
  const detectedCity = useMemo(
    () => detectCityPreset(value.address),
    [value.address],
  );
  const [selectedCityCode, setSelectedCityCode] = useState(detectedCity.code);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodingPlaceResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const activeCity = useMemo(
    () => VIETNAM_CITIES.find((c) => c.code === selectedCityCode) ?? VIETNAM_CITIES[0],
    [selectedCityCode],
  );

  const spots = useMemo(() => {
    const list = activeCity.spots;
    if (!preferIndoorSpots) return list;
    return [...list].sort((a, b) => (b.indoor ? 1 : 0) - (a.indoor ? 1 : 0));
  }, [activeCity, preferIndoorSpots]);

  const distanceFromProviderKm = useMemo(() => {
    if (
      !effectiveProviderCoords ||
      !isValidLatLng(effectiveProviderCoords.lat, effectiveProviderCoords.lng) ||
      !isValidLatLng(valLat, valLng)
    ) {
      return null;
    }
    return haversineKm(
      effectiveProviderCoords.lat,
      effectiveProviderCoords.lng,
      valLat,
      valLng,
    );
  }, [effectiveProviderCoords, valLat, valLng]);

  const isOutOfRadius = useMemo(() => {
    if (
      distanceFromProviderKm === null ||
      !serviceRadiusKm ||
      serviceRadiusKm <= 0
    ) {
      return false;
    }
    return distanceFromProviderKm > serviceRadiusKm;
  }, [distanceFromProviderKm, serviceRadiusKm]);

  const handleSearch = async () => {
    const q = searchQuery.trim() || value.address.trim();
    if (q.length < 2) {
      setSearchError('Vui lòng nhập ít nhất 2 ký tự tên đường, địa danh hoặc tỉnh thành');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const data = await geocodingApi.search(q);
      setResults(Array.isArray(data) ? data : []);
      if (!data?.length) {
        setSearchError('Không tìm thấy địa điểm khớp tên này. Hãy thử từ khóa khác hoặc chạm trực tiếp trên bản đồ.');
      }
    } catch {
      setSearchError('Không thể kết nối tìm kiếm địa chỉ lúc này. Bạn vẫn có thể chọn khu vực hoặc chạm trên bản đồ.');
    } finally {
      setSearching(false);
    }
  };

  // Live debounced autocomplete as user types in TagoLocationPicker
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const data = await geocodingApi.search(q);
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
          if (!data?.length) {
            setSearchError('Không tìm thấy địa điểm khớp tên này. Hãy thử từ khóa khác.');
          }
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setSearchError('Không thể kết nối tìm kiếm địa chỉ lúc này.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSelectSearchResult = (item: GeocodingPlaceResult) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!isValidLatLng(lat, lng)) return;
    setResults([]);
    setSearchQuery('');
    emitChange({
      address: item.display_name,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    });
  };

  const handleSwitchCity = (cityCode: string) => {
    setSelectedCityCode(cityCode);
    const city = VIETNAM_CITIES.find((c) => c.code === cityCode);
    if (city && city.spots[0]) {
      emitChange({
        address: city.spots[0].address,
        lat: city.spots[0].lat,
        lng: city.spots[0].lng,
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{effectiveTitle}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Nationwide City Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cityRow}>
        {VIETNAM_CITIES.map((city) => {
          const active = city.code === selectedCityCode;
          return (
            <Pressable
              key={city.code}
              style={[styles.cityChip, active && styles.cityChipActive]}
              onPress={() => handleSwitchCity(city.code)}>
              <Ionicons
                name="navigate-circle-outline"
                size={13}
                color={active ? '#FFFFFF' : Colors.primary}
              />
              <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>
                {city.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Preset Spots in Selected City */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.spotRow}>
        {spots.map((spot) => {
          const selected =
            value.address.toLowerCase().includes(spot.label.toLowerCase()) ||
            (Math.abs(valLat - spot.lat) < 0.0008 &&
              Math.abs(valLng - spot.lng) < 0.0008);
          return (
            <Pressable
              key={spot.id}
              style={[styles.spotChip, selected && styles.spotChipActive]}
              onPress={() =>
                emitChange({
                  address: spot.address,
                  lat: spot.lat,
                  lng: spot.lng,
                })
              }>
              <Text style={[styles.spotChipTitle, selected && styles.spotChipTitleActive]}>
                {spot.label}
              </Text>
              {spot.indoor ? (
                <View style={styles.indoorTag}>
                  <Text style={styles.indoorTagText}>Có mái che</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Nationwide Geocoding Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          value={searchQuery}
          onChangeText={(txt) => {
            setSearchQuery(txt);
            if (!txt.trim()) setResults([]);
          }}
          onSubmitEditing={() => void handleSearch()}
          placeholder="Tìm địa chỉ bất kỳ (VD: Hồ Gươm, Chùa Cầu, Cung An Định...)"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <Pressable
          style={styles.searchBtn}
          disabled={searching}
          onPress={() => void handleSearch()}>
          {searching ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.searchBtnText}>Tìm</Text>
          )}
        </Pressable>
      </View>

      {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

      {/* Autocomplete Results Dropdown */}
      {results.length > 0 ? (
        <View style={styles.resultsBox}>
          {results.map((item) => (
            <Pressable
              key={item.place_id}
              style={styles.resultItem}
              onPress={() => handleSelectSearchResult(item)}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <Text style={styles.resultText} numberOfLines={2}>
                {item.display_name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Interactive Leaflet Map with Draggable Pin + Service Radius Circle */}
      <TagoMapView
        center={{
          lat: isValidLatLng(valLat, valLng) ? valLat : activeCity.lat,
          lng: isValidLatLng(valLat, valLng) ? valLng : activeCity.lng,
        }}
        zoom={14}
        height={mapHeight}
        interactivePin={{
          lat: isValidLatLng(valLat, valLng) ? valLat : activeCity.lat,
          lng: isValidLatLng(valLat, valLng) ? valLng : activeCity.lng,
        }}
        radiusCircle={
          effectiveProviderCoords && serviceRadiusKm && serviceRadiusKm > 0
            ? {
                lat: effectiveProviderCoords.lat,
                lng: effectiveProviderCoords.lng,
                radiusKm: serviceRadiusKm,
              }
            : null
        }
        routePoints={
          effectiveProviderCoords &&
          isValidLatLng(effectiveProviderCoords.lat, effectiveProviderCoords.lng) &&
          isValidLatLng(valLat, valLng)
            ? [
                [effectiveProviderCoords.lat, effectiveProviderCoords.lng],
                [valLat, valLng],
              ]
            : null
        }
        onPinChange={(coord) => {
          emitChange({
            address:
              value.address.trim() ||
              `Điểm ghim tại ${activeCity.name} (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})`,
            lat: coord.lat,
            lng: coord.lng,
          });
        }}
        onUserGpsDetected={(coord) => {
          emitChange({
            address: value.address.trim() || 'Vị trí GPS hiện tại của bạn',
            lat: coord.lat,
            lng: coord.lng,
          });
        }}
      />

      {/* Selected Address Input & Distance / Radius Status Badge */}
      <View style={styles.addressBox}>
        <Text style={styles.addressLabel}>ĐỊA CHỈ ĐÃ GHIM</Text>
        <TextInput
          value={value.address}
          onChangeText={(txt) =>
            emitChange({
              address: txt,
              lat: valLat,
              lng: valLng,
            })
          }
          placeholder="Nhập tên địa điểm / số nhà chi tiết..."
          placeholderTextColor={Colors.textMuted}
          style={styles.addressInput}
          multiline
        />
        <View style={styles.coordFooter}>
          {distanceFromProviderKm !== null ? (
            <View
              style={[
                styles.radiusBadge,
                isOutOfRadius ? styles.radiusBadgeWarn : styles.radiusBadgeOk,
              ]}>
              <Ionicons
                name={isOutOfRadius ? 'warning-outline' : 'checkmark-circle'}
                size={13}
                color={isOutOfRadius ? '#B45309' : '#059669'}
              />
              <Text
                style={[
                  styles.radiusBadgeText,
                  { color: isOutOfRadius ? '#B45309' : '#059669' },
                ]}>
                Cách Studio {formatDistance(distanceFromProviderKm)}
                {serviceRadiusKm
                  ? isOutOfRadius
                    ? ` (Vượt bán kính ${serviceRadiusKm}km)`
                    : ` (Trong bán kính ${serviceRadiusKm}km)`
                  : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.radiusBadgeOk}>
              <Ionicons name="location-sharp" size={13} color="#059669" />
              <Text style={[styles.radiusBadgeText, { color: '#059669' }]}>
                Điểm hẹn chụp ảnh tại Cố đô
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    backgroundColor: '#FFFDFB',
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFE4E8',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  cityRow: {
    gap: 7,
    paddingVertical: 2,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#F5D0DC',
  },
  cityChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cityChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.primary,
  },
  cityChipTextActive: {
    color: '#FFFFFF',
  },
  spotRow: {
    gap: 7,
    paddingVertical: 2,
  },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  spotChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5F7',
  },
  spotChipTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.text,
  },
  spotChipTitleActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyBold,
  },
  indoorTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  indoorTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#059669',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingLeft: 11,
    paddingRight: 5,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.error,
  },
  resultsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3ECEE',
  },
  resultText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: Colors.text,
  },
  addressBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  addressLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  addressInput: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.text,
    minHeight: 34,
    paddingVertical: 2,
  },
  coordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  coordText: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  radiusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  radiusBadgeOk: {
    backgroundColor: '#ECFDF5',
  },
  radiusBadgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  radiusBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
  },
});
