import React, { useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
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
import { ProductCard } from '@/components/product/ProductCard';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useProducts } from '@/hooks/useProducts';
import type { ProductFilters } from '@/types/product';
import { useAuth } from '@/contexts/AuthContext';

const categories = [
  { label: 'Tất cả mẫu', value: '', icon: 'sparkles-outline' as const },
  { label: 'Áo dài nữ', value: 'female', icon: 'woman-outline' as const },
  { label: 'Áo dài nam', value: 'male', icon: 'man-outline' as const },
  { label: 'Áo dài đôi', value: 'couple', icon: 'people-outline' as const },
];

const locations = [
  { label: 'Tất cả khu vực', value: '' },
  { label: 'Huế', value: 'Huế' },
  { label: 'Đà Nẵng', value: 'Đà Nẵng' },
  { label: 'Hội An', value: 'Hội An' },
];

const sizes = [
  { label: 'Đủ size', value: '' },
  { label: 'Size S', value: 'S' },
  { label: 'Size M', value: 'M' },
  { label: 'Size L', value: 'L' },
  { label: 'Size XL', value: 'XL' },
];

type SortMode = 'recommended' | 'newest' | 'rating_desc' | 'price_asc' | 'price_desc';

const publicSorts: Array<{ label: string; value: Exclude<ProductFilters['sort'], undefined> }> = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Đánh giá cao', value: 'rating_desc' },
  { label: 'Giá thấp → cao', value: 'price_asc' },
  { label: 'Giá cao → thấp', value: 'price_desc' },
];

const memberSorts = [{ label: 'Gợi ý cho bạn', value: 'recommended' as const }, ...publicSorts];

