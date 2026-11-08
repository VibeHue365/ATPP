import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export type StockStatusFilter = 'all' | 'available' | 'rented' | 'maintenance';

export interface CollectionChip {
  key: string;
  label: string;
  count: number;
}

export interface SizeChip {
  size: string;
  count: number;
}

interface InventoryFilterSectionProps {
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  onPressScanRfid: () => void;
  onResetFilters: () => void;
  collections: CollectionChip[];
  selectedCollection: string;
  onSelectCollection: (key: string) => void;
  statusFilter: StockStatusFilter;
  onSelectStatusFilter: (status: StockStatusFilter) => void;
  statusCounts: {
    available: number;
    rented: number;
    maintenance: number;
  };
  sizes: SizeChip[];
  selectedSize: string | null;
  onSelectSize: (size: string | null) => void;
}

export function InventoryFilterSection({
  searchQuery,
  onChangeSearch,
  onPressScanRfid,
  onResetFilters,
  collections,
  selectedCollection,
  onSelectCollection,
  statusFilter,
  onSelectStatusFilter,
  statusCounts,
  sizes,
  selectedSize,
  onSelectSize,
}: InventoryFilterSectionProps) {
  const hasActiveFilters =
    selectedCollection !== 'all' ||
    statusFilter !== 'all' ||
    selectedSize !== null ||
    searchQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={19}
          color="#5B3F43"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo mẫu, mã chip #RFID, seri hoặc Rack kệ (Kệ A1)..."
          placeholderTextColor="rgba(91, 63, 67, 0.55)"
          value={searchQuery}
          onChangeText={onChangeSearch}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => onChangeSearch('')}
            hitSlop={10}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={17} color="#94A3B8" />
          </Pressable>
        )}

        <View style={styles.searchActions}>
          <Pressable
            style={styles.iconActionBtn}
            onPress={onPressScanRfid}
            accessibilityLabel="Quét mã vạch/RFID"
          >
            <MaterialIcons name="qr-code-scanner" size={19} color="#BA0049" />
          </Pressable>
          <Pressable
            style={[
              styles.iconActionBtn,
              hasActiveFilters && styles.iconActionBtnActive,
            ]}
            onPress={onResetFilters}
            accessibilityLabel="Đặt lại bộ lọc"
          >
            <MaterialIcons
              name="tune"
              size={19}
              color={hasActiveFilters ? '#BA0049' : '#5B3F43'}
            />
          </Pressable>
        </View>
      </View>

      {/* Row 1: Collection Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.collectionScroll}
      >
        {collections.map((item) => {
          const isSelected = selectedCollection === item.key;
          return (
            <Pressable
              key={item.key}
              style={[
                styles.collectionChip,
                isSelected && styles.collectionChipActive,
              ]}
              onPress={() => onSelectCollection(item.key)}
            >
              <Text
                style={[
                  styles.collectionChipText,
                  isSelected && styles.collectionChipTextActive,
                ]}
              >
                {item.label} ({item.count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Row 2: Status & Size Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subFilterScroll}
      >
        {/* Status: Available */}
        <Pressable
          style={[
            styles.subChip,
            statusFilter === 'available' && styles.subChipPrimaryActive,
          ]}
          onPress={() =>
            onSelectStatusFilter(
              statusFilter === 'available' ? 'all' : 'available',
            )
          }
        >
          {statusFilter === 'available' && (
            <MaterialIcons name="check" size={13} color="#BA0049" />
          )}
          <Text
            style={[
              styles.subChipText,
              statusFilter === 'available' && styles.subChipTextPrimaryActive,
            ]}
          >
            Sẵn sàng ({statusCounts.available})
          </Text>
        </Pressable>

        {/* Status: Rented */}
        <Pressable
          style={[
            styles.subChip,
            statusFilter === 'rented' && styles.subChipPrimaryActive,
          ]}
          onPress={() =>
            onSelectStatusFilter(statusFilter === 'rented' ? 'all' : 'rented')
          }
        >
          {statusFilter === 'rented' && (
            <MaterialIcons name="check" size={13} color="#BA0049" />
          )}
          <Text
            style={[
              styles.subChipText,
              statusFilter === 'rented' && styles.subChipTextPrimaryActive,
            ]}
          >
            Đang thuê ({statusCounts.rented})
          </Text>
        </Pressable>

        {/* Status: Maintenance */}
        <Pressable
          style={[
            styles.subChip,
            statusFilter === 'maintenance' && styles.subChipPrimaryActive,
          ]}
          onPress={() =>
            onSelectStatusFilter(
              statusFilter === 'maintenance' ? 'all' : 'maintenance',
            )
          }
        >
          {statusFilter === 'maintenance' && (
            <MaterialIcons name="check" size={13} color="#BA0049" />
          )}
          <Text
            style={[
              styles.subChipText,
              statusFilter === 'maintenance' && styles.subChipTextPrimaryActive,
            ]}
          >
            Bảo dưỡng ({statusCounts.maintenance})
          </Text>
        </Pressable>

        <Text style={styles.pipeDivider}>|</Text>

        {/* Size Chips */}
        {sizes.map((s) => {
          const isSelected = selectedSize === s.size;
          return (
            <Pressable
              key={s.size}
              style={[
                styles.subChip,
                isSelected && styles.subChipPrimaryActive,
              ]}
              onPress={() => onSelectSize(isSelected ? null : s.size)}
            >
              <Text
                style={[
                  styles.subChipText,
                  isSelected && styles.subChipTextPrimaryActive,
                ]}
              >
                Size {s.size} ({s.count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  searchBar: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#1B1C1C',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionBtnActive: {
    backgroundColor: 'rgba(186, 0, 73, 0.1)',
  },
  collectionScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  collectionChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E8E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionChipActive: {
    backgroundColor: '#1B1C1C',
    borderColor: '#1B1C1C',
  },
  collectionChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#1B1C1C',
  },
  collectionChipTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  subFilterScroll: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  subChip: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E8E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  subChipPrimaryActive: {
    backgroundColor: 'rgba(186, 0, 73, 0.1)',
    borderColor: 'rgba(186, 0, 73, 0.25)',
  },
  subChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  subChipTextPrimaryActive: {
    fontFamily: 'Inter_600SemiBold',
    color: '#BA0049',
  },
  pipeDivider: {
    fontSize: 13,
    color: '#D4D4D8',
    marginHorizontal: 2,
  },
});
