import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronRight, Percent, CheckCircle2 } from 'lucide-react';
import { ROUTES } from '../../../config/routes';

interface ComboHeroHeaderProps {
  totalCombos: number;
  maxDiscount: number;
}

export const ComboHeroHeader: React.FC<ComboHeroHeaderProps> = ({
  totalCombos,
  maxDiscount
}) => {
  return (
    <header className="lume-combo-hero-section">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="lume-combo-breadcrumb">
        <Link to={ROUTES.LANDING} className="lume-combo-breadcrumb-link">
          Trang chủ
        </Link>
        <ChevronRight size={13} className="lume-combo-breadcrumb-separator" />
        <span className="lume-combo-breadcrumb-current">Combo trọn gói</span>
      </nav>

      {/* Main Hero Card */}
      <div className="lume-combo-hero-card">
        <div className="lume-combo-hero-content">
          <div className="lume-combo-hero-badge">
            <Sparkles size={14} className="lume-combo-hero-sparkle" />
            <span>COMBO TIẾT KIỆM — TRỌN GÓI 2-IN-1</span>
          </div>

          <h1 className="lume-combo-hero-title">
            Combo Trọn Gói<br />
            <span className="lume-combo-hero-highlight">Áo Dài & Nhiếp Ảnh Nghệ Thuật</span>
          </h1>

          <p className="lume-combo-hero-desc">
            Trải nghiệm dịch vụ hoàn hảo khi kết hợp thuê tà áo di sản tinh xảo và gói chụp ảnh nghệ thuật từ cùng một đối tác xác thực. Tiết kiệm thời gian, tối ưu chi phí và đồng bộ phong cách hoàn mỹ.
          </p>

          {/* Value highlights mini */}
          <div className="lume-combo-hero-mini-props">
            <div className="lume-combo-hero-mini-prop">
              <CheckCircle2 size={15} color="#8B1E2D" />
              <span>Đồng bộ 100% Concept</span>
            </div>
            <div className="lume-combo-hero-mini-prop">
              <CheckCircle2 size={15} color="#8B1E2D" />
              <span>Miễn phí phụ kiện & đạo cụ</span>
            </div>
            <div className="lume-combo-hero-mini-prop">
              <CheckCircle2 size={15} color="#8B1E2D" />
              <span>Hỗ trợ đổi lịch linh hoạt</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Column */}
        <div className="lume-combo-hero-stats-panel">
          <div className="lume-combo-stat-card">
            <div className="lume-combo-stat-icon-wrapper">
              <Sparkles size={20} />
            </div>
            <div className="lume-combo-stat-info">
              <span className="lume-combo-stat-number">{totalCombos}</span>
              <span className="lume-combo-stat-label">Combo Đang Khả Dụng</span>
            </div>
          </div>

          <div className="lume-combo-stat-card">
            <div className="lume-combo-stat-icon-wrapper gold">
              <Percent size={20} />
            </div>
            <div className="lume-combo-stat-info">
              <span className="lume-combo-stat-number gold">
                {maxDiscount > 0 ? `-${maxDiscount}%` : 'Ưu đãi'}
              </span>
              <span className="lume-combo-stat-label">Mức Giảm Giá Cao Nhất</span>
            </div>
          </div>

          <div className="lume-combo-stat-card highlight">
            <div className="lume-combo-stat-info-full">
              <div className="lume-combo-stat-label-vip">ĐẶC QUYỀN ĐẶT TRỌN GÓI</div>
              <p className="lume-combo-stat-text-vip">
                Tiết kiệm lên đến <strong>35%</strong> so với đặt lẻ từng dịch vụ riêng biệt.
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
