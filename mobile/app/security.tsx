import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '@/apis/authApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';

export default function Screen() {
  return (
    <RequireAuth>
      <Security />
    </RequireAuth>
  );
}

function Security() {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!current) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ và số.');
      return;
    }
    if (next !== confirm) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      await logout();
      router.replace('/(auth)/login' as Href);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Không thể đổi mật khẩu.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#1E1418" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TÀGO SECURITY</Text>
          <Text style={s.title}>Bảo mật & Mật khẩu</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.notice}>
          <View style={s.noticeIcon}>
            <Ionicons name="shield-checkmark" size={20} color="#127A48" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.noticeTitle}>Bảo vệ phiên đăng nhập TàGo</Text>
            <Text style={s.noticeText}>
              Sau khi đổi mật khẩu, tất cả thiết bị đăng nhập cũ sẽ tự động đăng xuất để bảo vệ ví
              Escrow và lịch đặt của bạn.
            </Text>
          </View>
        </View>

        <View style={s.card}>
          <AppInput
            label="MẬT KHẨU HIỆN TẠI"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            placeholder="Nhập mật khẩu đang sử dụng"
          />
          <AppInput
            label="MẬT KHẨU MỚI"
            value={next}
            onChangeText={setNext}
            secureTextEntry
            placeholder="Ít nhất 8 ký tự, gồm chữ và số"
            hint="Gợi ý: Kết hợp chữ hoa, chữ thường và chữ số."
          />
          <AppInput
            label="XÁC NHẬN MẬT KHẨU MỚI"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Nhập lại mật khẩu mới"
          />
          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#B42318" />
              <Text style={s.error}>{error}</Text>
            </View>
          )}
          <AppButton
            title="Cập nhật mật khẩu mới"
            loading={loading}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6EA',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 21,
    color: '#1E1418',
  },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  notice: {
    padding: 15,
    borderRadius: Radius.lg,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#ABEFC6',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#065F46',
  },
  noticeText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#047857',
    marginTop: 2,
  },
  card: {
    padding: 18,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FFFFFF',
    gap: 15,
    ...Shadow,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    padding: 10,
    borderRadius: Radius.sm,
  },
  error: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#B42318',
  },
});
