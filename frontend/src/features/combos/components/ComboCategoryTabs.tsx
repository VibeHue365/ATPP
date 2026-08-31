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
    color: string;
  }> = [
    {
      key: 'all',
      label: 'Tất cả combo',
      count: `${counts.all} gói`,
      icon: <Gift size={16} />,
      color: '#8B1E2D',
    },
    {
      key: 'hot',
      label: 'Hot nhất',
      count: `${counts.hot} gói`,
      icon: <Flame size={16} />,
      color: '#EA580C',
    },
    {
      key: 'savings',
      label: 'Tiết kiệm nhất',
      count: `${counts.savings} gói`,
      icon: <Percent size={16} />,
      color: '#16A34A',
    },
    {
      key: 'outdoor',
      label: 'Ngoại cảnh',
      count: `${counts.outdoor} gói`,
      icon: <MapPin size={16} />,
      color: '#2563EB',
    },
    {
      key: 'studio',
      label: 'Studio',
      count: `${counts.studio} gói`,
      icon: <Camera size={16} />,
      color: '#9333EA',
    },
    {
      key: 'couple',
      label: 'Cặp đôi',
      count: `${counts.couple} gói`,
      icon: <Heart size={16} />,
      color: '#DB2777',
    },
  ];

  return (
    <div className="figma-combo-category-tabs-container">
      <div className="figma-combo-category-tabs-scroll">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={`figma-combo-category-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(t.key)}
            >
              <span className="tab-icon" style={{ color: t.color }}>
                {t.icon}
              </span>
              <div className="tab-text-group">
                <span className="tab-label">{t.label}</span>
                <span className="tab-count">{t.count}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
