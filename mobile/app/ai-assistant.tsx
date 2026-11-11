import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { aiApi } from '@/apis/aiApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type { AiRecommendedProduct } from '@/types/ai';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

type ChatMessage = {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  imageUri?: string;
  category?: string;
  source?: string;
  products?: AiRecommendedProduct[];
};

type SelectedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

const greeting: ChatMessage = {
  id: 'welcome',
  sender: 'AI',
  text: 'Xin chào! Mình là TàGo AI Stylist. Mình có thể tư vấn phom dáng cổ phục triều Nguyễn (Ngũ Thân, Nhật Bình), chất liệu, kích cỡ và gợi ý trang phục hợp với địa điểm chụp tại Cố đô Huế.',
};

const suggestions = [
  'Chụp ảnh ở Đại Nội Huế nên mặc Nhật Bình hay Ngũ Thân?',
  'Mình cao 1m58 nặng 49kg mặc size gì vừa?',
  'Gợi ý cổ phục màu đỏ hoặc vàng hoàng gia chụp nắng chiều',
  'Chất liệu lụa hay gấm lên hình ngoại cảnh đẹp hơn?',
];

export default function AiAssistantScreen() {
  return (
    <RequireAuth>
      <AiAssistant />
    </RequireAuth>
  );
}

function AiAssistant() {
  const { show } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, sending, image]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show('Cần quyền truy cập thư viện ảnh để gửi ảnh cho AI Stylist', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.65,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      show('Ảnh cần nhỏ hơn 5MB', 'error');
      return;
    }
    if (!asset.base64) {
      show('Không thể đọc dữ liệu ảnh đã chọn', 'error');
      return;
    }
    setImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const send = async (suggestedText?: string) => {
    const outgoingText = (suggestedText ?? text).trim();
    if ((!outgoingText && !image) || sending) return;
    const selectedImage = image;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      text: outgoingText,
      imageUri: selectedImage?.uri,
    };
    setMessages((current) => [...current, userMessage]);
    setText('');
    setImage(null);
    setSending(true);
    try {
      const response = selectedImage
        ? await aiApi.chatWithImage({
            message: outgoingText,
            image_base64: selectedImage.base64,
            mime_type: selectedImage.mimeType,
          })
        : await aiApi.chat(outgoingText);
      setMessages((current) => [
        ...current,
        {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          text: response.answer || 'Mình chưa tìm thấy câu trả lời phù hợp.',
          category: response.category,
          source: response.source,
          products: response.recommended_products ?? [],
        },
      ]);
    } catch (cause) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          sender: 'AI',
          text: 'TàGo AI Stylist đang tạm thời bận xử lý. Bạn vui lòng thử lại sau giây lát nhé.',
        },
      ]);
      show(getApiErrorMessage(cause, 'Không thể kết nối trợ lý AI'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
            style={styles.roundButton}>
            <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
          </Pressable>
          <View style={styles.assistantMark}>
            <Ionicons name="sparkles" size={18} color={Colors.white} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>TàGo AI Stylist</Text>
            <Text style={styles.subtitle}>Cố vấn Cổ phục & Nhiếp ảnh Cố đô</Text>
          </View>
          <Pressable
            onPress={() => router.push('/virtual-tryon' as Href)}
            style={styles.tryOnPill}>
            <Ionicons name="camera-outline" size={14} color={Colors.primary} />
            <Text style={styles.tryOnPillText}>Thử đồ AI</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {sending && (
            <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.thinkingText}>AI Stylist đang phân tích...</Text>
            </View>
          )}
        </ScrollView>

        {messages.length === 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestions}>
            {suggestions.map((item) => (
              <Pressable key={item} onPress={() => void send(item)} style={styles.suggestion}>
                <Ionicons name="sparkles-outline" size={12} color={Colors.primary} />
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {image && (
          <View style={styles.imagePreview}>
            <Image source={image.uri} style={styles.previewImage} contentFit="cover" />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>Ảnh tham khảo của bạn</Text>
              <Text style={styles.previewHint}>AI sẽ phân tích tông màu và bối cảnh ảnh.</Text>
            </View>
            <Pressable
              accessibilityLabel="Bỏ ảnh"
              onPress={() => setImage(null)}
              style={styles.removeImage}>
              <Ionicons name="close" size={16} color={Colors.white} />
            </Pressable>
          </View>
        )}

        <View style={styles.composer}>
          <Pressable
            disabled={sending}
            accessibilityLabel="Chọn ảnh"
            onPress={() => void pickImage()}
            style={styles.attachButton}>
            <Ionicons name="image-outline" size={21} color={Colors.primary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            editable={!sending}
            multiline
            maxLength={1000}
            placeholder="Hỏi về kiểu dáng cổ phục, size, địa điểm chụp..."
            placeholderTextColor="#8F8E8E"
            style={styles.input}
          />
          <Pressable
            disabled={sending || (!text.trim() && !image)}
            accessibilityLabel="Gửi"
            onPress={() => void send()}
            style={[
              styles.sendButton,
              (sending || (!text.trim() && !image)) && styles.disabled,
            ]}>
            <Ionicons name="send" size={17} color={Colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.sender === 'USER';
  return (
    <View style={[styles.messageBlock, mine ? styles.mineBlock : styles.aiBlock]}>
      <View style={[styles.bubble, mine ? styles.userBubble : styles.aiBubble]}>
        {message.imageUri && (
          <Image source={message.imageUri} style={styles.messageImage} contentFit="cover" />
        )}
        {!!message.text && (
          <Text style={[styles.messageText, mine && styles.userText]}>{message.text}</Text>
        )}
      </View>
      {!mine && !!message.products?.length && (
        <View style={styles.recommendations}>
          <Text style={styles.recommendationLabel}>CỔ PHỤC ĐƯỢC GỢI Ý CHO BẠN</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productRow}>
            {message.products.map((product) => (
              <Pressable
                key={product._id}
                onPress={() => router.push(`/product/${product._id}` as Href)}
                style={styles.productCard}>
                {product.images?.[0] ? (
                  <Image
                    source={getMediaUrl(product.images[0])}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.productImageFallback}>
                    <Ionicons name="sparkles-outline" size={22} color={Colors.primary} />
                  </View>
                )}
                <Text numberOfLines={2} style={styles.productName}>
                  {product.name}
                </Text>
                {product.basePrice != null && (
                  <Text style={styles.productPrice}>
                    {new Intl.NumberFormat('vi-VN').format(product.basePrice)}đ/ngày
                  </Text>
                )}
                <Text style={styles.detailLink}>Xem chi tiết ›</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {!mine && message.category && message.category !== 'general' && (
        <Text style={styles.meta}>Chủ đề: {message.category.replaceAll('_', ' ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantMark: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { fontFamily: FontFamily.display, fontSize: 19, color: '#1B1C1C' },
  subtitle: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#8F8E8E', marginTop: 1 },
  tryOnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tryOnPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: Colors.primary,
  },
  messages: { padding: Spacing.lg, paddingBottom: 20, gap: 14 },
  messageBlock: { maxWidth: '88%', gap: 7 },
  mineBlock: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  aiBlock: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    overflow: 'hidden',
  },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderTopLeftRadius: 4,
    ...Shadow,
  },
  messageText: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 20, color: '#1B1C1C' },
  userText: { color: Colors.white },
  messageImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 9 },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginLeft: Spacing.lg,
    marginBottom: 8,
  },
  thinkingText: { fontFamily: FontFamily.bodyMedium, fontSize: 11.5, color: '#5F5E5E' },
  suggestions: { paddingHorizontal: Spacing.lg, paddingBottom: 10, gap: 8 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#FFD9E2',
    backgroundColor: '#FFF0F3',
  },
  suggestionText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: Colors.primary },
  imagePreview: {
    marginHorizontal: Spacing.lg,
    marginBottom: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewImage: { width: 52, height: 52, borderRadius: 10 },
  previewCopy: { flex: 1 },
  previewTitle: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#1B1C1C' },
  previewHint: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#5F5E5E', marginTop: 2 },
  removeImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 105,
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
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  recommendations: { width: 310, paddingTop: 4 },
  recommendationLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: Colors.primary,
    marginBottom: 7,
  },
  productRow: { gap: 10, paddingRight: 12 },
  productCard: {
    width: 148,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Shadow,
  },
  productImage: { width: '100%', height: 100 },
  productImageFallback: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F3',
  },
  productName: {
    minHeight: 38,
    paddingHorizontal: 10,
    paddingTop: 8,
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#1B1C1C',
  },
  productPrice: {
    paddingHorizontal: 10,
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  detailLink: {
    padding: 10,
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: Colors.primary,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: 9.5,
    color: '#8F8E8E',
    paddingHorizontal: 4,
    textTransform: 'capitalize',
  },
});
