import React from 'react';
import { ProfileOverviewHeader } from './ProfileOverviewHeader';
import { ProfileQuickStats } from './ProfileQuickStats';
import { UpcomingScheduleCard } from './UpcomingScheduleCard';
import { RecentOrdersCard } from './RecentOrdersCard';
import { AnnualSpendingCard } from './AnnualSpendingCard';
import { SpecialOffersSection } from './SpecialOffersSection';
import type {
  QuickStatsData,
  UpcomingScheduleItem,
  RecentOrderItem,
  MonthlySpending,
  SpecialOfferItem
} from '../../types/profile.types';

interface ProfileOverviewTabProps {
  fullName?: string;
  onEditProfile: () => void;
  stats: QuickStatsData;
  upcomingSchedule: UpcomingScheduleItem[];
  recentOrders: RecentOrderItem[];
  monthlySpending?: MonthlySpending[];
  savingsAmount?: number;
  specialOffers?: SpecialOfferItem[];
  onViewAllSchedule: () => void;
  onViewAllOrders: () => void;
  onViewBookingDetails: (booking: any) => void;
  onExplore: () => void;
}

export const ProfileOverviewTab: React.FC<ProfileOverviewTabProps> = ({
  fullName,
  onEditProfile,
  stats,
  upcomingSchedule,
  recentOrders,
  monthlySpending,
  savingsAmount,
  specialOffers,
  onViewAllSchedule,
  onViewAllOrders,
  onViewBookingDetails,
  onExplore
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with greeting and edit action */}
      <ProfileOverviewHeader
        fullName={fullName}
        onEditProfile={onEditProfile}
      />

      {/* 2. 4-Card Quick Stats */}
      <ProfileQuickStats stats={stats} />

      {/* 3. 3-Column Mid Section */}
      <div className="lume-mid-section-grid">
        {/* Column 1: Lịch sắp tới */}
        <UpcomingScheduleCard
          items={upcomingSchedule}
          onViewAll={onViewAllSchedule}
          onViewDetails={onViewBookingDetails}
          onExplore={onExplore}
        />

        {/* Column 2: Đơn hàng gần đây */}
        <RecentOrdersCard
          orders={recentOrders}
          onViewAll={onViewAllOrders}
          onViewDetails={onViewBookingDetails}
        />

        {/* Column 3: Chi tiêu trong năm */}
        <AnnualSpendingCard
          totalSpent={stats.totalSpent}
          savingsAmount={savingsAmount}
          monthlyData={monthlySpending}
        />
      </div>

      {/* 4. Khối Ưu đãi đặc biệt */}
      <SpecialOffersSection
        offers={specialOffers}
        onViewAll={onViewAllOrders}
      />
    </div>
  );
};
