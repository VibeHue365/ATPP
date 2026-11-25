import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
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
import { chatApi } from '@/apis/chatApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import type { ChatRoom } from '@/types/chat';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';
import { isPartnerPortalUser, isStaffPortalUser } from '@/utils/navigation';

type MobileChatMode = 'staff' | 'provider' | 'customer';

interface FilterTab {
  id: string;
  label: string;
}

const MODE_COPY: Record<
  MobileChatMode,
  {
    eyebrow: string;
    title: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyMessage: string;
    tabs: FilterTab[];
  }
> = {
  customer: {
    eyebrow: 'HỘP THƯ KHÁCH HÀNG',
    title: 'Tin nhắn Studio & Thợ chụp',
    searchPlaceholder: 'Tìm Studio, Thợ chụp hoặc mã đơn...',
    emptyTitle: 'Chưa có cuộc trò chuyện nào',
    emptyMessage:
      'Khi bạn trao đổi với Tiệm Áo Dài, Studio hoặc Thợ chụp phụ trách, hội thoại sẽ hiển thị tại đây.',
    tabs: [
      { id: 'ALL', label: 'Tất cả' },
      { id: 'STUDIOS', label: 'Studio / Tiệm' },
      { id: 'STAFF', label: 'Thợ chụp' },
    ],
  },
  provider: {
    eyebrow: 'HỘP THƯ STUDIO',
    title: 'Khách hàng & Đội ngũ',
    searchPlaceholder: 'Tìm tên khách, Thợ chụp hoặc mã đơn...',
    emptyTitle: 'Chưa có hội thoại nào',
    emptyMessage:
      'Tin nhắn từ khách đặt lịch và kênh trao đổi điều phối Thợ chụp trong Studio sẽ hiển thị tại đây.',
    tabs: [
      { id: 'ALL', label: 'Tất cả' },
      { id: 'CUSTOMERS', label: 'Khách hàng' },
      { id: 'STAFF', label: 'Đội ngũ Thợ chụp' },
    ],
  },
  staff: {
    eyebrow: 'CỔNG THỢ CHỤP',
    title: 'Trao đổi công việc',
    searchPlaceholder: 'Tìm Chủ Studio, khách chụp hoặc mã đơn...',
    emptyTitle: 'Chưa có hội thoại công việc',
    emptyMessage:
      'Bạn chỉ nhắn tin trực tiếp với Chủ Studio và các khách hàng thuộc ca chụp mình phụ trách.',
    tabs: [
      { id: 'ALL', label: 'Tất cả' },
      { id: 'OWNER', label: 'Chủ Studio' },
      { id: 'CUSTOMERS', label: 'Khách chụp' },
    ],
  },
};

export default function Screen() {
  return (
    <RequireAuth>
      <Rooms />
    </RequireAuth>
  );
}

