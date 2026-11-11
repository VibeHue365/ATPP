import React from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { Photographer } from '@/types/photographer';
import { getMediaUrl } from '@/utils/media';

const formatVND = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;

export function PhotographyCard({
  photographer,
  distanceKm,
}: {
  photographer: Photographer;
  distanceKm?: number;
}) {
  const pack = photographer.defaultPackage ?? photographer.packages?.[0];
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();
  const { show } = useToast();
  const liked = isFavorite('PROVIDER', photographer._id);

  const go = () =>
    router.push(
      `/photographer/${photographer._id}?packageId=${pack?._id ?? ''}` as unknown as Href
    );

  const favorite = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      router.push('/(auth)/login' as Href);
      return;
    }
    try {
      await toggleFavorite('PROVIDER', photographer._id);
      show(
        liked ? 'Đã bỏ studio khỏi yêu thích' : 'Đã lưu studio vào yêu thích',
        'success'
      );
    } catch {
      show('Không thể cập nhật yêu thích', 'error');
    }
  };

  // Collect and deduplicate portfolio/preview images for magazine layout
  const rawList: string[] = [
    ...(pack?.images ?? []),
    ...(photographer.media?.images ?? []),
    ...(photographer.portfolioItems?.flatMap((p) => p.images ?? []) ?? []),
    ...(photographer.portfolio ?? []),
    photographer.coverImage,
    photographer.media?.coverUrl,
  ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);

  const uniqueImages = Array.from(new Set(rawList));
  const heroImage = uniqueImages[0];
  const sideImage1 = uniqueImages[1];
  const sideImage2 = uniqueImages[2];
  const moreCount = Math.max(0, uniqueImages.length - 3);

  const durationMinutes =
    pack?.includedDurationMinutes ?? Math.round((pack?.durationHours ?? 1) * 60);
  const avgRating = photographer.rating?.averageRating ?? 5.0;
  const totalReviews = photographer.rating?.totalReviews ?? 0;
  const deliveryDays = pack?.deliveryDays ?? 2;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={go}
    >
      {/* Magazine 3-Photo Gallery Banner */}
      <View style={styles.galleryContainer}>
        {uniqueImages.length >= 2 ? (
          <View style={styles.multiPhotoWrap}>
            {/* Main Hero Photo (Left) */}
            <View style={styles.heroPhotoWrap}>
              {heroImage ? (
                <Image
                  source={getMediaUrl(heroImage)}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={180}
                />
              ) : null}
            </View>

            {/* Side Photos Stack (Right) */}
            <View style={styles.sidePhotosWrap}>
              <View style={styles.sidePhotoItem}>
                {sideImage1 ? (
                  <Image
                    source={getMediaUrl(sideImage1)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={180}
                  />
                ) : null}
              </View>

              <View style={styles.sidePhotoItem}>
                {sideImage2 ? (
                  <Image
                    source={getMediaUrl(sideImage2)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={180}
                  />
                ) : null}
                {moreCount > 0 && (
                  <View style={styles.morePhotoOverlay}>
                    <Text style={styles.morePhotoText}>+{moreCount} ảnh</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* Single Hero Photo fallback */
          <View style={styles.singlePhotoWrap}>
            {heroImage ? (
              <Image
                source={getMediaUrl(heroImage)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={180}
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="camera-outline" size={36} color={Colors.primary} />
                <Text style={styles.placeholderTitle}>TÀGO NHIẾP ẢNH</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.overlayGradient} />

        {/* Top Badges Row */}
        <View style={styles.topRow}>
          <View style={styles.categoryBadge}>
            <Ionicons name="camera" size={11} color="#FFFFFF" />
            <Text style={styles.categoryText}>
              {pack?.pricingUnit === 'PER_DAY' ? 'NGOẠI CẢNH DI SẢN' : 'CONCEPT & STUDIO'}
            </Text>
          </View>

          <Pressable style={styles.heartBtn} onPress={favorite} hitSlop={6}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? Colors.primary : '#1B1C1C'}
            />
          </Pressable>
        </View>

        {/* Studio Identity Ribbon */}
        <View style={styles.studioRibbon}>
          <View style={styles.studioLeftGroup}>
            <MaterialIcons name="verified" size={14} color="#34D399" />
            <Text style={styles.studioNameText} numberOfLines={1}>
              {photographer.businessName ?? 'TàGo Nhiếp Ảnh Gia'}
            </Text>
            <View style={styles.speedPill}>
              <Text style={styles.speedText}>⚡ Phản hồi 5p</Text>
            </View>
          </View>

          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#FDE047" />
            <Text style={styles.ratingText}>
              {avgRating.toFixed(1)}
              {totalReviews > 0 ? ` (${totalReviews})` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.info}>
        {/* City and GPS Distance */}
        <View style={styles.metaHeaderRow}>
          <View style={styles.locationGroup}>
            <Ionicons name="location-sharp" size={13} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {photographer.address?.city ?? 'Toàn quốc'}
              {photographer.address?.district ? ` · ${photographer.address.district}` : ''}
            </Text>
          </View>

          {typeof distanceKm === 'number' && Number.isFinite(distanceKm) ? (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={10} color="#BA0049" />
              <Text style={styles.distanceBadgeText}>
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)}m`
                  : `${distanceKm.toFixed(1)}km`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Package Title */}
        <Text numberOfLines={2} style={styles.packageTitle}>
          {pack?.name ?? photographer.quote ?? 'Gói chụp cổ phục nghệ thuật di sản'}
        </Text>

        {/* Modern Lifestyle Service Perk Pills */}
        <View style={styles.perksRow}>
          <View style={styles.perkPill}>
            <Ionicons name="time-outline" size={12} color="#1E1418" />
            <Text style={styles.perkText}>{durationMinutes} phút</Text>
          </View>

          <View style={styles.perkPill}>
            <Ionicons name="images-outline" size={12} color="#1E1418" />
            <Text style={styles.perkText}>{pack?.editedPhotosCount ?? 15} ảnh sửa</Text>
          </View>

          <View style={styles.perkPillHighlight}>
            <Ionicons name="flash-outline" size={12} color="#BA0049" />
            <Text style={styles.perkHighlightText}>Trả ảnh {deliveryDays} ngày</Text>
          </View>

          <View style={styles.perkPill}>
            <Ionicons name="people-outline" size={12} color="#1E1418" />
            <Text style={styles.perkText}>Tối đa {pack?.maxPeople ?? 1} khách</Text>
          </View>

          <View style={styles.perkPillWarm}>
            <Ionicons name="sparkles" size={11} color="#D97706" />
            <Text style={styles.perkWarmText}>Tặng toàn bộ ảnh gốc</Text>
          </View>
        </View>

        {/* Pricing & CTA */}
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.priceLabel}>Trọn gói ca chụp từ</Text>
            <View style={styles.priceValueRow}>
              <Text style={styles.priceValue}>{formatVND(pack?.price ?? 0)}</Text>
              <Text style={styles.priceUnit}> /ca</Text>
            </View>
          </View>

          <View style={styles.ctaBtn}>
            <Text style={styles.ctaBtnText}>Đặt lịch chụp</Text>
            <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE3E7',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  galleryContainer: {
    height: 205,
    backgroundColor: '#FFF0F5',
    position: 'relative',
    overflow: 'hidden',
  },
  multiPhotoWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  heroPhotoWrap: {
    flex: 1.85,
    backgroundColor: '#FFE5EC',
    position: 'relative',
  },
  sidePhotosWrap: {
    flex: 1,
    gap: 3,
  },
  sidePhotoItem: {
    flex: 1,
    backgroundColor: '#FCE7ED',
    position: 'relative',
    overflow: 'hidden',
  },
  morePhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(27, 20, 22, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePhotoText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  singlePhotoWrap: {
    flex: 1,
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0F5',
  },
  placeholderTitle: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  overlayGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  topRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(186, 0, 73, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  categoryText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioRibbon: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 10,
  },
  studioLeftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27, 20, 22, 0.78)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  studioNameText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
    maxWidth: 130,
  },
  speedPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  speedText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    color: '#FDE047',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(27, 20, 22, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  ratingText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  info: {
    padding: 14,
    gap: 9,
  },
  metaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#6E5A62',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 0.8,
    borderColor: '#F3C4D5',
  },
  distanceBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#BA0049',
  },
  packageTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15.5,
    lineHeight: 22,
    color: '#1E1418',
  },
  perksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 2,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F3F4',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: Radius.pill,
  },
  perkText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#4B3F44',
  },
  perkPillHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F5',
    borderWidth: 0.8,
    borderColor: '#F3C4D5',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: Radius.pill,
  },
  perkHighlightText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#BA0049',
  },
  perkPillWarm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 0.8,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: Radius.pill,
  },
  perkWarmText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#B45309',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3ECEF',
    marginTop: 2,
  },
  priceLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8C7A82',
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 17,
    color: '#BA0049',
  },
  priceUnit: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8C7A82',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  ctaBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
