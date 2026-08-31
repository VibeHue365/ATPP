import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Camera,
  CreditCard,
  FileText,
  AlertTriangle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface PhotoshootInfoColumnsProps {
  shootDate?: string;
  shootTimeSlot?: string;
  locationName?: string;
  locationAddress?: string;
  photographerName?: string;
  photographerPhone?: string;
  packagePrice?: number;
  serviceFee?: number;
  depositFee?: number;
  totalPrice?: number;
  paymentTime?: string;
  isPaid?: boolean;
  onOpenMap?: () => void;
  onOpenLocationChange?: () => void;
  onViewInvoice?: () => void;
  onViewRules?: () => void;
}

export const PhotoshootInfoColumns: React.FC<PhotoshootInfoColumnsProps> = ({
  shootDate = 'Chưa xác định',
  shootTimeSlot = '09:00 - 11:00',
  locationName = 'Địa điểm chụp',
  locationAddress = 'Thành phố Huế',
  photographerName = 'Nhiếp ảnh gia LUMÉ',
  photographerPhone = '1900 9999',
  packagePrice = 0,
  serviceFee = 0,
  depositFee = 0,
  totalPrice = 0,
  paymentTime = 'Gần đây',
  isPaid = true,
  onOpenMap,
  onOpenLocationChange,
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
      {/* 1. Card 1: Địa điểm & Lịch hẹn */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calendar size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
              Thời gian & Địa điểm
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Clock size={15} color="#8C827A" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#231F20' }}>{shootDate}</strong>
                <div style={{ color: '#7D736B' }}>Khung giờ: {shootTimeSlot}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <MapPin size={15} color="#8C827A" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#231F20' }}>{locationName}</strong>
                <div style={{ color: '#7D736B', lineHeight: 1.4 }}>{locationAddress}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Camera size={15} color="#8C827A" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ color: '#7D736B' }}>Nhiếp ảnh gia: </span>
                <strong style={{ color: '#231F20' }}>{photographerName}</strong>
                {photographerPhone && (
                  <div style={{ color: '#7D736B' }}>Liên hệ: {photographerPhone}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          {onOpenMap && (
            <button
              type="button"
              onClick={onOpenMap}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#FCFAF8',
                border: '1px solid #ECE5DB',
                color: '#4A3F35',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <ExternalLink size={13} />
              <span>Chỉ đường</span>
            </button>
          )}

          {onOpenLocationChange && (
            <button
              type="button"
              onClick={onOpenLocationChange}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DED7CB',
                color: '#8B1E2D',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Đổi địa điểm
            </button>
          )}
        </div>
      </div>

      {/* 2. Card 2: Chi tiết thanh toán */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CreditCard size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
              Chi tiết chi phí
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#574D4F' }}>
              <span>Giá gói chụp:</span>
              <strong style={{ color: '#231F20' }}>{packagePrice.toLocaleString('vi-VN')}đ</strong>
            </div>

            {serviceFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#574D4F' }}>
                <span>Phụ phí dịch vụ / Makeup:</span>
                <span>{serviceFee.toLocaleString('vi-VN')}đ</span>
              </div>
            )}

            {depositFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#574D4F' }}>
                <span>Tiền cọc giữ lịch:</span>
                <span>{depositFee.toLocaleString('vi-VN')}đ</span>
              </div>
            )}

            <div
              style={{
                borderTop: '1px dashed #ECE5DB',
                paddingTop: '8px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 800,
                color: '#8B1E2D'
              }}
            >
              <span>Tổng thanh toán:</span>
              <span>{totalPrice.toLocaleString('vi-VN')}đ</span>
            </div>

            <div
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                color: isPaid ? '#047857' : '#B45309',
                fontWeight: 700
              }}
            >
              <ShieldCheck size={14} />
              <span>{isPaid ? `Đã thanh toán qua PayOS (${paymentTime})` : 'Chưa hoàn tất thanh toán'}</span>
            </div>
          </div>
        </div>

        {onViewInvoice && (
          <button
            type="button"
            onClick={onViewInvoice}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#FCFAF8',
              border: '1px solid #ECE5DB',
              color: '#4A3F35',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px'
            }}
          >
            <FileText size={13} />
            <span>Xem hóa đơn điện tử</span>
          </button>
        )}
      </div>

      {/* 3. Card 3: Lưu ý & Quy định buổi chụp */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#FFF7EE',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#231F20' }}>
              Lưu ý buổi chụp
            </h3>
          </div>

          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#574D4F', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>Có mặt tại điểm hẹn trước <strong>15 phút</strong> để chuẩn bị trang phục & makeup.</li>
            <li>Ảnh demo/ảnh gốc sẽ được gửi qua link Google Drive trong vòng <strong>24h - 48h</strong>.</li>
            <li>Khách hàng có <strong>48 giờ</strong> để xem và duyệt ảnh hoặc yêu cầu chỉnh sửa thêm.</li>
            <li>Được hỗ trợ dời lịch miễn phí trước <strong>24 giờ</strong> so với giờ hẹn.</li>
          </ul>
        </div>

        {onViewRules && (
          <button
            type="button"
            onClick={onViewRules}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#FCFAF8',
              border: '1px solid #ECE5DB',
              color: '#4A3F35',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Chính sách dịch vụ & Đổi lịch
          </button>
        )}
      </div>
    </div>
  );
};
