import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Clock3, Home, LoaderCircle, RefreshCw, ShoppingBag, XCircle } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { useCart } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';
import './CheckoutResultPage.css';

type State = 'PENDING' | 'SUCCESS' | 'FAILED' | 'ERROR';
type Result = { paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'; bookingStatus: string; confirmed: boolean };
const CheckoutResultPage: React.FC = () => {
  const [params] = useSearchParams(), code = params.get('paymentCode') || '';
  const { removeFromCart } = useCart();
  const [state, setState] = useState<State>('PENDING');
  const [message, setMessage] = useState('Hệ thống đang xác minh giao dịch của bạn.');

  const verify = useCallback(async () => {
    if (!code) {
      setState('ERROR');
      setMessage('Không tìm thấy mã giao dịch để xác minh.');
      return true;
    }
    try {
      const data = await httpClient.get<Result>('/payments/' + encodeURIComponent(code) + '/status');
      if (data.paymentStatus === 'SUCCESS' && data.confirmed) {
        const key = 'vh_pending_checkout_' + code;
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            (JSON.parse(raw) as { cartItemIds?: string[] }).cartItemIds?.forEach(removeFromCart);
          } finally {
            localStorage.removeItem(key);
          }
        }
        setState('SUCCESS');
        setMessage('Đơn hàng đã được xác nhận và sẵn sàng trong tài khoản của bạn.');
        return true;
      }
      if (['FAILED', 'CANCELLED'].includes(data.paymentStatus) || data.bookingStatus === 'CANCELLED') {
        setState('FAILED');
        setMessage('Giao dịch chưa hoàn tất. Các sản phẩm vẫn được giữ nguyên trong giỏ hàng.');
        return true;
      }
      setState('PENDING');
      setMessage('Hệ thống đang xác minh giao dịch của bạn. Quá trình này chỉ mất ít phút.');
      return false;
    } catch (error) {
      setState('ERROR');
      setMessage(error instanceof Error ? error.message : 'Chưa thể kiểm tra giao dịch lúc này.');
      return true;
    }
  }, [code, removeFromCart]);

  useEffect(() => {
    let stopped = false, count = 0;
    const poll = async () => {
      const done = await verify();
      if (!stopped && !done && ++count < 30) {
        window.setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => {
      stopped = true;
    };
  }, [verify]);

  const success = state === 'SUCCESS';
  const pending = state === 'PENDING';
  const failed = state === 'FAILED' || state === 'ERROR';

  return (
    <main className={'checkout-result-page checkout-result-page--' + state.toLowerCase()}>
      <div className="checkout-result-glow" aria-hidden="true" />
      <section className="checkout-result-card" aria-live="polite">
        <div className="checkout-result-icon-wrap" aria-hidden="true">
          {success && <CheckCircle2 size={46} />}
          {pending && <LoaderCircle className="checkout-result-spinner" size={43} />}
          {failed && <XCircle size={46} />}
        </div>
        <span className="checkout-result-eyebrow">
          {success ? 'Giao dịch hoàn tất' : pending ? 'Đang xử lý giao dịch' : 'Giao dịch chưa hoàn tất'}
        </span>
        <h1>
          {success ? 'Thanh toán thành công!' : pending ? 'Vui lòng chờ trong giây lát' : 'Có lỗi xảy ra'}
        </h1>
        <p className="checkout-result-message">{message}</p>
        <div className="checkout-result-reference">
          <span>Mã giao dịch</span>
          <strong>{code ? code.slice(-12).toUpperCase() : 'CHƯA CÓ'}</strong>
        </div>
        {success && (
          <div className="checkout-result-steps">
            <div className="checkout-result-step done">
              <span><Check size={14} /></span>
              <small>Thanh toán</small>
            </div>
            <i />
            <div className="checkout-result-step done">
              <span><Check size={14} /></span>
              <small>Xác nhận đơn</small>
            </div>
            <i />
            <div className="checkout-result-step">
              <span><Clock3 size={15} /></span>
              <small>Chờ phục vụ</small>
            </div>
          </div>
        )}
        <div className="checkout-result-actions">
          {(pending || state === 'ERROR') && (
            <button className="checkout-result-button primary" onClick={() => void verify()}>
              <RefreshCw size={18} /> Kiểm tra lại
            </button>
          )}
          {success && (
            <Link className="checkout-result-button primary" to={ROUTES.PROFILE}>
              <ShoppingBag size={18} /> Xem đơn hàng <ArrowRight size={17} />
            </Link>
          )}
          {state === 'FAILED' && (
            <Link className="checkout-result-button primary" to={ROUTES.CART}>
              <ShoppingBag size={18} /> Quay lại giỏ hàng
            </Link>
          )}
          <Link className="checkout-result-button secondary" to={ROUTES.LANDING}>
            <Home size={18} /> Về trang chủ
          </Link>
        </div>
        <p className="checkout-result-help">
          Cần hỗ trợ? <a href="mailto:support@disanaodai.vn">Liên hệ với chúng tôi</a>
        </p>
      </section>
    </main>
  );
};
export default CheckoutResultPage;
