import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useSocket } from '../../context/SocketContext';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { ROUTES } from '../../config/routes';

// Feature Components & Styles
import '../../features/profile/components/ProfilePage.css';
import { ProfileSidebar } from '../../features/profile/components/ProfileSidebar';
import { ProfileOverviewTab } from '../../features/profile/components/overview/ProfileOverviewTab';
import { ProfilePersonalInfoTab } from '../../features/profile/components/tabs/ProfilePersonalInfoTab';
import { ProfileScheduleTab } from '../../features/profile/components/schedule/ProfileScheduleTab';
import { ProfileRentalDetailPage } from '../../features/profile/components/rental-detail/ProfileRentalDetailPage';
import { ProfilePhotoshootDetailPage } from '../../features/profile/components/photoshoot-detail/ProfilePhotoshootDetailPage';
import { ProfileComboDetailPage } from '../../features/profile/components/combo-detail/ProfileComboDetailPage';
import { ProfileFavoritesTab } from '../../features/profile/components/tabs/ProfileFavoritesTab';
import { ProfileAddressesTab } from '../../features/profile/components/tabs/ProfileAddressesTab';
import { ProfilePaymentsTab } from '../../features/profile/components/tabs/ProfilePaymentsTab';
import { ProfileSecurityTab } from '../../features/profile/components/tabs/ProfileSecurityTab';
import { ProfileNotificationsTab } from '../../features/profile/components/tabs/ProfileNotificationsTab';

// Modals
import { ProfileBookingDetailModal } from '../../features/profile/components/modals/ProfileBookingDetailModal';
import { ProfileRescheduleModal } from '../../features/profile/components/modals/ProfileRescheduleModal';
import { ProfileLocationChangeModal } from '../../features/profile/components/modals/ProfileLocationChangeModal';
import { ProfileCancelBookingModal } from '../../features/profile/components/modals/ProfileCancelBookingModal';
import { ProfileReviewModal } from '../../features/profile/components/modals/ProfileReviewModal';


