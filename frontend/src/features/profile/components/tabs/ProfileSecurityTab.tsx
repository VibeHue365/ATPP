import React from 'react';
import { ChangePasswordForm } from '../../../users/components/ChangePasswordForm';
import { ShieldCheck } from 'lucide-react';

export const ProfileSecurityTab: React.FC = () => {
  return (
    <div className="lume-dashboard-card" style={{ gap: '24px' }}>
      <div className="lume-dashboard-card-header" style={{ marginBottom: 0 }}>
        <h3 className="lume-dashboard-card-title">Bảo mật tài khoản</h3>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px',
          backgroundColor: '#FCFAF7',
          borderRadius: '12px',
          border: '1px solid #ECE5DB'
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#FDF2F4',
            color: '#8B1E2D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <ShieldCheck size={22} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, color: '#231F20' }}>
            Bảo vệ tài khoản đa tầng
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#8C827A' }}>
            Nên sử dụng mật khẩu mạnh gồm chữ in hoa, chữ số và ký tự đặc biệt để tối đa hóa an toàn.
          </p>
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  );
};
