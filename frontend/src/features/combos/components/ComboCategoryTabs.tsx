import React from 'react';
import { Gift, Flame, Percent, MapPin, Camera, Heart } from 'lucide-react';

export type ComboCategoryTabKey = 'all' | 'hot' | 'savings' | 'outdoor' | 'studio' | 'couple';

export interface ComboCategoryCounts {
  all: number;
  hot: number;
  savings: number;
  outdoor: number;
  studio: number;
  couple: number;
}

interface ComboCategoryTabsProps {
  activeTab: ComboCategoryTabKey;
  onSelectTab: (tab: ComboCategoryTabKey) => void;
  counts?: ComboCategoryCounts;
}

export const ComboCategoryTabs: React.FC<ComboCategoryTabsProps> = ({
  activeTab,
  onSelectTab,
  counts = {
    all: 0,
    hot: 0,
    savings: 0,
    outdoor: 0,
    studio: 0,
    couple: 0,
  },
}) => {
  const tabs: Array<{
    key: ComboCategoryTabKey;
    label: string;
    count: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'all',
      label: 'Tất cả combo',
      count: `${counts.all} gói`,
      icon: <Gift size={16} />,
    },
    {
      key: 'hot',
      label: 'Hot nhất',
      count: `${counts.hot} gói`,
      icon: <Flame size={16} />,
    },
    {
      key: 'savings',
      label: 'Tiết kiệm nhất',
      count: `${counts.savings} gói`,
      icon: <Percent size={16} />,
    },
    {
      key: 'outdoor',
      label: 'Ngoại cảnh',
      count: `${counts.outdoor} gói`,
      icon: <MapPin size={16} />,
    },
    {
      key: 'studio',
      label: 'Studio',
      count: `${counts.studio} gói`,
      icon: <Camera size={16} />,
    },
    {
      key: 'couple',
      label: 'Cặp đôi',
      count: `${counts.couple} gói`,
      icon: <Heart size={16} />,
    },
  ];

  return (
    <div className="unified-category-tabs-bar" role="tablist">
      {tabs.map((t) => {
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`unified-category-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelectTab(t.key)}
          >
            <span className="unified-category-tab__icon">{t.icon}</span>
            <span className="unified-category-tab__label">{t.label}</span>
            <span className="unified-category-tab__count">({t.count})</span>
          </button>
        );
      })}
    </div>
  );
};
