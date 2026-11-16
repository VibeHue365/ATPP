import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contractApi } from '@/apis/contractApi';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import type { ContractSummary } from '@/types/contract';
import { formatDateTime } from '@/utils/booking';
import { getContractStateBadge } from '@/utils/contractFormat';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ContractDetailModal } from './ContractDetailModal';
import { ContractPdfModal } from './ContractPdfModal';

interface Props {
  bookingId: string;
  bookingStatus: string;
  contractFlowVersion?: number | null;
  viewerRole?: 'customer' | 'provider';
  onOpenSign?: () => void;
  refreshTrigger?: number;
}

export function BookingContractsSection({
  bookingId,
  bookingStatus,
  contractFlowVersion,
  viewerRole = 'customer',
  onOpenSign,
  refreshTrigger = 0,
}: Props) {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ContractSummary | null>(
    null,
  );
  const [selectedPdf, setSelectedPdf] = useState<ContractSummary | null>(null);

  const loadContracts = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await contractApi.listForBooking(bookingId);
      setContracts(Array.isArray(list) ? list : []);
    } catch {
      if (contractFlowVersion === 2) {
        setError('Chưa tải được thông tin hợp đồng điện tử.');
      }
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId, contractFlowVersion]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts, refreshTrigger]);

  if (!loading && contracts.length === 0 && contractFlowVersion !== 2 && !error) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="document-text-outline"
            size={18}
            color={Colors.primary}
          />
          <Text style={styles.title}>Hợp đồng điện tử (V2)</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Pressable onPress={() => void loadContracts()}>
            <Ionicons name="refresh-outline" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{error}</Text>
          {viewerRole === 'customer' &&
            bookingStatus === 'PENDING_PAYMENT' &&
            onOpenSign && (
              <Pressable onPress={onOpenSign} style={styles.signBtn}>
                <Text style={styles.signBtnText}>Kiểm tra & Ký hợp đồng</Text>
              </Pressable>
            )}
        </View>
      ) : contracts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {bookingStatus === 'PENDING_PAYMENT' && viewerRole === 'customer'
              ? 'Đơn thuê này yêu cầu xác nhận Hợp đồng điện tử trước khi thanh toán.'
              : 'Hợp đồng điện tử đang được đồng bộ cho đơn hàng.'}
          </Text>
          {viewerRole === 'customer' &&
            bookingStatus === 'PENDING_PAYMENT' &&
            onOpenSign && (
              <Pressable onPress={onOpenSign} style={styles.signBtn}>
                <Ionicons name="create-outline" size={15} color={Colors.white} />
                <Text style={styles.signBtnText}>Mở & Ký hợp đồng ngay</Text>
              </Pressable>
            )}
        </View>
      ) : (
        <View style={styles.list}>
          {contracts.map((item) => {
            const badge = getContractStateBadge(item);
            const canCustomerSign =
              viewerRole === 'customer' &&
              bookingStatus === 'PENDING_PAYMENT' &&
              !item.isSigned &&
              Boolean(onOpenSign);
            const pdfReady =
              item.hasPdf ||
              item.pdfStatus === 'READY' ||
              item.state === 'EFFECTIVE' ||
              item.isSigned;

            return (
              <View key={item.contractId} style={styles.contractRow}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.contractCode}>
                      {item.contractCode ||
                        `HĐ-${item.contractId.slice(-6).toUpperCase()}`}
                      {item.version ? ` · v${item.version}` : ''}
                    </Text>
                    {item.providerName ? (
                      <Text style={styles.providerName}>
                        Cửa hàng: {item.providerName}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge label={badge.label} tone={badge.tone} />
                </View>

                {item.customerAcceptedAt ? (
                  <Text style={styles.signedMeta}>
                    Khách đã xác nhận lúc {formatDateTime(item.customerAcceptedAt)}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  {canCustomerSign && (
                    <Pressable onPress={onOpenSign} style={styles.signBtn}>
                      <Ionicons
                        name="create-outline"
                        size={14}
                        color={Colors.white}
                      />
                      <Text style={styles.signBtnText}>Ký ngay</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => setSelectedDetail(item)}
                    style={styles.secondaryBtn}
                  >
                    <Ionicons
                      name="eye-outline"
                      size={14}
                      color={Colors.text}
                    />
                    <Text style={styles.secondaryBtnText}>Xem điều khoản</Text>
                  </Pressable>

                  {pdfReady && (
                    <Pressable
                      onPress={() => setSelectedPdf(item)}
                      style={styles.pdfBtn}
                    >
                      <Ionicons
                        name="document-attach-outline"
                        size={14}
                        color={Colors.primary}
                      />
                      <Text style={styles.pdfBtnText}>Bản PDF</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <ContractDetailModal
        visible={Boolean(selectedDetail)}
        contractId={selectedDetail?.contractId ?? null}
        versionId={selectedDetail?.versionId ?? null}
        onClose={() => setSelectedDetail(null)}
      />

      <ContractPdfModal
        visible={Boolean(selectedPdf)}
        contractId={selectedPdf?.contractId ?? null}
        versionId={selectedPdf?.versionId ?? null}
        contractCode={selectedPdf?.contractCode}
        onClose={() => setSelectedPdf(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.text,
  },
  emptyBox: {
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  list: {
    gap: Spacing.sm,
  },
  contractRow: {
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  contractCode: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: Colors.text,
  },
  providerName: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  signedMeta: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: Colors.success,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  signBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.text,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  pdfBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
});
