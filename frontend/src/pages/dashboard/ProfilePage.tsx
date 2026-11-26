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
import { CONTRACTS_V2_ENABLED } from '../../config/features';
import { contractService } from '../../services/contractService';
import { translateError } from '../../utils/errorTranslator';
import { getBookingStatusLabel, getBookingStatusMeta } from '../../utils/bookingStatus';
import { ContractReviewModal } from '../../components/contracts/ContractReviewModal';

// Sub-tabs & Modals lazy-loaded for optimal performance
const ProfilePersonalInfoTab = React.lazy(() => import('../../features/profile/components/tabs/ProfilePersonalInfoTab').then(m => ({ default: m.ProfilePersonalInfoTab })));
const ProfileScheduleTab = React.lazy(() => import('../../features/profile/components/schedule/ProfileScheduleTab').then(m => ({ default: m.ProfileScheduleTab })));
const ProfileRentalDetailPage = React.lazy(() => import('../../features/profile/components/rental-detail/ProfileRentalDetailPage').then(m => ({ default: m.ProfileRentalDetailPage })));
const ProfilePhotoshootDetailPage = React.lazy(() => import('../../features/profile/components/photoshoot-detail/ProfilePhotoshootDetailPage').then(m => ({ default: m.ProfilePhotoshootDetailPage })));
const ProfileComboDetailPage = React.lazy(() => import('../../features/profile/components/combo-detail/ProfileComboDetailPage').then(m => ({ default: m.ProfileComboDetailPage })));
const ProfileFavoritesTab = React.lazy(() => import('../../features/profile/components/tabs/ProfileFavoritesTab').then(m => ({ default: m.ProfileFavoritesTab })));
const ProfileAddressesTab = React.lazy(() => import('../../features/profile/components/tabs/ProfileAddressesTab').then(m => ({ default: m.ProfileAddressesTab })));
const ProfilePaymentsTab = React.lazy(() => import('../../features/profile/components/tabs/ProfilePaymentsTab').then(m => ({ default: m.ProfilePaymentsTab })));
const ProfileSecurityTab = React.lazy(() => import('../../features/profile/components/tabs/ProfileSecurityTab').then(m => ({ default: m.ProfileSecurityTab })));
const ProfileNotificationsTab = React.lazy(() => import('../../features/profile/components/tabs/ProfileNotificationsTab').then(m => ({ default: m.ProfileNotificationsTab })));
const ProfileContractsTab = React.lazy(() => import('../../features/profile/components/tabs/ProfileContractsTab').then(m => ({ default: m.ProfileContractsTab })));

const ProfileBookingDetailModal = React.lazy(() => import('../../features/profile/components/modals/ProfileBookingDetailModal').then(m => ({ default: m.ProfileBookingDetailModal })));
const ProfileRescheduleModal = React.lazy(() => import('../../features/profile/components/modals/ProfileRescheduleModal').then(m => ({ default: m.ProfileRescheduleModal })));
const ProfileLocationChangeModal = React.lazy(() => import('../../features/profile/components/modals/ProfileLocationChangeModal').then(m => ({ default: m.ProfileLocationChangeModal })));
const ProfileCancelBookingModal = React.lazy(() => import('../../features/profile/components/modals/ProfileCancelBookingModal').then(m => ({ default: m.ProfileCancelBookingModal })));
const ProfileReviewModal = React.lazy(() => import('../../features/profile/components/modals/ProfileReviewModal').then(m => ({ default: m.ProfileReviewModal })));

const ProfileTabLoader: React.FC = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(192, 130, 97, 0.2)', borderTopColor: 'var(--color-primary, #C08261)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '14px', color: 'var(--color-text-muted, #888)' }}>Đang tải dữ liệu...</span>
    </div>
  </div>
);


import type {
  ProfileTab,
  QuickStatsData,
  UpcomingScheduleItem,
  RecentOrderItem,
  MonthlySpending,
  SpecialOfferItem
} from '../../features/profile/types/profile.types';

