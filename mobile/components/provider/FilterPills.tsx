import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FontFamily } from '@/constants/theme';

export type FilterCategory = 'ALL' | 'PHOTOSHOOT' | 'RENTAL';

interface FilterPillsProps {
  selected: FilterCategory;
  onSelect: (category: FilterCategory) => void;
  allCount?: number;
  photoshootCount?: number;
  rentalCount?: number;
}

export function FilterPills({
  selected,
  onSelect,
  allCount = 0,
  photoshootCount = 0,
  rentalCount = 0,
}: FilterPillsProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Tất cả */}
        <Pressable
          style={[styles.pill, selected === 'ALL' && styles.pillActive]}
          onPress={() => onSelect('ALL')}
        >
          <Text style={[styles.pillText, selected === 'ALL' && styles.pillTextActive]}>
            Tất cả
          </Text>
          <View
            style={[
              styles.countBadge,
              selected === 'ALL' ? styles.countBadgeActive : styles.countBadgeInactive,
            ]}
          >
            <Text
              style={[
                styles.countText,
                selected === 'ALL' ? styles.countTextActive : styles.countTextInactive,
              ]}
            >
              {allCount}
            </Text>
          </View>
        </Pressable>

        {/* Đơn thuê áo */}
        <Pressable
          style={[styles.pill, selected === 'RENTAL' && styles.pillActive]}
          onPress={() => onSelect('RENTAL')}
        >
          <MaterialIcons
            name="checkroom"
            size={15}
            color={selected === 'RENTAL' ? '#FFFFFF' : '#BA0049'}
          />
          <Text
            style={[
              styles.pillText,
              selected === 'RENTAL' && styles.pillTextActive,
            ]}
          >
            Đơn thuê áo ({rentalCount})
          </Text>
        </Pressable>

        {/* Ca chụp */}
        <Pressable
          style={[styles.pill, selected === 'PHOTOSHOOT' && styles.pillActive]}
          onPress={() => onSelect('PHOTOSHOOT')}
        >
          <Ionicons
            name="camera-outline"
            size={15}
            color={selected === 'PHOTOSHOOT' ? '#FFFFFF' : '#5F5E5E'}
          />
          <Text
            style={[
              styles.pillText,
              selected === 'PHOTOSHOOT' && styles.pillTextActive,
            ]}
          >
            Ca chụp ({photoshootCount})
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  pillActive: {
    backgroundColor: '#1B1C1C',
    borderColor: '#1B1C1C',
  },
  pillText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5F5E5E',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 99,
  },
  countBadgeActive: {
    backgroundColor: '#BA0049',
  },
  countBadgeInactive: {
    backgroundColor: '#F5F3F3',
  },
  countText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
  },
  countTextActive: {
    color: '#FFFFFF',
  },
  countTextInactive: {
    color: '#5F5E5E',
  },
});
