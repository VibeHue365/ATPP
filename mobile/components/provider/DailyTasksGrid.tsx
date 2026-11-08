import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { ProviderKpis } from '@/types/provider';
import { FontFamily } from '@/constants/theme';

export type TaskFilterKey = 'ALL' | 'PREPARE_CLOTHES' | 'PICKUP_TODAY' | 'RETURN_DUE' | 'SHOOT_TODAY';

interface DailyTasksGridProps {
  kpis?: ProviderKpis;
  activeTask?: TaskFilterKey;
  onPressTask?: (type: TaskFilterKey) => void;
}

export function DailyTasksGrid({
  kpis,
  activeTask = 'ALL',
  onPressTask,
}: DailyTasksGridProps) {
  const pendingConfirm = kpis?.pendingConfirmCount ?? 0;
  const activeRentals = kpis?.activeRentalsCount ?? 0;
  const returnsDue = kpis?.returnsDueTodayCount ?? 0;
  const todaySchedules = kpis?.todaySchedulesCount ?? 0;
  const totalTasks = pendingConfirm + activeRentals + returnsDue + todaySchedules;

  const cards: Array<{
    key: TaskFilterKey;
    title: string;
    count: number;
    badgeLabel: string;
    subtext: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'PREPARE_CLOTHES',
      title: 'Cần chuẩn bị áo',
      count: pendingConfirm,
      badgeLabel: 'Chờ giao',
      subtext: pendingConfirm > 0 ? `${pendingConfirm} đơn chờ bàn giao` : 'Không có đơn chờ',
      icon: (
        <MaterialIcons
          name="checkroom"
          size={19}
          color={pendingConfirm > 0 ? '#BA0049' : '#78716C'}
        />
      ),
    },
    {
      key: 'PICKUP_TODAY',
      title: 'Khách đang thuê đồ',
      count: activeRentals,
      badgeLabel: 'Đang thuê',
      subtext: activeRentals > 0 ? `${activeRentals} đơn đang mặc chụp` : 'Chưa có đơn đang thuê',
      icon: (
        <Ionicons
          name="bag-handle-outline"
          size={19}
          color={activeRentals > 0 ? '#BA0049' : '#78716C'}
        />
      ),
    },
    {
      key: 'RETURN_DUE',
      title: 'Khách hẹn trả đồ',
      count: returnsDue,
      badgeLabel: 'Hẹn trả',
      subtext: returnsDue > 0 ? `${returnsDue} đơn cần thu hồi` : 'Không có hẹn trả hôm nay',
      icon: (
        <Ionicons
          name="checkmark-done-circle-outline"
          size={19}
          color={returnsDue > 0 ? '#059669' : '#78716C'}
        />
      ),
    },
    {
      key: 'SHOOT_TODAY',
      title: 'Ca chụp hôm nay',
      count: todaySchedules,
      badgeLabel: 'Lịch chụp',
      subtext: todaySchedules > 0 ? `${todaySchedules} ca chụp ngoại cảnh` : 'Không có ca chụp hôm nay',
      icon: (
        <Ionicons
          name="camera-outline"
          size={19}
          color={todaySchedules > 0 ? '#BA0049' : '#78716C'}
        />
      ),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.sectionTitle}>Tác vụ hôm nay</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalTasks} cần xử lý</Text>
          </View>
        </View>
        {activeTask !== 'ALL' ? (
          <Pressable onPress={() => onPressTask?.('ALL')}>
            <Text style={styles.resetFilterText}>Hiện tất cả ✕</Text>
          </Pressable>
        ) : (
          <Text style={styles.subtext}>Chạm để lọc đơn</Text>
        )}
      </View>

      {/* 2x2 Bento Grid */}
      <View style={styles.grid}>
        {cards.map((item) => {
          const hasWork = item.count > 0;
          const isSelected = activeTask === item.key;

          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.bentoCard,
                hasWork && styles.bentoCardHasWork,
                isSelected && styles.bentoCardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                onPressTask?.(isSelected ? 'ALL' : item.key)
              }
            >
              {/* Top Row: Icon + Inline Status Pill on left, Big Number on right (NEVER overlapping) */}
              <View style={styles.cardTopRow}>
                <View style={styles.leftTopGroup}>
                  <View
                    style={[
                      styles.iconBox,
                      hasWork ? styles.iconBoxActive : styles.iconBoxMuted,
                    ]}
                  >
                    {item.icon}
                  </View>
                  {hasWork && (
                    <View style={styles.inlineStatusPill}>
                      <Text style={styles.inlineStatusText}>{item.badgeLabel}</Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.cardNumber,
                    hasWork ? styles.cardNumberActive : styles.cardNumberMuted,
                  ]}
                >
                  {String(item.count).padStart(2, '0')}
                </Text>
              </View>

              {/* Bottom Info */}
              <View style={styles.cardBottomCol}>
                <View style={styles.titleWithDot}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {hasWork && <View style={styles.activeDot} />}
                </View>
                <Text
                  style={[
                    styles.cardSubtext,
                    hasWork && styles.cardSubtextActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.subtext}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  totalBadge: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  totalBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  subtext: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  resetFilterText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bentoCard: {
    width: '48.4%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: '#EFECEB',
    justifyContent: 'space-between',
    minHeight: 104,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  bentoCardHasWork: {
    borderColor: '#FFD9DE',
    backgroundColor: '#FFFFFF',
  },
  bentoCardSelected: {
    borderColor: '#BA0049',
    borderWidth: 1.5,
    backgroundColor: '#FFF9FA',
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  leftTopGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxActive: {
    backgroundColor: '#FFF0F3',
  },
  iconBoxMuted: {
    backgroundColor: '#F5F3F3',
  },
  inlineStatusPill: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  inlineStatusText: {
    fontSize: 9,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  cardNumber: {
    fontSize: 23,
    fontFamily: FontFamily.bodyBold,
    letterSpacing: -0.5,
    flexShrink: 0,
  },
  cardNumberActive: {
    color: '#BA0049',
  },
  cardNumberMuted: {
    color: '#9CA3AF',
  },
  cardBottomCol: {
    marginTop: 10,
    gap: 2,
  },
  titleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BA0049',
  },
  cardSubtext: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#78716C',
  },
  cardSubtextActive: {
    color: '#5F5E5E',
    fontFamily: FontFamily.bodySemiBold,
  },
});
