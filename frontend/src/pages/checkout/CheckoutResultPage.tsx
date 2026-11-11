import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { useCart } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';
import './CheckoutResultPage.css';

export type CheckoutResultState =
  | 'PENDING'
  | 'SUCCESS'
  | 'REVIEW_REQUIRED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'ERROR';

export interface PaymentStatusResponse {
  paymentCode: string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | string;
  bookingStatus: string;
  confirmed: boolean;
  needsManualReview?: boolean;
}

const MAX_POLL_COUNT = 30;
const POLL_INTERVAL_MS = 2000;

export const CheckoutResultPage: React.FC = () => {
  const routeParams = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const code =
    routeParams.code ||
    searchParams.get('paymentCode') ||
    searchParams.get('code') ||
    '';
  const { removeFromCart } = useCart();
  const [state, setState] = useState<CheckoutResultState>('PENDING');
  const [message, setMessage] = useState(
    'Hệ thống đang xác minh giao dịch của bạn. Quá trình này chỉ mất ít phút.',
  );
  const [isChecking, setIsChecking] = useState(false);
  const pollCountRef = useRef(0);
  const isMountedRef = useRef(true);

  const clearPendingCart = useCallback(() => {
    if (!code) return;
    const key = 'vh_pending_checkout_' + code;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        (JSON.parse(raw) as { cartItemIds?: string[] }).cartItemIds?.forEach(
          removeFromCart,
        );
      } finally {
        localStorage.removeItem(key);
      }
    }
  }, [code, removeFromCart]);

  /**
   * Evaluates payment status response into deterministic terminal or pending state.
   * Returns true if a terminal state was reached (polling should stop), false if still pending.
   */
  const evaluateStatus = useCallback(
    (data: PaymentStatusResponse): boolean => {
      // 1. High priority: If payment was SUCCESS, evaluate whether it is truly confirmed or needs review/reconciliation
      if (data.paymentStatus === 'SUCCESS') {
        // If needs manual review, or booking is not confirmed, or booking was cancelled while payment succeeded:
        if (
          data.needsManualReview ||
          !data.confirmed ||
          data.bookingStatus === 'CANCELLED'
        ) {
          setState('REVIEW_REQUIRED');
          setMessage(
            'Giao dịch thanh toán đã được ghi nhận trên hệ thống nhưng đơn hàng đang chờ xác thực bảo mật trước khi kích hoạt. Vui lòng không thực hiện thanh toán lại để tránh phát sinh giao dịch trùng lặp.',
          );
          return true;
        }

        // Strictly confirmed success without review flags:
        clearPendingCart();
        setState('SUCCESS');
        setMessage(
          'Đơn hàng đã được xác nhận và sẵn sàng trong tài khoản của bạn.',
        );
        return true;
      }

      // 2. Terminal: Payment CANCELLED or Booking CANCELLED (only when payment is NOT SUCCESS)
      if (
        data.paymentStatus === 'CANCELLED' ||
        data.bookingStatus === 'CANCELLED'
      ) {
        setState('CANCELLED');
        setMessage(
          'Giao dịch đã được hủy. Các sản phẩm vẫn được lưu trong giỏ hàng để bạn có thể tiếp tục bất cứ lúc nào.',
        );
        return true;
      }

      // 3. Terminal: Payment genuinely FAILED
      if (data.paymentStatus === 'FAILED') {
        setState('FAILED');
        setMessage(
          'Giao dịch thanh toán chưa thành công. Các sản phẩm vẫn được giữ nguyên trong giỏ hàng.',
        );
        return true;
      }

      // 4. Non-terminal: Still PENDING
      setState('PENDING');
      setMessage(
        'Hệ thống đang xác minh giao dịch của bạn. Quá trình này chỉ mất ít phút.',
      );
      return false;
    },
    [clearPendingCart],
  );

  /**
   * Single controlled verification call.
   */
  const verify = useCallback(
    async (isManual = false): Promise<boolean> => {
      if (!code) {
        setState('ERROR');
        setMessage('Không tìm thấy mã giao dịch để xác minh.');
        return true;
      }
      if (isManual) {
        setIsChecking(true);
      }
      try {
        const data = await httpClient.get<PaymentStatusResponse>(
          '/payments/' + encodeURIComponent(code) + '/status',
        );
        if (!isMountedRef.current) return true;
        const isTerminal = evaluateStatus(data);
        if (!isTerminal && isManual) {
          // If manual check is still pending, let user know
          setMessage(
            'Giao dịch vẫn đang được xử lý bởi cổng thanh toán. Vui lòng kiểm tra lại sau giây lát.',
          );
        }
        return isTerminal;
      } catch (error) {
        if (!isMountedRef.current) return true;
        setState('ERROR');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Chưa thể kiểm tra giao dịch lúc này do sự cố kết nối.',
        );
        return true;
      } finally {
        if (isMountedRef.current && isManual) {
          setIsChecking(false);
        }
      }
    },
    [code, evaluateStatus],
  );

  // Automatic bounded polling on mount
  useEffect(() => {
    isMountedRef.current = true;
    let stopped = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    pollCountRef.current = 0;

    const runPoll = async () => {
      const isTerminal = await verify(false);
      if (stopped || !isMountedRef.current) return;

      if (!isTerminal) {
        pollCountRef.current += 1;
        if (pollCountRef.current < MAX_POLL_COUNT) {
          timerId = setTimeout(() => void runPoll(), POLL_INTERVAL_MS);
        } else {
          // Bounded polling exhausted: transition cleanly to TIMEOUT (stop spinner)
          setState('TIMEOUT');
          setMessage(
            'Hệ thống chưa nhận được phản hồi xác nhận từ cổng thanh toán sau thời gian chờ. Vui lòng không thực hiện thanh toán lại lúc này để tránh phát sinh giao dịch trùng lặp. Bạn có thể kiểm tra lại sau giây lát, xem lịch sử đơn hàng hoặc liên hệ bộ phận hỗ trợ.',
          );
        }
      }
    };

    void runPoll();

    return () => {
      stopped = true;
      isMountedRef.current = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [verify]);

  const success = state === 'SUCCESS';
  const reviewRequired = state === 'REVIEW_REQUIRED';
  const pending = state === 'PENDING';
  const timeout = state === 'TIMEOUT';
  const failed = state === 'FAILED';
  const cancelled = state === 'CANCELLED';
  const isError = state === 'ERROR';

  return (
    <main
      className={
        'checkout-result-page checkout-result-page--' + state.toLowerCase()
      }
    >
      <div className="checkout-result-glow" aria-hidden="true" />
      <section className="checkout-result-card" aria-live="polite">
        <div className="checkout-result-icon-wrap" aria-hidden="true">
          {success && <CheckCircle2 size={46} />}
          {reviewRequired && <ShieldCheck size={46} />}
          {pending && (
            <LoaderCircle className="checkout-result-spinner" size={43} />
          )}
          {timeout && <Clock3 size={46} />}
          {(failed || cancelled || isError) && <XCircle size={46} />}
        </div>

        <span className="checkout-result-eyebrow">
          {success && 'Giao dịch hoàn tất'}
          {reviewRequired && 'Đã ghi nhận thanh toán'}
          {pending && 'Đang xử lý giao dịch'}
          {timeout && 'Quá thời gian phản hồi'}
          {failed && 'Giao dịch thất bại'}
          {cancelled && 'Giao dịch đã hủy'}
          {isError && 'Sự cố kết nối'}
        </span>

        <h1>
          {success && 'Thanh toán thành công!'}
          {reviewRequired && 'Giao dịch đang được xác thực'}
          {pending && 'Vui lòng chờ trong giây lát'}
          {timeout && 'Chưa có kết quả giao dịch'}
          {failed && 'Thanh toán không thành công'}
          {cancelled && 'Đơn hàng đã được hủy'}
          {isError && 'Có lỗi xảy ra'}
        </h1>

        <p className="checkout-result-message">{message}</p>

        <div className="checkout-result-reference">
          <span>Mã giao dịch</span>
          <strong>{code ? code.slice(-12).toUpperCase() : 'CHƯA CÓ'}</strong>
        </div>

        {success && (
          <div className="checkout-result-steps">
            <div className="checkout-result-step done">
              <span>
                <Check size={14} />
              </span>
              <small>Thanh toán</small>
            </div>
            <i />
            <div className="checkout-result-step done">
              <span>
                <Check size={14} />
              </span>
              <small>Xác nhận đơn</small>
            </div>
            <i />
            <div className="checkout-result-step">
              <span>
                <Clock3 size={15} />
              </span>
              <small>Chờ phục vụ</small>
            </div>
          </div>
        )}

        {success && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#334155',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#76141c" style={{ flexShrink: 0 }} />
              <span>Hợp đồng điện tử của bạn đã được xác lập và sẵn sàng trong tài khoản.</span>
            </div>
            <Link
              to={`${ROUTES.PROFILE}?tab=contracts`}
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#76141c',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Xem hợp đồng →
            </Link>
          </div>
        )}

        {reviewRequired && (
          <div className="checkout-result-steps">
            <div className="checkout-result-step done">
              <span>
                <Check size={14} />
              </span>
              <small>Thanh toán</small>
            </div>
            <i />
            <div className="checkout-result-step done">
              <span>
                <Clock3 size={14} />
              </span>
              <small>Xác thực bảo mật</small>
            </div>
            <i />
            <div className="checkout-result-step">
              <span>
                <ShoppingBag size={14} />
              </span>
              <small>Kích hoạt đơn</small>
            </div>
          </div>
        )}

        <div className="checkout-result-actions">
          {/* Controlled Single Re-check Button */}
          {(pending || timeout || reviewRequired || isError) && (
            <button
              className="checkout-result-button secondary"
              onClick={() => void verify(true)}
              disabled={isChecking}
              aria-label="Kiểm tra lại trạng thái giao dịch"
            >
              {isChecking ? (
                <LoaderCircle className="checkout-result-spinner" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
            </button>
          )}

          {/* View Profile/Orders when Payment is recorded (SUCCESS, REVIEW_REQUIRED, or TIMEOUT) */}
          {(success || reviewRequired || timeout) && (
            <Link
              className="checkout-result-button primary"
              to={ROUTES.PROFILE}
            >
              <ShoppingBag size={18} /> Xem đơn hàng <ArrowRight size={17} />
            </Link>
          )}

          {/* Return to Cart only when Payment genuinely failed or was cancelled */}
          {(failed || cancelled) && (
            <Link className="checkout-result-button primary" to={ROUTES.CART}>
              <ShoppingBag size={18} /> Quay lại giỏ hàng
            </Link>
          )}

          <Link
            className="checkout-result-button secondary"
            to={ROUTES.LANDING}
          >
            <Home size={18} /> Về trang chủ
          </Link>
        </div>

        <p className="checkout-result-help">
          Cần hỗ trợ?{' '}
          <a href="mailto:support@disanaodai.vn">Liên hệ với chúng tôi</a>
        </p>
      </section>
    </main>
  );
};

export default CheckoutResultPage;
