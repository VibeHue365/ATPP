import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface EscrowRefundModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  customerName: string;
  orderCode: string;
  amount: number;
  loading?: boolean;
}

export function EscrowRefundModal({
  visible,
  onClose,
  onConfirm,
  customerName,
  orderCode,
  amount,
  loading = false,
}: EscrowRefundModalProps) {
  const formattedAmount = `${amount.toLocaleString('vi-VN')} đ`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.walletIconWrap}>
                <Ionicons name="wallet-outline" size={18} color="#8C1D40" />
              </View>
              <Text style={styles.headerTitle}>Hoàn tiền cọc Escrow</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#5F6874" />
            </Pressable>
          </View>

          {/* Details Box */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Khách nhận cọc:</Text>
              <Text style={styles.detailValueBold} numberOfLines={1}>
                {customerName || 'Khách hàng'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mã đơn hàng:</Text>
              <Text style={styles.orderCodeText}>{orderCode}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRowHighlight}>
              <Text style={styles.amountLabel}>Số tiền giải tỏa:</Text>
              <Text style={styles.amountValue}>{formattedAmount}</Text>
            </View>
          </View>

          {/* Secure Notice Banner */}
          <View style={styles.noticeBanner}>
            <MaterialIcons
              name="verified-user"
              size={18}
              color="#047857"
              style={styles.noticeIcon}
            />
            <Text style={styles.noticeText}>
              Khoản cọc sẽ lập tức được giải ngân an toàn qua tài khoản ngân hàng
              liên kết của khách hàng.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.pressed,
              ]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Đóng</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && styles.pressed,
                loading && styles.btnDisabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>Xác nhận hoàn</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FDF2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#111418',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  detailsBox: {
    backgroundColor: '#F4F5F7',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#5F6874',
  },
  detailValueBold: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#111418',
    maxWidth: '60%',
    textAlign: 'right',
  },
  orderCodeText: {
    fontSize: 13,
    fontFamily: 'SpaceMono-Regular',
    color: '#111418',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(219, 224, 230, 0.6)',
    marginVertical: 2,
  },
  detailRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  amountLabel: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#111418',
  },
  amountValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#8C1D40',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EDFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    color: '#047857',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBE0E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#111418',
  },
  confirmBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#8C1D40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#8C1D40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
