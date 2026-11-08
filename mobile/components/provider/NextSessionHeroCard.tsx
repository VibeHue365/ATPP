import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ProviderScheduleItem } from '@/types/provider';

interface NextSessionHeroCardProps {
  session?: ProviderScheduleItem | null;
  onStartSession?: () => void;
  onOpenMap?: () => void;
}

export function NextSessionHeroCard({
  session,
  onStartSession,
  onOpenMap,
}: NextSessionHeroCardProps) {
  const customerName = session?.customer?.name || 'Nguyễn Thảo Vy';
  const customerPhone = session?.customer?.phone || '0912.345.678';
  const timeLabel = session?.timeLabel || '⏱ Còn 45m · 14:30 Chiều nay';
  const photographer = session?.photographerName || 'Hoàng Nam';
  const packageName = session?.packageTitle || session?.serviceName || 'Gói Cung Đình Huế Hoàng Gia (2h)';
  const locationName = session?.locationName || 'Cung An Định';
  const fullAddress =
    session?.locationAddress || 'Cung An Định, 179 Phan Đình Phùng, TP. Huế';
  const guestCount = session?.guestCount || 3;

  const handleOpenMap = () => {
    if (onOpenMap) {
      onOpenMap();
      return;
    }
    const encoded = encodeURIComponent(fullAddress);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    void Linking.openURL(url);
  };

  const handleCall = () => {
    void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`);
  };

  return (
    <View style={styles.card}>
      {/* Left Burgundy Accent Bar */}
      <View style={styles.leftAccent} />

      <View style={styles.contentWrap}>
        {/* Top meta row */}
        <View style={styles.topMetaRow}>
          <View style={styles.timeBadge}>
            <View style={styles.pulsingDot} />
            <Text style={styles.timeBadgeText}>{timeLabel}</Text>
          </View>

          <View style={styles.photographerCol}>
            <Ionicons name="camera-outline" size={14} color="#64748B" />
            <Text style={styles.photographerLabel}>Thợ ảnh:</Text>
            <Text style={styles.photographerName}>{photographer}</Text>
          </View>
        </View>

        {/* Customer & Location Details Row */}
        <View style={styles.detailsRow}>
          {/* Location Thumbnail */}
          <View style={styles.thumbWrap}>
            <Image
              source="https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80"
              style={styles.thumbImage}
            />
            <View style={styles.locationTag}>
              <Text style={styles.locationTagText} numberOfLines={1}>
                {locationName}
              </Text>
            </View>
          </View>

          {/* Customer Text Info */}
          <View style={styles.customerInfoCol}>
            <View style={styles.customerTitleRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {customerName}
              </Text>
              <View style={styles.vipBadge}>
                <Ionicons name="star" size={10} color="#B45309" />
                <Text style={styles.vipBadgeText}>VIP ({guestCount} khách)</Text>
              </View>
            </View>

            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color="#64748B" />
              <Text style={styles.phoneText}>{customerPhone}</Text>
            </View>

            <View style={styles.packagePill}>
              <MaterialIcons name="auto-awesome" size={13} color="#5B0114" />
              <Text style={styles.packageText} numberOfLines={1}>
                {packageName}
              </Text>
            </View>
          </View>
        </View>

        {/* Address Bar (Tappable to open Driver Navigation Map) */}
        <Pressable
          style={({ pressed }) => [styles.addressBar, pressed && styles.btnPressed]}
          onPress={handleOpenMap}>
          <Ionicons name="location" size={15} color="#5B0114" />
          <Text style={styles.addressText} numberOfLines={1}>
            <Text style={styles.addressBold}>{locationName}</Text>,{' '}
            {fullAddress.replace(locationName + ',', '').trim()}
          </Text>
          <View style={styles.mapQuickBadge}>
            <Ionicons name="navigate" size={11} color="#5B0114" />
            <Text style={styles.mapQuickBadgeText}>Bản đồ</Text>
          </View>
        </Pressable>

        {/* 3 Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.squareIconBtn, pressed && styles.btnPressed]}
            onPress={handleOpenMap}
            accessibilityLabel="Chỉ đường"
          >
            <Ionicons name="navigate-outline" size={19} color="#5B0114" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.squareIconBtn, pressed && styles.btnPressed]}
            onPress={handleCall}
            accessibilityLabel="Gọi khách"
          >
            <Ionicons name="call-outline" size={19} color="#5B0114" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryActionBtn, pressed && styles.btnPressed]}
            onPress={onStartSession}
          >
            <Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>Bắt đầu ca chụp</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#5B0114',
    zIndex: 2,
  },
  contentWrap: {
    padding: 14,
    paddingLeft: 18,
    gap: 12,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FBF0F1',
    borderWidth: 1,
    borderColor: 'rgba(91, 1, 20, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#5B0114',
  },
  timeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#5B0114',
  },
  photographerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photographerLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  photographerName: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#1E293B',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumbWrap: {
    width: 66,
    height: 82,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  locationTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(91, 1, 20, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationTagText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  customerInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  customerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  customerName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    flexShrink: 1,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  vipBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  phoneText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  packagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  packageText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#334155',
    flexShrink: 1,
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addressText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#475569',
    flex: 1,
  },
  addressBold: {
    fontFamily: 'Inter_700Bold',
    color: '#1E293B',
  },
  mapQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  mapQuickBadgeText: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    color: '#5B0114',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  squareIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#5B0114',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: '#5B0114',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
