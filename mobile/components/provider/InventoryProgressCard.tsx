import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import type { InventorySummaryItem } from '@/types/provider';
import { FontFamily } from '@/constants/theme';

interface InventoryProgressCardProps {
  items?: InventorySummaryItem[] | null;
  onViewDetails?: () => void;
}

export function InventoryProgressCard({
  items,
  onViewDetails,
}: InventoryProgressCardProps) {
  let totalAvailable = 0;
  let totalRented = 0;
  let totalMaintenance = 0;

  if (items && items.length > 0) {
    items.forEach((item) => {
      totalAvailable += item.available || 0;
      totalRented += item.rented || 0;
      totalMaintenance += item.maintenance || 0;
    });
  }

  const grandTotal = totalAvailable + totalRented + totalMaintenance;
  const availPct = grandTotal > 0 ? Math.round((totalAvailable / grandTotal) * 100) : 100;
  const rentPct = grandTotal > 0 ? Math.round((totalRented / grandTotal) * 100) : 0;
  const maintPct = grandTotal > 0 ? Math.max(0, 100 - availPct - rentPct) : 0;

  // Highlight items currently rented or in maintenance so provider can track them directly
  const activeStockItems = (items || [])
    .filter((i) => (i.rented || 0) > 0 || (i.maintenance || 0) > 0)
    .slice(0, 3);

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="inventory-2" size={17} color="#BA0049" />
          </View>
          <View>
            <Text style={styles.titleText}>Tình trạng kho áo dài</Text>
            <Text style={styles.subtitleText}>Tổng {grandTotal} bộ trong tiệm</Text>
          </View>
        </View>

        <Pressable style={styles.viewStoreBtn} onPress={onViewDetails}>
          <Text style={styles.overdueLink}>Quản lý kho</Text>
          <Ionicons name="arrow-forward" size={13} color="#BA0049" />
        </Pressable>
      </View>

      {/* 3-Segment Progress Bar */}
      <View style={styles.progressBarTrack}>
        {availPct > 0 && (
          <View style={[styles.segmentGreen, { width: `${availPct}%` }]} />
        )}
        {rentPct > 0 && (
          <View style={[styles.segmentRose, { width: `${rentPct}%` }]} />
        )}
        {maintPct > 0 && (
          <View style={[styles.segmentAmber, { width: `${maintPct}%` }]} />
        )}
      </View>

      {/* 3 Compact Summary Pills */}
      <View style={styles.columnsRow}>
        <Pressable style={styles.subCard} onPress={onViewDetails}>
          <View style={styles.subCardTop}>
            <View style={[styles.statusDot, { backgroundColor: '#059669' }]} />
            <Text style={[styles.subCardLabel, { color: '#059669' }]}>Sẵn sàng</Text>
          </View>
          <Text style={styles.subCardNumber}>{totalAvailable} bộ</Text>
          <Text style={styles.subCardSubtext}>{availPct}% sẵn trên kệ</Text>
        </Pressable>

        <Pressable
          style={[styles.subCard, totalRented > 0 && styles.roseSubCard]}
          onPress={onViewDetails}
        >
          <View style={styles.subCardTop}>
            <View style={[styles.statusDot, { backgroundColor: '#BA0049' }]} />
            <Text style={[styles.subCardLabel, { color: '#BA0049' }]}>Đang thuê</Text>
          </View>
          <Text style={styles.subCardNumber}>{totalRented} bộ</Text>
          <Text style={styles.subCardSubtextRose}>
            {totalRented > 0 ? 'Khách đang giữ' : 'Không có'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.subCard, totalMaintenance > 0 && styles.amberSubCard]}
          onPress={onViewDetails}
        >
          <View style={styles.subCardTop}>
            <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
            <Text style={[styles.subCardLabel, { color: '#D97706' }]}>Bảo trì/Giặt</Text>
          </View>
          <Text style={styles.subCardNumber}>{totalMaintenance} bộ</Text>
          <Text style={styles.subCardSubtext}>{maintPct}% đang xử lý</Text>
        </Pressable>
      </View>

      {/* Real-time items out of shelf (if any) */}
      {activeStockItems.length > 0 && (
        <View style={styles.activeItemsBox}>
          <Text style={styles.activeItemsHeading}>
            Cổ phục đang cho thuê / bảo trì:
          </Text>
          {activeStockItems.map((it, idx) => (
            <Pressable
              key={`${it.productId}-${it.size}-${idx}`}
              style={styles.activeItemRow}
              onPress={onViewDetails}
            >
              <View style={styles.activeItemLeft}>
                <MaterialIcons name="checkroom" size={14} color="#BA0049" />
                <Text style={styles.activeItemName} numberOfLines={1}>
                  {it.productName}
                </Text>
                <View style={styles.sizeBadge}>
                  <Text style={styles.sizeBadgeText}>Size {it.size}</Text>
                </View>
              </View>
              <View style={styles.activeItemRight}>
                {it.rented > 0 && (
                  <Text style={styles.rentedTag}>{it.rented} đang thuê</Text>
                )}
                {it.maintenance > 0 && (
                  <Text style={styles.maintTag}>{it.maintenance} giặt hấp</Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFECEB',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  subtitleText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  viewStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  overdueLink: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 99,
    backgroundColor: '#F5F3F3',
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  segmentGreen: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 99,
  },
  segmentRose: {
    height: '100%',
    backgroundColor: '#BA0049',
    borderRadius: 99,
  },
  segmentAmber: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 99,
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subCard: {
    flex: 1,
    backgroundColor: '#FBF9F9',
    borderRadius: 13,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 2,
  },
  roseSubCard: {
    backgroundColor: '#FFF9FA',
    borderColor: '#FFD9DE',
  },
  amberSubCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  subCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subCardLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
  },
  subCardNumber: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 2,
  },
  subCardSubtext: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
  },
  subCardSubtextRose: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
  },
  activeItemsBox: {
    backgroundColor: '#FBF9F9',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 6,
  },
  activeItemsHeading: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#5F5E5E',
  },
  activeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 3,
  },
  activeItemLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeItemName: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#1B1C1C',
  },
  sizeBadge: {
    backgroundColor: '#EFECEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sizeBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  activeItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rentedTag: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  maintTag: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#D97706',
  },
});
