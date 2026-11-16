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
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { FontFamily, Radius, Shadow } from '@/constants/theme';
import type { Product } from '@/types/product';
import { getMediaUrl } from '@/utils/media';

const formatVND = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;

const CITY_SPOTS: Record<
  string,
  Array<{ name: string; tag: string; desc: string }>
> = {
  'da-nang': [
    {
      name: 'Bán đảo Sơn Trà & Chùa Linh Ứng',
      tag: 'Ngoại cảnh biển · Tượng Phật Bà',
      desc: 'Hoàng hôn ngắm trọn biển Mỹ Khê hùng vĩ, hợp Áo Tấc & Nhật Bình.',
    },
    {
      name: 'Cầu Rồng & Bờ sông Hàn',
      tag: 'Cầu biểu tượng · Phố lên đèn',
      desc: 'Gió sông mát mẻ, hoàng hôn chuyển đêm rực rỡ và lãng mạn.',
    },
    {
      name: 'Bảo tàng Điêu khắc Chăm',
      tag: 'Kiến trúc Sa thạch cổ kính',
      desc: 'Không gian râm mát, di sản Pháp - Chăm tôn dáng cổ phục quý phái.',
    },
    {
      name: 'Bãi biển Mỹ Khê & Bãi Rạng',
      tag: 'Biển xanh · Cát trắng mịn',
      desc: 'Nắng sớm và chiều tà dịu nhẹ, tà áo lụa bay bổng tuyệt đẹp.',
    },
  ],
  hue: [
    {
      name: 'Đại Nội Huế & Cửa Ngọ Môn',
      tag: 'Cung điện Di sản Thế giới',
      desc: 'Lầu Ngũ Phụng uy nghi, rực rỡ nhất trong trang phục Nhật Bình Hoàng gia.',
    },
    {
      name: 'Cung An Định',
      tag: 'Tân cổ điển Pháp - Việt',
      desc: 'Hoa văn châu Âu kết hợp nét Huế cổ, chụp cả trong nhà & ngoài vườn.',
    },
    {
      name: 'Lăng Tự Đức & Hồ Lưu Khiêm',
      tag: 'Cảnh quan non nước hữu tình',
      desc: 'Mặt hồ phẳng lặng, thơ mộng bên rừng thông râm mát.',
    },
    {
      name: 'Chùa Thiên Mụ & Sông Hương',
      tag: 'Hoàng hôn di sản xứ Huế',
      desc: 'Khoảnh khắc nắng chiều soi bóng tháp Phước Duyên xuống dòng Hương Giang.',
    },
  ],
  'hoi-an': [
    {
      name: 'Chùa Cầu & Cầu An Hội',
      tag: 'Biểu tượng Phố Cổ 400 năm',
      desc: 'Mái ngói rêu phong, ánh đèn lồng lung linh khi chiều buông xuống.',
    },
    {
      name: 'Bờ sông Hoài & Thuyền hoa đăng',
      tag: 'Sông nước lãng mạn',
      desc: 'Thả hoa đăng trên sông khi chiều tà, góc ảnh đậm chất hoài niệm.',
    },
    {
      name: 'Hội quán Phúc Kiến',
      tag: 'Chạm khắc hoa văn Á Đông',
      desc: 'Kiến trúc rực rỡ sắc đỏ son, cực kỳ bắt mắt khi diện Áo Tấc & Ngũ Thân.',
    },
  ],
  'ha-noi': [
    {
      name: 'Hoàng thành Thăng Long',
      tag: 'Di sản Nghìn năm Văn hiến',
      desc: 'Bậc thềm rồng Đoan Môn, chụp cổ phục Việt cổ kính và uy nghiêm.',
    },
    {
      name: 'Văn Miếu - Quốc Tử Giám',
      tag: 'Cổ kính & Trang nghiêm',
      desc: 'Khuê Văn Các và giếng Thiên Quang rợp bóng cây cổ thụ mát mẻ.',
    },
    {
      name: 'Hồ Hoàn Kiếm & Cầu Thê Húc',
      tag: 'Trái tim Thủ đô',
      desc: 'Cầu gỗ đỏ son uốn cong dẫn vào đền Ngọc Sơn bên rặng liễu rủ.',
    },
  ],
  hcm: [
    {
      name: 'Bảo tàng Mỹ thuật TP.HCM',
      tag: 'Kiến trúc Art Deco Pháp cổ',
      desc: 'Cầu thang xoắn ốc và hành lang kính màu tráng lệ đậm chất Sài Gòn xưa.',
    },
    {
      name: 'Bưu điện Trung tâm & Nhà thờ Đức Bà',
      tag: 'Dấu ấn Sài Gòn xưa',
      desc: 'Vòm mái cong cổ kính, rất duyên dáng khi diện Áo dài truyền thống.',
    },
    {
      name: 'Bảo tàng Áo Dài (TP. Thủ Đức)',
      tag: 'Không gian Nhà rường Nam Bộ',
      desc: 'Cầu khỉ, hồ sen và hàng cau xanh mát tái hiện trọn vẹn hồn quê Việt.',
    },
  ],
  'da-lat': [
    {
      name: 'Dinh I Bảo Đại',
      tag: 'Biệt điện Rừng thông',
      desc: 'Lối vào rợp bóng thông cổ thụ, không khí se lạnh đậm chất hoàng tộc.',
    },
    {
      name: 'Ga Cổ Đà Lạt',
      tag: 'Kiến trúc Đông Dương đặc sắc',
      desc: 'Đầu tàu hơi nước cổ và ô kính ngũ sắc, hợp Áo dài vintage & khăn choàng.',
    },
  ],
};

