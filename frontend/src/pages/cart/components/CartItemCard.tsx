import React from 'react';
import { Trash2, Sparkles, Pencil, Calendar } from 'lucide-react';
import type { EnrichedCartItem } from '../types';
import { CustomCheckbox } from './CustomCheckbox';
import { formatDateRange, formatSingleDate, getDayMonth } from '../utils/cartCalculations';

interface CartItemCardProps {
  item: EnrichedCartItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  itemStocks: Record<string, number>;
  groupType: 'SUCCESS' | 'MISMATCH' | 'OTHERS';
  groupSyncDate?: string;
  onQuantityChange: (qty: number) => void;
  editComponent?: React.ReactNode;
}

export const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onRemove,
  isEditing,
  onToggleEdit,
  itemStocks,
  groupType,
  groupSyncDate,
  onQuantityChange,
  editComponent,
}) => {
  const itemName =
    item.itemType === 'PRODUCT'
      ? item.productName || item.name
      : `${item.photographerName} | ${item.packageName}`;

  const itemImage =
    item.itemType === 'PRODUCT'
      ? item.productImage || item.image
      : item.photographerAvatar;

  const isRentalProduct = item.itemType === 'PRODUCT' && (item.rentalFrom || item.startDate);

  return (
    <div className="vh-cart-item-card">
      {/* Checkbox */}
      <CustomCheckbox checked={isSelected} onChange={onToggleSelect} />

      {/* Item Thumbnail */}
      {isRentalProduct ? (
        <img
          src={
            itemImage ||
            'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600'
          }
          alt={itemName || ''}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=600';
          }}
          className="vh-cart-item-thumbnail"
        />
      ) : item.itemType === 'PHOTOGRAPHY_PACKAGE' ? (
        <img
          src={
            itemImage ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200'
          }
          alt={itemName || ''}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200';
          }}
          className="vh-cart-item-thumbnail"
        />
      ) : (
        <div className="vh-cart-item-ai-box">
          <Sparkles size={32} />
        </div>
      )}

      {/* Item Details */}
      <div className="vh-cart-item-info">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <h3
            className="font-header vh-cart-item-title"
          >
            {itemName}
          </h3>

          <button
            onClick={onRemove}
            className="vh-cart-item-delete"
            title="Xóa"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Specific text fields */}
        <div className="vh-cart-item-specs">
          {isRentalProduct ? (
            <>
              {isEditing ? (
                editComponent
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span>
                      Kích cỡ: <strong>{item.size}</strong>{' '}
                      {item.color && (
                        <>
                          {' '}
                          • Màu: <strong>{item.color}</strong>
                        </>
                      )}
                    </span>
                    <span>
                      Ngày thuê:{' '}
                      <strong>
                        {formatDateRange(
                          item.rentalFrom || item.startDate,
                          item.rentalTo || item.endDate,
                        )}
                        {item.startTime && item.endTime
                          ? ` (${item.startTime} - ${item.endTime})`
                          : ''}
                      </strong>
                    </span>
                    <span>
                      Nơi nhận: <strong>{item.providerCity || 'Thừa Thiên Huế'}</strong>
                    </span>
                    {itemStocks[item.id] !== undefined && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#8B1E22',
                          fontWeight: 600,
                          marginTop: '2px',
                        }}
                      >
                        (Còn lại {itemStocks[item.id]} sản phẩm trong kho)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={onToggleEdit}
                    title="Chỉnh sửa kích cỡ & lịch thuê"
                    className="vh-cart-item-edit-btn"
                  >
                    <Pencil size={11} /> Sửa
                  </button>
                </div>
              )}
            </>
          ) : item.itemType === 'PHOTOGRAPHY_PACKAGE' ? (
            <>
              <span>
                Địa điểm chụp: <strong>{item.shootLocation}</strong>
              </span>
              <span>
                Khu vực hoạt động: <strong>{item.photographerCity || 'Thừa Thiên Huế'}</strong>
              </span>
              <span>
                Ngày chụp:{' '}
                <strong>
                  {formatSingleDate(item.shootDate)} ({item.shootTimeSlot})
                </strong>
              </span>
            </>
          ) : (
            <span>Tăng cường chi tiết gấm silk & ánh sáng chân thực cho 10 ảnh.</span>
          )}
        </div>

        {/* Price and Quantity Selector */}
        <div className="vh-cart-item-price-qty-row">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#8B1E22' }}>
              {item.basePrice?.toLocaleString('vi-VN')}đ
            </span>
            {item.originalPrice && item.originalPrice > (item.basePrice || 0) && (
              <span
                style={{
                  fontSize: '13px',
                  textDecoration: 'line-through',
                  color: '#9C9C9C',
                  fontWeight: 500,
                }}
              >
                {item.originalPrice.toLocaleString('vi-VN')}đ
              </span>
            )}
          </div>

          {/* Premium Quantity Selector */}
          <div className="vh-cart-quantity-box">
            <button
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="vh-cart-quantity-btn"
            >
              -
            </button>
            <span className="vh-cart-quantity-val">{item.quantity}</span>
            <button
              onClick={() => onQuantityChange(item.quantity + 1)}
              disabled={item.quantity >= (itemStocks[item.id] ?? 999)}
              className="vh-cart-quantity-btn"
              style={{ opacity: item.quantity >= (itemStocks[item.id] ?? 999) ? 0.3 : 1 }}
            >
              +
            </button>
          </div>
        </div>

        {/* Special Badges */}
        {item.itemType === 'PRODUCT' && (item.depositAmount || 0) > 0 && (
          <div style={{ marginTop: '8px' }}>
            <span
              style={{
                backgroundColor: '#F7F2EC',
                color: '#8C7355',
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'inline-block',
              }}
            >
              Tiền cọc: {item.depositAmount?.toLocaleString('vi-VN')}đ (Hoàn trả khi nhận đồ)
            </span>
          </div>
        )}

        {item.itemType === 'PHOTOGRAPHY_PACKAGE' && groupType === 'SUCCESS' && (
          <div style={{ marginTop: '8px' }}>
            <span
              style={{
                backgroundColor: '#EAF7EE',
                color: '#27AE60',
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Calendar size={12} />
              Lịch trình khớp với Áo dài ({getDayMonth(groupSyncDate)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartItemCard;
