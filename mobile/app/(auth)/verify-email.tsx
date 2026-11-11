import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import { FontFamily } from '@/constants/theme';
import { getApiErrorMessage } from '@/utils/apiError';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; otp?: string; returnTo?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [editingEmail, setEditingEmail] = useState(!params.email);
  const [otp, setOtp] = useState((params.otp ?? '').replace(/\D/g, '').slice(0, 6));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(58);
  const [message, setMessage] = useState(
    params.otp ? 'Mã OTP demo đã được điền tự động.' : ''
  );
  const [error, setError] = useState('');

  const otpInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verify = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Vui lòng nhập đúng địa chỉ email đã đăng ký.');
      setEditingEmail(true);
      return;
    }
    if (!/^[0-9]{6}$/.test(otp)) {
      setError('Vui lòng nhập đủ mã OTP gồm 6 chữ số.');
      otpInputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.verifyEmail({ email: cleanEmail, otp });
      router.replace({
        pathname: '/(auth)/login',
        params: { returnTo: params.returnTo },
      } as unknown as Href);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Mã OTP không hợp lệ hoặc đã hết hạn.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Vui lòng nhập đúng địa chỉ email trước khi gửi lại mã.');
      setEditingEmail(true);
      return;
    }
    setResending(true);
    setError('');
    try {
      const result = await authApi.resendVerification(cleanEmail);
      if (result.demoOtp) {
        setOtp(result.demoOtp.replace(/\D/g, '').slice(0, 6));
      }
      setMessage('Mã OTP mới đã được gửi đến hộp thư của bạn.');
      setCooldown(60);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Không thể gửi lại mã OTP.'));
    } finally {
      setResending(false);
    }
  };

  const remainingDigits = Math.max(0, 6 - otp.length);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Sticky Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(auth)/login' as Href)
          }
        >
          <Ionicons name="arrow-back" size={22} color="#1B1C1C" />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Xác thực Email
        </Text>

        <View style={styles.headerUserCircle}>
          <Ionicons name="person" size={16} color="#FFFFFF" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status Badge & Step Indicator */}
          <View style={styles.stepIndicatorRow}>
            <View style={styles.stepPill}>
              <View style={styles.stepPulseDot} />
              <Text style={styles.stepPillText}>Bước 2/2 · Xác thực tài khoản</Text>
            </View>
            <View style={styles.verifiedBrandRow}>
              <MaterialIcons name="verified" size={15} color="#BA0049" />
              <Text style={styles.verifiedBrandText}>TÀGO CỐ ĐÔ</Text>
            </View>
          </View>

          {/* Hero Identity Card */}
          <View style={styles.identityCard}>
            {/* Royal Seal / Security Emblem */}
            <View style={styles.emblemOuterWrap}>
              <View style={styles.emblemOuterCircle}>
                <View style={styles.emblemInnerCircle}>
                  <MaterialIcons name="mark-email-read" size={28} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.emblemStarBadge}>
                <MaterialIcons name="stars" size={15} color="#BA0049" />
              </View>
            </View>

            <Text style={styles.identityTitle}>Kích hoạt tài khoản TàGo</Text>
            <Text style={styles.identitySubtitle}>
              Mã xác thực 6 số vừa được gửi đến hộp thư:
            </Text>

            {editingEmail ? (
              <View style={styles.emailEditRow}>
                <Ionicons name="mail-outline" size={16} color="#BA0049" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Nhập địa chỉ email của bạn..."
                  placeholderTextColor="rgba(95, 94, 94, 0.6)"
                  style={styles.emailEditInput}
                />
                {email.trim().length > 3 && (
                  <Pressable
                    style={styles.emailEditDoneBtn}
                    onPress={() => setEditingEmail(false)}
                  >
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                style={styles.emailDisplayPill}
                onPress={() => setEditingEmail(true)}
              >
                <Ionicons name="mail" size={15} color="#BA0049" />
                <Text style={styles.emailDisplayText} numberOfLines={1}>
                  {email}
                </Text>
                <View style={styles.emailEditMiniBtn}>
                  <MaterialIcons name="edit" size={13} color="#5B3F43" />
                </View>
              </Pressable>
            )}
          </View>

          {/* Interactive 6-Digit OTP Field Container */}
          <Pressable
            style={styles.otpCard}
            onPress={() => otpInputRef.current?.focus()}
          >
            <View style={styles.otpHeaderRow}>
              <Text style={styles.otpHeaderLabel}>MÃ OTP BÍ MẬT</Text>
              <View style={styles.otpSecurityRow}>
                <Ionicons name="lock-closed" size={12} color="#BA0049" />
                <Text style={styles.otpSecurityText}>Bảo mật 1 lớp</Text>
              </View>
            </View>

            {/* Hidden Input for capturing 6 digits */}
            <TextInput
              ref={otpInputRef}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.hiddenOtpInput}
              autoFocus
            />

            {/* 6 Input Slots Grid */}
            <View style={styles.otpSlotsRow}>
              {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                const digit = otp[slotIdx];
                const isActive = otp.length === slotIdx || (otp.length === 6 && slotIdx === 5);
                return (
                  <Pressable
                    key={slotIdx}
                    style={[styles.otpSlotBox, isActive && styles.otpSlotBoxActive]}
                    onPress={() => otpInputRef.current?.focus()}
                  >
                    {digit ? (
                      <Text style={styles.otpDigitText}>{digit}</Text>
                    ) : isActive ? (
                      <View style={styles.otpCaret} />
                    ) : (
                      <View style={styles.otpEmptyDot} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.otpHelperHint}>
              {remainingDigits > 0
                ? `Nhập nốt ${remainingDigits} chữ số từ thư xác thực của TàGo`
                : 'Đã nhập đủ 6 chữ số xác thực'}
            </Text>
          </Pressable>

          {!!message && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#047857" />
              <Text style={styles.successText}>{message}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#BA1A1A" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary CTA Action & Resend Timer Flow */}
          <View style={styles.ctaSection}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryVerifyBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                loading && { opacity: 0.7 },
              ]}
              disabled={loading}
              onPress={() => void verify()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryVerifyText}>Xác minh & Hoàn tất</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              <Text style={styles.resendPrompt}>Chưa nhận được mã?</Text>
              <Pressable
                disabled={cooldown > 0 || resending}
                onPress={() => void resend()}
                style={styles.resendBtn}
              >
                <Text
                  style={[
                    styles.resendBtnText,
                    (cooldown > 0 || resending) && { opacity: 0.65 },
                  ]}
                >
                  {resending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
                </Text>
                <View
                  style={[
                    styles.timerBadge,
                    cooldown === 0 && styles.timerBadgeReady,
                  ]}
                >
                  <Text
                    style={[
                      styles.timerBadgeText,
                      cooldown === 0 && { color: '#FFFFFF' },
                    ]}
                  >
                    {cooldown > 0 ? `${cooldown}s` : 'Gửi ngay'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Benefit Escrow & Protection Guarantee Card */}
          <View style={styles.benefitCard}>
            <View style={styles.benefitIconBox}>
              <MaterialIcons name="verified-user" size={20} color="#BA0049" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.benefitTitleRow}>
                <Text style={styles.benefitTitle}>TàGo Escrow Bảo Chứng 100%</Text>
                <View style={styles.benefitPromoBadge}>
                  <Text style={styles.benefitPromoBadgeText}>ƯU ĐÃI</Text>
                </View>
              </View>
              <Text style={styles.benefitDesc}>
                Tài khoản xác thực ngay sẽ được nhận voucher{' '}
                <Text style={styles.benefitHighlight}>100.000đ</Text> và đặc quyền Ký quỹ Cổ phục{' '}
                <Text style={styles.benefitDarkBold}>0đ</Text> trong lần thuê chụp đầu tiên.
              </Text>
            </View>
          </View>

          {/* Authentic Hue Heritage Visual Proof Strip */}
          <View style={styles.heritageStripCard}>
            <Image
              source={require('@/assets/images/hero-gam-moi-v2.webp')}
              style={styles.heritageStripThumb}
              resizeMode="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.heritageStripOverline}>DI SẢN CỔ PHỤC & NHIẾP ẢNH</Text>
              <Text style={styles.heritageStripTitle} numberOfLines={1}>
                Áo Nhật Bình · Phượng Bào · Cung Diên Thọ
              </Text>
              <Text style={styles.heritageStripSub} numberOfLines={1}>
                Hơn 12.000 lữ khách đã bảo lưu khoảnh khắc Huế
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footerWrap}>
            <View style={styles.footerInfoRow}>
              <View style={styles.footerInlineItem}>
                <Ionicons name="call" size={12} color="#BA0049" />
                <Text style={styles.footerText}>
                  Hotline: <Text style={styles.footerBold}>1900 6886</Text>
                </Text>
              </View>
              <Text style={styles.footerDot}>•</Text>
              <View style={styles.footerInlineItem}>
                <Ionicons name="location-outline" size={12} color="#5B3F43" />
                <Text style={styles.footerText}>26 Lê Lợi, TP. Huế</Text>
              </View>
            </View>
            <View style={styles.sslPill}>
              <Ionicons name="lock-closed" size={11} color="#BA0049" />
              <Text style={styles.sslPillText}>
                Mã hóa SSL 256-bit bảo mật theo tiêu chuẩn ngân hàng
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
  topHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(251, 249, 249, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228, 189, 194, 0.28)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 17,
    color: '#1B1C1C',
  },
  headerUserCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E9E8E7',
  },
  stepPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BA0049',
  },
  stepPillText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5B3F43',
  },
  verifiedBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBrandText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
    letterSpacing: 0.5,
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.3)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  emblemOuterWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  emblemOuterCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemInnerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emblemStarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  identityTitle: {
    fontFamily: FontFamily.display,
    fontSize: 21,
    color: '#1B1C1C',
    textAlign: 'center',
    marginBottom: 6,
  },
  identitySubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#5B3F43',
    textAlign: 'center',
  },
  emailDisplayPill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3F3',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '100%',
  },
  emailDisplayText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#1B1C1C',
    flexShrink: 1,
  },
  emailEditMiniBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFEDED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailEditRow: {
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BA0049',
  },
  emailEditInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: '#1B1C1C',
    paddingVertical: 4,
  },
  emailEditDoneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },

  otpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.35)',
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  otpHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  otpHeaderLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5B3F43',
    letterSpacing: 0.8,
  },
  otpSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  otpSecurityText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#BA0049',
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpSlotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    maxWidth: 340,
  },
  otpSlotBox: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  otpSlotBoxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BA0049',
  },
  otpDigitText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 21,
    color: '#1B1C1C',
  },
  otpCaret: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: '#BA0049',
  },
  otpEmptyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E4BDC2',
  },
  otpHelperHint: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5B3F43',
    textAlign: 'center',
    marginTop: 12,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  successText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#065F46',
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

  ctaSection: {
    gap: 14,
    marginBottom: 22,
  },
  primaryVerifyBtn: {
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
  primaryVerifyText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resendPrompt: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5B3F43',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#BA0049',
  },
  timerBadge: {
    backgroundColor: '#FFD9DE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  timerBadgeReady: {
    backgroundColor: '#BA0049',
  },
  timerBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#400014',
  },

  benefitCard: {
    backgroundColor: '#F5F3F3',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  benefitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  benefitTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  benefitPromoBadge: {
    backgroundColor: '#BA0049',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  benefitPromoBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  benefitDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#5B3F43',
  },
  benefitHighlight: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  benefitDarkBold: {
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },

  heritageStripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.3)',
  },
  heritageStripThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#EFEDED',
  },
  heritageStripOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#BA0049',
    letterSpacing: 0.6,
  },
  heritageStripTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#1B1C1C',
    marginTop: 1,
  },
  heritageStripSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#5B3F43',
    marginTop: 1,
  },

  footerWrap: {
    alignItems: 'center',
    gap: 8,
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
    color: '#5B3F43',
  },
  footerBold: {
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  footerDot: {
    fontSize: 11,
    color: '#E4BDC2',
  },
  sslPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFEDED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sslPillText: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#636262',
  },
});
