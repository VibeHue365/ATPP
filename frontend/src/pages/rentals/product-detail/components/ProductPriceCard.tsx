import React from 'react';
import { MapPin, Shield } from 'lucide-react';
import type { ProductDetail } from '../types';

interface ProductPriceCardProps {
  product: ProductDetail;
  displayPrice: string;
}

export const ProductPriceCard: React.FC<ProductPriceCardProps> = ({
  product,
  displayPrice,
}) => {
  const providerAddress = product.providerId?.address;
  const addressFormatted = providerAddress
    ? `${providerAddress.addressLine}, ${providerAddress.ward ? providerAddress.ward + ', ' : ''}${providerAddress.district ? providerAddress.district + ', ' : ''}${providerAddress.city || ''}`
    : '45 Lê Lợi, Phú Hội, Thành phố Huế, Thừa Thiên Huế';

  return (
    <>
      {/* Price section */}
      <div className="vh-pd-price-card">
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          GIÁ THUÊ TẠM TÍNH
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <span className="vh-pd-price-display font-header">
            {displayPrice}
          </span>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Shield size={13} className="text-emerald-600" />
          <span>
            Tiền cọc đảm bảo hoàn trả:{' '}
            <strong>
              {product.depositAmount.toLocaleString('vi-VN')}đ
            </strong>
          </span>
        </p>
      </div>

      {/* Pickup Address Section */}
      <div className="vh-pd-pickup-box">
        <MapPin
          size={20}
          style={{
            color: 'var(--color-primary-dark)',
            flexShrink: 0,
            marginTop: '2px',
          }}
        />
        <div>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              fontWeight: 700,
              display: 'block',
              textTransform: 'uppercase',
            }}
          >
            Địa chỉ nhận đồ (Lấy tại cửa hàng)
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              display: 'block',
              marginTop: '2px',
            }}
          >
            {addressFormatted}
          </span>
          {product.providerId?.contact?.phone && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                display: 'block',
                marginTop: '4px',
              }}
            >
              SĐT liên hệ:{' '}
              <strong>{product.providerId.contact.phone}</strong>
            </span>
          )}
        </div>
      </div>
    </>
  );
};
