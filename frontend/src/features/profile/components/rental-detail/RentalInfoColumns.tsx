import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  Sparkles,
  Headphones,
  CheckCircle2
} from 'lucide-react';

interface RentalInfoColumnsProps {
  pickupDate?: string;
  pickupTime?: string;
  storeName?: string;
  storeAddress?: string;
  rentalPrice?: number;
  cleaningFee?: number;
  depositFee?: number;
  totalPrice?: number;
  paymentTime?: string;
  onOpenMap?: () => void;
  onGetDirections?: () => void;
  onViewInvoice?: () => void;
  onViewRules?: () => void;
}

export const RentalInfoColumns: React.FC<RentalInfoColumnsProps> = ({
  pickupDate = 'Chưa xác định',
  pickupTime = 'Theo giờ hẹn',
  storeName = 'Cửa hàng LUMÉ',
  storeAddress = 'TP. Huế',
  rentalPrice = 0,
  cleaningFee = 0,
  depositFee = 0,
  totalPrice = 0,
  paymentTime = 'Gần đây',
  onOpenMap,
  onGetDirections,
  onViewInvoice,
  onViewRules
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}
    >
      {/* 1. Card: Thông tin nhận & trả */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#231F20' }}>
            Thông tin nhận & trả
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Ngày nhận */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7D736B' }}>
                <Calendar size={15} />
                <span>Ngày nhận</span>
              </div>
              <strong style={{ color: '#231F20' }}>{pickupDate}</strong>
            </div>

            {/* Giờ nhận */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7D736B' }}>
                <Clock size={15} />
                <span>Giờ nhận</span>
              </div>
              <strong style={{ color: '#231F20' }}>{pickupTime}</strong>
            </div>

            {/* Địa điểm nhận trả */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#7D736B' }}>
                <MapPin size={15} />
                <span>Địa điểm nhận trả</span>
              </div>

              <div
                style={{
                  backgroundColor: '#FCFAF8',
                  border: '1px solid #F0ECE4',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <MapPin size={16} color="#8B1E2D" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 750, color: '#231F20' }}>{storeName}</div>
                  <div style={{ fontSize: '11.5px', color: '#7D736B', marginTop: '1px' }}>{storeAddress}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2 Buttons at Bottom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={onOpenMap}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#231F20',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8F5F1')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Xem bản đồ
          </button>
          <button
            type="button"
            onClick={onGetDirections}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              backgroundColor: '#8B1E2D',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#721824')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#8B1E2D')}
          >
            Chỉ đường
          </button>
        </div>
      </div>

      {/* 2. Card: Thông tin thanh toán */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#231F20' }}>
            Thông tin thanh toán
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7D736B' }}>
              <span>Giá thuê</span>
              <span style={{ color: '#231F20', fontWeight: 600 }}>{rentalPrice.toLocaleString('vi-VN')}đ</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7D736B' }}>
              <span>Phí vệ sinh</span>
              <span style={{ color: '#231F20', fontWeight: 600 }}>{cleaningFee.toLocaleString('vi-VN')}đ</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7D736B' }}>
              <span>Tiền cọc (Đã thanh toán)</span>
              <span style={{ color: '#231F20', fontWeight: 600 }}>{depositFee.toLocaleString('vi-VN')}đ</span>
            </div>

            <div style={{ borderTop: '1px dashed #ECE5DB', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#231F20' }}>Tổng thanh toán</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#8B1E2D' }}>
                {totalPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  fontSize: '11px',
                  fontWeight: 750
                }}
              >
                <CheckCircle2 size={12} />
                <span>Đã thanh toán</span>
              </span>
              <span style={{ fontSize: '11px', color: '#8C827A' }}>
                Thanh toán lúc {paymentTime}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewInvoice}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DED7CB',
            color: '#231F20',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8F5F1')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
        >
          Xem hóa đơn
        </button>
      </div>

      {/* 3. Card: Quy định thuê */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#231F20' }}>
            Quy định thuê
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#4A3F35' }}>
              <Sparkles size={14} color="#8B1E2D" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>Giữ áo cẩn thận, tránh làm bẩn và rách</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#4A3F35' }}>
              <AlertTriangle size={14} color="#C0392B" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>Không tự ý giặt ủi hoặc tẩy áo</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#4A3F35' }}>
              <Clock size={14} color="#B45309" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>Trả áo đúng hạn, quá hạn sẽ tính phí 50.000đ/ngày</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#4A3F35' }}>
              <Headphones size={14} color="#8B1E2D" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>Liên hệ ngay nếu có vấn đề phát sinh</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewRules}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DED7CB',
            color: '#231F20',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#F8F5F1')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
        >
          Xem chi tiết quy định
        </button>
      </div>
    </div>
  );
};