export default function RentalsScreen() {
  const { isAuthenticated } = useAuth();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const sorts: Array<{ label: string; value: SortMode }> = isAuthenticated
    ? memberSorts
    : publicSorts;
  const effectiveSort: SortMode =
    !isAuthenticated && sortMode === 'recommended' ? 'newest' : sortMode;
  const personalized = isAuthenticated && effectiveSort === 'recommended';

  const filters: ProductFilters = {
    search: search || undefined,
    types: category ? [category] : undefined,
    providerLocation: selectedLocation || undefined,
    sizes: selectedSize ? [selectedSize] : undefined,
    sort: personalized ? undefined : (effectiveSort as ProductFilters['sort']),
    page,
    limit: 10,
  };

  const { products, loading, error, total, totalPages, reload } = useProducts(
    filters,
    personalized
  );

  const change = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const hasActiveFilters = Boolean(
    search || category || selectedLocation || selectedSize
  );

  const handleResetFilters = () => {
    setDraft('');
    setSearch('');
    setCategory('');
    setSelectedLocation('');
    setSelectedSize('');
    setPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <BrandHeader />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Hero Banner Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroTagPill}>
              <MaterialCommunityIcons name="hanger" size={13} color={Colors.primary} />
              <Text style={styles.heroTagText}>TỦ CỔ PHỤC & ÁO DÀI DI SẢN</Text>
            </View>
            <View style={styles.escrowTag}>
              <Ionicons name="shield-checkmark" size={12} color="#059669" />
              <Text style={styles.escrowTagText}>100% Escrow</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Thuê Cổ Phục & Áo Dài</Text>
          <Text style={styles.heroSubtitle}>
            Tuyển chọn Nhật Bình, Ngũ Thân, Áo Tấc và Áo dài truyền thống từ các nhà may uy tín
            tại Cố đô Huế.
          </Text>

          {/* Search Input Box */}
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={18} color={Colors.primary} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => change(() => setSearch(draft.trim()))}
                placeholder="Tìm Nhật Bình, Ngũ Thân, lụa tơ tằm..."
                placeholderTextColor="#8F8E8E"
                style={styles.searchInput}
                returnKeyType="search"
              />
              {draft.length > 0 && (
                <Pressable
                  onPress={() => {
                    setDraft('');
                    if (search) change(() => setSearch(''));
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#8F8E8E" />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tìm áo dài bằng hình ảnh"
                hitSlop={6}
                onPress={() => router.push('/visual-search' as Href)}
                style={styles.cameraButton}
              >
                <Ionicons name="camera-outline" size={17} color={Colors.primary} />
              </Pressable>
            </View>
            <Pressable
              style={styles.searchBtn}
              onPress={() => change(() => setSearch(draft.trim()))}
            >
              <Text style={styles.searchBtnText}>Tìm</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() => router.push('/stores' as Href)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 9,
                borderRadius: 99,
                backgroundColor: '#FFF0F5',
                borderWidth: 1,
                borderColor: '#F3C4D5',
              }}
            >
              <Ionicons name="storefront-outline" size={14} color={Colors.primary} />
              <Text
                style={{
                  fontFamily: FontFamily.bodyBold,
                  fontSize: 11.5,
                  color: Colors.primary,
                }}
              >
                Danh bạ Cửa hàng
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/virtual-tryon' as Href)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 9,
                borderRadius: 99,
                backgroundColor: '#1E1418',
              }}
            >
              <Ionicons name="sparkles-outline" size={14} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: FontFamily.bodyBold,
                  fontSize: 11.5,
                  color: '#FFFFFF',
                }}
              >
                Thử đồ ảo AI 2D
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {categories.map((item) => {
            const active = category === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => change(() => setCategory(item.value))}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={active ? '#FFFFFF' : Colors.primary}
                />
                <Text
                  style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Filter Bar: Area + Size */}
        <View style={styles.filterPanel}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>KHU VỰC:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.inlinePills}
            >
              {locations.map((loc) => {
                const active = selectedLocation === loc.value;
                return (
                  <Pressable
                    key={loc.label}
                    onPress={() => change(() => setSelectedLocation(loc.value))}
                    style={[styles.miniPill, active && styles.miniPillActive]}
                  >
                    <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                      {loc.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>KÍCH CỠ:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.inlinePills}
            >
              {sizes.map((sz) => {
                const active = selectedSize === sz.value;
                return (
                  <Pressable
                    key={sz.label}
                    onPress={() => change(() => setSelectedSize(sz.value))}
                    style={[styles.miniPill, active && styles.miniPillActive]}
                  >
                    <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                      {sz.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Results Count & Sort Selector */}
        <View style={styles.listHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultCountText}>
              {total} mẫu trang phục sẵn sàng
            </Text>
            {personalized && (
              <Text style={styles.personalizedHint}>
                ✨ Được cá nhân hóa theo gu thẩm mỹ của bạn
              </Text>
            )}
          </View>

          {hasActiveFilters && (
            <Pressable style={styles.resetPill} onPress={handleResetFilters}>
              <Ionicons name="refresh" size={13} color={Colors.primary} />
              <Text style={styles.resetPillText}>Xóa lọc</Text>
            </Pressable>
          )}
        </View>

        {/* Sort Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScroll}
        >
          {sorts.map((sItem) => {
            const active = effectiveSort === sItem.value;
            return (
              <Pressable
                key={sItem.value}
                onPress={() => change(() => setSortMode(sItem.value))}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {sItem.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Product Grid */}
        {loading ? (
          <LoadingState label="Đang tải bộ sưu tập áo dài..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : products.length === 0 ? (
          <EmptyState
            title="Chưa tìm thấy mẫu phù hợp"
            message="Bạn hãy thử đổi từ khóa tìm kiếm hoặc chọn kích cỡ, khu vực khác."
          />
        ) : (
          <View style={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </View>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <View style={styles.pagination}>
            <Pressable
              disabled={page === 1}
              onPress={() => setPage((v) => Math.max(1, v - 1))}
              style={[styles.pageButton, page === 1 && styles.disabled]}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.primary} />
            </Pressable>
            <View style={styles.pageIndicator}>
              <Text style={styles.pageText}>
                Trang {page} / {totalPages}
              </Text>
            </View>
            <Pressable
              disabled={page === totalPages}
              onPress={() => setPage((v) => Math.min(totalPages, v + 1))}
              style={[styles.pageButton, page === totalPages && styles.disabled]}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrap: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    gap: 10,
    ...Shadow,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  escrowTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  escrowTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#059669',
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 25,
    lineHeight: 32,
    color: '#1B1C1C',
  },
  heroSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#5F5E5E',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  searchInputWrap: {
    flex: 1,
    height: 46,
    backgroundColor: '#F5F3F3',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#1B1C1C',
  },
  cameraButton: {
    width: 30,
    height: 30,
    borderRadius: 99,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#1B1C1C',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  filterPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 10,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterGroupLabel: {
    width: 64,
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#8F8E8E',
  },
  inlinePills: {
    gap: 6,
    paddingRight: 8,
  },
  miniPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F3F3',
  },
  miniPillActive: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  miniPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  miniPillTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyBold,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  resultCountText: {
    fontFamily: FontFamily.display,
    fontSize: 19,
    color: '#1B1C1C',
  },
  personalizedHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: Colors.primary,
    marginTop: 2,
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  resetPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  sortScroll: {
    gap: 8,
    paddingRight: 8,
    marginTop: -4,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  sortChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F3',
  },
  sortChipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  sortChipTextActive: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
  },
  pageText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  disabled: {
    opacity: 0.35,
  },
});
