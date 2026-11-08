import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkoutApi } from '@/apis/checkoutApi';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { pendingCheckoutStorage } from '@/services/pendingCheckout';
import type { PaymentStatusResponse } from '@/types/checkout';
import { getApiErrorMessage } from '@/utils/apiError';

type ViewState = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'ERROR';

export default function PaymentResultScreen() {
  const { code = '' } = useLocalSearchParams<{ code?: string }>();
  const { removeItem } = useCart();
  const [state, setState] = useState<ViewState>('PENDING');
  const [message, setMessage] = useState('Hệ thống đang xác minh giao dịch thanh toán của bạn.');
  const [result, setResult] = useState<PaymentStatusResponse | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const verify = useCallback(async () => {
    if (!code) {
      setState('ERROR');
      setMessage('Không tìm thấy mã giao dịch để xác minh.');
      return true;
    }
    setChecking(true);
    try {
      const data = await checkoutApi.status(code);
      setResult(data);
      if (data.paymentStatus === 'SUCCESS' && data.confirmed) {
        const pending = await pendingCheckoutStorage.get(code);
        pending?.cartItemIds.forEach(removeItem);
        await pendingCheckoutStorage.remove(code);
        setState('SUCCESS');
        setMessage(
          'Vé điện tử và lịch hẹn của bạn đã được kích hoạt. Bạn có thể xuất trình mã QR tại tiệm để nhận đồ.'
        );
        return true;
      }
      if (data.bookingStatus === 'CANCELLED' && data.paymentStatus === 'PENDING') {
        setState('EXPIRED');
        setMessage(
          'Phiên giữ chỗ đã hết hạn. Vui lòng kiểm tra lại lịch trống trước khi tạo giao dịch mới.'
        );
        return true;
      }
      if (
        data.paymentStatus === 'FAILED' ||
        data.paymentStatus === 'CANCELLED' ||
        data.bookingStatus === 'CANCELLED'
      ) {
        setState('FAILED');
        setMessage(
          'Giao dịch chưa hoàn tất. Các dịch vụ của bạn vẫn được giữ nguyên trong giỏ hàng.'
        );
        return true;
      }
      setState('PENDING');
      setMessage('Giao dịch đang chờ cổng thanh toán xác nhận. Quá trình này chỉ mất ít giây.');
      return false;
    } catch (error) {
      setState('ERROR');
      setMessage(getApiErrorMessage(error, 'Chưa thể kiểm tra giao dịch lúc này.'));
      return true;
    } finally {
      setChecking(false);
    }
  }, [code, removeItem]);

  useEffect(() => {
    let stopped = false,
      count = 0,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const done = await verify();
      if (!stopped && !done && ++count < 30) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [verify]);

  useEffect(() => {
    if (!code) return;
    void pendingCheckoutStorage.get(code).then((pending) => setCheckoutUrl(pending?.checkoutUrl ?? null));
  }, [code]);

  const openCheckout = () => {
    if (!checkoutUrl) return;
    if (Platform.OS === 'web') {
      void Linking.openURL(checkoutUrl);
      return;
    }
    router.push({
      pathname: '/payment/webview',
      params: { code, url: checkoutUrl },
    } as unknown as Href);
  };

  const success = state === 'SUCCESS';
  const pending = state === 'PENDING';
  const expired = state === 'EXPIRED';
  const icon = success
    ? 'checkmark-circle'
    : pending
      ? 'time-outline'
      : expired
        ? 'hourglass-outline'
        : 'alert-circle-outline';
  const color = success ? Colors.success : pending ? Colors.warning : Colors.error;
  const qrData = result?.bookingId || code || 'TAGO-TICKET';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(qrData)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.close} onPress={() => router.replace('/' as Href)}>
          <Ionicons name="close" size={22} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.brand}>TàGo</Text>
          <Text style={styles.tagline}>TRẠNG THÁI GIAO DỊCH</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.icon,
            {
              borderColor: color,
              backgroundColor: success
                ? '#EDF9F2'
                : pending
                  ? '#FFFBEB'
                  : '#FDECEE',
            },
          ]}>
          <Ionicons name={icon} size={46} color={color} />
        </View>

        <Text style={styles.title}>
          {success
            ? 'Đặt lịch & Thanh toán thành công!'
            : pending
              ? 'Đang xác nhận thanh toán'
              : expired
                ? 'Thời gian giữ chỗ đã hết'
                : 'Thanh toán chưa hoàn tất'}
        </Text>
        <Text style={styles.message}>{message}</Text>

        {success && (
          <View style={styles.qrCard}>
            <Image source={qrUrl} style={styles.qrImage} contentFit="contain" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.qrEyebrow}>VÉ ĐIỆN TỬ ĐÃ KÍCH HOẠT</Text>
              <Text style={styles.qrTitle}>
                #{result?.bookingId?.slice(-8).toUpperCase() ?? code.toUpperCase()}
              </Text>
              <Text style={styles.qrSub}>
                Mở chi tiết lịch hẹn để xem mã QR check-in toàn màn hình khi đến tiệm.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.notice}>
          <Ionicons
            name={success ? 'shield-checkmark' : 'information-circle-outline'}
            size={21}
            color={color}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color }]}>
              {success
                ? 'Khoản thanh toán được bảo vệ bởi TàGo Escrow'
                : expired
                  ? 'Phiên giữ chỗ tạm thời đã hết hạn'
                  : pending
                    ? 'Đang đồng bộ từ cổng thanh toán'
                    : 'Giao dịch chưa được ghi nhận'}
            </Text>
            <Text style={styles.noticeText}>
              {success
                ? 'Tiệm cổ phục và Studio đã nhận được lịch hẹn của bạn và đang chuẩn bị chu đáo.'
                : expired
                  ? 'Hệ thống đã giải phóng lịch tạm giữ. Bạn vui lòng kiểm tra lại lịch trống trước khi thanh toán.'
                  : 'Bạn có thể bấm Kiểm tra lại hoặc mở lại cổng thanh toán.'}
            </Text>
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.detailsTitle}>CHI TIẾT GIAO DỊCH</Text>
          <Info label="Mã giao dịch" value={code ? code.toUpperCase() : '—'} />
          <Info
            label="Mã đơn đặt lịch"
            value={result?.bookingId?.slice(-10).toUpperCase() ?? 'Đang cập nhật'}
          />
          <Info label="Trạng thái" value={result?.paymentStatus ?? state} color={color} />
        </View>

        <View style={styles.actions}>
          {pending && checkoutUrl && (
            <AppButton title="Mở lại cổng thanh toán" onPress={openCheckout} />
          )}
          {(pending || state === 'ERROR') && (
            <AppButton
              title="Kiểm tra lại trạng thái"
              variant={checkoutUrl ? 'secondary' : 'primary'}
              loading={checking}
              onPress={() => void verify()}
            />
          )}
          {success && result?.bookingId && (
            <AppButton
              title="Xem Vé Điện Tử & Chi tiết lịch hẹn"
              onPress={() => router.replace(`/booking/${result.bookingId}` as Href)}
            />
          )}
          {success && (
            <AppButton
              title="Quản lý tất cả lịch hẹn"
              variant="secondary"
              onPress={() => router.replace('/(tabs)/bookings' as Href)}
            />
          )}
          {(state === 'FAILED' || expired) && (
            <AppButton
              title={expired ? 'Kiểm tra lại dịch vụ' : 'Quay lại giỏ hàng'}
              onPress={() => router.replace('/cart' as Href)}
            />
          )}
          <AppButton
            title="Về trang chủ Khám phá"
            variant="secondary"
            onPress={() => router.replace('/' as Href)}
          />
        </View>

        <Text style={styles.help}>
          Cần hỗ trợ? Lưu mã giao dịch #{code.toUpperCase()} để đội ngũ TàGo Care hỗ trợ ngay lập tức.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: Colors.primary,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: '#8F8E8E',
    textAlign: 'center',
  },
  placeholder: { width: 38 },
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  icon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    lineHeight: 34,
    color: '#1B1C1C',
    textAlign: 'center',
    marginTop: 18,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 20,
    color: '#5F5E5E',
    textAlign: 'center',
    marginTop: 8,
  },
  qrCard: {
    width: '100%',
    marginTop: 20,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFD9E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadow,
  },
  qrImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  qrEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: Colors.primary,
  },
  qrTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: '#1B1C1C',
  },
  qrSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
  },
  notice: {
    width: '100%',
    marginTop: 16,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    flexDirection: 'row',
    gap: 10,
    ...Shadow,
  },
  noticeTitle: { fontFamily: FontFamily.bodyBold, fontSize: 12.5 },
  noticeText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 17,
    color: '#5F5E5E',
    marginTop: 4,
  },
  details: {
    width: '100%',
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  detailsTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: '#8F8E8E',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3F3',
  },
  infoLabel: { fontFamily: FontFamily.body, fontSize: 11.5, color: '#5F5E5E' },
  infoValue: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: '#1B1C1C' },
  actions: { width: '100%', gap: 10, marginTop: 22 },
  help: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 18,
  },
});
