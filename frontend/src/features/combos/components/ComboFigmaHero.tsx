import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronDown, MapPin, Users, DollarSign, Search } from 'lucide-react';
import { ROUTES } from '../../../config/routes';

interface ComboFigmaHeroProps {
  maxDiscount?: number;
  region: string;
  onRegionChange: (region: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  peopleCount: string;
  onPeopleCountChange: (count: string) => void;
  budget: string;
  onBudgetChange: (budget: string) => void;
  onSearch: () => void;
}

export const ComboFigmaHero: React.FC<ComboFigmaHeroProps> = ({
  maxDiscount = 20,
  region,
  onRegionChange,
  date,
  onDateChange,
  peopleCount,
  onPeopleCountChange,
  budget,
  onBudgetChange,
  onSearch,
}) => {
  return (
    <div className="figma-combo-hero-wrapper">
      {/* Breadcrumb */}
      <nav className="figma-combo-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.LANDING} className="figma-combo-breadcrumb-link">
          Trang chủ
        </Link>
        <span className="figma-combo-breadcrumb-divider">|</span>
        <span className="figma-combo-breadcrumb-current">Combo</span>
      </nav>

      {/* Hero Header Body */}
      <div className="figma-combo-hero-top">
        {/* Left: Big Title & Subtitle */}
        <div className="figma-combo-hero-text">
          <h1 className="figma-combo-hero-title">Tất cả combo</h1>
          <p className="figma-combo-hero-subtitle">
            Khám phá các gói combo áo dài & chụp ảnh được yêu thích nhất
          </p>
        </div>

        {/* Right: Tilted Photo Cards & Circular Badge */}
        <div className="figma-combo-hero-visual">
          <div className="figma-combo-photo-stack">
            <div className="figma-combo-photo-card card-back">
              <img
                src="/images/hero-gam-moi-v2.webp"
                alt="Heritage Concept 2"
                className="figma-combo-photo-img"
              />
            </div>
            <div className="figma-combo-photo-card card-front">
              <img
                src="/images/hero-hue-heritage-v2.webp"
                alt="Heritage Concept 1"
                className="figma-combo-photo-img"
              />
            </div>
            {/* Circular Floating Badge */}
            <div className="figma-combo-circle-badge">
              <span className="badge-text-sub">Tiết kiệm đến</span>
              <span className="badge-text-main">{maxDiscount > 0 ? `${maxDiscount}%` : '20%'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating White Search Filter Bar */}
      <div className="figma-combo-search-bar-card">
        {/* Column 1: ĐỊA ĐIỂM */}
        <div className="figma-combo-search-field">
          <label className="figma-combo-search-label">
            <MapPin size={11} className="label-icon" /> ĐỊA ĐIỂM
          </label>
          <div className="figma-combo-select-wrapper">
            <select
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="figma-combo-select"
            >
              <option value="all">Tất cả khu vực</option>
              <option value="Huế">Huế</option>
              <option value="Đà Nẵng">Đà Nẵng</option>
              <option value="Hội An">Hội An</option>
              <option value="Đà Lạt">Đà Lạt</option>
              <option value="Hà Nội">Hà Nội</option>
              <option value="TP.HCM">TP.HCM</option>
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>

        {/* Column 2: NGÀY CHỤP */}
        <div className="figma-combo-search-field">
          <label className="figma-combo-search-label">
            <Calendar size={11} className="label-icon" /> NGÀY CHỤP
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="figma-combo-date-input"
            placeholder="dd/mm/yyyy"
          />
        </div>

        {/* Column 3: SỐ NGƯỜI */}
        <div className="figma-combo-search-field">
          <label className="figma-combo-search-label">
            <Users size={11} className="label-icon" /> SỐ NGƯỜI
          </label>
          <div className="figma-combo-select-wrapper">
            <select
              value={peopleCount}
              onChange={(e) => onPeopleCountChange(e.target.value)}
              className="figma-combo-select"
            >
              <option value="all">Không giới hạn</option>
              <option value="1">1 người (Cá nhân)</option>
              <option value="2">2 người (Cặp đôi)</option>
              <option value="3-4">3 - 4 người (Nhóm/Bạn bè)</option>
              <option value="5+">5+ người (Gia đình)</option>
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>

        {/* Column 4: NGÂN SÁCH */}
        <div className="figma-combo-search-field">
          <label className="figma-combo-search-label">
            <DollarSign size={11} className="label-icon" /> NGÂN SÁCH
          </label>
          <div className="figma-combo-select-wrapper">
            <select
              value={budget}
              onChange={(e) => onBudgetChange(e.target.value)}
              className="figma-combo-select"
            >
              <option value="all">Tất cả mức giá</option>
              <option value="under_2m">Dưới 2.000.000đ</option>
              <option value="2m_3m">2.000.000đ - 3.000.000đ</option>
              <option value="above_3m">Trên 3.000.000đ</option>
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>

        {/* Column 5: Nút Tìm Combo */}
        <div className="figma-combo-search-btn-wrapper">
          <button
            type="button"
            className="figma-combo-submit-btn"
            onClick={onSearch}
          >
            <Search size={15} />
            <span>Tìm combo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
