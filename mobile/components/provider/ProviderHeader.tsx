import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ProviderProfile } from '@/types/provider';
import { FontFamily } from '@/constants/theme';
import { getMediaUrl } from '@/utils/media';

interface ProviderHeaderProps {
  profile: ProviderProfile | null;
  unreadNotificationsCount?: number;
  unreadChatCount?: number;
  isOnline: boolean;
  onToggleOnline: () => void;
  onSwitchToCustomer: () => void;
  onOpenChat: () => void;
  onOpenNotifications: () => void;
}

export function ProviderHeader({
  profile,
  unreadNotificationsCount = 0,
  unreadChatCount = 0,
  isOnline,
  onToggleOnline,
  onSwitchToCustomer,
  onOpenChat,
  onOpenNotifications,
}: ProviderHeaderProps) {
  const [hueTemp, setHueTemp] = useState<number>(28);
  const [weatherDesc, setWeatherDesc] = useState<string>('Nắng nhẹ · Thuận lợi chụp');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=16.4637&longitude=107.5909&current_weather=true',
        );
        const json = await res.json();
        if (mounted && json?.current_weather) {
          const temp = Math.round(json.current_weather.temperature || 28);
          const code = Number(json.current_weather.weathercode || 0);
          setHueTemp(temp);
          if (code >= 51) {
            setWeatherDesc('Có mưa · Nên chụp mái vòm/studio');
          } else if (code >= 2) {
            setWeatherDesc('Trời dịu · Hợp cổ phục ngoại cảnh');
          } else {
            setWeatherDesc('Nắng đẹp · Giờ vàng 15:30 - 17:30');
          }
        }
      } catch {
        // Keep clean fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const storeName = profile?.businessName || profile?.brandName || 'TàGo Đối Tác';
  const storeCode =
    profile?.providerCode ||
    (profile?._id ? `#VH-${profile._id.slice(-4).toUpperCase()}` : '#VH-892');
  const city = (profile?.address?.city || 'Huế').replace('Thành phố ', '').replace('TP. ', '');
  const avatarUrl = profile?.avatarUrl || profile?.media?.logoUrl;
  const ratingVal = profile?.rating?.averageRating
    ? profile.rating.averageRating.toFixed(1)
    : '5.0';

  return (
    <View style={styles.container}>
      {/* Top Bar: Store Identity + Switch to Customer + Chat / Notifications */}
      <View style={styles.topRow}>
        <View style={styles.storeIdentity}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                source={{ uri: getMediaUrl(avatarUrl) }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <MaterialIcons name="storefront" size={20} color="#BA0049" />
              </View>
            )}
            <View
              style={[
                styles.onlineStatusDot,
                { backgroundColor: isOnline ? '#059669' : '#9CA3AF' },
              ]}
            />
          </View>

          <View style={styles.storeTextCol}>
            <Text style={styles.storeName} numberOfLines={1} ellipsizeMode="tail">
              {storeName}
            </Text>
            <View style={styles.storeMetaRow}>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={11} color="#059669" />
                <Text style={styles.verifiedText}>Đã xác minh</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#D97706" />
                <Text style={styles.ratingText}>{ratingVal}</Text>
              </View>
              <Text style={styles.storeCodeText} numberOfLines={1}>
                {storeCode} · {city}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Actions */}
        <View style={styles.rightActions}>
          <Pressable
            style={({ pressed }) => [styles.switchModePill, pressed && styles.pressed]}
            onPress={onSwitchToCustomer}
          >
            <Ionicons name="swap-horizontal" size={13} color="#BA0049" />
            <Text style={styles.switchModeText}>Khách</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={onOpenChat}
            accessibilityLabel="Tin nhắn"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#1B1C1C" />
            {unreadChatCount > 0 && <View style={styles.badgeDotRose} />}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={onOpenNotifications}
            accessibilityLabel="Thông báo"
          >
            <Ionicons name="notifications-outline" size={19} color="#1B1C1C" />
            {unreadNotificationsCount > 0 && <View style={styles.badgeDotRose} />}
          </Pressable>
        </View>
      </View>

      {/* Row 2: Unified Online Status + Live Huế Weather Strip */}
      <View style={styles.statusBarCard}>
        <View style={styles.statusLeft}>
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: isOnline ? '#059669' : '#9CA3AF' },
            ]}
          />
          <View style={styles.statusTextWrap}>
            <Text style={styles.statusTitle} numberOfLines={1}>
              {isOnline ? 'Đang nhận đơn & lịch chụp trực tiếp' : 'Đang tạm ngưng nhận đơn mới'}
            </Text>
            <Text style={styles.weatherSubtext} numberOfLines={1}>
              🌤️ Huế {hueTemp}°C · {weatherDesc}
            </Text>
          </View>
        </View>

        <Switch
          value={isOnline}
          onValueChange={onToggleOnline}
          trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
          thumbColor={isOnline ? '#059669' : '#94A3B8'}
          style={styles.switchControl}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  storeIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'relative',
    flexShrink: 0,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFD9DE',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F3',
    borderWidth: 1.5,
    borderColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storeTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  storeName: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    flexShrink: 0,
  },
  verifiedText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#059669',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 99,
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#B45309',
  },
  storeCodeText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  switchModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  switchModeText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  badgeDotRose: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA0049',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  statusBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 8,
  },
  statusLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  statusTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  statusTitle: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  weatherSubtext: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  switchControl: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});
