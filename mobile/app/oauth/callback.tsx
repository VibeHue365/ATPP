import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';

export default function OAuthCallbackScreen() {
  const { code, error: queryError } = useLocalSearchParams<{ code?: string; error?: string }>();
  const { user, loginWithOAuthCode } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function handleExchange() {
      if (user) {
        if (user.hasCompletedOnboarding === false) {
          router.replace('/preferences');
        } else {
          router.replace('/(tabs)');
        }
        return;
      }

      if (queryError) {
        if (active) setErrorMessage('Đăng nhập Google thất bại hoặc bị hủy.');
        return;
      }

      if (!code) {
        if (active) setErrorMessage('Không tìm thấy mã xác thực Google.');
        return;
      }

      try {
        const loggedInUser = await loginWithOAuthCode(code);
        if (!active) return;

        if (loggedInUser.hasCompletedOnboarding === false) {
          router.replace('/preferences');
        } else {
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        if (active) {
          if (user) {
            router.replace('/(tabs)');
            return;
          }
          setErrorMessage(getApiErrorMessage(err, 'Đăng nhập Google không thành công.'));
        }
      }
    }

    void handleExchange();

    return () => {
      active = false;
    };
  }, [code, queryError, loginWithOAuthCode, user]);

  return (
    <View style={styles.container}>
      {errorMessage ? (
        <>
          <Text style={styles.title}>Đăng nhập không thành công</Text>
          <Text style={styles.desc}>{errorMessage}</Text>
          <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>
            Quay lại trang Đăng nhập
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#BA0049" />
          <Text style={styles.title}>Đang xử lý đăng nhập Google...</Text>
          <Text style={styles.desc}>Vui lòng chờ trong giây lát</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 18,
    fontFamily: FontFamily.display,
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  link: {
    marginTop: 20,
    fontSize: 14,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
});
