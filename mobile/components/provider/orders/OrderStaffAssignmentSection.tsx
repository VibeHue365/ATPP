import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  staffApi,
  type ScheduleAvailableStaffItem,
  type StaffChatSupervisionResponse,
} from '@/apis/staffApi';
import { FontFamily, Radius } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

interface OrderStaffAssignmentSectionProps {
  order: any;
  onOrderUpdated?: () => void;
}

function getActivePhotoshootSchedule(order: any): any | null {
  if (
    order?.photoshootSchedule &&
    order.photoshootSchedule.status !== 'CANCELLED' &&
    order.photoshootSchedule.status !== 'EXPIRED'
  ) {
    return order.photoshootSchedule;
  }
  if (Array.isArray(order?.schedules)) {
    return (
      order.schedules.find(
        (s: any) =>
          s?.scheduleType === 'PHOTOSHOOT' &&
          s?.status !== 'CANCELLED' &&
          s?.status !== 'EXPIRED',
      ) ?? null
    );
  }
  return null;
}

export function OrderStaffAssignmentSection({
  order,
  onOrderUpdated,
}: OrderStaffAssignmentSectionProps) {
  const { show } = useToast();
  const schedule = getActivePhotoshootSchedule(order);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [candidates, setCandidates] = useState<ScheduleAvailableStaffItem[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [assignReason, setAssignReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [supervisionOpen, setSupervisionOpen] = useState(false);
  const [loadingSupervision, setLoadingSupervision] = useState(false);
  const [supervisionData, setSupervisionData] =
    useState<StaffChatSupervisionResponse | null>(null);

  useEffect(() => {
    setPickerOpen(false);
    setSupervisionOpen(false);
    setCandidates([]);
    setAssignReason('');
  }, [order?._id, schedule?._id]);

  if (!order?._id || !schedule?._id) {
    return null;
  }

  const assignedSnapshot = schedule.assignedStaffSnapshot;
  const assignedStaffId = schedule.assignedStaffId || assignedSnapshot?.staffId;
  const bookingStatus = String(order.status || '').toUpperCase();
  const canAssign = !['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(
    bookingStatus,
  );

  const handleOpenPicker = async () => {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setPickerOpen(true);
    setLoadingStaff(true);
    try {
      const res = await staffApi.getAvailableStaffForSchedule(
        order._id,
        schedule._id,
      );
      const list = Array.isArray(res?.staff) ? res.staff : [];
      setCandidates(list);
      const firstAvail =
        list.find((s) => s.available && s.isCurrentAssigned) ||
        list.find((s) => s.available) ||
        null;
      setSelectedStaffId(firstAvail?.staffId ?? '');
    } catch (err) {
      show(
        getApiErrorMessage(err, 'Không thể tải danh sách thợ chụp rảnh'),
        'error',
      );
      setPickerOpen(false);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!selectedStaffId) {
      show('Vui lòng chọn một thợ chụp phù hợp', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await staffApi.assignStaffToSchedule(order._id, schedule._id, {
        staffId: selectedStaffId,
        reason: assignReason.trim() || undefined,
      });
      show('Đã phân công thợ chụp cho ca chụp!', 'success');
      setPickerOpen(false);
      setAssignReason('');
      onOrderUpdated?.();
    } catch (err) {
      show(
        getApiErrorMessage(err, 'Không thể phân công thợ chụp'),
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSupervision = async () => {
    if (!assignedStaffId) return;
    setSupervisionOpen(true);
    setLoadingSupervision(true);
    setSupervisionData(null);
    try {
      const data = await staffApi.getStaffChatSupervision(
        order._id,
        assignedStaffId,
      );
      setSupervisionData(data);
    } catch (err) {
      show(
        getApiErrorMessage(err, 'Không thể tải lịch sử chat giám sát'),
        'error',
      );
      setSupervisionOpen(false);
    } finally {
      setLoadingSupervision(false);
    }
  };

  return (
    <View style={styles.cardBox}>
      <Text style={styles.sectionHeading}>ĐIỀU PHỐI THỢ CHỤP</Text>

      {assignedSnapshot?.name ? (
        <View style={styles.assignedRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {assignedSnapshot.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffName}>{assignedSnapshot.name}</Text>
            <Text style={styles.staffMeta}>
              {assignedSnapshot.specialty || 'Nhiếp ảnh gia Studio'}
              {assignedSnapshot.phone ? ` · ${assignedSnapshot.phone}` : ''}
            </Text>
            {(schedule.checkedInAt || schedule.shootFinishedAt) && (
              <Text style={styles.progressText}>
                {schedule.shootFinishedAt
                  ? '✓ Thợ đã báo hoàn tất ca chụp'
                  : '✓ Thợ đã check-in tại điểm chụp'}
              </Text>
            )}
            {schedule.staffFieldNote ? (
              <Text style={styles.fieldNote}>
                Ghi chú thợ: {schedule.staffFieldNote}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.unassignedBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={styles.unassignedText}>
            Chưa phân công thợ chụp phụ trách cho ca này.
          </Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        {canAssign && (
          <Pressable style={styles.assignBtn} onPress={() => void handleOpenPicker()}>
            <Ionicons name="people-outline" size={15} color="#BA0049" />
            <Text style={styles.assignBtnText}>
              {assignedStaffId ? 'Đổi thợ chụp' : 'Phân công thợ'}
            </Text>
          </Pressable>
        )}

        {Boolean(assignedStaffId) && (
          <Pressable
            style={styles.superviseBtn}
            onPress={() => void handleOpenSupervision()}
          >
            <Ionicons name="eye-outline" size={15} color="#0369A1" />
            <Text style={styles.superviseBtnText}>Giám sát chat Khách ↔ Thợ</Text>
          </Pressable>
        )}
      </View>

      {pickerOpen && (
        <View style={styles.pickerBox}>
          {loadingStaff ? (
            <ActivityIndicator size="small" color="#BA0049" />
          ) : candidates.length === 0 ? (
            <Text style={styles.emptyStaff}>
              Studio chưa có thợ chụp nào ở trạng thái hoạt động.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {candidates.map((cand) => {
                const selected = selectedStaffId === cand.staffId;
                return (
                  <Pressable
                    key={cand.staffId}
                    disabled={!cand.available}
                    onPress={() => setSelectedStaffId(cand.staffId)}
                    style={[
                      styles.candRow,
                      selected && styles.candRowSelected,
                      !cand.available && styles.candRowDisabled,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.candName}>{cand.name}</Text>
                      <Text style={styles.candMeta}>
                        {cand.available
                          ? cand.specialty || 'Sẵn sàng nhận ca'
                          : `Bận: ${cand.conflictReason || 'Trùng lịch / Nghỉ'}`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.availBadge,
                        {
                          backgroundColor: cand.available ? '#DCFCE7' : '#FEE2E2',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.availBadgeText,
                          { color: cand.available ? '#15803D' : '#B91C1C' },
                        ]}
                      >
                        {cand.available ? 'Rảnh' : 'Bận'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              <TextInput
                value={assignReason}
                onChangeText={setAssignReason}
                placeholder="Lý do phân công / đổi thợ (tùy chọn)..."
                placeholderTextColor="#94A3B8"
                style={styles.reasonInput}
              />

              <Pressable
                style={[styles.confirmAssignBtn, submitting && { opacity: 0.7 }]}
                disabled={submitting || !selectedStaffId}
                onPress={() => void handleConfirmAssign()}
              >
                <Text style={styles.confirmAssignText}>
                  {submitting ? 'Đang điều phối...' : 'Xác nhận phân công'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Read-only Chat Supervision Modal */}
      <Modal
        visible={supervisionOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSupervisionOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSupervisionOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Giám sát chat Khách ↔ Thợ
                </Text>
                <Text style={styles.modalSub}>
                  Đơn #{supervisionData?.bookingCode || order.bookingCode}
                </Text>
              </View>
              <Pressable
                onPress={() => setSupervisionOpen(false)}
                style={styles.closeIconBtn}
              >
                <Ionicons name="close" size={20} color="#475569" />
              </Pressable>
            </View>

            <View style={styles.readOnlyBanner}>
              <Ionicons name="lock-closed-outline" size={14} color="#0369A1" />
              <Text style={styles.readOnlyText}>
                Chế độ chỉ đọc — tin nhắn của Khách và Thợ không bị đánh dấu đã đọc.
              </Text>
            </View>

            {loadingSupervision ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="small" color="#BA0049" />
              </View>
            ) : !supervisionData?.messages?.length ? (
              <View style={styles.modalCenter}>
                <Text style={styles.emptyChat}>
                  {supervisionData?.note ||
                    'Khách hàng và thợ chụp chưa phát sinh tin nhắn nào trong đơn này.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.msgList}
                contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
              >
                {supervisionData.messages.map((m) => {
                  const isStaffMsg =
                    m.senderId === supervisionData.staff?.linkedUserId;
                  return (
                    <View
                      key={m._id}
                      style={[
                        styles.msgBubble,
                        isStaffMsg ? styles.msgStaff : styles.msgCustomer,
                      ]}
                    >
                      <Text style={styles.msgSender}>
                        {isStaffMsg
                          ? `Thợ: ${supervisionData.staff?.name || 'Staff'}`
                          : `Khách: ${supervisionData.customer?.fullName || 'Khách hàng'}`}
                      </Text>
                      <Text style={styles.msgBody}>
                        {m.messageText || '[Đính kèm hình ảnh]'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    gap: 10,
  },
  sectionHeading: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#8C1D40',
    letterSpacing: 0.7,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#BA0049',
  },
  staffName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#111418',
  },
  staffMeta: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F6874',
  },
  progressText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#047857',
    marginTop: 2,
  },
  fieldNote: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  unassignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
  },
  unassignedText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#B45309',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  assignBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#BA0049',
  },
  superviseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  superviseBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#0369A1',
  },
  pickerBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  emptyStaff: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#64748B',
  },
  candRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 9,
    backgroundColor: '#FFFFFF',
  },
  candRowSelected: {
    borderColor: '#BA0049',
    backgroundColor: '#FFF0F5',
  },
  candRowDisabled: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  candName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#111418',
  },
  candMeta: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F6874',
  },
  availBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  availBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#111418',
  },
  confirmAssignBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmAssignText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    maxHeight: '78%',
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#111418',
  },
  modalSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#64748B',
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 9,
  },
  readOnlyText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#0369A1',
  },
  modalCenter: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChat: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
  },
  msgList: {
    maxHeight: 340,
  },
  msgBubble: {
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  msgStaff: {
    backgroundColor: '#FFF0F5',
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  msgCustomer: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  msgSender: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
  },
  msgBody: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#111418',
  },
});
