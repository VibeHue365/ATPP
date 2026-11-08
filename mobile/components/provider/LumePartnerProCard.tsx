import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ProviderWalletResponse, ProviderKpis } from '@/types/provider';
import { FontFamily } from '@/constants/theme';

interface LumePartnerProCardProps {
  walletData?: ProviderWalletResponse | null;
  kpis?: ProviderKpis;
  escrowHeldAmount?: number;
  onWithdraw?: () => void;
}

export function LumePartnerProCard({
  walletData,
  escrowHeldAmount = 0,
  onWithdraw,
}: LumePartnerProCardProps) {
  const [showSettlements, setShowSettlements] = useState(false);

  const availableBalance = walletData?.wallet?.availableBalance ?? 0;
  const pendingBalance = walletData?.wallet?.pendingBalance ?? 0;
  const settlements = walletData?.recentSettlements ?? [];

  const formatVnd = (amount: number) => {
    return Math.round(amount).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Image
              source={require('@/assets/images/logo-icon.png')}
              style={styles.logoIconImg}
              contentFit="contain"
            />
          </View>
          <Text style={styles.brandTitle}>TÀGO PARTNER PRO</Text>
        </View>

        <View style={styles.statusPill}>
          <View style={styles.greenPulseDot} />
          <Text style={styles.statusPillText}>Ví đối tác khả dụng</Text>
        </View>
      </View>

      {/* Main Available Balance (Clean Sans-Serif Tabular Figures - No uneven baseline!) */}
      <View style={styles.balanceRow}>
        <View style={styles.balanceCol}>
          <Text style={styles.balanceLabel}>Doanh thu khả dụng</Text>
          <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatVnd(availableBalance)}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.withdrawBtn, pressed && styles.btnPressed]}
          onPress={onWithdraw}
        >
          <Text style={styles.withdrawBtnText}>Rút tiền</Text>
          <Ionicons
            name="arrow-up-outline"
            size={14}
            color="#FFFFFF"
            style={{ transform: [{ rotate: '45deg' }] }}
          />
        </Pressable>
      </View>

      {/* 2 Spacious Columns: Cọc giữ hộ (Escrow) | Chờ đối soát */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCol}>
          <View style={styles.metricTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#D97706" />
            <Text style={styles.metricTitleAmber} numberOfLines={1}>
              Cọc giữ hộ (Escrow)
            </Text>
          </View>
          <Text style={styles.metricAmount}>{formatVnd(escrowHeldAmount)}</Text>
          <Text style={styles.metricSubtext}>Tự động hoàn sau trả đồ</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <View style={styles.metricTitleRow}>
            <Ionicons name="time-outline" size={14} color="#059669" />
            <Text style={styles.metricTitleGreen} numberOfLines={1}>
              Chờ đối soát
            </Text>
          </View>
          <Text style={styles.metricAmount}>{formatVnd(pendingBalance)}</Text>
          <Text style={styles.metricSubtext}>Chuyển ví sau 12h</Text>
        </View>
      </View>

      {/* Expandable Settlements Drawer */}
      {settlements.length > 0 && (
        <View style={styles.settlementsSection}>
          <Pressable
            style={styles.settlementToggleBtn}
            onPress={() => setShowSettlements((v) => !v)}
          >
            <View style={styles.settlementToggleLeft}>
              <Ionicons name="receipt-outline" size={14} color="#BA0049" />
              <Text style={styles.settlementToggleText}>
                {showSettlements
                  ? 'Ẩn lịch sử đối soát gần đây'
                  : `Xem ${settlements.length} giao dịch đối soát gần đây`}
              </Text>
            </View>
            <Ionicons
              name={showSettlements ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#BA0049"
            />
          </Pressable>

          {showSettlements && (
            <View style={styles.settlementList}>
              {settlements.slice(0, 4).map((item, idx) => (
                <View key={item.settlementCode || idx} style={styles.settlementItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settlementCodeText}>
                      Đơn #{item.bookingCode || item.settlementCode}
                    </Text>
                    <Text style={styles.settlementDateText}>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString('vi-VN')
                        : 'Đã đối soát'}
                    </Text>
                  </View>
                  <Text style={styles.settlementAmountText}>
                    +{formatVnd(item.payableAmount || item.netAmount || 0)}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconImg: {
    width: 18,
    height: 18,
  },
  brandTitle: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.7,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#059669',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  balanceCol: {
    flex: 1,
    gap: 3,
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  balanceValue: {
    fontSize: 26,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    letterSpacing: -0.5,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 99,
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  withdrawBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  metricCol: {
    flex: 1,
    gap: 3,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#EFECEB',
    marginHorizontal: 12,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricTitleAmber: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#B45309',
  },
  metricTitleGreen: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#059669',
  },
  metricAmount: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 2,
  },
  metricSubtext: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    color: '#78716C',
  },
  settlementsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    paddingTop: 10,
    gap: 8,
  },
  settlementToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settlementToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settlementToggleText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  settlementList: {
    gap: 6,
  },
  settlementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  settlementCodeText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  settlementDateText: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
  },
  settlementAmountText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#059669',
  },
});
