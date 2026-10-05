import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Heart, MapPin, Sparkles, Users } from 'lucide-react';
import type { FigmaComboItem } from '../types/combo.types';

interface ComboFigmaCardProps {
  combo: FigmaComboItem;
}

export const ComboFigmaCard: React.FC<ComboFigmaCardProps> = ({ combo }) => {
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(combo.isFavorite || false);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <article
      className="figma-combo-card"
      onClick={() => navigate(`/combos/${combo.id}`)}
    >
      {/* Top Image Box */}
      <div className="figma-combo-card-image-box">
        <img
          src={combo.image}
          alt={combo.title}
          loading="lazy"
          className="figma-combo-card-image"
        />

        {/* Badge on Top-Left */}
        <div className="figma-combo-card-badge">
          {combo.badge.text}
        </div>

        {/* Favorite Heart on Top-Right */}
        <button
          type="button"
          className={`figma-combo-card-favorite-btn ${isFavorite ? 'active' : ''}`}
          onClick={handleToggleFavorite}
          aria-label="Lưu vào yêu thích"
        >
          <Heart
            size={15}
            fill={isFavorite ? '#8B1E2D' : 'none'}
            color={isFavorite ? '#8B1E2D' : '#5E5054'}
          />
        </button>
      </div>

      {/* Card Body */}
      <div className="figma-combo-card-body">
        {/* 1. Tên combo (đậm) */}
        <h3 className="figma-combo-card-title" title={combo.title}>
          {combo.title}
        </h3>

        {/* 2. Giá combo (nổi bật, đỏ rượu) */}
        <div className="figma-combo-price-row">
          <span className="card-current-price">
            {combo.price.toLocaleString('vi-VN')}đ
          </span>
          <span className="card-price-unit">/ combo</span>
          {combo.oldPrice > combo.price && (
            <span className="card-old-price">
              {combo.oldPrice.toLocaleString('vi-VN')}đ
            </span>
          )}
        </div>

        {/* 3. Lý do / Tiết kiệm (pill) */}
        <div className="combo-card-match-pill" title={combo.savingsText || 'Gói combo ưu đãi'}>
          <Sparkles size={11} className="combo-match-sparkle" />
          <span>{combo.savingsText || 'Tiết kiệm theo combo'}</span>
        </div>

        {/* 4. Đối tác / Địa điểm + Đã xác minh */}
        <div className="combo-card-shop-row">
          <span className="combo-shop-name" title={combo.location}>
            {combo.location}
          </span>
          <span className="combo-verified-badge">
            <Check size={11} /> Đã xác minh
          </span>
          <span className="combo-meta-dot">•</span>
          <span>{combo.people}</span>
        </div>
      </div>
    </article>
  );
};
