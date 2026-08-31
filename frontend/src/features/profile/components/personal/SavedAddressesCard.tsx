import React, { useState, useEffect } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { httpClient } from '../../../../services/httpClient';

interface SavedAddressItem {
  id?: string;
  _id?: string;
  label?: string;
  tag?: string;
  recipientName?: string;
  phone?: string;
  addressLine?: string;
  ward?: string;
  district?: string;
  city?: string;
  detail?: string;
  isDefault?: boolean;
}

interface SavedAddressesCardProps {
  onViewAllAddresses: () => void;
}

export const SavedAddressesCard: React.FC<SavedAddressesCardProps> = ({
  onViewAllAddresses
}) => {
  const [addresses, setAddresses] = useState<SavedAddressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    httpClient
      .get<any[]>('/users/me/addresses')
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setAddresses(list);
      })
      .catch(() => {
        setAddresses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="lume-form-card">
      <div className="lume-form-card-header">
        <h3 className="lume-form-card-title">Địa chỉ của tôi</h3>
        <p className="lume-form-card-subtitle">Địa chỉ nhận & trả đồ đã lưu</p>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#8C827A', fontSize: '12.5px' }}>
          Đang tải địa chỉ...
        </div>
      ) : addresses.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            backgroundColor: '#FCFAF7',
            borderRadius: '12px',
            border: '1px dashed #E2DACF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <MapPin size={24} color="#C4B7A6" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#4A3F35' }}>
            Chưa có địa chỉ nào được lưu
          </span>
          <span style={{ fontSize: '11.5px', color: '#8C827A' }}>
            Thêm địa chỉ giao nhận để đặt lịch thuê áo nhanh hơn.
          </span>
          <button
            type="button"
            onClick={onViewAllAddresses}
            style={{
              marginTop: '6px',
              padding: '7px 14px',
              backgroundColor: '#8B1E2D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={13} />
            <span>Thêm địa chỉ mới</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {addresses.slice(0, 2).map((addr, idx) => {
            const displayAddress =
              addr.detail ||
              [addr.addressLine, addr.ward, addr.district, addr.city]
                .filter(Boolean)
                .join(', ') ||
              'Địa chỉ chưa cập nhật chi tiết';

            return (
              <div
                key={addr.id || addr._id || idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #ECE5DB',
                  backgroundColor: '#FCFAF7',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#231F20', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#8B1E2D" />
                    {addr.label || addr.tag || 'Địa chỉ'}
                  </span>
                  {addr.isDefault && (
                    <span className="lume-payment-default-badge" style={{ fontSize: '10.5px' }}>
                      Mặc định
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#574D4F', lineHeight: 1.4 }}>
                  {displayAddress}
                </p>
                {addr.phone && (
                  <span style={{ fontSize: '11px', color: '#8C827A' }}>SĐT: {addr.phone}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addresses.length > 0 && (
        <button
          type="button"
          onClick={onViewAllAddresses}
          className="lume-recent-orders-view-all-btn"
          style={{ marginTop: '4px' }}
        >
          Xem tất cả ({addresses.length}) địa chỉ
        </button>
      )}
    </div>
  );
};
