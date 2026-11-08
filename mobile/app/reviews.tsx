import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { reviewApi } from '@/apis/reviewApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { ListPagination } from '@/components/ui/ListPagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import { useBookings } from '@/hooks/useBookings';
import type { Booking, BookingItem } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';
import { bookingDate, formatDate, itemImage } from '@/utils/booking';
import { getMediaUrl } from '@/utils/media';

type Reviewable = { booking: Booking; item: BookingItem };
type Tab = 'PENDING' | 'DONE';
type Filter = 'ALL' | 'PHOTO' | 'PRODUCT';

export default function Screen() {
  return (
    <RequireAuth>
      <Reviews />
    </RequireAuth>
  );
}

function Reviews() {
  const { items: bookings, loading, refreshing, error, reload } = useBookings();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Reviewable | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const all = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'COMPLETED')
        .flatMap((booking) => booking.items.map((item) => ({ booking, item }))),
    [bookings]
  );
  const pending = all.filter((v) => !v.item.isReviewed);
  const done = all.filter((v) => v.item.isReviewed);
  const source = tab === 'PENDING' ? pending : done;
  const filtered = source.filter((v) => {
    if (filter === 'PHOTO' && v.item.itemType !== 'PHOTOGRAPHY_PACKAGE') return false;
    if (filter === 'PRODUCT' && v.item.itemType !== 'PRODUCT') return false;
    return !q || reviewTitle(v.item).toLowerCase().includes(q.toLowerCase());
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * 8, safePage * 8);

  const submit = async () => {
    if (!selected || !comment.trim()) {
      show('Vui lòng nhập nội dung nhận xét trải nghiệm', 'error');
      return;
    }
    setSaving(true);
    try {
      const product = entityId(selected.item.productId);
      const pack = entityId(selected.item.photographyPackageId);
      await reviewApi.create({
        bookingId: selected.booking._id,
        bookingItemId: selected.item._id,
        rating,
        comment: comment.trim(),
        productId: product,
        photographyPackageId: pack,
      });
      setSelected(null);
      setComment('');
      setRating(5);
      await reload();
      show('Cảm ơn bạn đã gửi đánh giá dịch vụ!', 'success');
    } catch (e) {
      show(getApiErrorMessage(e, 'Gửi đánh giá thất bại'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Đang tải danh sách đánh giá..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable style={s.round} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#1B1C1C" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TRẢI NGHIỆM KHÁCH HÀNG</Text>
          <Text style={s.title}>Đánh giá dịch vụ của tôi</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={Colors.primary} />
        }
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>
        <View style={s.tabs}>
          <Pressable
            onPress={() => {
              setTab('PENDING');
              setPage(1);
            }}
            style={[s.tab, tab === 'PENDING' && s.tabOn]}>
            <Text style={[s.tabText, tab === 'PENDING' && s.tabTextOn]}>
              Chờ đánh giá ({pending.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTab('DONE');
              setPage(1);
            }}
            style={[s.tab, tab === 'DONE' && s.tabOn]}>
            <Text style={[s.tabText, tab === 'DONE' && s.tabTextOn]}>
              Đã đánh giá ({done.length})
            </Text>
          </Pressable>
        </View>

        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color="#8F8E8E" />
          <TextInput
            value={q}
            onChangeText={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Tìm dịch vụ đã trải nghiệm..."
            placeholderTextColor="#8F8E8E"
            style={s.input}
          />
        </View>

        <View style={s.filters}>
          {(
            [
              ['ALL', 'Tất cả'],
              ['PRODUCT', 'Thuê cổ phục'],
              ['PHOTO', 'Gói chụp ảnh'],
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
          <ErrorState message={error} onRetry={reload} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              tab === 'PENDING'
                ? 'Không có dịch vụ chờ đánh giá'
                : 'Chưa có đánh giá nào được gửi'
            }
            message={
              tab === 'PENDING'
                ? 'Sau khi hoàn tất đơn thuê cổ phục hoặc buổi chụp ảnh, bạn có thể để lại đánh giá tại đây.'
                : 'Các đánh giá bạn đã gửi cho tiệm và nhiếp ảnh gia sẽ hiển thị tại đây.'
            }
          />
        ) : (
          <View style={s.list}>
            {visible.map((value) => (
              <ReviewCard
                key={value.item._id}
                value={value}
                done={tab === 'DONE'}
                onReview={() => setSelected(value)}
              />
            ))}
          </View>
        )}

        <ListPagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </ScrollView>

      <AppModal
        visible={Boolean(selected)}
        title="Đánh giá chất lượng dịch vụ"
        onClose={() => setSelected(null)}>
        <View style={s.modal}>
          <Text style={s.reviewing}>{selected && reviewTitle(selected.item)}</Text>
          <Text style={s.label}>MỨC ĐỘ HÀI LÒNG CỦA BẠN</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={34}
                  color="#F59E0B"
                />
              </Pressable>
            ))}
          </View>
          <AppInput
            label="Cảm nhận thực tế của bạn"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            placeholder="Chất lượng cổ phục, sự nhiệt tình của tiệm hoặc nước ảnh của nhiếp ảnh gia..."
            style={s.comment}
          />
          <AppButton title="Gửi đánh giá ngay" loading={saving} onPress={() => void submit()} />
        </View>
      </AppModal>
    </SafeAreaView>
  );
}

