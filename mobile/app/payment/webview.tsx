import { Ionicons } from '@expo/vector-icons';
import { type Href, Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Colors, FontFamily } from '@/constants/theme';

export default function PaymentWebViewScreen() {
  const { code = '', url = '' } = useLocalSearchParams<{ code?: string; url?: string }>();
  const handled = useRef(false);
  const showResult = useCallback(() => {
    if (handled.current) return;
    handled.current = true;
    router.replace({ pathname: '/payment/result', params: { code } } as unknown as Href);
  }, [code]);
  const shouldLoad = useCallback((request: Pick<WebViewNavigation, 'url'>) => {
    const target = request.url;
    const isAppCallback = target.startsWith('vibehue://payment/');
    const isProviderResult = /[?&]status=(?:PAID|SUCCESS|CANCELLED|CANCEL)(?:&|$)/i.test(target);
    if (isAppCallback || isProviderResult) {
      showResult();
      return false;
    }
    return true;
  }, [showResult]);

  if (!code || !url) return <Redirect href={code ? `/payment/result?code=${encodeURIComponent(code)}` : '/payment/result'} />;
  if (Platform.OS === 'web') return <Redirect href={`/payment/result?code=${encodeURIComponent(code)}`} />;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng trang thanh toán" style={styles.close} onPress={showResult}><Ionicons name="close" size={23} color={Colors.text} /></Pressable>
      <View><Text style={styles.brand}>LUMÉ</Text><Text style={styles.title}>Thanh toán an toàn</Text></View>
      <View style={styles.placeholder} />
    </View>
    <WebView
      source={{ uri: url }}
      originWhitelist={['http://*', 'https://*', 'vibehue://*']}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      onShouldStartLoadWithRequest={shouldLoad}
      onNavigationStateChange={shouldLoad}
      renderLoading={() => <View style={styles.loading}><ActivityIndicator color={Colors.primary} /><Text style={styles.loadingText}>Đang mở cổng thanh toán...</Text></View>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  close: { width: 38, height: 38, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: FontFamily.display, fontSize: 15, letterSpacing: 3, color: Colors.primary, textAlign: 'center' },
  title: { fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Colors.text, marginTop: 2, textAlign: 'center' },
  placeholder: { width: 38 },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.background },
  loadingText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
});
