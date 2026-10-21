import React from 'react';

export interface CategoryTabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface ListingCategoryTabsProps {
  tabs: CategoryTabItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export const ListingCategoryTabs: React.FC<ListingCategoryTabsProps> = ({
  tabs,
  activeTab,
  onSelectTab,
}) => {
  return (
    <div className="unified-category-tabs-bar" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`unified-category-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.icon && <span className="unified-category-tab__icon">{tab.icon}</span>}
            <span className="unified-category-tab__label">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="unified-category-tab__count">({tab.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