import type {
  ProfileTab,
  QuickStatsData,
  UpcomingScheduleItem,
  RecentOrderItem,
  MonthlySpending,
  SpecialOfferItem
} from '../../features/profile/types/profile.types';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab state (synced with URL query param if present)
  const initialTab = (searchParams.get('tab') as ProfileTab) || 'overview';
  const rawCategory = searchParams.get('category')?.toUpperCase();
  const initialCategory: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO' =
    rawCategory === 'PHOTOSHOOT' || rawCategory === 'COMBO' ? rawCategory : 'RENTAL';

  const [activeTab, setActiveTab] = useState<ProfileTab>(
    ['overview', 'personal', 'schedule', 'favorites', 'addresses', 'payments', 'security', 'notifications'].includes(
      initialTab
    )
      ? initialTab
      : 'overview'
  );
  const [scheduleCategory, setScheduleCategory] = useState<'RENTAL' | 'PHOTOSHOOT' | 'COMBO'>(initialCategory);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as ProfileTab;
    if (
      tabParam &&
      tabParam !== activeTab &&
      ['overview', 'personal', 'schedule', 'favorites', 'addresses', 'payments', 'security', 'notifications'].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
    const catParam = searchParams.get('category')?.toUpperCase();
    if (catParam === 'RENTAL' || catParam === 'PHOTOSHOOT' || catParam === 'COMBO') {
      setScheduleCategory(catParam);
    }
  }, [searchParams]);

  const [viewingRentalBooking, setViewingRentalBooking] = useState<any | null>(null);

  const handleSelectTab = (tab: ProfileTab, category?: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO') => {
    setActiveTab(tab);
    setViewingRentalBooking(null);
    if (tab === 'schedule') {
      const nextCategory = category || scheduleCategory || 'RENTAL';
      setScheduleCategory(nextCategory);
      setSearchParams({ tab: 'schedule', category: nextCategory.toLowerCase() });
    } else if (tab === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  // Bookings list state
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  // Modals state
  const [activeDetailBooking, setActiveDetailBooking] = useState<any | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [rescheduleItem, setRescheduleItem] = useState<any | null>(null);
  const [locationChangeSchedule, setLocationChangeSchedule] = useState<any | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<any | null>(null);
  const [reviewingItem, setReviewingItem] = useState<any | null>(null);
  const [bookingIncident, setBookingIncident] = useState<any | null>(null);

  const fetchBookings = async (silent = false) => {
    if (!silent) setIsLoadingBookings(true);
    try {
      const data = await httpClient.get<any[]>('/api/bookings');
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách đơn hàng:', err);
    } finally {
      if (!silent) setIsLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Real-time socket event listener for booking updates
  const { socket } = useSocket();
  const fetchBookingsRef = useRef(fetchBookings);
  useEffect(() => {
    fetchBookingsRef.current = fetchBookings;
  });

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { bookingId: string; status: string }) => {
      console.log('[RT] booking_updated received', payload);
      fetchBookingsRef.current(true);
      setActiveDetailBooking((prev: any) => {
        if (prev && prev._id === payload.bookingId) {
          httpClient
            .get<any>('/api/bookings/' + payload.bookingId)
            .then((fresh) => setActiveDetailBooking(fresh))
            .catch(() => {});
        }
        return prev;
      });
    };
    socket.on('booking_updated', handler);
    return () => {
      socket.off('booking_updated', handler);
    };
  }, [socket]);

  // Load incident details when viewing booking detail
  useEffect(() => {
    if (!activeDetailBooking?._id) {
      setBookingIncident(null);
      return;
    }
    httpClient
      .get<any | null>(`/api/disputes/incidents/booking/${activeDetailBooking._id}`)
      .then((inc) => setBookingIncident(inc && inc._id ? inc : null))
      .catch(() => setBookingIncident(null));
  }, [activeDetailBooking?._id]);

  // 1. Compute Quick Stats
  // 1. Compute Quick Stats (100% Dynamic from bookings & user)
  const quickStats: QuickStatsData = useMemo(() => {
    let photoCount = 0;
    let totalSpent = 0;

    bookings.forEach((b) => {
      if (b.items) {
        b.items.forEach((item: any) => {
          if (item.itemType === 'PHOTOGRAPHY_PACKAGE') photoCount++;
        });
      }
      if (['COMPLETED', 'CONFIRMED', 'DEPOSIT_PAID', 'PICKED_UP', 'RETURNED'].includes(b.status)) {
        totalSpent += b.pricingSummary?.grandTotal || b.totalAmount || 0;
      }
    });

    const favCount = (user as any)?.favorites?.length || 0;

    let tier: QuickStatsData['membershipTier'] = 'Silver Member';
    if (totalSpent >= 5000000) {
      tier = 'Diamond Member';
    } else if (totalSpent >= 1000000) {
      tier = 'Gold Member';
    }

    const currentYear = new Date().getFullYear();

    return {
      photoshootsCount: photoCount,
      favoritesCount: favCount,
      totalSpent: totalSpent,
      membershipTier: tier,
      membershipExpiry: `31/12/${currentYear}`
    };
  }, [bookings, user]);

  // 2. Compute Upcoming Schedule Items for Column 1 (100% Dynamic)
  const upcomingSchedule: UpcomingScheduleItem[] = useMemo(() => {
    const activeBookings = bookings.filter((b) =>
      ['CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'AWAITING_REVIEW', 'PICKED_UP', 'PICKUP_PENDING'].includes(
        b.status
      )
    );

    const list: UpcomingScheduleItem[] = [];

    activeBookings.forEach((b) => {
      (b.items || []).forEach((item: any, idx: number) => {
        const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
        const rawDate = item.shootDate || item.startDate || item.rentalFrom || b.startDate;
        const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('vi-VN') : 'Sắp tới';

        let badgeStatus: UpcomingScheduleItem['badgeStatus'] = 'UPCOMING';
        let badgeLabel = 'SẮP TỚI';
        let countdownText = 'Sắp diễn ra';

        if (b.status === 'PICKED_UP') {
          badgeStatus = 'ACTIVE';
          badgeLabel = 'ĐANG THUÊ';
          countdownText = 'Đang trong thời gian thuê';
        } else if (b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') {
          badgeStatus = 'URGENT';
          badgeLabel = 'SẮP ĐẾN HẠN';
          countdownText = 'Sắp diễn ra';
        }

        list.push({
          id: `${b._id}-${idx}`,
          bookingId: b._id,
          bookingCode: b.bookingCode || `RT-${b._id.slice(-4)}`,
          type: isPhoto ? 'PHOTOSHOOT' : 'RENTAL',
          title: item.name || (isPhoto ? 'Gói Chụp Ảnh Cổ Phong' : 'Áo Dài Nhật Bình Cung Đình'),
          code: b.bookingCode || `RT-${b._id.slice(-4)}`,
          size: item.selectedSize || item.size || 'M',
          color: item.selectedColor || item.color,
          timeSlot: item.shootTimeSlot || (isPhoto ? '18:00' : undefined),
          dateStr,
          countdownText,
          badgeStatus,
          badgeLabel,
          booking: b
        });
      });
    });

    return list;
  }, [bookings]);

  // 3. Compute Recent Orders for Column 2 (100% Dynamic)
  const recentOrders: RecentOrderItem[] = useMemo(() => {
    const statusBadges: Record<string, { label: string; bg: string; color: string }> = {
      CONFIRMED: { label: 'Sắp nhận', bg: '#EFF6FF', color: '#1D4ED8' },
      DEPOSIT_PAID: { label: 'Đã cọc', bg: '#EBF5FB', color: '#2980B9' },
      PICKED_UP: { label: 'Đang thuê', bg: '#ECFDF5', color: '#047857' },
      COMPLETED: { label: 'Đã hoàn thành', bg: '#E8F8F5', color: '#27AE60' },
      RETURNED: { label: 'Đã trả', bg: '#F2F4F4', color: '#574D4F' },
      CANCELLED: { label: 'Đã hủy', bg: '#FDEDEC', color: '#C0392B' }
    };

    return bookings.slice(0, 4).map((b) => {
      const firstItem = b.items?.[0] || {};
      const isPhoto = firstItem.itemType === 'PHOTOGRAPHY_PACKAGE';
      const statusInfo = statusBadges[b.status] || {
        label: b.status,
        bg: '#F2F4F4',
        color: '#574D4F'
      };

      return {
        id: b._id,
        bookingId: b._id,
        bookingCode: b.bookingCode || `DH-${b._id.slice(-4)}`,
        title: firstItem.name || (isPhoto ? 'Gói Chụp Ảnh Nghệ Thuật' : 'Áo Dài Truyền Thống'),
        dateStr: b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : 'Gần đây',
        amount: b.pricingSummary?.grandTotal || b.totalAmount || 0,
        status: b.status,
        statusLabel: statusInfo.label,
        statusBg: statusInfo.bg,
        statusColor: statusInfo.color,
        booking: b
      };
    });
  }, [bookings]);

  // 4. Compute 12-Month Dynamic Spending & Savings
  const monthlySpending: MonthlySpending[] = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthsMap: MonthlySpending[] = Array.from({ length: 12 }, (_, i) => ({
      month: `T${i + 1}`,
      monthNumber: i + 1,
      amount: 0,
      heightPercent: 12
    }));

    bookings.forEach((b) => {
      if (['COMPLETED', 'CONFIRMED', 'DEPOSIT_PAID', 'PICKED_UP', 'RETURNED'].includes(b.status)) {
        const d = new Date(b.createdAt || b.startDate || Date.now());
        if (d.getFullYear() === currentYear) {
          const mIndex = d.getMonth();
          if (mIndex >= 0 && mIndex < 12) {
            monthsMap[mIndex].amount += b.pricingSummary?.grandTotal || b.totalAmount || 0;
          }
        }
      }
    });

    const maxAmount = Math.max(1, ...monthsMap.map((m) => m.amount));
    return monthsMap.map((m) => ({
      ...m,
      heightPercent: m.amount > 0 ? Math.max(15, Math.round((m.amount / maxAmount) * 100)) : 12
    }));
  }, [bookings]);

  const totalSavings = useMemo(() => {
    let savings = 0;
    bookings.forEach((b) => {
      if (b.pricingSummary?.discountAmount) {
        savings += b.pricingSummary.discountAmount;
      } else if (b.pricingSummary?.couponDiscount) {
        savings += b.pricingSummary.couponDiscount;
      }
    });
    return savings;
  }, [bookings]);

  // 5. Dynamic Special Offers tailored to membership tier
  const specialOffers: SpecialOfferItem[] = useMemo(() => {
    const year = new Date().getFullYear();
    if (quickStats.membershipTier === 'Diamond Member') {
      return [
        {
          id: 'offer-diamond-1',
          code: 'DIAMOND15',
          title: 'Đặc quyền Diamond VIP - Giảm 15%',
          description: 'Áp dụng cho mọi đơn thuê áo dài & gói chụp nghệ thuật',
          expiryDate: `31/12/${year}`,
          type: 'TIER_VIP',
          discountValue: '15%'
        },
        {
          id: 'offer-diamond-2',
          code: 'FREESHIPVIP',
          title: 'Miễn phí giao nhận hỏa tốc',
          description: 'Áp dụng cho tất cả các đơn thuê trang phục trong năm',
          expiryDate: `31/12/${year}`,
          type: 'DISCOUNT_FIXED',
          discountValue: '100.000đ'
        }
      ];
    }
    if (quickStats.membershipTier === 'Gold Member') {
      return [
        {
          id: 'offer-gold-1',
          code: 'GOLD10',
          title: 'Ưu đãi Gold Member - Giảm 10%',
          description: 'Áp dụng cho đơn thuê áo dài từ 500.000đ',
          expiryDate: `31/12/${year}`,
          type: 'TIER_VIP',
          discountValue: '10%'
        },
        {
          id: 'offer-gold-2',
          code: 'COMBO150',
          title: 'Giảm 150.000đ gói chụp ảnh',
          description: 'Áp dụng cho các combo đặt trọn gói từ 1.500.000đ',
          expiryDate: `31/12/${year}`,
          type: 'DISCOUNT_FIXED',
          discountValue: '150.000đ'
        }
      ];
    }
    // Silver / New Member
    return [
      {
        id: 'offer-welcome-1',
        code: 'LUMEWELCOME',
        title: 'Mã chào mừng thành viên mới - Giảm 10%',
        description: 'Áp dụng cho đơn thuê áo dài đầu tiên tại LUMÉ',
        expiryDate: `31/12/${year}`,
        type: 'DISCOUNT_PERCENT',
        discountValue: '10%'
      },
      {
        id: 'offer-combo-1',
        code: 'COMBOPROMO',
        title: 'Ưu đãi Combo - Giảm 100.000đ',
        description: 'Áp dụng khi đặt trọn gói áo dài & chụp ảnh',
        expiryDate: `31/12/${year}`,
        type: 'DISCOUNT_FIXED',
        discountValue: '100.000đ'
      }
    ];
  }, [quickStats.membershipTier]);

  // Actions
  const handleContinuePayment = async (bookingId: string) => {
    try {
      toast.info('Đang kết nối cổng thanh toán...');
      const paymentRes: any = await httpClient.post('/payments/create-link', {
        bookingId,
        purpose: 'FULL_PAYMENT'
      });
      if (paymentRes.payos && paymentRes.payos.checkoutUrl) {
        toast.success('Đang chuyển hướng tới cổng thanh toán PayOS...');
        setTimeout(() => {
          window.location.href = paymentRes.payos.checkoutUrl;
        }, 1000);
      } else {
        toast.error('Không tìm thấy liên kết thanh toán cho đơn này.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi kết nối cổng thanh toán.');
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Đăng xuất?',
      text: 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản LUMÉ không?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#8B1E2D',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Ở lại'
    });

    if (result.isConfirmed) {
      await logout();
      navigate(ROUTES.LOGIN);
    }
  };

  return (
    <div className="lume-profile-page-wrapper">
      <div className="lume-profile-page-container">
        {/* Two-Column Grid Layout */}
        <div className="lume-profile-grid-layout">
          {/* Left Column: Sidebar Navigation */}
          <ProfileSidebar
            activeTab={activeTab}
            scheduleCategory={scheduleCategory}
            onSelectTab={handleSelectTab}
            onLogout={handleLogout}
            favoritesCount={(user as any)?.favorites?.length || 0}
            userRoles={user?.roles}
            onNavigateProvider={() => navigate(ROUTES.PROVIDER_DASHBOARD)}
          />

          {/* Right Column: Main Content View */}
          <main className="lume-profile-main-content">
            {activeTab === 'overview' && (
              <ProfileOverviewTab
                fullName={user?.fullName}
                onEditProfile={() => handleSelectTab('personal')}
                stats={quickStats}
                upcomingSchedule={upcomingSchedule}
                recentOrders={recentOrders}
                monthlySpending={monthlySpending}
                savingsAmount={totalSavings}
                specialOffers={specialOffers}
                onViewAllSchedule={() => handleSelectTab('schedule')}
                onViewAllOrders={() => handleSelectTab('schedule')}
                onViewBookingDetails={(b) => b && setActiveDetailBooking(b)}
                onExplore={() => navigate('/rentals')}
              />
            )}

            {activeTab === 'personal' && (
              <ProfilePersonalInfoTab
                stats={quickStats}
                bookings={bookings}
                onNavigateTab={handleSelectTab}
              />
            )}

            {activeTab === 'schedule' && (
              viewingRentalBooking ? (
                viewingRentalBooking.bookingType === 'COMBO' ||
                (viewingRentalBooking.items && viewingRentalBooking.items.length > 1 && viewingRentalBooking.items.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE')) ? (
                  <ProfileComboDetailPage
                    booking={viewingRentalBooking}
                    onBack={() => setViewingRentalBooking(null)}
                    onOpenReschedule={(item) => {
                      const targetBooking = bookings.find((b) => b.items?.some((i: any) => i._id === item?._id)) || viewingRentalBooking || bookings[0];
                      setRescheduleBooking(targetBooking);
                      setRescheduleItem(item);
                    }}
                    onOpenLocationChange={(sched) => setLocationChangeSchedule(sched)}
                    onOpenCancel={(b) => setBookingToCancel(b)}
                    onOpenReview={(item) => setReviewingItem(item)}
                    onRefreshBooking={async () => {
                      await fetchBookings(true);
                      try {
                        const data = await httpClient.get<any[]>('/api/bookings');
                        const list = Array.isArray(data) ? data : [];
                        const updated = list.find((b: any) => b._id === viewingRentalBooking._id);
                        if (updated) setViewingRentalBooking(updated);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                ) : viewingRentalBooking.bookingType === 'PHOTOGRAPHY' ||
                  viewingRentalBooking.items?.[0]?.itemType === 'PHOTOGRAPHY_PACKAGE' ? (
                  <ProfilePhotoshootDetailPage
                    booking={viewingRentalBooking}
                    onBack={() => setViewingRentalBooking(null)}
                    onOpenReschedule={(item) => {
                      const targetBooking = bookings.find((b) => b.items?.some((i: any) => i._id === item?._id)) || viewingRentalBooking || bookings[0];
                      setRescheduleBooking(targetBooking);
                      setRescheduleItem(item);
                    }}
                    onOpenLocationChange={(sched) => setLocationChangeSchedule(sched)}
                    onOpenCancel={(b) => setBookingToCancel(b)}
                    onOpenReview={(item) => setReviewingItem(item)}
                    onRefreshBooking={async () => {
                      await fetchBookings(true);
                      try {
                        const data = await httpClient.get<any[]>('/api/bookings');
                        const list = Array.isArray(data) ? data : [];
                        const updated = list.find((b: any) => b._id === viewingRentalBooking._id);
                        if (updated) setViewingRentalBooking(updated);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                ) : (
                  <ProfileRentalDetailPage
                    booking={viewingRentalBooking}
                    onBack={() => setViewingRentalBooking(null)}
                    onOpenRescheduleOrExtend={(item) => {
                      const targetBooking = bookings.find((b) => b.items?.some((i: any) => i._id === item?._id)) || viewingRentalBooking || bookings[0];
                      setRescheduleBooking(targetBooking);
                      setRescheduleItem(item);
                    }}
                    onOpenCancel={(b) => setBookingToCancel(b)}
                  />
                )
              ) : (
                <ProfileScheduleTab
                  bookings={bookings}
                  isLoading={isLoadingBookings}
                  activeCategory={scheduleCategory}
                  onCategoryChange={(cat) => handleSelectTab('schedule', cat)}
                  onViewDetails={(b) => setViewingRentalBooking(b)}
                  onOpenReschedule={(item) => {
                    const targetBooking = bookings.find((b) => b.items?.some((i: any) => i._id === item._id)) || bookings[0];
                    setRescheduleBooking(targetBooking);
                    setRescheduleItem(item);
                  }}
                  onOpenLocationChange={(sched) => setLocationChangeSchedule(sched)}
                  onOpenCancel={(b) => setBookingToCancel(b)}
                  onOpenReview={(item) => setReviewingItem(item)}
                  onContinuePayment={handleContinuePayment}
                  onNavigateTab={handleSelectTab}
                />
              )
            )}

            {activeTab === 'favorites' && <ProfileFavoritesTab />}

            {activeTab === 'addresses' && <ProfileAddressesTab />}

            {activeTab === 'payments' && <ProfilePaymentsTab />}

            {activeTab === 'security' && <ProfileSecurityTab />}

            {activeTab === 'notifications' && <ProfileNotificationsTab />}
          </main>
        </div>
      </div>

      {/* -------------------- MODALS -------------------- */}

      {/* 1. Modal Chi tiết Đơn hàng */}
      {activeDetailBooking && (
        <ProfileBookingDetailModal
          booking={activeDetailBooking}
          user={user}
          bookingIncident={bookingIncident}
          onClose={() => setActiveDetailBooking(null)}
          onOpenReschedule={(item) => {
            setRescheduleBooking(activeDetailBooking);
            setRescheduleItem(item || activeDetailBooking.items?.[0]);
          }}
          onOpenCancel={(b) => setBookingToCancel(b)}
          onContinuePayment={handleContinuePayment}
          onOpenReview={(item) => setReviewingItem(item)}
          onOpenLocationChange={(sched) => setLocationChangeSchedule(sched)}
        />
      )}

      {/* 2. Modal Đổi lịch hẹn (UC-E06) */}
      {rescheduleBooking && rescheduleItem && (
        <ProfileRescheduleModal
          booking={rescheduleBooking}
          item={rescheduleItem}
          onClose={() => {
            setRescheduleBooking(null);
            setRescheduleItem(null);
          }}
          onSuccess={() => {
            fetchBookings();
            setActiveDetailBooking(null);
          }}
        />
      )}

      {/* 3. Modal Đổi địa điểm chụp */}
      {locationChangeSchedule && activeDetailBooking && (
        <ProfileLocationChangeModal
          bookingId={activeDetailBooking._id}
          schedule={locationChangeSchedule}
          onClose={() => setLocationChangeSchedule(null)}
          onSuccess={() => {
            fetchBookings();
            if (activeDetailBooking?._id) {
              httpClient
                .get<any>(`/api/bookings/${activeDetailBooking._id}`)
                .then((fresh) => setActiveDetailBooking(fresh));
            }
          }}
        />
      )}

      {/* 4. Modal Hủy đơn */}
      {bookingToCancel && (
        <ProfileCancelBookingModal
          booking={bookingToCancel}
          onClose={() => setBookingToCancel(null)}
          onSuccess={() => {
            fetchBookings();
            setActiveDetailBooking(null);
          }}
        />
      )}

      {/* 5. Modal Đánh giá dịch vụ */}
      {reviewingItem && (
        <ProfileReviewModal
          item={reviewingItem}
          onClose={() => setReviewingItem(null)}
          onSuccess={() => {
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

export default ProfilePage;
