import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  ShoppingBag,
  Pencil,
  Eye,
  MoreVertical,
  Scissors,
  Camera,
  Play,
  Clock,
  Pause,
  Trash2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { getImageUrl } from '../../shared/mediaHelpers';
import { getComboDisplayStatus } from '../comboStatus';

interface ComboCardProps {
  combo: any;
  onEdit: (combo: any) => void;
  onDelete: (id: string) => Promise<void>;
}

export const ComboCard: React.FC<ComboCardProps> = ({ combo, onEdit, onDelete }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const prod = combo.productId;
  const pkg = combo.photographyPackageId;

  // Price calculation
  const originalPrice = (prod?.basePrice || 0) + (pkg?.price || 0);
  const discountedPrice = combo.comboPrice
    ? combo.comboPrice
    : Math.round(originalPrice * (1 - (combo.discountPercent || 0) / 100));
  const savedAmount = Math.max(0, originalPrice - discountedPrice);

  const discountPercent =
    combo.discountPercent ||
    (originalPrice > 0 ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : 0);

  const prodImg = prod?.images?.[0] ? getImageUrl(prod.images[0]) : '';
  const pkgImg = pkg?.images?.[0] ? getImageUrl(pkg.images[0]) : '';

  const formatShortDate = (d?: string) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return d;
    }
  };

  const displayStatus = getComboDisplayStatus(combo);
  const statusType = displayStatus.kind;
  const statusText = displayStatus.text;
  const StatusIcon =
    statusType === 'active' ? Play
      : statusType === 'expiring' || statusType === 'scheduled' || statusType === 'pending' ? Clock
        : statusType === 'changes' ? AlertTriangle
          : statusType === 'rejected' ? XCircle
            : Pause;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleOpenPublicView = () => {
    if (!displayStatus.isPubliclyVisible) return;
    window.open(`/combos/${combo._id || combo.id}`, '_blank');
  };

  return (
    <div className="cb-row-card">
      {/* Upper/Main Flex Row */}
      <div className="cb-card-main-row">
        {/* 1. Dual Image Pair */}
        <div className="cb-dual-thumb-wrap">
          {discountPercent > 0 && (
            <span className="cb-ribbon-discount">-{discountPercent}%</span>
          )}
          <div className="cb-thumb-slot">
            {prodImg ? (
              <img src={prodImg} alt={prod?.name || 'Áo dài'} loading="lazy" />
            ) : (
              <div className="cb-thumb-slot empty">
                <Scissors size={14} />
              </div>
            )}
          </div>
          <div className="cb-thumb-slot">
            {pkgImg ? (
              <img src={pkgImg} alt={pkg?.name || 'Gói chụp'} loading="lazy" />
            ) : (
              <div className="cb-thumb-slot empty">
                <Camera size={14} />
              </div>
            )}
          </div>
        </div>

        {/* 2. Title & Details */}
        <div className="cb-col-info">
          <h4 className="cb-row-title" title={combo.name}>
            {combo.name || 'Combo chưa đặt tên'}
          </h4>
          <p className="cb-row-desc">
            {combo.description || 'Chưa có mô tả quyền lợi cho combo này.'}
          </p>
          <div className="cb-row-chips cb-chips-desktop">
            <span className="cb-row-chip" title={prod?.name}>
              <Scissors size={11} />
              {prod?.name || 'Áo dài'}
            </span>
            <span className="cb-row-chip" title={pkg?.name}>
              <Camera size={11} />
              {pkg?.name || 'Gói chụp'}
            </span>
          </div>
        </div>

        {/* 3. Price Column (Desktop) */}
        <div className="cb-col-price cb-price-desktop">
          {originalPrice > discountedPrice && (
            <span className="cb-price-old">{originalPrice.toLocaleString('vi-VN')}đ</span>
          )}
          <span className="cb-price-new">{discountedPrice.toLocaleString('vi-VN')}đ</span>
          {savedAmount > 0 && (
            <span className="cb-tag-saved">Tiết kiệm {savedAmount.toLocaleString('vi-VN')}đ</span>
          )}
        </div>

        {/* 4. Meta Column (Date & Stock - Desktop) */}
        <div className="cb-col-meta cb-meta-desktop">
          <div className="cb-meta-item">
            <Calendar size={12} />
            <span>
              {combo.validFrom || combo.validTo
                ? `${formatShortDate(combo.validFrom) || '...'} - ${formatShortDate(combo.validTo) || '...'}`
                : 'Không giới hạn ngày'}
            </span>
          </div>
          <div className="cb-meta-item">
            <ShoppingBag size={12} />
            <span>
              Đã bán {combo.usedCount || 0}/{combo.maxUsage || '∞'}
            </span>
          </div>
        </div>

        {/* 5. Status & Actions Container */}
        <div className="cb-status-actions-cluster">
          {/* Status Pill */}
          <div className="cb-col-status">
            <span className={`cb-status-pill ${statusType}`}>
              <StatusIcon size={12} />
              <span>{statusText}</span>
            </span>
          </div>

          {/* Actions */}
          <div className="cb-col-actions" ref={dropdownRef}>
            <button
              type="button"
              className="cb-btn-edit-pill"
              onClick={() => onEdit(combo)}
              title="Chỉnh sửa combo"
            >
              <Pencil size={12} />
              <span>Sửa</span>
            </button>

            <button
              type="button"
              className="cb-btn-view-pill"
              onClick={handleOpenPublicView}
              disabled={!displayStatus.isPubliclyVisible}
              title={displayStatus.isPubliclyVisible
                ? 'Xem trang công khai'
                : 'Combo chỉ có thể xem công khai sau khi được duyệt và có hiệu lực'}
            >
              <Eye size={12} />
              <span>Xem</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="cb-btn-more-pill"
                onClick={() => setShowDropdown(!showDropdown)}
                title="Thêm thao tác"
              >
                <MoreVertical size={14} />
              </button>

              {showDropdown && (
                <div className="cb-actions-dropdown">
                  <button
                    type="button"
                    className="cb-dropdown-item danger"
                    onClick={() => {
                      setShowDropdown(false);
                      onDelete(combo._id || combo.id);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa combo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-row for Compact/Drawer-Open state (prevents any truncation) */}
      <div className="cb-card-sub-row">
        <div className="cb-row-chips cb-chips-compact">
          <span className="cb-row-chip" title={prod?.name}>
            <Scissors size={11} />
            {prod?.name || 'Áo dài'}
          </span>
          <span className="cb-row-chip" title={pkg?.name}>
            <Camera size={11} />
            {pkg?.name || 'Gói chụp'}
          </span>
        </div>

        <div className="cb-compact-meta-group">
          <div className="cb-col-price cb-price-compact">
            {originalPrice > discountedPrice && (
              <span className="cb-price-old">{originalPrice.toLocaleString('vi-VN')}đ</span>
            )}
            <span className="cb-price-new">{discountedPrice.toLocaleString('vi-VN')}đ</span>
            {savedAmount > 0 && (
              <span className="cb-tag-saved">Tiết kiệm {savedAmount.toLocaleString('vi-VN')}đ</span>
            )}
          </div>

          <div className="cb-col-meta cb-meta-compact">
            <span className="cb-meta-item">
              <Calendar size={12} />
              {combo.validFrom || combo.validTo
                ? `${formatShortDate(combo.validFrom) || '...'} - ${formatShortDate(combo.validTo) || '...'}`
                : 'Vô thời hạn'}
            </span>
            <span className="cb-meta-item">
              <ShoppingBag size={12} />
              Đã bán {combo.usedCount || 0}/{combo.maxUsage || '∞'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
