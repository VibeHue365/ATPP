import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
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
  onContinuePayment: (bookingId: string) => void;
  onExplore: () => void;
  restrictionInfo?: {
    isRestricted?: boolean;
    restrictedReason?: string | null;
    restrictedAt?: string | null;
  } | null;
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
  onContinuePayment,
  onExplore,
  restrictionInfo
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with greeting and edit action */}
      <ProfileOverviewHeader
        fullName={fullName}
        onEditProfile={onEditProfile}
      />

      {/* Policy Violation / Overdue Restriction Banner */}
      {restrictionInfo?.isRestricted && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#FEE2E2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991B1B' }}>
                Tài khoản đang bị tạm khóa quyền thuê trang phục mới
              </h4>
              {restrictionInfo.restrictedAt && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, color: '#B91C1C', backgroundColor: '#FEE2E2', padding: '3px 10px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                  <Clock size={12} />
                  <span>Áp dụng từ {new Date(restrictionInfo.restrictedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#7F1D1D', lineHeight: 1.55 }}>
              <strong>Lý do vi phạm:</strong> {restrictionInfo.restrictedReason || 'Bạn đã vi phạm chính sách trả trang phục đúng hạn trên sàn TàGo (trễ hạn trả quá 2 giờ).'}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#991B1B', lineHeight: 1.5 }}>
              <strong>Thời hạn gỡ khóa:</strong> Tài khoản sẽ bị tạm khóa quyền đặt đơn mới <strong>cho đến khi bạn hoàn tất trả áo dài &amp; đối soát phí trễ hạn tại cửa hàng</strong> (hoặc được Quản trị viên xem xét gỡ hạn chế).
            </p>
          </div>
        </div>
      )}

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
          onContinuePayment={onContinuePayment}
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
