import React, { useRef } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../../../auth/hooks/useAuth';
import { useToast } from '../../../../components/feedback/Toast';
import { API_BASE_URL } from '../../../../config/env';
import type { QuickStatsData, ProfileTab } from '../../types/profile.types';

interface ProfileUserCardHeaderProps {
  stats: QuickStatsData;
  onNavigateTab: (tabKey: ProfileTab) => void;
}

export const ProfileUserCardHeader: React.FC<ProfileUserCardHeaderProps> = ({
  stats,
  onNavigateTab
}) => {
  const { user, updateAvatar } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar;
      const filename =
        user.avatar.includes('/') || user.avatar.includes('\\')
          ? user.avatar.split(/[/\\]/).pop()
          : user.avatar;
      return `${API_BASE_URL}/uploads/avatars/${filename}`;
    }
    return '/avatar_hanna.webp';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước ảnh đại diện tối đa là 2MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await updateAvatar(formData);
      toast.success('Cập nhật ảnh đại diện thành công!');
      window.dispatchEvent(new Event('vh-profile-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Tải ảnh lên thất bại');
    } finally {
      setIsUploading(false);
    }
  };

  const formattedSpent = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  })
    .format(stats.totalSpent || 0)
    .replace('₫', 'đ');

  return (
    <div className="lume-personal-header-card">
      {/* Top Row: Avatar & Basic Details & Stats */}
      <div className="lume-personal-user-top-row">
        <div className="lume-personal-user-meta">
          <div className="lume-personal-avatar-wrapper">
            <img
              src={getAvatarUrl()}
              alt={user?.fullName || 'Avatar'}
              className="lume-personal-avatar-img"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="lume-personal-avatar-btn"
              title="Thay đổi ảnh đại diện"
            >
              <Camera size={13} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp"
              style={{ display: 'none' }}
            />
          </div>

          <div className="lume-personal-name-info">
            <div className="lume-personal-name-row">
              <h2 className="lume-personal-full-name">{user?.fullName || 'Khách hàng LUMÉ'}</h2>
              <span className="lume-personal-role-badge">
                {user?.roles?.includes('PROVIDER') ? 'Đối tác dịch vụ' : 'Khách hàng'}
              </span>
            </div>
            <p className="lume-personal-join-date">
              LUMÉ Member từ {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'}
            </p>
          </div>
        </div>

        {/* Stats Row in Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#231F20' }}>
              {stats.photoshootsCount ?? 0}
            </span>
            <span style={{ fontSize: '11px', color: '#8C827A', fontWeight: 600 }}>Buổi chụp</span>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#EFEAE2' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#231F20' }}>
              {stats.favoritesCount ?? 0}
            </span>
            <span style={{ fontSize: '11px', color: '#8C827A', fontWeight: 600 }}>Yêu thích</span>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#EFEAE2' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#8B1E2D' }}>
              {formattedSpent}
            </span>
            <span style={{ fontSize: '11px', color: '#8C827A', fontWeight: 600 }}>Tổng chi tiêu</span>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#EFEAE2' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#B45309' }}>
              {stats.membershipTier || 'Silver Member'}
            </span>
            <span style={{ fontSize: '11px', color: '#8C827A', fontWeight: 600 }}>
              HSD: {stats.membershipExpiry || `31/12/${new Date().getFullYear()}`}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="lume-personal-subnav-tabs">
        <button
          type="button"
          className="lume-personal-subnav-btn active"
          onClick={() => onNavigateTab('personal')}
        >
          Thông tin cá nhân
        </button>
        <button
          type="button"
          className="lume-personal-subnav-btn"
          onClick={() => onNavigateTab('schedule')}
        >
          Lịch sử đặt chụp
        </button>
        <button
          type="button"
          className="lume-personal-subnav-btn"
          onClick={() => onNavigateTab('schedule')}
        >
          Đánh giá của tôi
        </button>
        <button
          type="button"
          className="lume-personal-subnav-btn"
          onClick={() => onNavigateTab('overview')}
        >
          Ưu đãi của tôi
        </button>
      </div>
    </div>
  );
};
