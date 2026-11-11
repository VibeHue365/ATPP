import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ListPagination } from '@/components/ui/ListPagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';
import type { NotificationItem } from '@/types/notification';

type Filter = 'ALL' | 'UNREAD' | 'ACTION' | 'BOOKING';
const config: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  PAYMENT: {
    icon: 'card-outline',
    color: Colors.primary,
    bg: '#FFF0F3',
    label: 'THANH TOÁN',
  },
  BOOKING: {
    icon: 'calendar-outline',
    color: Colors.primary,
    bg: '#FFF0F3',
    label: 'LỊCH HẸN',
  },
  HANDOVER: {
    icon: 'bag-handle-outline',
    color: Colors.warning,
    bg: '#FFFBEB',
    label: 'BÀN GIAO ĐỒ',
  },
  REFUND: {
    icon: 'return-down-back-outline',
    color: Colors.success,
    bg: '#EDF9F2',
    label: 'HOÀN TIỀN CỌC',
  },
  DISPUTE: {
    icon: 'alert-circle-outline',
    color: Colors.error,
    bg: '#FDECEE',
    label: 'HỖ TRỢ / XỬ LÝ',
  },
  SYSTEM: {
    icon: 'notifications-outline',
    color: '#5F5E5E',
    bg: '#F5F3F3',
    label: 'HỆ THỐNG',
  },
};
const actionTypes = new Set(['PAYMENT', 'HANDOVER', 'DISPUTE']);

export default function Screen() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}

function Notifications() {
  const { notifications, unreadCount, loading, error, reload, markRead, markAllRead } =
    useNotifications();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);

  const items = useMemo(
    () =>
      notifications.filter((n) => {
        const text = `${n.title} ${n.content}`.toLowerCase();
        if (q && !text.includes(q.toLowerCase())) return false;
        if (filter === 'UNREAD') return !n.isRead;
        if (filter === 'ACTION') return actionTypes.has(n.type);
        if (filter === 'BOOKING') return n.type === 'BOOKING';
        return true;
      }),
    [notifications, q, filter]
  );

  const totalPages = Math.max(1, Math.ceil(items.length / 10));
  const safePage = Math.min(page, totalPages);
  const visible = items.slice((safePage - 1) * 10, safePage * 10);

  const open = async (item: NotificationItem) => {
    if (!item.isRead) await markRead(item._id);
    const meta = item.metadata ?? {};
    const nested =
      typeof meta.booking === 'object' && meta.booking !== null
        ? (meta.booking as Record<string, unknown>)
        : {};
    const bookingId = String(meta.bookingId ?? nested._id ?? '');
    const paymentCode = String(meta.paymentCode ?? meta.code ?? '');
    if (paymentCode)
      router.push({ pathname: '/payment/result', params: { code: paymentCode } } as unknown as Href);
    else if (bookingId) router.push(`/booking/${bookingId}` as Href);
  };

  if (loading && !notifications.length)
    return <LoadingState label="Đang tải trung tâm thông báo..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.round}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TRUNG TÂM THÔNG BÁO</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.title}>Cập nhật lịch hẹn</Text>
            {unreadCount > 0 ? (
              <View style={s.countPill}>
                <Text style={s.count}>{unreadCount} mới</Text>
              </View>
            ) : null}
          </View>
        </View>
        {unreadCount > 0 && (
          <Pressable style={s.markAllBtn} onPress={() => void markAllRead()}>
            <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
            <Text style={s.markAllText}>Đọc hết</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />
        }
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>
        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color="#8F8E8E" />
          <TextInput
            value={q}
            onChangeText={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Tìm theo mã vé, tên cổ phục, nội dung..."
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
          {q ? (
            <Pressable onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color="#8F8E8E" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filters}>
          {(
            [
              ['ALL', `Tất cả (${notifications.length})`],
              ['UNREAD', `Chưa đọc (${unreadCount})`],
              ['ACTION', 'Cần xử lý'],
              ['BOOKING', 'Lịch hẹn'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => {
                setFilter(key);
                setPage(1);
              }}
              style={[s.chip, filter === key && s.chipOn]}>
              <Text style={[s.chipText, filter === key && s.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Chưa có thông báo mới"
            message="Mọi cập nhật về trạng thái giữ đồ, bàn giao cổ phục, hoàn trả tiền cọc và bàn giao ảnh chụp sẽ hiển thị tại đây."
          />
        ) : (
          <View style={s.list}>
            {visible.map((item) => (
              <NotificationCard key={item._id} item={item} onPress={() => void open(item)} />
            ))}
          </View>
        )}
        <ListPagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationCard({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const c = config[item.type] ?? config.SYSTEM;
  return (
    <Pressable onPress={onPress} style={[s.card, !item.isRead && s.unread]}>
      <View style={[s.icon, { backgroundColor: c.bg }]}>
        <Ionicons name={c.icon} size={21} color={c.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.cardTop}>
          <Text style={[s.type, { color: c.color }]}>{c.label}</Text>
          <Text style={s.time}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={s.cardTitle}>{item.title}</Text>
        <Text style={s.body}>{item.content}</Text>
        {!item.isRead && <Text style={s.action}>Xem chi tiết ›</Text>}
      </View>
    </Pressable>
  );
}

const formatTime = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) +
        ' · ' +
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

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
  countPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  count: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.white,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  markAllText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  search: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Shadow,
  },
  input: { flex: 1, fontFamily: FontFamily.body, fontSize: 12.5, color: '#1B1C1C' },
  filters: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11.5, color: '#5F5E5E' },
  chipTextOn: { color: Colors.white },
  list: { gap: 11 },
  card: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 12,
    ...Shadow,
  },
  unread: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    backgroundColor: '#FFF9FA',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  type: { fontFamily: FontFamily.bodyBold, fontSize: 9.5, letterSpacing: 0.5 },
  time: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E' },
  cardTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#1B1C1C',
    marginTop: 4,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
    marginTop: 4,
  },
  action: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
    marginTop: 8,
  },
});
