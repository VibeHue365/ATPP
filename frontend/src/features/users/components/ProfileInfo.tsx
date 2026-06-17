import React from 'react';
import type { UserProfile } from '../types/users.types';

interface ProfileInfoProps {
  user: UserProfile | null;
}

export const ProfileInfo: React.FC<ProfileInfoProps> = ({ user }) => {
  const translateGender = (g?: string) => {
    if (g === 'MALE') return 'Nam';
    if (g === 'FEMALE') return 'Nữ';
    if (g === 'OTHER') return 'Khác';
    return 'Chưa cập nhật';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="vh-panel-fade">
      <h3 className="vh-panel-title">Hồ sơ cá nhân</h3>
      <div className="vh-info-grid">
        <div className="vh-info-card">
          <span className="vh-info-label">Họ và tên</span>
          <span className="vh-info-value">{user?.fullName}</span>
        </div>
        <div className="vh-info-card">
          <span className="vh-info-label">Email tài khoản</span>
          <span className="vh-info-value">{user?.email}</span>
        </div>
        <div className="vh-info-card">
          <span className="vh-info-label">Số điện thoại</span>
          <span className="vh-info-value">{user?.phone || 'Chưa cập nhật'}</span>
        </div>
        <div className="vh-info-card">
          <span className="vh-info-label">Giới tính</span>
          <span className="vh-info-value">{translateGender(user?.gender)}</span>
        </div>
        <div className="vh-info-card">
          <span className="vh-info-label">Ngày sinh</span>
          <span className="vh-info-value">{formatDate(user?.dateOfBirth)}</span>
        </div>
        <div className="vh-info-card">
          <span className="vh-info-label">Ngày tham gia</span>
          <span className="vh-info-value">{formatDate(user?.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};
