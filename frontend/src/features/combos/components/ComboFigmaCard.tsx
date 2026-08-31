import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, Users } from 'lucide-react';
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

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'red':
        return 'badge-red';
      case 'navy':
        return 'badge-navy';
      case 'brown':
        return 'badge-brown';
      case 'gold':
        return 'badge-gold';
      case 'pink':
        return 'badge-pink';
      case 'purple':
        return 'badge-purple';
      case 'green':
        return 'badge-green';
      default:
        return 'badge-dark';
    }
  };

  return (
    <div
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
        <div className={`figma-combo-card-badge ${getBadgeClass(combo.badge.type)}`}>
          {combo.badge.text}
        </div>

        {/* Favorite Heart on Top-Right */}
        <button
          type="button"
          className="figma-combo-card-favorite-btn"
          onClick={handleToggleFavorite}
          aria-label="Lưu vào yêu thích"
        >
          <Heart
            size={16}
            fill={isFavorite ? '#8B1E2D' : 'none'}
            color={isFavorite ? '#8B1E2D' : '#8C827A'}
          />
        </button>
      </div>

      {/* Card Body */}
      <div className="figma-combo-card-body">
        {/* Meta Row: Location & People */}
        <div className="figma-combo-card-meta">
          <span className="meta-item">
            <MapPin size={11} className="meta-icon" /> {combo.location}
          </span>
          <span className="meta-dot">•</span>
          <span className="meta-item">
            <Users size={11} className="meta-icon" /> {combo.people}
          </span>
        </div>

        {/* Title */}
        <h3 className="figma-combo-card-title">{combo.title}</h3>

        {/* Components / Subtitle */}
        <p className="figma-combo-card-desc">{combo.description}</p>

        {/* Pricing & CTA Row */}
        <div className="figma-combo-card-footer">
          <div className="figma-combo-card-pricing">
            <span className="card-current-price">
              {combo.price.toLocaleString('vi-VN')}đ
            </span>
            <span className="card-old-price">
              {combo.oldPrice.toLocaleString('vi-VN')}đ
            </span>
          </div>

          <div className="figma-combo-card-action">
            <span className="card-savings-label">{combo.savingsText}</span>
            <button
              type="button"
              className="card-detail-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/combos/${combo.id}`);
              }}
            >
              Xem chi tiết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
