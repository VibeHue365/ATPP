import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
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
import { promotionApi, type PublicPromotion } from '@/apis/promotionApi';
import { ProductCard } from '@/components/product/ProductCard';
import { TagoMapView } from '@/components/map/TagoMapView';
import { TagoDirectionsModal } from '@/components/map/TagoDirectionsModal';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useProviderStore } from '@/hooks/useProviderStore';
import type { Product } from '@/types/product';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatCampaignRange, isSurchargeCampaign } from '@/utils/campaignPricing';
import {
  detectCityFromText,
  estimateDriveMinutes,
  formatDistance,
  haversineKm,
  openExternalDirections,
  resolveEntityCoords,
} from '@/utils/geo';
import { getMediaUrl } from '@/utils/media';

type SortMode = 'featured' | 'price_asc' | 'price_desc' | 'rating_desc';
const PAGE_SIZE = 8;
const sorts: Array<{ value: SortMode; label: string }> = [
  { value: 'featured', label: 'Nổi bật' },
  { value: 'price_asc', label: 'Giá thấp → cao' },
  { value: 'price_desc', label: 'Giá cao → thấp' },
  { value: 'rating_desc', label: 'Đánh giá cao' },
];
const addressOf = (
  value?: {
    addressLine?: string;
    ward?: string;
    district?: string;
    city?: string;
  } | null,
) => [value?.addressLine, value?.ward, value?.district, value?.city].filter(Boolean).join(', ');
const money = (n = 0) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

