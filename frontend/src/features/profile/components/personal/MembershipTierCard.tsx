import React from 'react';
import { Crown, CheckCircle2, ChevronRight } from 'lucide-react';
import { useToast } from '../../../../components/feedback/Toast';
import type { QuickStatsData } from '../../types/profile.types';

interface MembershipTierCardProps {
  stats?: QuickStatsData;
}

export const MembershipTierCard: React.FC<MembershipTierCardProps> = ({ stats }) => {
  const toast = useToast();

  const totalSpent = stats?.totalSpent || 0;
  const currentYear = new Date().getFullYear();

  let tierName = 'SILVER MEMBER';
  let tierBadgeColor = '#94A3B8';
  let progressPercent = 0;
  let targetLabel = '';
  let subtextMessage = '';
  let benefits: string[] = [];

  if (totalSpent >= 5000000) {
    tierName = 'DIAMOND MEMBER';
    tierBadgeColor = '#3B82F6';
    progressPercent = 100;
    targetLabel = `${totalSpent.toLocaleString('vi-VN')}đ / 5.000.000đ`;
    subtextMessage = `Bạn đang sở hữu hạng Diamond VIP cao nhất đến hết 31/12/${currentYear}.`;
    benefits = [
      'Đặc quyền giảm 15% cho mọi dịch vụ thuê áo & chụp ảnh',
      'Ưu tiên hàng đầu khi đặt lịch thợ ảnh & thử đồ',
      'Miễn phí giao nhận tận nơi & hỗ trợ hậu kỳ riêng',
      'Chuyên viên chăm sóc khách hàng VIP 24/7'
    ];
  } else if (totalSpent >= 1000000) {
    tierName = 'GOLD MEMBER';
    tierBadgeColor = '#F59E0B';
    progressPercent = Math.min(100, Math.round(((totalSpent - 1000000) / 4000000) * 100));
    const remaining = 5000000 - totalSpent;
    targetLabel = `${totalSpent.toLocaleString('vi-VN')}đ / 5.000.000đ`;
    subtextMessage = `Còn ${remaining.toLocaleString('vi-VN')}đ chi tiêu trước 31/12/${currentYear} để thăng hạng Diamond.`;
    benefits = [
      'Giảm 10% cho tất cả dịch vụ thuê áo dài & gói chụp',
      'Ưu tiên giữ lịch hẹn vào các dịp lễ & cuối tuần',
      'Tích lũy điểm thưởng đổi voucher quà tặng',
      'Hỗ trợ đổi lịch linh hoạt miễn phí'
    ];
  } else {
    tierName = 'SILVER MEMBER';
    tierBadgeColor = '#64748B';
    progressPercent = Math.min(100, Math.round((totalSpent / 1000000) * 100));
    const remaining = 1000000 - totalSpent;
    targetLabel = `${totalSpent.toLocaleString('vi-VN')}đ / 1.000.000đ`;
    subtextMessage = `Còn ${remaining.toLocaleString('vi-VN')}đ chi tiêu để đạt hạng Gold Member.`;
    benefits = [
      'Tích lũy điểm thưởng khi hoàn tất đơn hàng',
      'Nhận thông báo sớm về các bộ sưu tập áo dài mới',
      'Trải nghiệm dịch vụ thử áo tại studio'
    ];
  }

  return (
    <div className="lume-membership-vip-card">
      {/* Header */}
      <div className="lume-membership-tier-header">
        <h3 className="lume-form-card-title" style={{ color: '#4A3F35' }}>Hạng thành viên</h3>
        <div
          className="lume-membership-tier-badge"
          style={{
            borderColor: tierBadgeColor,
            color: tierName === 'DIAMOND MEMBER' ? '#1D4ED8' : tierName === 'GOLD MEMBER' ? '#B45309' : '#475569'
          }}
        >
          <Crown size={14} fill={tierBadgeColor} color={tierBadgeColor} />
          <span>{tierName}</span>
        </div>
      </div>

      {/* Progress Box */}
      <div className="lume-membership-progress-box">
        <div className="lume-membership-progress-labels">
          <span>Tiến trình hội viên</span>
          <span style={{ color: '#8B1E2D', fontWeight: 800 }}>{targetLabel}</span>
        </div>

        <div className="lume-progress-bar-bg">
          <div className="lume-progress-bar-fill" style={{ width: `${Math.max(8, progressPercent)}%` }} />
        </div>

        <p style={{ margin: 0, fontSize: '11.5px', color: '#8C6D1F', fontWeight: 600 }}>
          {subtextMessage}
        </p>
      </div>

      {/* Benefits checklist */}
      <div className="lume-membership-benefits-list">
        {benefits.map((b, idx) => (
          <div key={idx} className="lume-membership-benefit-item">
            <CheckCircle2 size={15} className="lume-membership-check-icon" />
            <span>{b}</span>
          </div>
        ))}
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={() => toast.info('Chương trình Hội viên LUMÉ VIP tích lũy tự động theo chi tiêu của bạn.')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '11px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #DFCEB4',
          borderRadius: '10px',
          color: '#8B1E2D',
          fontSize: '12.5px',
          fontWeight: 750,
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#8B1E2D';
          e.currentTarget.style.color = '#FFFFFF';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF';
          e.currentTarget.style.color = '#8B1E2D';
        }}
      >
        <span>Xem chính sách hội viên</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
};
