import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FontFamily } from '@/constants/theme';

interface ComboPromotionItemCardProps {
  combo: any;
  productsMap?: Map<string, any>;
  packagesMap?: Map<string, any>;
  onPressEdit: (combo: any) => void;
  onPressDelete: (combo: any) => void;
}

export function ComboPromotionItemCard({
  combo,
  productsMap,
  packagesMap,
  onPressEdit,
  onPressDelete,
}: ComboPromotionItemCardProps) {
  const name = combo.name || 'Combo Cổ Phục + Chụp Ảnh Cố Đô';
  const discountPercent = Number(combo.discountPercent ?? 20);
  const aoDaiQty = combo.aoDaiQuantity ?? 1;
  const shootPeople = combo.shootPeopleCount ?? 1;
  const maxUsage = combo.maxUsage ?? 20;
  const usedCount = combo.usedCount ?? 0;

  // Resolve linked product & photography package names
  const prodObj =
    typeof combo.productId === 'object' && combo.productId
      ? combo.productId
      : productsMap?.get(String(combo.productId));
  const pkgObj =
    typeof combo.photographyPackageId === 'object' && combo.photographyPackageId
      ? combo.photographyPackageId
      : packagesMap?.get(String(combo.photographyPackageId));

  const productName = prodObj?.name || 'Áo Dài Cổ Phục Tuyển Chọn';
  const packageName =
    pkgObj?.name || pkgObj?.title || 'Gói Chụp Ngoại Cảnh Cố Đô';

  const originalTotal =
    Number(prodObj?.basePrice ?? 500000) * aoDaiQty +
    Number(pkgObj?.price ?? pkgObj?.basePrice ?? 1200000);
  const finalPrice =
    combo.comboPrice && Number(combo.comboPrice) > 0
      ? Number(combo.comboPrice)
      : Math.round(originalTotal * (1 - discountPercent / 100));

  const validToStr = combo.validTo
    ? new Date(combo.validTo).toLocaleDateString('vi-VN')
    : 'Đang áp dụng';

  const isExpired =
    combo.validTo && new Date(combo.validTo).getTime() < Date.now();

  return (
    <View style={styles.card}>
      {/* Header Row: Discount Badge + Status + Actions */}
      <View style={styles.topRow}>
        <View style={styles.discountBadge}>
          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
          <Text style={styles.discountBadgeText}>ƯU ĐÃI -{discountPercent}%</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isExpired ? styles.statusExpired : styles.statusActive,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: isExpired ? '#64748B' : '#059669' },
            ]}
          >
            {isExpired ? 'Hết hạn' : `Hiệu lực đến ${validToStr}`}
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      <View style={styles.titleSection}>
        <Text style={styles.comboTitle} numberOfLines={2}>
          {name}
        </Text>
        {combo.description ? (
          <Text style={styles.comboDesc} numberOfLines={2}>
            {combo.description}
          </Text>
        ) : null}
      </View>

      {/* Paired Bundle Box (Áo dài + Gói chụp) */}
      <View style={styles.bundleBox}>
        <View style={styles.bundleRow}>
          <View style={styles.bundleIconCircle}>
            <MaterialIcons name="checkroom" size={15} color="#BA0049" />
          </View>
          <Text style={styles.bundleText} numberOfLines={1}>
            <Text style={styles.bundleBold}>{aoDaiQty}x Bộ cổ phục: </Text>
            {productName}
          </Text>
        </View>

        <View style={styles.bundleRow}>
          <View style={styles.bundleIconCircle}>
            <Ionicons name="camera" size={14} color="#BA0049" />
          </View>
          <Text style={styles.bundleText} numberOfLines={1}>
            <Text style={styles.bundleBold}>Gói chụp ({shootPeople} khách): </Text>
            {packageName}
          </Text>
        </View>
      </View>

      {/* Footer: Pricing & Usage + Edit/Delete */}
      <View style={styles.footerRow}>
        <View>
          <View style={styles.priceRow}>
            <Text style={styles.finalPriceText}>
              {finalPrice.toLocaleString('vi-VN')} đ
            </Text>
            <Text style={styles.originalPriceText}>
              {originalTotal.toLocaleString('vi-VN')} đ
            </Text>
          </View>
          <Text style={styles.usageText}>
            Đã đặt: {usedCount}/{maxUsage} lượt combo
          </Text>
        </View>

        <View style={styles.actionBtns}>
          <Pressable
            style={styles.editBtn}
            onPress={() => onPressEdit(combo)}
          >
            <Ionicons name="create-outline" size={15} color="#BA0049" />
            <Text style={styles.editBtnText}>Sửa</Text>
          </Pressable>

          <Pressable
            style={styles.deleteBtn}
            onPress={() => onPressDelete(combo)}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 10,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#BA0049',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  discountBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusExpired: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
  },
  titleSection: {
    gap: 2,
  },
  comboTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  comboDesc: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#5B3F43',
  },
  bundleBox: {
    backgroundColor: '#FFF8F9',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    gap: 6,
  },
  bundleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bundleIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#1B1C1C',
  },
  bundleBold: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    paddingTop: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  finalPriceText: {
    fontSize: 16,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  originalPriceText: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  usageText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5B3F43',
    marginTop: 2,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
  },
  editBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
