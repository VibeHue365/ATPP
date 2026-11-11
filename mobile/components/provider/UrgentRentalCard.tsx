import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface UrgentRentalCardProps {
  onScanTag?: () => void;
  onVerifyReturn?: () => void;
  onOpenChat?: () => void;
}

export function UrgentRentalCard({
  onScanTag,
  onVerifyReturn,
  onOpenChat,
}: UrgentRentalCardProps) {
  const customerPhone = '0912.678.789';

  const handleCall = () => {
    void Linking.openURL(`tel:${customerPhone.replace(/[^0-9+]/g, '')}`);
  };

  return (
    <View style={styles.card}>
      {/* Left Amber Accent Bar */}
      <View style={styles.leftAccent} />

      <View style={styles.contentWrap}>
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <View style={styles.urgentBadge}>
            <View style={styles.amberPulsingDot} />
            <Text style={styles.urgentBadgeText}>
              ⚡ GIAO ĐỒ TRỰC TIẾP · HẸN 14:15 (Còn 20m)
            </Text>
          </View>
          <View style={styles.codeBadge}>
            <Text style={styles.codeBadgeText}>#AD-840</Text>
          </View>
        </View>

        {/* Customer & Item details */}
        <View style={styles.detailsRow}>
          {/* Amber Icon Box */}
          <View style={styles.itemBox}>
            <MaterialIcons name="checkroom" size={28} color="#D97706" />
            <Text style={styles.itemBoxText}>2 BỘ ÁO</Text>
          </View>

          {/* Customer info */}
          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName}>Trần Mai Phương</Text>
              <View style={styles.phoneCol}>
                <Ionicons name="call-outline" size={12} color="#64748B" />
                <Text style={styles.phoneText}>0912.xxx.789</Text>
              </View>
            </View>

            <View style={styles.productPill}>
              <MaterialIcons name="style" size={14} color="#5B0114" />
              <Text style={styles.productText} numberOfLines={1}>
                Nhật Bình Hoàng Gia (M) + Ngũ Thân Nam (L)
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.accessoryText} numberOfLines={1}>
                Phụ kiện: Mấn + Quạt lụa
              </Text>
              <View style={styles.depositPill}>
                <Ionicons name="lock-closed" size={10} color="#1B8755" />
                <Text style={styles.depositText}>Cọc: 1.500.000 đ</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.squareIconBtn, pressed && styles.btnPressed]}
            onPress={handleCall}
            accessibilityLabel="Gọi khách"
          >
            <Ionicons name="call-outline" size={19} color="#4A5568" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.squareIconBtn, pressed && styles.btnPressed]}
            onPress={onOpenChat}
            accessibilityLabel="Nhắn tin"
          >
            <Ionicons name="chatbubble-outline" size={19} color="#4A5568" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryActionBtn, pressed && styles.btnPressed]}
            onPress={onScanTag}
          >
            <Ionicons name="qr-code-outline" size={19} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText} numberOfLines={1}>
              Quét mã Tag áo & Giao đồ
            </Text>
          </Pressable>
        </View>

        {/* Bottom Return Strip (Khách hẹn trả đồ) */}
        <View style={styles.returnFooterStrip}>
          <View style={styles.returnLeftCol}>
            <View style={styles.greenDot} />
            <View style={styles.returnTextCol}>
              <View style={styles.returnTopRow}>
                <Text style={styles.returnCode}>#AD-832</Text>
                <Text style={styles.returnName} numberOfLines={1}>
                  Đặng Thu Thảo
                </Text>
                <Text style={styles.returnTime}>(13:50)</Text>
              </View>
              <Text style={styles.returnSubtext} numberOfLines={1}>
                Trả 1 Áo Nhật Bình cổ xưa · Chờ kiểm
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.verifyBtn, pressed && styles.btnPressed]}
            onPress={onVerifyReturn}
          >
            <Ionicons name="checkmark-done" size={13} color="#B45309" />
            <Text style={styles.verifyBtnText}>Kiểm tra & Hoàn cọc</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#D97706',
    zIndex: 2,
  },
  contentWrap: {
    padding: 14,
    paddingLeft: 18,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
  },
  amberPulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  urgentBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
  },
  codeBadge: {
    backgroundColor: '#FBF0F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#5B0114',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  itemBox: {
    width: 66,
    height: 74,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  itemBoxText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
    marginTop: 2,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  phoneCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  productText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#1E293B',
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  accessoryText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    flexShrink: 1,
  },
  depositPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  depositText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#1B8755',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  squareIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#5B0114',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    shadowColor: '#5B0114',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  returnFooterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDFBF7',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginHorizontal: -14,
    marginBottom: -14,
    padding: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  returnLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1B8755',
  },
  returnTextCol: {
    flex: 1,
    minWidth: 0,
  },
  returnTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  returnCode: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#5B0114',
  },
  returnName: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#1E293B',
    flexShrink: 1,
  },
  returnTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  returnSubtext: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    marginTop: 1,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  verifyBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
