import React, { useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { checkoutApi } from '@/apis/checkoutApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { ListPagination } from '@/components/ui/ListPagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBookings } from '@/hooks/useBookings';
import type { Booking } from '@/types/booking';
import {
  attentionStatuses,
  bookingDate,
  bookingStatus,
  bookingTitle,
  formatDate,
  itemImage,
  terminalStatuses,
} from '@/utils/booking';
import { getMediaUrl } from '@/utils/media';

type Filter = 'ALL' | 'PHOTO' | 'RENTAL' | 'ATTENTION';

const formatVND = (value = 0) => `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;

const getInitials = (value = '') =>
  value
    .split(' ')
    .filter(Boolean)
    .map((item) => item[0])
    .slice(-2)
    .join('')
    .toUpperCase() || 'TG';

export default function Screen() {
  return (
    <RequireAuth>
      <BookingsScreen />
    </RequireAuth>
  );
}

function BookingsScreen() {
  const { user } = useAuth();
  const { show } = useToast();
  const { items, loading, refreshing, error, reload } = useBookings();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [oldest, setOldest] = useState(false);

  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          const match =
            !query.trim() ||
            `${item.bookingCode} ${bookingTitle(item)}`
              .toLowerCase()
              .includes(query.trim().toLowerCase());
          if (!match) return false;
          if (filter === 'PHOTO') return item.bookingType === 'PHOTOGRAPHY';
          if (filter === 'RENTAL') return item.bookingType === 'AODAI_RENTAL';
          if (filter === 'ATTENTION') return attentionStatuses.has(item.status);
          return true;
        })
        .sort(
          (a, b) =>
            (oldest ? 1 : -1) *
            (new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
        ),
    [items, query, filter, oldest]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * 8, safePage * 8);

  const stats = {
    ongoing: items.filter(
      (item) => !terminalStatuses.has(item.status) && item.status !== 'PENDING_PAYMENT'
    ).length,
    upcoming: items.filter((item) =>
      ['DEPOSIT_PAID', 'CONFIRMED', 'PICKUP_PENDING'].includes(item.status)
    ).length,
    attention: items.filter((item) => attentionStatuses.has(item.status)).length,
    done: items.filter((item) => item.status === 'COMPLETED').length,
  };

  const continuePayment = async (booking: Booking) => {
    try {
      const pending = await checkoutApi.pending();
      const payment = pending.find((item) => item.bookingId === booking._id);
      if (!payment) {
        show(
          'Không tìm thấy giao dịch đang chờ. Hãy mở chi tiết đơn để kiểm tra.',
          'error'
        );
        return;
      }
      router.push({
        pathname: '/payment/result',
        params: { code: payment.paymentCode },
      } as unknown as Href);
    } catch {
      show('Không thể tải giao dịch đang chờ', 'error');
    }
  };

  if (loading) return <LoadingState label="Đang tải đơn hàng và lịch hẹn..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Sticky Header */}
      <View style={styles.topHeader}>
        <View style={styles.identityRow}>
          <View style={styles.avatarCircle}>
            {getMediaUrl(user?.avatarUrl) ? (
              <Image
                source={getMediaUrl(user?.avatarUrl)}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>
            )}
          </View>
          <View>
            <Text style={styles.eyebrow}>TÀGO DI SẢN · LỊCH TRÌNH</Text>
            <Text style={styles.headerTitle}>Đơn Hàng & Lịch Hẹn</Text>
          </View>
        </View>

        <Pressable
          style={styles.createBookingBtn}
          onPress={() => router.push('/(tabs)/rentals' as Href)}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.createBookingText}>Đặt mới</Text>
        </Pressable>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={reload}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 4 KPI Summary Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="pulse-outline"
            label="Đang diễn ra"
            value={stats.ongoing}
            tone="primary"
          />
          <StatCard
            icon="calendar-outline"
            label="Lịch sắp tới"
            value={stats.upcoming}
            tone="neutral"
          />
          <StatCard
            icon="alert-circle-outline"
            label="Cần xử lý"
            value={stats.attention}
            tone={stats.attention > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            icon="checkmark-done-circle-outline"
            label="Hoàn tất"
            value={stats.done}
            tone="success"
          />
        </View>

        {/* Search & Sort Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.primary} />
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Tìm theo mã đơn (#VH...) hoặc tên dịch vụ..."
              placeholderTextColor="#8F8E8E"
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setPage(1);
                }}
              >
                <Ionicons name="close-circle" size={18} color="#8F8E8E" />
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.sortToggleBtn}
            onPress={() => {
              setOldest((v) => !v);
              setPage(1);
            }}
          >
            <Ionicons name="swap-vertical" size={16} color={Colors.primary} />
            <Text style={styles.sortToggleText}>{oldest ? 'Cũ nhất' : 'Mới nhất'}</Text>
          </Pressable>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {(
            [
              ['ALL', `Tất cả (${items.length})`],
              ['RENTAL', 'Thuê cổ phục'],
              ['PHOTO', 'Ca chụp ảnh'],
              ['ATTENTION', `Cần xử lý (${stats.attention})`],
            ] as Array<[Filter, string]>
          ).map(([value, label]) => {
            const active = filter === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setFilter(value);
                  setPage(1);
                }}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Booking Cards List */}
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Chưa có đơn hàng phù hợp"
            message="Các đơn thuê áo dài và lịch chụp ảnh của bạn sẽ hiển thị tại đây."
          />
        ) : (
          <View style={styles.list}>
            {visible.map((item) => (
              <BookingCard
                key={item._id}
                item={item}
                onPay={() => void continuePayment(item)}
              />
            ))}
          </View>
        )}

        <ListPagination page={safePage} totalPages={totalPages} onChange={setPage} />

        {filtered.length > 0 && (
          <Text style={styles.footerText}>
            Hiển thị {visible.length} / {filtered.length} đơn hàng
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BookingCard({ item, onPay }: { item: Booking; onPay: () => void }) {
  const status = bookingStatus[item.status] ?? {
    label: item.status,
    tone: 'neutral' as const,
  };
  const first = item.items[0];
  const isPhoto = item.bookingType === 'PHOTOGRAPHY';
  const isCombo = item.bookingType === 'COMBO';
  const imgUri = getMediaUrl(first && itemImage(first));

  return (
    <Pressable
      onPress={() => router.push(`/booking/${item._id}` as Href)}
      style={({ pressed }) => [
        styles.card,
        item.status === 'PENDING_PAYMENT' && styles.cardAttention,
        pressed && { opacity: 0.94 },
      ]}
    >
      {/* Top Row: Type Badge + Status Badge */}
      <View style={styles.cardTop}>
        <View style={styles.typePill}>
          {isCombo ? (
            <MaterialIcons name="auto-awesome" size={13} color={Colors.primary} />
          ) : isPhoto ? (
            <Ionicons name="camera" size={13} color={Colors.primary} />
          ) : (
            <MaterialCommunityIcons name="hanger" size={14} color={Colors.primary} />
          )}
          <Text style={styles.typeText}>
            {isCombo ? 'COMBO TRỌN GÓI' : isPhoto ? 'CA CHỤP ẢNH' : 'THUÊ CỔ PHỤC'}
          </Text>
        </View>
        <StatusBadge label={status.label} tone={status.tone} />
      </View>

      {/* Body Row */}
      <View style={styles.cardBody}>
        {imgUri ? (
          <Image source={imgUri} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <MaterialCommunityIcons name="hanger" size={26} color={Colors.primary} />
          </View>
        )}

        <View style={styles.cardInfoCol}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {bookingTitle(item)}
          </Text>

          <View style={styles.codeRow}>
            <Text style={styles.codeBadge}>#{item.bookingCode}</Text>
            <Text style={styles.dotSep}>·</Text>
            <Text style={styles.itemCountText}>{item.items.length} dịch vụ</Text>
          </View>

          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color="#5F5E5E" />
            <Text style={styles.dateText}>
              {formatDate(bookingDate(item))}
              {first?.shootTimeSlot ? ` · ${first.shootTimeSlot}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer Row */}
      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.totalLabel}>Tổng thanh toán</Text>
          <Text style={styles.totalValue}>
            {formatVND(item.pricingSummary?.grandTotal)}
          </Text>
        </View>

        {item.status === 'PENDING_PAYMENT' ? (
          <Pressable
            style={styles.payNowBtn}
            onPress={(event) => {
              event.stopPropagation();
              onPay();
            }}
          >
            <Text style={styles.payNowText}>Thanh toán ngay</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(`/booking/${item._id}` as Href)}
            style={styles.detailBtn}
          >
            <MaterialIcons name="qr-code-2" size={15} color={Colors.primary} />
            <Text style={styles.detailBtnText}>Chi tiết & Mã đơn</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tone: 'primary' | 'warning' | 'success' | 'neutral';
}) {
  const isWarning = tone === 'warning' && value > 0;
  const isPrimary = tone === 'primary' && value > 0;
  const isSuccess = tone === 'success' && value > 0;

  return (
    <View
      style={[
        styles.statCard,
        isWarning && styles.statCardWarning,
        isPrimary && styles.statCardPrimary,
      ]}
    >
      <View style={styles.statTopRow}>
        <Text
          style={[
            styles.statLabel,
            isWarning && { color: '#B45309' },
            isPrimary && { color: Colors.primary },
          ]}
        >
          {label}
        </Text>
        <Ionicons
          name={icon}
          size={16}
          color={
            isWarning
              ? '#D97706'
              : isPrimary
              ? Colors.primary
              : isSuccess
              ? '#059669'
              : '#8F8E8E'
          }
        />
      </View>
      <Text
        style={[
          styles.statValue,
          isWarning && { color: '#B45309' },
          isPrimary && { color: Colors.primary },
          isSuccess && { color: '#059669' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F3',
    borderWidth: 1.5,
    borderColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: Colors.primary,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.7,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: 21,
    color: '#1B1C1C',
  },
  createBookingBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  createBookingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 38,
    gap: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  statCard: {
    width: '48.4%',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
    gap: 6,
    ...Shadow,
  },
  statCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statCardPrimary: {
    backgroundColor: '#FFF0F3',
    borderColor: '#FFD9DE',
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  statValue: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: '#1B1C1C',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
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
  sortToggleBtn: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortToggleText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  filtersScroll: {
    gap: 8,
    paddingRight: 12,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#5F5E5E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 15,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 12,
    ...Shadow,
  },
  cardAttention: {
    backgroundColor: '#FFFDF7',
    borderColor: '#FDE68A',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.4,
  },
  cardBody: {
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    width: 74,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#F5F3F3',
  },
  thumbFallback: {
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  cardTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    color: '#1B1C1C',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBadge: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  dotSep: {
    color: '#8F8E8E',
  },
  itemCountText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11.5,
    color: '#5F5E5E',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: '#5F5E5E',
  },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8F8E8E',
  },
  totalValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    color: Colors.primary,
    marginTop: 1,
  },
  payNowBtn: {
    height: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payNowText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  detailBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: Colors.primary,
  },
  footerText: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#8F8E8E',
    textAlign: 'center',
    marginTop: 4,
  },
});
