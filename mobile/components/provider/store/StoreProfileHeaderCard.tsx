import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Switch,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ProviderProfile, ProviderPerformance } from '@/types/provider';

interface StoreProfileHeaderCardProps {
  profile: ProviderProfile | null;
  performance?: ProviderPerformance | null;
  isOnline: boolean;
  onToggleOnline: () => void;
}

const DEFAULT_STORE_IMAGE =
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80';

export function StoreProfileHeaderCard({
  profile,
  performance,
  isOnline,
  onToggleOnline,
}: StoreProfileHeaderCardProps) {
  const storeName =
    profile?.businessName || profile?.brandName || 'LUMÉ Flagship Cố Đô';
  const addressText =
    profile?.address?.addressLine ||
    [profile?.address?.ward, profile?.address?.district, profile?.address?.city]
      .filter(Boolean)
      .join(', ') ||
    '12 Lê Lợi, TP. Huế';
  const storeCode =
    profile?.providerCode ||
    (profile?._id ? `#VH-${profile._id.slice(-4).toUpperCase()}` : '#VH-BE4A');

  const avgRating =
    performance?.averageRating ?? profile?.rating?.averageRating ?? 4.98;
  const totalReviews =
    performance?.totalReviews ??
    profile?.rating?.totalReviews ??
    profile?.rating?.reviewCount ??
    340;

  const storeImageUri =
    profile?.media?.coverUrl ||
    profile?.media?.logoUrl ||
    profile?.avatarUrl ||
    profile?.coverUrl ||
    DEFAULT_STORE_IMAGE;

  return (
    <View style={styles.card}>
      {/* Top Info Row */}
      <View style={styles.topRow}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: storeImageUri }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={11} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.storeName} numberOfLines={1}>
              {storeName}
            </Text>
            <View style={styles.partnerProBadge}>
              <Text style={styles.partnerProText}>PARTNER PRO</Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={15} color="#BA0049" />
            <Text style={styles.locationText} numberOfLines={1}>
              {addressText}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.ratingPill}>
              <MaterialIcons name="star" size={13} color="#F59E0B" />
              <Text style={styles.ratingValue}>{avgRating.toFixed(2)}</Text>
              <Text style={styles.ratingCount}> ({totalReviews}+ đánh giá)</Text>
            </View>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.warehouseCode}>Kho {storeCode}</Text>
          </View>
        </View>
      </View>

      {/* Store Status Toggle Bar */}
      <Pressable style={styles.toggleBar} onPress={onToggleOnline}>
        <View style={styles.toggleLeft}>
          <View style={styles.statusDotOuter}>
            <View
              style={[
                styles.statusDotInner,
                !isOnline && styles.statusDotOffline,
              ]}
            />
          </View>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>
              {isOnline ? 'Đang mở cửa đón khách' : 'Tạm ngưng đón khách trực tiếp'}
            </Text>
            <Text style={styles.toggleSub}>
              {isOnline
                ? 'Sẵn sàng nhận khách thử & thuê trực tiếp'
                : 'Chỉ xử lý đơn đã đặt trước trên hệ thống'}
            </Text>
          </View>
        </View>

        <Switch
          value={isOnline}
          onValueChange={onToggleOnline}
          trackColor={{ false: '#CBD5E1', true: '#BA0049' }}
          thumbColor="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.4)',
    position: 'relative',
    backgroundColor: '#F5F3F3',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#BA0049',
    borderTopLeftRadius: 6,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  storeName: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  partnerProBadge: {
    backgroundColor: 'rgba(255, 217, 222, 0.7)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  partnerProText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
    letterSpacing: 0.4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 99,
  },
  ratingValue: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
    marginLeft: 3,
  },
  ratingCount: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#5B3F43',
  },
  warehouseCode: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  toggleBar: {
    backgroundColor: '#F5F3F3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(233, 232, 231, 0.8)',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(52, 211, 153, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  statusDotOffline: {
    backgroundColor: '#94A3B8',
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  toggleSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    marginTop: 1,
  },
});