function ReviewCard({
  value,
  done,
  onReview,
}: {
  value: Reviewable;
  done: boolean;
  onReview: () => void;
}) {
  const { booking, item } = value;
  return (
    <View style={s.card}>
      <View style={s.cardBody}>
        <Image source={getMediaUrl(itemImage(item))} style={s.image} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={s.type}>
            {item.itemType === 'PRODUCT' ? 'THUÊ CỔ PHỤC' : 'NHIẾP ẢNH DI SẢN'}
          </Text>
          <Text style={s.name}>{reviewTitle(item)}</Text>
          <Text style={s.meta}>
            Hoàn tất {formatDate(bookingDate(booking))} · #{booking.bookingCode}
          </Text>
        </View>
      </View>
      <View style={s.cardBottom}>
        {done ? (
          <>
            <View style={s.done}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={s.doneText}>Đã gửi đánh giá</Text>
            </View>
            <Pressable onPress={() => router.push(`/booking/${booking._id}` as Href)}>
              <Text style={s.link}>Xem vé đặt lịch ›</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.deadline}>CHỜ BẠN ĐÁNH GIÁ</Text>
            <Pressable onPress={onReview} style={s.button}>
              <Ionicons name="star" size={13} color="#FFFFFF" />
              <Text style={s.buttonText}>Viết đánh giá</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const entityId = (value: BookingItem['productId'] | BookingItem['photographyPackageId']) =>
  typeof value === 'string' ? value : value ? value._id : undefined;

const reviewTitle = (item: BookingItem) =>
  item.itemType === 'PRODUCT'
    ? ((typeof item.productId === 'object' && item.productId
        ? item.productId.name
        : 'Cổ phục TàGo') ?? 'Cổ phục TàGo')
    : ((typeof item.photographyPackageId === 'object' && item.photographyPackageId
        ? item.photographyPackageId.name
        : item.packageSnapshot?.name) ?? 'Gói chụp ảnh');

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
  title: { fontFamily: FontFamily.display, fontSize: 21, color: '#1B1C1C' },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  tabs: {
    padding: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: Colors.primary },
  tabText: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: '#5F5E5E' },
  tabTextOn: { color: Colors.white },
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
  list: { gap: 12 },
  card: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    ...Shadow,
  },
  cardBody: { flexDirection: 'row', gap: 13 },
  image: {
    width: 78,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
  },
  type: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.primary },
  name: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: '#1B1C1C',
    marginTop: 4,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#8F8E8E',
    marginTop: 4,
  },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadline: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.warning },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  buttonText: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.white },
  done: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  doneText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.success },
  link: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.primary },
  modal: { gap: 14, paddingBottom: 15 },
  reviewing: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: '#1B1C1C',
    textAlign: 'center',
  },
  label: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#8F8E8E',
    textAlign: 'center',
  },
  stars: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  comment: { height: 105, textAlignVertical: 'top', paddingTop: 12 },
});
