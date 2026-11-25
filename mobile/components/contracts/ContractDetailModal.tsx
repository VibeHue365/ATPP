import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { contractApi } from '@/apis/contractApi';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import type { ContractDetail, ContractEvidenceSummary } from '@/types/contract';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDateTime } from '@/utils/booking';
import { getContractStateBadge } from '@/utils/contractFormat';
import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ContractDocumentView } from './ContractDocumentView';
import { ContractPdfModal } from './ContractPdfModal';

interface Props {
  visible: boolean;
  contractId: string | null;
  versionId?: string | null;
  onClose: () => void;
}

export function ContractDetailModal({
  visible,
  contractId,
  versionId,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [evidence, setEvidence] = useState<ContractEvidenceSummary | null>(null);
  const [pdfVisible, setPdfVisible] = useState(false);

  const load = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextDetail, nextEvidence] = await Promise.all([
        contractApi.getDetail(contractId),
        contractApi
          .getEvidence(contractId, versionId)
          .catch(() => null),
      ]);
      setDetail(nextDetail);
      setEvidence(nextEvidence);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải chi tiết hợp đồng.'));
    } finally {
      setLoading(false);
    }
  }, [contractId, versionId]);

  useEffect(() => {
    if (visible && contractId) {
      void load();
    } else {
      setDetail(null);
      setEvidence(null);
      setError(null);
      setPdfVisible(false);
    }
  }, [visible, contractId, load]);

  const badge = detail ? getContractStateBadge(detail) : null;
  const pdfReady =
    evidence?.documentStatus === 'READY' ||
    detail?.hasPdf ||
    detail?.pdfStatus === 'READY';

  return (
    <>
      <Modal
        visible={visible && !pdfVisible}
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
              {detail?.contractCode || 'Chi tiết Hợp đồng điện tử'}
            </Text>
            {detail?.providerName ? (
              <Text style={styles.headerSub} numberOfLines={1}>
                {detail.providerName}
              </Text>
            ) : null}
          </View>
          {detail && (
            <Pressable
              onPress={() => setPdfVisible(true)}
              style={styles.pdfBtn}
            >
              <Ionicons
                name="document-attach-outline"
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.pdfBtnText}>
                {pdfReady ? 'Xem PDF' : 'Tải PDF'}
              </Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.muted}>Đang tải nội dung hợp đồng...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons
              name="alert-circle-outline"
              size={42}
              color={Colors.error}
            />
            <Text style={styles.errorText}>{error}</Text>
            <AppButton
              title="Thử lại"
              onPress={() => void load()}
              fullWidth={false}
            />
          </View>
        ) : detail ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Status & Cryptographic Evidence Card */}
            <View style={styles.evidenceCard}>
              <View style={styles.evidenceTop}>
                <View style={styles.evidenceTitleRow}>
                  <Ionicons
                    name={
                      evidence?.integrityVerified
                        ? 'shield-checkmark'
                        : 'shield-outline'
                    }
                    size={18}
                    color={
                      evidence?.integrityVerified
                        ? Colors.success
                        : Colors.primary
                    }
                  />
                  <Text style={styles.evidenceTitle}>
                    Hồ sơ xác thực & Toàn vẹn điện tử
                  </Text>
                </View>
                {badge && (
                  <StatusBadge label={badge.label} tone={badge.tone} />
                )}
              </View>

              <Text style={styles.evidenceRow}>
                • Trạng thái tệp PDF:{' '}
                <Text style={styles.evidenceStrong}>
                  {evidence?.documentStatus === 'READY' || pdfReady
                    ? 'Đã phát hành PDF có chữ ký số'
                    : evidence?.documentStatus === 'GENERATING'
                      ? 'Đang kết xuất PDF...'
                      : detail.isSigned
                        ? 'Sẵn sàng hoặc đang hoàn tất'
                        : 'Chưa phát hành (hợp đồng chưa kích hoạt)'}
                </Text>
              </Text>

              {evidence?.customerConsent ? (
                <Text style={styles.evidenceRow}>
                  • Thời điểm đồng ý:{' '}
                  <Text style={styles.evidenceStrong}>
                    {formatDateTime(evidence.customerConsent.consentedAt)}
                  </Text>
                </Text>
              ) : null}

              {detail.contentHash ? (
                <Text style={styles.hashText}>
                  Content SHA-256: {detail.contentHash}
                </Text>
              ) : null}
              {evidence?.pdfSha256 ? (
                <Text style={styles.hashText}>
                  PDF SHA-256: {evidence.pdfSha256}
                </Text>
              ) : null}
            </View>

            <ContractDocumentView contract={detail} />
          </ScrollView>
        ) : null}
        </SafeAreaView>
      </Modal>

      <ContractPdfModal
        visible={visible && pdfVisible}
        contractId={detail?.contractId ?? contractId}
        versionId={detail?.versionId ?? versionId}
        contractCode={detail?.contractCode}
        fallbackText={detail?.renderedText}
        onClose={() => setPdfVisible(false)}
      />
    </>
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
    fontSize: 15,
    color: Colors.text,
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
  },
  pdfBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  muted: {
    fontFamily: FontFamily.body,
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13.5,
    color: Colors.error,
    textAlign: 'center',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  evidenceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
  },
  evidenceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  evidenceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  evidenceTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
  },
  evidenceRow: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  evidenceStrong: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.text,
  },
  hashText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
});
