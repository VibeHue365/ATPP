import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, type Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { contractApi } from '@/apis/contractApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ContractDetailModal } from '@/components/contracts/ContractDetailModal';
import { ContractPdfModal } from '@/components/contracts/ContractPdfModal';
import { ContractReviewModal } from '@/components/contracts/ContractReviewModal';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';
import type { CustomerContractItem } from '@/types/contract';
import { getApiErrorMessage } from '@/utils/apiError';
import { bookingStatus, formatDate, formatDateTime } from '@/utils/booking';
import {
  formatContractMoney,
  getContractStateBadge,
} from '@/utils/contractFormat';

type ContractFilter = 'ALL' | 'EFFECTIVE' | 'PENDING' | 'OTHER';

export default function Screen() {
  return (
    <RequireAuth>
      <ContractsScreen />
    </RequireAuth>
  );
}

function ContractsScreen() {
  const { bookingSyncVersion } = useNotifications();
  const [items, setItems] = useState<CustomerContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContractFilter>('ALL');
  const [query, setQuery] = useState('');

  const [detailTarget, setDetailTarget] =
    useState<CustomerContractItem | null>(null);
  const [pdfTarget, setPdfTarget] = useState<CustomerContractItem | null>(null);
  const [signBookingId, setSignBookingId] = useState<string | null>(null);

  const loadContracts = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      setError(null);
      const data = await contractApi.getMyContracts();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Không thể tải danh sách hợp đồng điện tử.'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    if (bookingSyncVersion > 0) {
      void contractApi
        .getMyContracts()
        .then((data) => {
          if (Array.isArray(data)) setItems(data);
        })
        .catch(() => {});
    }
  }, [bookingSyncVersion]);

  useFocusEffect(
    useCallback(() => {
      void contractApi
        .getMyContracts()
        .then((data) => {
          if (Array.isArray(data)) setItems(data);
        })
        .catch(() => {});
    }, []),
  );

  const counts = useMemo(() => {
    const effective = items.filter((c) => c.state === 'EFFECTIVE').length;
    const pending = items.filter(
      (c) =>
        ['OFFERED', 'DRAFT', 'ACCEPTED', 'PENDING_PROVIDER'].includes(
          String(c.state || '').toUpperCase(),
        ) && c.bookingStatus === 'PENDING_PAYMENT',
    ).length;
    return {
      all: items.length,
      effective,
      pending,
      other: Math.max(0, items.length - effective - pending),
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      const state = String(c.state || '').toUpperCase();
      if (filter === 'EFFECTIVE' && state !== 'EFFECTIVE') return false;
      if (
        filter === 'PENDING' &&
        !(
          ['OFFERED', 'DRAFT', 'ACCEPTED', 'PENDING_PROVIDER'].includes(
            state,
          ) && c.bookingStatus === 'PENDING_PAYMENT'
        )
      ) {
        return false;
      }
      if (
        filter === 'OTHER' &&
        (state === 'EFFECTIVE' ||
          (['OFFERED', 'DRAFT', 'ACCEPTED', 'PENDING_PROVIDER'].includes(
            state,
          ) &&
            c.bookingStatus === 'PENDING_PAYMENT'))
      ) {
        return false;
      }
      if (!q) return true;
      return `${c.contractCode || ''} ${c.bookingCode || ''} ${c.providerName || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, query]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Hợp đồng điện tử của tôi</Text>
          <Text style={styles.subtitle}>
            Lưu trữ pháp lý, bản PDF và lịch sử xác nhận thuê trang phục
          </Text>
        </View>
      </View>

      {/* Search & Filter chips */}
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo mã HĐ, mã đơn hoặc tên cửa hàng..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          {Boolean(query) && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {(
            [
              { key: 'ALL', label: `Tất cả (${counts.all})` },
              { key: 'EFFECTIVE', label: `Có hiệu lực (${counts.effective})` },
              { key: 'PENDING', label: `Chờ ký / TT (${counts.pending})` },
              { key: 'OTHER', label: `Khác (${counts.other})` },
            ] as const
          ).map((tab) => {
            const active = filter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState label="Đang tải danh sách hợp đồng..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadContracts()} />
      ) : filtered.length === 0 ? (
        <View>
          <EmptyState
            title="Chưa có hợp đồng điện tử nào"
            message={
              query || filter !== 'ALL'
                ? 'Thử xóa bộ lọc để xem toàn bộ hợp đồng của bạn.'
                : 'Khi bạn thuê áo dài tại các cửa hàng áp dụng Hợp đồng điện tử V2, hợp đồng sẽ hiển thị tại đây.'
            }
          />
          {(query || filter !== 'ALL') && (
            <Pressable
              onPress={() => {
                setQuery('');
                setFilter('ALL');
              }}
              style={[styles.chip, styles.chipActive, { alignSelf: 'center' }]}
            >
              <Text style={styles.chipTextActive}>Xem tất cả</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadContracts(true)}
              tintColor={Colors.primary}
            />
          }
        >
          {filtered.map((item) => {
            const cBadge = getContractStateBadge(item);
            const bStatus = bookingStatus[item.bookingStatus] ?? {
              label: item.bookingStatus,
              tone: 'neutral' as const,
            };
            const canSign =
              item.bookingStatus === 'PENDING_PAYMENT' && !item.isSigned;
            const pdfReady =
              item.hasPdf ||
              item.pdfStatus === 'READY' ||
              item.state === 'EFFECTIVE' ||
              item.isSigned;

            return (
              <View key={item.contractId} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.contractCode}>
                      {item.contractCode ||
                        `HĐ-${item.contractId.slice(-6).toUpperCase()}`}
                      {item.version ? ` · v${item.version}` : ''}
                    </Text>
                    <Text style={styles.providerText}>
                      {item.providerName || 'Cửa hàng đối tác TàGo'}
                    </Text>
                  </View>
                  <StatusBadge label={cBadge.label} tone={cBadge.tone} />
                </View>

                <View style={styles.metaGrid}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Đơn hàng #{item.bookingCode}</Text>
                    <StatusBadge label={bStatus.label} tone={bStatus.tone} />
                  </View>
                  {item.startDate && item.endDate ? (
                    <Text style={styles.metaInfo}>
                      Thời gian thuê: {formatDate(item.startDate)} →{' '}
                      {formatDate(item.endDate)}
                    </Text>
                  ) : null}
                  {typeof item.totalAmount === 'number' && item.totalAmount > 0 ? (
                    <Text style={styles.metaInfo}>
                      Tổng đơn: {formatContractMoney(item.totalAmount)} · Cọc giữ đồ:{' '}
                      {formatContractMoney(item.depositAmount)}
                    </Text>
                  ) : null}
                  {item.customerAcceptedAt ? (
                    <Text style={styles.signedText}>
                      Đã ký điện tử lúc {formatDateTime(item.customerAcceptedAt)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  {canSign && (
                    <Pressable
                      onPress={() => setSignBookingId(item.bookingId)}
                      style={styles.primaryAction}
                    >
                      <Ionicons
                        name="create-outline"
                        size={14}
                        color={Colors.white}
                      />
                      <Text style={styles.primaryActionText}>Ký ngay</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => setDetailTarget(item)}
                    style={styles.secondaryAction}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={14}
                      color={Colors.text}
                    />
                    <Text style={styles.secondaryActionText}>Xem điều khoản</Text>
                  </Pressable>

                  {pdfReady && (
                    <Pressable
                      onPress={() => setPdfTarget(item)}
                      style={styles.pdfAction}
                    >
                      <Ionicons
                        name="document-attach-outline"
                        size={14}
                        color={Colors.primary}
                      />
                      <Text style={styles.pdfActionText}>Bản PDF</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() =>
                      router.push(`/booking/${item.bookingId}` as Href)
                    }
                    style={styles.linkAction}
                  >
                    <Text style={styles.linkActionText}>Chi tiết đơn →</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <ContractDetailModal
        visible={Boolean(detailTarget)}
        contractId={detailTarget?.contractId ?? null}
        versionId={detailTarget?.versionId ?? null}
        onClose={() => setDetailTarget(null)}
      />

      <ContractPdfModal
        visible={Boolean(pdfTarget)}
        contractId={pdfTarget?.contractId ?? null}
        versionId={pdfTarget?.versionId ?? null}
        contractCode={pdfTarget?.contractCode}
        onClose={() => setPdfTarget(null)}
      />

      <ContractReviewModal
        visible={Boolean(signBookingId)}
        bookingId={signBookingId}
        onClose={() => setSignBookingId(null)}
        onReadyToPay={() => {
          const target = signBookingId;
          setSignBookingId(null);
          void loadContracts(true);
          if (target) {
            router.push(`/booking/${target}` as Href);
          }
        }}
        onDeclinedOrCancelled={() => {
          setSignBookingId(null);
          void loadContracts(true);
        }}
      />
    </SafeAreaView>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 19,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text,
  },
  chipsRow: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceSoft,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
    fontFamily: FontFamily.bodySemiBold,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  contractCode: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14.5,
    color: Colors.text,
  },
  providerText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: Colors.textSecondary,
  },
  metaGrid: {
    backgroundColor: Colors.surfaceSoft,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  metaLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: Colors.text,
  },
  metaInfo: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  signedText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: Colors.success,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  primaryActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  secondaryActionText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.text,
  },
  pdfAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  pdfActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  linkAction: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  linkActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
});
