import React, { useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';

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
  userHasOnboarding?: boolean;
  userPrefOccasion?: string;
  userPrefStyle?: string;
  userPrefSize?: string;
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
  userHasOnboarding = false,
  userPrefOccasion,
  userPrefStyle,
  userPrefSize,
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    region: true,
    type: true,
    price: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const [isPersonalizedFilterActive, setIsPersonalizedFilterActive] = useState(true);
  const [disabledProfilePrefs, setDisabledProfilePrefs] = useState<{
    size?: boolean;
    style?: boolean;
    occasion?: boolean;
  }>({});

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
        <h3 className="sidebar-title">Bộ lọc</h3>
        <button
          type="button"
          className="sidebar-reset-btn"
          onClick={onResetAll}
        >
          Xóa tất cả
        </button>
      </div>

      {/* Onboarding Profile Strip */}
      {userHasOnboarding && (
        <div className="combo-profile-strip">
          <div className="combo-profile-strip-header">
            <div className="combo-profile-strip-title">
              <Sparkles size={14} className="combo-sparkle-icon" />
              <span>Hồ sơ gợi ý</span>
            </div>
            <a
              href="/onboarding"
              className="combo-profile-edit-link"
              title="Chỉnh sửa số đo & sở thích"
            >
              Đổi sở thích
            </a>
          </div>

          <div className="combo-profile-chips">
            {userPrefSize && !disabledProfilePrefs.size && (
              <span className="combo-profile-chip">
                <span>Size {userPrefSize}</span>
                <button
                  type="button"
                  className="combo-profile-chip-remove"
                  onClick={() => setDisabledProfilePrefs((p) => ({ ...p, size: true }))}
                  title="Bỏ lọc size"
                >
                  ✕
                </button>
              </span>
            )}
            {userPrefStyle && !disabledProfilePrefs.style && (
              <span className="combo-profile-chip">
                <span>Gu {userPrefStyle}</span>
                <button
                  type="button"
                  className="combo-profile-chip-remove"
                  onClick={() => setDisabledProfilePrefs((p) => ({ ...p, style: true }))}
                  title="Bỏ lọc phong cách"
                >
                  ✕
                </button>
              </span>
            )}
            {userPrefOccasion && !disabledProfilePrefs.occasion && (
              <span className="combo-profile-chip">
                <span>Dịp {userPrefOccasion}</span>
                <button
                  type="button"
                  className="combo-profile-chip-remove"
                  onClick={() => setDisabledProfilePrefs((p) => ({ ...p, occasion: true }))}
                  title="Bỏ lọc dịp"
                >
                  ✕
                </button>
              </span>
            )}
            {Object.values(disabledProfilePrefs).some(Boolean) && (
              <button
                type="button"
                className="combo-profile-chip-reset"
                onClick={() => setDisabledProfilePrefs({})}
              >
                Khôi phục
              </button>
            )}
          </div>

          <div className="combo-profile-toggle-row">
            <span className="combo-toggle-text">
              {isPersonalizedFilterActive ? "Gợi ý cá nhân hóa" : "Toàn bộ combo"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isPersonalizedFilterActive}
              onClick={() => setIsPersonalizedFilterActive(!isPersonalizedFilterActive)}
              className={`combo-switch ${isPersonalizedFilterActive ? "is-active" : ""}`}
              title="Bật/Tắt gợi ý cá nhân hóa"
            >
              <span className="combo-switch-thumb" />
            </button>
          </div>
        </div>
      )}

      {/* Accordion 1: KHU VỰC */}
      <div className="combo-accordion-section">
        <button
          type="button"
          className="combo-accordion-trigger"
          onClick={() => toggleSection('region')}
        >
          <span className="combo-accordion-title">Khu vực</span>
          <ChevronDown
            size={15}
            className={`combo-accordion-chevron ${openSections.region ? "is-open" : ""}`}
          />
        </button>
        {openSections.region && (
          <div className="combo-accordion-content">
            <div className="checkbox-list">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={isAllRegions}
                  onChange={() => handleToggleRegion('all')}
                />
                <span className="checkbox-custom">
                  {isAllRegions && <Check size={12} color="#FFFFFF" />}
                </span>
                <span className="checkbox-label">Tất cả khu vực</span>
              </label>

              {regionOptions.map((opt) => (
                <label
                  key={opt.label}
                  className={`checkbox-item ${opt.count === 0 ? 'is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    disabled={opt.count === 0}
                    checked={values.regions.includes(opt.label)}
                    onChange={() => handleToggleRegion(opt.label)}
                  />
                  <span className="checkbox-custom">
                    {values.regions.includes(opt.label) && <Check size={12} color="#FFFFFF" />}
                  </span>
                  <span className="checkbox-label">
                    {opt.label} <span className="checkbox-count-badge">({opt.count})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accordion 2: LOẠI HÌNH */}
      <div className="combo-accordion-section">
        <button
          type="button"
          className="combo-accordion-trigger"
          onClick={() => toggleSection('type')}
        >
          <span className="combo-accordion-title">Loại hình combo</span>
          <ChevronDown
            size={15}
            className={`combo-accordion-chevron ${openSections.type ? "is-open" : ""}`}
          />
        </button>
        {openSections.type && (
          <div className="combo-accordion-content">
            <div className="checkbox-list">
              {typeOptions.map((opt) => (
                <label
                  key={opt.label}
                  className={`checkbox-item ${opt.count === 0 ? 'is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    disabled={opt.count === 0}
                    checked={values.types.includes(opt.label)}
                    onChange={() => handleToggleType(opt.label)}
                  />
                  <span className="checkbox-custom">
                    {values.types.includes(opt.label) && <Check size={12} color="#FFFFFF" />}
                  </span>
                  <span className="checkbox-label">
                    {opt.label} <span className="checkbox-count-badge">({opt.count})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accordion 3: MỨC GIÁ */}
      <div className="combo-accordion-section">
        <button
          type="button"
          className="combo-accordion-trigger"
          onClick={() => toggleSection('price')}
        >
          <span className="combo-accordion-title">Khoảng giá combo</span>
          <ChevronDown
            size={15}
            className={`combo-accordion-chevron ${openSections.price ? "is-open" : ""}`}
          />
        </button>
        {openSections.price && (
          <div className="combo-accordion-content">
            <div className="price-slider-box">
              <div className="price-labels-row">
                <span>{values.minPrice.toLocaleString('vi-VN')}đ</span>
                <span>
                  {values.maxPrice >= 5000000
                    ? '5.000.000đ+'
                    : `${values.maxPrice.toLocaleString('vi-VN')}đ`}
                </span>
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

              {/* Preset Buttons */}
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
        )}
      </div>
    </aside>
  );
};