function Rooms() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const chatMode: MobileChatMode = isStaffPortalUser(user)
    ? 'staff'
    : isPartnerPortalUser(user)
      ? 'provider'
      : 'customer';
  const copy = MODE_COPY[chatMode];

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      setError(null);
      const data = await chatApi.rooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Không thể tải danh sách hội thoại'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load])
  );

  useEffect(() => {
    if (!socket) return;
    const refresh = () => void load(true);
    socket.on('room_update', refresh);
    return () => {
      socket.off('room_update', refresh);
    };
  }, [socket, load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rooms.filter((room) => {
      if (activeFilter !== 'ALL') {
        const role = room.otherParticipant?.participantRole;
        if (chatMode === 'customer') {
          if (
            activeFilter === 'STUDIOS' &&
            room.roomCategory !== 'CUSTOMER_TO_PROVIDER' &&
            role !== 'PROVIDER'
          ) {
            return false;
          }
          if (
            activeFilter === 'STAFF' &&
            room.roomCategory !== 'CUSTOMER_TO_STAFF' &&
            role !== 'STAFF'
          ) {
            return false;
          }
        } else if (chatMode === 'provider') {
          if (
            activeFilter === 'STAFF' &&
            room.roomCategory !== 'OWNER_TO_STAFF' &&
            role !== 'STAFF'
          ) {
            return false;
          }
          if (
            activeFilter === 'CUSTOMERS' &&
            (room.roomCategory === 'OWNER_TO_STAFF' || role === 'STAFF')
          ) {
            return false;
          }
        } else if (chatMode === 'staff') {
          if (
            activeFilter === 'OWNER' &&
            room.roomCategory !== 'STAFF_TO_OWNER' &&
            role !== 'PROVIDER'
          ) {
            return false;
          }
          if (
            activeFilter === 'CUSTOMERS' &&
            (room.roomCategory === 'STAFF_TO_OWNER' || role === 'PROVIDER')
          ) {
            return false;
          }
        }
      }

      if (!query) return true;
      return `${room.otherParticipant?.fullName ?? ''} ${
        room.otherParticipant?.studioName ?? ''
      } ${room.bookingContext?.bookingCode ?? ''} ${
        room.lastMessage?.messageText ?? ''
      }`
        .toLowerCase()
        .includes(query);
    });
  }, [rooms, activeFilter, q, chatMode]);

  if (loading) return <LoadingState label="Đang tải hộp thư trò chuyện..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.round}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{copy.eyebrow}</Text>
          <Text style={s.title}>{copy.title}</Text>
        </View>
        <View style={s.statusPill}>
          <View style={[s.dot, isConnected ? s.online : s.offline]} />
          <Text style={s.statusText}>{isConnected ? 'Trực tuyến' : 'Đồng bộ'}</Text>
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
            onChangeText={setQ}
            placeholder={copy.searchPlaceholder}
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
          contentContainerStyle={s.filterRow}>
          {copy.tabs.map((tab) => {
            const selected = activeFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveFilter(tab.id)}
                style={[s.filterChip, selected && s.filterChipActive]}>
                <Text style={[s.filterChipText, selected && s.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState title={copy.emptyTitle} message={copy.emptyMessage} />
        ) : (
          <View style={s.list}>
            {filtered.map((room) => (
              <RoomCard key={room.id} room={room} mode={chatMode} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getFallbackRoleBadge(room: ChatRoom, mode: MobileChatMode): string {
  if (room.otherParticipant?.roleBadge) return room.otherParticipant.roleBadge;
  const role = room.otherParticipant?.participantRole;
  if (role === 'STAFF') {
    return mode === 'provider' ? 'Thợ chụp Studio' : 'Thợ chụp phụ trách';
  }
  if (role === 'PROVIDER') {
    return mode === 'staff' ? 'Chủ Studio' : 'Studio / Đối tác';
  }
  return mode === 'staff' ? 'Khách chụp của bạn' : 'Khách hàng';
}

function buildBookingSummary(room: ChatRoom): string {
  const ctx = room.bookingContext;
  if (!ctx) return '';
  const shootDay = ctx.shootDate
    ? new Date(ctx.shootDate).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  return [ctx.serviceLabel, shootDay, ctx.timeSlot, ctx.locationAddress]
    .filter(Boolean)
    .join(' · ');
}

function RoomCard({ room, mode }: { room: ChatRoom; mode: MobileChatMode }) {
  const partner = room.otherParticipant;
  const roleBadge = getFallbackRoleBadge(room, mode);
  const bookingSummary = buildBookingSummary(room);
  const unreadCount = room.unreadCount ?? 0;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: room.id,
            name: partner?.fullName ?? 'Đối tác TàGo',
            roleBadge,
            bookingCode: room.bookingContext?.bookingCode ?? '',
            bookingSummary,
          },
        } as unknown as Href)
      }
      style={({ pressed }) => [
        s.card,
        room.isPinned && s.pinnedCard,
        pressed && { opacity: 0.92 },
      ]}>
      {partner?.avatarUrl ? (
        <Image source={getMediaUrl(partner.avatarUrl)} style={s.avatar} contentFit="cover" />
      ) : (
        <View style={s.avatar}>
          <Text style={s.initial}>{(partner?.fullName ?? 'T').charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={s.cardTop}>
          <Text style={s.name} numberOfLines={1}>
            {partner?.fullName ?? 'Đối tác TàGo'}
          </Text>
          <Text style={s.time}>{time(room.lastMessageAt)}</Text>
        </View>
        <View style={s.metaRow}>
          <View style={s.rolePill}>
            {room.isPinned ? (
              <Ionicons name="pin" size={10} color={Colors.primary} />
            ) : null}
            <Text style={s.rolePillText}>{roleBadge}</Text>
          </View>
          {room.bookingContext?.bookingCode ? (
            <View style={s.bookingChip}>
              <Text style={s.bookingChipText}>#{room.bookingContext.bookingCode}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.previewRow}>
          <Text numberOfLines={1} style={[s.preview, unreadCount > 0 && s.previewUnread]}>
            {room.lastMessage?.messageText || 'Nhấn để bắt đầu trao đổi chi tiết'}
          </Text>
          {unreadCount > 0 ? (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8F8E8E" />
    </Pressable>
  );
}

const time = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';

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
  title: { fontFamily: FontFamily.display, fontSize: 20, color: '#1B1C1C', marginTop: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  online: { backgroundColor: Colors.success },
  offline: { backgroundColor: Colors.warning },
  statusText: { fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: '#5F5E5E' },
  content: { padding: 16, paddingBottom: 38, gap: 12 },
  search: {
    height: 46,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    ...Shadow,
  },
  input: { flex: 1, fontFamily: FontFamily.body, fontSize: 12.5, color: '#1B1C1C' },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2DC',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  list: { gap: 10 },
  card: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadow,
  },
  pinnedCard: {
    borderColor: '#F2D4DA',
    backgroundColor: '#FFFDF9',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: FontFamily.display, fontSize: 19, color: Colors.primary },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: '#1B1C1C' },
  time: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E' },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rolePillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.primary,
  },
  bookingChip: {
    backgroundColor: '#F5EFE8',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookingChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#5F5143',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 5,
  },
  preview: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: '#5F5E5E' },
  previewUnread: { fontFamily: FontFamily.bodyBold, color: '#1B1C1C' },
  unreadBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
});
