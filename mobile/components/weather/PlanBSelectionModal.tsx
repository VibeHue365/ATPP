import React, { useEffect, useState } from 'react';
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
import type { HeritageSpot, ProposalChangeType } from '@/types/weather';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';

interface PlanBSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  originalSpotName: string;
  originalTravelFee?: number;
  originalDate: string;
  originalTimeSlot: string;
  weatherRescheduleCount?: number;
  onSuccess: () => void;
}

const TIME_SLOTS = [
  '07:00 - 09:00',
  '09:00 - 11:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
];

export function PlanBSelectionModal({
  visible,
  onClose,
  bookingId,
  originalSpotName,
  originalTravelFee = 0,
  originalDate,
  originalTimeSlot,
  weatherRescheduleCount = 0,
  onSuccess,
}: PlanBSelectionModalProps) {
  const toast = useToast();
  const [changeType, setChangeType] = useState<ProposalChangeType>('LOCATION_ONLY');
  const [spots, setSpots] = useState<HeritageSpot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<HeritageSpot | null>(null);
  const [targetDate, setTargetDate] = useState(originalDate);
  const [targetSlot, setTargetSlot] = useState(originalTimeSlot);
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    async function fetchSpots() {
      try {
        setLoadingSpots(true);
        const data = await weatherAdvisorApi.listSpots();
        setSpots(data);
        // Default to first indoor/semi-indoor spot for safety
        const indoorFirst = data.find(
          (s) => s.spaceType === 'INDOOR_STUDIO' || s.spaceType === 'SEMI_INDOOR',
        );
        if (indoorFirst) setSelectedSpot(indoorFirst);
        else if (data.length > 0) setSelectedSpot(data[0]);
      } catch (err: any) {
        toast.show('Không thể tải danh sách di tích.', 'error');
      } finally {
        setLoadingSpots(false);
      }
    }
    fetchSpots();
  }, [visible]);

  // AD-01 travel fee delta calculation
  const newTravelFee = selectedSpot?.baseTravelFee ?? originalTravelFee;
  const rawDelta = newTravelFee - originalTravelFee;
  const additionalFeeDue = Math.max(0, rawDelta);

  const isQuotaExhausted = weatherRescheduleCount >= 2;

  async function handleSubmit() {
    try {
      setSubmitting(true);
      await weatherAdvisorApi.createProposal(bookingId, {
        changeType,
        proposedSpotId: selectedSpot?._id,
        proposedDate: changeType === 'LOCATION_ONLY' ? undefined : targetDate,
        proposedTimeSlot: changeType === 'LOCATION_ONLY' ? undefined : targetSlot,
      });

      toast.show('Đã gửi đề xuất Plan B thành công tới đối tác.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Không thể tạo đề xuất Plan B.';
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
              <Text style={styles.headerTitle}>Chọn Phương Án B (Plan B)</Text>
              <Text style={styles.headerSubtitle}>
                Chủ động ứng phó thời tiết xấu tại Huế
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
            {/* Change Type Selector */}
            <Text style={styles.sectionLabel}>1. Hình thức điều chỉnh</Text>
            <View style={styles.typeSelectorRow}>
              {/* Option 1: LOCATION_ONLY */}
              <Pressable
                style={[
                  styles.typeOption,
                  changeType === 'LOCATION_ONLY' && styles.typeOptionActive,
                ]}
                onPress={() => setChangeType('LOCATION_ONLY')}
              >
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={changeType === 'LOCATION_ONLY' ? Colors.primary : '#6B7280'}
                />
                <Text
                  style={[
                    styles.typeOptionTitle,
                    changeType === 'LOCATION_ONLY' && styles.typeOptionTitleActive,
                  ]}
                >
                  Đổi địa điểm
                </Text>
                <Text style={styles.typeOptionBadge}>Miễn trừ Quota</Text>
              </Pressable>

              {/* Option 2: DATE_AND_SLOT */}
              <Pressable
                style={[
                  styles.typeOption,
                  changeType === 'DATE_AND_SLOT' && styles.typeOptionActive,
                  isQuotaExhausted && styles.typeOptionDisabled,
                ]}
                onPress={() => {
                  if (!isQuotaExhausted) setChangeType('DATE_AND_SLOT');
                  else toast.show('Bạn đã hết 02 lần đổi ngày miễn phí.', 'info');
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={changeType === 'DATE_AND_SLOT' ? Colors.primary : '#6B7280'}
                />
                <Text
                  style={[
                    styles.typeOptionTitle,
                    changeType === 'DATE_AND_SLOT' && styles.typeOptionTitleActive,
                  ]}
                >
                  Đổi ngày & giờ
                </Text>
                <Text style={styles.typeOptionDesc}>
                  {isQuotaExhausted ? 'Hết lượt (2/2)' : `Còn ${2 - weatherRescheduleCount} lượt`}
                </Text>
              </Pressable>
            </View>

            {/* AD-02 Explain Banner */}
            <View style={styles.noticeBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#1E40AF" />
              <Text style={styles.noticeText}>
                {changeType === 'LOCATION_ONLY'
                  ? 'Theo quyết định AD-02: Đổi địa điểm trong nhà/có mái che không tính vào hạn mức 02 lần đổi lịch.'
                  : 'Đổi ngày hoặc giờ chụp sẽ tính 01 lần vào hạn mức đổi lịch thời tiết.'}
              </Text>
            </View>

            {/* Spot Selector */}
            <Text style={styles.sectionLabel}>2. Chọn bối cảnh di sản mới</Text>
            {loadingSpots ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ margin: 16 }} />
            ) : (
              <View style={styles.spotList}>
                {spots.map((s) => {
                  const isSelected = selectedSpot?._id === s._id;
                  const isIndoor = s.spaceType === 'INDOOR_STUDIO';
                  const isSemi = s.spaceType === 'SEMI_INDOOR';

                  return (
                    <Pressable
                      key={s._id}
                      style={[styles.spotCard, isSelected && styles.spotCardActive]}
                      onPress={() => setSelectedSpot(s)}
                    >
                      <View style={styles.spotCardHeader}>
                        <Text style={styles.spotCardName}>{s.name}</Text>
                        <View
                          style={[
                            styles.spaceTypeTag,
                            isIndoor ? styles.indoorTag : isSemi ? styles.semiTag : styles.outdoorTag,
                          ]}
                        >
                          <Text
                            style={[
                              styles.spaceTypeText,
                              isIndoor
                                ? styles.indoorText
                                : isSemi
                                ? styles.semiText
                                : styles.outdoorText,
                            ]}
                          >
                            {isIndoor
                              ? '🏠 Phim trường 10/10'
                              : isSemi
                              ? '🏛️ Có mái che'
                              : '🌳 Ngoài trời'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.spotAddress} numberOfLines={1}>
                        📍 {s.address}
                      </Text>
                      <Text style={styles.spotFee}>
                        Phí di chuyển cơ sở: {s.baseTravelFee.toLocaleString()}đ
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Date & Time Slot (if DATE_AND_SLOT) */}
            {changeType !== 'LOCATION_ONLY' && (
              <>
                <Text style={styles.sectionLabel}>3. Ngày & Khung giờ chụp mới</Text>
                <TextInput
                  style={styles.dateInput}
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="YYYY-MM-DD (VD: 2026-11-20)"
                />
                <View style={styles.slotGrid}>
                  {TIME_SLOTS.map((slot) => (
                    <Pressable
                      key={slot}
                      style={[
                        styles.slotBtn,
                        targetSlot === slot && styles.slotBtnActive,
                      ]}
                      onPress={() => setTargetSlot(slot)}
                    >
                      <Text
                        style={[
                          styles.slotBtnText,
                          targetSlot === slot && styles.slotBtnTextActive,
                        ]}
                      >
                        {slot}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* AD-01 Travel Fee Calculation Summary */}
            <View style={styles.feeSummaryBox}>
              <Text style={styles.feeSummaryTitle}>Dự toán phụ phí di chuyển (AD-01)</Text>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Phí điểm cũ ({originalSpotName}):</Text>
                <Text style={styles.feeVal}>{originalTravelFee.toLocaleString()}đ</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Phí điểm mới ({selectedSpot?.name || '...'}):</Text>
                <Text style={styles.feeVal}>{newTravelFee.toLocaleString()}đ</Text>
              </View>
              <View style={[styles.feeRow, styles.feeDivider]}>
                <Text style={styles.totalFeeLabel}>Phụ phí phát sinh cần thanh toán:</Text>
                <Text style={styles.totalFeeVal}>{additionalFeeDue.toLocaleString()}đ</Text>
              </View>
              {rawDelta < 0 && (
                <Text style={styles.ad01Note}>
                  * Chênh lệch âm (điểm mới gần hơn): Phụ phí là 0đ. Theo quy định AD-01, không hoàn tiền mặt hoặc credit.
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Bottom Action */}
          <View style={styles.footerRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Gửi Đề Xuất Plan B</Text>
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
    color: '#111827',
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
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#374151',
    marginTop: 14,
    marginBottom: 8,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: Radius.md,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  typeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5F7',
  },
  typeOptionDisabled: {
    opacity: 0.5,
  },
  typeOptionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#374151',
    marginTop: 4,
  },
  typeOptionTitleActive: {
    color: Colors.primary,
  },
  typeOptionBadge: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    marginTop: 4,
  },
  typeOptionDesc: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: Radius.md,
    marginTop: 10,
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#1E40AF',
    lineHeight: 16,
  },
  spotList: {
    gap: 8,
  },
  spotCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  spotCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF8F9',
  },
  spotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spotCardName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#111827',
  },
  spaceTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  indoorTag: { backgroundColor: '#DCFCE7' },
  semiTag: { backgroundColor: '#FEF3C7' },
  outdoorTag: { backgroundColor: '#F3F4F6' },
  spaceTypeText: { fontSize: 10, fontFamily: FontFamily.bodyBold },
  indoorText: { color: '#15803D' },
  semiText: { color: '#B45309' },
  outdoorText: { color: '#4B5563' },
  spotAddress: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
  },
  spotFee: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#111827',
    marginBottom: 8,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
  },
  slotBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
  },
  slotBtnText: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#374151',
  },
  slotBtnTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  feeSummaryBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feeSummaryTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#374151',
    marginBottom: 8,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  feeDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    marginTop: 4,
  },
  feeLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#6B7280',
  },
  feeVal: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#374151',
  },
  totalFeeLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#111827',
  },
  totalFeeVal: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.primary,
  },
  ad01Note: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
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
    backgroundColor: Colors.primary,
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
