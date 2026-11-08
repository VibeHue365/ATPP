import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface SizeStockCell {
  size: string;
  available: number;
  rented: number;
  maintenance: number;
  total: number;
}

export interface EnrichedInventoryProduct {
  _id: string;
  name: string;
  code: string;
  collectionName: string;
  rackLocation: string;
  imageUrl: string;
  colorLabel: string;
  colorHex: string;
  basePrice: number;
  depositAmount: number;
  isActive: boolean;
  sizeMatrix: SizeStockCell[];
  totalChips: number;
  availableChips: number;
  rentedChips: number;
  maintenanceChips: number;
  rfidPrefix: string;
  hasAlert: boolean;
  rawProduct?: any;
}

interface InventoryProductMatrixCardProps {
  product: EnrichedInventoryProduct;
  onPressChipDetails: (product: EnrichedInventoryProduct) => void;
  onToggleRentalActive: (product: EnrichedInventoryProduct) => void;
}

function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('vi-VN')} đ`;
}

export function InventoryProductMatrixCard({
  product,
  onPressChipDetails,
  onToggleRentalActive,
}: InventoryProductMatrixCardProps) {
  return (
    <View style={styles.card}>
      {/* Top Row: Thumbnail + Details */}
      <View style={styles.topRow}>
        {/* Left Thumbnail */}
        <Pressable
          style={styles.imageContainer}
          onPress={() => onPressChipDetails(product)}
        >
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
          <View
            style={[
              styles.colorBadge,
              { backgroundColor: product.colorHex || '#A93232' },
            ]}
          >
            <Text style={styles.colorBadgeText} numberOfLines={1}>
              {product.colorLabel}
            </Text>
          </View>
        </Pressable>

        {/* Right Details Column */}
        <View style={styles.detailsCol}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {product.name}
              </Text>
              <MaterialIcons name="verified" size={16} color="#BA0049" />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.skuCode}>{product.code}</Text>
              <View style={styles.rackWrap}>
                <MaterialIcons name="pin-drop" size={13} color="#BA0049" />
                <Text style={styles.rackText} numberOfLines={1}>
                  {product.rackLocation}
                </Text>
              </View>
            </View>
          </View>

          {/* 3-Column Size Matrix */}
          <View style={styles.sizeMatrixGrid}>
            {product.sizeMatrix.slice(0, 3).map((cell) => {
              const isOut = cell.total === 0 || cell.available === 0;
              const isLow =
                !isOut && (cell.rented > 0 || (cell.available === 1 && cell.total > 1));

              return (
                <Pressable
                  key={cell.size}
                  style={[
                    styles.sizeCell,
                    isOut && styles.sizeCellOut,
                    isLow && styles.sizeCellLow,
                  ]}
                  onPress={() => onPressChipDetails(product)}
                >
                  <Text style={styles.sizeLabel}>Size {cell.size}</Text>
                  <Text
                    style={[
                      styles.sizeStatusText,
                      isOut && styles.sizeStatusOut,
                      isLow && styles.sizeStatusLow,
                    ]}
                    numberOfLines={1}
                  >
                    {isOut
                      ? cell.rented > 0
                        ? `0/${cell.total} (${cell.rented} thuê)`
                        : 'Hết hàng'
                      : isLow
                      ? cell.rented > 0
                        ? `${cell.available}/${cell.total} (${cell.rented} thuê)`
                        : `${cell.available}/${cell.total} (ít)`
                      : `${cell.available}/${cell.total} sẵn`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Price & Deposit Row */}
          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text style={styles.priceText}>{formatVnd(product.basePrice)}</Text>
              <Text style={styles.perDayText}>/ngày</Text>
            </View>
            <Text style={styles.depositText}>
              Cọc: {formatVnd(product.depositAmount)}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Row: RFID Chip Info & Active Rental Toggle */}
      <View style={styles.bottomRow}>
        <View style={styles.rfidLeft}>
          <MaterialIcons name="nfc" size={16} color="#BA0049" />
          <Text style={styles.rfidCountText}>{product.totalChips} chip RFID:</Text>
          <View style={styles.rfidCodeBadge}>
            <Text style={styles.rfidCodeText}>{product.rfidPrefix}...</Text>
          </View>
        </View>

        <View style={styles.rfidRight}>
          <Pressable
            style={({ pressed }) => [
              styles.chipDetailBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => onPressChipDetails(product)}
          >
            <MaterialIcons name="tune" size={13} color="#1B1C1C" />
            <Text style={styles.chipDetailBtnText}>Chi tiết chip</Text>
          </Pressable>

          <Pressable
            style={styles.rentalToggleWrap}
            onPress={() => onToggleRentalActive(product)}
            hitSlop={6}
          >
            <Text style={styles.rentalToggleLabel}>Bật thuê</Text>
            <View
              style={[
                styles.checkbox,
                product.isActive && styles.checkboxChecked,
              ]}
            >
              {product.isActive && (
                <MaterialIcons name="check" size={13} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageContainer: {
    width: 96,
    height: 128,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: 'rgba(228, 189, 194, 0.3)',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  colorBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    maxWidth: 86,
  },
  colorBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  detailsCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  productTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  skuCode: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  rackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  rackText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  sizeMatrixGrid: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  sizeCell: {
    flex: 1,
    height: 44,
    backgroundColor: '#F5F3F3',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  sizeCellLow: {
    backgroundColor: 'rgba(255, 251, 235, 0.85)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  sizeCellOut: {
    backgroundColor: '#EFEDED',
    borderColor: '#E3E2E2',
    opacity: 0.65,
  },
  sizeLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  sizeStatusText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#047857',
    marginTop: 2,
  },
  sizeStatusLow: {
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
  },
  sizeStatusOut: {
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
  },
  perDayText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  depositText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
  },
  rfidLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  rfidCountText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  rfidCodeBadge: {
    backgroundColor: '#EFEDED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rfidCodeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#5B3F43',
  },
  rfidRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipDetailBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 99,
    backgroundColor: '#F5F3F3',
    borderWidth: 1,
    borderColor: '#E9E8E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.75,
  },
  chipDetailBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  rentalToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rentalToggleLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
});
