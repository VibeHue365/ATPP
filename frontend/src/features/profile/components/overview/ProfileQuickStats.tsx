import React from 'react';
import { Calendar, Heart, Tag, Star } from 'lucide-react';
import type { QuickStatsData } from '../../types/profile.types';

interface ProfileQuickStatsProps {
  stats: QuickStatsData;
}

export const ProfileQuickStats: React.FC<ProfileQuickStatsProps> = ({ stats }) => {
  const formattedSpent = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  })
    .format(stats.totalSpent || 0)
    .replace('₫', 'đ');

  return (
    <div className="lume-quick-stats-grid">
      {/* 1. Buổi chụp đã thực hiện */}
      <div className="lume-stat-card">
        <div className="lume-stat-icon-wrapper red">
          <Calendar size={22} />
        </div>
        <div className="lume-stat-info">
          <span className="lume-stat-value">{stats.photoshootsCount}</span>
          <span className="lume-stat-label">Buổi chụp đã thực hiện</span>
        </div>
      </div>

      {/* 2. Yêu thích áo dài & gói chụp */}
      <div className="lume-stat-card">
        <div className="lume-stat-icon-wrapper red">
          <Heart size={22} />
        </div>
        <div className="lume-stat-info">
          <span className="lume-stat-value">{stats.favoritesCount}</span>
          <span className="lume-stat-label">Yêu thích áo dài & gói chụp</span>
        </div>
      </div>

      {/* 3. Tổng chi tiêu tại LUMÉ */}
      <div className="lume-stat-card">
        <div className="lume-stat-icon-wrapper amber">
          <Tag size={22} />
        </div>
        <div className="lume-stat-info">
          <span className="lume-stat-value">{formattedSpent}</span>
          <span className="lume-stat-label">Tổng chi tiêu tại LUMÉ</span>
        </div>
      </div>

      {/* 4. Gold Member */}
      <div className="lume-stat-card">
        <div className="lume-stat-icon-wrapper gold">
          <Star size={22} fill="currentColor" />
        </div>
        <div className="lume-stat-info">
          <span className="lume-stat-value">{stats.membershipTier || 'Gold Member'}</span>
          <span className="lume-stat-label">
            {stats.membershipExpiry ? `Hiệu lực đến ${stats.membershipExpiry}` : 'Thành viên thân thiết'}
          </span>
        </div>
      </div>
    </div>
  );
};
