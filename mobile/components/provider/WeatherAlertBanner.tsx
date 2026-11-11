import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeatherLocationChangeAlert } from '@/types/provider';

interface WeatherAlertBannerProps {
  alert?: WeatherLocationChangeAlert | null;
  onPressAction: () => void;
}

export function WeatherAlertBanner({ alert, onPressAction }: WeatherAlertBannerProps) {
  // If no alert data passed, we can show null or default mock-safe active notification
  const location = alert?.currentLocationName || 'Cung An Định';
  const rainText = alert?.rainStopDuration || 'Trời ngớt sau 40p';
  const suggestion =
    alert?.suggestedLocation ||
    'Chuyển sang Cung Diên Thọ hoặc Chụp trong Studio để kịp tiến độ ca 14:30';

  return (
    <View style={styles.card}>
      <View style={styles.contentRow}>
        <Text style={styles.weatherEmoji}>🌧️</Text>
        <View style={styles.textCol}>
          <View style={styles.headlineRow}>
            <Text style={styles.headlineText} numberOfLines={1}>
              {location} đang mưa lớn
            </Text>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{rainText}</Text>
            </View>
          </View>
          <Text style={styles.descriptionText} numberOfLines={2}>
            Đề xuất: {suggestion}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={onPressAction}
        >
          <Text style={styles.actionBtnText}>Duyệt điểm</Text>
          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  weatherEmoji: {
    fontSize: 22,
    marginTop: 1,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  headlineText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#1E3A8A',
  },
  timeBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#1D4ED8',
  },
  descriptionText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(30, 58, 138, 0.9)',
    marginTop: 3,
    lineHeight: 16,
  },
  actionBtn: {
    backgroundColor: '#5B0114',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    shadowColor: '#5B0114',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
