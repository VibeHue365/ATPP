import React, { useState } from 'react';
import { CreditCard } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositToPayNow: number;
  onConfirmPayment: () => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  depositToPayNow,
  onConfirmPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'BANK'>('BANK');

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      padding: '20px'
    }}>
      <div style={{ backgroundColor: 'white', maxWidth: '500px', width: '100%', padding: '32px', borderRadius: '16px', border: '1px solid #EAE1D4', boxShadow: 'var(--shadow-lg)' }}>
        <h3 className="font-header" style={{ fontSize: '22px', fontWeight: 700, color: '#8B1E22', marginBottom: '24px', textAlign: 'center' }}>
          Thanh toán đơn hàng
        </h3>

        {/* Payment Method Selector */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => setPaymentMethod('BANK')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '10px',
              border: paymentMethod === 'BANK' ? '2px solid #8B1E22' : '1px solid #EAE1D4',
              backgroundColor: paymentMethod === 'BANK' ? 'rgba(139, 30, 34, 0.03)' : 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CreditCard size={18} color={paymentMethod === 'BANK' ? '#8B1E22' : '#7E6D5B'} />
            <span>Chuyển khoản QR</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('MOMO')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '10px',
              border: paymentMethod === 'MOMO' ? '2px solid #8B1E22' : '1px solid #EAE1D4',
              backgroundColor: paymentMethod === 'MOMO' ? 'rgba(139, 30, 34, 0.03)' : 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: '#A50064', color: 'white', fontSize: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MoMo</div>
            <span>Ví điện tử MoMo</span>
          </button>
        </div>

        {/* QR Mockup */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backgroundColor: '#FCF9F2', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #EAE1D4' }}>
          <span style={{ fontSize: '13px', color: '#7E6D5B' }}>Mã QR quét thanh toán</span>
          <img
            src={paymentMethod === 'BANK'
              ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=STB_tiendat5604_VIBEHUE_PAY_${depositToPayNow}`
              : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Momo_0911122201_VIBEHUE_PAY_${depositToPayNow}`
            }
            alt="QR Code"
            style={{ width: '150px', height: '150px', backgroundColor: 'white', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)' }}
          />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#7E6D5B', display: 'block' }}>Số tiền cần chuyển:</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#8B1E22' }}>
              {depositToPayNow.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            className="vh-btn vh-btn-outline"
            style={{ flex: 1, borderRadius: '10px', padding: '10px', borderColor: '#EAE1D4', color: '#5D4037', cursor: 'pointer' }}
          >
            HỦY
          </button>
          <button
            type="button"
            onClick={onConfirmPayment}
            className="vh-btn vh-btn-primary"
            style={{ flex: 1, borderRadius: '10px', padding: '10px', backgroundColor: '#8B1E22', borderColor: '#8B1E22', cursor: 'pointer' }}
          >
            XÁC NHẬN ĐÃ CHUYỂN
          </button>
        </div>
      </div>
    </div>
  );
};
export default PaymentModal;
