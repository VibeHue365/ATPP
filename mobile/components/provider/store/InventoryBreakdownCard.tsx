import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type InventoryViewTab = 'collection' | 'rack' | 'alert';

interface InventoryBreakdownCardProps {
  totalItems: number;
  collectionsCount: number;
  racksCount: number;
  availableCount: number;
  rentedCount: number;
  maintenanceCount: number;
  alertCount: number;
  activeTab: InventoryViewTab;
  onSelectTab: (tab: InventoryViewTab) => void;
}

export function InventoryBreakdownCard({
  totalItems,
  collectionsCount,
  racksCount,
  availableCount,
  rentedCount,
  maintenanceCount,
  alertCount,
  activeTab,
  onSelectTab,
}: InventoryBreakdownCardProps) {
  const safeTotal = Math.max(totalItems, 1);
  const availPct = Math.round((availableCount / safeTotal) * 100);
  const rentedPct = Math.round((rentedCount / safeTotal) * 100);
  const maintPct = Math.max(0, 100 - availPct - rentedPct);

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Quản Lý Kho Hiện Vật</Text>
            <View style={styles.rfidBadge}>
              <Text style={styles.rfidBadgeText}>PRO RFID</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Kiểm đếm tự động theo thời gian thực (IoT 860-960MHz)
          </Text>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalNumber}>{totalItems}</Text>
          <Text style={styles.totalLabel}>Hiện vật tổng</Text>
        </View>
      </View>

      {/* 4-Column Mini KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiItemNeutral}>
          <Text style={styles.kpiLabelNeutral}>Bộ sưu tập</Text>
          <Text style={styles.kpiValueNeutral}>{collectionsCount} BST</Text>
        </View>

        <View style={styles.kpiItemNeutral}>
          <Text style={styles.kpiLabelNeutral}>Kệ lưu trữ</Text>
          <Text style={styles.kpiValueNeutral}>{racksCount} Kệ</Text>
        </View>

        <View style={styles.kpiItemEmerald}>
          <Text style={styles.kpiLabelEmerald}>Sẵn sàng</Text>
          <Text style={styles.kpiValueEmerald}>{availableCount} bộ</Text>
        </View>

        <View style={styles.kpiItemAmber}>
          <Text style={styles.kpiLabelAmber}>Kiểm định</Text>
          <Text style={styles.kpiValueAmber}>{maintenanceCount} chip</Text>
        </View>
      </View>

      {/* 3-Segment Progress Bar & Legend */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          {availableCount > 0 && (
            <View
              style={[
                styles.segmentEmerald,
                { flex: Math.max(availableCount, 1) },
              ]}
            />
          )}
          {rentedCount > 0 && (
            <View
              style={[
                styles.segmentAmber,
                { flex: Math.max(rentedCount, 1) },
              ]}
            />
          )}
          {maintenanceCount > 0 && (
            <View
              style={[
                styles.segmentPurple,
                { flex: Math.max(maintenanceCount, 1) },
              ]}
            />
          )}
          {totalItems === 0 && (
            <View style={[styles.segmentEmerald, { flex: 1 }]} />
          )}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
            <Text style={styles.legendText}>
              Sẵn sàng:{' '}
              <Text style={styles.legendStrong}>{availableCount}</Text> ({availPct}%)
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>
              Đang thuê:{' '}
              <Text style={styles.legendStrong}>{rentedCount}</Text> ({rentedPct}%)
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#A855F7' }]} />
            <Text style={styles.legendText}>
              Cần giặt/ủi:{' '}
              <Text style={styles.legendStrong}>{maintenanceCount}</Text> ({maintPct}%)
            </Text>
          </View>
        </View>
      </View>

      {/* 3-Tab View Switcher */}
      <View style={styles.tabGroup}>
        <Pressable
          style={[
            styles.tabBtn,
            activeTab === 'collection' && styles.tabBtnActive,
          ]}
          onPress={() => onSelectTab('collection')}
        >
          <MaterialIcons
            name="style"
            size={15}
            color={activeTab === 'collection' ? '#BA0049' : '#5B3F43'}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'collection' && styles.tabBtnTextActive,
            ]}
            numberOfLines={1}
          >
            Theo Bộ Sưu Tập
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'rack' && styles.tabBtnActive]}
          onPress={() => onSelectTab('rack')}
        >
          <MaterialIcons
            name="shelves"
            size={15}
            color={activeTab === 'rack' ? '#BA0049' : '#5B3F43'}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'rack' && styles.tabBtnTextActive,
            ]}
            numberOfLines={1}
          >
            Vị Trí Tủ Kệ
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'alert' && styles.tabBtnActive]}
          onPress={() => onSelectTab('alert')}
        >
          <MaterialIcons
            name="warning-amber"
            size={15}
            color={activeTab === 'alert' ? '#BA0049' : '#5B3F43'}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'alert' && styles.tabBtnTextActive,
            ]}
            numberOfLines={1}
          >
            Cảnh Báo ({alertCount})
          </Text>
          {alertCount > 0 && <View style={styles.alertRedDot} />}
        </Pressable>
      </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  rfidBadge: {
    backgroundColor: 'rgba(186, 0, 73, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 99,
  },
  rfidBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    marginTop: 2,
  },
  totalBox: {
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalNumber: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
    lineHeight: 20,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiItemNeutral: {
    flex: 1,
    height: 60,
    backgroundColor: '#F5F3F3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  kpiLabelNeutral: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  kpiValueNeutral: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    marginTop: 2,
  },
  kpiItemEmerald: {
    flex: 1,
    height: 60,
    backgroundColor: 'rgba(236, 253, 245, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  kpiLabelEmerald: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#047857',
  },
  kpiValueEmerald: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#047857',
    marginTop: 2,
  },
  kpiItemAmber: {
    flex: 1,
    height: 60,
    backgroundColor: 'rgba(255, 251, 235, 0.9)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  kpiLabelAmber: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#B45309',
  },
  kpiValueAmber: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
    marginTop: 2,
  },
  progressSection: {
    gap: 8,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#EFEDED',
    borderRadius: 99,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  segmentEmerald: {
    height: '100%',
    backgroundColor: '#059669',
  },
  segmentAmber: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  segmentPurple: {
    height: '100%',
    backgroundColor: '#A855F7',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  legendStrong: {
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#F5F3F3',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  tabBtnTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  alertRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BA1A1A',
    position: 'absolute',
    top: 6,
    right: 6,
  },
});
