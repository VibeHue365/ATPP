import { Ionicons } from '@expo/vector-icons';
import { type Href, router, useFocusEffect, usePathname } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';
import type { NotificationItem } from '@/types/notification';
import {
  formatNotification,
  type FormattedNotification,
} from '@/utils/notificationFormatter';

type Filter = 'ALL' | 'UNREAD' | 'ACTION' | 'RENTAL' | 'PAYMENT';

export default function Screen() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}

function Notifications() {
  const pathname = usePathname();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  } = useNotifications();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      void reload(true);
      return undefined;
    }, [reload]),
  );

  const enriched = useMemo(
    () =>
      notifications.map((raw) => ({
        raw,
        formatted: formatNotification(raw),
      })),
    [notifications],
  );

  const items = useMemo(
    () =>
      enriched.filter(({ raw, formatted }) => {
        const text =
          `${formatted.title} ${formatted.content} ${formatted.categoryLabel} ${raw.title} ${raw.content}`.toLowerCase();
        if (q.trim() && !text.includes(q.trim().toLowerCase())) return false;
        if (filter === 'UNREAD') return !raw.isRead;
        if (filter === 'ACTION') return formatted.actionRequired;
        if (filter === 'RENTAL') {
          return ['CONTRACT', 'HANDOVER', 'RETURN', 'BOOKING'].includes(
            formatted.category,
          );
        }
        if (filter === 'PAYMENT') {
          return ['PAYMENT', 'REFUND', 'DISPUTE'].includes(formatted.category);
        }
        return true;
      }),
    [enriched, q, filter],
  );

  const totalPages = Math.max(1, Math.ceil(items.length / 10));
  const safePage = Math.min(page, totalPages);
  const visible = items.slice((safePage - 1) * 10, safePage * 10);

  const open = async (raw: NotificationItem, formatted: FormattedNotification) => {
    if (!raw.isRead) {
      await markRead(raw._id).catch(() => {});
    }

    if (pathname.startsWith('/provider') && formatted.bookingId) {
      router.push({
        pathname: '/provider/(tabs)/orders',
        params: { bookingId: formatted.bookingId },
      } as unknown as Href);
      return;
    }

    if (formatted.bookingId) {
      router.push(`/booking/${formatted.bookingId}` as Href);
    } else if (formatted.contractId) {
      router.push('/contracts' as Href);
    } else if (formatted.paymentCode) {
      router.push({
        pathname: '/payment/result',
        params: { code: formatted.paymentCode },
      } as unknown as Href);
    }
  };

  if (loading && !notifications.length) {
    return <LoadingState label="Đang tải trung tâm thông báo..." />;
  }

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
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void reload(false)}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color="#8F8E8E" />
          <TextInput
            value={q}
            onChangeText={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Tìm theo mã vé, hợp đồng, bàn giao đồ..."
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
          contentContainerStyle={s.filters}
        >
          {(
            [
              ['ALL', `Tất cả (${notifications.length})`],
              ['UNREAD', `Chưa đọc (${unreadCount})`],
              ['ACTION', 'Cần xử lý'],
              ['RENTAL', 'Thuê đồ & Hợp đồng'],
              ['PAYMENT', 'Thanh toán & Cọc'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => {
                setFilter(key);
                setPage(1);
              }}
              style={[s.chip, filter === key && s.chipOn]}
            >
              <Text style={[s.chipText, filter === key && s.chipTextOn]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <ErrorState message={error} onRetry={() => void reload(false)} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Chưa có thông báo mới"
            message="Mọi cập nhật về hợp đồng điện tử, bàn giao cổ phục, hoàn trả tiền cọc và bàn giao ảnh chụp sẽ hiển thị tại đây."
          />
        ) : (
          <View style={s.list}>
            {visible.map(({ raw, formatted }) => (
              <NotificationCard
                key={raw._id}
                raw={raw}
                formatted={formatted}
                onPress={() => void open(raw, formatted)}
              />
            ))}
          </View>
        )}
        <ListPagination
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationCard({
  raw,
  formatted,
  onPress,
}: {
  raw: NotificationItem;
  formatted: FormattedNotification;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.card, !raw.isRead && s.unread]}>
      <View style={[s.icon, { backgroundColor: formatted.bg }]}>
        <Ionicons name={formatted.icon} size={21} color={formatted.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.type, { color: formatted.color }]}>
              {formatted.categoryLabel}
            </Text>
            {formatted.actionRequired && (
              <View style={s.actionPill}>
                <Text style={s.actionPillText}>CẦN XÁC NHẬN</Text>
              </View>
            )}
          </View>
          <Text style={s.time}>{formatTime(raw.createdAt)}</Text>
        </View>
        <Text style={s.cardTitle}>{formatted.title}</Text>
        <Text style={s.body}>{formatted.content}</Text>
        <Text style={s.action}>
          {formatted.bookingId
            ? 'Mở chi tiết đơn & hợp đồng ›'
            : formatted.contractId
              ? 'Mở hợp đồng điện tử ›'
              : 'Xem chi tiết ›'}
        </Text>
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  type: { fontFamily: FontFamily.bodyBold, fontSize: 9.5, letterSpacing: 0.5 },
  actionPill: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  actionPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    color: '#B45309',
  },
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
