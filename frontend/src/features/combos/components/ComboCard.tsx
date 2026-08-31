import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Scissors,
  Camera,
  Calendar,
  Users,
  ArrowRight,
  ShieldCheck,
  Star
} from 'lucide-react';
import type { ComboDeal } from '../types/combo.types';
import {
  calculateComboPricing,
  formatCurrency,
  resolveImageUrl,
  DEFAULT_AODAI_IMAGE_FALLBACK,
  DEFAULT_PACKAGE_IMAGE_FALLBACK
} from '../mappers/combo.mapper';

export interface ComboCardProps {
  combo: ComboDeal;
  index?: number;
}

export const ComboCard: React.FC<ComboCardProps> = ({ combo }) => {
  const navigate = useNavigate();
  const { originalPrice, discountedPrice, savingsAmount } = calculateComboPricing(combo);

  const aoDaiImg = resolveImageUrl(combo.productId?.images?.[0], DEFAULT_AODAI_IMAGE_FALLBACK);
  const packageImg = resolveImageUrl(combo.photographyPackageId?.images?.[0], DEFAULT_PACKAGE_IMAGE_FALLBACK);

  const maxUsage = combo.maxUsage || 0;
  const usedCount = combo.usedCount || 0;
  const remaining = maxUsage > 0 ? Math.max(0, maxUsage - usedCount) : null;

  const validDateStr = combo.validFrom && combo.validTo
    ? `${new Date(combo.validFrom).toLocaleDateString('vi-VN')} — ${new Date(combo.validTo).toLocaleDateString('vi-VN')}`
    : null;

  const handleCardClick = () => {
    navigate(`/combos/${combo._id}`);
  };

  return (
    <article
      className="lume-combo-card group"
      onClick={handleCardClick}
      aria-label={`Combo ${combo.name}`}
    >
      {/* Top Split Visual Container */}
      <div className="lume-combo-card-visual">
        {/* Split Images */}
        <div className="lume-combo-card-split-images">
          <div className="lume-combo-card-img-wrapper left">
            <img
              src={aoDaiImg}
              alt={combo.productId?.name || 'Trang phục áo dài'}
              loading="lazy"
              className="lume-combo-card-img"
            />
            <span className="lume-combo-card-img-tag">Áo dài</span>
          </div>

          <div className="lume-combo-card-split-divider" />

          <div className="lume-combo-card-img-wrapper right">
            <img
              src={packageImg}
              alt={combo.photographyPackageId?.name || 'Gói chụp ảnh'}
              loading="lazy"
              className="lume-combo-card-img"
            />
            <span className="lume-combo-card-img-tag">Chụp ảnh</span>
          </div>
        </div>

        {/* Discount Badge */}
        <div className="lume-combo-card-badge-discount">
          <Sparkles size={12} fill="currentColor" />
          <span>-{combo.discountPercent}%</span>
        </div>

        {/* Exclusive Type Badge */}
        <div className="lume-combo-card-badge-type">
          COMBO 2-IN-1
        </div>
      </div>

      {/* Card Content Area */}
      <div className="lume-combo-card-content">
        {/* Provider & Rating Row */}
        <div className="lume-combo-card-provider-row">
          <div className="lume-combo-card-provider-info">
            <span className="lume-combo-card-provider-name">
              {combo.providerId?.businessName || 'LUMÉ Partner Studio'}
            </span>
            <ShieldCheck size={14} color="#8B1E2D" className="lume-combo-card-verified-icon" />
          </div>

          {combo.providerId?.rating?.averageRating && (
            <div className="lume-combo-card-rating">
              <Star size={13} fill="#C28E3A" color="#C28E3A" />
              <span>{combo.providerId.rating.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Combo Title */}
        <h3 className="lume-combo-card-title" title={combo.name}>
          {combo.name}
        </h3>

        {/* Included Items Details */}
        <div className="lume-combo-card-items-list">
          {/* Ao Dai item */}
          <div className="lume-combo-card-item-row">
            <div className="lume-combo-card-item-icon">
              <Scissors size={13} />
            </div>
            <div className="lume-combo-card-item-text">
              <strong>Áo dài ({combo.aoDaiQuantity || 1} bộ):</strong>{' '}
              <span>{combo.productId?.name || 'Áo dài truyền thống'}</span>
            </div>
          </div>

          {/* Photoshoot item */}
          <div className="lume-combo-card-item-row">
            <div className="lume-combo-card-item-icon">
              <Camera size={13} />
            </div>
            <div className="lume-combo-card-item-text">
              <strong>Gói chụp ({combo.shootPeopleCount || 1} người):</strong>{' '}
              <span>
                {combo.photographyPackageId?.name || 'Chụp ảnh nghệ thuật'} •{' '}
                {combo.photographyPackageId?.durationHours || 1.5}h
              </span>
            </div>
          </div>
        </div>

        {/* Meta Bar: Dates & Remaining usage */}
        <div className="lume-combo-card-meta-bar">
          {validDateStr && (
            <div className="lume-combo-card-date">
              <Calendar size={12} />
              <span>HSD: {validDateStr}</span>
            </div>
          )}

          {remaining !== null && (
            <div className="lume-combo-card-slots">
              <Users size={12} />
              <span>Còn <strong>{remaining}</strong>/{maxUsage} suất</span>
            </div>
          )}
        </div>

        {/* Card Footer: Pricing & Action Button */}
        <div className="lume-combo-card-footer">
          <div className="lume-combo-card-pricing-block">
            <div className="lume-combo-card-price-row">
              <span className="lume-combo-card-new-price">
                {formatCurrency(discountedPrice)}
              </span>
              {originalPrice > discountedPrice && (
                <span className="lume-combo-card-old-price">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>

            {savingsAmount > 0 && (
              <span className="lume-combo-card-savings-tag">
                Tiết kiệm {formatCurrency(savingsAmount)}
              </span>
            )}
          </div>

          <button
            type="button"
            className="lume-combo-card-cta-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/combos/${combo._id}`);
            }}
          >
            <span>Đặt ngay</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
};
