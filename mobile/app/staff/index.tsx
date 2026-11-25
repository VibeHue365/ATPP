import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { chatApi } from '@/apis/chatApi';
import {
  staffPortalApi,
  type StaffPortalProfileResponse,
  type StaffScheduleItem,
} from '@/apis/staffPortalApi';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';
import { openExternalDirections } from '@/utils/geo';

type ScopeKey = 'today' | 'upcoming' | 'completed' | 'all';

const SCOPE_OPTIONS: Array<{ key: ScopeKey; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'completed', label: 'Đã xong' },
  { key: 'all', label: 'Tất cả' },
];

const SCHEDULE_STATUS_LABELS: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  CONFIRMED: { label: 'Đã xác nhận', bg: '#E0F2FE', text: '#0369A1' },
  DEPOSIT_PAID: { label: 'Chờ Chủ Studio duyệt', bg: '#FEF3C7', text: '#B45309' },
  PICKUP_PENDING: { label: 'Chờ khách lấy áo', bg: '#E0F2FE', text: '#0369A1' },
  PICKED_UP: { label: 'Khách đã lấy áo', bg: '#E0F2FE', text: '#0369A1' },
  IN_PROGRESS: { label: 'Đang chụp', bg: '#DCFCE7', text: '#15803D' },
  AWAITING_REVIEW: { label: 'Chờ duyệt ảnh', bg: '#F3E8FF', text: '#7E22CE' },
  COMBO_PHOTOS_APPROVED: { label: 'Khách đã duyệt ảnh', bg: '#ECFDF5', text: '#047857' },
  COMPLETED: { label: 'Hoàn tất', bg: '#ECFDF5', text: '#047857' },
};

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDateOnly(iso?: string | null): string {
  if (!iso) return 'Chưa có ngày';
  const raw = String(iso).slice(0, 10);
  const parts = raw.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return raw;
}

function getOffsetIctDateKey(offsetDays = 0): string {
  const dt = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  try {
    return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return dt.toISOString().slice(0, 10);
  }
}

