import React, { useState } from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '@/apis/authApi';
import { Colors, FontFamily } from '@/constants/theme';
import { getApiErrorMessage } from '@/utils/apiError';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (token.trim().length < 20) {
      setError('Mã khôi phục không hợp lệ hoặc đã hết hạn.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự, bao gồm cả chữ và số.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ token: token.trim(), newPassword: password });
      router.replace('/(auth)/login' as Href);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Không thể đặt lại mật khẩu.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.topBarRow}>
              <Pressable
                style={styles.backBtn}
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace('/(auth)/login' as Href)
                }
              >
                <Ionicons name="chevron-back" size={20} color="#1B1C1C" />
              </Pressable>

              <View style={styles.trustPill}>
                <MaterialIcons name="verified-user" size={13} color={Colors.primary} />
                <Text style={styles.trustPillText}>Thiết lập mật khẩu mới</Text>
              </View>
            </View>

            <View style={styles.heroBannerWrap}>
              <Image
                source={require('@/assets/images/hero-hue-heritage-v2.webp')}
                style={styles.heroBannerImage}
                resizeMode="cover"
              />
              <View style={styles.heroBannerScrim}>
                <View style={styles.heroBrandRow}>
                  <Text style={styles.heroBrandTitle}>TàGo</Text>
                  <View style={styles.heroBadgePill}>
                    <Text style={styles.heroBadgeText}>BẢO MẬT</Text>
                  </View>
                </View>
                <Text style={styles.heroBrandSubtitle}>
                  Hoàn tất đặt lại mật khẩu cho tài khoản TàGo của bạn
                </Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.mainPadding}>
            <View style={styles.formCard}>
              <Text style={styles.formOverline}>BẢO MẬT TÀI KHOẢN</Text>
              <Text style={styles.formTitle}>Tạo mật khẩu mới</Text>
              <Text style={styles.formSubtitle}>
                Mật khẩu mới cần tối thiểu 8 ký tự (gồm cả chữ và số) để bảo vệ tài khoản của bạn.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mã khôi phục (Token)</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="key-outline"
                    size={19}
                    color="#5F5E5E"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                    placeholder="Mã tự động điền từ liên kết..."
                    placeholderTextColor="rgba(95, 94, 94, 0.55)"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mật khẩu mới</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color="#5F5E5E"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor="rgba(95, 94, 94, 0.55)"
                    style={styles.textInput}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#5F5E5E"
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Xác nhận mật khẩu mới</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color="#5F5E5E"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor="rgba(95, 94, 94, 0.55)"
                    style={styles.textInput}
                    returnKeyType="done"
                    onSubmitEditing={() => void submit()}
                  />
                </View>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.92 },
                  loading && { opacity: 0.7 },
                ]}
                disabled={loading}
                onPress={() => void submit()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Cập nhật mật khẩu mới</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  trustPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  heroBannerWrap: {
    width: '100%',
    height: 175,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EFEDED',
    position: 'relative',
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBannerScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(27, 28, 28, 0.38)',
    justifyContent: 'flex-end',
    padding: 18,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBrandTitle: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: '#FFFFFF',
  },
  heroBadgePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.7,
  },
  heroBrandSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 4,
  },
  mainPadding: {
    paddingHorizontal: 20,
    gap: 18,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.35)',
  },
  formOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: Colors.primary,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  formTitle: {
    fontFamily: FontFamily.display,
    fontSize: 23,
    color: '#1B1C1C',
  },
  formSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#5F5E5E',
    marginTop: 5,
    marginBottom: 18,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
    marginBottom: 6,
  },
  inputBox: {
    height: 52,
    backgroundColor: '#F5F3F3',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: '#1B1C1C',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#DC2626',
  },
  submitBtn: {
    height: 50,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
});
