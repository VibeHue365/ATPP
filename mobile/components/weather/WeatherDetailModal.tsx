import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { FontFamily, Radius, Shadow } from '@/constants/theme';

export interface WeatherDetailModalProps {
  visible: boolean;
  onClose: () => void;
  cityName: string;
  cityCode: string;
  tempC: number;
  conditionLabel: string;
  goldenHourSlot: string;
  heroSpot?: string;
}

export function WeatherDetailModal({
  visible,
  onClose,
  cityName,
  cityCode,
  tempC,
  conditionLabel,
  goldenHourSlot,
  heroSpot = 'Di tích & Thắng cảnh địa phương',
}: WeatherDetailModalProps) {
  const isRain = conditionLabel.toLowerCase().includes('mưa');
  const isHot = tempC >= 30;
  const isCool = tempC < 23;

  const outfitSuggestion = isRain
    ? {
        title: 'Cổ phục gấm & Phụ kiện Dù cổ trang',
        desc: 'Thời tiết có mưa nhẹ lãng mạn. Rất thích hợp diện Áo Tấc gấm dày dặn kết hợp Dù giấy dầu hoặc Nón lá bài thơ để chụp những góc ảnh di sản hoài cổ.',
        recommendedItems: ['Áo Tấc Gấm', 'Dù Giấy Dầu', 'Nón Lá Bài Thơ'],
        icon: 'umbrella-outline' as const,
        tone: '#0284C7',
      }
    : isHot
    ? {
        title: 'Áo dài lụa tơ tằm mỏng nhẹ & Nhật Bình',
        desc: 'Trời nắng rực rỡ, ánh sáng tràn ngập. Nên ưu tiên trang phục lụa mềm thoáng khí, sắc đỏ hoặc hoàng yến để bắt sáng lung linh tại các công trình di sản.',
        recommendedItems: ['Áo Dài Tơ Tằm', 'Nhật Bình Cung Đình', 'Quạt Cầm Tay'],
        icon: 'sunny-outline' as const,
        tone: '#D97706',
      }
    : isCool
    ? {
        title: 'Áo Tấc Ngũ Thân nhiều lớp ấm áp',
        desc: 'Tiết trời se lạnh lý tưởng. Trang phục Cổ phục Ngũ Thân lót kép kèm khăn đóng nhung sẽ mang lại vẻ đẹp quý phái, đài các.',
        recommendedItems: ['Áo Ngũ Thân Kép', 'Khăn Đóng Nhung', 'Áo Tấc Lụa Dày'],
        icon: 'snow-outline' as const,
        tone: '#4F46E5',
      }
    : {
        title: 'Áo dài truyền thống & Cổ phục Việt',
        desc: 'Tiết trời dịu mát, độ ẩm vừa phải. Mọi dòng cổ phục từ Nhật Bình, Ngũ Thân đến Áo dài tân thời đều tôn dáng hoàn hảo.',
        recommendedItems: ['Nhật Bình', 'Áo Dài Lụa', 'Áo Tấc'],
        icon: 'sparkles-outline' as const,
        tone: '#BA0049',
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <View style={s.badgeRow}>
                <MaterialIcons name="wb-twilight" size={14} color="#BA0049" />
                <Text style={s.eyebrow}>TÀGO LIVE WEATHER & SHOOT CONTEXT</Text>
              </View>
              <Text style={s.title}>
                {cityName} · {tempC}°C
              </Text>
              <Text style={s.subtitle}>{conditionLabel} · Cập nhật trực tiếp</Text>
            </View>

            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#1E1418" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
          >
            {/* Golden Hour Spotlight Card */}
            <View style={s.goldenCard}>
              <View style={s.goldenIconBox}>
                <Ionicons name="sunny" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.goldenBadgeRow}>
                  <Text style={s.goldenTag}>KHUNG GIỜ VÀNG CHỤP ẢNH HÔM NAY</Text>
                  <View style={s.liveDot} />
                </View>
                <Text style={s.goldenTime}>{goldenHourSlot}</Text>
                <Text style={s.goldenDesc}>
                  Khoảnh khắc hoàng hôn ánh sáng nghiêng 45°, dịu nhẹ và rực rỡ nhất để tôn lên chất liệu gấm lụa tại {heroSpot}.
                </Text>
              </View>
            </View>

            {/* Weather-Smart Outfit Advice */}
            <View style={s.outfitCard}>
              <View style={s.outfitHeader}>
                <View
                  style={[s.outfitIconBox, { backgroundColor: `${outfitSuggestion.tone}18` }]}
                >
                  <Ionicons
                    name={outfitSuggestion.icon}
                    size={20}
                    color={outfitSuggestion.tone}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.outfitEyebrow}>GỢI Ý CỔ PHỤC PHÙ HỢP HÔM NAY</Text>
                  <Text style={s.outfitTitle}>{outfitSuggestion.title}</Text>
                </View>
              </View>

              <Text style={s.outfitDesc}>{outfitSuggestion.desc}</Text>

              <View style={s.itemPillRow}>
                {outfitSuggestion.recommendedItems.map((item) => (
                  <View key={item} style={s.itemPill}>
                    <Ionicons name="checkmark-circle" size={13} color="#BA0049" />
                    <Text style={s.itemPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Quick Action Buttons */}
            <View style={s.actionRow}>
              <Pressable
                style={s.findStoreBtn}
                onPress={() => {
                  onClose();
                  router.push(`/stores?city=${cityCode}` as Href);
                }}
              >
                <Ionicons name="storefront-outline" size={16} color="#BA0049" />
                <Text style={s.findStoreBtnText}>
                  Xem tiệm áo dài tại {cityName}
                </Text>
              </Pressable>

              <Pressable
                style={s.findPhotoBtn}
                onPress={() => {
                  onClose();
                  router.push(`/(tabs)/photography?location=${encodeURIComponent(cityName)}` as Href);
                }}
              >
                <Ionicons name="camera" size={15} color="#FFFFFF" />
                <Text style={s.findPhotoBtnText}>Thợ ảnh sẵn lịch</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 20, 22, 0.48)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '82%',
    paddingBottom: 24,
    ...Shadow,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5D8DC',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EAEF',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#BA0049',
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#1E1418',
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#6E5A62',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5ECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  goldenCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  goldenIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldenBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldenTag: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#B45309',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  goldenTime: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: '#92400E',
    marginTop: 2,
    marginBottom: 2,
  },
  goldenDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  outfitCard: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: '#FCFAF9',
    borderWidth: 1,
    borderColor: '#ECE4E8',
    gap: 10,
  },
  outfitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outfitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#8C7A82',
    letterSpacing: 0.5,
  },
  outfitTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1E1418',
  },
  outfitDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#5C474F',
    lineHeight: 18,
  },
  itemPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  itemPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#BA0049',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  findStoreBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  findStoreBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#BA0049',
  },
  findPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: '#BA0049',
  },
  findPhotoBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
});
