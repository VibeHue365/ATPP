import React from 'react';

export interface SidebarFilterValues {
  regions: string[];
  types: string[];
  minPrice: number;
  maxPrice: number;
  presetPrice: string | null;
  sortBy: string;
}

export interface FilterOptionWithCount {
  label: string;
  count: number;
}

interface ComboSidebarFilterProps {
  values: SidebarFilterValues;
  onChange: (newValues: Partial<SidebarFilterValues>) => void;
  onResetAll: () => void;
  regionOptions?: FilterOptionWithCount[];
  typeOptions?: FilterOptionWithCount[];
}

export const ComboSidebarFilter: React.FC<ComboSidebarFilterProps> = ({
  values,
  onChange,
  onResetAll,
  regionOptions = [
    { label: 'Huế', count: 0 },
    { label: 'Đà Nẵng', count: 0 },
    { label: 'Hội An', count: 0 },
    { label: 'Đà Lạt', count: 0 },
    { label: 'Hà Nội', count: 0 },
  ],
  typeOptions = [
    { label: 'Ngoại cảnh', count: 0 },
    { label: 'Studio', count: 0 },
    { label: 'Cặp đôi', count: 0 },
    { label: 'Gia đình', count: 0 },
    { label: 'Sự kiện', count: 0 },
  ],
}) => {

  const sortOptions = [
    { key: 'popular', label: 'Phổ biến nhất' },
    { key: 'newest', label: 'Mới nhất' },
    { key: 'price_low', label: 'Giá: Thấp đến cao' },
    { key: 'price_high', label: 'Giá: Cao đến thấp' },
    { key: 'discount_high', label: 'Tiết kiệm nhiều nhất' },
  ];

  const handleToggleRegion = (reg: string) => {
    if (reg === 'all') {
      onChange({ regions: [] });
      return;
    }
    const exists = values.regions.includes(reg);
    const updated = exists
      ? values.regions.filter((r) => r !== reg)
      : [...values.regions, reg];
    onChange({ regions: updated });
  };

  const handleToggleType = (type: string) => {
    const exists = values.types.includes(type);
    const updated = exists
      ? values.types.filter((t) => t !== type)
      : [...values.types, type];
    onChange({ types: updated });
  };

  const handleSelectPricePreset = (preset: string) => {
    if (values.presetPrice === preset) {
      onChange({ presetPrice: null, minPrice: 500000, maxPrice: 5000000 });
      return;
    }
    let min = 500000;
    let max = 5000000;
    if (preset === 'under_1m') {
      min = 500000;
      max = 1000000;
    } else if (preset === '1m_2m') {
      min = 1000000;
      max = 2000000;
    } else if (preset === '2m_3m') {
      min = 2000000;
      max = 3000000;
    } else if (preset === 'above_3m') {
      min = 3000000;
      max = 5000000;
    }
    onChange({ presetPrice: preset, minPrice: min, maxPrice: max });
  };

  const isAllRegions = values.regions.length === 0;

  return (
    <aside className="figma-combo-sidebar">
      {/* Sidebar Header */}
      <div className="figma-combo-sidebar-header">
        <h3 className="sidebar-title">LỌC NÂNG CAO</h3>
        <button
          type="button"
          className="sidebar-reset-btn"
          onClick={onResetAll}
        >
          Xóa tất cả
        </button>
      </div>

      {/* Group 1: KHU VỰC */}
      <div className="sidebar-filter-group">
        <h4 className="group-heading">KHU VỰC</h4>
        <div className="checkbox-list">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={isAllRegions}
              onChange={() => handleToggleRegion('all')}
            />
            <span className="checkbox-custom" />
            <span className="checkbox-label">Tất cả khu vực</span>
          </label>

          {regionOptions.map((opt) => (
            <label key={opt.label} className="checkbox-item">
              <input
                type="checkbox"
                checked={values.regions.includes(opt.label)}
                onChange={() => handleToggleRegion(opt.label)}
              />
              <span className="checkbox-custom" />
              <span className="checkbox-label">{opt.label}</span>
              <span className="checkbox-count">{opt.count}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Group 2: LOẠI HÌNH */}
      <div className="sidebar-filter-group">
        <h4 className="group-heading">LOẠI HÌNH</h4>
        <div className="checkbox-list">
          {typeOptions.map((opt) => (
            <label key={opt.label} className="checkbox-item">
              <input
                type="checkbox"
                checked={values.types.includes(opt.label)}
                onChange={() => handleToggleType(opt.label)}
              />
              <span className="checkbox-custom" />
              <span className="checkbox-label">{opt.label}</span>
              <span className="checkbox-count">{opt.count}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Group 3: MỨC GIÁ */}
      <div className="sidebar-filter-group">
        <h4 className="group-heading">MỨC GIÁ</h4>
        <div className="price-slider-box">
          <div className="price-labels-row">
            <span>{values.minPrice.toLocaleString('vi-VN')}đ</span>
            <span>{values.maxPrice >= 5000000 ? '5.000.000đ+' : `${values.maxPrice.toLocaleString('vi-VN')}đ`}</span>
          </div>

          <div className="price-range-slider-wrapper">
            <input
              type="range"
              min={500000}
              max={5000000}
              step={100000}
              value={values.maxPrice}
              onChange={(e) =>
                onChange({ maxPrice: Number(e.target.value), presetPrice: null })
              }
              className="price-range-input"
            />
          </div>

          {/* 2x2 Preset Buttons */}
          <div className="price-presets-grid">
            <button
              type="button"
              className={`price-preset-btn ${values.presetPrice === 'under_1m' ? 'active' : ''}`}
              onClick={() => handleSelectPricePreset('under_1m')}
            >
              Dưới 1 triệu
            </button>
            <button
              type="button"
              className={`price-preset-btn ${values.presetPrice === '1m_2m' ? 'active' : ''}`}
              onClick={() => handleSelectPricePreset('1m_2m')}
            >
              1 - 2 triệu
            </button>
            <button
              type="button"
              className={`price-preset-btn ${values.presetPrice === '2m_3m' ? 'active' : ''}`}
              onClick={() => handleSelectPricePreset('2m_3m')}
            >
              2 - 3 triệu
            </button>
            <button
              type="button"
              className={`price-preset-btn ${values.presetPrice === 'above_3m' ? 'active' : ''}`}
              onClick={() => handleSelectPricePreset('above_3m')}
            >
              Trên 3 triệu
            </button>
          </div>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Group 4: SẮP XẾP */}
      <div className="sidebar-filter-group">
        <h4 className="group-heading">SẮP XẾP</h4>
        <div className="radio-list">
          {sortOptions.map((opt) => (
            <label key={opt.key} className="radio-item">
              <input
                type="radio"
                name="sidebar-sort"
                checked={values.sortBy === opt.key}
                onChange={() => onChange({ sortBy: opt.key })}
              />
              <span className="radio-custom" />
              <span className="radio-label">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
};
