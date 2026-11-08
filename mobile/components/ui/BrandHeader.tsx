import React from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useDestination } from '@/contexts/DestinationContext';

export function BrandHeader() {
  const { unreadCount } = useNotifications();
  const { isAuthenticated } = useAuth();
  const { count: cartCount } = useCart();
  const { destination, openDestinationPicker } = useDestination();

  return (
    <View style={styles.root}>
      <View style={styles.brandGroup}>
        <Pressable onPress={() => router.push('/(tabs)' as Href)}>
          <Image
            source={require('@/assets/images/logo-transparent.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </Pressable>

        <Pressable
          style={styles.locationBadge}
          onPress={openDestinationPicker}
          hitSlop={6}
        >
          <Ionicons name="compass-outline" size={13} color={Colors.primary} />
          <Text style={styles.locationText}>{destination.name}</Text>
          <Ionicons name="chevron-down" size={11} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Trợ lý AI Stylist"
          onPress={() => router.push('/ai-assistant' as Href)}
          style={styles.aiPillBtn}
        >
          <MaterialIcons name="auto-awesome" size={13} color="#FFFFFF" />
          <Text style={styles.aiPillText}>AI Stylist</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Yêu thích"
          onPress={() =>
            router.push((isAuthenticated ? '/favorites' : '/(auth)/login') as Href)
          }
          style={styles.iconBtn}
        >
          <Ionicons name="heart-outline" size={19} color={Colors.text} />
        </Pressable>

        <Pressable
          accessibilityLabel="Giỏ hàng"
          onPress={() => router.push('/cart' as Href)}
          style={styles.iconBtn}
        >
          <Ionicons name="bag-handle-outline" size={19} color={Colors.text} />
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(cartCount, 99)}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Thông báo"
          onPress={() =>
            router.push((isAuthenticated ? '/notifications' : '/(auth)/login') as Href)
          }
          style={styles.iconBtn}
        >
          <Ionicons name="notifications-outline" size={19} color={Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(unreadCount, 9)}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 82,
    height: 30,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  locationText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  aiPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
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
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
});
