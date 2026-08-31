import React from 'react';
import { PackageCheck, Palette, Percent, ShieldCheck } from 'lucide-react';

export const ComboValuePropsSection: React.FC = () => {
  const valueProps = [
    {
      icon: <PackageCheck size={26} />,
      title: '1 Lần Đặt — 2 Dịch Vụ',
      desc: 'Tối giản thủ tục đặt lịch. Tự động đồng bộ thời gian nhận áo và giờ chụp ảnh cùng một đối tác.'
    },
    {
      icon: <Palette size={26} />,
      title: 'Đồng Bộ Concept Nghệ Thuật',
      desc: 'Nhiếp ảnh gia và nhà thiết kế phối hợp chặt chẽ, đảm bảo bối cảnh tôn vinh tối đa vẻ đẹp tà áo.'
    },
    {
      icon: <Percent size={26} />,
      title: 'Tiết Kiệm Lên Đến 35%',
      desc: 'Mức giá trọn gói ưu đãi độc quyền, tối ưu ngân sách hơn đáng kể so với thuê và chụp riêng lẻ.'
    },
    {
      icon: <ShieldCheck size={26} />,
      title: 'Đổi Lịch Linh Hoạt & Bảo Chứng',
      desc: 'Hỗ trợ dời lịch miễn phí khi thời tiết xấu hoặc có lịch bận đột xuất. Đảm bảo quyền lợi khách hàng 100%.'
    }
  ];

  return (
    <section className="lume-combo-value-props-section">
      <div className="lume-combo-value-props-header">
        <span className="lume-combo-value-props-eyebrow">ĐẶC QUYỀN KHÁCH HÀNG</span>
        <h2 className="lume-combo-value-props-title">Tại sao nên chọn Combo trọn gói tại LUMÉ?</h2>
        <p className="lume-combo-value-props-subtitle">
          Giải pháp trọn vẹn giúp bạn tự tin tỏa sáng trong tà áo di sản mà không phải lo lắng về việc tìm kiếm thợ ảnh hay phối đồ riêng biệt.
        </p>
      </div>

      <div className="lume-combo-value-props-grid">
        {valueProps.map((prop, idx) => (
          <div key={idx} className="lume-combo-value-prop-card">
            <div className="lume-combo-value-prop-icon">
              {prop.icon}
            </div>
            <h3 className="lume-combo-value-prop-card-title">{prop.title}</h3>
            <p className="lume-combo-value-prop-card-desc">{prop.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
