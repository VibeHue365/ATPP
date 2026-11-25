import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { weatherAdvisorApi } from '@/apis/weatherAdvisorApi';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';

interface WeatherCancellationModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  bookingCode: string;
  weatherRescheduleCount?: number;
  onSuccess: () => void;
}

export function WeatherCancellationModal({
  visible,
  onClose,
  bookingId,
  bookingCode,
  weatherRescheduleCount = 0,
  onSuccess,
}: WeatherCancellationModalProps) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isQuotaExhausted = weatherRescheduleCount >= 2;

  function handleAddPhoto() {
    if (!photoUrl.trim()) return;
    if (!photoUrl.startsWith('http')) {
      toast.show('Vui lòng nhập đường dẫn URL hình ảnh hợp lệ.', 'info');
      return;
    }
    setEvidencePhotos([...evidencePhotos, photoUrl.trim()]);
    setPhotoUrl('');
  }

  function handleRemovePhoto(index: number) {
    setEvidencePhotos(evidencePhotos.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.show('Lý do hủy đơn phải có ít nhất 10 ký tự.', 'info');
      return;
    }

    if (!isQuotaExhausted && evidencePhotos.length === 0) {
      toast.show(
        'Đơn hàng chưa hết hạn mức đổi lịch bắt buộc phải cung cấp ít nhất 01 ảnh bằng chứng bất khả kháng (vé tàu/máy bay, giấy tờ công tác/y tế).',
        'error',
      );
      return;
    }

    try {
      setSubmitting(true);
      await weatherAdvisorApi.submitCancellation(bookingId, {
        reason: reason.trim(),
        evidencePhotos,
      });

      toast.show('Đã gửi yêu cầu hủy thời tiết thành công. Admin sẽ thẩm định sớm nhất.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Không thể gửi yêu cầu hủy.';
      toast.show(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Hủy Đơn Do Thời Tiết (AD-03)</Text>
              <Text style={styles.headerSubtitle}>
                Áp dụng cho trường hợp bất khả kháng hoặc hết quota đổi
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Eligibility Basis Card */}
            <View style={styles.basisCard}>
              <View style={styles.basisHeader}>
                <Ionicons
                  name={isQuotaExhausted ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={isQuotaExhausted ? '#16A34A' : '#D97706'}
                />
                <Text style={styles.basisTitle}>
                  {isQuotaExhausted
                    ? 'Cơ sở A: Đã hết hạn mức 02 lần đổi lịch'
                    : 'Cơ sở B: Bất khả kháng trước khi hết hạn mức'}
                </Text>
              </View>
              <Text style={styles.basisDesc}>
                {isQuotaExhausted
                  ? 'Đơn hàng của bạn đã dùng hết 02 lần đổi lịch và hiện có cảnh báo RED_ALERT. Bạn đủ điều kiện nộp đơn đề nghị hoàn tiền.'
                  : `Bạn mới dùng ${weatherRescheduleCount}/2 lần đổi lịch. Để hủy đơn, bắt buộc phải đính kèm vé máy bay/tàu xe rời Huế trong ngày hoặc giấy tờ bất khả kháng để Admin thẩm định.`}
              </Text>
            </View>

            {/* Reason Input */}
            <Text style={styles.inputLabel}>Lý do hủy đơn *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Trình bày chi tiết lý do (ngập lụt, lịch trình chuyến bay, công tác...)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={reason}
              onChangeText={setReason}
            />

            {/* Evidence Photos */}
            <Text style={styles.inputLabel}>
              Ảnh bằng chứng bất khả kháng {!isQuotaExhausted && '*'}
            </Text>
            <View style={styles.addPhotoRow}>
              <TextInput
                style={styles.photoInput}
                placeholder="Dán link ảnh vé máy bay/tàu/giấy tờ..."
                placeholderTextColor="#9CA3AF"
                value={photoUrl}
                onChangeText={setPhotoUrl}
              />
              <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Photo List */}
            {evidencePhotos.length > 0 && (
              <View style={styles.photosList}>
                {evidencePhotos.map((url, idx) => (
                  <View key={idx} style={styles.photoItem}>
                    <Ionicons name="document-attach" size={16} color="#4B5563" />
                    <Text style={styles.photoItemText} numberOfLines={1}>
                      {url}
                    </Text>
                    <Pressable onPress={() => handleRemovePhoto(idx)}>
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Neutral Disclaimer (Issue 05) */}
            <View style={styles.disclaimerBox}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#6B7280" />
              <Text style={styles.disclaimerText}>
                Yêu cầu hủy do thời tiết sẽ được Admin đối soát thủ công và cập nhật kết quả thẩm định. Khi được phê duyệt, hệ thống sẽ thực hiện hoàn tiền theo quy trình xử lý của cổng thanh toán.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Đóng</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Gửi Yêu Cầu Hủy</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#991B1B',
  },
  headerSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  basisCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  basisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  basisTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#92400E',
  },
  basisDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  inputLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#374151',
    marginTop: 16,
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    padding: 12,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  addPhotoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#111827',
  },
  addPhotoBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photosList: {
    marginTop: 8,
    gap: 6,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  photoItemText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#374151',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: Radius.md,
    marginTop: 16,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#4B5563',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#DC2626',
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
