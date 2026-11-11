import React, { useEffect, useState, type ReactNode } from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userApi, type AddressInput } from '@/apis/userApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import type { UserAddress } from '@/types/auth';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

const emptyAddress: AddressInput = {
  label: 'Nhà riêng',
  recipientName: '',
  phone: '',
  addressLine: '',
  ward: '',
  district: '',
  city: '',
  note: '',
  isDefault: false,
};

export default function Screen() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}

function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { show } = useToast();

  const [edit, setEdit] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState<AddressInput>(emptyAddress);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    gender: 'OTHER' as 'MALE' | 'FEMALE' | 'OTHER',
  });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName,
        phone: user.phone ?? '',
        dateOfBirth: user.dateOfBirth?.slice(0, 10) ?? '',
        gender: user.gender ?? 'OTHER',
      });
    }
  }, [user]);

  if (!user) return null;

  const saveProfile = async () => {
    if (!form.fullName.trim()) {
      show('Họ và tên không được để trống', 'error');
      return;
    }
    setSaving(true);
    try {
      await userApi.updateProfile({
        ...form,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
      });
      await refreshUser();
      setEdit(false);
      show('Đã cập nhật hồ sơ cá nhân', 'success');
    } catch (e) {
      show(getApiErrorMessage(e, 'Không thể cập nhật hồ sơ'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show('Cần quyền truy cập thư viện ảnh', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const body = new FormData();
    body.append(
      'avatar',
      asset.file ??
        ({
          uri: asset.uri,
          name: asset.fileName ?? 'avatar.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as unknown as Blob)
    );
    try {
      await userApi.updateAvatar(body);
      await refreshUser();
      show('Đã đổi ảnh đại diện', 'success');
    } catch (e) {
      show(getApiErrorMessage(e, 'Không thể tải ảnh đại diện'), 'error');
    }
  };

  const openAddress = (item?: UserAddress) => {
    setSelectedAddress(item ?? null);
    setAddress(
      item
        ? {
            label: item.label,
            recipientName: item.recipientName ?? '',
            phone: item.phone ?? '',
            addressLine: item.addressLine,
            ward: item.ward ?? '',
            district: item.district ?? '',
            city: item.city ?? '',
            note: item.note ?? '',
            isDefault: item.isDefault,
          }
        : emptyAddress
    );
    setAddressOpen(true);
  };

  const saveAddress = async () => {
    if (!address.label.trim() || !address.addressLine.trim()) {
      show('Vui lòng nhập nhãn và địa chỉ chi tiết', 'error');
      return;
    }
    setSaving(true);
    try {
      if (selectedAddress?.id) {
        const { isDefault: _ignored, ...changes } = address;
        await userApi.updateAddress(selectedAddress.id, changes);
      } else {
        await userApi.createAddress(address);
      }
      await refreshUser();
      setAddressOpen(false);
      show('Đã lưu địa chỉ nhận đồ', 'success');
    } catch (e) {
      show(getApiErrorMessage(e, 'Không thể lưu địa chỉ'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id?: string) => {
    if (!id) return;
    try {
      await userApi.setDefaultAddress(id);
      await refreshUser();
      show('Đã đặt làm địa chỉ mặc định', 'success');
    } catch (e) {
      show(getApiErrorMessage(e), 'error');
    }
  };

  const removeAddress = (item: UserAddress) =>
    TagoAlert.alert('Xóa địa chỉ', `Bạn có chắc muốn xóa địa chỉ “${item.label}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa địa chỉ',
        style: 'destructive',
        onPress: async () => {
          if (!item.id) return;
          try {
            await userApi.removeAddress(item.id);
            await refreshUser();
            show('Đã xóa địa chỉ', 'success');
          } catch (e) {
            show(getApiErrorMessage(e), 'error');
          }
        },
      },
    ]);

  const signOut = () =>
    TagoAlert.alert('Đăng xuất tài khoản', 'Bạn muốn đăng xuất khỏi TàGo?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
    ]);

  const isPartner = Boolean(
    user?.roles?.some((r) => ['PROVIDER', 'PHOTOGRAPHER', 'ADMIN'].includes(r.toUpperCase()))
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.eyebrow}>TÀGO DI SẢN · HỒ SƠ THÀNH VIÊN</Text>
          <Text style={styles.headerTitle}>Tài Khoản Cá Nhân</Text>
        </View>
        <Pressable style={styles.editProfileBtn} onPress={() => setEdit(true)}>
          <Ionicons name="create-outline" size={15} color="#FFFFFF" />
          <Text style={styles.editProfileBtnText}>Chỉnh sửa</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity Card */}
        <View style={styles.identityCard}>
          <Pressable style={styles.avatarContainer} onPress={() => void pickAvatar()}>
            <View style={styles.avatarCircle}>
              {user.avatarUrl ? (
                <Image
                  source={getMediaUrl(user.avatarUrl)}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials(user.fullName)}</Text>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          </Pressable>

          <View style={styles.identityInfo}>
            <Text style={styles.userName}>{user.fullName}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <StatusBadge
                label={user.isEmailVerified ? 'Đã xác minh Email' : 'Chưa xác minh Email'}
                tone={user.isEmailVerified ? 'success' : 'warning'}
              />
            </View>
          </View>
        </View>

        {/* Partner Space Switcher Card */}
        {isPartner ? (
          <Pressable
            style={({ pressed }) => [
              styles.partnerCard,
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => router.push('/provider' as Href)}
          >
            <View style={styles.partnerCardLeft}>
              <View style={styles.partnerIconBox}>
                <MaterialIcons name="storefront" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.partnerTitleRow}>
                  <Text style={styles.partnerTitle}>Không gian Đối tác & Studio</Text>
                  <View style={styles.partnerProBadge}>
                    <Text style={styles.partnerProText}>PRO</Text>
                  </View>
                </View>
                <Text style={styles.partnerSubtitle}>
                  Quản lý đơn thuê cổ phục, lịch chụp, gói chụp & ví doanh thu
                </Text>
              </View>
            </View>
            <View style={styles.partnerArrowCircle}>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.partnerCard,
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => router.push('/provider/register' as Href)}
          >
            <View style={styles.partnerCardLeft}>
              <View style={styles.partnerIconBox}>
                <MaterialIcons name="verified-user" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.partnerTitleRow}>
                  <Text style={styles.partnerTitle}>Đăng ký Đối tác TàGo Partner</Text>
                  <View style={styles.partnerProBadge}>
                    <Text style={styles.partnerProText}>KYC</Text>
                  </View>
                </View>
                <Text style={styles.partnerSubtitle}>
                  Mở Tiệm Áo dài, Cổ phục hoặc Studio Nhiếp ảnh chính thức tại Huế
                </Text>
              </View>
            </View>
            <View style={styles.partnerArrowCircle}>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </View>
          </Pressable>
        )}

        {/* Quick Activity Shortcuts */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSectionTitle}>HOẠT ĐỘNG & TIỆN ÍCH</Text>
          <MenuRow
            icon="sparkles-outline"
            label="Trợ lý AI Stylist Tư vấn Áo dài"
            subtitle="Tư vấn chọn kiểu dáng, màu sắc & phối cổ phục"
            onPress={() => router.push('/ai-assistant' as Href)}
          />
          <MenuRow
            icon="camera-reverse-outline"
            label="Phòng Thử Đồ Ảo AI 2D"
            subtitle="Ướm thử Cổ phục & Áo dài trực tiếp lên ảnh của bạn"
            onPress={() => router.push('/virtual-tryon' as Href)}
          />
          <MenuRow
            icon="storefront-outline"
            label="Danh bạ Tiệm Áo dài & Studio"
            subtitle="Khám phá tất cả nhà may cổ phục & nhiếp ảnh gia tại Huế"
            onPress={() => router.push('/stores' as Href)}
          />
          <MenuRow
            icon="calendar-outline"
            label="Đơn hàng & Lịch hẹn của tôi"
            subtitle="Theo dõi trạng thái đơn thuê, ca chụp & hoàn cọc"
            onPress={() => router.push('/(tabs)/bookings' as Href)}
          />
          <MenuRow
            icon="chatbubble-ellipses-outline"
            label="Tin nhắn với Cửa hàng & Studio"
            subtitle="Trao đổi trực tiếp về số đo, địa điểm chụp"
            onPress={() => router.push('/chat' as Href)}
          />
          <MenuRow
            icon="card-outline"
            label="Lịch sử giao dịch & Hoàn tiền"
            subtitle="Biên lai thanh toán PayOS và đối soát cọc Escrow"
            onPress={() => router.push('/payments' as Href)}
          />
          <MenuRow
            icon="heart-outline"
            label="Bộ sưu tập Yêu thích"
            count={(user.favorites ?? []).length}
            onPress={() => router.push('/favorites' as Href)}
          />
          <MenuRow
            icon="notifications-outline"
            label="Thông báo hệ thống"
            count={unreadCount}
            onPress={() => router.push('/notifications' as Href)}
          />
          <MenuRow
            icon="star-outline"
            label="Đánh giá dịch vụ của tôi"
            onPress={() => router.push('/reviews' as Href)}
          />
        </View>

        {/* Personal Details Section */}
        <SectionCard title="Thông tin cá nhân">
          <InfoRow label="Họ và tên" value={user.fullName} />
          <InfoRow label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} />
          <InfoRow label="Ngày sinh" value={formatBirthDate(user.dateOfBirth)} />
          <InfoRow label="Giới tính" value={formatGender(user.gender)} />
          <InfoRow label="Trạng thái SĐT" value={user.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'} />
        </SectionCard>

        {/* Saved Addresses Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Sổ địa chỉ nhận & trả đồ</Text>
              <Text style={styles.sectionHint}>
                Dùng để giao cổ phục tận nơi hoặc đặt lịch hẹn
              </Text>
            </View>
            <Pressable onPress={() => openAddress()} style={styles.addAddressBtn}>
              <Ionicons name="add" size={15} color={Colors.primary} />
              <Text style={styles.addAddressText}>Thêm mới</Text>
            </Pressable>
          </View>

          {user.addresses.length === 0 ? (
            <View style={styles.emptyAddressBox}>
              <Ionicons name="location-outline" size={24} color="#8F8E8E" />
              <Text style={styles.emptyAddressText}>
                Bạn chưa lưu địa chỉ nhận đồ nào.
              </Text>
            </View>
          ) : (
            user.addresses.map((item) => (
              <View key={item.id ?? item.addressLine} style={styles.addressCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.addressTopRow}>
                    <Ionicons name="location" size={15} color={Colors.primary} />
                    <Text style={styles.addressLabelText}>{item.label}</Text>
                    {item.isDefault && (
                      <StatusBadge label="Mặc định" tone="primary" />
                    )}
                  </View>
                  {(item.recipientName || item.phone) && (
                    <Text style={styles.addressRecipient}>
                      {[item.recipientName, item.phone].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  <Text style={styles.addressDetailText}>
                    {[item.addressLine, item.ward, item.district, item.city]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>

                <View style={styles.addressActionRow}>
                  <Pressable
                    style={styles.addrActionPill}
                    onPress={() => openAddress(item)}
                  >
                    <Text style={styles.addrActionText}>Sửa</Text>
                  </Pressable>
                  {!item.isDefault && (
                    <Pressable
                      style={styles.addrActionPill}
                      onPress={() => void setDefault(item.id)}
                    >
                      <Text style={styles.addrActionText}>Đặt mặc định</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.addrDeleteBtn}
                    onPress={() => removeAddress(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Account Settings Menu */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSectionTitle}>CÀI ĐẶT & BẢO MẬT</Text>
          <MenuRow
            icon="options-outline"
            label="Sở thích & Số đo cá nhân"
            subtitle="Chiều cao, cân nặng, màu sắc & phong cách yêu thích"
            onPress={() => router.push('/preferences' as Href)}
          />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Đổi mật khẩu bảo mật"
            onPress={() => router.push('/security' as Href)}
          />
          <MenuRow
            icon="log-out-outline"
            label="Đăng xuất tài khoản"
            danger
            onPress={signOut}
          />
        </View>

        <Text style={styles.brandFooter}>TÀGO · NỀN TẢNG ÁO DÀI & NHIẾP ẢNH DI SẢN VIỆT</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <AppModal
        visible={edit}
        title="Chỉnh sửa hồ sơ cá nhân"
        onClose={() => setEdit(false)}
      >
        <ScrollView contentContainerStyle={styles.modalContent}>
          <AppInput
            label="Họ và tên"
            value={form.fullName}
            onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
          />
          <AppInput
            label="Số điện thoại"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
          />
          <AppInput
            label="Ngày sinh (YYYY-MM-DD)"
            placeholder="1999-10-20"
            value={form.dateOfBirth}
            onChangeText={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))}
          />
          <Text style={styles.inputLabel}>GIỚI TÍNH</Text>
          <View style={styles.genderRow}>
            {(['FEMALE', 'MALE', 'OTHER'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setForm((f) => ({ ...f, gender: v }))}
                style={[styles.genderBtn, form.gender === v && styles.genderBtnActive]}
              >
                <Text
                  style={[
                    styles.genderBtnText,
                    form.gender === v && styles.genderBtnTextActive,
                  ]}
                >
                  {formatGender(v)}
                </Text>
              </Pressable>
            ))}
          </View>
          <AppButton
            title="Lưu thay đổi"
            loading={saving}
            onPress={() => void saveProfile()}
          />
        </ScrollView>
      </AppModal>

      {/* Address Modal */}
      <AppModal
        visible={addressOpen}
        title={selectedAddress ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
        onClose={() => setAddressOpen(false)}
      >
        <ScrollView contentContainerStyle={styles.modalContent}>
          <AppInput
            label="Tên gợi nhớ (VD: Nhà riêng, Khách sạn...)"
            value={address.label}
            onChangeText={(v) => setAddress((a) => ({ ...a, label: v }))}
          />
          <AppInput
            label="Họ tên người nhận"
            value={address.recipientName ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, recipientName: v }))}
          />
          <AppInput
            label="Số điện thoại liên hệ"
            keyboardType="phone-pad"
            value={address.phone ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, phone: v }))}
          />
          <AppInput
            label="Số nhà, tên đường"
            value={address.addressLine}
            onChangeText={(v) => setAddress((a) => ({ ...a, addressLine: v }))}
          />
          <AppInput
            label="Phường / Xã"
            value={address.ward ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, ward: v }))}
          />
          <AppInput
            label="Quận / Huyện"
            value={address.district ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, district: v }))}
          />
          <AppInput
            label="Tỉnh / Thành phố"
            value={address.city ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, city: v }))}
          />
          <AppButton
            title="Lưu địa chỉ"
            loading={saving}
            onPress={() => void saveAddress()}
          />
        </ScrollView>
      </AppModal>
    </SafeAreaView>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  subtitle,
  count,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  count?: number;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: '#FBF9F9' }]}
    >
      <View
        style={[
          styles.menuIconBox,
          danger && { backgroundColor: '#FEF2F2' },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={danger ? Colors.error : Colors.primary}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: Colors.error }]}>{label}</Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>

      {count !== undefined && count > 0 && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={17} color="#8F8E8E" />
    </Pressable>
  );
}

const initials = (v: string) =>
  v
    .split(' ')
    .filter(Boolean)
    .map((x) => x[0])
    .slice(-2)
    .join('')
    .toUpperCase();

const formatBirthDate = (v?: string) =>
  v ? new Date(v).toLocaleDateString('vi-VN') : 'Chưa cập nhật';

const formatGender = (v?: string) =>
  v === 'FEMALE' ? 'Nữ' : v === 'MALE' ? 'Nam' : 'Khác';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.7,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: '#1B1C1C',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  editProfileBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  identityCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadow,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF0F3',
    borderWidth: 2,
    borderColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 20,
    color: Colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: '#1B1C1C',
  },
  userEmail: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#5F5E5E',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  partnerCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...Shadow,
  },
  partnerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  partnerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#1B1C1C',
  },
  partnerProBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  partnerProText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  partnerSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5F5E5E',
    marginTop: 2,
  },
  partnerArrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 8,
    ...Shadow,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
  },
  sectionHint: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#8F8E8E',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  infoLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: '#5F5E5E',
  },
  infoValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  addAddressText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  emptyAddressBox: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyAddressText: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#8F8E8E',
  },
  addressCard: {
    padding: 13,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 16,
    backgroundColor: '#FBF9F9',
    marginTop: 6,
    gap: 8,
  },
  addressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressLabelText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#1B1C1C',
  },
  addressRecipient: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
    marginTop: 3,
  },
  addressDetailText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
    marginTop: 2,
  },
  addressActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
  },
  addrActionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  addrActionText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  addrDeleteBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  menuCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    overflow: 'hidden',
    ...Shadow,
  },
  menuSectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: '#8F8E8E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FBF9F9',
  },
  menuRow: {
    minHeight: 58,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#1B1C1C',
  },
  menuSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F8E8E',
    marginTop: 2,
  },
  menuBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  menuBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  brandFooter: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContent: {
    gap: 13,
    paddingBottom: 25,
  },
  inputLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#5F5E5E',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#FBF9F9',
  },
  genderBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  genderBtnTextActive: {
    color: '#FFFFFF',
  },
});
