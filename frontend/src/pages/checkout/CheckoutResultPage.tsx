import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  const [message, setMessage] = useState('Đang xác minh thanh toán…');

  const verify = useCallback(async () => {
    if (!code) {
      setState('ERROR');
      setMessage('Thiếu mã giao dịch để xác minh.');
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
        setMessage('Thanh toán thành công. Lịch/đơn của bạn đã được xác nhận.');
        return true;
      }
      if (['FAILED', 'CANCELLED'].includes(data.paymentStatus) || data.bookingStatus === 'CANCELLED') {
        setState('FAILED');
        setMessage('Thanh toán không thành công hoặc đã hết hạn. Giỏ hàng của bạn vẫn được giữ.');
        return true;
      }
      setState('PENDING');
      setMessage('Đang xác minh thanh toán. Vui lòng chờ trong giây lát…');
      return false;
    } catch (error) {
      setState('ERROR');
      setMessage(error instanceof Error ? error.message : 'Không thể kiểm tra giao dịch.');
      return true;
    }
  }, [code, removeFromCart]);

  useEffect(() => {
    let stopped = false;
    let count = 0;
    const poll = async () => {
      const done = await verify();
      count += 1;
      if (!stopped && !done && count < 30) window.setTimeout(poll, 2000);
    };
    void poll();
    return () => { stopped = true; };
  }, [verify]);

  const failed = state === 'FAILED';
  const color = state === 'SUCCESS' ? '#15803d' : failed ? '#b91c1c' : '#8B1E22';
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ maxWidth: 560, padding: 36, textAlign: 'center' }}>
        <h1 style={{ color }}>{message}</h1>
        {(state === 'PENDING' || state === 'ERROR') &&
          <button onClick={() => void verify()}>Kiểm tra lại</button>}
        <Link to={failed ? ROUTES.CART : ROUTES.PROFILE}>
          {failed ? 'Quay lại giỏ hàng' : 'Xem đơn hàng'}
        </Link>
      </section>
    </main>
  );
};

export default CheckoutResultPage;
