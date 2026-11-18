import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TagoConfirmOverlay } from '@/components/ui/TagoAlertModal';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import {
  resolveDamageCompensationRules,
  type BookingReadinessResponse,
  type ContractDetail,
  type ContractPresentationMode,
} from '@/types/contract';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDate, formatDateTime } from '@/utils/booking';
import {
  createConsentIdempotencyKey,
  formatContractMoney,
  formatDamageTierValue,
  getContractReadinessMeta,
} from '@/utils/contractFormat';
import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ContractDocumentView } from './ContractDocumentView';

interface Props {
  visible: boolean;
  bookingId: string | null;
  holdExpiresAt?: string | null;
  onClose: () => void;
  onReadyToPay: () => void;
  onDeclinedOrCancelled?: () => void;
}

function asObj(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, any>)
    : null;
}

export function ContractReviewModal({
  visible,
  bookingId,
  holdExpiresAt,
  onClose,
  onReadyToPay,
  onDeclinedOrCancelled,
}: Props) {
  const { show } = useToast();
  const { bumpBookingSync, pushLocalBanner } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingStale, setRefreshingStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<BookingReadinessResponse | null>(
    null,
  );
  const [detailsByContractId, setDetailsByContractId] = useState<
    Record<string, ContractDetail>
  >({});
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [viewMode, setViewMode] =
    useState<ContractPresentationMode>('DETAILED');
  const [agreed, setAgreed] = useState(false);
  const [declineConfirmOpen, setDeclineConfirmOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadContracts = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const nextReadiness = await contractApi.getBookingReadiness(bookingId);
      setReadiness(nextReadiness);

      if (nextReadiness.requirement !== 'REQUIRED' || nextReadiness.ready) {
        onReadyToPay();
        return;
      }

      const contractIds = Array.from(
        new Set(
          nextReadiness.providers
            .map((p) => p.contractId)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const loadedEntries = await Promise.all(
        contractIds.map(async (id) => {
          const detail = await contractApi.getDetail(id);
          return [id, detail] as const;
        }),
      );
      const nextMap = Object.fromEntries(loadedEntries);
      setDetailsByContractId(nextMap);

      const firstUnsigned =
        nextReadiness.providers.find((p) => p.status !== 'ACCEPTED') ??
        nextReadiness.providers[0];
      if (firstUnsigned) {
        setActiveProviderId(firstUnsigned.providerId);
        const mode =
          firstUnsigned.presentationMode ||
          (firstUnsigned.contractId
            ? nextMap[firstUnsigned.contractId]?.presentationMode
            : null) ||
          nextReadiness.overallPresentationMode ||
          'DETAILED';
        setViewMode(mode === 'QUICK' ? 'QUICK' : 'DETAILED');
      }
      setAgreed(false);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Không thể tải thông tin hợp đồng điện tử.'),
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, onReadyToPay]);

  useEffect(() => {
    if (visible && bookingId) {
      void loadContracts();
    } else {
      setReadiness(null);
      setDetailsByContractId({});
      setActiveProviderId(null);
      setError(null);
      setAgreed(false);
      setDeclineConfirmOpen(false);
    }
  }, [visible, bookingId, loadContracts]);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const activeEntry = useMemo(() => {
    if (!readiness?.providers.length) return null;
    return (
      readiness.providers.find((p) => p.providerId === activeProviderId) ??
      readiness.providers[0]
    );
  }, [readiness, activeProviderId]);

  const activeDetail = useMemo(() => {
    if (!activeEntry?.contractId) return null;
    return detailsByContractId[activeEntry.contractId] ?? null;
  }, [activeEntry, detailsByContractId]);

  const effectiveExpiresAt = holdExpiresAt || activeDetail?.expiresAt || null;
  const remainingSec = useMemo(() => {
    if (!effectiveExpiresAt) return null;
    const ms = new Date(effectiveExpiresAt).getTime() - nowMs;
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.floor(ms / 1000));
  }, [effectiveExpiresAt, nowMs]);

  const isExpired =
    (remainingSec !== null && remainingSec <= 0) ||
    activeEntry?.status === 'EXPIRED';

  const needsRefresh =
    activeEntry?.status === 'STALE_SNAPSHOT' ||
    Boolean(
      readiness?.blockers?.some((b) =>
        b.includes('STALE') || b.includes('BOOKING_NOT_PREPARABLE'),
      ),
    );

  const countdownLabel = useMemo(() => {
    if (remainingSec === null) return null;
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [remainingSec]);

  const handleRefreshVersion = async () => {
    if (!bookingId) return;
    setRefreshingStale(true);
    try {
      await contractApi.refreshContracts(bookingId);
      show('Đã cập nhật phiên bản hợp đồng mới nhất.', 'success');
      await loadContracts();
    } catch (err) {
      show(
        getApiErrorMessage(err, 'Không thể làm mới hợp đồng.'),
        'error',
      );
    } finally {
      setRefreshingStale(false);
    }
  };

  const handleAccept = async () => {
    if (!bookingId || !activeDetail || !activeDetail.versionId) return;
    if (!activeDetail.contentHash || !activeDetail.bookingFingerprint) {
      show('Dữ liệu hợp đồng đang cập nhật, vui lòng thử làm mới.', 'info');
      return;
    }
    if (isExpired) {
      show('Đơn hàng đã hết thời gian giữ chỗ. Vui lòng đặt lại đơn mới.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const consentResult = await contractApi.submitConsent(
        activeDetail.contractId,
        {
          contractVersionId: activeDetail.versionId,
          action: 'ACCEPT',
          contentHash: activeDetail.contentHash,
          bookingFingerprint: activeDetail.bookingFingerprint,
          idempotencyKey: createConsentIdempotencyKey(),
        },
      );

      bumpBookingSync();
      const updatedReadiness = await contractApi.getBookingReadiness(bookingId);
      setReadiness(updatedReadiness);

      const emailStatus = consentResult.emailDelivery?.status;
      const emailRecipient = consentResult.emailDelivery?.recipient;
      const emailHint =
        emailStatus === 'SENT' && emailRecipient
          ? ` Bản PDF đã được gửi đến ${emailRecipient}.`
          : emailStatus === 'IN_PROGRESS'
            ? ' Hệ thống đang gửi bản PDF đến email của bạn.'
            : emailStatus === 'FAILED'
              ? ' Bạn có thể tải bản PDF trực tiếp trong mục Hợp đồng.'
              : '';

      if (updatedReadiness.ready) {
        pushLocalBanner({
          title: 'Đã xác nhận Hợp đồng điện tử',
          content: `Bạn đã đồng ý đầy đủ điều khoản hợp đồng.${emailHint} Đang chuyển sang bước thanh toán PayOS.`,
          type: 'CONTRACT_SIGNED',
          metadata: { bookingId },
        });
        onReadyToPay();
        return;
      }

      const nextPending = updatedReadiness.providers.find(
        (p) => p.status !== 'ACCEPTED',
      );
      if (nextPending) {
        setActiveProviderId(nextPending.providerId);
        setAgreed(false);
        show(
          `Đã xác nhận hợp đồng shop hiện tại.${emailHint} Vui lòng xem tiếp shop kế tiếp.`,
          'info',
        );
      } else {
        await loadContracts();
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Không thể gửi xác nhận hợp đồng.');
      show(msg, 'error');
      if (
        msg.toLowerCase().includes('làm mới') ||
        msg.toLowerCase().includes('phiên bản')
      ) {
        await handleRefreshVersion();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDecline = () => {
    if (!bookingId || !activeDetail || !activeDetail.versionId) return;
    setDeclineConfirmOpen(true);
  };

  const handleDecline = async () => {
    if (!bookingId || !activeDetail || !activeDetail.versionId) return;
    setSubmitting(true);
    try {
      await contractApi.submitConsent(activeDetail.contractId, {
        contractVersionId: activeDetail.versionId,
        action: 'DECLINE',
        contentHash: activeDetail.contentHash || '',
        bookingFingerprint: activeDetail.bookingFingerprint || '',
        idempotencyKey: createConsentIdempotencyKey(),
      });
      bumpBookingSync();
      show('Đã ghi nhận từ chối hợp đồng.', 'info');
      setDeclineConfirmOpen(false);
      onDeclinedOrCancelled?.();
      onClose();
    } catch (err) {
      setDeclineConfirmOpen(false);
      show(getApiErrorMessage(err, 'Không thể gửi yêu cầu.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const signedCount =
    readiness?.providers.filter((p) => p.status === 'ACCEPTED').length ?? 0;
  const totalCount = readiness?.providers.length ?? 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (declineConfirmOpen) {
          if (!submitting) setDeclineConfirmOpen(false);
          return;
        }
        onClose();
      }}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.root}>
        {/* Top bar */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Xác nhận Hợp đồng điện tử</Text>
            <Text style={styles.headerSub}>
              {totalCount > 1
                ? `Đã ký ${signedCount}/${totalCount} cửa hàng · Bắt buộc trước PayOS`
                : 'Bước bắt buộc trước khi thanh toán PayOS'}
            </Text>
          </View>
          <Pressable
            onPress={() => void handleRefreshVersion()}
            disabled={refreshingStale || loading}
            style={styles.iconBtn}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={Colors.primary}
            />
          </Pressable>
        </View>

        {/* Hold countdown banner */}
        {countdownLabel !== null && (
          <View
            style={[
              styles.timerBanner,
              isExpired
                ? styles.timerExpired
                : (remainingSec ?? 999) <= 180
                  ? styles.timerWarning
                  : styles.timerNormal,
            ]}
          >
            <Ionicons
              name={isExpired ? 'alert-circle' : 'time-outline'}
              size={16}
              color={isExpired ? Colors.error : Colors.warning}
            />
            <Text
              style={[
                styles.timerText,
                isExpired && { color: Colors.error },
              ]}
            >
              {isExpired
                ? 'Hết thời gian giữ chỗ (15 phút). Vui lòng quay lại đặt đơn mới.'
                : `Thời gian giữ đơn & ký hợp đồng còn lại: ${countdownLabel}`}
            </Text>
          </View>
        )}

        {/* Multi-provider tabs */}
        {(readiness?.providers.length ?? 0) > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsRow}
            contentContainerStyle={styles.tabsContent}
          >
            {readiness!.providers.map((entry, idx) => {
              const detail = entry.contractId
                ? detailsByContractId[entry.contractId]
                : null;
              const active = entry.providerId === activeEntry?.providerId;
              const accepted = entry.status === 'ACCEPTED';
              return (
                <Pressable
                  key={entry.providerId}
                  onPress={() => {
                    setActiveProviderId(entry.providerId);
                    setAgreed(false);
                  }}
                  style={[styles.tabPill, active && styles.tabPillActive]}
                >
                  <Ionicons
                    name={accepted ? 'checkmark-circle' : 'document-text-outline'}
                    size={15}
                    color={
                      active
                        ? Colors.white
                        : accepted
                          ? Colors.success
                          : Colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      active && styles.tabLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {detail?.providerName || `Cửa hàng ${idx + 1}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.stateText}>
              Đang chuẩn bị Hợp đồng điện tử cho đơn hàng...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons
              name="alert-circle-outline"
              size={44}
              color={Colors.error}
            />
            <Text style={styles.errorTitle}>Không thể tải hợp đồng</Text>
            <Text style={styles.stateText}>{error}</Text>
            <AppButton
              title="Thử lại"
              onPress={() => void loadContracts()}
              fullWidth={false}
            />
          </View>
        ) : activeDetail ? (
          <>
            <ScrollView
              contentContainerStyle={styles.scrollBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Status / Stale warning */}
              <View style={styles.topStatusRow}>
                <StatusBadge
                  label={getContractReadinessMeta(activeEntry?.status).label}
                  tone={getContractReadinessMeta(activeEntry?.status).tone}
                />
                <View style={styles.modeSwitch}>
                  <Pressable
                    onPress={() => setViewMode('QUICK')}
                    style={[
                      styles.modeBtn,
                      viewMode === 'QUICK' && styles.modeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        viewMode === 'QUICK' && styles.modeBtnTextActive,
                      ]}
                    >
                      Tóm tắt
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setViewMode('DETAILED')}
                    style={[
                      styles.modeBtn,
                      viewMode === 'DETAILED' && styles.modeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        viewMode === 'DETAILED' && styles.modeBtnTextActive,
                      ]}
                    >
                      Toàn văn A4
                    </Text>
                  </Pressable>
                </View>
              </View>

              {needsRefresh && (
                <View style={styles.staleBanner}>
                  <Text style={styles.staleText}>
                    Thông tin đơn hàng hoặc điều khoản của cửa hàng vừa thay đổi.
                    Vui lòng bấm làm mới để nhận phiên bản hợp đồng chính xác.
                  </Text>
                  <AppButton
                    title="Làm mới phiên bản hợp đồng"
                    loading={refreshingStale}
                    onPress={() => void handleRefreshVersion()}
                  />
                </View>
              )}

              {viewMode === 'QUICK' ? (
                <QuickSummaryCard
                  contract={activeDetail}
                  onOpenFull={() => setViewMode('DETAILED')}
                />
              ) : (
                <ContractDocumentView contract={activeDetail} />
              )}
            </ScrollView>

            {/* Footer actions */}
            <View style={styles.footer}>
              {activeEntry?.status === 'ACCEPTED' ? (
                <View style={styles.alreadySigned}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.success}
                  />
                  <Text style={styles.alreadySignedText}>
                    Bạn đã ký hợp đồng cho cửa hàng này
                    {activeDetail.customerAcceptedAt
                      ? ` lúc ${formatDateTime(activeDetail.customerAcceptedAt)}`
                      : ''}
                    .
                  </Text>
                </View>
              ) : (
                <>
                  <Pressable
                    onPress={() => setAgreed((v) => !v)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={agreed ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={agreed ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>
                      Tôi đã đọc và đồng ý toàn bộ điều khoản Hợp đồng điện tử
                      (quy định bảo quản, phí trả muộn, bồi thường và hủy đơn).
                    </Text>
                  </Pressable>

                  <View style={styles.actionRow}>
                    <View style={styles.declineWrap}>
                      <AppButton
                        title="Từ chối"
                        variant="secondary"
                        disabled={submitting}
                        onPress={confirmDecline}
                      />
                    </View>
                    <View style={styles.acceptWrap}>
                      <AppButton
                        title={
                          signedCount + 1 < totalCount
                            ? 'Đồng ý & Tiếp tục'
                            : 'Đồng ý & Thanh toán'
                        }
                        loading={submitting}
                        disabled={!agreed || isExpired || needsRefresh}
                        onPress={() => void handleAccept()}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.stateText}>
              Chưa tìm thấy dữ liệu hợp đồng cho đơn hàng này.
            </Text>
            <AppButton
              title="Làm mới hợp đồng"
              loading={refreshingStale}
              onPress={() => void handleRefreshVersion()}
              fullWidth={false}
            />
          </View>
        )}

        <TagoConfirmOverlay
          visible={declineConfirmOpen}
          loading={submitting}
          title="Từ chối hợp đồng?"
          message="Nếu bạn không đồng ý Hợp đồng điện tử, bạn sẽ chưa thể thanh toán đơn thuê này."
          onClose={() => setDeclineConfirmOpen(false)}
          buttons={[
            { text: 'Quay lại', style: 'cancel' },
            {
              text: 'Xác nhận từ chối',
              style: 'destructive',
              onPress: handleDecline,
            },
          ]}
        />
      </SafeAreaView>
    </Modal>
  );
}

function QuickSummaryCard({
  contract,
  onOpenFull,
}: {
  contract: ContractDetail;
  onOpenFull: () => void;
}) {
  const snapshot = asObj(contract.snapshot) || {};
  const provider = asObj(snapshot.provider) || {};
  const items = Array.isArray(snapshot.providerItems)
    ? (snapshot.providerItems as Record<string, any>[])
    : [];
  const pricing = asObj(snapshot.pricing) || {};
  const summary = asObj(pricing.bookingSummary);
  const policies = asObj(snapshot.policies) || {};
  const lateReturn = asObj(policies.providerLateReturn);
  const resolvedDamage = resolveDamageCompensationRules(
    policies.providerDamageCompensation as any,
  );
  const primaryReplacementVal =
    items
      .map((it) => (typeof it.replacementValue === 'number' ? it.replacementValue : 0))
      .find((v) => v > 0) || null;

  const subtotal = items.reduce(
    (s, it) => s + Number(it.unitPrice || 0) * Number(it.quantity || 1),
    0,
  );
  const deposit = items.reduce(
    (s, it) => s + Number(it.depositAmount || 0) * Number(it.quantity || 1),
    0,
  );

  return (
    <View style={styles.quickCard}>
      <View style={styles.quickHeader}>
        <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.quickTitle}>Tóm tắt các điểm chính trước khi ký</Text>
          <Text style={styles.quickSub}>
            Bên cho thuê: {provider.businessName || contract.providerName}
          </Text>
        </View>
      </View>

      <View style={styles.quickBlock}>
        <Text style={styles.quickLabel}>Trang phục & Thời hạn thuê</Text>
        {items.map((it, i) => (
          <Text key={i} style={styles.quickItemText}>
            • {it.productName} ({it.size}, SL {it.quantity}) ·{' '}
            {formatDate(it.rentalFrom)} → {formatDate(it.rentalTo)}
          </Text>
        ))}
      </View>

      <View style={styles.quickBlock}>
        <Text style={styles.quickLabel}>Chi phí & Tiền cọc Escrow</Text>
        <Text style={styles.quickMoney}>
          Tổng đơn: {formatContractMoney(summary?.totalAmount ?? subtotal + deposit)} ·
          Trong đó cọc giữ đồ: {formatContractMoney(summary?.depositAmount ?? deposit)}
        </Text>
      </View>

      {lateReturn && (
        <View style={styles.quickBlock}>
          <Text style={styles.quickLabel}>Phí trả đồ trễ hạn</Text>
          <Text style={styles.quickItemText}>
            Miễn phí trễ {lateReturn.gracePeriodHours ?? 0} giờ · Sau đó{' '}
            {formatContractMoney(lateReturn.hourlyLateFee)}/giờ (hoặc{' '}
            {formatContractMoney(lateReturn.dailyLateFee)}/ngày).
          </Text>
        </View>
      )}

      <View style={styles.quickBlock}>
        <Text style={styles.quickLabel}>Cam kết bồi thường hư hỏng / mất mát</Text>
        <Text style={styles.quickItemText}>
          • Nhẹ: {formatDamageTierValue(resolvedDamage.minorDamage, primaryReplacementVal)}
        </Text>
        <Text style={styles.quickItemText}>
          • Trung bình: {formatDamageTierValue(resolvedDamage.moderateDamage, primaryReplacementVal)}
        </Text>
        <Text style={styles.quickItemText}>
          • Nặng / Mất mát: {formatDamageTierValue(resolvedDamage.totalLoss, primaryReplacementVal)}
        </Text>
      </View>

      <Pressable onPress={onOpenFull} style={styles.openFullLink}>
        <Ionicons name="reader-outline" size={16} color={Colors.primary} />
        <Text style={styles.openFullText}>Xem toàn văn hợp đồng A4 đầy đủ →</Text>
      </Pressable>
    </View>
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
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.text,
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  timerNormal: {
    backgroundColor: '#FFFBEB',
  },
  timerWarning: {
    backgroundColor: '#FEF3C7',
  },
  timerExpired: {
    backgroundColor: Colors.errorSoft,
  },
  timerText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.warning,
    flex: 1,
  },
  tabsRow: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 50,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceSoft,
  },
  tabPillActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 140,
  },
  tabLabelActive: {
    color: Colors.white,
    fontFamily: FontFamily.bodySemiBold,
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
  scrollBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  topStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.pill,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  modeBtnActive: {
    backgroundColor: Colors.surface,
  },
  modeBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bodySemiBold,
  },
  staleBanner: {
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  staleText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: Colors.warning,
    lineHeight: 18,
  },
  quickCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  quickTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14.5,
    color: Colors.text,
  },
  quickSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  quickBlock: {
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 4,
  },
  quickLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primaryDark,
  },
  quickItemText: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  quickMoney: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.text,
  },
  openFullLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  openFullText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  footer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: Colors.text,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  declineWrap: {
    flex: 1,
  },
  acceptWrap: {
    flex: 2,
  },
  alreadySigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successSoft,
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  alreadySignedText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.success,
  },
});
