import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';

export type OrderFilterKey =
  | 'all'
  | 'urgent'
  | 'pickup'
  | 'rented'
  | 'refund'
  | 'completed';

export interface OrderFilterCounts {
  all: number;
  urgent: number;
  pickup: number;
  rented: number;
  refund: number;
  completed: number;
}

interface OrderFilterTabsProps {
  activeFilter: OrderFilterKey;
  onSelectFilter: (filter: OrderFilterKey) => void;
  counts: OrderFilterCounts;
}

export function OrderFilterTabs({
  activeFilter,
  onSelectFilter,
  counts,
}: OrderFilterTabsProps) {
  const tabs: Array<{ key: OrderFilterKey; label: string; count?: number; isUrgent?: boolean }> = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'urgent', label: 'Cần xử lý', count: counts.urgent, isUrgent: true },
    { key: 'pickup', label: 'Chờ giao áo', count: counts.pickup },
    { key: 'rented', label: 'Đang thuê', count: counts.rented },
    { key: 'refund', label: 'Chờ hoàn cọc', count: counts.refund },
    { key: 'completed', label: 'Hoàn tất', count: counts.completed },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          const isUrgent = tab.isUrgent;

          return (
            <Pressable
              key={tab.key}
              onPress={() => onSelectFilter(tab.key)}
              style={({ pressed }) => [
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive,
                pressed && styles.pillPressed,
              ]}
            >
              {isUrgent && (
                <View
                  style={[
                    styles.urgentDot,
                    isActive ? styles.urgentDotActive : styles.urgentDotInactive,
                  ]}
                />
              )}
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {tab.label}
              </Text>
              {typeof tab.count === 'number' && (
                <View
                  style={[
                    styles.countBadge,
                    isActive ? styles.countBadgeActive : styles.countBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      isActive ? styles.countTextActive : styles.countTextInactive,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(219, 224, 230, 0.5)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: '#111418',
    borderColor: '#111418',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  pillInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DBE0E6',
  },
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  urgentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  urgentDotActive: {
    backgroundColor: '#F59E0B',
  },
  urgentDotInactive: {
    backgroundColor: '#D97706',
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  pillTextInactive: {
    color: '#5F6874',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  countBadgeInactive: {
    backgroundColor: '#F4F5F7',
  },
  countText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  countTextActive: {
    color: '#FFFFFF',
  },
  countTextInactive: {
    color: '#5F6874',
  },
});
