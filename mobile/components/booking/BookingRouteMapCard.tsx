import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TagoMapView, type TagoMapMarker } from '@/components/map/TagoMapView';
import { TagoDirectionsModal } from '@/components/map/TagoDirectionsModal';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import type { Booking } from '@/types/booking';
import { itemName, itemProvider } from '@/utils/booking';
import {
  detectCityPreset,
  fetchRoadRoute,
  formatDistance,
  resolveEntityCoords,
  type RoadRouteResult,
} from '@/utils/geo';

interface BookingDestination {
  id: string;
  kind: 'PHOTOSHOOT' | 'PICKUP';
  title: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
}

interface BookingRouteMapCardProps {
  booking: Booking;
  canChangeLocation?: boolean;
  onPressChangeLocation?: () => void;
}

export function BookingRouteMapCard({
  booking,
  canChangeLocation = false,
  onPressChangeLocation,
}: BookingRouteMapCardProps) {
  const destinations = useMemo<BookingDestination[]>(() => {
    const list: BookingDestination[] = [];
    const photoshootSchedule = booking.schedules?.find(
      (s) => s.scheduleType === 'PHOTOSHOOT',
    );

    booking.items.forEach((item) => {
      const provider = itemProvider(item);
      const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
      const providerAddr = [
        provider?.address?.addressLine,
        provider?.address?.ward,
        provider?.address?.district,
        provider?.address?.city,
      ]
        .filter(Boolean)
        .join(', ');

      if (isPhoto) {
        const address =
          photoshootSchedule?.locationAddress ||
          photoshootSchedule?.locationSnapshot?.address ||
          item.shootLocation ||
          item.shootLocationSnapshot?.address ||
          providerAddr ||
          'Điểm hẹn chụp ảnh ngoại cảnh';
        const coords = resolveEntityCoords(
          photoshootSchedule?.locationSnapshot?.geo?.coordinates
            ? photoshootSchedule
            : item.shootLocationSnapshot?.geo?.coordinates
              ? item
              : { address },
        );
        list.push({
          id: `photo-${item._id}`,
          kind: 'PHOTOSHOOT',
          title: 'Điểm Hẹn Chụp Ảnh',
          subtitle: itemName(item) || 'Gói chụp cổ phục',
          address,
          lat: coords.lat,
          lng: coords.lng,
        });
      } else {
        const address =
          item.pickupReturnLocationSnapshot?.address ||
          providerAddr ||
          'Tiệm nhận & trả cổ phục';
        const pickupSnap = item.pickupReturnLocationSnapshot as any;
        const coords = resolveEntityCoords(
          pickupSnap?.geo?.coordinates
            ? pickupSnap
            : provider ?? { address },
        );
        list.push({
          id: `pickup-${item._id}`,
          kind: 'PICKUP',
          title: 'Điểm Nhận & Trả Cổ Phục',
          subtitle: provider?.businessName || itemName(item) || 'Tiệm Áo Dài',
          address,
          lat: coords.lat,
          lng: coords.lng,
        });
      }
    });

    return list;
  }, [booking]);

  const [selectedId, setSelectedId] = useState<string>(destinations[0]?.id ?? '');
  const activeDest = useMemo(
    () => destinations.find((d) => d.id === selectedId) ?? destinations[0] ?? null,
    [destinations, selectedId],
  );

  // Default user origin in the same city as the destination (updated when user taps GPS button)
  const defaultOrigin = useMemo(() => {
    const city = detectCityPreset(activeDest?.address);
    return {
      lat: Number((city.lat - 0.006).toFixed(6)),
      lng: Number((city.lng - 0.008).toFixed(6)),
      label: 'Vị trí của bạn',
    };
  }, [activeDest?.address]);

  const [userPos, setUserPos] = useState(defaultOrigin);
  const [routeData, setRouteData] = useState<RoadRouteResult | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);

  useEffect(() => {
    setUserPos(defaultOrigin);
  }, [defaultOrigin]);

  useEffect(() => {
    if (!activeDest) return;
    let cancelled = false;
    fetchRoadRoute(
      { lat: userPos.lat, lng: userPos.lng },
      { lat: activeDest.lat, lng: activeDest.lng },
    ).then((res) => {
      if (!cancelled) setRouteData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [userPos.lat, userPos.lng, activeDest?.id, activeDest?.lat, activeDest?.lng]);

  if (!activeDest) return null;

  const markers: TagoMapMarker[] = destinations.map((d) => ({
    id: d.id,
    lat: d.lat,
    lng: d.lng,
    title: d.kind === 'PHOTOSHOOT' ? '📸 Điểm Chụp' : '👘 Tiệm Nhận Đồ',
    badgeText:
      d.id === activeDest.id && routeData
        ? `${formatDistance(routeData.distanceKm)} (~${routeData.durationMinutes}p)`
        : undefined,
  }));

  return (
    <View style={styles.wrap}>
      {/* Destination Switcher Tabs (if Combo / multiple items) */}
      {destinations.length > 1 ? (
        <View style={styles.tabRow}>
          {destinations.map((d) => {
            const active = d.id === activeDest.id;
            return (
              <Pressable
                key={d.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setSelectedId(d.id)}>
                <Ionicons
                  name={d.kind === 'PHOTOSHOOT' ? 'camera-outline' : 'shirt-outline'}
                  size={14}
                  color={active ? '#FFFFFF' : Colors.primary}
                />
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                  {d.kind === 'PHOTOSHOOT' ? 'Đường tới Chỗ Chụp' : 'Đường tới Tiệm Áo'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Interactive Route Map */}
      <TagoMapView
        center={{ lat: activeDest.lat, lng: activeDest.lng }}
        zoom={14}
        height={220}
        userLocation={userPos}
        markers={markers}
        selectedMarkerId={activeDest.id}
        onSelectMarker={(id) => setSelectedId(id)}
        routePoints={routeData?.points ?? null}
        fitRouteBounds
        onUserGpsDetected={(coord) =>
          setUserPos({
            lat: coord.lat,
            lng: coord.lng,
            label: 'Vị trí GPS hiện tại của bạn',
          })
        }
      />

      {/* Route Summary & 1-Tap Navigation Card */}
      <View style={styles.infoBox}>
        <View style={styles.infoTopRow}>
          <View style={styles.badgePill}>
            <Ionicons
              name={activeDest.kind === 'PHOTOSHOOT' ? 'camera' : 'storefront'}
              size={12}
              color={Colors.primary}
            />
            <Text style={styles.badgePillText}>{activeDest.title.toUpperCase()}</Text>
          </View>
          {routeData ? (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={12} color="#FFFFFF" />
              <Text style={styles.distanceBadgeText}>
                {formatDistance(routeData.distanceKm)} · ~{routeData.durationMinutes} phút đi xe
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.destTitle}>{activeDest.subtitle}</Text>
        <Text style={styles.destAddress}>{activeDest.address}</Text>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.primaryNavBtn}
            onPress={() => setShowNavModal(true)}>
            <Ionicons name="navigate" size={15} color="#FFFFFF" />
            <Text style={styles.primaryNavBtnText}>
              {activeDest.kind === 'PHOTOSHOOT'
                ? 'Chỉ đường đến chỗ chụp ảnh'
                : 'Chỉ đường đến điểm nhận/trả đồ'}
            </Text>
          </Pressable>

          {canChangeLocation && onPressChangeLocation ? (
            <Pressable style={styles.changeSpotBtn} onPress={onPressChangeLocation}>
              <Ionicons name="location-outline" size={15} color={Colors.primary} />
              <Text style={styles.changeSpotBtnText}>Đổi điểm chụp</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <TagoDirectionsModal
        visible={showNavModal}
        onClose={() => setShowNavModal(false)}
        destination={{
          lat: activeDest.lat,
          lng: activeDest.lng,
          title: activeDest.subtitle || 'Điểm hẹn TàGo',
          address: activeDest.address,
        }}
        origin={{
          lat: userPos.lat,
          lng: userPos.lng,
          label: userPos.label,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF0F5',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F3C4D5',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#FFFDFB',
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFE4E8',
    gap: 8,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgePillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: Colors.primary,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  distanceBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  destTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: Colors.text,
  },
  destAddress: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  primaryNavBtn: {
    flex: 1.4,
    height: 42,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryNavBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  changeSpotBtn: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  changeSpotBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
});
