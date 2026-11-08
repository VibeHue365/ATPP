import React from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import type { ComboDeal } from '@/types/combo';
import { comboOriginalPrice, comboPublishedPrice } from '@/types/combo';
import { getMediaUrl } from '@/utils/media';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

export function ComboCard({ combo }: { combo: ComboDeal }) {
  const image =
    combo.image ??
    combo.images?.[0] ??
    combo.photographyPackageId?.images?.[0] ??
    combo.productId?.images?.[0];

  const origPrice = comboOriginalPrice(combo);
  const pubPrice = comboPublishedPrice(combo);
  const savings = Math.max(0, origPrice - pubPrice);
  const remaining = Math.max(0, (combo.maxUsage ?? 20) - (combo.usedCount ?? 0));
  const peopleCount = combo.shootPeopleCount ?? combo.photographyPackageId?.maxPeople ?? 1;
  const durationHours = combo.durationHours ?? combo.photographyPackageId?.durationHours ?? 2;
  const editedCount = combo.photographyPackageId?.editedPhotosCount ?? 15;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={() => router.push(`/combos/${combo._id}` as Href)}
    >
      {/* Top Banner Image with Visual Badges */}
      <View style={s.imageWrap}>
        <Image
          source={getMediaUrl(image)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
        />
        <View style={s.overlay} />

        {/* Top Badges: Savings + Remaining */}
        <View style={s.topRow}>
          <View style={s.savingsBadge}>
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={s.savingsText}>TIẾT KIỆM {combo.discountPercent}%</Text>
          </View>

          <View style={s.remainingPill}>
            <View style={s.hotDot} />
            <Text style={s.remainingText}>Còn {remaining} suất</Text>
          </View>
        </View>

        {/* Bottom Studio Identity */}
        <View style={s.studioBar}>
          <View style={s.studioLeft}>
            <Ionicons name="storefront" size={12} color="#FFFFFF" />
            <Text style={s.studioText} numberOfLines={1}>
              {combo.providerId?.businessName ?? 'TàGo Partner Studio'}
            </Text>
          </View>

          <View style={s.cityTag}>
            <Ionicons name="location-sharp" size={10} color="#BA0049" />
            <Text style={s.cityTagText}>
              {(combo.providerId?.address?.city ?? 'TOÀN QUỐC').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Card Body */}
      <View style={s.body}>
        {/* Destination & People badge */}
        <View style={s.guestRow}>
          <View style={s.guestBadge}>
            <Ionicons name="people" size={11} color="#BA0049" />
            <Text style={s.guestText}>GÓI DÀNH CHO {peopleCount} KHÁCH</Text>
          </View>

          <Text style={s.formulaTag}>👘 Áo Dài + 📸 Thợ Ảnh</Text>
        </View>

        {/* Combo Title */}
        <Text style={s.title} numberOfLines={2}>
          {combo.name}
        </Text>

        {/* What's In The Box Breakdown */}
        <View style={s.bundleBox}>
          <Text style={s.bundleBoxHeader}>GÓI BAO GỒM TRỌN GÓI:</Text>

          <View style={s.bundleItem}>
            <View style={s.bundleIconWrap}>
              <Ionicons name="shirt-outline" size={13} color="#BA0049" />
            </View>
            <Text style={s.bundleText} numberOfLines={1}>
              <Text style={s.bundleBold}>{combo.aoDaiQuantity ?? 1} bộ:</Text>{' '}
              {combo.productId?.name ?? 'Cổ phục tuyển chọn cao cấp'}
            </Text>
          </View>

          <View style={s.bundleItem}>
            <View style={s.bundleIconWrap}>
              <Ionicons name="camera-outline" size={13} color="#BA0049" />
            </View>
            <Text style={s.bundleText} numberOfLines={1}>
              <Text style={s.bundleBold}>Chụp {durationHours}h:</Text>{' '}
              {combo.photographyPackageId?.name ?? 'Ngoại cảnh di sản'} ({editedCount} ảnh sửa)
            </Text>
          </View>

          <View style={s.bundleItem}>
            <View style={s.bundleIconWrap}>
              <Ionicons name="gift-outline" size={13} color="#D97706" />
            </View>
            <Text style={s.bundleText} numberOfLines={1}>
              <Text style={s.bundleBold}>Tặng kèm:</Text> Toàn bộ ảnh gốc + Hỗ trợ phụ kiện nón lá, dù
            </Text>
          </View>
        </View>

        {/* Pricing Comparison & CTA */}
        <View style={s.priceRow}>
          <View>
            <View style={s.origPriceRow}>
              <Text style={s.oldPriceLabel}>Giá gốc:</Text>
              <Text style={s.old}>{money(origPrice)}</Text>
            </View>

            <View style={s.comboPriceRow}>
              <Text style={s.price}>{money(pubPrice)}</Text>
              {savings > 0 && (
                <View style={s.savedTag}>
                  <Text style={s.savedTagText}>Giảm {money(savings)}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.ctaBtn}>
            <Text style={s.ctaBtnText}>Đặt Combo</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECE4E8',
    ...Shadow,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  imageWrap: {
    height: 195,
    backgroundColor: '#FFF0F5',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(27, 20, 22, 0.28)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    ...Shadow,
  },
  savingsText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  remainingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27, 20, 22, 0.78)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: Radius.pill,
  },
  hotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  remainingText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  studioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  studioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(27, 20, 22, 0.78)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: Radius.pill,
    maxWidth: 200,
  },
  studioText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  cityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  cityTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#BA0049',
    letterSpacing: 0.3,
  },
  body: {
    padding: 15,
    gap: 8,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: Radius.pill,
  },
  guestText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#BA0049',
    letterSpacing: 0.4,
  },
  formulaTag: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#6E5A62',
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16.5,
    lineHeight: 23,
    color: '#1E1418',
  },
  bundleBox: {
    backgroundColor: '#FCFAF9',
    borderWidth: 1,
    borderColor: '#ECE4E8',
    borderRadius: Radius.md,
    padding: 10,
    gap: 6,
    marginTop: 2,
  },
  bundleBoxHeader: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#8C7A82',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  bundleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  bundleIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#4B3F44',
  },
  bundleBold: {
    fontFamily: FontFamily.bodySemiBold,
    color: '#1E1418',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3ECEF',
    marginTop: 4,
  },
  origPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  oldPriceLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8C7A82',
  },
  old: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#8C7A82',
    textDecorationLine: 'line-through',
  },
  comboPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  price: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    color: '#BA0049',
  },
  savedTag: {
    backgroundColor: '#ECFDF5',
    borderWidth: 0.8,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savedTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#059669',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#BA0049',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  ctaBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
});
