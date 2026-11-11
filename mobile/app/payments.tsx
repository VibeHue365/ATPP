import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { paymentApi, type PaymentHistoryItem } from '@/apis/paymentApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ListPagination } from '@/components/ui/ListPagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { getApiErrorMessage } from '@/utils/apiError';

const PAGE_SIZE = 8;
type Filter = 'ALL' | 'PAYMENT' | 'REFUND';

export default function Screen() {
  return (
    <RequireAuth>
      <Payments />
    </RequireAuth>
  );
}

function Payments() {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [oldest, setOldest] = useState(false);

  const load = async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      setError(null);
      const data = await paymentApi.history();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Không thể tải lịch sử giao dịch'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          if (filter === 'REFUND' && item.purpose !== 'DEPOSIT_REFUND') return false;
          if (filter === 'PAYMENT' && item.purpose === 'DEPOSIT_REFUND') return false;
          return (
            !q ||
            `${item.paymentCode} ${purpose(item.purpose)}`.toLowerCase().includes(q.toLowerCase())
          );
        })
        .sort(
          (a, b) =>
            (oldest ? 1 : -1) *
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        ),
    [items, q, filter, oldest]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const update = (fn: () => void) => {
    setPage(1);
    fn();
  };

  if (loading) return <LoadingState label="Đang tải sao kê giao dịch..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.round}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TÀGO ESCROW & PAYOS</Text>
          <Text style={s.title}>Lịch sử thanh toán & Hoàn cọc</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>
        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color="#8F8E8E" />
          <TextInput
            value={q}
            onChangeText={(value) => update(() => setQ(value))}
            placeholder="Tìm mã giao dịch..."
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
          {q ? (
            <Pressable onPress={() => update(() => setQ(''))}>
              <Ionicons name="close-circle" size={18} color="#8F8E8E" />
            </Pressable>
          ) : null}
        </View>

        <View style={s.tools}>
          {(
            [
              ['ALL', 'Tất cả'],
              ['PAYMENT', 'Thanh toán'],
              ['REFUND', 'Hoàn tiền cọc'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => update(() => setFilter(key))}
              style={[s.chip, filter === key && s.chipOn]}>
              <Text style={[s.chipText, filter === key && s.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => update(() => setOldest((v) => !v))} style={s.sort}>
            <Ionicons name="swap-vertical" size={14} color={Colors.primary} />
            <Text style={s.sortText}>{oldest ? 'Cũ nhất' : 'Mới nhất'}</Text>
          </Pressable>
        </View>

        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Chưa có giao dịch nào"
            message="Các giao dịch đặt cọc giữ chỗ và hoàn trả tiền cọc của bạn sẽ được ghi nhận minh bạch tại đây."
          />
        ) : (
          <View style={s.list}>
            {visible.map((item) => (
              <PaymentCard key={item._id} item={item} />
            ))}
          </View>
        )}

        <ListPagination page={safePage} totalPages={totalPages} onChange={setPage} />
        {filtered.length > 0 && (
          <Text style={s.footer}>
            Hiển thị {visible.length}/{filtered.length} giao dịch
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentCard({ item }: { item: PaymentHistoryItem }) {
  const refund = item.purpose === 'DEPOSIT_REFUND';
  const ok = item.status === 'SUCCESS';
  const bookingId = typeof item.bookingId === 'string' ? item.bookingId : item.bookingId?._id;
  return (
    <Pressable
      disabled={!bookingId}
      onPress={() => bookingId && router.push(`/booking/${bookingId}` as Href)}
      style={s.card}>
      <View style={[s.icon, { backgroundColor: refund ? '#EDF9F2' : '#FFF0F3' }]}>
        <Ionicons
          name={refund ? 'return-down-back' : 'card-outline'}
          size={21}
          color={refund ? Colors.success : Colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.cardTop}>
          <Text style={s.code}>#{item.paymentCode}</Text>
          <StatusBadge
            label={
              ok
                ? 'Thành công'
                : item.status === 'PENDING'
                  ? 'Chờ xử lý'
                  : item.status === 'CANCELLED'
                    ? 'Đã hủy'
                    : 'Thất bại'
            }
            tone={ok ? 'success' : item.status === 'PENDING' ? 'warning' : 'error'}
          />
        </View>
        <Text style={s.purpose}>{purpose(item.purpose)}</Text>
        <Text style={s.meta}>
          {formatDate(item.createdAt)} · {item.paymentMethod || 'PayOS QR'}
        </Text>
        <Text style={[s.amount, refund && { color: Colors.success }]}>
          {refund ? '+' : ''}
          {money(item.amount)}
        </Text>
      </View>
    </Pressable>
  );
}

const purpose = (value: string) =>
  value === 'DEPOSIT_PAYMENT'
    ? 'Đặt cọc giữ chỗ dịch vụ'
    : value === 'DEPOSIT_REFUND'
      ? 'Hoàn trả tiền cọc giữ đồ'
      : value === 'FULL_PAYMENT'
        ? 'Thanh toán trọn gói'
        : value === 'REMAINING_PAYMENT'
          ? 'Thanh toán phần còn lại'
          : 'Thanh toán dịch vụ';

const money = (v = 0) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
const formatDate = (v: string) =>
  new Date(v).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  title: { fontFamily: FontFamily.display, fontSize: 21, color: '#1B1C1C' },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  search: {
    height: 46,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 8,
    ...Shadow,
  },
  input: { flex: 1, fontFamily: FontFamily.body, fontSize: 12.5, color: '#1B1C1C' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: '#5F5E5E' },
  chipTextOn: { color: Colors.white },
  sort: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFD9E2',
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  sortText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.primary },
  list: { gap: 10 },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 12,
    ...Shadow,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  code: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: '#1B1C1C' },
  purpose: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
    marginTop: 4,
  },
  meta: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E', marginTop: 3 },
  amount: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.primary,
    marginTop: 6,
  },
  footer: { fontFamily: FontFamily.body, fontSize: 11, color: '#8F8E8E', textAlign: 'center' },
});
