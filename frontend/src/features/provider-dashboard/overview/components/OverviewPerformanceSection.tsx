import React from 'react';
import {
  Star,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { ProviderOverviewPerformance } from '../types';

interface PerformanceSectionProps {
  performance?: ProviderOverviewPerformance;
  onNavigate?: (view: any) => void;
}

export const OverviewPerformanceSection: React.FC<PerformanceSectionProps> = ({
  performance,
  onNavigate,
}) => {
  const ratingDisplay =
    performance && performance.totalReviews > 0
      ? `${performance.averageRating.toFixed(1)} / 5`
      : '5.0 / 5';

  const reviewsNote =
    performance && performance.totalReviews > 0
      ? `Dựa trên ${performance.totalReviews} lượt đánh giá thực tế`
      : 'Chưa có đánh giá nào từ khách hàng';

  const completionDisplay =
    performance?.completionRate != null
      ? `${performance.completionRate}%`
      : '—';

  const completionNote =
    performance?.completionRate != null
      ? 'Tỷ lệ hoàn tất dịch vụ đạt chuẩn'
      : 'Chưa có đơn hàng hoàn tất';

  const cancelRateDisplay =
    performance?.cancelRate != null ? `${performance.cancelRate}%` : '0%';

  const cancelRateTrend =
    performance?.cancelRate != null && performance?.cancelRatePrev != null
      ? performance.cancelRate <= performance.cancelRatePrev
        ? '↓ Tối ưu'
        : '↑ Cần chú ý'
      : 'Duy trì mức thấp';

  const isVerified = performance?.isVerified ?? false;

  return (
    <section className="po-performance-card" aria-label="Hiệu suất hoạt động">
      <div className="po-performance-header">
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Chỉ số hiệu suất & Uy tín
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: 'var(--po-text-muted)',
            }}
          >
            Theo dõi mức độ hài lòng của khách hàng và chất lượng vận hành dịch vụ
            của bạn trên TàGo.
          </p>
        </div>
        <button
          className="po-link-view-all"
          onClick={() => onNavigate?.('reviews')}
          type="button"
        >
          <span>Xem đánh giá</span>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="po-performance-grid">
        {/* 1. Đánh giá trung bình */}
        <div
          className="po-perf-item"
          onClick={() => onNavigate?.('reviews')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="po-perf-icon-box"
            style={{ background: '#FEF3C7', color: '#B45309' }}
          >
            <Star size={20} fill="#B45309" />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Đánh giá trung bình</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value">{ratingDisplay}</span>
            </div>
            <span className="po-perf-note">{reviewsNote}</span>
          </div>
        </div>

        {/* 2. Tỷ lệ hoàn thành đơn */}
        <div
          className="po-perf-item"
          onClick={() => onNavigate?.('orders')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="po-perf-icon-box"
            style={{ background: '#ECFDF5', color: '#16A34A' }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Tỷ lệ hoàn thành</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value">{completionDisplay}</span>
              {performance?.completionRate != null && (
                <span className="po-perf-trend-green">↑ Đạt chuẩn</span>
              )}
            </div>
            <span className="po-perf-note">{completionNote}</span>
          </div>
        </div>

        {/* 3. Tỷ lệ hủy đơn */}
        <div
          className="po-perf-item"
          onClick={() => onNavigate?.('orders')}
          style={{ cursor: 'pointer' }}
        >
          <div className="po-perf-icon-box green-bg">
            <RotateCcw size={20} />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Tỷ lệ hủy đơn</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value">{cancelRateDisplay}</span>
              <span className="po-perf-trend-green">{cancelRateTrend}</span>
            </div>
            <span className="po-perf-note">Duy trì đơn hàng phục vụ trọn vẹn</span>
          </div>
        </div>

        {/* 4. Huy hiệu chất lượng */}
        <div
          className="po-perf-item"
          onClick={() => onNavigate?.('profile')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="po-perf-icon-box"
            style={{ background: '#FFF1F2', color: '#881337' }}
          >
            <Sparkles size={20} />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Hồ sơ đối tác</span>
            <div className="po-perf-val-row">
              <span
                className="po-perf-value"
                style={{ fontSize: '18px', color: '#881337' }}
              >
                {isVerified ? 'Đã xác thực' : 'Chờ xác thực'}
              </span>
            </div>
            <span className="po-perf-note">Huy hiệu đối tác TàGo</span>
          </div>
        </div>

        {/* 5. Encouragement Trophy Banner */}
        <div
          className="po-encouragement-banner"
          onClick={() => onNavigate?.('profile')}
          role="button"
          tabIndex={0}
        >
          <div className="po-encouragement-left">
            <div className="po-trophy-icon-box" role="img" aria-label="trophy">
              🏆
            </div>
            <div className="po-encouragement-text">
              <span className="po-encouragement-heading">
                Duy trì phong độ tuyệt vời!
              </span>
              <span className="po-encouragement-desc">
                Cập nhật gói dịch vụ thường xuyên và phản hồi khách nhanh chóng
                giúp tăng 35% lượt đặt lịch thành công trên TàGo.
              </span>
            </div>
          </div>
          <span className="po-encouragement-arrow">›</span>
        </div>
      </div>
    </section>
  );
};
