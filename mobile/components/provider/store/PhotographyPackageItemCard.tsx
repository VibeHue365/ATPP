import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FontFamily } from '@/constants/theme';
import { getMediaUrl } from '@/utils/media';

interface PhotographyPackageItemCardProps {
  pkg: any;
  onToggleActive: (pkg: any) => void;
  onPressEdit: (pkg: any) => void;
  onPressDelete: (pkg: any) => void;
}

export function PhotographyPackageItemCard({
  pkg,
  onToggleActive,
  onPressEdit,
  onPressDelete,
}: PhotographyPackageItemCardProps) {
  const name = pkg.name || pkg.title || 'Gói Chụp Ảnh Ngoại Cảnh Cố Đô';
  const price = Number(pkg.price ?? pkg.basePrice ?? 1200000);
  const durationLabel = pkg.durationHours
    ? `${pkg.durationHours} giờ`
    : `${pkg.includedDurationMinutes || pkg.durationMinutes || 120} phút`;
  const editedCount = pkg.editedPhotosCount ?? pkg.deliverables?.editedPhotosCount ?? 25;
  const rawCount = pkg.rawPhotosCount ?? 100;
  const deliveryDays = pkg.deliveryDays ?? pkg.deliverables?.deliveryDays ?? 3;
  const maxPeople = pkg.maxPeople ?? 2;
  const isActive = (pkg.status || pkg.Status || 'ACTIVE') === 'ACTIVE';
  const rawImage = pkg.images?.[0] || null;

  return (
    <View style={styles.card}>
      {/* Top Row: Thumbnail + Title + Price */}
      <View style={styles.topRow}>
        {rawImage ? (
          <Image
            source={{ uri: getMediaUrl(rawImage) }}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="camera" size={24} color="#BA0049" />
          </View>
        )}

        <View style={styles.titleCol}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusPill,
                isActive ? styles.statusActiveBg : styles.statusInactiveBg,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? '#059669' : '#94A3B8' },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? '#059669' : '#64748B' },
                ]}
              >
                {isActive ? 'Đang nhận lịch' : 'Tạm ẩn'}
              </Text>
            </View>
            <Text style={styles.maxPeopleBadge}>Tối đa {maxPeople} khách</Text>
          </View>

          <Text style={styles.pkgName} numberOfLines={2}>
            {name}
          </Text>

          <Text style={styles.priceText}>
            {price.toLocaleString('vi-VN')} đ{' '}
            <Text style={styles.priceUnit}>/ ca chụp</Text>
          </Text>
        </View>
      </View>

      {/* Specs Grid (Duration, Edited Photos, Raw Photos, Delivery Days) */}
      <View style={styles.specsGrid}>
        <View style={styles.specChip}>
          <Ionicons name="time-outline" size={14} color="#BA0049" />
          <Text style={styles.specText}>{durationLabel}</Text>
        </View>

        <View style={styles.specChip}>
          <Ionicons name="sparkles-outline" size={14} color="#BA0049" />
          <Text style={styles.specText}>{editedCount} ảnh chỉnh sửa</Text>
        </View>

        <View style={styles.specChip}>
          <Ionicons name="images-outline" size={14} color="#5B3F43" />
          <Text style={styles.specText}>{rawCount} ảnh gốc</Text>
        </View>

        <View style={styles.specChip}>
          <MaterialIcons name="schedule-send" size={14} color="#059669" />
          <Text style={styles.specText}>Trả ảnh sau {deliveryDays} ngày</Text>
        </View>
      </View>

      {/* Footer Actions: Toggle Switch + Edit + Delete */}
      <View style={styles.footerRow}>
        <Pressable
          style={styles.switchWrap}
          onPress={() => onToggleActive(pkg)}
        >
          <Switch
            value={isActive}
            onValueChange={() => onToggleActive(pkg)}
            trackColor={{ false: '#CBD5E1', true: '#BA0049' }}
            thumbColor="#FFFFFF"
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
          <Text style={styles.switchLabel}>
            {isActive ? 'Mở đặt lịch' : 'Đang tắt'}
          </Text>
        </Pressable>

        <View style={styles.actionBtns}>
          <Pressable
            style={styles.editBtn}
            onPress={() => onPressEdit(pkg)}
          >
            <Ionicons name="create-outline" size={15} color="#BA0049" />
            <Text style={styles.editBtnText}>Sửa gói</Text>
          </Pressable>

          <Pressable
            style={styles.deleteBtn}
            onPress={() => onPressDelete(pkg)}
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
    gap: 12,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#F5F3F3',
  },
  thumbFallback: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  statusActiveBg: {
    backgroundColor: '#ECFDF5',
  },
  statusInactiveBg: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
  },
  maxPeopleBadge: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5B3F43',
  },
  pkgName: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  priceText: {
    fontSize: 15,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  priceUnit: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5B3F43',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#FBF9F9',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F0EF',
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  specText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#1B1C1C',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F3F3',
    paddingTop: 10,
  },
  switchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#1B1C1C',
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
