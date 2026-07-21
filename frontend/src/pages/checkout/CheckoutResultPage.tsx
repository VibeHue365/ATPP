import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Home, ShoppingBag, ArrowRight } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { useCart } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';

type State = 'PENDING' | 'SUCCESS' | 'FAILED' | 'ERROR';
type Result = {
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  bookingStatus: string;
  confirmed: boolean;
};

const CheckoutResultPage: React.FC = () => {
  const [params] = useSearchParams();
  const code = params.get('paymentCode') || '';
  const { removeFromCart } = useCart();
  const [state, setState] = useState<State>('PENDING');
  const [message, setMessage] = useState('Đang xác minh giao dịch của bạn...');

  const verify = useCallback(async () => {
    if (!code) {
      setState('ERROR');
      setMessage('Không tìm thấy mã giao dịch để xác minh thanh toán.');
      return true;
    }
    try {
      const data = await httpClient.get<Result>(`/payments/${encodeURIComponent(code)}/status`);
      if (data.paymentStatus === 'SUCCESS' && data.confirmed) {
        const key = `vh_pending_checkout_${code}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const pending = JSON.parse(raw) as { cartItemIds?: string[] };
            pending.cartItemIds?.forEach(removeFromCart);
          } finally {
            localStorage.removeItem(key);
          }
        }
        setState('SUCCESS');
        setMessage('Giao dịch đã được xác nhận. Đơn hàng của bạn đã sẵn sàng!');
        return true;
      }
      if (['FAILED', 'CANCELLED'].includes(data.paymentStatus) || data.bookingStatus === 'CANCELLED') {
        setState('FAILED');
        setMessage('Thanh toán không thành công hoặc phiên giao dịch đã bị hủy bỏ.');
        return true;
      }
      setState('PENDING');
      setMessage('Hệ thống đang đối soát dữ liệu với ngân hàng PayOS...');
      return false;
    } catch (error) {
      setState('ERROR');
      setMessage(error instanceof Error ? error.message : 'Lỗi kết nối đối soát cổng thanh toán.');
      return true;
    }
  }, [code, removeFromCart]);

  useEffect(() => {
    let stopped = false;
    let count = 0;
    const poll = async () => {
      const done = await verify();
      count += 1;
      if (!stopped && !done && count < 30) {
        window.setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => {
      stopped = true;
    };
  }, [verify]);

  const renderContent = () => {
    switch (state) {
      case 'PENDING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <Loader2 size={80} style={{ color: '#D97706', animation: 'spin 1.5s linear infinite' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '24px', fontWeight: 750, color: '#1F2937', margin: '10px 0 4px' }}>
              Đang xác minh thanh toán
            </h2>
            <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
              {message}
            </p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
              Vui lòng không tắt trình duyệt hoặc tải lại trang lúc này.
            </p>
          </div>
        );

      case 'SUCCESS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              backgroundColor: '#ECFDF5', 
              display: 'grid', 
              placeItems: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)'
            }}>
              <CheckCircle2 size={48} style={{ color: '#10B981' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '26px', fontWeight: 800, color: '#10B981', margin: '10px 0 4px' }}>
              Thanh Toán Thành Công!
            </h2>
            <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
              Cảm ơn bạn đã lựa chọn VibeHue. Đơn thuê áo dài và lịch hẹn chụp ảnh của bạn đã được ghi nhận trên hệ thống.
            </p>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              width: '100%', 
              marginTop: '15px', 
              padding: '16px', 
              backgroundColor: '#F9FAFB', 
              borderRadius: '12px', 
              border: '1px solid #F3F4F6',
              fontSize: '13px',
              color: '#6B7280',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mã giao dịch:</span>
                <strong style={{ color: '#1F2937' }}>{code}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Trạng thái đơn:</span>
                <strong style={{ color: '#10B981' }}>ĐÃ XÁC NHẬN (PAID)</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '20px' }}>
              <Link 
                to={ROUTES.PROFILE} 
                style={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px 24px', 
                  backgroundColor: '#8B1E22', 
                  color: 'white', 
                  textDecoration: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(139, 30, 34, 0.2)',
                  transition: 'all 0.2s ease'
                }}
              >
                Xem đơn hàng <ArrowRight size={16} />
              </Link>
              <Link 
                to="/" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px 20px', 
                  border: '1px solid #E5E7EB', 
                  color: '#4B5563', 
                  textDecoration: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease'
                }}
              >
                <Home size={16} /> Trang chủ
              </Link>
            </div>
          </div>
        );

      case 'FAILED':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              backgroundColor: '#FEF2F2', 
              display: 'grid', 
              placeItems: 'center',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)'
            }}>
              <XCircle size={48} style={{ color: '#EF4444' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '26px', fontWeight: 800, color: '#EF4444', margin: '10px 0 4px' }}>
              Thanh Toán Thất Bại
            </h2>
            <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
              Giao dịch thanh toán không thành công hoặc bạn đã hủy bỏ thanh toán. Đừng lo lắng, giỏ hàng của bạn vẫn được lưu giữ.
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '20px' }}>
              <Link 
                to={ROUTES.CART} 
                style={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px 24px', 
                  backgroundColor: '#8B1E22', 
                  color: 'white', 
                  textDecoration: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(139, 30, 34, 0.2)'
                }}
              >
                <ShoppingBag size={16} /> Quay lại giỏ hàng
              </Link>
              <Link 
                to="/" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px 20px', 
                  border: '1px solid #E5E7EB', 
                  color: '#4B5563', 
                  textDecoration: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <Home size={16} /> Trang chủ
              </Link>
            </div>
          </div>
        );

      case 'ERROR':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              backgroundColor: '#FFFBEB', 
              display: 'grid', 
              placeItems: 'center',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.15)'
            }}>
              <AlertTriangle size={48} style={{ color: '#F59E0B' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '24px', fontWeight: 800, color: '#F59E0B', margin: '10px 0 4px' }}>
              Lỗi Xác Minh Giao Dịch
            </h2>
            <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '20px' }}>
              <button 
                onClick={() => void verify()} 
                style={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px 24px', 
                  backgroundColor: '#8B1E22', 
                  color: 'white', 
                  border: 'none',
                  borderRadius: '8px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(139, 30, 34, 0.2)'
                }}
              >
                Thử lại ngay
              </button>
              <Link 
                to="/" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px 20px', 
                  border: '1px solid #E5E7EB', 
                  color: '#4B5563', 
                  textDecoration: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <Home size={16} /> Trang chủ
              </Link>
            </div>
          </div>
        );
    }
  };

  return (
    <main style={{ 
      minHeight: '80vh', 
      display: 'grid', 
      placeItems: 'center', 
      padding: '40px 20px',
      backgroundColor: '#FAF9F6'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <section style={{ 
        width: '100%',
        maxWidth: '520px', 
        padding: '48px 36px', 
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '20px',
        boxShadow: '0 10px 30px rgba(45, 41, 38, 0.05)',
        border: '1px solid #EAEAE8'
      }}>
        {renderContent()}
      </section>
    </main>
  );
};

export default CheckoutResultPage;
