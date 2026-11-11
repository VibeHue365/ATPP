import React from 'react';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Shadow } from '@/constants/theme';
import type { Product } from '@/types/product';
import { formatCampaignPercent, isSurchargeCampaign } from '@/utils/campaignPricing';
import { getMediaUrl } from '@/utils/media';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const formatVND = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;

/** `badge`: optional pill over the photo, e.g. the visual-search similarity. */
export function ProductCard({
  product,
  badge,
}: {
  product: Product;
  badge?: { label: string; highlight?: boolean };
}) {
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();
  const { show } = useToast();

  const provider = typeof product.providerId === 'object' ? product.providerId : undefined;
  const liked = isFavorite('PRODUCT', product._id);

  const onFavorite = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      router.push('/(auth)/login' as Href);
      return;
    }
    try {
      await toggleFavorite('PRODUCT', product._id);
      show(liked ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', 'success');
    } catch {
      show('Không thể cập nhật yêu thích', 'error');
    }
  };

  // Campaign prices depend on the rental day (VIB-43), so the card shows the base price plus the campaign label.
  const displayPrice = product.basePrice;
  const campaign = product.activeCampaign;
  const primaryBadge =
    product.badges?.[0]?.label ||
    (campaign ? formatCampaignPercent(campaign) : product.style || product.materials?.[0]);

  const sizesText =
    product.sizes && product.sizes.length > 0
      ? `Size ${product.sizes.slice(0, 4).join(', ')}`
      : 'Đủ size';

  const avgRating = product.rating?.averageRating ?? 5.0;
  const totalReviews = product.rating?.totalReviews ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/product/${product._id}` as Href)}
    >
      <View style={styles.imageWrap}>
        {product.images?.[0] ? (
          <Image
            source={getMediaUrl(product.images[0])}
            style={styles.image}
            contentFit="cover"
            transition={180}
          />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons name="hanger" size={32} color={Colors.primary} />
            <Text style={styles.placeholderText}>TÀGO CỔ PHỤC</Text>
          </View>
        )}

        {badge ? (
          <View style={[styles.topBadge, !badge.highlight && styles.topBadgeMuted]}>
            <Text
              style={[styles.topBadgeText, !badge.highlight && styles.topBadgeMutedText]}
              numberOfLines={1}
            >
              {badge.label}
            </Text>
          </View>
        ) : primaryBadge ? (
          <View style={styles.topBadge}>
            <Ionicons name="sparkles" size={10} color="#FFFFFF" />
            <Text style={styles.topBadgeText} numberOfLines={1}>
              {primaryBadge}
            </Text>
          </View>
        ) : null}

        <Pressable style={styles.heartBtn} onPress={onFavorite}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={16}
            color={liked ? Colors.primary : '#1B1C1C'}
          />
        </Pressable>

        <View style={styles.storeOverlayPill}>
          <MaterialIcons name="storefront" size={11} color="#FDE047" />
          <Text style={styles.storeOverlayText} numberOfLines={1}>
            {provider?.businessName ?? 'Tiệm Cổ Phục Huế'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.cityText} numberOfLines={1}>
            {provider?.address?.city ?? 'Cố đô Huế'}
          </Text>
          <View style={styles.ratingBox}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
            {totalReviews > 0 && <Text style={styles.ratingCount}>({totalReviews})</Text>}
          </View>
        </View>

        <Text numberOfLines={2} style={styles.title}>
          {product.name}
        </Text>

        <View style={styles.sizeRow}>
          <View style={styles.sizeChip}>
            <Text style={styles.sizeChipText}>{sizesText}</Text>
          </View>
          {product.depositAmount ? (
            <Text style={styles.depositHint} numberOfLines={1}>
              Cọc {formatVND(product.depositAmount)}
            </Text>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.priceText}>{formatVND(displayPrice)}</Text>
            <Text style={styles.unitText}>/ngày</Text>
          </View>
          {campaign ? (
            <Text style={[styles.campaignText, isSurchargeCampaign(campaign) && styles.surchargeText]}>
              {formatCampaignPercent(campaign)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFECEB',
    ...Shadow,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  imageWrap: {
    height: 196,
    backgroundColor: '#F5F3F3',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  topBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    maxWidth: '72%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(186, 0, 73, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  topBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  topBadgeMuted: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  topBadgeMutedText: {
    color: Colors.text,
  },
  heartBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeOverlayPill: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27, 28, 28, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  storeOverlayText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  body: {
    padding: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  cityText: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#8F8E8E',
    textTransform: 'uppercase',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1B1C1C',
  },
  ratingCount: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: '#8F8E8E',
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 19,
    minHeight: 38,
    color: '#1B1C1C',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sizeChip: {
    backgroundColor: '#F5F3F3',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sizeChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#5F5E5E',
  },
  depositHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: '#059669',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.primary,
  },
  unitText: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8F8E8E',
  },
  campaignText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: Colors.success,
  },
  surchargeText: {
    color: Colors.warning,
  },
});
