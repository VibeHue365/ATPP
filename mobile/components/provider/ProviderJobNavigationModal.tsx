import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TagoMapView, type MapMarkerItem } from '@/components/map/TagoMapView';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import type {
  ProviderProfile,
  ProviderScheduleItem,
  WeatherLocationChangeAlert,
} from '@/types/provider';
import {
  estimateDriveMinutes,
  fetchRoadRoute,
  formatDistance,
  haversineKm,
  openExternalDirections,
  resolveEntityCoords,
  type LatLng,
} from '@/utils/geo';

interface ProviderJobNavigationModalProps {
  visible: boolean;
  onClose: () => void;
  session?: ProviderScheduleItem | null;
  order?: any | null;
  providerProfile?: ProviderProfile | null;
  weatherAlert?: WeatherLocationChangeAlert | null;
  onStartSession?: (bookingId?: string) => void;
  onResolveLocationChange?: (approved: boolean) => void;
  onOpenChat?: () => void;
}

export function ProviderJobNavigationModal({
  visible,
  onClose,
  session,
  order,
  providerProfile,
  weatherAlert,
  onStartSession,
  onResolveLocationChange,
  onOpenChat,
}: ProviderJobNavigationModalProps) {
  const [routePoints, setRoutePoints] = useState<Array<[number, number]>>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<number | null>(null);
  const [previewNewSpot, setPreviewNewSpot] = useState(true);

  const bookingId = order?._id || session?.bookingId || weatherAlert?.bookingId;

  const customerName =
    order?.customerId?.profile?.fullName ||
    order?.contactInfo?.fullName ||
    session?.customer?.name ||
    'Nguyễn Thảo Vy';

  const customerPhone =
    order?.customerId?.auth?.phone ||
    order?.contactInfo?.phone ||
    session?.customer?.phone ||
    '0912345678';

  const packageTitle =
    order?.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE')?.name ||
    order?.items?.[0]?.name ||
    session?.packageTitle ||
    session?.serviceName ||
    'Gói Chụp Cổ Phục Di Sản';

  const timeLabel =
    session?.timeLabel ||
    order?.items?.find((i: any) => i.shootTimeSlot)?.shootTimeSlot ||
    (order?.photoshootSchedule?.startsAt
      ? new Date(order.photoshootSchedule.startsAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '14:30 Hôm nay');

  const shootConcept =
    order?.items?.find((i: any) => i.shootConcept)?.shootConcept ||
    order?.note ||
    'Cổ phục truyền thống · Ánh sáng tự nhiên';

  // Provider starting coordinates (Studio / Shop)
  const providerOrigin = useMemo(() => {
    const coords = resolveEntityCoords(providerProfile || order?.providerId || {
      address: { city: 'Huế', addressLine: 'Cung An Định, TP. Huế' },
    });
    return {
      lat: coords.lat,
      lng: coords.lng,
      name: providerProfile?.businessName || 'Studio của bạn',
      address:
        [
          providerProfile?.address?.addressLine,
          providerProfile?.address?.district,
          providerProfile?.address?.city,
        ]
          .filter(Boolean)
          .join(', ') || 'Vị trí xuất phát của Ekip',
    };
  }, [providerProfile, order]);

  // Customer photoshoot destination coordinates
  const shootDestination = useMemo(() => {
    const photoItem =
      order?.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE') || order?.items?.[0];
    const snap =
      order?.photoshootSchedule?.locationSnapshot ||
      photoItem?.shootLocationSnapshot ||
      order?.location;

    const addressText =
      snap?.addressLine ||
      snap?.address ||
      photoItem?.shootLocation ||
      session?.locationAddress ||
      session?.locationName ||
      'Đại Nội Huế (Hoàng Thành), TP. Huế';

    const resolved = resolveEntityCoords({
      id: bookingId || 'job-dest',
      geo: snap?.geo,
      address: { addressLine: addressText },
    });

    return {
      lat: resolved.lat,
      lng: resolved.lng,
      name: session?.locationName || addressText.split(',')[0] || 'Điểm hẹn chụp',
      address: addressText,
    };
  }, [order, session, bookingId]);

  // Check if there is a pending location change request
  const pendingChange = useMemo(() => {
    const req = order?.photoshootSchedule?.locationChangeRequest;
    if (req && req.status === 'PENDING') {
      const coords = resolveEntityCoords({
        id: `${bookingId}-change`,
        geo: req.geo,
        address: { addressLine: req.address || req.addressLine },
      });
      return {
        address: req.address || req.addressLine || 'Điểm chụp mới khách đề xuất',
        reason: req.reason || 'Thay đổi địa điểm do thời tiết / lịch trình',
        lat: coords.lat,
        lng: coords.lng,
      };
    }
    if (weatherAlert && weatherAlert.status === 'PENDING') {
      const coords = resolveEntityCoords({
        id: `${bookingId}-weather`,
        address: { addressLine: weatherAlert.suggestedLocation },
      });
      return {
        address: weatherAlert.suggestedLocation,
        reason: `Cảnh báo mưa tại ${weatherAlert.currentLocationName} (${weatherAlert.rainStopDuration})`,
        lat: coords.lat,
        lng: coords.lng,
      };
    }
    return null;
  }, [order, weatherAlert, bookingId]);

  const activeTarget =
    pendingChange && previewNewSpot
      ? {
          lat: pendingChange.lat,
          lng: pendingChange.lng,
          name: pendingChange.address.split(',')[0] || 'Điểm chụp mới',
          address: pendingChange.address,
        }
      : shootDestination;

  useEffect(() => {
    if (!visible) return;
    let active = true;
    fetchRoadRoute(providerOrigin, activeTarget)
      .then((res) => {
        if (!active) return;
        setRoutePoints(res.points);
        setRouteDistanceKm(res.distanceKm);
        setRouteDurationMinutes(res.durationMinutes);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [
    visible,
    providerOrigin.lat,
    providerOrigin.lng,
    activeTarget.lat,
    activeTarget.lng,
  ]);

  const distanceKm =
    routeDistanceKm ?? haversineKm(providerOrigin, activeTarget);
  const durationMins =
    routeDurationMinutes ?? estimateDriveMinutes(distanceKm);

  const markers = useMemo<MapMarkerItem[]>(() => {
    const list: MapMarkerItem[] = [
      {
        id: 'shoot-current',
        lat: shootDestination.lat,
        lng: shootDestination.lng,
        title: shootDestination.name,
        subtitle: pendingChange ? 'Điểm hẹn cũ' : `${formatDistance(distanceKm)} · ~${durationMins}p`,
        badge: pendingChange ? 'Điểm cũ' : 'Khách hẹn chụp',
        color: pendingChange && previewNewSpot ? '#64748B' : '#910C3F',
        isSelected: !pendingChange || !previewNewSpot,
      },
    ];
    if (pendingChange) {
      list.push({
        id: 'shoot-new',
        lat: pendingChange.lat,
        lng: pendingChange.lng,
        title: pendingChange.address.split(',')[0] || 'Điểm mới đề xuất',
        subtitle: 'Khách yêu cầu đổi điểm chụp',
        badge: 'Đề xuất mới',
        color: '#0F766E',
        isSelected: previewNewSpot,
      });
    }
    return list;
  }, [shootDestination, pendingChange, previewNewSpot, distanceKm, durationMins]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Navigation Bar */}
          <View style={styles.header}>
            <Pressable style={styles.iconBtn} onPress={onClose}>
              <Ionicons name="chevron-down" size={22} color="#1B1C1C" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveTagText}>BẢN ĐỒ DẪN ĐƯỜNG CA CHỤP</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Đi tới chỗ khách: {customerName}
              </Text>
            </View>
            <Pressable
              style={styles.iconBtn}
              onPress={() =>
                void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`)
              }>
              <Ionicons name="call" size={18} color={Colors.primary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Interactive Map */}
            <View style={styles.mapWrap}>
              <TagoMapView
                center={activeTarget}
                zoom={14}
                height={300}
                userLocation={{
                  lat: providerOrigin.lat,
                  lng: providerOrigin.lng,
                  label: providerOrigin.name,
                }}
                markers={markers}
                routeLine={{
                  from: providerOrigin,
                  to: activeTarget,
                  points: routePoints,
                  color: pendingChange && previewNewSpot ? '#0F766E' : '#910C3F',
                }}
              />

              {/* Floating ETA Overlay Pill */}
              <View style={styles.etaOverlay}>
                <View style={styles.etaBadge}>
                  <Ionicons name="navigate" size={14} color="#FFFFFF" />
                  <Text style={styles.etaBadgeText}>~{durationMins} phút</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.etaTitle} numberOfLines={1}>
                    Cách Studio {formatDistance(distanceKm)} (Đường bộ thực tế)
                  </Text>
                  <Text style={styles.etaSub} numberOfLines={1}>
                    Xuất phát: {providerOrigin.name} → {activeTarget.name}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pending Location Change Request Banner (if any) */}
            {pendingChange ? (
              <View style={styles.changeAlertCard}>
                <View style={styles.changeAlertHeader}>
                  <Ionicons name="rainy" size={18} color="#0F766E" />
                  <Text style={styles.changeAlertTitle}>
                    Yêu cầu đổi địa điểm chụp từ khách hàng
                  </Text>
                </View>
                <Text style={styles.changeAlertReason}>{pendingChange.reason}</Text>
                <View style={styles.changeSpotCompare}>
                  <Pressable
                    style={[
                      styles.spotSwitchChip,
                      !previewNewSpot && styles.spotSwitchChipActive,
                    ]}
                    onPress={() => setPreviewNewSpot(false)}>
                    <Text
                      style={[
                        styles.spotSwitchText,
                        !previewNewSpot && styles.spotSwitchTextActive,
                      ]}>
                      Điểm cũ: {shootDestination.name}
                    </Text>
                  </Pressable>
                  <Ionicons name="arrow-forward" size={14} color="#64748B" />
                  <Pressable
                    style={[
                      styles.spotSwitchChip,
                      previewNewSpot && styles.spotSwitchChipNewActive,
                    ]}
                    onPress={() => setPreviewNewSpot(true)}>
                    <Text
                      style={[
                        styles.spotSwitchText,
                        previewNewSpot && styles.spotSwitchTextActive,
                      ]}>
                      Điểm mới: {pendingChange.address.split(',')[0]}
                    </Text>
                  </Pressable>
                </View>
                {onResolveLocationChange ? (
                  <View style={styles.changeActionsRow}>
                    <Pressable
                      style={styles.rejectChangeBtn}
                      onPress={() => onResolveLocationChange(false)}>
                      <Text style={styles.rejectChangeText}>Giữ điểm cũ</Text>
                    </Pressable>
                    <Pressable
                      style={styles.approveChangeBtn}
                      onPress={() => onResolveLocationChange(true)}>
                      <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                      <Text style={styles.approveChangeText}>Duyệt điểm chụp mới</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Driver Job Details Card */}
            <View style={styles.driverCard}>
              <View style={styles.customerHeader}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerInitial}>
                    {customerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.customerNameRow}>
                    <Text style={styles.customerName}>{customerName}</Text>
                    <View style={styles.timeSlotBadge}>
                      <Ionicons name="time-outline" size={12} color={Colors.primary} />
                      <Text style={styles.timeSlotText}>{timeLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.packageText} numberOfLines={1}>
                    {packageTitle}
                  </Text>
                </View>
              </View>

              {/* Route Timeline Stop A -> Stop B */}
              <View style={styles.routeTimeline}>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#2563EB' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineLabel}>ĐIỂM XUẤT PHÁT (STUDIO)</Text>
                    <Text style={styles.timelineAddress} numberOfLines={1}>
                      {providerOrigin.address}
                    </Text>
                  </View>
                </View>
                <View style={styles.timelineConnector} />
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineLabel}>ĐIỂM HẸN CHỤP VỚI KHÁCH HÀNG</Text>
                    <Text style={styles.timelineAddress}>{activeTarget.address}</Text>
                  </View>
                </View>
              </View>

              {shootConcept ? (
                <View style={styles.conceptBox}>
                  <Ionicons name="sparkles-outline" size={14} color="#B45309" />
                  <Text style={styles.conceptText} numberOfLines={2}>
                    Concept / Ghi chú: {shootConcept}
                  </Text>
                </View>
              ) : null}

              {/* Quick Contact + Navigation Actions */}
              <View style={styles.quickActionRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() =>
                    void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`)
                  }>
                  <Ionicons name="call-outline" size={16} color="#1B1C1C" />
                  <Text style={styles.secondaryBtnText}>Gọi khách</Text>
                </Pressable>

                {onOpenChat ? (
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      onClose();
                      onOpenChat();
                    }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1B1C1C" />
                    <Text style={styles.secondaryBtnText}>Nhắn tin</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.googleMapsBtn}
                  onPress={() =>
                    void openExternalDirections({
                      lat: activeTarget.lat,
                      lng: activeTarget.lng,
                      label: activeTarget.address,
                      originLat: providerOrigin.lat,
                      originLng: providerOrigin.lng,
                    })
                  }>
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text style={styles.googleMapsBtnText}>Mở Google Maps dẫn đường</Text>
                </Pressable>
              </View>

              {onStartSession ? (
                <Pressable
                  style={styles.arrivedBtn}
                  onPress={() => {
                    onClose();
                    onStartSession(bookingId);
                  }}>
                  <Ionicons name="checkmark-done-circle" size={19} color="#FFFFFF" />
                  <Text style={styles.arrivedBtnText}>
                    Đã tới điểm hẹn · Bắt đầu ca chụp ngay
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '92%',
    backgroundColor: '#FBF9F9',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  liveTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.7,
    color: Colors.primary,
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1B1C1C',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  mapWrap: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  etaOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  etaBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  etaTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  etaSub: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
    marginTop: 1,
  },
  changeAlertCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: 8,
  },
  changeAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeAlertTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#0F766E',
  },
  changeAlertReason: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#134E4A',
    lineHeight: 17,
  },
  changeSpotCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  spotSwitchChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  spotSwitchChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  spotSwitchChipNewActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  spotSwitchText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#334155',
  },
  spotSwitchTextActive: {
    color: '#FFFFFF',
  },
  changeActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rejectChangeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectChangeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#475569',
  },
  approveChangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#0F766E',
  },
  approveChangeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 12,
    ...Shadow,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  customerInitial: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: Colors.primary,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customerName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#1B1C1C',
    flexShrink: 1,
  },
  timeSlotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  timeSlotText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: Colors.primary,
  },
  packageText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
    marginTop: 2,
  },
  routeTimeline: {
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineConnector: {
    width: 2,
    height: 14,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
  },
  timelineLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: '#8F8E8E',
  },
  timelineAddress: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
    lineHeight: 17,
    marginTop: 1,
  },
  conceptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  conceptText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#92400E',
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  googleMapsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  googleMapsBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  arrivedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  arrivedBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
