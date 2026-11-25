import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  staffApi,
  type ProviderStaffItem,
  type ProviderStaffSummary,
} from '@/apis/staffApi';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

function formatBlockDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = String(dateStr).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
}

export default function ProviderStaffManagementScreen() {
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<ProviderStaffSummary | null>(null);
  const [staffList, setStaffList] = useState<ProviderStaffItem[]>([]);

  // Studio capacity settings inputs
  const [maxConcurrentInput, setMaxConcurrentInput] = useState('');
  const [maxDailyInput, setMaxDailyInput] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Add / Edit staff modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ProviderStaffItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formCreateAccount, setFormCreateAccount] = useState(false);
  const [formAccountEmail, setFormAccountEmail] = useState('');
  const [formAccountPassword, setFormAccountPassword] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);

  // Add off-day block modal
  const [blockModalStaff, setBlockModalStaff] = useState<ProviderStaffItem | null>(
    null,
  );
  const [blockDate, setBlockDate] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  // Provision account modal
  const [accountModalStaff, setAccountModalStaff] =
    useState<ProviderStaffItem | null>(null);
  const [provEmail, setProvEmail] = useState('');
  const [provPassword, setProvPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Temporary password one-time modal
  const [credentialInfo, setCredentialInfo] = useState<{
    staffName: string;
    email?: string | null;
    temporaryPassword: string;
    title: string;
  } | null>(null);

  const loadStaff = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await staffApi.listMine();
        setSummary(res.summary);
        setStaffList(Array.isArray(res.items) ? res.items : []);
        setMaxConcurrentInput(
          res.summary?.maxConcurrentSessions != null
            ? String(res.summary.maxConcurrentSessions)
            : '',
        );
        setMaxDailyInput(
          res.summary?.maxDailySessions != null
            ? String(res.summary.maxDailySessions)
            : '',
        );
      } catch (err) {
        show(
          getApiErrorMessage(err, 'Không thể tải danh sách thợ chụp'),
          'error',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show],
  );

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const handleSaveCapacity = async () => {
    const concTrim = maxConcurrentInput.trim();
    const dailyTrim = maxDailyInput.trim();
    const maxConcurrent = concTrim ? Number(concTrim) : null;
    const maxDaily = dailyTrim ? Number(dailyTrim) : null;

    if (concTrim && (!Number.isInteger(maxConcurrent) || (maxConcurrent ?? 0) < 1)) {
      show('Số ca trùng giờ tối đa phải là số nguyên >= 1 hoặc để trống', 'error');
      return;
    }
    if (dailyTrim && (!Number.isInteger(maxDaily) || (maxDaily ?? 0) < 1)) {
      show('Giới hạn ca/ngày phải là số nguyên >= 1 hoặc để trống', 'error');
      return;
    }

    setSavingCapacity(true);
    try {
      await staffApi.updateCapacity({
        maxConcurrentSessions: maxConcurrent,
        maxDailySessions: maxDaily,
      });
      show('Đã cập nhật năng lực tiếp nhận của Studio', 'success');
      await loadStaff(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể lưu năng lực'), 'error');
    } finally {
      setSavingCapacity(false);
    }
  };

  const openCreateModal = () => {
    setEditingStaff(null);
    setFormName('');
    setFormPhone('');
    setFormSpecialty('');
    setFormExperience('');
    setFormBio('');
    setFormNote('');
    setFormCreateAccount(false);
    setFormAccountEmail('');
    setFormAccountPassword('');
    setStaffModalOpen(true);
  };

  const openEditModal = (item: ProviderStaffItem) => {
    setEditingStaff(item);
    setFormName(item.name || '');
    setFormPhone(item.phone || '');
    setFormSpecialty(item.specialty || '');
    setFormExperience(
      item.experienceYears != null ? String(item.experienceYears) : '',
    );
    setFormBio(item.bio || '');
    setFormNote(item.internalNote || '');
    setFormCreateAccount(false);
    setFormAccountEmail('');
    setFormAccountPassword('');
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!formName.trim() || !formPhone.trim()) {
      show('Vui lòng nhập đầy đủ họ tên và số điện thoại thợ chụp', 'error');
      return;
    }
    if (!editingStaff && formCreateAccount && !formAccountEmail.trim()) {
      show('Vui lòng nhập Email để cấp tài khoản đăng nhập cho thợ', 'error');
      return;
    }

    setSavingStaff(true);
    try {
      const exp = formExperience.trim() ? Number(formExperience.trim()) : null;
      if (editingStaff) {
        await staffApi.update(editingStaff._id, {
          name: formName.trim(),
          phone: formPhone.trim(),
          specialty: formSpecialty.trim() || null,
          experienceYears: Number.isFinite(exp) ? exp : null,
          bio: formBio.trim() || null,
          internalNote: formNote.trim() || null,
        });
        show(`Đã cập nhật thông tin ${formName.trim()}`, 'success');
      } else {
        const created = await staffApi.create({
          name: formName.trim(),
          phone: formPhone.trim(),
          specialty: formSpecialty.trim() || null,
          experienceYears: Number.isFinite(exp) ? exp : null,
          bio: formBio.trim() || null,
          internalNote: formNote.trim() || null,
          ...(formCreateAccount
            ? {
                createAccount: true,
                email: formAccountEmail.trim().toLowerCase(),
                ...(formAccountPassword.trim()
                  ? { password: formAccountPassword.trim() }
                  : {}),
              }
            : {}),
        });
        show(`Đã thêm thợ chụp ${created.name}`, 'success');
        if (created.temporaryPassword) {
          setCredentialInfo({
            title: 'Đã tạo tài khoản đăng nhập cho thợ',
            staffName: created.name,
            email: created.staffAccount?.email || formAccountEmail.trim(),
            temporaryPassword: created.temporaryPassword,
          });
        }
      }
      setStaffModalOpen(false);
      await loadStaff(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể lưu thông tin thợ chụp'), 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleToggleStaffStatus = (item: ProviderStaffItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    TagoAlert.alert(
      nextStatus === 'INACTIVE' ? 'Tạm ngưng nhận lịch' : 'Kích hoạt lại thợ chụp',
      nextStatus === 'INACTIVE'
        ? `Tạm ngưng nhận lịch mới cho ${item.name}? Nếu thợ còn ca sắp tới chưa hoàn tất, hệ thống sẽ yêu cầu đổi thợ trước.`
        : `Kích hoạt lại ${item.name} để tham gia tiếp nhận ca chụp?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: nextStatus === 'INACTIVE' ? 'Tạm ngưng' : 'Kích hoạt',
          onPress: async () => {
            try {
              await staffApi.updateStatus(item._id, nextStatus);
              show(
                nextStatus === 'ACTIVE'
                  ? `Đã kích hoạt lại ${item.name}`
                  : `Đã tạm ngưng ${item.name}`,
                'success',
              );
              await loadStaff(true);
            } catch (err) {
              show(
                getApiErrorMessage(err, 'Không thể đổi trạng thái thợ chụp'),
                'error',
              );
            }
          },
        },
      ],
    );
  };

  const handleSubmitBlock = async () => {
    if (!blockModalStaff) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate.trim())) {
      show('Vui lòng nhập ngày nghỉ theo định dạng YYYY-MM-DD', 'error');
      return;
    }
    setSavingBlock(true);
    try {
      await staffApi.addBlock(blockModalStaff._id, {
        date: blockDate.trim(),
        startTime: blockStart.trim() || null,
        endTime: blockEnd.trim() || null,
        reason: blockReason.trim() || null,
      });
      show(`Đã thêm lịch nghỉ cho ${blockModalStaff.name}`, 'success');
      setBlockModalStaff(null);
      setBlockDate('');
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      await loadStaff(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể thêm lịch nghỉ'), 'error');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleRemoveBlock = async (staffId: string, blockId: string) => {
    try {
      await staffApi.removeBlock(staffId, blockId);
      show('Đã xóa lịch nghỉ', 'success');
      await loadStaff(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể xóa lịch nghỉ'), 'error');
    }
  };

  const handleProvisionAccount = async () => {
    if (!accountModalStaff || !provEmail.trim()) {
      show('Vui lòng nhập Email tài khoản cho thợ', 'error');
      return;
    }
    setSavingAccount(true);
    try {
      const res = await staffApi.provisionAccount(accountModalStaff._id, {
        email: provEmail.trim().toLowerCase(),
        ...(provPassword.trim() ? { password: provPassword.trim() } : {}),
      });
      setAccountModalStaff(null);
      setProvEmail('');
      setProvPassword('');
      if (res.temporaryPassword) {
        setCredentialInfo({
          title: 'Đã cấp tài khoản đăng nhập',
          staffName: accountModalStaff.name,
          email: res.email,
          temporaryPassword: res.temporaryPassword,
        });
      } else {
        show(`Đã cấp tài khoản ${res.email}`, 'success');
      }
      await loadStaff(true);
    } catch (err) {
      show(getApiErrorMessage(err, 'Không thể cấp tài khoản cho thợ'), 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleResetPassword = (item: ProviderStaffItem) => {
    TagoAlert.alert(
      'Đặt lại mật khẩu thợ chụp',
      `Tạo mật khẩu tạm mới cho tài khoản ${item.staffAccount?.email || item.name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đặt lại mật khẩu',
          onPress: async () => {
            try {
              const res = await staffApi.resetPassword(item._id, {});
              if (res.temporaryPassword) {
                setCredentialInfo({
                  title: 'Mật khẩu tạm thời mới',
                  staffName: item.name,
                  email: item.staffAccount?.email,
                  temporaryPassword: res.temporaryPassword,
                });
              } else {
                show('Đã đặt lại mật khẩu thành công', 'success');
              }
            } catch (err) {
              show(getApiErrorMessage(err, 'Không thể đặt lại mật khẩu'), 'error');
            }
          },
        },
      ],
    );
  };

  const handleToggleLockAccount = (item: ProviderStaffItem) => {
    const isLocked = item.staffAccount?.status === 'SUSPENDED';
    const nextLocked = !isLocked;
    TagoAlert.alert(
      nextLocked ? 'Khóa tài khoản thợ chụp' : 'Mở khóa tài khoản thợ chụp',
      nextLocked
        ? `Khóa tài khoản ${item.staffAccount?.email || item.name}? Thợ sẽ bị đăng xuất ngay lập tức khỏi mọi thiết bị.`
        : `Mở khóa để ${item.name} đăng nhập lại?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: nextLocked ? 'Khóa ngay' : 'Mở khóa',
          style: nextLocked ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await staffApi.toggleAccountLock(item._id, {
                locked: nextLocked,
                reason: nextLocked ? 'Chủ Studio khóa tài khoản trên mobile' : undefined,
              });
              show(
                nextLocked ? 'Đã khóa tài khoản thợ chụp' : 'Đã mở khóa tài khoản',
                'success',
              );
              await loadStaff(true);
            } catch (err) {
              show(
                getApiErrorMessage(err, 'Không thể cập nhật trạng thái tài khoản'),
                'error',
              );
            }
          },
        },
      ],
    );
  };

  const handleShareCredential = async () => {
    if (!credentialInfo) return;
    try {
      await Share.share({
        message: `Thông tin đăng nhập TàGo Cổng Thợ chụp (${credentialInfo.staffName}):\nEmail: ${credentialInfo.email ?? 'Đã cấp'}\nMật khẩu tạm: ${credentialInfo.temporaryPassword}\nVui lòng đổi mật khẩu sau khi đăng nhập.`,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#111418" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ĐIỀU PHỐI STUDIO</Text>
          <Text style={styles.headerTitle}>Quản lý Thợ chụp & Năng lực</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openCreateModal}>
          <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Thêm thợ</Text>
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#BA0049" />
          <Text style={styles.loadingText}>Đang tải đội ngũ Studio...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadStaff(true);
              }}
              tintColor="#BA0049"
              colors={['#BA0049']}
            />
          }
        >
          {/* KPI Grid */}
          {summary && (
            <View style={styles.kpiGrid}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiNum}>
                  {summary.activeStaff}/{summary.totalStaff}
                </Text>
                <Text style={styles.kpiLbl}>Thợ đang hoạt động</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiNum}>{summary.effectiveCapacity}</Text>
                <Text style={styles.kpiLbl}>Ca trùng giờ tối đa</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiNum}>{summary.activeTodayCount}</Text>
                <Text style={styles.kpiLbl}>Ca chụp hôm nay</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text
                  style={[
                    styles.kpiNum,
                    summary.pendingAssignmentCount > 0 && { color: '#D97706' },
                  ]}
                >
                  {summary.pendingAssignmentCount}
                </Text>
                <Text style={styles.kpiLbl}>Đơn chưa phân thợ</Text>
              </View>
            </View>
          )}

          {/* Capacity Settings */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>NĂNG LỰC TIẾP NHẬN SONG SONG</Text>
            <Text style={styles.helper}>
              Khống chế số đơn trùng giờ tối đa Studio nhận cùng lúc (hữu ích khi muốn giữ biên dự phòng dù có nhiều thợ).
            </Text>

            <View style={styles.capInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLbl}>Tối đa ca trùng giờ</Text>
                <TextInput
                  value={maxConcurrentInput}
                  onChangeText={setMaxConcurrentInput}
                  keyboardType="number-pad"
                  placeholder="Theo số thợ ACTIVE"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLbl}>Giới hạn ca/ngày</Text>
                <TextInput
                  value={maxDailyInput}
                  onChangeText={setMaxDailyInput}
                  keyboardType="number-pad"
                  placeholder="Không giới hạn"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
            </View>

            <Pressable
              style={[styles.saveCapBtn, savingCapacity && { opacity: 0.7 }]}
              disabled={savingCapacity}
              onPress={() => void handleSaveCapacity()}
            >
              <Ionicons name="save-outline" size={16} color="#FFFFFF" />
              <Text style={styles.saveCapText}>
                {savingCapacity ? 'Đang lưu...' : 'Lưu năng lực tiếp nhận'}
              </Text>
            </Pressable>
          </View>

          {/* Staff Cards */}
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>
              DANH SÁCH THỢ CHỤP ({staffList.length})
            </Text>
          </View>

          {staffList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={34} color="#BA0049" />
              <Text style={styles.emptyTitle}>Studio chưa thêm thợ chụp nào</Text>
              <Text style={styles.emptySub}>
                Thêm các nhiếp ảnh gia trong ekip để mở khóa nhận nhiều đơn trùng giờ và phân công lịch chụp riêng.
              </Text>
              <Pressable style={styles.emptyAddBtn} onPress={openCreateModal}>
                <Text style={styles.addBtnText}>+ Thêm thợ chụp đầu tiên</Text>
              </Pressable>
            </View>
          ) : (
            staffList.map((item) => {
              const isActive = item.status === 'ACTIVE';
              const isAccountLocked = item.staffAccount?.status === 'SUSPENDED';

              return (
                <View key={item._id} style={styles.staffCard}>
                  {/* Staff Header */}
                  <View style={styles.staffTopRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>
                        {(item.name || 'T').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={styles.staffName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: isActive ? '#15803D' : '#64748B' },
                            ]}
                          >
                            {isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.staffSub}>
                        {item.phone}
                        {item.specialty ? ` · ${item.specialty}` : ''}
                        {item.experienceYears
                          ? ` · ${item.experienceYears} năm KN`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Account status strip */}
                  <View style={styles.accountRow}>
                    <Ionicons
                      name={
                        item.linkedUserId
                          ? isAccountLocked
                            ? 'lock-closed'
                            : 'shield-checkmark'
                          : 'person-circle-outline'
                      }
                      size={15}
                      color={
                        item.linkedUserId
                          ? isAccountLocked
                            ? '#DC2626'
                            : '#047857'
                          : '#64748B'
                      }
                    />
                    <Text style={styles.accountText} numberOfLines={1}>
                      {item.linkedUserId
                        ? `TK Thợ: ${item.staffAccount?.email || 'Đã liên kết'}${
                            isAccountLocked ? ' (Đang khóa)' : ''
                          }`
                        : 'Chưa cấp tài khoản đăng nhập riêng'}
                    </Text>
                  </View>

                  {/* Metrics mini grid */}
                  <View style={styles.metricsRow}>
                    <Text style={styles.metricChip}>
                      Hôm nay: {item.metrics?.todayShoots ?? 0}
                    </Text>
                    <Text style={styles.metricChip}>
                      Sắp tới: {item.metrics?.upcomingShoots ?? 0}
                    </Text>
                    <Text style={styles.metricChip}>
                      Hoàn tất: {item.metrics?.completedShoots ?? 0}
                    </Text>
                    {item.metrics?.averageRating != null && (
                      <Text style={styles.metricChip}>
                        ★ {item.metrics.averageRating.toFixed(1)}
                      </Text>
                    )}
                  </View>

                  {/* Off-days list */}
                  {item.blockedSlots?.length > 0 && (
                    <View style={styles.blocksWrap}>
                      <Text style={styles.blocksTitle}>Lịch nghỉ đăng ký:</Text>
                      <View style={styles.blocksRow}>
                        {item.blockedSlots.map((b) => (
                          <View key={b._id} style={styles.blockChip}>
                            <Text style={styles.blockChipText}>
                              {formatBlockDate(b.date)}
                              {b.startTime && b.endTime
                                ? ` ${b.startTime}-${b.endTime}`
                                : ''}
                            </Text>
                            <Pressable
                              onPress={() => void handleRemoveBlock(item._id, b._id)}
                              hitSlop={6}
                            >
                              <Ionicons name="close-circle" size={14} color="#B45309" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.staffActionsRow}>
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => openEditModal(item)}
                    >
                      <Ionicons name="create-outline" size={14} color="#334155" />
                      <Text style={styles.smallBtnText}>Sửa</Text>
                    </Pressable>

                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => {
                        setBlockModalStaff(item);
                        setBlockDate(new Date().toISOString().slice(0, 10));
                        setBlockStart('');
                        setBlockEnd('');
                        setBlockReason('');
                      }}
                    >
                      <Ionicons name="calendar-outline" size={14} color="#B45309" />
                      <Text style={styles.smallBtnText}>Lịch nghỉ</Text>
                    </Pressable>

                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => handleToggleStaffStatus(item)}
                    >
                      <Ionicons
                        name={isActive ? 'pause-outline' : 'play-outline'}
                        size={14}
                        color={isActive ? '#DC2626' : '#047857'}
                      />
                      <Text style={styles.smallBtnText}>
                        {isActive ? 'Tạm ngưng' : 'Kích hoạt'}
                      </Text>
                    </Pressable>

                    {!item.linkedUserId ? (
                      <Pressable
                        style={styles.accentSmallBtn}
                        onPress={() => {
                          setAccountModalStaff(item);
                          setProvEmail('');
                          setProvPassword('');
                        }}
                      >
                        <Ionicons name="key-outline" size={14} color="#BA0049" />
                        <Text style={styles.accentSmallBtnText}>Cấp TK</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable
                          style={styles.smallBtn}
                          onPress={() => handleResetPassword(item)}
                        >
                          <Ionicons name="refresh-outline" size={14} color="#0369A1" />
                          <Text style={styles.smallBtnText}>Đặt lại MK</Text>
                        </Pressable>
                        <Pressable
                          style={styles.smallBtn}
                          onPress={() => handleToggleLockAccount(item)}
                        >
                          <Ionicons
                            name={
                              isAccountLocked
                                ? 'lock-open-outline'
                                : 'lock-closed-outline'
                            }
                            size={14}
                            color={isAccountLocked ? '#047857' : '#DC2626'}
                          />
                          <Text style={styles.smallBtnText}>
                            {isAccountLocked ? 'Mở khóa' : 'Khóa TK'}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal 1: Add / Edit Staff */}
      <Modal
        visible={staffModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStaffModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setStaffModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {editingStaff ? `Sửa thông tin ${editingStaff.name}` : 'Thêm thợ chụp mới'}
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLbl}>Họ & tên *</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="Nguyễn Minh Tuấn"
                style={styles.input}
              />

              <Text style={styles.inputLbl}>Số điện thoại *</Text>
              <TextInput
                value={formPhone}
                onChangeText={setFormPhone}
                keyboardType="phone-pad"
                placeholder="0905123456"
                style={styles.input}
              />

              <Text style={styles.inputLbl}>Chuyên môn</Text>
              <TextInput
                value={formSpecialty}
                onChangeText={setFormSpecialty}
                placeholder="Cổ phục Đại Nội, Hoàng hôn sông Hương"
                style={styles.input}
              />

              <Text style={styles.inputLbl}>Số năm kinh nghiệm</Text>
              <TextInput
                value={formExperience}
                onChangeText={setFormExperience}
                keyboardType="number-pad"
                placeholder="4"
                style={styles.input}
              />

              <Text style={styles.inputLbl}>Giới thiệu công khai cho khách</Text>
              <TextInput
                value={formBio}
                onChangeText={setFormBio}
                placeholder="Chụp tự nhiên, hướng dẫn tạo dáng nhiệt tình..."
                multiline
                style={[styles.input, { minHeight: 60 }]}
              />

              <Text style={styles.inputLbl}>Ghi chú nội bộ Studio</Text>
              <TextInput
                value={formNote}
                onChangeText={setFormNote}
                placeholder="Chỉ Chủ Studio xem được..."
                style={styles.input}
              />

              {!editingStaff && (
                <View style={styles.toggleBox}>
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>
                        Cấp tài khoản đăng nhập (STAFF)
                      </Text>
                      <Text style={styles.toggleSub}>
                        Cho phép thợ tự đăng nhập xem lịch được phân công & chat khách.
                      </Text>
                    </View>
                    <Switch
                      value={formCreateAccount}
                      onValueChange={setFormCreateAccount}
                      trackColor={{ true: '#F48FB1', false: '#CBD5E1' }}
                      thumbColor={formCreateAccount ? '#BA0049' : '#FFFFFF'}
                    />
                  </View>

                  {formCreateAccount && (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <Text style={styles.inputLbl}>Email đăng nhập *</Text>
                      <TextInput
                        value={formAccountEmail}
                        onChangeText={setFormAccountEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="thochup@studio.vn"
                        style={styles.input}
                      />
                      <Text style={styles.inputLbl}>
                        Mật khẩu ban đầu (để trống để tự sinh)
                      </Text>
                      <TextInput
                        value={formAccountPassword}
                        onChangeText={setFormAccountPassword}
                        placeholder="Tối thiểu 8 ký tự..."
                        style={styles.input}
                      />
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={savingStaff}
                onPress={() => setStaffModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, savingStaff && { opacity: 0.7 }]}
                disabled={savingStaff}
                onPress={() => void handleSaveStaff()}
              >
                <Text style={styles.modalConfirmText}>
                  {savingStaff ? 'Đang lưu...' : 'Lưu thông tin'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Add Off-day Block */}
      <Modal
        visible={Boolean(blockModalStaff)}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalStaff(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBlockModalStaff(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Thêm lịch nghỉ — {blockModalStaff?.name}
            </Text>
            <Text style={styles.inputLbl}>Ngày nghỉ (YYYY-MM-DD) *</Text>
            <TextInput
              value={blockDate}
              onChangeText={setBlockDate}
              placeholder="2026-12-01"
              style={styles.input}
            />
            <View style={styles.capInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLbl}>Từ giờ (tùy chọn)</Text>
                <TextInput
                  value={blockStart}
                  onChangeText={setBlockStart}
                  placeholder="08:00"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLbl}>Đến giờ (tùy chọn)</Text>
                <TextInput
                  value={blockEnd}
                  onChangeText={setBlockEnd}
                  placeholder="12:00"
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.inputLbl}>Lý do nghỉ</Text>
            <TextInput
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="Nghỉ phép / Chụp sự kiện ngoài"
              style={styles.input}
            />
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={savingBlock}
                onPress={() => setBlockModalStaff(null)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, savingBlock && { opacity: 0.7 }]}
                disabled={savingBlock}
                onPress={() => void handleSubmitBlock()}
              >
                <Text style={styles.modalConfirmText}>
                  {savingBlock ? 'Đang lưu...' : 'Thêm lịch nghỉ'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Provision Account */}
      <Modal
        visible={Boolean(accountModalStaff)}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountModalStaff(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAccountModalStaff(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Cấp tài khoản cho {accountModalStaff?.name}
            </Text>
            <Text style={styles.helper}>
              Tài khoản mang quyền STAFF — chỉ xem ca được phân công, tuyệt đối không xem doanh thu hay ví Studio.
            </Text>
            <Text style={styles.inputLbl}>Email đăng nhập *</Text>
            <TextInput
              value={provEmail}
              onChangeText={setProvEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="thochup@studio.vn"
              style={styles.input}
            />
            <Text style={styles.inputLbl}>Mật khẩu (tùy chọn)</Text>
            <TextInput
              value={provPassword}
              onChangeText={setProvPassword}
              placeholder="Để trống để hệ thống tự tạo"
              style={styles.input}
            />
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={savingAccount}
                onPress={() => setAccountModalStaff(null)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, savingAccount && { opacity: 0.7 }]}
                disabled={savingAccount}
                onPress={() => void handleProvisionAccount()}
              >
                <Text style={styles.modalConfirmText}>
                  {savingAccount ? 'Đang tạo...' : 'Cấp tài khoản'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 4: One-time Temporary Password Display */}
      <Modal
        visible={Boolean(credentialInfo)}
        transparent
        animationType="fade"
        onRequestClose={() => setCredentialInfo(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{credentialInfo?.title}</Text>
            <Text style={styles.helper}>
              Hãy lưu hoặc gửi mật khẩu tạm dưới đây cho{' '}
              <Text style={{ fontFamily: FontFamily.bodyBold }}>
                {credentialInfo?.staffName}
              </Text>
              . Mật khẩu chỉ hiển thị một lần.
            </Text>
            <View style={styles.credBox}>
              {credentialInfo?.email ? (
                <Text style={styles.credLine} selectable>
                  Email: {credentialInfo.email}
                </Text>
              ) : null}
              <Text style={styles.credPassword} selectable>
                {credentialInfo?.temporaryPassword}
              </Text>
            </View>
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => void handleShareCredential()}
              >
                <Text style={styles.modalCancelText}>Chia sẻ cho thợ</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={() => setCredentialInfo(null)}
              >
                <Text style={styles.modalConfirmText}>Đã lưu, đóng</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECE3E7',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#BA0049',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16.5,
    color: '#111418',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  addBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiBox: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE3E7',
  },
  kpiNum: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    color: '#BA0049',
  },
  kpiLbl: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE3E7',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
    letterSpacing: 0.7,
  },
  helper: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F6874',
    lineHeight: 17,
  },
  capInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLbl: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#111418',
  },
  saveCapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#BA0049',
    marginTop: 4,
  },
  saveCapText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  listHeader: {
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECE3E7',
  },
  emptyTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#111418',
  },
  emptySub: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAddBtn: {
    marginTop: 6,
    backgroundColor: '#BA0049',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE3E7',
    gap: 10,
  },
  staffTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: '#BA0049',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  staffName: {
    flex: 1,
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#111418',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
  },
  staffSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F6874',
    marginTop: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  accountText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#334155',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricChip: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  blocksWrap: {
    gap: 4,
  },
  blocksTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#92400E',
  },
  blocksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  blockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  blockChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#92400E',
  },
  staffActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#334155',
  },
  accentSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  accentSmallBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#BA0049',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 10,
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
  toggleBox: {
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    borderRadius: 12,
    padding: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#111418',
  },
  toggleSub: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F6874',
    marginTop: 2,
  },
  credBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  credLine: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: '#334155',
  },
  credPassword: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    color: '#BA0049',
    letterSpacing: 1,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
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
    borderRadius: 10,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
