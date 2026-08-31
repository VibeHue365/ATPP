import React from 'react';
import { Search, X, SlidersHorizontal, ArrowUpDown, Tag, DollarSign, Users } from 'lucide-react';
import type {
  ComboFilterState,
  ComboPriceFilter,
  ComboDiscountFilter,
  ComboPeopleFilter,
  ComboSortOption
} from '../types/combo.types';

interface ComboFilterBarProps {
  filters: ComboFilterState;
  onFilterChange: (newFilters: Partial<ComboFilterState>) => void;
  onResetFilters: () => void;
  totalFiltered: number;
  totalCount: number;
}

export const ComboFilterBar: React.FC<ComboFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalFiltered,
  totalCount
}) => {
  const isFiltered =
    Boolean(filters.searchQuery.trim()) ||
    filters.priceRange !== 'all' ||
    filters.discountRange !== 'all' ||
    filters.peopleRange !== 'all';

  return (
    <div className="lume-combo-filter-container">
      {/* Top Search & Sort Row */}
      <div className="lume-combo-filter-main-row">
        {/* Search Input */}
        <div className="lume-combo-search-wrapper">
          <Search size={18} className="lume-combo-search-icon" />
          <input
            type="text"
            className="lume-combo-search-input"
            placeholder="Tìm theo tên combo, mẫu áo dài, gói chụp hoặc tên studio..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          />
          {filters.searchQuery && (
            <button
              type="button"
              className="lume-combo-search-clear-btn"
              onClick={() => onFilterChange({ searchQuery: '' })}
              title="Xóa tìm kiếm"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="lume-combo-sort-wrapper">
          <ArrowUpDown size={15} className="lume-combo-sort-icon" />
          <span className="lume-combo-sort-label">Sắp xếp:</span>
          <select
            className="lume-combo-sort-select"
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as ComboSortOption })}
          >
            <option value="discount_high">Ưu đãi nhiều nhất (Mặc định)</option>
            <option value="price_low">Giá: Thấp đến Cao</option>
            <option value="price_high">Giá: Cao đến Thấp</option>
            <option value="newest">Mới nhất</option>
          </select>
        </div>
      </div>

      {/* Filter Chips Groups Row */}
      <div className="lume-combo-chips-row">
        {/* Price filter group */}
        <div className="lume-combo-filter-group">
          <span className="lume-combo-filter-group-title">
            <DollarSign size={13} /> Khoảng giá:
          </span>
          <div className="lume-combo-pills">
            {(
              [
                { id: 'all', label: 'Tất cả giá' },
                { id: 'under_1500', label: '< 1.5 triệu' },
                { id: '1500_3000', label: '1.5 - 3 triệu' },
                { id: 'above_3000', label: '> 3 triệu' }
              ] as const
            ).map((item) => {
              const active = filters.priceRange === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`lume-combo-pill ${active ? 'active' : ''}`}
                  onClick={() => onFilterChange({ priceRange: item.id as ComboPriceFilter })}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Discount filter group */}
        <div className="lume-combo-filter-group">
          <span className="lume-combo-filter-group-title">
            <Tag size={13} /> Mức ưu đãi:
          </span>
          <div className="lume-combo-pills">
            {(
              [
                { id: 'all', label: 'Tất cả ưu đãi' },
                { id: '15_plus', label: 'Giảm từ 15%' },
                { id: '25_plus', label: 'Giảm từ 25%' }
              ] as const
            ).map((item) => {
              const active = filters.discountRange === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`lume-combo-pill ${active ? 'active' : ''}`}
                  onClick={() => onFilterChange({ discountRange: item.id as ComboDiscountFilter })}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* People count filter group */}
        <div className="lume-combo-filter-group">
          <span className="lume-combo-filter-group-title">
            <Users size={13} /> Quy mô chụp:
          </span>
          <div className="lume-combo-pills">
            {(
              [
                { id: 'all', label: 'Tất cả quy mô' },
                { id: 'single', label: 'Cá nhân (1 người)' },
                { id: 'couple', label: 'Cặp đôi (2 người)' },
                { id: 'group', label: 'Nhóm / Gia đình' }
              ] as const
            ).map((item) => {
              const active = filters.peopleRange === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`lume-combo-pill ${active ? 'active' : ''}`}
                  onClick={() => onFilterChange({ peopleRange: item.id as ComboPeopleFilter })}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Summary & Reset Bar */}
      <div className="lume-combo-summary-row">
        <div className="lume-combo-results-count">
          Hiển thị <strong>{totalFiltered}</strong> trên tổng số <strong>{totalCount}</strong> combo trọn gói
        </div>

        {isFiltered && (
          <button
            type="button"
            className="lume-combo-reset-filters-btn"
            onClick={onResetFilters}
          >
            <SlidersHorizontal size={13} />
            <span>Xóa bộ lọc</span>
          </button>
        )}
      </div>
    </div>
  );
};
