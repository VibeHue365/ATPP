import React, { useCallback, useEffect, useState } from 'react';
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
import {
  staffApi,
  type ScheduleAvailableStaffItem,
} from '@/apis/staffApi';
import { FontFamily, Radius } from '@/constants/theme';

export function useApproveStaffPicker() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any | null>(null);
  const [pendingNote, setPendingNote] = useState<string | undefined>(undefined);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [staff, setStaff] = useState<ScheduleAvailableStaffItem[]>([]);

  const close = useCallback(() => {
    setVisible(false);
    setPendingOrder(null);
    setPendingNote(undefined);
    setStaff([]);
  }, []);

  const checkNeedsStaffPicker = useCallback(
    async (order: any, note?: string): Promise<boolean> => {
      const isPhotoOrCombo =
        order?.bookingType === 'PHOTOGRAPHY' ||
        order?.bookingType === 'COMBO' ||
        (Array.isArray(order?.items) &&
          order.items.some(
            (i: any) =>
              i?.itemType === 'PHOTOGRAPHY_PACKAGE' ||
              Boolean(i?.photographyPackageId),
          ));
      if (!isPhotoOrCombo || !order?._id) return false;

      setLoading(true);
      try {
        const avail = await staffApi.getAvailableStaffForBooking(order._id);
        const list = Array.isArray(avail?.staff) ? avail.staff : [];
        const hasTeam = (avail?.activeStaffCount ?? list.length) > 0;
        if (avail?.scheduleId && hasTeam && !avail.currentAssignedStaffId) {
          setPendingOrder(order);
          setPendingNote(note);
          setDateKey(avail.dateKey ?? null);
          setTimeSlot(avail.timeSlot ?? null);
          setStaff(list);
          setVisible(true);
          return true;
        }
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    visible,
    loading,
    pendingOrder,
    pendingNote,
    dateKey,
    timeSlot,
    staff,
    close,
    checkNeedsStaffPicker,
  };
}

interface ApproveStaffPickerModalProps {
  visible: boolean;
  bookingCode?: string | null;
  dateKey?: string | null;
  timeSlot?: string | null;
  staff: ScheduleAvailableStaffItem[];
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (staffId: string, staffName: string) => void;
}

function formatDateVn(dateKey?: string | null): string {
  if (!dateKey) return '';
  const parts = String(dateKey).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateKey;
}

export function ApproveStaffPickerModal({
  visible,
  bookingCode,
  dateKey,
  timeSlot,
  staff,
  loading = false,
  submitting = false,
  onClose,
  onConfirm,
}: ApproveStaffPickerModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  useEffect(() => {
    if (!visible) return;
    const firstAvailable = staff.find((st) => st.available);
    setSelectedStaffId(firstAvailable?.staffId ?? '');
  }, [visible, staff]);

  const freeStaff = staff.filter((st) => st.available);
  const selectedItem = staff.find((st) => st.staffId === selectedStaffId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>CHẤP NHẬN LỊCH CHỤP</Text>
              <Text style={styles.title}>
                Phân công thợ chụp{bookingCode ? ` · #${bookingCode}` : ''}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} disabled={submitting}>
              <Ionicons name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          {(dateKey || timeSlot) && (
            <View style={styles.slotPill}>
              <Ionicons name="calendar-outline" size={14} color="#8E1B2E" />
              <Text style={styles.slotPillText}>
                {[dateKey ? `Ngày ${formatDateVn(dateKey)}` : '', timeSlot || '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          )}

          <Text style={styles.helper}>
            Chọn 1 thợ chụp đang rảnh để phụ trách ca này. Sau khi xác nhận, khách hàng sẽ thấy thông tin liên hệ thợ và ca chụp sẽ hiển thị trên Cổng Thợ chụp.
          </Text>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color="#BA0049" />
              <Text style={styles.loadingText}>Đang kiểm tra lịch rảnh/bận từng thợ...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
            >
              {freeStaff.length === 0 && (
                <View style={styles.emptyWarn}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                  <Text style={styles.emptyWarnText}>
                    Hiện chưa có thợ nào rảnh trong khung giờ này. Vui lòng kiểm tra lịch nghỉ hoặc điều phối lại các đơn trùng giờ.
                  </Text>
                </View>
              )}

              {staff.map((st) => {
                const isAvail = Boolean(st.available);
                const isSelected = isAvail && selectedStaffId === st.staffId;
                return (
                  <Pressable
                    key={st.staffId}
                    disabled={!isAvail || submitting}
                    onPress={() => setSelectedStaffId(st.staffId)}
                    style={[
                      styles.staffCard,
                      isSelected && styles.staffCardSelected,
                      !isAvail && styles.staffCardDisabled,
                    ]}
                  >
                    <View style={styles.staffLeft}>
                      <View
                        style={[
                          styles.radio,
                          isSelected && styles.radioSelected,
                          !isAvail && styles.radioDisabled,
                        ]}
                      />
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(st.name || 'T').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffName} numberOfLines={1}>
                          {st.name}
                        </Text>
                        <Text style={styles.staffSub} numberOfLines={1}>
                          {[st.specialty, st.phone].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isAvail ? styles.statusAvail : styles.statusBusy,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isAvail ? styles.statusTextAvail : styles.statusTextBusy,
                        ]}
                      >
                        {isAvail ? 'Đang rảnh' : st.conflictReason || 'Đang bận'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmBtn,
                (!selectedStaffId || freeStaff.length === 0 || submitting || loading) &&
                  styles.confirmBtnDisabled,
              ]}
              disabled={!selectedStaffId || freeStaff.length === 0 || submitting || loading}
              onPress={() => {
                if (selectedStaffId) {
                  onConfirm(selectedStaffId, selectedItem?.name || 'Thợ chụp');
                }
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
              )}
              <Text style={styles.confirmText}>
                {submitting ? 'Đang xác nhận...' : 'Xác nhận & Phân công'}
              </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: '82%',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
    letterSpacing: 0.7,
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 17,
    color: '#111418',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FCF9F2',
    borderWidth: 1,
    borderColor: '#E7DAC9',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  slotPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#8E1B2E',
  },
  helper: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#5F6874',
  },
  centerBox: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: '#64748B',
  },
  list: {
    maxHeight: 290,
  },
  emptyWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 11,
    padding: 11,
  },
  emptyWarnText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: '#991B1B',
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAE0D5',
    backgroundColor: '#FFFFFF',
  },
  staffCardSelected: {
    borderColor: '#BA0049',
    backgroundColor: '#FFF7F9',
  },
  staffCardDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.65,
  },
  staffLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  radio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  radioSelected: {
    borderColor: '#BA0049',
    backgroundColor: '#BA0049',
  },
  radioDisabled: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5E6E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#8E1B2E',
  },
  staffName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#111418',
  },
  staffSub: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusAvail: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBusy: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
  },
  statusTextAvail: {
    color: '#047857',
  },
  statusTextBusy: {
    color: '#B91C1C',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#475569',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: '#BA0049',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
});
