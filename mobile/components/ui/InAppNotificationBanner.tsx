import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';

import { openNotificationData } from '@/utils/notificationNavigation';
import { getCurrentPortalMode } from '@/utils/navigation';

export function InAppNotificationBanner() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { activeBanner, dismissBanner, markRead } = useNotifications();
  const translateY = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: activeBanner ? 0 : -160,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
    }).start();
  }, [activeBanner, translateY]);

  if (!activeBanner) return null;

  const { rawId, formatted } = activeBanner;

  const handlePress = () => {
    dismissBanner();
    if (!rawId.startsWith('local-')) {
      void markRead(rawId).catch(() => {});
    }

    const isProviderContext =
      pathname.startsWith('/provider') || getCurrentPortalMode() === 'provider';

    openNotificationData(
      {
        bookingId: formatted.bookingId,
        contractId: formatted.contractId,
        paymentCode: formatted.paymentCode,
        targetRole: formatted.targetRole,
      },
      { isProviderPortal: isProviderContext },
    );
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top: Math.max(insets.top + 8, 14),
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable style={styles.card} onPress={handlePress}>
        <View style={[styles.iconBox, { backgroundColor: formatted.bg }]}>
          <Ionicons name={formatted.icon} size={20} color={formatted.color} />
        </View>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={[styles.badge, { backgroundColor: formatted.bg }]}>
              <Text style={[styles.badgeText, { color: formatted.color }]}>
                {formatted.categoryLabel}
              </Text>
            </View>
            <Text style={styles.nowText}>Vừa cập nhật</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {formatted.title}
          </Text>
          <Text style={styles.content} numberOfLines={2}>
            {formatted.content}
          </Text>
        </View>

        <Pressable
          onPress={dismissBanner}
          hitSlop={10}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E3E8',
    ...Shadow,
    elevation: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.4,
  },
  nowText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 9.5,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.text,
    marginTop: 2,
  },
  content: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 15.5,
    color: Colors.textSecondary,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3F3',
  },
});
