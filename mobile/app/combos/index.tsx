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
import { ComboCard } from '@/components/combo/ComboCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useCombos } from '@/hooks/useCombos';
import type { ComboSort } from '@/types/combo';
import { comboPublishedPrice } from '@/types/combo';

const PAGE_SIZE = 6;
const sorts: Array<{ key: ComboSort; label: string }> = [
  { key: 'popular', label: 'Phổ biến nhất' },
  { key: 'discount_desc', label: 'Ưu đãi cao nhất' },
  { key: 'price_asc', label: 'Giá thấp → cao' },
  { key: 'price_desc', label: 'Giá cao → thấp' },
  { key: 'newest', label: 'Mới ra mắt' },
];

export default function ComboListScreen() {
  const { items, loading, error, reload } = useCombos();
  const { count } = useCart();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Tất cả');
  const [sort, setSort] = useState<ComboSort>('popular');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const validItems = useMemo(
    () =>
      items.filter(
        (item) => Boolean(item.productId?.name && item.photographyPackageId?.name)
      ),
    [items]
  );

  const cities = useMemo(
    () => [
      'Tất cả',
      ...new Set(
        validItems
          .map((item) => item.providerId?.address?.city)
          .filter((v): v is string => Boolean(v))
      ),
    ],
    [validItems]
  );

  const filtered = useMemo(() => {
    const key = query.trim().toLocaleLowerCase('vi');
    const result = validItems.filter(
      (item) =>
        (city === 'Tất cả' || item.providerId?.address?.city === city) &&
        (!key ||
          [
            item.name,
            item.description,
            item.productId?.name,
            item.photographyPackageId?.name,
            item.providerId?.businessName,
          ].some((value) => value?.toLocaleLowerCase('vi').includes(key)))
    );
    return [...result].sort((a, b) =>
      sort === 'price_asc'
        ? comboPublishedPrice(a) - comboPublishedPrice(b)
        : sort === 'price_desc'
          ? comboPublishedPrice(b) - comboPublishedPrice(a)
          : sort === 'discount_desc'
            ? b.discountPercent - a.discountPercent
            : sort === 'newest'
              ? new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
              : (b.usedCount ?? 0) - (a.usedCount ?? 0)
    );
  }, [validItems, query, city, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [query, city, sort]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !refreshing) return <LoadingState label="Đang tải các gói Combo ưu đãi..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.brand}>TàGo Combo</Text>
          <Text style={s.headerTitle}>CỔ PHỤC & NHIẾP ẢNH TRỌN GÓI</Text>
        </View>
        <Pressable style={s.back} onPress={() => router.push('/cart' as Href)}>
          <Ionicons name="bag-handle-outline" size={20} color="#1B1C1C" />
          {count > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }>
        {/* Premium Burgundy Value Hero */}
        <View style={s.hero}>
          <View style={s.heroTopRow}>
            <View style={s.heroBadge}>
              <Ionicons name="sparkles" size={11} color="#FFE082" />
              <Text style={s.eyebrow}>TRỌN GÓI TIẾT KIỆM TỚI 35%</Text>
            </View>
            <View style={s.hotTag}>
              <Text style={s.hotTagText}>BEST DEAL</Text>
            </View>
          </View>

          <Text style={s.title}>Combo Cổ Phục & Thợ Ảnh Trọn Gói</Text>
          <Text style={s.subtitle}>
            Đặt đồng thời trang phục di sản và ekip nhiếp ảnh gia riêng. Tiết kiệm chi phí, không lo phát sinh, được bảo chứng ảnh chất lượng cao.
          </Text>

          {/* Formula capsule row */}
          <View style={s.formulaCard}>
            <View style={s.formulaItem}>
              <Text style={s.formulaEmoji}>👘</Text>
              <Text style={s.formulaText}>Cổ Phục</Text>
            </View>
            <Text style={s.formulaPlus}>+</Text>
            <View style={s.formulaItem}>
              <Text style={s.formulaEmoji}>📸</Text>
              <Text style={s.formulaText}>Thợ Ảnh</Text>
            </View>
            <Text style={s.formulaEqual}>=</Text>
            <View style={[s.formulaItem, s.formulaResult]}>
              <Text style={s.formulaEmoji}>💰</Text>
              <Text style={s.formulaResultText}>Giảm tới 35%</Text>
            </View>
          </View>
        </View>

        {/* Social Proof & Trust Strip */}
        <View style={s.trustBar}>
          <View style={s.trustItem}>
            <Ionicons name="flame" size={15} color="#E11D48" />
            <Text style={s.trustText}>100+ Đã đặt</Text>
          </View>
          <View style={s.trustDivider} />
          <View style={s.trustItem}>
            <Ionicons name="shield-checkmark" size={15} color="#059669" />
            <Text style={s.trustText}>100% Không phụ phí</Text>
          </View>
          <View style={s.trustDivider} />
          <View style={s.trustItem}>
            <Ionicons name="flash" size={14} color="#D97706" />
            <Text style={s.trustText}>Trả ảnh 24-48h</Text>
          </View>
        </View>

        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color="#8F8E8E" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm combo, cổ phục, studio..."
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#8F8E8E" />
            </Pressable>
          ) : null}
        </View>

        <Text style={s.filterLabel}>KHU VỰC</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}>
          {cities.map((value) => (
            <Chip key={value} label={value} active={city === value} onPress={() => setCity(value)} />
          ))}
        </ScrollView>

        <Text style={s.filterLabel}>SẮP XẾP THEO</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}>
          {sorts.map((value) => (
            <Chip
              key={value.key}
              label={value.label}
              active={sort === value.key}
              onPress={() => setSort(value.key)}
            />
          ))}
        </ScrollView>

        <View style={s.result}>
          <Text style={s.resultText}>Hiển thị {filtered.length} gói Combo</Text>
          {(query || city !== 'Tất cả' || sort !== 'popular') && (
            <Pressable
              onPress={() => {
                setQuery('');
                setCity('Tất cả');
                setSort('popular');
              }}>
              <Text style={s.reset}>Xóa bộ lọc</Text>
            </Pressable>
          )}
        </View>

        {shown.length ? (
          shown.map((item) => <ComboCard key={item._id} combo={item} />)
        ) : (
          <EmptyState
            title={items.length ? 'Không tìm thấy gói Combo phù hợp' : 'Chưa có Combo công khai'}
            message={
              items.length
                ? 'Hãy thử thay đổi từ khóa hoặc chọn khu vực khác.'
                : 'Hiện tại các tiệm đang cập nhật thêm gói Combo mới. Bạn vẫn có thể thuê áo và đặt thợ ảnh riêng và được giảm tự động 10%!'
            }
          />
        )}

        {totalPages > 1 && (
          <View style={s.pagination}>
            <Pressable
              disabled={page === 1}
              onPress={() => setPage((v) => v - 1)}
              style={[s.pageButton, page === 1 && s.disabled]}>
              <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            </Pressable>
            <Text style={s.pageText}>
              Trang {page}/{totalPages}
            </Text>
            <Pressable
              disabled={page === totalPages}
              onPress={() => setPage((v) => v + 1)}
              style={[s.pageButton, page === totalPages && s.disabled]}>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F9' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 2,
  },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  hero: {
    backgroundColor: '#7A0C2E',
    borderRadius: 22,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
    ...Shadow,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFE082',
    letterSpacing: 0.5,
  },
  hotTag: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hotTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFFFFF',
    marginTop: 12,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 6,
  },
  formulaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  formulaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formulaEmoji: {
    fontSize: 13,
  },
  formulaText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  formulaPlus: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  formulaEqual: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  formulaResult: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  formulaResultText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#5C0820',
  },
  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#374151',
  },
  trustDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
  },
  search: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    ...Shadow,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  filterLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: '#8F8E8E',
    marginBottom: -6,
  },
  chips: { gap: 8, paddingRight: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  chipTextActive: { color: Colors.white },
  result: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  resultText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  reset: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginTop: 8,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#1B1C1C',
  },
  disabled: { opacity: 0.35 },
});
