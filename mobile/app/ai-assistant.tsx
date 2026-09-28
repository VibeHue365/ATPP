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
  text: 'Xin chào! Mình có thể tư vấn kiểu dáng, chất liệu, kích cỡ và gợi ý áo dài phù hợp với nhu cầu của bạn.',
};

const suggestions = [
  'Tư vấn chọn size áo dài',
  'Chất liệu nào hợp chụp ngoại cảnh?',
  'Gợi ý áo dài chụp ảnh tại Huế',
];

export default function AiAssistantScreen() {
  return <RequireAuth><AiAssistant /></RequireAuth>;
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
      show('Cần quyền truy cập thư viện ảnh để gửi ảnh cho trợ lý AI', 'error');
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
      setMessages((current) => [...current, {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: response.answer || 'Mình chưa tìm thấy câu trả lời phù hợp.',
        category: response.category,
        source: response.source,
        products: response.recommended_products ?? [],
      }]);
    } catch (cause) {
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        sender: 'AI',
        text: 'Trợ lý AI đang tạm thời không phản hồi. Bạn vui lòng thử lại sau.',
      }]);
      show(getApiErrorMessage(cause, 'Không thể kết nối trợ lý AI'), 'error');
    } finally {
      setSending(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.roundButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text}/>
        </Pressable>
        <View style={styles.assistantMark}><Ionicons name="sparkles" size={19} color={Colors.white}/></View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Trợ lý AI LUMÉ</Text>
          <Text style={styles.subtitle}>Tư vấn áo dài · API trực tuyến</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {messages.map((message) => <MessageBubble key={message.id} message={message}/>) }
        {sending && <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
          <ActivityIndicator size="small" color={Colors.primary}/><Text style={styles.thinkingText}>Đang phân tích...</Text>
        </View>}
      </ScrollView>

      {messages.length === 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
        {suggestions.map((item) => <Pressable key={item} onPress={() => void send(item)} style={styles.suggestion}>
          <Text style={styles.suggestionText}>{item}</Text>
        </Pressable>)}
      </ScrollView>}

      {image && <View style={styles.imagePreview}>
        <Image source={image.uri} style={styles.previewImage} contentFit="cover"/>
        <View style={styles.previewCopy}><Text style={styles.previewTitle}>Ảnh tham khảo</Text><Text style={styles.previewHint}>AI sẽ phân tích ảnh cùng câu hỏi của bạn.</Text></View>
        <Pressable accessibilityLabel="Bỏ ảnh" onPress={() => setImage(null)} style={styles.removeImage}>
          <Ionicons name="close" size={16} color={Colors.white}/>
        </Pressable>
      </View>}

      <View style={styles.composer}>
        <Pressable disabled={sending} accessibilityLabel="Chọn ảnh" onPress={() => void pickImage()} style={styles.attachButton}>
          <Ionicons name="image-outline" size={21} color={Colors.primary}/>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!sending}
          multiline
          maxLength={1000}
          placeholder="Hỏi về kiểu dáng, size, chất liệu..."
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <Pressable disabled={sending || (!text.trim() && !image)} accessibilityLabel="Gửi" onPress={() => void send()} style={[styles.sendButton, (sending || (!text.trim() && !image)) && styles.disabled]}>
          <Ionicons name="send" size={18} color={Colors.white}/>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.sender === 'USER';
  return <View style={[styles.messageBlock, mine ? styles.mineBlock : styles.aiBlock]}>
    <View style={[styles.bubble, mine ? styles.userBubble : styles.aiBubble]}>
      {message.imageUri && <Image source={message.imageUri} style={styles.messageImage} contentFit="cover"/>}
      {!!message.text && <Text style={[styles.messageText, mine && styles.userText]}>{message.text}</Text>}
    </View>
    {!mine && !!message.products?.length && <View style={styles.recommendations}>
      <Text style={styles.recommendationLabel}>SẢN PHẨM ĐƯỢC GỢI Ý</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>
        {message.products.map((product) => <Pressable key={product._id} onPress={() => router.push(`/product/${product._id}` as Href)} style={styles.productCard}>
          {product.images?.[0]
            ? <Image source={getMediaUrl(product.images[0])} style={styles.productImage} contentFit="cover"/>
            : <View style={styles.productImageFallback}><Ionicons name="sparkles-outline" size={22} color={Colors.primary}/></View>}
          <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
          {product.basePrice != null && <Text style={styles.productPrice}>{new Intl.NumberFormat('vi-VN').format(product.basePrice)}đ</Text>}
          <Text style={styles.detailLink}>Xem chi tiết →</Text>
        </Pressable>)}
      </ScrollView>
    </View>}
    {!mine && message.category && message.category !== 'general' && <Text style={styles.meta}>Chủ đề: {message.category.replaceAll('_', ' ')}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  roundButton: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  assistantMark: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontFamily: FontFamily.display, fontSize: 20, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  messages: { padding: Spacing.lg, paddingBottom: 20, gap: 14 },
  messageBlock: { maxWidth: '88%', gap: 7 },
  mineBlock: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  aiBlock: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: Radius.md, overflow: 'hidden' },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderTopLeftRadius: 4, ...Shadow },
  messageText: { fontFamily: FontFamily.body, fontSize: 12, lineHeight: 19, color: Colors.text },
  userText: { color: Colors.white },
  messageImage: { width: 220, height: 160, borderRadius: Radius.sm, marginBottom: 9 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginLeft: Spacing.lg, marginBottom: 8 },
  thinkingText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textMuted },
  suggestions: { paddingHorizontal: Spacing.lg, paddingBottom: 9, gap: 8 },
  suggestion: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  suggestionText: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.primary },
  imagePreview: { marginHorizontal: Spacing.lg, marginBottom: 8, padding: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewImage: { width: 52, height: 52, borderRadius: Radius.sm },
  previewCopy: { flex: 1 },
  previewTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: Colors.text },
  previewHint: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textMuted, marginTop: 3 },
  removeImage: { width: 24, height: 24, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  attachButton: { width: 42, height: 42, borderRadius: Radius.pill, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 42, maxHeight: 105, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FontFamily.body, fontSize: 11, color: Colors.text },
  sendButton: { width: 42, height: 42, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  recommendations: { width: 300, paddingTop: 3 },
  recommendationLabel: { fontFamily: FontFamily.bodyBold, fontSize: 8, color: Colors.textMuted, marginBottom: 7 },
  productRow: { gap: 9, paddingRight: 12 },
  productCard: { width: 142, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surface },
  productImage: { width: '100%', height: 90 },
  productImageFallback: { width: '100%', height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primarySoft },
  productName: { minHeight: 40, paddingHorizontal: 9, paddingTop: 8, fontFamily: FontFamily.bodySemiBold, fontSize: 10, lineHeight: 15, color: Colors.text },
  productPrice: { paddingHorizontal: 9, fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.primary },
  detailLink: { padding: 9, fontFamily: FontFamily.bodyMedium, fontSize: 9, color: Colors.primary },
  meta: { fontFamily: FontFamily.body, fontSize: 8, color: Colors.textMuted, paddingHorizontal: 3, textTransform: 'capitalize' },
});
