import React from 'react';
import { Shirt, Camera, Package } from 'lucide-react';

export type MasterCategoryType = 'RENTAL' | 'PHOTOSHOOT' | 'COMBO';
export type SubStatusFilterType = 'ALL' | 'RENTING' | 'PICKUP_SOON' | 'DUE_SOON' | 'RETURNED';

interface ScheduleMasterTabsProps {
  activeCategory: MasterCategoryType;
  onSelectCategory: (cat: MasterCategoryType) => void;
  activeStatus: SubStatusFilterType;
  onSelectStatus: (status: SubStatusFilterType) => void;
  counts: {
    rentals: number;
    photoshoots: number;
    combos: number;
    subAll: number;
    subRenting: number;
    subPickupSoon: number;
    subDueSoon: number;
    subReturned: number;
  };
}

export const ScheduleMasterTabs: React.FC<ScheduleMasterTabsProps> = ({
  activeCategory,
  onSelectCategory,
  activeStatus,
  onSelectStatus,
  counts
}) => {
  const masterCategories = [
    { key: 'RENTAL' as MasterCategoryType, label: 'Thuê áo dài', icon: <Shirt size={16} />, count: counts.rentals },
    { key: 'PHOTOSHOOT' as MasterCategoryType, label: 'Chụp ảnh', icon: <Camera size={16} />, count: counts.photoshoots },
    { key: 'COMBO' as MasterCategoryType, label: 'Combo', icon: <Package size={16} />, count: counts.combos }
  ];

  const subFilters = [
    { key: 'ALL' as SubStatusFilterType, label: 'Tất cả', count: counts.subAll },
    { key: 'RENTING' as SubStatusFilterType, label: 'Đang thuê', count: counts.subRenting },
    { key: 'PICKUP_SOON' as SubStatusFilterType, label: 'Sắp nhận', count: counts.subPickupSoon },
    { key: 'DUE_SOON' as SubStatusFilterType, label: 'Sắp đến hạn', count: counts.subDueSoon },
    { key: 'RETURNED' as SubStatusFilterType, label: 'Đã trả', count: counts.subReturned }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Master Tabs (3 Wide Buttons) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EFE9E1',
          padding: '6px',
          gap: '6px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}
      >
        {masterCategories.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onSelectCategory(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: isActive ? '#8B1E2D' : 'transparent',
                color: isActive ? '#FFFFFF' : '#574D4F',
                fontSize: '13.5px',
                fontWeight: 750,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {cat.icon}
              <span>{cat.label}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#F3EEE8',
                  color: isActive ? '#FFFFFF' : '#7D736B',
                  fontSize: '11px',
                  fontWeight: 800
                }}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Secondary Filter Pills (Horizontal list) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px', flexWrap: 'wrap' }}>
        {subFilters.map((flt) => {
          const isSelected = activeStatus === flt.key;
          return (
            <button
              key={flt.key}
              type="button"
              onClick={() => onSelectStatus(flt.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '999px',
                backgroundColor: isSelected ? '#8B1E2D' : '#FFFFFF',
                border: isSelected ? '1px solid #8B1E2D' : '1px solid #DED7CB',
                color: isSelected ? '#FFFFFF' : '#4A3F35',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{flt.label} ({flt.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
