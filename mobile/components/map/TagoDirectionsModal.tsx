import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TagoMapView, type TagoMapMarker } from '@/components/map/TagoMapView';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import {
  fetchRoadRoute,
  formatDistance,
  isValidLatLng,
  openExternalDirections,
  resolveEntityCoords,
  type RoadRouteResult,
} from '@/utils/geo';
import { reverseGeocodeLabel } from '@/services/userLocation';

export interface DestinationInfo {
  lat: number;
  lng: number;
  title: string;
  address?: string;
}

export interface OriginInfo {
  lat: number;
  lng: number;
  label?: string;
}

interface TagoDirectionsModalProps {
  visible: boolean;
  onClose: () => void;
  destination: DestinationInfo | null;
  origin?: OriginInfo | null;
}

export function TagoDirectionsModal({
  visible,
  onClose,
  destination,
  origin,
}: TagoDirectionsModalProps) {
  const [route, setRoute] = useState<RoadRouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [activeOrigin, setActiveOrigin] = useState<OriginInfo | null>(origin || null);

  useEffect(() => {
    if (origin && isValidLatLng(origin.lat, origin.lng)) {
      setActiveOrigin(origin);
    }
  }, [origin?.lat, origin?.lng, origin?.label]);

  const resolvedDestCoords = useMemo(() => {
    if (destination && isValidLatLng(destination.lat, destination.lng)) {
      return { lat: destination.lat, lng: destination.lng };
    }
    if (destination?.address) {
      return resolveEntityCoords({
        address: destination.address,
        businessName: destination.title,
      });
    }
    return null;
  }, [destination?.lat, destination?.lng, destination?.address, destination?.title]);

  const destValid = Boolean(
    resolvedDestCoords && isValidLatLng(resolvedDestCoords.lat, resolvedDestCoords.lng),
  );
  const originValid = Boolean(
    activeOrigin && isValidLatLng(activeOrigin.lat, activeOrigin.lng),
  );

  useEffect(() => {
    if (!visible || !destValid || !originValid || !activeOrigin || !resolvedDestCoords) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoadingRoute(true);

    fetchRoadRoute(
      { lat: activeOrigin.lat, lng: activeOrigin.lng },
      { lat: resolvedDestCoords.lat, lng: resolvedDestCoords.lng },
    )
      .then((res) => {
        if (!cancelled) setRoute(res);
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoute(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    visible,
    destValid,
    originValid,
    activeOrigin?.lat,
    activeOrigin?.lng,
    resolvedDestCoords?.lat,
    resolvedDestCoords?.lng,
  ]);

  const markers = useMemo<TagoMapMarker[]>(() => {
    if (!destination || !resolvedDestCoords || !destValid) return [];
    const list: TagoMapMarker[] = [];

    if (activeOrigin && originValid) {
      list.push({
        id: 'origin-user',
        lat: activeOrigin.lat,
        lng: activeOrigin.lng,
        title: 'Vị trí của bạn',
        subtitle: activeOrigin.label || 'Điểm xuất phát',
        badgeText: '📍 Điểm đứng',
        color: '#1A73E8',
        tone: 'primary',
      });
    }

    list.push({
      id: 'dest-store',
      lat: resolvedDestCoords.lat,
      lng: resolvedDestCoords.lng,
      title: destination.title,
      subtitle: destination.address || 'Điểm đến',
      badgeText: '🎯 Điểm đến',
      color: Colors.primary,
      tone: 'emerald',
      isSelected: true,
    });

    return list;
  }, [destination, resolvedDestCoords, destValid, activeOrigin, originValid]);

  const mapCenter = useMemo(() => {
    if (resolvedDestCoords && destValid) {
      if (activeOrigin && originValid) {
        return {
          lat: (resolvedDestCoords.lat + activeOrigin.lat) / 2,
          lng: (resolvedDestCoords.lng + activeOrigin.lng) / 2,
        };
      }
      return { lat: resolvedDestCoords.lat, lng: resolvedDestCoords.lng };
    }
    return { lat: 16.0685, lng: 108.2215 };
  }, [resolvedDestCoords, destValid, activeOrigin, originValid]);

  // Clean and deduplicate repetitive address parts (e.g. repeated Đà Nẵng)
  const formattedAddress = useMemo(() => {
    if (!destination?.address) return 'Việt Nam';
    const parts = destination.address
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const uniqueParts: string[] = [];
    for (const part of parts) {
      if (!uniqueParts.some((p) => p.toLowerCase() === part.toLowerCase())) {
        uniqueParts.push(part);
      }
    }
    return uniqueParts.join(', ');
  }, [destination?.address]);

  if (!destination) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#1E1418" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>TÀGO IN-APP DIRECTIONS</Text>
            <Text style={styles.title} numberOfLines={1}>
              Chỉ đường tới {destination.title}
            </Text>
          </View>
        </View>

        {/* Map Container - Full height filling entire middle area with 0 gaps */}
        <View style={styles.mapContainer}>
          <TagoMapView
            center={mapCenter}
            zoom={14}
            height="100%"
            style={styles.mapView}
            userLocation={originValid && activeOrigin ? activeOrigin : null}
            markers={markers}
            selectedMarkerId="dest-store"
            routePoints={route?.points || null}
            fitRouteBounds={Boolean(route?.points && route.points.length > 0)}
            onUserGpsDetected={async (coord) => {
              const streetLabel = await reverseGeocodeLabel(coord.lat, coord.lng);
              setActiveOrigin({
                lat: coord.lat,
                lng: coord.lng,
                label: streetLabel || 'Vị trí GPS của bạn',
              });
            }}
          />

          {loadingRoute ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Đang tính toán lộ trình tối ưu...</Text>
            </View>
          ) : null}
        </View>

        {/* Route Info & Actions Bottom Sheet */}
        <View style={styles.sheetContent}>
          {/* Status Badge */}
          <View style={styles.statusBadgeRow}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={styles.statusBadgeText} numberOfLines={1}>
              Lộ trình tối ưu · Cập nhật theo thời gian thực
            </Text>
          </View>

          {/* Metrics Pill Row - 2 generous cards with zero font overflow */}
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="navigate" size={16} color={Colors.primary} />
              </View>
              <View style={styles.metricTextWrap}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  Khoảng cách
                </Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {route?.distanceKm != null
                    ? formatDistance(route.distanceKm)
                    : 'Đang đo'}
                </Text>
              </View>
            </View>

            <View style={styles.metricCard}>
              <View style={[styles.metricIconWrap, styles.metricIconTime]}>
                <Ionicons name="time" size={16} color="#0D9488" />
              </View>
              <View style={styles.metricTextWrap}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  Thời gian đi xe
                </Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {route?.durationMinutes != null
                    ? `~${Math.round(route.durationMinutes)} phút`
                    : '10-15 phút'}
                </Text>
              </View>
            </View>
          </View>

          {/* Destination Details Box */}
          <View style={styles.destBox}>
            <View style={styles.destIconWrap}>
              <Ionicons name="storefront" size={18} color={Colors.primary} />
            </View>
            <View style={styles.destTextWrap}>
              <Text style={styles.destTitle} numberOfLines={1}>
                {destination.title}
              </Text>
              <Text style={styles.destAddress} numberOfLines={2}>
                {formattedAddress}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <Pressable
              style={styles.externalMapsBtn}
              onPress={() => {
                if (destValid && resolvedDestCoords) {
                  void openExternalDirections({
                    destLat: resolvedDestCoords.lat,
                    destLng: resolvedDestCoords.lng,
                    destLabel: destination.title,
                    originLat: originValid && activeOrigin ? activeOrigin.lat : undefined,
                    originLng: originValid && activeOrigin ? activeOrigin.lng : undefined,
                  });
                }
              }}>
              <Ionicons name="navigate-circle-outline" size={17} color="#66535B" />
              <Text style={styles.externalMapsBtnText}>Mở Google Maps dẫn đường giọng nói</Text>
            </Pressable>

            <Pressable style={styles.primaryDoneBtn} onPress={onClose}>
              <Text style={styles.primaryDoneBtnText}>Đã hiểu lộ trình</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDE5E9',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5ECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#9C6B7B',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1E1418',
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3EDF0',
  },
  mapView: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  loadingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#66535B',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#065F46',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#EFE6EB',
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCE7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconTime: {
    backgroundColor: '#E6F4EA',
  },
  metricTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 0.2,
    color: '#8A737E',
  },
  metricValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1E1418',
    marginTop: 2,
  },
  destBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FBF7F9',
    borderWidth: 1,
    borderColor: '#EFE5E9',
  },
  destIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FDE8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  destTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#1E1418',
  },
  destAddress: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#6B545F',
    marginTop: 2,
    lineHeight: 16,
  },
  btnRow: {
    gap: 8,
    marginTop: 2,
  },
  externalMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F5EFF2',
  },
  externalMapsBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#66535B',
  },
  primaryDoneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  primaryDoneBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
