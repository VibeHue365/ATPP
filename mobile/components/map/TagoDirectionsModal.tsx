import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TagoMapView, type TagoMapMarker } from '@/components/map/TagoMapView';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import {
  fetchRoadRoute,
  formatDistance,
  isValidLatLng,
  openExternalDirections,
  type RoadRouteResult,
} from '@/utils/geo';

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

  const destValid =
    destination && isValidLatLng(destination.lat, destination.lng);
  const originValid = origin && isValidLatLng(origin.lat, origin.lng);

  useEffect(() => {
    if (!visible || !destValid || !originValid) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoadingRoute(true);

    fetchRoadRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
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
  }, [visible, destValid, originValid, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  const markers = useMemo<TagoMapMarker[]>(() => {
    if (!destination || !destValid) return [];
    const list: TagoMapMarker[] = [];

    if (origin && originValid) {
      list.push({
        id: 'origin-user',
        lat: origin.lat,
        lng: origin.lng,
        title: 'Vị trí của bạn',
        subtitle: origin.label || 'Điểm xuất phát',
        badgeText: '📍 Điểm đứng',
        color: '#1A73E8',
        tone: 'primary',
      });
    }

    list.push({
      id: 'dest-store',
      lat: destination.lat,
      lng: destination.lng,
      title: destination.title,
      subtitle: destination.address || 'Điểm đến',
      badgeText: '🎯 Điểm đến',
      color: Colors.primary,
      tone: 'emerald',
      isSelected: true,
    });

    return list;
  }, [destination, destValid, origin, originValid]);

  const mapCenter = useMemo(() => {
    if (destination && destValid) {
      if (origin && originValid) {
        return {
          lat: (destination.lat + origin.lat) / 2,
          lng: (destination.lng + origin.lng) / 2,
        };
      }
      return { lat: destination.lat, lng: destination.lng };
    }
    return { lat: 16.0685, lng: 108.2215 };
  }, [destination, destValid, origin, originValid]);

  if (!destination) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#1E1418" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>TÀGO IN-APP DIRECTIONS</Text>
            <Text style={styles.title} numberOfLines={1}>
              Chỉ đường tới {destination.title}
            </Text>
          </View>
        </View>

        {/* Map Container */}
        <View style={styles.mapContainer}>
          <TagoMapView
            center={mapCenter}
            zoom={14}
            height={380}
            userLocation={originValid ? origin : null}
            markers={markers}
            selectedMarkerId="dest-store"
            routePoints={route?.points || null}
            fitRouteBounds={Boolean(route?.points && route.points.length > 0)}
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
          {/* Metrics Pill Row */}
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Ionicons name="navigate-circle" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.metricLabel}>Khoảng cách</Text>
                <Text style={styles.metricValue}>
                  {route?.distanceKm != null
                    ? formatDistance(route.distanceKm)
                    : 'Đang định vị'}
                </Text>
              </View>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="time-outline" size={20} color="#0D9488" />
              <View>
                <Text style={styles.metricLabel}>Thời gian đi xe</Text>
                <Text style={styles.metricValue}>
                  {route?.durationMinutes != null
                    ? `~${Math.round(route.durationMinutes)} phút`
                    : '10-15 phút'}
                </Text>
              </View>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#E11D48" />
              <View>
                <Text style={styles.metricLabel}>Trạng thái</Text>
                <Text style={styles.metricValue}>Lộ trình an toàn</Text>
              </View>
            </View>
          </View>

          {/* Destination Details Box */}
          <View style={styles.destBox}>
            <View style={styles.destIconWrap}>
              <Ionicons name="storefront" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.destTitle} numberOfLines={1}>
                {destination.title}
              </Text>
              <Text style={styles.destAddress} numberOfLines={2}>
                {destination.address || 'Việt Nam'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <Pressable
              style={styles.externalMapsBtn}
              onPress={() => {
                if (destValid) {
                  void openExternalDirections({
                    destLat: destination.lat,
                    destLng: destination.lng,
                    destLabel: destination.title,
                    originLat: originValid ? origin.lat : undefined,
                    originLng: originValid ? origin.lng : undefined,
                  });
                }
              }}>
              <Ionicons name="map-outline" size={16} color="#66535B" />
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
    minHeight: 300,
    position: 'relative',
    backgroundColor: '#F3EDF0',
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
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#F0E6EB',
  },
  metricLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: '#8A737E',
  },
  metricValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1E1418',
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
    marginTop: 4,
  },
  externalMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
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
