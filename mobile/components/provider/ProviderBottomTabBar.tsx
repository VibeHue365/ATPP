import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '@/constants/theme';

export type ProviderTab = 'today' | 'orders' | 'qr' | 'schedules' | 'store';

interface ProviderBottomTabBarProps {
  currentTab: ProviderTab;
  onSelectTab: (tab: ProviderTab) => void;
  onOpenQrScanner: () => void;
}

export function ProviderBottomTabBar({
  currentTab,
  onSelectTab,
  onOpenQrScanner,
}: ProviderBottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabRow}>
        {/* Tab 1: Hôm nay */}
        <Pressable
          style={styles.tabBtn}
          onPress={() => onSelectTab('today')}
          accessibilityLabel="Hôm nay"
        >
          <View style={[styles.iconPill, currentTab === 'today' && styles.iconPillActive]}>
            <Ionicons
              name={currentTab === 'today' ? 'flash' : 'flash-outline'}
              size={20}
              color={currentTab === 'today' ? '#BA0049' : '#5F5E5E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'today' && styles.tabLabelActive,
            ]}
          >
            Hôm nay
          </Text>
        </Pressable>

        {/* Tab 2: Đơn hàng */}
        <Pressable
          style={styles.tabBtn}
          onPress={() => onSelectTab('orders')}
          accessibilityLabel="Đơn hàng"
        >
          <View style={[styles.iconPill, currentTab === 'orders' && styles.iconPillActive]}>
            <Ionicons
              name={currentTab === 'orders' ? 'receipt' : 'receipt-outline'}
              size={20}
              color={currentTab === 'orders' ? '#BA0049' : '#5F5E5E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'orders' && styles.tabLabelActive,
            ]}
          >
            Đơn hàng
          </Text>
        </Pressable>

        {/* Center elevated QR button */}
        <View style={styles.centerQrWrap}>
          <Pressable
            style={({ pressed }) => [styles.qrFloatingBtn, pressed && styles.qrPressed]}
            onPress={onOpenQrScanner}
            accessibilityLabel="Quét mã QR"
          >
            <MaterialIcons name="qr-code-scanner" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.qrLabel}>Quét QR</Text>
        </View>

        {/* Tab 3: Lịch hẹn */}
        <Pressable
          style={styles.tabBtn}
          onPress={() => onSelectTab('schedules')}
          accessibilityLabel="Lịch hẹn"
        >
          <View style={[styles.iconPill, currentTab === 'schedules' && styles.iconPillActive]}>
            <Ionicons
              name={currentTab === 'schedules' ? 'calendar' : 'calendar-outline'}
              size={20}
              color={currentTab === 'schedules' ? '#BA0049' : '#5F5E5E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'schedules' && styles.tabLabelActive,
            ]}
          >
            Lịch hẹn
          </Text>
        </Pressable>

        {/* Tab 4: Cửa hàng */}
        <Pressable
          style={styles.tabBtn}
          onPress={() => onSelectTab('store')}
          accessibilityLabel="Cửa hàng"
        >
          <View style={[styles.iconPill, currentTab === 'store' && styles.iconPillActive]}>
            <MaterialIcons
              name="storefront"
              size={20}
              color={currentTab === 'store' ? '#BA0049' : '#5F5E5E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'store' && styles.tabLabelActive,
            ]}
          >
            Cửa hàng
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 62,
    paddingHorizontal: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 46,
  },
  iconPill: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: '#FFF0F3',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  tabLabelActive: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  centerQrWrap: {
    alignItems: 'center',
    position: 'relative',
    top: -12,
    zIndex: 10,
    paddingHorizontal: 6,
  },
  qrFloatingBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 6,
  },
  qrPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  qrLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 2,
  },
});
