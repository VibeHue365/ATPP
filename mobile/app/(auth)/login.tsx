import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
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
import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';
import { safeReturnTo } from '@/utils/navigation';
import { getGoogleSigninModule } from '@/services/googleAuth';
import type { SessionUser } from '@/types/auth';

export default function LoginScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { login, loginWithGoogle, loginWithOAuthCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const navigateAfterLogin = (loggedInUser: SessionUser) => {
    const rolesUpper = (loggedInUser.roles ?? []).map((r) => String(r).toUpperCase());
    if (rolesUpper.includes('PROVIDER')) {
      router.replace('/provider' as unknown as Href);
      return;
    }
    const destination = safeReturnTo(returnTo);
    if (loggedInUser.hasCompletedOnboarding === false) {
      router.replace({
        pathname: '/preferences',
        params: { onboarding: '1', returnTo: String(destination) },
      } as unknown as Href);
      return;
    }
    router.replace(destination);
  };

  const handleAuthToken = async (idToken: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      const loggedInUser = await loginWithGoogle(idToken);
      navigateAfterLogin(loggedInUser);
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause, 'Đăng nhập bằng Google không thành công.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) {
      setError('Vui lòng nhập đúng địa chỉ email và mật khẩu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const loggedInUser = await login({
        email: email.trim().toLowerCase(),
        password,
      });
      navigateAfterLogin(loggedInUser);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Đăng nhập không thành công.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCodeExchange = async (code: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      const loggedInUser = await loginWithOAuthCode(code);
      navigateAfterLogin(loggedInUser);
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause, 'Đăng nhập bằng Google không thành công.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    const googleModule = getGoogleSigninModule();
    if (googleModule) {
      try {
        const { GoogleSignin } = googleModule;
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const signInResult = await GoogleSignin.signIn();
        const idToken = signInResult.data?.idToken;
        if (!idToken) {
          throw new Error('Không nhận được mã xác thực từ Google.');
        }
        await handleAuthToken(idToken);
      } catch (cause: any) {
        if (cause?.code === 'SIGN_IN_CANCELLED' || cause?.code === 12501) {
          return;
        }
        setError(getApiErrorMessage(cause, 'Đăng nhập bằng Google không thành công.'));
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
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause, 'Không thể mở trình duyệt đăng nhập Google.'));
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
          {/* Top Heritage Hero Visual Container */}
          <View style={styles.heroSection}>
            {/* Top Bar: Close Button & Trust Rating Pill */}
            <View style={styles.topBarRow}>
              <Pressable
                style={styles.closeBtn}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              >
                <Ionicons name="close" size={20} color="#1B1C1C" />
              </Pressable>

              <View style={styles.trustRatingPill}>
                <Ionicons name="star" size={12} color="#BA0049" />
                <Text style={styles.trustRatingScore}>4.9/5</Text>
                <Text style={styles.trustRatingCount}>(10.000+ đánh giá)</Text>
              </View>
            </View>

            {/* Editorial Arch Banner */}
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
                    <Text style={styles.heroBadgeText}>CỐ ĐÔ</Text>
                  </View>
                </View>
                <Text style={styles.heroBrandSubtitle}>
                  Nền tảng Áo Dài & Nhiếp Ảnh Di Sản Việt
                </Text>
              </View>
            </View>

            {/* Segmented Tab Navigation */}
            <View style={styles.segmentedBar}>
              <Pressable style={[styles.segmentTab, styles.segmentTabActive]}>
                <Text style={[styles.segmentTabText, styles.segmentTabTextActive]}>
                  Đăng nhập
                </Text>
              </Pressable>
              <Pressable
                style={styles.segmentTab}
                onPress={() =>
                  router.replace({
                    pathname: '/(auth)/register',
                    params: { returnTo },
                  } as unknown as Href)
                }
              >
                <Text style={styles.segmentTabText}>Đăng ký</Text>
              </Pressable>
            </View>
          </View>

          {/* Main Interaction Card (Form Module) */}
          <View style={styles.mainPadding}>
            <View style={styles.formCard}>
              <View style={styles.formHeaderBlock}>
                <Text style={styles.formOverline}>CHÀO MỪNG QUÝ KHÁCH</Text>
                <Text style={styles.formTitle}>Đăng nhập tài khoản</Text>
                <Text style={styles.formSubtitle}>
                  Đăng nhập để giữ lịch thử áo dài, xem ảnh chụp và bảo chứng ký quỹ cọc Escrow
                  an tâm tuyệt đối.
                </Text>
              </View>

              {/* Email Input Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Địa chỉ Email</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color="#5F5E5E"
                    style={styles.inputLeftIcon}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="hoangtoc.hue@tago.vn"
                    placeholderTextColor="rgba(95, 94, 94, 0.55)"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Password Input Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mật khẩu</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color="#5F5E5E"
                    style={styles.inputLeftIcon}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    onSubmitEditing={() => void submit()}
                    returnKeyType="done"
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
              </View>

              {/* Auxiliary Action Row: Remember Me & Forgot Password */}
              <View style={styles.auxRow}>
                <Pressable
                  style={styles.rememberRow}
                  onPress={() => setRememberMe((v) => !v)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
                </Pressable>

                <Pressable onPress={() => router.push('/(auth)/forgot-password' as Href)}>
                  <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
                </Pressable>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#BA1A1A" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Primary CTA Submit */}
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
                    <Text style={styles.primarySubmitText}>Đăng nhập vào TàGo</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </Pressable>

              {/* Or Splitter */}
              <View style={styles.orDividerRow}>
                <View style={styles.orDividerLine} />
                <Text style={styles.orDividerText}>HOẶC TIẾP TỤC VỚI</Text>
                <View style={styles.orDividerLine} />
              </View>

              {/* Google Federation Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.googleBtnPressed,
                  googleLoading && { opacity: 0.65 },
                ]}
                onPress={() => void handleGoogleLogin()}
                disabled={loading || googleLoading}
              >
                <Image
                  source={require('@/assets/images/google-logo.png')}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleBtnText}>
                  {googleLoading ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}
                </Text>
              </Pressable>

              {/* Unverified Notice Link */}
              <View style={styles.unverifiedNoticeWrap}>
                <Text style={styles.unverifiedQuestion}>
                  Đã đăng ký nhưng chưa xác minh email?
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/verify-email',
                      params: { email: email.trim(), returnTo },
                    } as unknown as Href)
                  }
                >
                  <Text style={styles.unverifiedActionLink}>Kích hoạt OTP ngay</Text>
                </Pressable>
              </View>
            </View>

            {/* Heritage Trust Escrow Card */}
            <View style={styles.escrowCard}>
              <View style={styles.escrowIconCircle}>
                <MaterialIcons name="verified-user" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.escrowTextCol}>
                <Text style={styles.escrowTitle}>Bảo chứng Ký quỹ TàGo Escrow 100%</Text>
                <Text style={styles.escrowDesc}>
                  Khoản đặt cọc thuê trang phục & ekip chụp ảnh được giữ an toàn tuyệt đối tại
                  ngân hàng đối tác cho đến khi bạn hài lòng với file ảnh nhận về.
                </Text>
              </View>
            </View>
          </View>

          {/* Editorial Footer */}
          <View style={styles.footerWrap}>
            <View style={styles.footerInfoRow}>
              <View style={styles.footerInlineItem}>
                <Ionicons name="call" size={12} color="#BA0049" />
                <Text style={styles.footerText}>Hotline Cố Đô: 1900 6886</Text>
              </View>
              <Text style={styles.footerDot}>•</Text>
              <View style={styles.footerInlineItem}>
                <Ionicons name="location" size={12} color="#BA0049" />
                <Text style={styles.footerText}>Flagship: 26 Lê Lợi, TP. Huế</Text>
              </View>
            </View>
            <View style={styles.footerInlineItem}>
              <MaterialCommunityIcons name="lock-outline" size={13} color="#5F5E5E" />
              <Text style={styles.footerSslText}>
                Bảo mật dữ liệu chuẩn mã hóa SSL 256-bit
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
    paddingBottom: 28,
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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  trustRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  trustRatingScore: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  trustRatingCount: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
  },
  heroBannerWrap: {
    width: '100%',
    height: 224,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EFEDED',
    position: 'relative',
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
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBrandTitle: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroBadgePill: {
    backgroundColor: '#E31C5F',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heroBrandSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 4,
  },
  segmentedBar: {
    marginTop: 16,
    backgroundColor: '#E9E8E7',
    padding: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentTabText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#5F5E5E',
  },
  segmentTabTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
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
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  formHeaderBlock: {
    marginBottom: 16,
  },
  formOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  formTitle: {
    fontFamily: FontFamily.display,
    fontSize: 23,
    color: '#1B1C1C',
  },
  formSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
    marginTop: 4,
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
  inputLeftIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: '#1B1C1C',
    height: '100%',
  },
  eyeToggleBtn: {
    padding: 6,
    marginLeft: 4,
  },
  auxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  },
  checkboxChecked: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  rememberText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F5E5E',
  },
  forgotLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#BA0049',
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
    fontSize: 15,
    color: '#FFFFFF',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
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
    borderRadius: 999,
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
  unverifiedNoticeWrap: {
    alignItems: 'center',
    marginTop: 18,
    gap: 3,
  },
  unverifiedQuestion: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5F5E5E',
  },
  unverifiedActionLink: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#BA0049',
    textDecorationLine: 'underline',
  },

  escrowCard: {
    backgroundColor: 'rgba(255, 217, 222, 0.45)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(186, 0, 73, 0.14)',
  },
  escrowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E31C5F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  escrowTextCol: {
    flex: 1,
    gap: 3,
  },
  escrowTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#400014',
  },
  escrowDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#5B3F43',
  },

  footerWrap: {
    marginTop: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  footerInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
  },
  footerDot: {
    fontSize: 11,
    color: '#5F5E5E',
  },
  footerSslText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: 'rgba(95, 94, 94, 0.8)',
  },
});
