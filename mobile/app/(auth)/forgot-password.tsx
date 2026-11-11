import React, { useState } from 'react';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
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

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Vui lòng nhập đúng địa chỉ email đã đăng ký.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authApi.forgotPassword(email.trim().toLowerCase());
      setMessage(
        'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.'
      );
      if (result.demoResetToken) {
        router.push({
          pathname: '/(auth)/reset-password',
          params: { token: result.demoResetToken },
        } as unknown as Href);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Không thể gửi yêu cầu khôi phục mật khẩu.'));
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
                <MaterialIcons name="security" size={13} color={Colors.primary} />
                <Text style={styles.trustPillText}>Bảo mật tài khoản TàGo</Text>
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
                    <Text style={styles.heroBadgeText}>KHÔI PHỤC</Text>
                  </View>
                </View>
                <Text style={styles.heroBrandSubtitle}>
                  Cấp lại quyền truy cập an toàn cho tài khoản của bạn
                </Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.mainPadding}>
            <View style={styles.formCard}>
              <Text style={styles.formOverline}>KHÔI PHỤC TÀI KHOẢN</Text>
              <Text style={styles.formTitle}>Quên mật khẩu?</Text>
              <Text style={styles.formSubtitle}>
                Nhập địa chỉ email bạn đã đăng ký với TàGo. Hệ thống sẽ gửi mã hoặc liên kết đặt
                lại mật khẩu có hiệu lực trong 15 phút.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Địa chỉ Email đã đăng ký</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color="#5F5E5E"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="hoangtoc.hue@tago.vn"
                    placeholderTextColor="rgba(95, 94, 94, 0.55)"
                    style={styles.textInput}
                    returnKeyType="send"
                    onSubmitEditing={() => void send()}
                  />
                </View>
              </View>

              {!!message && (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={styles.successText}>{message}</Text>
                </View>
              )}

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
                onPress={() => void send()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Gửi liên kết khôi phục</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.backToLoginBtn}
                onPress={() => router.replace('/(auth)/login' as Href)}
              >
                <Ionicons name="arrow-back" size={15} color={Colors.primary} />
                <Text style={styles.backToLoginText}>Quay lại màn hình Đăng nhập</Text>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <MaterialCommunityIcons name="lock-outline" size={13} color="#5F5E5E" />
              <Text style={styles.footerText}>
                Bảo mật dữ liệu chuẩn mã hóa SSL 256-bit · Hotline 1900 6886
              </Text>
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
    height: 185,
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
    marginBottom: 16,
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  successText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#059669',
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
  },
  submitBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  backToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 6,
  },
  backToLoginText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5F5E5E',
  },
});
