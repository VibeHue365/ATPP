import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import {
  useDestination,
  DESTINATION_CITIES,
  type DestinationCity,
} from '@/contexts/DestinationContext';

const CITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  hue: 'sparkles',
  'da-nang': 'boat-outline',
  'hoi-an': 'color-wand-outline',
  'ha-noi': 'ribbon-outline',
  hcm: 'business-outline',
  'da-lat': 'flower-outline',
};

export function DestinationPickerModal() {
  const {
    destination,
    isPickerOpen,
    userDetectedCity,
    closeDestinationPicker,
    selectDestination,
    resetToDetectedLocation,
  } = useDestination();

  return (
    <Modal
      visible={isPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDestinationPicker}
    >
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={closeDestinationPicker} />

        <View style={s.sheet}>
          {/* Handle indicator */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <View style={s.badgeRow}>
                <Ionicons name="compass" size={13} color="#BA0049" />
                <Text style={s.eyebrow}>ĐIỂM ĐẾN DI SẢN & DU LỊCH</Text>
              </View>
              <Text style={s.title}>Bạn muốn chụp ảnh ở đâu?</Text>
            </View>

            <Pressable
              style={s.closeBtn}
              onPress={closeDestinationPicker}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#1E1418" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
          >
            {/* Quick Auto-Detected Location Pill */}
            {userDetectedCity && (
              <Pressable
                style={[
                  s.detectedBox,
                  destination.code.toLowerCase() === userDetectedCity.code.toLowerCase() &&
                    s.detectedBoxActive,
                ]}
                onPress={resetToDetectedLocation}
              >
                <View style={s.detectedIconCircle}>
                  <Ionicons name="navigate-circle" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.detectedTitle}>Vị trí mạng hiện tại của bạn</Text>
                  <Text style={s.detectedSub} numberOfLines={1}>
                    {userDetectedCity.label}
                  </Text>
                </View>
                {destination.code.toLowerCase() === userDetectedCity.code.toLowerCase() ? (
                  <View style={s.activeCheckDot}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={s.selectHintPill}>
                    <Text style={s.selectHintText}>Chọn ngay</Text>
                  </View>
                )}
              </Pressable>
            )}

            <Text style={s.sectionLabel}>CÁC THÀNH PHỐ NỔI TIẾNG</Text>

            {/* City Cards */}
            {DESTINATION_CITIES.map((city: DestinationCity) => {
              const isSelected =
                destination.code.toLowerCase() === city.code.toLowerCase();
              const iconName = CITY_ICONS[city.code] || 'location-outline';

              return (
                <Pressable
                  key={city.code}
                  style={[s.cityCard, isSelected && s.cityCardSelected]}
                  onPress={() => selectDestination(city.code)}
                >
                  <View
                    style={[
                      s.cityIconBox,
                      isSelected && { backgroundColor: '#BA0049' },
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#BA0049'}
                    />
                  </View>

                  <View style={s.cityInfo}>
                    <View style={s.cityNameRow}>
                      <Text style={s.cityName}>{city.name}</Text>
                      <View style={s.cityBadge}>
                        <Text style={s.cityBadgeText}>{city.badge}</Text>
                      </View>
                    </View>
                    <Text style={s.cityTagline} numberOfLines={1}>
                      {city.tagline}
                    </Text>
                    <Text style={s.citySpots} numberOfLines={1}>
                      📍 {city.highlights.slice(0, 3).join(' · ')}
                    </Text>
                  </View>

                  <View style={s.radioCircle}>
                    {isSelected && (
                      <View style={s.radioInner}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            <View style={s.footerNotice}>
              <Ionicons name="information-circle-outline" size={14} color="#8C7A82" />
              <Text style={s.footerNoticeText}>
                Khi chuyển điểm đến, thời tiết và tiệm áo dài trên trang chủ sẽ tự động cập nhật tương ứng.
              </Text>
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
    maxHeight: '84%',
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
    fontSize: 10,
    color: '#BA0049',
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#1E1418',
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
    gap: 10,
  },
  detectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.2,
    borderColor: '#BFDBFE',
    marginBottom: 6,
  },
  detectedBoxActive: {
    backgroundColor: '#E0E7FF',
    borderColor: '#6366F1',
  },
  detectedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow,
  },
  detectedTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#1E3A8A',
  },
  detectedSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 1,
  },
  activeCheckDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectHintPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  selectHintText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1D4ED8',
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: '#8C7A82',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#FCFAF9',
    borderWidth: 1,
    borderColor: '#ECE4E8',
  },
  cityCardSelected: {
    backgroundColor: '#FFF0F5',
    borderColor: '#BA0049',
    borderWidth: 1.4,
  },
  cityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7EDF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityInfo: {
    flex: 1,
    gap: 2,
  },
  cityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14.5,
    color: '#1E1418',
  },
  cityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FFF2E8',
    borderWidth: 0.5,
    borderColor: '#FDBA74',
  },
  cityBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#C2410C',
  },
  cityTagline: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#5C474F',
  },
  citySpots: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#8C7A82',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D8C7CF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  footerNoticeText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 10.5,
    color: '#8C7A82',
    lineHeight: 15,
  },
});
