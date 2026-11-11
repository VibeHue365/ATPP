import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatApi } from '@/apis/chatApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/contexts/ToastContext';
import type { ChatMessage } from '@/types/chat';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

const QUICK_REPLIES = [
  'Chào tiệm, mình muốn tư vấn chọn size cổ phục ạ',
  'Mẫu này có kèm phụ kiện mấn/quạt không ạ?',
  'Mình muốn xác nhận lại giờ nhận đồ / chụp ảnh',
];

export default function Screen() {
  return (
    <RequireAuth>
      <Conversation />
    </RequireAuth>
  );
}

function Conversation() {
  const { id, name = 'Đối tác TàGo' } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { show } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        const data = await chatApi.messages(id);
        setMessages((current) => mergeMessages(current, Array.isArray(data) ? data : []));
      } catch (e) {
        if (!silent) show(getApiErrorMessage(e, 'Không thể tải hội thoại'), 'error');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, show]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isConnected) return;
    const timer = setInterval(() => void load(true), 5000);
    return () => clearInterval(timer);
  }, [isConnected, load]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.emit('join_room', { roomId: id });
    socket.emit('mark_read', { roomId: id });
    const onMessage = (message: ChatMessage) => {
      if (String(message.roomId) !== id) return;
      setMessages((current) => mergeMessages(current, [message]));
      if (String(message.senderId) !== user?.id) socket.emit('mark_read', { roomId: id });
    };
    const onRead = (payload: { roomId: string; userId: string }) => {
      if (String(payload.roomId) !== id || String(payload.userId) === user?.id) return;
      setMessages((current) =>
        current.map((message) =>
          String(message.senderId) === user?.id ? { ...message, isRead: true } : message
        )
      );
    };
    socket.on('new_message', onMessage);
    socket.on('messages_read', onRead);
    return () => {
      socket.off('new_message', onMessage);
      socket.off('messages_read', onRead);
    };
  }, [socket, isConnected, id, user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show('Cần quyền truy cập thư viện ảnh', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 5 - attachments.length),
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets.slice(0, 5 - attachments.length)) {
        const body = new FormData();
        body.append(
          'file',
          asset.file ??
            ({
              uri: asset.uri,
              name: asset.fileName ?? `chat-${Date.now()}.jpg`,
              type: asset.mimeType ?? 'image/jpeg',
            } as unknown as Blob)
        );
        const uploaded = await chatApi.upload(body);
        urls.push(uploaded.url);
      }
      setAttachments((current) => [...current, ...urls].slice(0, 5));
    } catch (e) {
      show(getApiErrorMessage(e, 'Không thể tải ảnh trò chuyện'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const send = async (presetText?: string) => {
    const value = (presetText ?? text).trim();
    if ((!value && !attachments.length) || sending || uploading) return;
    const pending = [...attachments];
    if (!presetText) setText('');
    setAttachments([]);
    if (socket && isConnected) {
      socket.emit('send_message', { roomId: id, messageText: value, attachments: pending });
      return;
    }
    setSending(true);
    try {
      const message = await chatApi.send(id, value, pending);
      setMessages((current) => mergeMessages(current, [message]));
    } catch (e) {
      setText(value);
      setAttachments(pending);
      show(getApiErrorMessage(e, 'Không thể gửi tin nhắn'), 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState label="Đang kết nối phòng trò chuyện..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.round}>
            <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
          </Pressable>
          <View style={s.partnerAvatar}>
            <Text style={s.partnerInitial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {name}
            </Text>
            <View style={s.connection}>
              <View style={[s.dot, isConnected ? s.online : s.offline]} />
              <Text style={s.sub}>
                {isConnected ? 'Đang kết nối trực tuyến' : 'Tự động đồng bộ mỗi 5 giây'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scroll}
          contentContainerStyle={s.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={32} color={Colors.primary} />
              <Text style={s.emptyTitle}>Bắt đầu cuộc trò chuyện với {name}</Text>
              <Text style={s.empty}>
                Bạn có thể hỏi về số đo trang phục, lịch trống hoặc gửi hình ảnh mẫu tham khảo.
              </Text>
            </View>
          ) : (
            messages.map((message, index) => {
              const mine = String(message.senderId) === user?.id;
              const isLastMine =
                mine && !messages.slice(index + 1).some((item) => String(item.senderId) === user?.id);
              return (
                <View key={message._id} style={[s.bubble, mine ? s.mine : s.theirs]}>
                  {message.messageText ? (
                    <Text style={[s.message, mine && s.mineText]}>{message.messageText}</Text>
                  ) : null}
                  {message.attachments?.length ? (
                    <View style={s.messageImages}>
                      {message.attachments.map((uri, value) => (
                        <Image
                          key={`${uri}-${value}`}
                          source={getMediaUrl(uri)}
                          style={s.messageImage}
                          contentFit="cover"
                        />
                      ))}
                    </View>
                  ) : null}
                  <Text style={[s.time, mine && s.mineTime]}>
                    {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {isLastMine && message.isRead ? ' · Đã xem' : ''}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {messages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.quickRow}>
            {QUICK_REPLIES.map((qr) => (
              <Pressable key={qr} onPress={() => void send(qr)} style={s.quickChip}>
                <Text style={s.quickChipText}>{qr}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {attachments.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.previews}>
            {attachments.map((uri, index) => (
              <View key={`${uri}-${index}`}>
                <Image source={getMediaUrl(uri)} style={s.preview} contentFit="cover" />
                <Pressable
                  onPress={() =>
                    setAttachments((current) => current.filter((_, value) => value !== index))
                  }
                  style={s.remove}>
                  <Ionicons name="close" size={13} color={Colors.white} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={s.composer}>
          <Pressable
            disabled={uploading || attachments.length >= 5}
            onPress={() => void pick()}
            style={[s.attach, (uploading || attachments.length >= 5) && s.disabled]}>
            <Ionicons
              name={uploading ? 'cloud-upload-outline' : 'image-outline'}
              size={20}
              color={Colors.primary}
            />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
            multiline
            placeholder={uploading ? 'Đang tải ảnh lên...' : 'Nhập tin nhắn...'}
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
          <Pressable
            disabled={(!text.trim() && !attachments.length) || sending || uploading}
            onPress={() => void send()}
            style={[
              s.send,
              ((!text.trim() && !attachments.length) || sending || uploading) && s.disabled,
            ]}>
            <Ionicons name="send" size={17} color={Colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  [...current, ...incoming].forEach((message) => byId.set(String(message._id), message));
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  header: {
    height: 62,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  partnerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInitial: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: Colors.primary,
  },
  name: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: '#1B1C1C' },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  online: { backgroundColor: Colors.success },
  offline: { backgroundColor: Colors.warning },
  sub: { fontFamily: FontFamily.body, fontSize: 10, color: '#8F8E8E' },
  messages: { padding: 14, gap: 9, flexGrow: 1, justifyContent: 'flex-end' },
  emptyBox: {
    alignItems: 'center',
    padding: 24,
    gap: 6,
    marginVertical: 20,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    textAlign: 'center',
  },
  empty: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F5E5E',
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderBottomLeftRadius: 4,
    ...Shadow,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#1B1C1C',
  },
  mineText: { color: Colors.white },
  messageImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  messageImage: {
    width: 130,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
  },
  time: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#8F8E8E',
    marginTop: 5,
  },
  mineTime: { color: '#FFE0E8', textAlign: 'right' },
  quickRow: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  quickChip: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.primary,
  },
  previews: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#FFF0F3',
  },
  remove: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attach: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 16,
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
