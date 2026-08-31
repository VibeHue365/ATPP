import React from 'react';
import { ProfileUserCardHeader } from '../personal/ProfileUserCardHeader';
import { PersonalInfoFormCard } from '../personal/PersonalInfoFormCard';
import { PaymentMethodsCard } from '../personal/PaymentMethodsCard';
import { RecentActivitiesCard } from '../personal/RecentActivitiesCard';
import { MembershipTierCard } from '../personal/MembershipTierCard';
import { SavedAddressesCard } from '../personal/SavedAddressesCard';
import { NotificationPreferencesCard } from '../personal/NotificationPreferencesCard';
import type { QuickStatsData, ProfileTab } from '../../types/profile.types';

interface ProfilePersonalInfoTabProps {
  stats?: QuickStatsData;
  bookings?: any[];
  onNavigateTab?: (tabKey: ProfileTab) => void;
}

export const ProfilePersonalInfoTab: React.FC<ProfilePersonalInfoTabProps> = ({
  stats = {
    photoshootsCount: 0,
    favoritesCount: 0,
    totalSpent: 0,
    membershipTier: 'Silver Member',
    membershipExpiry: `31/12/${new Date().getFullYear()}`
  },
  bookings = [],
  onNavigateTab = () => {}
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header User Card with Stats & Sub Navigation Tabs */}
      <ProfileUserCardHeader
        stats={stats}
        onNavigateTab={onNavigateTab}
      />

      {/* 2. Double-Column Layout */}
      <div className="lume-personal-columns-grid">
        {/* Left Column (~60% width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PersonalInfoFormCard />
          <PaymentMethodsCard />
          <RecentActivitiesCard bookings={bookings} />
        </div>

        {/* Right Column (~40% width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <MembershipTierCard stats={stats} />
          <SavedAddressesCard
            onViewAllAddresses={() => onNavigateTab('addresses')}
          />
          <NotificationPreferencesCard
            onViewAllNotifications={() => onNavigateTab('notifications')}
          />
        </div>
      </div>
    </div>
  );
};