export default function ProviderStoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, products, loading, error, reload } = useProviderStore(id);
  const { isAuthenticated } = useAuth();
  const { count } = useCart();
  const { show } = useToast();

  const [tab, setTab] = useState<'products' | 'info'>('products');
  const [query, setQuery] = useState('');
  const [size, setSize] = useState('Tất cả');
  const [color, setColor] = useState('Tất cả');
  const [sort, setSort] = useState<SortMode>('featured');
  const [page, setPage] = useState(1);
  const [startingChat, setStartingChat] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [vouchers, setVouchers] = useState<PublicPromotion[]>([]);
  const [showDirectionsModal, setShowDirectionsModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    promotionApi
      .listByProvider(id)
      .then((res) => {
        if (active && Array.isArray(res)) setVouchers(res);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [id]);

  const sizes = useMemo(
    () => [
      'Tất cả',
      ...new Set(
        products
          .flatMap((item) => item.sizes ?? [])
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ],
    [products]
  );
  const colors = useMemo(
    () => [
      'Tất cả',
      ...new Set(
        products
          .flatMap((item) => item.colors ?? [])
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ],
    [products]
  );

  const filtered = useMemo(() => {
    const key = query.trim().toLocaleLowerCase('vi');
    const values = products.filter(
      (item) =>
        (!key || `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('vi').includes(key)) &&
        (size === 'Tất cả' || item.sizes?.some((value) => value.trim() === size)) &&
        (color === 'Tất cả' || item.colors?.some((value) => value.trim() === color))
    );
    return [...values].sort((a, b) =>
      sort === 'price_asc'
        ? price(a) - price(b)
        : sort === 'price_desc'
          ? price(b) - price(a)
          : sort === 'rating_desc'
            ? (b.rating?.averageRating ?? 0) - (a.rating?.averageRating ?? 0)
            : 0
    );
  }, [products, query, size, color, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [query, size, color, sort]);
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

  if (loading && !refreshing) return <LoadingState label="Đang tải không gian tiệm cổ phục..." />;
  if (error || !store)
    return <ErrorState message={error ?? 'Không tìm thấy gian hàng'} onRetry={reload} />;

  const address = addressOf(store.address);
  const pickup = addressOf(store.rentalSettings?.pickupLocation);
  const rating = store.rating?.averageRating;
  const reviewCount = store.rating?.reviewCount ?? store.rating?.totalReviews;
  const storeCoords = resolveEntityCoords(store);
  const cityRef = detectCityFromText(address || store.address?.city);
  const userCoords = { lat: cityRef.lat, lng: cityRef.lng };
  const distanceKm = haversineKm(userCoords, storeCoords);
  const driveMins = estimateDriveMinutes(distanceKm);

  const openChat = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as Href);
      return;
    }
    if (!store.userId) {
      show('Cửa hàng chưa công khai định danh tài khoản để bắt đầu trò chuyện', 'error');
      return;
    }
    setStartingChat(true);
    try {
      const room = await chatApi.createRoom(String(store.userId));
      router.push({
        pathname: '/chat/[id]',
        params: { id: room.id, name: store.businessName },
      } as unknown as Href);
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể bắt đầu trò chuyện'), 'error');
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable style={s.round} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.brand}>TàGo Atelier</Text>
          <Text style={s.headerSub}>GIAN HÀNG CHÍNH HÃNG</Text>
        </View>
        <Pressable style={s.round} onPress={() => router.push('/cart' as Href)}>
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
        <View style={s.cover}>
          {store.media?.coverUrl ? (
            <Image source={getMediaUrl(store.media.coverUrl)} style={s.coverImage} contentFit="cover" />
          ) : (
            <View style={s.coverFallback}>
              <Ionicons name="storefront-outline" size={46} color="#FFD9E2" />
            </View>
          )}
        </View>

        <View style={s.profile}>
          <View style={s.logo}>
            {store.media?.logoUrl ? (
              <Image source={getMediaUrl(store.media.logoUrl)} style={s.logoImage} contentFit="cover" />
            ) : (
              <Ionicons name="storefront" size={30} color={Colors.primary} />
            )}
          </View>
          <View style={s.profileText}>
            <View style={s.nameRow}>
              <Text style={s.name}>{store.businessName}</Text>
              <Ionicons name="checkmark-circle" size={17} color={Colors.success} />
            </View>
            {address ? (
              <Text style={s.address}>
                <Ionicons name="location" size={11} color={Colors.primary} /> {address}
              </Text>
            ) : null}
            <View style={s.meta}>
              {rating !== undefined ? (
                <Text style={s.rating}>
                  ★ {rating.toFixed(1)}
                  {reviewCount !== undefined ? ` (${reviewCount} đánh giá)` : ''}
                </Text>
              ) : null}
              <Text style={s.productCount}>{products.length} mẫu cổ phục</Text>
              <Pressable
                style={s.distancePill}
                onPress={() => setTab('info')}>
                <Ionicons name="navigate" size={10} color={Colors.primary} />
                <Text style={s.distancePillText}>
                  Cách {formatDistance(distanceKm)} · ~{driveMins}p
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {store.activeCampaign ? (
          <View style={s.campaign}>
            <View style={s.campaignIcon}>
              <Ionicons name="pricetag" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.campaignLabel}>{store.activeCampaign.occasion}</Text>
              <Text style={s.campaignTitle}>
                {isSurchargeCampaign(store.activeCampaign) ? 'Phụ thu' : 'Ưu đãi giảm'}{' '}
                {store.activeCampaign.discountPercent}% toàn bộ gian hàng ·{' '}
                {formatCampaignRange(store.activeCampaign)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Store Vouchers Strip */}
        {vouchers.length > 0 && (
          <View style={s.voucherSection}>
            <Text style={s.voucherSectionTitle}>MÃ ƯU ĐÃI TỪ TIỆM</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
              {vouchers.map((v) => (
                <Pressable
                  key={v._id}
                  style={s.voucherCard}
                  onPress={() =>
                    show(
                      `Đã ghi nhớ mã ${v.code}! Bạn có thể chọn mã này ở bước Thanh toán.`,
                      'success'
                    )
                  }>
                  <View style={s.voucherBadge}>
                    <Ionicons name="ticket-outline" size={14} color={Colors.primary} />
                    <Text style={s.voucherCode}>{v.code}</Text>
                  </View>
                  <Text style={s.voucherDesc} numberOfLines={1}>
                    {v.discountType === 'PERCENTAGE'
                      ? `Giảm ${v.discountValue}%`
                      : `Giảm ${money(v.discountValue)}`}
                    {v.minOrderValue ? ` · Đơn từ ${money(v.minOrderValue)}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <AppButton
              title={startingChat ? 'Đang kết nối...' : 'Nhắn tin với Tiệm'}
              loading={startingChat}
              disabled={!store.userId}
              onPress={() => void openChat()}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton
              title="Chỉ đường tới Tiệm"
              variant="secondary"
              onPress={() => setShowDirectionsModal(true)}
            />
          </View>
        </View>

        <View style={s.tabs}>
          <Pressable
            onPress={() => setTab('products')}
            style={[s.tab, tab === 'products' && s.tabActive]}>
            <Text style={[s.tabText, tab === 'products' && s.tabTextActive]}>
              Bộ sưu tập ({products.length})
            </Text>
          </Pressable>
          <Pressable onPress={() => setTab('info')} style={[s.tab, tab === 'info' && s.tabActive]}>
            <Text style={[s.tabText, tab === 'info' && s.tabTextActive]}>
              Thông tin & Chính sách
            </Text>
          </Pressable>
        </View>

        {tab === 'products' ? (
          <>
            <View style={s.filterCard}>
              <View style={s.search}>
                <Ionicons name="search-outline" size={18} color="#8F8E8E" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Tìm kiếm mẫu cổ phục trong tiệm..."
                  placeholderTextColor="#8F8E8E"
                  style={s.input}
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#8F8E8E" />
                  </Pressable>
                ) : null}
              </View>

              <Text style={s.filterLabel}>KÍCH CỠ</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}>
                {sizes.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    active={size === value}
                    onPress={() => setSize(value)}
                  />
                ))}
              </ScrollView>

              <Text style={s.filterLabel}>MÀU SẮC</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}>
                {colors.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    active={color === value}
                    onPress={() => setColor(value)}
                  />
                ))}
              </ScrollView>

              <Text style={s.filterLabel}>SẮP XẾP</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}>
                {sorts.map((value) => (
                  <Chip
                    key={value.value}
                    value={value.label}
                    active={sort === value.value}
                    onPress={() => setSort(value.value)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={s.resultRow}>
              <Text style={s.result}>{filtered.length} mẫu cổ phục phù hợp</Text>
              {query || size !== 'Tất cả' || color !== 'Tất cả' || sort !== 'featured' ? (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setSize('Tất cả');
                    setColor('Tất cả');
                    setSort('featured');
                  }}>
                  <Text style={s.reset}>Đặt lại</Text>
                </Pressable>
              ) : null}
            </View>

            {visible.length ? (
              <View style={s.grid}>
                {visible.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                <EmptyState
                  title={
                    products.length ? 'Không tìm thấy mẫu phù hợp' : 'Gian hàng đang cập nhật mẫu mới'
                  }
                  message={
                    products.length
                      ? 'Hãy thử thay đổi từ khóa hoặc chọn kích cỡ khác.'
                      : 'Các bộ sưu tập cổ phục của tiệm sẽ sớm được hiển thị tại đây.'
                  }
                />
              </View>
            )}

            {totalPages > 1 ? (
              <View style={s.pagination}>
                <Pressable
                  disabled={page === 1}
                  onPress={() => setPage((value) => value - 1)}
                  style={[s.pageButton, page === 1 && s.disabled]}>
                  <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                </Pressable>
                <Text style={s.pageText}>
                  Trang {page}/{totalPages}
                </Text>
                <Pressable
                  disabled={page === totalPages}
                  onPress={() => setPage((value) => value + 1)}
                  style={[s.pageButton, page === totalPages && s.disabled]}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <StoreInfo
            store={store}
            address={address}
            pickup={pickup}
            onOpenDirections={() => setShowDirectionsModal(true)}
          />
        )}
      </ScrollView>

      <TagoDirectionsModal
        visible={showDirectionsModal}
        onClose={() => setShowDirectionsModal(false)}
        destination={{
          lat: storeCoords.lat,
          lng: storeCoords.lng,
          title: store.businessName,
          address: address || pickup,
        }}
        origin={{
          lat: userCoords.lat,
          lng: userCoords.lng,
          label: cityRef.name,
        }}
      />
    </SafeAreaView>
  );
}

function price(product: Product) {
  return product.basePrice;
}
function Chip({
  value,
  active,
  onPress,
}: {
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{value}</Text>
    </Pressable>
  );
}
function StoreInfo({
  store,
  address,
  pickup,
  onOpenDirections,
}: {
  store: NonNullable<ReturnType<typeof useProviderStore>['store']>;
  address: string;
  pickup: string;
  onOpenDirections?: () => void;
}) {
  const storeCoords = resolveEntityCoords(store);
  const cityRef = detectCityFromText(address || store.address?.city);
  const userCoords = { lat: cityRef.lat, lng: cityRef.lng };
  const distanceKm = haversineKm(userCoords, storeCoords);
  const driveMins = estimateDriveMinutes(distanceKm);

  return (
    <View style={s.infoList}>
      <Info title="Bản đồ & Chỉ đường tới Tiệm" icon="map-outline">
        {address ? (
          <Text style={s.infoLine}>{address}</Text>
        ) : (
          <Text style={s.emptyInfo}>Chưa cập nhật địa chỉ gian hàng.</Text>
        )}
        {pickup && pickup !== address ? (
          <Text style={s.infoLine}>Điểm nhận/trả: {pickup}</Text>
        ) : null}
        <View style={s.storeMapWrap}>
          <TagoMapView
            center={storeCoords}
            zoom={15}
            height={210}
            userLocation={{
              ...userCoords,
              label: `Trung tâm ${cityRef.name}`,
            }}
            markers={[
              {
                id: store._id,
                lat: storeCoords.lat,
                lng: storeCoords.lng,
                title: store.businessName,
                subtitle: `${formatDistance(distanceKm)} · ~${driveMins}p`,
                badge: 'Tiệm Áo Dài',
                color: '#910C3F',
                isSelected: true,
              },
            ]}
            routeLine={{
              from: userCoords,
              to: storeCoords,
              color: '#910C3F',
            }}
          />
        </View>
        <View style={s.storeMapFooter}>
          <View style={{ flex: 1 }}>
            <Text style={s.storeMapDistance}>
              Cách trung tâm {cityRef.name} khoảng {formatDistance(distanceKm)} (~{driveMins} phút đi xe)
            </Text>
          </View>
          <Pressable
            style={s.storeDirectionBtn}
            onPress={() => {
              if (onOpenDirections) {
                onOpenDirections();
              } else {
                void openExternalDirections({
                  lat: storeCoords.lat,
                  lng: storeCoords.lng,
                  label: store.businessName,
                  originLat: userCoords.lat,
                  originLng: userCoords.lng,
                });
              }
            }}>
            <Ionicons name="navigate" size={14} color="#FFFFFF" />
            <Text style={s.storeDirectionBtnText}>Lộ trình tới Tiệm</Text>
          </Pressable>
        </View>
      </Info>
      <Info title="Thông tin liên hệ" icon="call-outline">
        {store.contact?.phone ? (
          <Pressable onPress={() => void Linking.openURL(`tel:${store.contact?.phone}`)}>
            <Text style={[s.infoLine, { color: Colors.primary, fontFamily: FontFamily.bodyBold }]}>
              Điện thoại: {store.contact.phone} (Chạm để gọi)
            </Text>
          </Pressable>
        ) : null}
        {store.contact?.email ? <Text style={s.infoLine}>Email: {store.contact.email}</Text> : null}
        {store.contact?.website ? (
          <Text style={s.infoLine}>Website: {store.contact.website}</Text>
        ) : null}
        {!store.contact?.phone && !store.contact?.email && !store.contact?.website ? (
          <Text style={s.emptyInfo}>Cửa hàng chưa cập nhật thông tin liên hệ.</Text>
        ) : null}
      </Info>
      <Info title="Chính sách thuê trang phục" icon="shirt-outline">
        <Text style={store.policies?.rentalPolicy ? s.infoLine : s.emptyInfo}>
          {store.policies?.rentalPolicy ??
            'Giữ đồ theo lịch đã đặt, hỗ trợ thử size tại tiệm và hoàn trả 100% tiền cọc ngay sau khi đối soát.'}
        </Text>
      </Info>
      <Info title="Chính sách đổi & hủy lịch" icon="refresh-outline">
        <Text style={store.policies?.cancellationPolicy ? s.infoLine : s.emptyInfo}>
          {store.policies?.cancellationPolicy ??
            'Hỗ trợ đổi lịch hoặc hủy miễn phí khi thông báo trước 24 giờ so với giờ hẹn nhận đồ.'}
        </Text>
      </Info>
    </View>
  );
}
function Info({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={s.infoCard}>
      <View style={s.infoTitle}>
        <Ionicons name={icon} size={19} color={Colors.primary} />
        <Text style={s.infoHeading}>{title}</Text>
      </View>
      {children}
    </View>
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
  badgeText: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: '#FFFFFF' },
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8F8E8E',
    textAlign: 'center',
  },
  content: { paddingBottom: 38 },
  cover: { height: 170, backgroundColor: Colors.primaryDark },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  profile: {
    marginHorizontal: 16,
    marginTop: -38,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFECEB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadow,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFF0F3',
    borderWidth: 3,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  profileText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: FontFamily.display, fontSize: 21, color: '#1B1C1C' },
  address: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#5F5E5E',
    marginTop: 4,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  rating: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: '#B45309' },
  productCount: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: '#8F8E8E' },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
  },
  distancePillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
  },
  storeMapWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  storeMapFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFF8F9',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F6E2E8',
  },
  storeMapDistance: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#5F5E5E',
    lineHeight: 16,
  },
  storeDirectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  storeDirectionBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  campaign: {
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  campaignIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: '#FFE0E8',
  },
  campaignTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.white,
    marginTop: 2,
  },
  voucherSection: {
    marginTop: 14,
    gap: 8,
  },
  voucherSectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#8F8E8E',
    paddingHorizontal: 16,
  },
  voucherCard: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  voucherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  voucherCode: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  voucherDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#5F5E5E',
  },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  tabs: {
    flexDirection: 'row',
    marginTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: '#8F8E8E' },
  tabTextActive: { color: Colors.primary },
  filterCard: {
    margin: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 9,
    ...Shadow,
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: '#EFECEB',
    borderRadius: 12,
    backgroundColor: '#FBF9F9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 8,
  },
  input: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: '#1B1C1C' },
  filterLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: '#8F8E8E',
    marginTop: 3,
  },
  chips: { gap: 7, paddingRight: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: '#5F5E5E' },
  chipTextActive: { color: Colors.white },
  resultRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  result: { fontFamily: FontFamily.display, fontSize: 18, color: '#1B1C1C' },
  reset: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.primary },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginTop: 22,
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
  disabled: { opacity: 0.35 },
  pageText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Colors.primary },
  infoList: { padding: 16, gap: 12 },
  infoCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  infoTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  infoHeading: { fontFamily: FontFamily.display, fontSize: 18, color: '#1B1C1C' },
  infoLine: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 19,
    color: '#5F5E5E',
    marginTop: 9,
  },
  emptyInfo: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 19,
    color: '#8F8E8E',
    fontStyle: 'italic',
    marginTop: 9,
  },
});
