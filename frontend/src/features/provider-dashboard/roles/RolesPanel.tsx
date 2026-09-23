import {
  Camera,
  CheckCircle,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';

type RolesPanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
{
  hasAodaiCapability: boolean | undefined;
  hasPhotographyCapability: boolean | undefined;
  navigate: NavigateFunction;
};

export function RolesPanel({ isLoadingProvider, hasAodaiCapability, hasPhotographyCapability, navigate }: RolesPanelProps) {
  return (
    <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, margin: 0 }}>Quản lý vai trò dịch vụ</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '520px' }}>Xem và quản lý các loại dịch vụ bạn đang cung cấp. Bạn có thể đăng ký thêm vai trò mới để mở rộng kinh doanh.</p>
        </div>
      </div>

      {isLoadingProvider ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Đang tải dữ liệu...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Current Capabilities */}
          <div style={{ background: 'var(--color-light-card)', borderRadius: '16px', border: '1px solid var(--color-light-border)', padding: '28px' }}>
            <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} style={{ color: 'var(--color-primary)' }} />
              Vai trò hiện tại
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {/* AODAI_RENTAL capability card */}
              {(() => {
                const hasAodai = hasAodaiCapability;
                const hasPhoto = hasPhotographyCapability;
                const allCapabilities = [
                  {
                    key: 'AODAI_RENTAL',
                    label: 'Cho thuê Áo dài',
                    description: 'Quản lý cửa hàng áo dài, bộ sưu tập sản phẩm, tồn kho và đơn hàng cho thuê.',
                    icon: <Layers size={24} />,
                    active: hasAodai,
                    gradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)',
                    borderColor: '#F9A8D4',
                    iconBg: '#FBD5E8',
                    iconColor: '#BE185D',
                  },
                  {
                    key: 'PHOTOGRAPHY',
                    label: 'Thợ chụp ảnh',
                    description: 'Quản lý portfolio ảnh, tạo các gói chụp ảnh chuyên nghiệp và nhận đơn đặt lịch.',
                    icon: <Camera size={24} />,
                    active: hasPhoto,
                    gradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                    borderColor: '#93C5FD',
                    iconBg: '#BFDBFE',
                    iconColor: '#1D4ED8',
                  },
                ];
                return allCapabilities.map((cap) => (
                  <div key={cap.key} style={{
                    background: cap.active ? cap.gradient : '#F9FAFB',
                    borderRadius: '14px',
                    border: `2px solid ${cap.active ? cap.borderColor : '#E5E7EB'}`,
                    padding: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: cap.active ? 1 : 0.65,
                    transition: 'all 0.3s ease',
                  }}>
                    {cap.active && (
                      <div style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: '#10B981', color: 'white',
                        borderRadius: '20px', padding: '3px 12px', fontSize: '11px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <CheckCircle size={12} /> Đang hoạt động
                      </div>
                    )}
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      background: cap.active ? cap.iconBg : '#E5E7EB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: cap.active ? cap.iconColor : '#9CA3AF',
                      marginBottom: '16px',
                    }}>
                      {cap.icon}
                    </div>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: cap.active ? 'var(--color-text-primary)' : '#9CA3AF' }}>{cap.label}</h4>
                    <p style={{ fontSize: '13px', color: cap.active ? 'var(--color-text-secondary)' : '#D1D5DB', margin: 0, lineHeight: '1.5' }}>{cap.description}</p>
                    {!cap.active && (
                      <button
                        onClick={() => navigate(`/provider/register?upgrade=${cap.key}`)}
                        style={{
                          marginTop: '16px', width: '100%', padding: '10px 16px',
                          background: 'var(--color-primary)', color: 'white',
                          border: 'none', borderRadius: '10px', fontWeight: 700,
                          fontSize: '13px', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', gap: '8px',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(184,144,71,0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <Plus size={16} /> Đăng ký thêm vai trò này
                      </button>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Benefits info */}
          <div style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', borderRadius: '16px', border: '1px solid #FDE68A', padding: '24px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: '#D97706' }} />
              Lợi ích khi kết hợp nhiều vai trò
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {[
                { icon: '📦', text: 'Tạo combo ưu đãi "Áo dài + Chụp ảnh" thu hút khách hàng' },
                { icon: '💰', text: 'Tăng doanh thu từ đa nguồn dịch vụ trên cùng một nền tảng' },
                { icon: '⭐', text: 'Nâng cao uy tín thương hiệu với portfolio đa dạng' },
                { icon: '🎯', text: 'Được đề xuất ưu tiên trong kết quả tìm kiếm' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#78350F', lineHeight: '1.5' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div style={{ background: 'var(--color-light-card)', borderRadius: '16px', border: '1px solid var(--color-light-border)', padding: '28px' }}>
            <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-text-primary)' }}>
              Quy trình đăng ký thêm vai trò
            </h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { step: '1', title: 'Chọn vai trò', desc: 'Bấm nút "Đăng ký thêm" ở vai trò bạn muốn' },
                { step: '2', title: 'Bổ sung hồ sơ', desc: 'Điền thông tin nghiệp vụ và tải tài liệu cần thiết' },
                { step: '3', title: 'Chờ phê duyệt', desc: 'Admin sẽ xét duyệt hồ sơ trong 1-3 ngày làm việc' },
                { step: '4', title: 'Bắt đầu hoạt động', desc: 'Vai trò mới được kích hoạt sau khi phê duyệt' },
              ].map((s, idx) => (
                <div key={idx} style={{
                  flex: '1 1 200px', display: 'flex', gap: '12px', alignItems: 'flex-start',
                  padding: '16px', borderRadius: '12px', background: '#F9FAFB',
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--color-primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 800, flexShrink: 0,
                  }}>
                    {s.step}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>{s.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
