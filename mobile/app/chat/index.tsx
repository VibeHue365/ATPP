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
import { useSocket } from '@/contexts/SocketContext';
import type { ChatRoom } from '@/types/chat';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

export default function Screen() {
  return (
    <RequireAuth>
      <Rooms />
    </RequireAuth>
  );
}

function Rooms() {
  const { socket, isConnected } = useSocket();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

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

  const filtered = useMemo(
    () =>
      rooms.filter(
        (room) =>
          !q ||
          `${room.otherParticipant?.fullName ?? ''} ${room.lastMessage?.messageText ?? ''}`
            .toLowerCase()
            .includes(q.toLowerCase())
      ),
    [rooms, q]
  );

  if (loading) return <LoadingState label="Đang tải hộp thư trò chuyện..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.round}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>HỘP THƯ TÀGO</Text>
          <Text style={s.title}>Tin nhắn với Tiệm & Studio</Text>
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
            placeholder="Tìm tiệm cổ phục, nhiếp ảnh gia hoặc nội dung..."
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
          {q ? (
            <Pressable onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color="#8F8E8E" />
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Chưa có cuộc trò chuyện nào"
            message="Khi bạn nhắn tin trao đổi về kích cỡ cổ phục hoặc lịch chụp với Tiệm/Studio, hội thoại sẽ hiển thị tại đây."
          />
        ) : (
          <View style={s.list}>
            {filtered.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoomCard({ room }: { room: ChatRoom }) {
  const partner = room.otherParticipant;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/chat/[id]',
          params: { id: room.id, name: partner?.fullName ?? 'Đối tác TàGo' },
        } as unknown as Href)
      }
      style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}>
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
        <Text numberOfLines={1} style={s.preview}>
          {room.lastMessage?.messageText || 'Nhấn để bắt đầu trao đổi chi tiết dịch vụ'}
        </Text>
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
  title: { fontFamily: FontFamily.display, fontSize: 21, color: '#1B1C1C', marginTop: 1 },
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
  content: { padding: 16, paddingBottom: 38, gap: 14 },
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
  preview: { fontFamily: FontFamily.body, fontSize: 12, color: '#5F5E5E', marginTop: 4 },
});