export interface WeatherDetailModalProps {
  visible: boolean;
  onClose: () => void;
  cityName: string;
  cityCode: string;
  tempC: number;
  conditionLabel: string;
  goldenHourSlot: string;
  heroSpot?: string;
  isTomorrow?: boolean;
  targetDateLabel?: string;
  suggestedProducts?: Product[];
  cityHighlights?: string[];
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
  isTomorrow = false,
  targetDateLabel,
  suggestedProducts = [],
  cityHighlights,
}: WeatherDetailModalProps) {
  const isRain = conditionLabel.toLowerCase().includes('mưa');
  const isHot = tempC >= 30;
  const isCool = tempC < 23;

  const dateHeading = isTomorrow ? 'NGÀY MAI' : 'HÔM NAY';
  const displayDateTag = targetDateLabel || (isTomorrow ? 'Ngày mai' : 'Hôm nay');

  const outfitSuggestion = isRain
    ? {
        title: 'Cổ phục gấm & Phụ kiện Dù cổ trang',
        desc: `Thời tiết ${displayDateTag.toLowerCase()} có mưa nhẹ lãng mạn. Rất thích hợp diện Áo Tấc gấm dày dặn kết hợp Dù giấy dầu hoặc Nón lá bài thơ để chụp những góc ảnh di sản hoài cổ.`,
        recommendedItems: ['Áo Tấc Gấm', 'Dù Giấy Dầu', 'Nón Lá Bài Thơ'],
        icon: 'umbrella-outline' as const,
        tone: '#0284C7',
      }
    : isHot
    ? {
        title: 'Áo dài lụa tơ tằm mỏng nhẹ & Nhật Bình',
        desc: `Trời nắng rực rỡ, ánh sáng tràn ngập. Nên ưu tiên trang phục lụa mềm thoáng khí, sắc đỏ hoặc hoàng yến để bắt sáng lung linh tại các công trình di sản.`,
        recommendedItems: ['Áo Dài Tơ Tằm', 'Nhật Bình Cung Đình', 'Quạt Cầm Tay'],
        icon: 'sunny-outline' as const,
        tone: '#D97706',
      }
    : isCool
    ? {
        title: 'Áo Tấc Ngũ Thân nhiều lớp ấm áp',
        desc: `Tiết trời ${displayDateTag.toLowerCase()} se lạnh lý tưởng. Trang phục Cổ phục Ngũ Thân lót kép kèm khăn đóng nhung sẽ mang lại vẻ đẹp quý phái, đài các.`,
        recommendedItems: ['Áo Ngũ Thân Kép', 'Khăn Đóng Nhung', 'Áo Tấc Lụa Dày'],
        icon: 'snow-outline' as const,
        tone: '#4F46E5',
      }
    : {
        title: 'Áo dài truyền thống & Cổ phục Việt',
        desc: `Tiết trời dịu mát, độ ẩm vừa phải. Mọi dòng cổ phục từ Nhật Bình, Ngũ Thân đến Áo dài tân thời đều tôn dáng hoàn hảo.`,
        recommendedItems: ['Nhật Bình', 'Áo Dài Lụa', 'Áo Tấc'],
        icon: 'sparkles-outline' as const,
        tone: '#BA0049',
      };

  // Get spots for current destination
  const spots =
    CITY_SPOTS[cityCode] ||
    (cityHighlights && cityHighlights.length > 0
      ? cityHighlights.map((h) => ({
          name: h,
          tag: 'Thắng cảnh nổi tiếng',
          desc: `Điểm chụp lý tưởng tại ${cityName}, thích hợp ghi lại khoảnh khắc cùng cổ phục.`,
        }))
      : [
          {
            name: heroSpot,
            tag: 'Góc chụp tiêu biểu',
            desc: `Không gian văn hóa đặc sắc tại ${cityName}.`,
          },
        ]);

  // Display top recommended products
  const displayProducts = suggestedProducts.slice(0, 5);

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
                <Text style={s.eyebrow}>
                  {isTomorrow
                    ? 'TÀGO WEATHER · DỰ BÁO NGÀY MAI'
                    : 'TÀGO LIVE WEATHER & SHOOT CONTEXT'}
                </Text>
                {isTomorrow && <View style={s.tomorrowPill}><Text style={s.tomorrowPillText}>Ngày mai</Text></View>}
              </View>
              <Text style={s.title}>
                {cityName} · {isTomorrow ? `Dự báo ngày mai ${tempC}°C` : `${tempC}°C`}
              </Text>
              <Text style={s.subtitle}>
                {conditionLabel} · {isTomorrow ? 'Dự báo khí tượng cho ngày mai' : 'Cập nhật trực tiếp'}
              </Text>
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
                  <Text style={s.goldenTag}>{`KHUNG GIỜ VÀNG CHỤP ẢNH ${dateHeading}`}</Text>
                  <View style={s.liveDot} />
                </View>
                <Text style={s.goldenTime}>{goldenHourSlot}</Text>
                <Text style={s.goldenDesc}>
                  {isTomorrow
                    ? `Khoảnh khắc hoàng hôn ngày mai ánh sáng nghiêng 45°, dịu nhẹ và rực rỡ nhất để tôn lên chất liệu gấm lụa tại ${heroSpot}.`
                    : `Khoảnh khắc hoàng hôn ánh sáng nghiêng 45°, dịu nhẹ và rực rỡ nhất để tôn lên chất liệu gấm lụa tại ${heroSpot}.`}
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
                  <Text style={s.outfitEyebrow}>{`GỢI Ý CỔ PHỤC PHÙ HỢP ${dateHeading}`}</Text>
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

            {/* SECTION: Recommended Spots for Tomorrow / Today */}
            <View style={s.sectionWrap}>
              <View style={s.sectionHeader}>
                <View style={s.sectionIconBox}>
                  <Ionicons name="location" size={16} color="#BA0049" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>
                    {`Địa điểm chụp đẹp ${dateHeading.toLowerCase()} tại ${cityName}`}
                  </Text>
                  <Text style={s.sectionSubtitle}>
                    Các góc ảnh di sản & thắng cảnh lên hình rực rỡ nhất
                  </Text>
                </View>
              </View>

              <View style={s.spotsList}>
                {spots.map((spot, idx) => (
                  <View key={idx} style={s.spotCard}>
                    <View style={s.spotTopRow}>
                      <View style={s.spotIconCircle}>
                        <Ionicons name="camera-outline" size={14} color="#BA0049" />
                      </View>
                      <Text style={s.spotName} numberOfLines={1}>
                        {spot.name}
                      </Text>
                    </View>
                    <View style={s.spotTagBadge}>
                      <Text style={s.spotTagText}>{spot.tag}</Text>
                    </View>
                    <Text style={s.spotDesc}>{spot.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* SECTION: Recommended Outfits & Costumes */}
            {displayProducts.length > 0 && (
              <View style={s.sectionWrap}>
                <View style={s.sectionHeader}>
                  <View style={[s.sectionIconBox, { backgroundColor: '#FDF2F8' }]}>
                    <Ionicons name="sparkles" size={16} color="#BA0049" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sectionTitle}>
                      Trang phục gợi ý diện đẹp
                    </Text>
                    <Text style={s.sectionSubtitle}>
                      {`Phù hợp thời tiết ${conditionLabel.toLowerCase()}`}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.productsScroll}
                >
                  {displayProducts.map((prod) => {
                    const price = prod.discountedPrice ?? prod.basePrice;
                    const imgUri = getMediaUrl(prod.images?.[0]);
                    return (
                      <Pressable
                        key={prod._id}
                        style={s.productCard}
                        onPress={() => {
                          onClose();
                          router.push(`/product/${prod._id}` as Href);
                        }}
                      >
                        <Image
                          source={imgUri}
                          style={s.productImage}
                          contentFit="cover"
                        />
                        <View style={s.productInfo}>
                          <Text style={s.productName} numberOfLines={1}>
                            {prod.name}
                          </Text>
                          <Text style={s.productPrice}>{formatVND(price)}/ngày</Text>
                          <View style={s.productBtn}>
                            <Text style={s.productBtnText}>Xem đồ</Text>
                            <Ionicons name="chevron-forward" size={10} color="#FFFFFF" />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 24,
    ...Shadow,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: '#BA0049',
  },
  tomorrowPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tomorrowPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#D97706',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#1E1418',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  goldenCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  goldenIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    fontSize: 10.5,
    color: '#B45309',
    letterSpacing: 0.4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  goldenTime: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#92400E',
    marginVertical: 2,
  },
  goldenDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  outfitCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 10,
  },
  outfitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outfitIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  outfitTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#111827',
  },
  outfitDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  itemPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  itemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  itemPillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#831843',
  },

  /* SECTION: Spots */
  sectionWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: '#1E1418',
  },
  sectionSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  spotsList: {
    gap: 8,
  },
  spotCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  spotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  spotIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#111827',
    flex: 1,
  },
  spotTagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  spotTagText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#1D4ED8',
  },
  spotDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 16,
  },

  /* SECTION: Products Scroll */
  productsScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  productCard: {
    width: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    ...Shadow,
  },
  productImage: {
    width: '100%',
    height: 110,
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    padding: 8,
    gap: 3,
  },
  productName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#111827',
  },
  productPrice: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#BA0049',
  },
  productBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BA0049',
    borderRadius: Radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 6,
    gap: 2,
    marginTop: 4,
  },
  productBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    color: '#FFFFFF',
  },

  /* Action Buttons */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  findStoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9E2',
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
  findStoreBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#BA0049',
  },
  findPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#BA0049',
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
  findPhotoBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
