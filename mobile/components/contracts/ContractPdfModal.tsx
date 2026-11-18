import { createElement, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { contractApi, type DownloadedContractPdf } from '@/apis/contractApi';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/utils/apiError';
import { buildAndroidPdfViewerHtml } from '@/utils/contractFormat';
import { AppButton } from '@/components/ui/AppButton';

interface Props {
  visible: boolean;
  contractId: string | null;
  versionId?: string | null;
  contractCode?: string | null;
  fallbackText?: string | null;
  onClose: () => void;
}

export function ContractPdfModal({
  visible,
  contractId,
  versionId,
  contractCode,
  fallbackText,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<DownloadedContractPdf | null>(null);
  const [webBlobUrl, setWebBlobUrl] = useState<string | null>(null);

  const loadPdf = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await contractApi.downloadPdf(contractId, versionId);
      setPdf(data);
      if (Platform.OS === 'web' && data.blob && typeof URL !== 'undefined') {
        const nextUrl = URL.createObjectURL(data.blob);
        setWebBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      }
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'Không thể tải bản PDF hợp đồng. Vui lòng thử lại sau.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [contractId, versionId]);

  useEffect(() => {
    if (visible && contractId) {
      void loadPdf();
    } else {
      setPdf(null);
      setError(null);
      setWebBlobUrl((prev) => {
        if (prev && typeof URL !== 'undefined') URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [visible, contractId, loadPdf]);

  useEffect(() => {
    return () => {
      if (webBlobUrl && typeof URL !== 'undefined') {
        URL.revokeObjectURL(webBlobUrl);
      }
    };
  }, [webBlobUrl]);

  const handleOpenWebDownload = () => {
    if (Platform.OS !== 'web' || !webBlobUrl || typeof document === 'undefined') {
      return;
    }
    const link = document.createElement('a');
    link.href = webBlobUrl;
    link.download = pdf?.filename || `hop-dong-${contractCode || 'tago'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {pdf?.filename ||
                `Bản PDF ${contractCode || 'Hợp đồng điện tử'}`}
            </Text>
            {pdf?.sha256 ? (
              <Text style={styles.shaText} numberOfLines={1}>
                SHA-256: {pdf.sha256.slice(0, 14)}...{pdf.sha256.slice(-8)}
              </Text>
            ) : null}
          </View>
          {Platform.OS === 'web' && webBlobUrl ? (
            <Pressable onPress={handleOpenWebDownload} style={styles.iconBtn}>
              <Ionicons
                name="download-outline"
                size={20}
                color={Colors.primary}
              />
            </Pressable>
          ) : (
            <Pressable onPress={() => void loadPdf()} style={styles.iconBtn}>
              <Ionicons
                name="refresh-outline"
                size={20}
                color={Colors.primary}
              />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.stateText}>
              Đang tải tài liệu PDF đã ký số...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons
              name="document-lock-outline"
              size={44}
              color={Colors.warning}
            />
            <Text style={styles.errorTitle}>Chưa thể mở tài liệu PDF</Text>
            <Text style={styles.stateText}>{error}</Text>
            <View style={styles.retryRow}>
              <AppButton
                title="Thử tải lại"
                onPress={() => void loadPdf()}
                fullWidth={false}
              />
              <AppButton
                title="Đóng"
                variant="secondary"
                onPress={onClose}
                fullWidth={false}
              />
            </View>
          </View>
        ) : pdf ? (
          <View style={styles.viewer}>
            {Platform.OS === 'web' && webBlobUrl ? (
              createElement('iframe', {
                src: webBlobUrl,
                title: pdf.filename,
                style: { width: '100%', height: '100%', border: 'none' },
              })
            ) : Platform.OS === 'ios' ? (
              <WebView
                originWhitelist={['*']}
                source={{ uri: `data:application/pdf;base64,${pdf.base64}` }}
                style={styles.viewer}
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                javaScriptEnabled
                source={{
                  html: buildAndroidPdfViewerHtml(
                    pdf.base64,
                    fallbackText,
                    contractCode || 'Hợp đồng điện tử',
                  ),
                }}
                style={styles.viewer}
              />
            )}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSoft,
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.text,
  },
  shaText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.success,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  errorTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: Colors.text,
  },
  stateText: {
    fontFamily: FontFamily.body,
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  viewer: {
    flex: 1,
    backgroundColor: Colors.surfaceSoft,
  },
});
