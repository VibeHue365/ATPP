import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiApi } from '@/apis/aiApi';
import { ProductCard } from '@/components/product/ProductCard';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type { VisualSearchResult } from '@/types/ai';
import { getApiErrorMessage } from '@/utils/apiError';
import { describeResults, prepareSearchImage, similarityLabel, VERY_SIMILAR_SCORE } from '@/utils/visualSearchImage';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'done'; result: VisualSearchResult }
  | { status: 'error'; message: string };

const NO_MATCH_MESSAGE = 'Không tìm thấy áo dài phù hợp trong ảnh.';

/** VIB-93: find catalog Ao Dai that look like a photo the customer takes or picks. */
export default function VisualSearchScreen() {
  const { show } = useToast();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const searching = state.status === 'searching';

  const pick = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show(source === 'camera' ? 'Cần quyền dùng camera để chụp áo dài' : 'Cần quyền truy cập thư viện ảnh', 'error');
      return;
    }
    // allowsEditing lets the customer crop to a single dress, which gives better matches.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 1 };
    const picked = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return;

    setState({ status: 'searching' });
    try {
      const image = await prepareSearchImage(picked.assets[0]);
      setPhotoUri(image.uri);
      const result = await aiApi.visualSearch(image.base64, image.mimeType);
      setState({ status: 'done', result });
    } catch (cause) {
      setState({ status: 'error', message: getApiErrorMessage(cause, 'Không thể tìm kiếm lúc này, vui lòng thử lại.') });
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.roundButton}>
        <Ionicons name="chevron-back" size={22} color={Colors.text}/>
      </Pressable>
      <View style={styles.mark}><Ionicons name="camera" size={19} color={Colors.white}/></View>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Tìm áo dài bằng ảnh</Text>
        <Text style={styles.subtitle}>Không cần đăng nhập · tối đa 5 mẫu tương tự</Text>
      </View>
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {photoUri
        ? <Image source={photoUri} style={styles.preview} contentFit="cover" accessibilityLabel="Ảnh bạn đã chọn"/>
        : <View style={[styles.preview, styles.placeholder]}>
            <Ionicons name="image-outline" size={40} color={Colors.textMuted}/>
            <Text style={styles.placeholderText}>Chụp hoặc chọn ảnh một mẫu áo dài bạn thích</Text>
          </View>}

      <View style={styles.actions}>
        {/* Not "Chụp ảnh": that is the photography tab's name in the bottom bar. */}
        <SourceButton icon="camera-outline" label="Mở camera" disabled={searching} onPress={() => pick('camera')}/>
        <SourceButton icon="images-outline" label="Chọn từ thư viện" disabled={searching} onPress={() => pick('library')}/>
      </View>

      {state.status === 'idle' && <Text style={styles.hint}>
        Mẹo: cắt khung chỉ còn một chiếc áo, chụp rõ dáng và màu để kết quả chính xác hơn.
      </Text>}
      {searching && <View style={styles.status}>
        <ActivityIndicator color={Colors.primary}/><Text style={styles.statusText}>Đang tìm mẫu tương tự...</Text>
      </View>}
      {state.status === 'error' && <Text style={styles.error}>{state.message}</Text>}
      {state.status === 'done' && state.result.items.length === 0 && <View style={styles.empty}>
        <Ionicons name="search-outline" size={32} color={Colors.textMuted}/>
        <Text style={styles.emptyTitle}>{state.result.message || NO_MATCH_MESSAGE}</Text>
        <Text style={styles.hint}>Hãy thử ảnh khác hoặc dùng bộ lọc màu sắc, kiểu dáng.</Text>
      </View>}
      {state.status === 'done' && state.result.items.length > 0 && <>
        <ResultsHeadline scores={state.result.items.map((item) => item.visualScore)}/>
        <View style={styles.grid}>
          {state.result.items.map((product) => <ProductCard
            key={product._id}
            product={product}
            badge={{ label: similarityLabel(product.visualScore), highlight: product.visualScore >= VERY_SIMILAR_SCORE }}
          />)}
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function ResultsHeadline({ scores }: { scores: number[] }) {
  const { exactMatch, title, subtitle } = describeResults(scores);
  return <View style={[styles.headline, exactMatch && styles.headlineExact]}>
    <Text style={[styles.headlineTitle, exactMatch && styles.headlineTitleExact]}>{title}</Text>
    {subtitle ? <Text style={styles.headlineSubtitle}>{subtitle}</Text> : null}
  </View>;
}

function SourceButton({ icon, label, disabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.source, disabled && styles.disabled]}>
    <Ionicons name={icon} size={18} color={Colors.primary}/>
    <Text style={styles.sourceText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  roundButton: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontFamily: FontFamily.display, fontSize: 20, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  content: { padding: Spacing.lg, paddingBottom: 32 },
  preview: { width: '100%', height: 260, borderRadius: Radius.md, backgroundColor: Colors.surfaceSoft },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, paddingHorizontal: 24 },
  placeholderText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  source: { flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  sourceText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Colors.primary },
  disabled: { opacity: 0.5 },
  hint: { fontFamily: FontFamily.body, fontSize: 11, lineHeight: 17, color: Colors.textMuted, marginTop: 12, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  statusText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Colors.primary },
  error: { marginTop: 16, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.errorSoft, color: Colors.error, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  empty: { alignItems: 'center', gap: 6, marginTop: 24 },
  emptyTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Colors.text, textAlign: 'center' },
  headline: { marginTop: 20, marginBottom: 12, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surfaceSoft, gap: 2 },
  headlineExact: { backgroundColor: Colors.primarySoft },
  headlineTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Colors.text },
  headlineTitleExact: { color: Colors.primary },
  headlineSubtitle: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
