import React from 'react';
import {
  Star,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface PerformanceSectionProps {
  averageRating?: number;
  cancelRate?: number;
  completionRate?: number;
  onNavigate?: (view: any) => void;
}

export const OverviewPerformanceSection: React.FC<PerformanceSectionProps> = ({
  averageRating,
  cancelRate,
  completionRate = 95,
  onNavigate,
}) => {
  const ratingDisplay = averageRating != null ? `${averageRating.toFixed(1)} / 5` : '5.0 / 5';
  const cancelRateDisplay = cancelRate != null ? `${cancelRate}%` : '0%';
  const completionDisplay = `${completionRate}%`;

  return (
    <section className="po-performance-card" aria-label="Hiệu suất hoạt động">
      <div className="po-performance-header">
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Chỉ số hiệu suất & Uy tín</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--po-text-muted)' }}>
            Theo dõi mức độ hài lòng của khách hàng và chất lượng vận hành dịch vụ của bạn.
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
        <div className="po-perf-item" onClick={() => onNavigate?.('reviews')} style={{ cursor: 'pointer' }}>
          <div className="po-perf-icon-box" style={{ background: '#FEF3C7', color: '#B45309' }}>
            <Star size={20} fill="#B45309" />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Đánh giá trung bình</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value">{ratingDisplay}</span>
            </div>
            <span className="po-perf-note">Từ đánh giá của khách hàng</span>
          </div>
        </div>

        {/* 2. Tỷ lệ hoàn thành đơn */}
        <div className="po-perf-item" onClick={() => onNavigate?.('orders')} style={{ cursor: 'pointer' }}>
          <div className="po-perf-icon-box" style={{ background: '#ECFDF5', color: '#16A34A' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Tỷ lệ hoàn thành</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value">{completionDisplay}</span>
              <span className="po-perf-trend-green">↑ Rất tốt</span>
            </div>
            <span className="po-perf-note">Đơn phục vụ trọn vẹn</span>
          </div>
        </div>

        {/* 3. Tỷ lệ hủy đơn */}
        <div className="po-perf-item" onClick={() => onNavigate?.('orders')} style={{ cursor: 'pointer' }}>
          <div className="po-perf-icon-box green-bg">
            <RotateCcw size={20} />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Tỷ lệ hủy đơn</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value">{cancelRateDisplay}</span>
              <span className="po-perf-trend-green">↓ Tối ưu</span>
            </div>
            <span className="po-perf-note">Duy trì mức thấp</span>
          </div>
        </div>

        {/* 4. Huy hiệu chất lượng */}
        <div className="po-perf-item" onClick={() => onNavigate?.('profile')} style={{ cursor: 'pointer' }}>
          <div className="po-perf-icon-box" style={{ background: '#FFF1F2', color: '#881337' }}>
            <Sparkles size={20} />
          </div>
          <div className="po-perf-details">
            <span className="po-perf-label">Hồ sơ đối tác</span>
            <div className="po-perf-val-row">
              <span className="po-perf-value" style={{ fontSize: '18px', color: '#881337' }}>Đã xác thực</span>
            </div>
            <span className="po-perf-note">Huy hiệu uy tín LUMÉ</span>
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
              <span className="po-encouragement-heading">Duy trì phong độ tuyệt vời!</span>
              <span className="po-encouragement-desc">
                Cập nhật gói dịch vụ thường xuyên và phản hồi khách nhanh chóng giúp tăng 35% lượt đặt lịch.
              </span>
            </div>
          </div>
          <span className="po-encouragement-arrow">›</span>
        </div>
      </div>
    </section>
  );
};
