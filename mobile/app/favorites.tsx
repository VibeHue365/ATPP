import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
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
import { photographerApi } from '@/apis/photographerApi';
import { productApi } from '@/apis/productApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ListPagination } from '@/components/ui/ListPagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import type { UserFavorite } from '@/types/auth';
import type { Photographer } from '@/types/photographer';
import type { Product } from '@/types/product';
import { getMediaUrl } from '@/utils/media';

type Saved = { kind: 'PRODUCT'; data: Product } | { kind: 'PROVIDER'; data: Photographer };
type Filter = 'ALL' | 'PRODUCT' | 'PROVIDER';

export default function Screen() {
  return (
    <RequireAuth>
      <Favorites />
    </RequireAuth>
  );
}

function Favorites() {
  const { user, toggleFavorite } = useAuth();
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [nameSort, setNameSort] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        setError(null);
        const favorites = (user?.favorites ?? []) as UserFavorite[];
        const resolved = await Promise.all(
          favorites.map(async (fav) => {
            try {
              return fav.targetType.toUpperCase() === 'PRODUCT'
                ? {
                    kind: 'PRODUCT' as const,
                    data: await productApi.detail(String(fav.targetId)),
                  }
                : {
                    kind: 'PROVIDER' as const,
                    data: await photographerApi.detail(String(fav.targetId)),
                  };
            } catch {
              return null;
            }
          })
        );
        setItems(resolved.filter((v): v is Saved => Boolean(v)));
      } catch {
        setError('Không thể tải bộ sưu tập yêu thích');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.favorites]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load])
  );

  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          if (filter !== 'ALL' && item.kind !== filter) return false;
          const name = item.kind === 'PRODUCT' ? item.data.name : (item.data.businessName ?? '');
          return !q || name.toLowerCase().includes(q.toLowerCase());
        })
        .sort((a, b) => (nameSort ? savedName(a).localeCompare(savedName(b), 'vi') : 0)),
    [items, filter, q, nameSort]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * 8, safePage * 8);

  const remove = async (item: Saved) => {
    await toggleFavorite(item.kind, item.data._id);
    setItems((v) =>
      v.filter((saved) => !(saved.kind === item.kind && saved.data._id === item.data._id))
    );
  };

  if (loading) return <LoadingState label="Đang mở bộ sưu tập yêu thích..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.round}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TÀGO ARCHIVE</Text>
          <Text style={s.title}>
            Bộ sưu tập yêu thích <Text style={s.total}>({items.length})</Text>
          </Text>
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
            onChangeText={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Tìm trong danh sách đã lưu..."
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
          <Pressable
            onPress={() => {
              setNameSort((value) => !value);
              setPage(1);
            }}>
            <Ionicons
              name="swap-vertical-outline"
              size={18}
              color={nameSort ? Colors.primary : '#8F8E8E'}
            />
          </Pressable>
        </View>

        <View style={s.filters}>
          {(
            [
              ['ALL', `Tất cả (${items.length})`],
              ['PRODUCT', `Cổ phục (${items.filter((v) => v.kind === 'PRODUCT').length})`],
              ['PROVIDER', `Nhiếp ảnh (${items.filter((v) => v.kind === 'PROVIDER').length})`],
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
        </View>

        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Bộ sưu tập chưa có mục nào"
            message="Hãy nhấn biểu tượng trái tim ở các mẫu cổ phục hoặc gói chụp ảnh bạn ưng ý để lưu lại so sánh và đặt lịch."
          />
        ) : (
          <View style={s.grid}>
            {visible.map((item) => (
              <SavedCard
                key={`${item.kind}-${item.data._id}`}
                item={item}
                onRemove={() => void remove(item)}
              />
            ))}
          </View>
        )}

        <ListPagination page={safePage} totalPages={totalPages} onChange={setPage} />
        {filtered.length > 0 && (
          <Text style={s.footer}>
            Hiển thị {visible.length}/{filtered.length} mục đã lưu
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SavedCard({ item, onRemove }: { item: Saved; onRemove: () => void }) {
  const isProduct = item.kind === 'PRODUCT';
  const data = item.data;
  const name = isProduct
    ? (data as Product).name
    : ((data as Photographer).businessName ?? 'Gói chụp TàGo');
  const image = isProduct
    ? (data as Product).images?.[0]
    : ((data as Photographer).coverImage ?? (data as Photographer).media?.coverUrl);
  const price = isProduct
    ? ((data as Product).discountedPrice ?? (data as Product).basePrice)
    : ((data as Photographer).defaultPackage?.price ??
      (data as Photographer).packages?.[0]?.price ??
      0);
  const href = isProduct ? `/product/${data._id}` : `/photographer/${data._id}`;

  return (
    <Pressable onPress={() => router.push(href as Href)} style={s.card}>
      <View>
        <Image source={getMediaUrl(image)} style={s.image} contentFit="cover" />
        <View style={s.badge}>
          <Text style={s.badgeText}>{isProduct ? 'CỔ PHỤC' : 'NHIẾP ẢNH'}</Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={s.heart}>
          <Ionicons name="heart" size={19} color={Colors.primary} />
        </Pressable>
      </View>
      <View style={s.cardBody}>
        <Text style={s.place}>{isProduct ? 'TÀGO ATELIER' : 'STUDIO CHÍNH HÃNG'}</Text>
        <Text numberOfLines={2} style={s.name}>
          {name}
        </Text>
        <Text style={s.meta}>
          {isProduct
            ? `Size ${(data as Product).sizes?.join('/') || 'Đủ size'}`
            : `★ ${(data as Photographer).rating?.averageRating?.toFixed(1) ?? '5.0'} · ${(data as Photographer).address?.city ?? 'Huế'}`}
        </Text>
        <View style={s.priceRow}>
          <Text style={s.price}>{money(price)}</Text>
          <Text style={s.link}>Đặt ngay ›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const money = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
const savedName = (item: Saved) =>
  item.kind === 'PRODUCT' ? item.data.name : (item.data.businessName ?? '');

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
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#EFECEB',
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
  total: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.primary },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  search: {
    height: 46,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 8,
    ...Shadow,
  },
  input: { flex: 1, fontFamily: FontFamily.body, fontSize: 12.5, color: '#1B1C1C' },
  filters: { flexDirection: 'row', gap: 8 },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: '48%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  image: { width: '100%', height: 180, backgroundColor: '#FFF0F3' },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(27,28,28,0.75)',
  },
  badgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  heart: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 12 },
  place: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: '#8F8E8E',
  },
  name: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    lineHeight: 20,
    color: '#1B1C1C',
    marginTop: 4,
    minHeight: 40,
  },
  meta: { fontFamily: FontFamily.body, fontSize: 10.5, color: '#5F5E5E', marginTop: 4 },
  priceRow: {
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    marginTop: 10,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.primary },
  link: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  footer: { fontFamily: FontFamily.body, fontSize: 11, color: '#8F8E8E', textAlign: 'center' },
});