export function StaffPortalScreen() {
  const { user, logout } = useAuth();
  const { show } = useToast();

  const [scope, setScope] = useState<ScopeKey>('upcoming');
  const [showBlockedSlots, setShowBlockedSlots] = useState(false);
  const [profile, setProfile] = useState<StaffPortalProfileResponse | null>(null);
  const [schedules, setSchedules] = useState<StaffScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpeningId, setChatOpeningId] = useState<string | null>(null);

  // Field check-in / finish-shoot note modal state
  const [actionModal, setActionModal] = useState<{
    mode: 'check-in' | 'finish-shoot';
    item: StaffScheduleItem;
  } | null>(null);
  const [fieldNote, setFieldNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Self-managed busy/blocked slots modal state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockDate, setBlockDate] = useState<string>(() => getOffsetIctDateKey(0));
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('08:00');
  const [blockEndTime, setBlockEndTime] = useState('12:00');
  const [blockReason, setBlockReason] = useState('');
  const [submittingBlock, setSubmittingBlock] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [profRes, schedRes] = await Promise.all([
          staffPortalApi.getProfile(),
          staffPortalApi.getMySchedules({ scope }),
        ]);
        setProfile(profRes);
        setSchedules(Array.isArray(schedRes?.items) ? schedRes.items : []);
      } catch (err) {
        show(
          getApiErrorMessage(err, 'Không thể tải lịch chụp được phân công'),
          'error',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope, show],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData(true);
  }, [loadData]);

  const handleOpenChat = async (targetUserId: string | null | undefined, label: string, key: string) => {
    if (!targetUserId) {
      show('Người nhận chưa có tài khoản trò chuyện trực tuyến', 'info');
      return;
    }
    setChatOpeningId(key);
    try {
      const room = await chatApi.createRoom(targetUserId);
      if (room?.id) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: room.id, name: label },
        } as unknown as Href);
        return;
      }
      router.push('/chat' as Href);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể mở phòng trò chuyện'), 'error');
    } finally {
      setChatOpeningId(null);
    }
  };

  const handleCallPhone = (phone?: string | null) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned) {
      void Linking.openURL(`tel:${cleaned}`);
    }
  };

  const handleOpenDirections = (item: StaffScheduleItem) => {
    const coords = item.locationSnapshot?.geo?.coordinates;
    const lng = Array.isArray(coords) && coords.length >= 2 ? Number(coords[0]) : undefined;
    const lat = Array.isArray(coords) && coords.length >= 2 ? Number(coords[1]) : undefined;
    const label =
      item.locationSnapshot?.address ||
      item.locationAddress ||
      'Địa điểm chụp TàGo';
    void openExternalDirections({ lat, lng, label, destLabel: label });
  };

  const handleSubmitFieldAction = async () => {
    if (!actionModal) return;
    setSubmittingAction(true);
    try {
      const note = fieldNote.trim() || undefined;
      if (actionModal.mode === 'check-in') {
        await staffPortalApi.checkIn(actionModal.item.scheduleId, { note });
        show('Check-in & bắt đầu ca chụp thành công!', 'success');
      } else {
        await staffPortalApi.finishShoot(actionModal.item.scheduleId, { note });
        show(
          'Đã ghi nhận hoàn tất ca chụp! Chủ Studio sẽ tải & trả ảnh chỉnh sửa cho khách.',
          'success',
        );
      }
      setActionModal(null);
      setFieldNote('');
      await loadData(true);
    } catch (err) {
      show(
        getApiErrorMessage(err, 'Không thể cập nhật trạng thái ca chụp'),
        'error',
      );
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login' as Href);
  };

  const handleOpenBlockModal = () => {
    setBlockDate(getOffsetIctDateKey(0));
    setBlockAllDay(true);
    setBlockStartTime('08:00');
    setBlockEndTime('12:00');
    setBlockReason('');
    setBlockModalOpen(true);
  };

  const handleSubmitBlockedSlot = async () => {
    const cleanDate = blockDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      show('Vui lòng nhập ngày bận theo định dạng YYYY-MM-DD', 'error');
      return;
    }
    if (!blockAllDay) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(blockStartTime.trim()) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(blockEndTime.trim())
      ) {
        show('Vui lòng nhập giờ bắt đầu/kết thúc theo định dạng HH:mm', 'error');
        return;
      }
    }
    setSubmittingBlock(true);
    try {
      await staffPortalApi.addBlockedSlot({
        date: cleanDate,
        ...(blockAllDay
          ? {}
          : {
              startTime: blockStartTime.trim(),
              endTime: blockEndTime.trim(),
            }),
        reason: blockReason.trim() || undefined,
      });
      show('Đã đăng ký lịch bận & báo tới Chủ Studio', 'success');
      setBlockModalOpen(false);
      await loadData(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể đăng ký lịch bận'), 'error');
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleRemoveBlockedSlot = async (blockId: string) => {
    setRemovingBlockId(blockId);
    try {
      await staffPortalApi.removeBlockedSlot(blockId);
      show('Đã gỡ lịch bận', 'success');
      await loadData(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể gỡ lịch bận'), 'error');
    } finally {
      setRemovingBlockId(null);
    }
  };

  const staffName = profile?.staff?.name || user?.fullName || 'Thợ chụp Studio';
  const studioName = profile?.studio?.businessName || 'Studio Đối tác TàGo';
  const blockedSlots = profile?.staff?.blockedSlots ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.staffBadge}>
              <Ionicons name="camera" size={11} color="#FFFFFF" />
              <Text style={styles.staffBadgeText}>CỔNG THỢ CHỤP</Text>
            </View>
            {profile?.staff?.specialty ? (
              <Text style={styles.specialtyText} numberOfLines={1}>
                · {profile.staff.specialty}
              </Text>
            ) : null}
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {staffName}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {studioName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Mở hộp thư"
            style={styles.iconBtn}
            onPress={() => router.push('/chat' as Href)}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#BA0049" />
          </Pressable>
          <Pressable
            accessibilityLabel="Đăng xuất"
            style={styles.logoutBtn}
            onPress={() => void handleLogout()}
          >
            <Ionicons name="log-out-outline" size={18} color="#334155" />
            <Text style={styles.logoutText}>Thoát</Text>
          </Pressable>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#BA0049" />
          <Text style={styles.loadingText}>Đang tải lịch chụp được phân công...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#BA0049"
              colors={['#BA0049']}
            />
          }
        >
          {/* Operational KPIs (No finance data exposed) */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>
                {profile?.metrics?.todayShoots ?? 0}
              </Text>
              <Text style={styles.kpiLabel}>Ca hôm nay</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>
                {profile?.metrics?.upcomingShoots ?? 0}
              </Text>
              <Text style={styles.kpiLabel}>Ca sắp tới</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiNumber, { color: '#047857' }]}>
                {profile?.metrics?.completedThisMonth ?? 0}
              </Text>
              <Text style={styles.kpiLabel}>Xong trong tháng</Text>
            </View>
          </View>

          {/* Studio Contact Strip */}
          {profile?.studio && (
            <View style={styles.studioCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.studioEyebrow}>ĐƠN VỊ CHỦ QUẢN</Text>
                <Text style={styles.studioTitle}>{profile.studio.businessName}</Text>
                {profile.studio.phone ? (
                  <Text style={styles.studioPhone}>Hotline: {profile.studio.phone}</Text>
                ) : null}
              </View>
              <View style={styles.studioActions}>
                {profile.studio.phone ? (
                  <Pressable
                    style={styles.outlinePillBtn}
                    onPress={() => handleCallPhone(profile.studio?.phone)}
                  >
                    <Ionicons name="call-outline" size={14} color="#BA0049" />
                    <Text style={styles.outlinePillText}>Gọi Studio</Text>
                  </Pressable>
                ) : null}
                {profile.studio.ownerUserId ? (
                  <Pressable
                    style={styles.primaryPillBtn}
                    disabled={chatOpeningId === 'studio'}
                    onPress={() =>
                      void handleOpenChat(
                        profile.studio?.ownerUserId,
                        profile.studio?.businessName || 'Chủ Studio',
                        'studio',
                      )
                    }
                  >
                    <Ionicons name="chatbubble-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.primaryPillText}>Nhắn Chủ Studio</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          {/* Scope Tabs & Off-Days Toggle */}
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeRow}
            >
              {SCOPE_OPTIONS.map((opt) => {
                const active = !showBlockedSlots && scope === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.scopePill, active && styles.scopePillActive]}
                    onPress={() => {
                      setShowBlockedSlots(false);
                      setScope(opt.key);
                    }}
                  >
                    <Text style={[styles.scopeText, active && styles.scopeTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                style={[
                  styles.scopePill,
                  showBlockedSlots && styles.scopePillActive,
                ]}
                onPress={() => setShowBlockedSlots((v) => !v)}
              >
                <Text
                  style={[
                    styles.scopeText,
                    showBlockedSlots && styles.scopeTextActive,
                  ]}
                >
                  Lịch nghỉ ({blockedSlots.length})
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          {showBlockedSlots ? (
            <View style={styles.sectionBox}>
              <View style={styles.blockSectionHeader}>
                <Text style={styles.sectionTitle}>LỊCH NGHỈ / BẬN ĐÃ ĐĂNG KÝ</Text>
                <Pressable
                  style={styles.addBlockBtn}
                  onPress={handleOpenBlockModal}
                >
                  <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.addBlockBtnText}>Báo lịch bận</Text>
                </Pressable>
              </View>
              {blockedSlots.length === 0 ? (
                <Text style={styles.emptySub}>
                  Bạn chưa có lịch bận nào. Bấm "Báo lịch bận" để tự khóa khung
                  giờ rảnh và thông báo ngay cho Chủ Studio.
                </Text>
              ) : (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {blockedSlots.map((b) => (
                    <View key={b._id} style={styles.blockRow}>
                      <Ionicons name="calendar-clear-outline" size={17} color="#B45309" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blockDate}>
                          {formatDateOnly(b.date)}
                          {b.startTime && b.endTime
                            ? ` · ${b.startTime}–${b.endTime}`
                            : ' · Cả ngày'}
                        </Text>
                        {b.reason ? (
                          <Text style={styles.blockReason}>{b.reason}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityLabel="Gỡ lịch bận"
                        disabled={removingBlockId === b._id}
                        onPress={() => void handleRemoveBlockedSlot(b._id)}
                        style={styles.removeBlockBtn}
                      >
                        <Ionicons name="trash-outline" size={15} color="#B45309" />
                        <Text style={styles.removeBlockText}>Gỡ</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : schedules.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={34} color="#BA0049" />
              <Text style={styles.emptyTitle}>Chưa có ca chụp nào ở mục này</Text>
              <Text style={styles.emptySub}>
                Các ca chụp được Chủ Studio phân công cho bạn sẽ hiển thị tại đây.
              </Text>
            </View>
          ) : (
            schedules.map((item) => {
              const badge =
                item.shootFinishedAt && item.bookingStatus === 'IN_PROGRESS'
                  ? { label: 'Đã xong chụp · Chờ Studio trả ảnh', bg: '#ECFDF5', text: '#047857' }
                  : SCHEDULE_STATUS_LABELS[item.bookingStatus] ?? {
                      label: item.bookingStatus,
                      bg: '#F1F5F9',
                      text: '#334155',
                    };

              return (
                <View key={item.scheduleId} style={styles.scheduleCard}>
                  {/* Top row */}
                  <View style={styles.cardTopRow}>
                    <Text style={styles.bookingCode}>#{item.bookingCode}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.packageTitle}>{item.packageName}</Text>

                  {/* Date & Time */}
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={15} color="#BA0049" />
                    <Text style={styles.infoText}>
                      {formatDateOnly(item.providerLocalDate || item.startsAt)}
                      {item.timeSlot ? ` · ${item.timeSlot}` : ''}
                    </Text>
                  </View>

                  {/* Location + Directions */}
                  <View style={styles.locationBox}>
                    <Ionicons name="location-outline" size={16} color="#BA0049" />
                    <Text style={styles.locationText} numberOfLines={2}>
                      {item.locationSnapshot?.address ||
                        item.locationAddress ||
                        'Theo thỏa thuận cùng khách hàng'}
                    </Text>
                    <Pressable
                      style={styles.mapBtn}
                      onPress={() => handleOpenDirections(item)}
                    >
                      <Ionicons name="navigate" size={13} color="#FFFFFF" />
                      <Text style={styles.mapBtnText}>Chỉ đường</Text>
                    </Pressable>
                  </View>

                  {/* Customer Contact Row */}
                  {item.customer && (
                    <View style={styles.customerBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerEyebrow}>KHÁCH HÀNG</Text>
                        <Text style={styles.customerName}>{item.customer.fullName}</Text>
                        {item.customer.phone ? (
                          <Text style={styles.customerPhone}>{item.customer.phone}</Text>
                        ) : null}
                      </View>
                      <View style={styles.customerBtns}>
                        {item.customer.phone ? (
                          <Pressable
                            accessibilityLabel={`Gọi ${item.customer.fullName}`}
                            style={styles.iconCircleBtn}
                            onPress={() => handleCallPhone(item.customer?.phone)}
                          >
                            <Ionicons name="call-outline" size={16} color="#BA0049" />
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityLabel={`Chat với ${item.customer.fullName}`}
                          style={[
                            styles.chatCustomerBtn,
                            !item.customer.userId && { opacity: 0.45 },
                          ]}
                          disabled={
                            !item.customer.userId ||
                            chatOpeningId === `cust-${item.scheduleId}`
                          }
                          onPress={() =>
                            void handleOpenChat(
                              item.customer?.userId,
                              item.customer?.fullName || 'Khách hàng',
                              `cust-${item.scheduleId}`,
                            )
                          }
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={15} color="#FFFFFF" />
                          <Text style={styles.chatCustomerText}>Chat khách</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Notes & Field Timestamps */}
                  {(item.customerNote || item.scheduleNotes || item.staffFieldNote) && (
                    <View style={styles.notesWrap}>
                      {item.customerNote ? (
                        <Text style={styles.noteLine}>
                          Ghi chú khách: {item.customerNote}
                        </Text>
                      ) : null}
                      {item.scheduleNotes ? (
                        <Text style={styles.noteLine}>
                          Ghi chú Studio: {item.scheduleNotes}
                        </Text>
                      ) : null}
                      {item.staffFieldNote ? (
                        <Text style={styles.noteLine}>
                          Ghi chú hiện trường: {item.staffFieldNote}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {(item.checkedInAt || item.shootFinishedAt) && (
                    <View style={styles.timestampRow}>
                      {item.checkedInAt ? (
                        <View style={styles.tsPill}>
                          <Ionicons name="checkmark-circle" size={13} color="#047857" />
                          <Text style={styles.tsText}>
                            Check-in: {formatDateTimeShort(item.checkedInAt)}
                          </Text>
                        </View>
                      ) : null}
                      {item.shootFinishedAt ? (
                        <View style={styles.tsPill}>
                          <Ionicons name="camera" size={13} color="#1D4ED8" />
                          <Text style={[styles.tsText, { color: '#1D4ED8' }]}>
                            Xong chụp: {formatDateTimeShort(item.shootFinishedAt)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Field Action Buttons / Approval Waiting Banner */}
                  {(item.canCheckIn ||
                    item.canFinishShoot ||
                    (!item.shootFinishedAt &&
                      (item.checkInBlockedReason ||
                        item.bookingStatus === 'DEPOSIT_PAID'))) && (
                    <View style={styles.actionFooter}>
                      {item.canCheckIn && (
                        <Pressable
                          style={styles.checkInBtn}
                          onPress={() => {
                            setFieldNote('');
                            setActionModal({ mode: 'check-in', item });
                          }}
                        >
                          <Ionicons name="play-circle-outline" size={17} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>
                            Check-in & Bắt đầu chụp
                          </Text>
                        </Pressable>
                      )}
                      {!item.canCheckIn &&
                        !item.canFinishShoot &&
                        !item.shootFinishedAt &&
                        (item.checkInBlockedReason ||
                          item.bookingStatus === 'DEPOSIT_PAID') && (
                          <View style={styles.waitingApprovalBox}>
                            <Ionicons name="time-outline" size={16} color="#B45309" />
                            <Text style={styles.waitingApprovalText}>
                              {item.checkInBlockedReason ||
                                'Chờ Chủ Studio duyệt xác nhận lịch chụp trước khi check-in.'}
                            </Text>
                          </View>
                        )}
                      {item.canFinishShoot && (
                        <Pressable
                          style={styles.finishBtn}
                          onPress={() => {
                            setFieldNote('');
                            setActionModal({ mode: 'finish-shoot', item });
                          }}
                        >
                          <Ionicons name="checkmark-done-outline" size={17} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>Hoàn tất ca chụp</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Field Action Confirmation Modal */}
      <Modal
        visible={Boolean(actionModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActionModal(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {actionModal?.mode === 'check-in'
                ? 'Xác nhận Check-in & Bắt đầu chụp'
                : 'Xác nhận Hoàn tất buổi chụp'}
            </Text>
            <Text style={styles.modalSub}>
              Đơn #{actionModal?.item.bookingCode} —{' '}
              {actionModal?.item.packageName}
            </Text>

            {actionModal?.mode === 'finish-shoot' && (
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={16} color="#0369A1" />
                <Text style={styles.noticeText}>
                  Sau khi xác nhận xong chụp, Chủ Studio sẽ đảm nhận hậu kỳ & giao file ảnh cho khách.
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>GHI CHÚ HIỆN TRƯỜNG (TÙY CHỌN)</Text>
            <TextInput
              value={fieldNote}
              onChangeText={setFieldNote}
              placeholder={
                actionModal?.mode === 'check-in'
                  ? 'Ví dụ: Đã gặp khách tại cổng Ngọ Môn...'
                  : 'Ví dụ: Đã chụp đủ 150 file gốc, bàn giao thẻ nhớ cho Studio...'
              }
              placeholderTextColor="#94A3B8"
              style={styles.noteInput}
              multiline
              maxLength={400}
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={submittingAction}
                onPress={() => setActionModal(null)}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, submittingAction && { opacity: 0.7 }]}
                disabled={submittingAction}
                onPress={() => void handleSubmitFieldAction()}
              >
                <Text style={styles.modalConfirmText}>
                  {submittingAction ? 'Đang gửi...' : 'Xác nhận'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Self-block Busy Slot Modal */}
      <Modal
        visible={blockModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBlockModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đăng ký lịch bận / nghỉ phép</Text>
            <Text style={styles.modalSub}>
              Khung giờ bận sẽ tự khóa khỏi lịch trống và gửi thông báo về Chủ Studio.
            </Text>

            <View style={styles.presetRow}>
              {[
                { label: 'Hôm nay', offset: 0 },
                { label: 'Ngày mai', offset: 1 },
                { label: 'Ngày kia', offset: 2 },
              ].map((preset) => {
                const targetKey = getOffsetIctDateKey(preset.offset);
                const active = blockDate === targetKey;
                return (
                  <Pressable
                    key={preset.label}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => setBlockDate(targetKey)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        active && styles.presetChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>NGÀY BẬN (YYYY-MM-DD) *</Text>
            <TextInput
              value={blockDate}
              onChangeText={setBlockDate}
              placeholder="2026-12-01"
              placeholderTextColor="#94A3B8"
              style={styles.singleLineInput}
              autoCapitalize="none"
            />

            <View style={styles.presetRow}>
              <Pressable
                style={[styles.presetChip, blockAllDay && styles.presetChipActive]}
                onPress={() => setBlockAllDay(true)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    blockAllDay && styles.presetChipTextActive,
                  ]}
                >
                  Cả ngày
                </Text>
              </Pressable>
              <Pressable
                style={[styles.presetChip, !blockAllDay && styles.presetChipActive]}
                onPress={() => setBlockAllDay(false)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    !blockAllDay && styles.presetChipTextActive,
                  ]}
                >
                  Theo khung giờ
                </Text>
              </Pressable>
            </View>

            {!blockAllDay && (
              <View style={styles.timeRangeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>TỪ GIỜ (HH:mm)</Text>
                  <TextInput
                    value={blockStartTime}
                    onChangeText={setBlockStartTime}
                    placeholder="08:00"
                    placeholderTextColor="#94A3B8"
                    style={styles.singleLineInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ĐẾN GIỜ (HH:mm)</Text>
                  <TextInput
                    value={blockEndTime}
                    onChangeText={setBlockEndTime}
                    placeholder="12:00"
                    placeholderTextColor="#94A3B8"
                    style={styles.singleLineInput}
                  />
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>LÝ DO (TÙY CHỌN)</Text>
            <TextInput
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="VD: Bận việc gia đình, bảo dưỡng thiết bị..."
              placeholderTextColor="#94A3B8"
              style={styles.singleLineInput}
              maxLength={300}
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={submittingBlock}
                onPress={() => setBlockModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, submittingBlock && { opacity: 0.7 }]}
                disabled={submittingBlock}
                onPress={() => void handleSubmitBlockedSlot()}
              >
                <Text style={styles.modalConfirmText}>
                  {submittingBlock ? 'Đang lưu...' : 'Xác nhận lịch bận'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default StaffPortalScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECE3E7',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
  },
  staffBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  specialtyText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#64748B',
    flexShrink: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    color: '#111418',
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F6874',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
  },
  logoutText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#334155',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  loadingText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#5F6874',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECE3E7',
  },
  kpiNumber: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 20,
    color: '#BA0049',
  },
  kpiLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  studioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE3E7',
    gap: 10,
  },
  studioEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#BA0049',
    letterSpacing: 0.7,
  },
  studioTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#111418',
    marginTop: 2,
  },
  studioPhone: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F6874',
    marginTop: 2,
  },
  studioActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outlinePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#F3C4D5',
    backgroundColor: '#FFF0F5',
  },
  outlinePillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#BA0049',
  },
  primaryPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#BA0049',
  },
  primaryPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  filterSection: {
    marginVertical: 2,
  },
  scopeRow: {
    gap: 8,
    paddingVertical: 2,
  },
  scopePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scopePillActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  scopeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#475569',
  },
  scopeTextActive: {
    color: '#FFFFFF',
  },
  sectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE3E7',
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.6,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  blockDate: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#92400E',
  },
  blockReason: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECE3E7',
  },
  emptyTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#111418',
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE3E7',
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookingCode: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#BA0049',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
  },
  packageTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15.5,
    color: '#111418',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#334155',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
  },
  locationText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 17,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  mapBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  customerEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  customerName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#111418',
  },
  customerPhone: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#475569',
  },
  customerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  chatCustomerText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  notesWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 9,
    gap: 4,
  },
  noteLine: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  timestampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  tsText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#047857',
  },
  actionFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  checkInBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#BA0049',
  },
  finishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#047857',
  },
  actionBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#111418',
  },
  modalSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: '#475569',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 10,
  },
  noticeText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 17,
  },
  inputLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 4,
  },
  noteInput: {
    minHeight: 76,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#111418',
    textAlignVertical: 'top',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#475569',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  blockSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  addBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addBlockBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  removeBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  removeBlockText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#92400E',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: '#FFF0F5',
    borderColor: '#BA0049',
  },
  presetChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#BA0049',
  },
  singleLineInput: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#111418',
  },
  timeRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  waitingApprovalBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  waitingApprovalText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
});