interface ProfileTabErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ProfileTabErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ProfileTabErrorBoundary extends React.Component<ProfileTabErrorBoundaryProps, ProfileTabErrorBoundaryState> {
  constructor(props: ProfileTabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ProfileTabErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ProfileTabErrorBoundary] Uncaught rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '36px 24px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #FCD34D', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800, color: '#92400E' }}>
            Không thể tải thông tin chi tiết
          </h3>
          <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#7D736B' }}>
            Đã có sự cố khi kết xuất dữ liệu này. Bạn có thể quay lại danh sách để tiếp tục thao tác.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset?.();
            }}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#8E1B2E', color: '#FFFFFF', fontSize: '13px', fontWeight: 750, cursor: 'pointer' }}
          >
            Quay lại danh sách
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restrictionInfo, setRestrictionInfo] = React.useState<{
    isRestricted?: boolean;
    restrictedReason?: string | null;
    restrictedAt?: string | null;
    restrictedUntil?: string | null;
  } | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    httpClient.get<any>('/users/me')
      .then((me) => {
        if (isMounted && me) {
          setRestrictionInfo({
            isRestricted: Boolean(me.isRestricted),
            restrictedReason: me.restrictedReason || null,
            restrictedAt: me.restrictedAt || null,
            restrictedUntil: me.restrictedUntil || null,
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Active Tab state (synced with URL query param if present)
  const initialTab = (searchParams.get('tab') as ProfileTab) || 'overview';
  const rawCategory = searchParams.get('category')?.toUpperCase();
  const initialCategory: 'RENTAL' | 'PHOTOSHOOT' | 'COMBO' =
    rawCategory === 'PHOTOSHOOT' || rawCategory === 'COMBO' ? rawCategory : 'RENTAL';

  const [activeTab, setActiveTab] = useState<ProfileTab>(
    ['overview', 'personal', 'schedule', 'contracts', 'favorites', 'addresses', 'payments', 'security', 'notifications'].includes(
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
      ['overview', 'personal', 'schedule', 'contracts', 'favorites', 'addresses', 'payments', 'security', 'notifications'].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
    const catParam = searchParams.get('category')?.toUpperCase();
    if (catParam === 'RENTAL' || catParam === 'PHOTOSHOOT' || catParam === 'COMBO') {
      setScheduleCategory(catParam);
    }
  }, [searchParams]);

  const [viewingRentalBooking, setViewingRentalBooking] = useState<any | null>(null);
  const notificationBookingId = searchParams.get('bookingId');

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
  const [pendingContractBookingId, setPendingContractBookingId] = useState<string | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

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
    const handler = (payload: { bookingId: string; status: string; bookingCode?: string }) => {
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
      setViewingRentalBooking((prev: any) => {
        if (prev && (prev._id === payload.bookingId || prev.bookingCode === payload.bookingCode)) {
          httpClient
            .get<any>('/api/bookings/' + payload.bookingId)
            .then((fresh) => {
              if (fresh) setViewingRentalBooking(fresh);
            })
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

  // Synchronize viewingRentalBooking whenever master bookings list updates
  useEffect(() => {
    if (viewingRentalBooking?._id && bookings.length > 0) {
      const updated = bookings.find((b) => b._id === viewingRentalBooking._id);
      if (updated && (updated.status !== viewingRentalBooking.status || updated.updatedAt !== viewingRentalBooking.updatedAt)) {
        setViewingRentalBooking(updated);
      }
    }
  }, [bookings, viewingRentalBooking?._id]);

  // Notifications link directly to a booking. Resolve that id after the
  // bookings list has loaded so a pending-payment notification immediately
  // opens the existing detail modal with its payment action.
  useEffect(() => {
    if (!notificationBookingId || !bookings.length) return;
    const target = bookings.find((booking) => String(booking._id) === String(notificationBookingId));
    if (target && activeDetailBooking?._id !== target._id) {
      setActiveDetailBooking(target);
    }
  }, [notificationBookingId, bookings, activeDetailBooking?._id]);

  // Auto-refresh when tab becomes active (e.g. switching between Provider and Customer tabs)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchBookings(true);
        if (viewingRentalBooking?._id) {
          httpClient
            .get<any>('/api/bookings/' + viewingRentalBooking._id)
            .then((fresh) => {
              if (fresh) setViewingRentalBooking(fresh);
            })
            .catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [viewingRentalBooking?._id]);

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

  // 2. Compute Upcoming Schedule Items for Column 1 (100% Dynamic, Grouped by Date Range)
  const upcomingSchedule: UpcomingScheduleItem[] = useMemo(() => {
    const activeBookings = bookings.filter((b) =>
      ['CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'AWAITING_REVIEW', 'PICKED_UP', 'PICKUP_PENDING'].includes(
        b.status
      )
    );

    const list: UpcomingScheduleItem[] = [];

    activeBookings.forEach((b) => {
      const items = b.items || [];
      const firstItem = items[0] || {};
      const isBookingCombo =
        b.bookingType === 'COMBO' ||
        (items.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId) &&
          items.some((i: any) => i.itemType === 'PRODUCT' || i.productId));
      const isPhoto =
        !isBookingCombo &&
        (b.bookingType === 'PHOTOGRAPHY' ||
          (items.length > 0 && items.every((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId)));

      // Combo or Photography: 1 card per booking
      if (isBookingCombo || isPhoto || items.length === 0) {
        const rawDate = b.startDate || firstItem.rentalFrom || firstItem.startDate || firstItem.shootDate;
        const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('vi-VN') : 'Sắp tới';

        let badgeStatus: UpcomingScheduleItem['badgeStatus'] = 'UPCOMING';
        let badgeLabel = 'SẮP TỚI';
        let countdownText = 'Sắp diễn ra';

        if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS') {
          badgeStatus = 'ACTIVE';
          badgeLabel = isPhoto ? 'ĐANG CHỤP' : 'ĐANG THUÊ';
          countdownText = isPhoto ? 'Đang trong buổi chụp' : 'Đang trong thời gian thuê';
        } else if (b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') {
          badgeStatus = 'URGENT';
          badgeLabel = 'SẮP ĐẾN HẠN';
          countdownText = 'Sắp diễn ra';
        } else if (b.status === 'PICKUP_PENDING') {
          badgeStatus = 'UPCOMING';
          badgeLabel = getBookingStatusLabel('PICKUP_PENDING', { uppercase: true });
          countdownText = 'Sẵn sàng nhận đồ';
        } else if (b.status === 'AWAITING_REVIEW') {
          badgeStatus = 'URGENT';
          badgeLabel = getBookingStatusLabel('AWAITING_REVIEW', { uppercase: true });
          countdownText = 'Cần duyệt ảnh';
        }

        let title = '';
        if (isBookingCombo) {
          title = b.comboName || b.comboSnapshot?.name || 'Combo Áo Dài & Chụp Ảnh';
        } else {
          const uniqueNames: string[] = [];
          items.forEach((i: any) => {
            const pkgObj = i.photographyPackageId && typeof i.photographyPackageId === 'object' ? i.photographyPackageId : null;
            const name = i.name || pkgObj?.name || i.packageSnapshot?.name || i.productName;
            if (name && !uniqueNames.includes(name)) uniqueNames.push(name);
          });
          const totalQty = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);
          if (uniqueNames.length === 1) {
            title = totalQty > 1 ? `${uniqueNames[0]} (x${totalQty})` : uniqueNames[0];
          } else if (uniqueNames.length === 2) {
            title = `${uniqueNames[0]} + ${uniqueNames[1]}`;
          } else if (uniqueNames.length > 2) {
            title = `${uniqueNames[0]} + ${items.length - 1} sản phẩm khác`;
          } else {
            title = b.productName || 'Gói Chụp Ảnh Cổ Phong';
          }
        }

        list.push({
          id: b._id,
          bookingId: b._id,
          bookingCode: b.bookingCode || (isPhoto ? `PS-${b._id.slice(-4)}` : `RT-${b._id.slice(-4)}`),
          type: isBookingCombo ? 'COMBO' : 'PHOTOSHOOT',
          title,
          code: b.bookingCode || (isPhoto ? `PS-${b._id.slice(-4)}` : `RT-${b._id.slice(-4)}`),
          timeSlot: firstItem.shootTimeSlot || (isPhoto ? '18:00' : undefined),
          dateStr,
          countdownText,
          badgeStatus,
          badgeLabel,
          booking: b
        });
        return;
      }

      // Rental Bookings: Group by provider & date range (Tách card lịch nếu khác shop hoặc khác ngày)
      const getItemDateRangeKey = (it: any) => {
        const provId = it.providerId ? (typeof it.providerId === 'object' ? it.providerId._id || it.providerId : it.providerId) : '';
        const start = it.startDate || it.rentalFrom || b.startDate || '';
        const end = it.endDate || it.rentalTo || b.endDate || '';
        const startStr = start ? new Date(start).toISOString().split('T')[0] : '';
        const endStr = end ? new Date(end).toISOString().split('T')[0] : '';
        return `${provId}_${startStr}_${endStr}`;
      };

      const dateRangeGroups = new Map<string, any[]>();
      items.forEach((it: any) => {
        const key = getItemDateRangeKey(it);
        const grp = dateRangeGroups.get(key) || [];
        grp.push(it);
        dateRangeGroups.set(key, grp);
      });

      dateRangeGroups.forEach((groupItems, dRangeKey) => {
        const firstGroupItem = groupItems[0] || {};
        const rawDate = firstGroupItem.startDate || firstGroupItem.rentalFrom || b.startDate;
        const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('vi-VN') : 'Sắp tới';

        let badgeStatus: UpcomingScheduleItem['badgeStatus'] = 'UPCOMING';
        let badgeLabel = 'SẮP TỚI';
        let countdownText = 'Sắp diễn ra';

        if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS') {
          badgeStatus = 'ACTIVE';
          badgeLabel = 'ĐANG THUÊ';
          countdownText = 'Đang trong thời gian thuê';
        } else if (b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') {
          badgeStatus = 'URGENT';
          badgeLabel = 'SẮP ĐẾN HẠN';
          countdownText = 'Sắp diễn ra';
        } else if (b.status === 'PICKUP_PENDING') {
          badgeStatus = 'UPCOMING';
          badgeLabel = getBookingStatusLabel('PICKUP_PENDING', { uppercase: true });
          countdownText = 'Sẵn sàng nhận đồ';
        }

        const uniqueNames: string[] = [];
        groupItems.forEach((i: any) => {
          const prodObj = i.productId && typeof i.productId === 'object' ? i.productId : null;
          const name = i.name || prodObj?.name || i.productName;
          if (name && !uniqueNames.includes(name)) uniqueNames.push(name);
        });
        const totalQty = groupItems.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);

        let title = '';
        if (uniqueNames.length === 1) {
          title = totalQty > 1 ? `${uniqueNames[0]} (x${totalQty})` : uniqueNames[0];
        } else if (uniqueNames.length === 2) {
          title = `${uniqueNames[0]} + ${uniqueNames[1]}`;
        } else if (uniqueNames.length > 2) {
          title = `${uniqueNames[0]} + ${groupItems.length - 1} sản phẩm khác`;
        } else {
          title = b.productName || 'Áo Dài Di Sản';
        }

        const uniqueSizes: string[] = [];
        const uniqueColors: string[] = [];
        groupItems.forEach((i: any) => {
          const s = i.selectedSize || i.size;
          const c = i.selectedColor || i.color;
          if (s && !uniqueSizes.includes(s)) uniqueSizes.push(s);
          if (c && !uniqueColors.includes(c)) uniqueColors.push(c);
        });
        const size = uniqueSizes.length > 0 ? `Size ${uniqueSizes.join(', ')}` : undefined;
        const color = uniqueColors.length > 0 ? `Màu ${uniqueColors.join(', ')}` : undefined;

        list.push({
          id: `${b._id}-${dRangeKey}`,
          bookingId: b._id,
          bookingCode: b.bookingCode || `RT-${b._id.slice(-4)}`,
          type: 'RENTAL',
          title,
          code: b.bookingCode || `RT-${b._id.slice(-4)}`,
          size,
          color,
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

  // 3. Compute Recent Orders for Column 2 (100% Dynamic, Grouped by Booking)
  const recentOrders: RecentOrderItem[] = useMemo(() => {
    return bookings.slice(0, 4).map((b) => {
      const items = b.items || [];
      const isBookingCombo =
        b.bookingType === 'COMBO' ||
        (items.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId) &&
          items.some((i: any) => i.itemType === 'PRODUCT' || i.productId));
      const isPhoto =
        !isBookingCombo &&
        (b.bookingType === 'PHOTOGRAPHY' ||
          (items.length > 0 && items.every((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId)));

      const statusInfo = getBookingStatusMeta(b.status);

      let orderTitle = '';
      if (isBookingCombo) {
        orderTitle = b.comboName || b.comboSnapshot?.name || 'Combo Áo Dài & Chụp Ảnh';
      } else {
        const uniqueNames: string[] = [];
        items.forEach((i: any) => {
          const prodObj = !isPhoto && i.productId && typeof i.productId === 'object' ? i.productId : null;
          const pkgObj = isPhoto && i.photographyPackageId && typeof i.photographyPackageId === 'object' ? i.photographyPackageId : null;
          const name = i.name || prodObj?.name || pkgObj?.name || i.packageSnapshot?.name || i.productName;
          if (name && !uniqueNames.includes(name)) {
            uniqueNames.push(name);
          }
        });
        const totalQty = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);

        if (uniqueNames.length === 1) {
          orderTitle = totalQty > 1 ? `${uniqueNames[0]} (x${totalQty})` : uniqueNames[0];
        } else if (uniqueNames.length === 2) {
          orderTitle = `${uniqueNames[0]} + ${uniqueNames[1]}`;
        } else if (uniqueNames.length > 2) {
          orderTitle = `${uniqueNames[0]} + ${items.length - 1} sản phẩm khác`;
        } else {
          orderTitle = b.productName || (isPhoto ? 'Gói Chụp Ảnh Nghệ Thuật' : 'Áo Dài Di Sản');
        }
      }

      return {
        id: b._id,
        bookingId: b._id,
        bookingCode: b.bookingCode || `DH-${b._id.slice(-4)}`,
        title: orderTitle,
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

  // 5. Dynamic Special Offers from DB (with tier-based fallback for cold start)
  const [dbOffers, setDbOffers] = useState<SpecialOfferItem[]>([]);

  useEffect(() => {
    let active = true;
    const fetchOffers = async () => {
      try {
        const rawTier = quickStats.membershipTier.includes('Diamond')
          ? 'DIAMOND'
          : quickStats.membershipTier.includes('Gold')
            ? 'GOLD'
            : 'SILVER';
        const res: any = await httpClient.get(`/promotions/public?tier=${rawTier}`);
        if (active && Array.isArray(res) && res.length > 0) {
          const mapped: SpecialOfferItem[] = res.map((p: any) => ({
            id: p._id || p.id,
            code: p.code,
            title: p.name || `Ưu đãi ${p.code}`,
            description: p.description || 'Áp dụng cho các đơn đặt trên TàGo',
            expiryDate: p.endDate ? new Date(p.endDate).toLocaleDateString('vi-VN') : 'Vô thời hạn',
            type: p.discountType === 'PERCENTAGE' ? 'DISCOUNT_PERCENT' : 'DISCOUNT_FIXED',
            discountValue: p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `${Number(p.discountValue).toLocaleString('vi-VN')}đ`,
          }));
          setDbOffers(mapped);
        }
      } catch (err) {
        console.warn('Không thể tải danh sách ưu đãi từ DB:', err);
      }
    };
    void fetchOffers();
    return () => {
      active = false;
    };
  }, [quickStats.membershipTier]);

  const specialOffers: SpecialOfferItem[] = useMemo(() => {
    return dbOffers;
  }, [dbOffers]);

  // Actions
  const proceedToPaymentLink = async (bookingId: string) => {
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

  const handleContinuePayment = async (bookingId: string) => {
    if (CONTRACTS_V2_ENABLED) {
      try {
        const readiness = await contractService.getBookingReadiness(bookingId);
        if (readiness.requirement === 'REQUIRED' && !readiness.ready) {
          setPendingContractBookingId(bookingId);
          setIsContractModalOpen(true);
          return;
        }
      } catch (readinessErr: any) {
        toast.error(translateError(readinessErr?.message) || 'Không thể kiểm tra trạng thái hợp đồng điện tử');
        return;
      }
    }

    await proceedToPaymentLink(bookingId);
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Đăng xuất tài khoản?',
      text: 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản TàGo không? Phiên làm việc sẽ kết thúc an toàn.',
      iconHtml: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="vh-logout-icon-svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Ở lại',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: 'vh-swal-popup vh-swal-logout',
        icon: 'vh-swal-logout-icon',
        confirmButton: 'vh-swal-logout-confirm',
        cancelButton: 'vh-swal-logout-cancel',
      }
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
            <ProfileTabErrorBoundary onReset={() => setViewingRentalBooking(null)}>
              <React.Suspense fallback={<ProfileTabLoader />}>
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
                onContinuePayment={handleContinuePayment}
                onExplore={() => navigate('/rentals')}
                restrictionInfo={restrictionInfo}
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
                    onOpenReschedule={(item) => {
                      const targetBooking = bookings.find((b) => b.items?.some((i: any) => i._id === item?._id)) || viewingRentalBooking || bookings[0];
                      setRescheduleBooking(targetBooking);
                      setRescheduleItem(item);
                    }}
                    onOpenCancel={(b) => setBookingToCancel(b)}
                    onContinuePayment={handleContinuePayment}
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

            {activeTab === 'contracts' && (
              <ProfileContractsTab onNavigateRental={() => handleSelectTab('schedule', 'RENTAL')} />
            )}

            {activeTab === 'favorites' && <ProfileFavoritesTab />}

            {activeTab === 'addresses' && <ProfileAddressesTab />}

            {activeTab === 'payments' && <ProfilePaymentsTab />}

            {activeTab === 'security' && <ProfileSecurityTab />}

            {activeTab === 'notifications' && <ProfileNotificationsTab />}
              </React.Suspense>
            </ProfileTabErrorBoundary>
          </main>
        </div>
      </div>

      {/* -------------------- MODALS -------------------- */}
      <React.Suspense fallback={null}>
      

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
          onRefreshBooking={() => fetchBookings(true)}
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

      {/* 6. Modal Hợp đồng điện tử */}
      {CONTRACTS_V2_ENABLED && pendingContractBookingId && (
        <ContractReviewModal
          isOpen={isContractModalOpen}
          bookingId={pendingContractBookingId}
          onClose={() => {
            setIsContractModalOpen(false);
            setPendingContractBookingId(null);
          }}
          onAllAccepted={() => {
            const bId = pendingContractBookingId;
            setIsContractModalOpen(false);
            setPendingContractBookingId(null);
            if (bId) {
              void proceedToPaymentLink(bId);
            }
          }}
        />
      )}
      </React.Suspense>
    </div>
  );
};

export default ProfilePage;
