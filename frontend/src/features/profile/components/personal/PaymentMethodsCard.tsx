import React from 'react';
import { CreditCard, QrCode, ShieldCheck } from 'lucide-react';

export const PaymentMethodsCard: React.FC = () => {
  return (
    <div className="lume-form-card">
      <div className="lume-form-card-header">
        <h3 className="lume-form-card-title">Phương thức thanh toán</h3>
        <p className="lume-form-card-subtitle">Cổng thanh toán & bảo mật giao dịch trực tuyến</p>
      </div>

      <div className="lume-payment-methods-list">
        {/* Method 1: VietQR */}
        <div className="lume-payment-method-item">
          <div className="lume-payment-method-left">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h4 className="lume-payment-card-title">Chuyển khoản VietQR</h4>
              <p className="lume-payment-card-expiry">Quét mã QR tự động qua mọi App ngân hàng</p>
            </div>
          </div>
          <span className="lume-payment-default-badge" style={{ backgroundColor: '#ECFDF5', color: '#047857' }}>
            Khuyên dùng
          </span>
        </div>

        {/* Method 2: ATM / Visa */}
        <div className="lume-payment-method-item">
          <div className="lume-payment-method-left">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#FDF2F4',
                color: '#8B1E2D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h4 className="lume-payment-card-title">Thẻ ATM / Visa / Mastercard</h4>
              <p className="lume-payment-card-expiry">Cổng thanh toán bảo mật PayOS 256-bit</p>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#8C827A', fontWeight: 600 }}>
            Sẵn sàng
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          backgroundColor: '#FCFAF7',
          borderRadius: '8px',
          border: '1px solid #ECE5DB',
          fontSize: '11.5px',
          color: '#574D4F'
        }}
      >
        <ShieldCheck size={16} color="#047857" style={{ flexShrink: 0 }} />
        <span>Giao dịch cọc và thanh toán được bảo hộ an toàn qua cổng ngân hàng.</span>
      </div>
    </div>
  );
};
