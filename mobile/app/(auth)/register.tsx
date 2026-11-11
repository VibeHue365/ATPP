import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from '@/apis/authApi';
import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';
import { safeReturnTo } from '@/utils/navigation';
import { getGoogleSigninModule } from '@/services/googleAuth';

function evaluatePasswordStrength(pwd: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!pwd) return { level: 0, label: 'Chưa nhập' };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (/[A-Za-z]/.test(pwd) && /[0-9]/.test(pwd)) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) score += 1;

  const clamped = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: 'Yếu',
    2: 'Trung bình',
    3: 'Khá mạnh',
    4: 'Rất mạnh',
  };
  return { level: clamped, label: labels[clamped] };
}

export default function RegisterScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { loginWithGoogle, loginWithOAuthCode } = useAuth();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const isNameValid = form.fullName.trim().length >= 3;
  const isEmailValid = /^\S+@\S+\.\S+$/.test(form.email.trim());
  const isPhoneValid = /^[0-9+\-\s()]{8,20}$/.test(form.phone.trim());
  const isPasswordValid =
    form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /[0-9]/.test(form.password);
  const isConfirmMatched = form.confirm.length > 0 && form.confirm === form.password;

  const strength = useMemo(() => evaluatePasswordStrength(form.password), [form.password]);

  const submit = async () => {
    const email = form.email.trim().toLowerCase();
    if (!isNameValid) {
      setError('Họ và tên phải có ít nhất 3 ký tự.');
      return;
    }
    if (!isEmailValid) {
      setError('Địa chỉ email không đúng định dạng.');
      return;
    }
    if (!isPhoneValid) {
      setError('Số điện thoại không hợp lệ.');
      return;
    }
    if (!isPasswordValid) {
      setError('Mật khẩu cần ít nhất 8 ký tự, bao gồm cả chữ và số.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    if (!agreed) {
      setError('Bạn cần đồng ý với quy chế hoạt động và điều khoản sử dụng của TàGo.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await authApi.register({
        fullName: form.fullName.trim(),
        email,
        phone: form.phone.trim(),
        password: form.password,
      });
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email, otp: result.demoOtp ?? '', returnTo },
      } as unknown as Href);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể đăng ký tài khoản.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    setError('');

    const googleModule = getGoogleSigninModule();
    if (googleModule) {
      try {
        const { GoogleSignin } = googleModule;
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const signInResult = await GoogleSignin.signIn();
        const idToken = signInResult.data?.idToken;
        if (!idToken) throw new Error('Không nhận được mã xác thực từ Google.');
        const loggedInUser = await loginWithGoogle(idToken);
        const destination = safeReturnTo(returnTo);
        if (loggedInUser.hasCompletedOnboarding === false) {
          router.replace({
            pathname: '/preferences',
            params: { onboarding: '1', returnTo: String(destination) },
          } as unknown as Href);
          return;
        }
        router.replace(destination);
      } catch (cause: any) {
        if (cause?.code === 'SIGN_IN_CANCELLED' || cause?.code === 12501) return;
        setError(getApiErrorMessage(cause, 'Đăng ký bằng Google không thành công.'));
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    try {
      let apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      if (Platform.OS === 'android' && (apiUrl.includes('10.0.2.2') || apiUrl.includes('127.0.0.1'))) {
        apiUrl = 'http://localhost:3000';
      }
      const redirectUri = Linking.createURL('/oauth/callback');
      const authUrl = `${apiUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;
      await Linking.openURL(authUrl);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể mở trình duyệt đăng ký Google.'));
    } finally {
      setGoogleLoading(false);
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
          {/* Top Bar */}
          <View style={styles.topBarRow}>
            <Pressable
              style={styles.closeBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            >
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>

            <View style={styles.heritagePill}>
              <View style={styles.pulseDot} />
              <Text style={styles.heritagePillText}>CỐ ĐÔ DI SẢN</Text>
            </View>
          </View>

          {/* Hero Art Banner */}
          <View style={styles.heroBannerWrap}>
            <Image
              source={require('@/assets/images/hero-silk-stone-v2.webp')}
              style={styles.heroBannerImage}
              resizeMode="cover"
            />
            <View style={styles.heroBannerScrim} />

            {/* Top Left Rating Badge */}
            <View style={styles.bannerTopLeftPill}>
              <Ionicons name="star" size={13} color="#A93232" />
              <Text style={styles.bannerRatingScore}>4.9/5</Text>
              <Text style={styles.bannerRatingCount}>(10.000+ đánh giá)</Text>
            </View>

            {/* Bottom Brand Info */}
            <View style={styles.bannerBottomBlock}>
              <View style={styles.heroBrandRow}>
                <Text style={styles.heroBrandTitle}>TàGo</Text>
                <View style={styles.heroLuxuryBadge}>
                  <Text style={styles.heroLuxuryBadgeText}>HERITAGE LUXURY</Text>
                </View>
              </View>
              <Text style={styles.heroBrandSubtitle}>
                Nền tảng Áo Dài & Nhiếp Ảnh Di Sản Cố Đô
              </Text>
            </View>
          </View>

          {/* Segmented Control Switcher */}
          <View style={styles.segmentedBar}>
            <Pressable
              style={styles.segmentTab}
              onPress={() =>
                router.replace({
                  pathname: '/(auth)/login',
                  params: { returnTo },
                } as unknown as Href)
              }
            >
              <MaterialIcons name="login" size={16} color="#5F5E5E" />
              <Text style={styles.segmentTabText}>Đăng nhập</Text>
            </Pressable>
            <Pressable style={[styles.segmentTab, styles.segmentTabActive]}>
              <Ionicons name="person-add" size={15} color="#FFFFFF" />
              <Text style={[styles.segmentTabText, styles.segmentTabTextActive]}>
                Đăng ký mới
              </Text>
            </Pressable>
          </View>

          {/* Registration Card Form */}
          <View style={styles.formCard}>
            <View style={styles.formHeaderBlock}>
              <Text style={styles.formOverline}>ĐĂNG KÝ THÀNH VIÊN TÀGO</Text>
              <Text style={styles.formTitle}>Tạo tài khoản mới</Text>
            </View>

            {/* Incentive Badge */}
            <View style={styles.incentiveBox}>
              <MaterialIcons name="redeem" size={20} color="#BA0049" style={{ marginTop: 1 }} />
              <Text style={styles.incentiveText}>
                Nhận voucher <Text style={styles.incentiveHighlight}>100.000đ</Text> cho lần trải
                nghiệm đầu tiên và quyền lợi ký quỹ{' '}
                <Text style={styles.incentiveHighlight}>Escrow 0đ</Text>.
              </Text>
            </View>

            {/* 1. Full Name Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Họ và tên quý khách</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="person-outline"
                  size={19}
                  color="#8F6F73"
                  style={styles.inputLeftIcon}
                />
                <TextInput
                  value={form.fullName}
                  onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
                  placeholder="Nhập họ và tên (VD: Nguyễn Thảo My)"
                  placeholderTextColor="rgba(95, 94, 94, 0.55)"
                  style={styles.textInput}
                />
                {isNameValid && <Ionicons name="checkmark-circle" size={20} color="#BA0049" />}
              </View>
            </View>

            {/* 2. Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Địa chỉ Email</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color="#8F6F73"
                  style={styles.inputLeftIcon}
                />
                <TextInput
                  value={form.email}
                  onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="thaomy.nguyen@tago.vn"
                  placeholderTextColor="rgba(95, 94, 94, 0.55)"
                  style={styles.textInput}
                />
                {isEmailValid && <Ionicons name="checkmark-circle" size={20} color="#BA0049" />}
              </View>
            </View>

            {/* 3. Phone Number Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Số điện thoại di động</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryPrefixBox}>
                  <Text style={styles.flagEmoji}>🇻🇳</Text>
                  <Text style={styles.countryCodeText}>+84</Text>
                  <Ionicons name="chevron-down" size={13} color="#5F5E5E" />
                </View>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <TextInput
                    value={form.phone}
                    onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                    keyboardType="phone-pad"
                    placeholder="0914 888 666"
                    placeholderTextColor="rgba(95, 94, 94, 0.55)"
                    style={styles.textInput}
                  />
                  {isPhoneValid && <Ionicons name="checkmark-circle" size={19} color="#BA0049" />}
                </View>
              </View>
            </View>

            {/* 4. Password Field + Live Strength Meter */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mật khẩu</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color="#8F6F73"
                  style={styles.inputLeftIcon}
                />
                <TextInput
                  value={form.password}
                  onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="rgba(95, 94, 94, 0.55)"
                  style={styles.textInput}
                />
                <Pressable
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#5F5E5E"
                  />
                </Pressable>
              </View>

              {/* Password Strength Meter */}
              <View style={styles.strengthWrap}>
                <View style={styles.strengthLabelRow}>
                  <Text style={styles.strengthTitle}>Độ mạnh mật khẩu:</Text>
                  <Text style={styles.strengthValue}>{strength.label}</Text>
                </View>
                <View style={styles.strengthBarsRow}>
                  {[1, 2, 3, 4].map((barIdx) => (
                    <View
                      key={barIdx}
                      style={[
                        styles.strengthBar,
                        strength.level >= barIdx &&
                          (barIdx <= 2 ? styles.strengthBarMid : styles.strengthBarHigh),
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.strengthHint}>
                  Tối thiểu 8 ký tự, bao gồm chữ cái và chữ số.
                </Text>
              </View>
            </View>

            {/* 5. Confirm Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Xác nhận mật khẩu</Text>
              <View style={styles.inputBox}>
                <MaterialIcons
                  name="verified-user"
                  size={19}
                  color="#8F6F73"
                  style={styles.inputLeftIcon}
                />
                <TextInput
                  value={form.confirm}
                  onChangeText={(v) => setForm((f) => ({ ...f, confirm: v }))}
                  secureTextEntry={!showPassword}
                  onSubmitEditing={() => void submit()}
                  returnKeyType="done"
                  placeholder="••••••••••••"
                  placeholderTextColor="rgba(95, 94, 94, 0.55)"
                  style={styles.textInput}
                />
                {isConfirmMatched && <MaterialIcons name="verified" size={20} color="#BA0049" />}
              </View>
            </View>

            {/* Agreement Checkbox */}
            <Pressable style={styles.agreementRow} onPress={() => setAgreed((v) => !v)}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.agreementText}>
                Tôi đồng ý với <Text style={styles.agreementLink}>Quy chế hoạt động</Text> &{' '}
                <Text style={styles.agreementLink}>Chính sách bảo chứng Escrow</Text> minh bạch của
                TàGo.
              </Text>
            </Pressable>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#BA1A1A" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Primary Action CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.primarySubmitBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                loading && { opacity: 0.7 },
              ]}
              disabled={loading || googleLoading}
              onPress={() => void submit()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primarySubmitText}>Tạo tài khoản & Nhận mã OTP</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>

          {/* Social Registration & Or Divider */}
          <View style={styles.orDividerRow}>
            <View style={styles.orDividerLine} />
            <Text style={styles.orDividerText}>HOẶC TIẾP TỤC VỚI</Text>
            <View style={styles.orDividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && styles.googleBtnPressed,
              googleLoading && { opacity: 0.65 },
            ]}
            onPress={() => void handleGoogleRegister()}
            disabled={loading || googleLoading}
          >
            <Image
              source={require('@/assets/images/google-logo.png')}
              style={styles.googleIcon}
              resizeMode="contain"
            />
            <Text style={styles.googleBtnText}>
              {googleLoading ? 'Đang kết nối Google...' : 'Tiếp tục với Google'}
            </Text>
          </Pressable>

          {/* Trust Badge Escrow Card */}
          <View style={styles.escrowCard}>
            <View style={styles.escrowIconCircle}>
              <MaterialIcons name="verified-user" size={21} color="#BA0049" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.escrowTitle}>TàGo Escrow Bảo Chứng 100%</Text>
              <Text style={styles.escrowDesc}>
                Tiền cọc giữ qua cổng độc lập, chỉ giải ngân sau khi hoàn tất buổi chụp hài lòng.
              </Text>
            </View>
          </View>

          {/* Footer Information */}
          <View style={styles.footerWrap}>
            <View style={styles.footerInfoRow}>
              <View style={styles.footerInlineItem}>
                <Ionicons name="call" size={12} color="#5F5E5E" />
                <Text style={styles.footerText}>
                  Hotline Cố Đô: <Text style={styles.footerBold}>1900 6886</Text>
                </Text>
              </View>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerText}>26 Lê Lợi, TP. Huế</Text>
            </View>
            <View style={styles.footerInlineItem}>
              <MaterialCommunityIcons name="lock-outline" size={13} color="#8F6F73" />
              <Text style={styles.footerSslText}>
                Bảo mật dữ liệu chuẩn mã hóa SSL 256-bit
              </Text>
            </View>
            <Text style={styles.copyrightText}>
              © {new Date().getFullYear()} TàGo Heritage Platform. All rights reserved.
            </Text>
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
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  heritagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#BA0049',
  },
  heritagePillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#5B3F43',
    letterSpacing: 0.8,
  },
  heroBannerWrap: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EFEDED',
    position: 'relative',
    marginTop: 4,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBannerScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(27, 28, 28, 0.36)',
  },
  bannerTopLeftPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  bannerRatingScore: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1B1C1C',
  },
  bannerRatingCount: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
  },
  bannerBottomBlock: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  heroBrandTitle: {
    fontFamily: FontFamily.display,
    fontSize: 27,
    color: '#FFFFFF',
  },
  heroLuxuryBadge: {
    backgroundColor: 'rgba(227, 28, 95, 0.88)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroLuxuryBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heroBrandSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  segmentedBar: {
    marginTop: 16,
    backgroundColor: '#E9E8E7',
    padding: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentTabActive: {
    backgroundColor: '#BA0049',
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentTabText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#5F5E5E',
  },
  segmentTabTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  formCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.35)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  formHeaderBlock: {
    marginBottom: 12,
  },
  formOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
    letterSpacing: 1.2,
  },
  formTitle: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: '#1B1C1C',
    marginTop: 2,
  },
  incentiveBox: {
    backgroundColor: 'rgba(255, 217, 222, 0.45)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  incentiveText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: '#400014',
  },
  incentiveHighlight: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
    marginBottom: 5,
  },
  inputBox: {
    height: 48,
    backgroundColor: '#F5F3F3',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputLeftIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13.5,
    color: '#1B1C1C',
    height: '100%',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryPrefixBox: {
    height: 48,
    backgroundColor: '#F5F3F3',
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flagEmoji: {
    fontSize: 14,
  },
  countryCodeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#1B1C1C',
  },
  eyeToggleBtn: {
    padding: 4,
    marginLeft: 4,
  },
  strengthWrap: {
    marginTop: 6,
    gap: 4,
  },
  strengthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strengthTitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5F5E5E',
  },
  strengthValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E3E2E2',
  },
  strengthBarMid: {
    backgroundColor: '#E31C5F',
  },
  strengthBarHigh: {
    backgroundColor: '#BA0049',
  },
  strengthHint: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#5F5E5E',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
    marginBottom: 14,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#8F6F73',
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  agreementText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: '#5F5E5E',
  },
  agreementLink: {
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
    textDecorationLine: 'underline',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFDAD6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#93000A',
  },
  primarySubmitBtn: {
    height: 50,
    borderRadius: 999,
    backgroundColor: '#BA0049',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primarySubmitText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  orDividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E9E8E7',
  },
  orDividerText: {
    paddingHorizontal: 12,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#5F5E5E',
    letterSpacing: 0.8,
  },
  googleBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  googleBtnPressed: {
    backgroundColor: '#F5F3F3',
  },
  googleBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#1B1C1C',
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  escrowCard: {
    marginTop: 16,
    backgroundColor: '#F5F3F3',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  escrowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  escrowTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1B1C1C',
  },
  escrowDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 2,
  },
  footerWrap: {
    marginTop: 22,
    alignItems: 'center',
    gap: 5,
  },
  footerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5F5E5E',
  },
  footerBold: {
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  footerDot: {
    fontSize: 11,
    color: '#5F5E5E',
  },
  footerSslText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8F6F73',
  },
  copyrightText: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: 'rgba(95, 94, 94, 0.7)',
    marginTop: 2,
  },
});
