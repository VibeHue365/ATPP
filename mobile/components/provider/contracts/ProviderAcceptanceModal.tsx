import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '@/constants/theme';
import type { ProviderMechanismResponse } from '@/types/contract';

interface ProviderAcceptanceModalProps {
  visible: boolean;
  mechanism: ProviderMechanismResponse | null;
  hasApprovedPolicy: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirmAccept: (mechanismHash: string) => Promise<void>;
}

export function ProviderAcceptanceModal({
  visible,
  mechanism,
  hasApprovedPolicy,
  submitting,
  onClose,
  onConfirmAccept,
}: ProviderAcceptanceModalProps) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (visible) {
      setChecked(false);
    }
  }, [visible]);

  const isMechanismApproved = mechanism?.status === 'APPROVED';
  const canConfirm = Boolean(
    isMechanismApproved &&
      hasApprovedPolicy &&
      checked &&
      mechanism?.hash &&
      !submitting,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.eyebrow}>QUY CHẾ SÀN GIAO DỊCH ĐIỆN TỬ</Text>
              <Text style={styles.title}>
                Chấp thuận Giao kết Hợp đồng Tự động
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.metaCard}>
              <Text style={styles.metaText}>
                Mã quy chế: <Text style={styles.metaMono}>{mechanism?.regulationCode || 'QC-VIBEHUE-2026-V1'}</Text>
              </Text>
              <Text style={styles.metaText}>
                Phiên bản: <Text style={styles.metaMono}>{mechanism?.version || 'auto-acceptance-v1'}</Text>
              </Text>
              <Text style={styles.metaText}>
                Trạng thái quy chế:{' '}
                <Text
                  style={[
                    styles.metaBold,
                    { color: isMechanismApproved ? '#059669' : '#B45309' },
                  ]}
                >
                  {isMechanismApproved ? 'ĐÃ PHÊ DUYỆT' : 'CHƯA DUYỆT (DRAFT)'}
                </Text>
              </Text>
            </View>

            {!hasApprovedPolicy && (
              <View style={styles.warnBox}>
                <Ionicons name="warning-outline" size={18} color="#B45309" />
                <Text style={styles.warnText}>
                  Shop cần gửi Chính sách Hợp đồng và được Ban Quản trị phê duyệt
                  trên Web trước khi chấp thuận Quy chế giao kết tự động.
                </Text>
              </View>
            )}

            <View style={styles.clauseCard}>
              <Text style={styles.clauseHeading}>
                ĐIỀU 1. PHẠM VI & CƠ CHẾ GIAO KẾT TỰ ĐỘNG
              </Text>
              <Text style={styles.clauseBody}>
                {mechanism?.description ||
                  'Nhà cung cấp cam kết và chấp thuận trước cơ chế giao kết hợp đồng điện tử tự động khi khách hàng đặt thuê áo dài trên nền tảng TàGo / VibeHue.'}
              </Text>
              <Text style={styles.clauseBody}>
                1.1. Khi khách hàng đặt đơn thuê hợp lệ theo sản phẩm, đơn giá,
                tiền cọc và Chính sách đã được duyệt của Shop, hệ thống tự động
                lập bản Hợp đồng điện tử theo mẫu chuẩn đã phê duyệt.
              </Text>
              <Text style={styles.clauseHeading}>
                ĐIỀU 2. NGHĨA VỤ CẬP NHẬT & TÁI CHẤP THUẬN
              </Text>
              <Text style={styles.clauseBody}>
                2.1. Khi Shop thay đổi chính sách thuê/bồi thường hoặc sàn cập
                nhật quy chế, Shop cần xác nhận chấp thuận lại để duy trì hiệu
                lực giao kết V2.
              </Text>
              <Text style={styles.clauseHeading}>
                ĐIỀU 3. HIỆU LỰC PHÁP LÝ ĐIỆN TỬ
              </Text>
              <Text style={styles.clauseBody}>
                3.1. Xác nhận chấp thuận được ghi nhận kèm mã tài khoản, thời
                điểm chấp thuận, phiên bản quy chế và dấu vân tay chính sách theo
                quy định giao dịch điện tử hiện hành.
              </Text>
            </View>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setChecked((prev) => !prev)}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Tôi là đại diện hợp pháp của Shop, đã đọc rõ và tự nguyện chấp
                thuận Quy chế giao kết hợp đồng điện tử tự động trên TàGo.
              </Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Đóng</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              disabled={!canConfirm}
              onPress={() => {
                if (mechanism?.hash) {
                  void onConfirmAccept(mechanism.hash);
                }
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>Chấp thuận Quy chế</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 17,
    fontFamily: FontFamily.display,
    color: '#1B1C1C',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 460,
  },
  bodyContent: {
    padding: 18,
    gap: 12,
  },
  metaCard: {
    backgroundColor: '#FDF8F9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F5D0D8',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#475569',
  },
  metaMono: {
    fontFamily: FontFamily.bodySemiBold,
    color: '#1B1C1C',
  },
  metaBold: {
    fontFamily: FontFamily.bodyBold,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
  },
  warnText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#92400E',
    lineHeight: 17,
  },
  clauseCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  clauseHeading: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1E293B',
    marginTop: 4,
  },
  clauseBody: {
    fontSize: 12.5,
    fontFamily: FontFamily.body,
    color: '#475569',
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FontFamily.bodyMedium,
    color: '#1E293B',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.bodySemiBold,
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#BA0049',
  },
  confirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
});
