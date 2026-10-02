import React from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import type { ComboGroupEntry } from '../types';
import { CustomCheckbox } from './CustomCheckbox';
import { getImageUrl, formatSingleDate } from '../utils/cartCalculations';

interface CartComboCardProps {
  entry: ComboGroupEntry;
  selectedItemIds: string[];
  onToggleCombo: (entry: ComboGroupEntry, isSelected: boolean) => void;
  onRemoveCombo: (entry: ComboGroupEntry) => void;
}

export const CartComboCard: React.FC<CartComboCardProps> = ({
  entry,
  selectedItemIds,
  onToggleCombo,
  onRemoveCombo,
}) => {
  const isComboSelected = entry.items.every((i) => selectedItemIds.includes(i.id));

  return (
    <div className="vh-cart-combo-card">
      {/* Header */}
      <div className="vh-cart-combo-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CustomCheckbox
            checked={isComboSelected}
            onChange={() => onToggleCombo(entry, isComboSelected)}
          />
          <span className="vh-cart-combo-badge">
            <Sparkles size={13} fill="#FFF" /> GÓI COMBO TRỌN GÓI (GIẢM {entry.discountPct}%)
          </span>
        </div>
        <button
          onClick={() => onRemoveCombo(entry)}
          className="vh-cart-combo-delete-btn"
        >
          <Trash2 size={16} /> Xóa Combo
        </button>
      </div>

      {/* Items list inside Combo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {entry.items.map((item) => {
          const itemImage =
            item.itemType === 'PRODUCT'
              ? item.productImage || item.image
              : item.packageImage || item.photographerAvatar || item.image;

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: 'white',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #FEF3C7',
              }}
            >
              <img
                src={getImageUrl(itemImage)}
                alt={item.productName || item.packageName || ''}
                style={{
                  width: '70px',
                  height: '90px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B' }}>
                  {item.itemType === 'PRODUCT'
                    ? `Áo dài: ${item.productName || item.name}`
                    : `Gói chụp: ${item.photographerName} | ${item.packageName}`}
                </div>
                {item.itemType === 'PRODUCT' ? (
                  <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                    Kích cỡ: <strong style={{ color: '#8B1E22' }}>{item.size}</strong> • Màu:{' '}
                    <strong style={{ color: '#8B1E22' }}>{item.color}</strong> • Ngày thuê:{' '}
                    <strong>{formatSingleDate(item.rentalFrom || item.startDate)}</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                    Lịch chụp:{' '}
                    <strong style={{ color: '#8B1E22' }}>
                      {formatSingleDate(item.shootDate)} ({item.shootTimeSlot})
                    </strong>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer combo summary */}
      <div className="vh-cart-combo-footer">
        <div style={{ fontSize: '12.5px', color: '#64748B' }}>
          Giá gốc 2 món:{' '}
          <span style={{ textDecoration: 'line-through' }}>
            {entry.origTotal.toLocaleString('vi-VN')}đ
          </span>
          {entry.depositAmt > 0 && (
            <span style={{ marginLeft: '10px', color: '#D97706', fontWeight: 600 }}>
              (Cọc áo dài: +{entry.depositAmt.toLocaleString('vi-VN')}đ)
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '12px', color: '#8B1E22', fontWeight: 600 }}>
            Giá Combo ưu đãi:{' '}
          </span>
          <strong style={{ fontSize: '20px', color: '#8B1E22', fontWeight: 800 }}>
            {entry.comboPrice.toLocaleString('vi-VN')}đ
          </strong>
        </div>
      </div>
    </div>
  );
};

export default CartComboCard;
