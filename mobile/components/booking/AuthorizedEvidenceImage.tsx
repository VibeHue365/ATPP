import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp } from 'react-native';
import { API_BASE_URL } from '@/apis/httpClient';
import { getMediaUrl } from '@/utils/media';
import { tokenStorage } from '@/utils/storage';

interface AuthorizedEvidenceImageProps {
  bookingId: string;
  itemId?: string | null;
  fileOrUrl: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}

const DIRECT_URL_OR_PATH = /^(?:https?:|data:|blob:|\/)/i;

export function buildEvidenceImageUri(
  bookingId: string,
  fileOrUrl: string,
  itemId?: string | null,
): string {
  const clean = fileOrUrl.trim();
  if (!clean) return '';
  if (clean.startsWith('private://')) {
    return `${API_BASE_URL.replace(/\/$/, '')}/api/disputes/evidence?ref=${encodeURIComponent(clean)}`;
  }
  if (DIRECT_URL_OR_PATH.test(clean)) {
    return getMediaUrl(clean) || clean;
  }
  if (itemId) {
    return `${API_BASE_URL.replace(/\/$/, '')}/bookings/${bookingId}/items/${itemId}/rental/evidence/${encodeURIComponent(clean)}`;
  }
  return getMediaUrl(clean) || clean;
}

export function AuthorizedEvidenceImage({
  bookingId,
  itemId,
  fileOrUrl,
  style,
  contentFit = 'cover',
}: AuthorizedEvidenceImageProps) {
  const [token, setToken] = useState<string | null>(null);
  const cleanRef = fileOrUrl.trim();
  const needsAuth =
    cleanRef.startsWith('private://') ||
    cleanRef.includes('/rental/evidence/') ||
    cleanRef.includes('/api/disputes/evidence') ||
    (!DIRECT_URL_OR_PATH.test(cleanRef) && Boolean(itemId));

  useEffect(() => {
    if (!needsAuth) return;
    let active = true;
    void tokenStorage.getAccessToken().then((val) => {
      if (active) setToken(val);
    });
    return () => {
      active = false;
    };
  }, [needsAuth]);

  const uri = buildEvidenceImageUri(bookingId, fileOrUrl, itemId);
  if (!uri || (needsAuth && !token)) {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <Image
      source={
        needsAuth && token
          ? { uri, headers: { Authorization: `Bearer ${token}` } }
          : { uri }
      }
      style={style}
      contentFit={contentFit}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#F3F4F6',
  },
});
