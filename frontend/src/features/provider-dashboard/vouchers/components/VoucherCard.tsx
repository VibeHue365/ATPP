import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Edit3,
  Percent,
  Tag,
  Ticket,
  Trash2
} from 'lucide-react';
import '../vouchersFigma.css';

interface VoucherCardProps {
  voucher: any;
  onEdit?: (voucher: any) => void;
  onDelete?: (id: string) => void;
  previewOnly?: boolean;
}

export const VoucherCard: React.FC<VoucherCardProps> = ({
  voucher,
  onEdit,
  onDelete,
  previewOnly = false,
}) => {
  const [copied, setCopied] = useState(false);

  const now = Date.now();
  const vId = voucher._id || voucher.id || 'preview';
  const code = (voucher.code || 'CODE').toUpperCase();
  const name = voucher.name || 'Tên chương trình ưu đãi';
  const desc = voucher.description || '';
  const discountType = voucher.discountType || 'PERCENTAGE';
  const discountValue = Number(voucher.discountValue) || 0;
  const minOrderValue = Number(voucher.minOrderValue) || 0;
  const maxDiscountAmount = voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null;
  const usageLimit = voucher.usageLimit ? Number(voucher.usageLimit) : null;
  const usedCount = Number(voucher.usedCount) || 0;

  const startDate = voucher.startDate ? new Date(voucher.startDate) : null;
  const endDate = voucher.endDate ? new Date(voucher.endDate) : null;

  // Compute status
  const isDepleted = usageLimit !== null && usedCount >= usageLimit;
  const isExpired = endDate ? endDate.getTime() < now : false;
  const isExpiring =
    endDate && !isExpired && endDate.getTime() - now <= 7 * 86400000;
  const isPendingStart = startDate ? startDate.getTime() > now : false;

  let statusKey: 'active' | 'expiring' | 'depleted' | 'expired' = 'active';
  let statusLabel = 'Đang diễn ra';

  if (isExpired) {
    statusKey = 'expired';
    statusLabel = 'Đã hết hạn';
  } else if (isDepleted) {
    statusKey = 'depleted';
    statusLabel = 'Hết lượt dùng';
  } else if (isExpiring) {
    statusKey = 'expiring';
    statusLabel = 'Sắp hết hạn';
  } else if (isPendingStart) {
    statusKey = 'expiring';
    statusLabel = 'Sắp diễn ra';
  }

  // Format discount value display
  const isPercentage = discountType === 'PERCENTAGE';
  const displayDiscount = isPercentage
    ? `${discountValue}%`
    : discountValue >= 1000000
    ? `${(discountValue / 1000000).toFixed(discountValue % 1000000 === 0 ? 0 : 1)}Tr`
    : discountValue >= 1000
    ? `${discountValue / 1000}K`
    : `${discountValue}đ`;

  // Usage percentage
  const usagePercent = usageLimit ? Math.min(100, Math.round((usedCount / usageLimit) * 100)) : 0;
  const usageColorClass = usagePercent > 90 ? 'red' : usagePercent >= 70 ? 'amber' : 'green';

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewOnly) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const formatDate = (d: Date | null) => {
    if (!d) return '--/--/----';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className={`vc-ticket-card ${previewOnly ? 'preview-mode' : ''}`}>
      {/* 1. LEFT STUB (Cuống vé) */}
      <div
        className={`vc-left-stub ${
          !isPercentage ? 'fixed-discount' : ''
        } ${statusKey === 'expired' || statusKey === 'depleted' ? 'expired' : ''}`}
      >
        <span className="vc-stub-discount-value">
          {displayDiscount}
        </span>
        <span className="vc-stub-discount-type">
          {isPercentage ? 'Giảm %' : 'Giảm tiền mặt'}
        </span>
        <span className="vc-stub-min-order">
          {minOrderValue > 0
            ? `Đơn từ ${(minOrderValue / 1000).toLocaleString('vi-VN')}K`
            : 'Đơn từ 0đ'}
        </span>
      </div>

      {/* Semicircular notches at the boundary */}
      <div className="vc-notch-top" aria-hidden="true" />
      <div className="vc-notch-bottom" aria-hidden="true" />

      {/* Dashed vertical separator line */}
      <div className="vc-dashed-divider" aria-hidden="true" />

      {/* 2. RIGHT BODY (Thân vé) */}
      <div className="vc-right-body">
        {/* Top row: Code + Status Badge */}
        <div className="vc-card-top-row">
          <div className="vc-code-badge-wrap">
            <span className="vc-code-badge">
              <Ticket size={13} />
              {code}
            </span>

            {!previewOnly && (
              <button
                type="button"
                className={`vc-btn-copy-code ${copied ? 'copied' : ''}`}
                onClick={handleCopyCode}
                title="Sao chép mã voucher"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
              </button>
            )}
          </div>

          <span className={`vc-status-badge ${statusKey}`}>
            {statusKey === 'active' && <span className="vc-dot-active" />}
            {statusKey === 'expiring' && <span className="vc-dot-expiring" />}
            {statusKey === 'expired' && <span className="vc-dot-expired" />}
            {statusLabel}
          </span>
        </div>

        {/* Voucher Title */}
        <h4 className="vc-card-title">{name}</h4>
        {desc && <p className="vc-card-desc">{desc}</p>}

        {/* Conditions Meta Tags */}
        <div className="vc-meta-tags-row">
          {minOrderValue > 0 && (
            <span className="vc-meta-tag">
              <Tag size={11} color="#881337" />
              Đơn tối thiểu: {minOrderValue.toLocaleString('vi-VN')}đ
            </span>
          )}

          {isPercentage && maxDiscountAmount && maxDiscountAmount > 0 && (
            <span className="vc-meta-tag">
              <Percent size={11} color="#B45309" />
              Tối đa: {maxDiscountAmount.toLocaleString('vi-VN')}đ
            </span>
          )}

          <span className="vc-meta-tag">
            <Calendar size={11} color="#78716C" />
            {startDate && endDate
              ? `${formatDate(startDate)} - ${formatDate(endDate)}`
              : 'Vô thời hạn'}
          </span>
        </div>

        {/* Usage Progress Track */}
        {usageLimit !== null && (
          <div className="vc-usage-box">
            <div className="vc-usage-text-row">
              <span>Đã dùng: <strong>{usedCount} / {usageLimit}</strong> lượt</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="vc-usage-track">
              <div
                className={`vc-usage-fill ${usageColorClass}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions Row */}
        {!previewOnly && (
          <div className="vc-card-actions-row">
            {onEdit && (
              <button
                type="button"
                className="vc-btn-action edit"
                onClick={() => onEdit(voucher)}
              >
                <Edit3 size={13} />
                <span>Chỉnh sửa</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="vc-btn-action delete"
                onClick={() => onDelete(vId)}
                title="Xóa voucher"
              >
                <Trash2 size={13} />
                <span>Xóa</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
