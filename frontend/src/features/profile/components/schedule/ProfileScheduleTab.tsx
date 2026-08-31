import React, { useState, useMemo } from 'react';
import { ScheduleHeaderSummary } from './ScheduleHeaderSummary';
import { ScheduleMasterTabs, type MasterCategoryType, type SubStatusFilterType } from './ScheduleMasterTabs';
import { ScheduleToolbar } from './ScheduleToolbar';
import { ScheduleUrgentAttentionSection } from './ScheduleUrgentAttentionSection';
import { ScheduleDataTable, type ScheduleRowItem } from './ScheduleDataTable';
import { useAuth } from '../../../auth/hooks/useAuth';
import '../ProfilePage.css';

interface ProfileScheduleTabProps {
  bookings: any[];
  isLoading?: boolean;
  activeCategory?: MasterCategoryType;
  onCategoryChange?: (category: MasterCategoryType) => void;
  onViewDetails: (booking: any) => void;
  onOpenReschedule: (item: any) => void;
  onOpenLocationChange?: (schedule: any) => void;
  onOpenCancel: (booking: any) => void;
  onOpenReview: (item: any) => void;
  onContinuePayment: (bookingId: string) => void;
  onNavigateTab?: (tabKey: any) => void;
}

export const ProfileScheduleTab: React.FC<ProfileScheduleTabProps> = ({
  bookings = [],
  activeCategory: activeCategoryProp,
  onCategoryChange,
  onViewDetails,
  onOpenReschedule,
  onOpenCancel,
  onOpenReview,
  onContinuePayment,
  onNavigateTab
}) => {
  const { user } = useAuth();

  const [internalCategory, setInternalCategory] = useState<MasterCategoryType>(activeCategoryProp || 'RENTAL');

  React.useEffect(() => {
    if (activeCategoryProp && activeCategoryProp !== internalCategory) {
      setInternalCategory(activeCategoryProp);
    }
  }, [activeCategoryProp]);

  const activeCategory = activeCategoryProp || internalCategory;
  const handleSelectCategory = (cat: MasterCategoryType) => {
    setInternalCategory(cat);
    onCategoryChange?.(cat);
  };

  const [activeStatus, setActiveStatus] = useState<SubStatusFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'NEAR_DUE' | 'NEWEST' | 'OLDEST'>('NEAR_DUE');

  // Helper tính khoảng cách ngày động
  const getDaysDiffText = (targetDateStr?: string | null, prefix = 'Sau') => {
    if (!targetDateStr) return '';
    const target = new Date(targetDateStr).getTime();
    if (isNaN(target)) return '';
    const now = new Date().setHours(0, 0, 0, 0);
    const targetMidnight = new Date(target).setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetMidnight - now) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Ngày mai';
    if (diffDays === -1) return 'Hôm qua';
    if (diffDays > 1) return `${prefix} ${diffDays} ngày`;
    if (diffDays < -1) return `Quá hạn ${Math.abs(diffDays)} ngày`;
    return '';
  };

  // Convert real bookings into table items (100% Dynamic)
  const tableItems: ScheduleRowItem[] = useMemo(() => {
    if (!bookings || bookings.length === 0) {
      return [];
    }

    const rows: ScheduleRowItem[] = [];

    bookings.forEach((b) => {
      (b.items || []).forEach((item: any, idx: number) => {
        const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
        const isCombo = item.itemType === 'COMBO' || (b.items && b.items.length > 1);

        // Check if matches activeCategory
        if (activeCategory === 'RENTAL' && isPhoto) return;
        if (activeCategory === 'PHOTOSHOOT' && !isPhoto) return;
        if (activeCategory === 'COMBO' && !isCombo) return;

        const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
        const prodObj = !isPhoto && item.productId && typeof item.productId === 'object' ? item.productId : null;

        const title =
          prodObj?.name ||
          pkgObj?.name ||
          item.packageSnapshot?.name ||
          item.name ||
          (isPhoto ? 'Gói Chụp Ảnh Nghệ Thuật' : 'Áo Dài Truyền Thống');

        const image =
          prodObj?.images?.[0] ||
          prodObj?.coverImage ||
          pkgObj?.coverImage ||
          item.images?.[0] ||
          item.coverImage ||
          item.image ||
          item.productImage;

        const size = isPhoto ? '' : (item.selectedSize || item.size || '');

        const rawStart = item.startDate || item.rentalFrom || item.shootDate || b.startDate;
        const rawEnd = item.endDate || item.rentalTo || b.endDate;

        let pickupDate = rawStart ? new Date(rawStart).toLocaleDateString('vi-VN') : 'Chưa đặt';
        let pickupTime = item.shootTimeSlot || item.pickupTime || '09:00';
        let returnDate = rawEnd ? new Date(rawEnd).toLocaleDateString('vi-VN') : '—';
        let returnTime = item.returnTime || '18:00';

        if (isPhoto) {
          pickupDate = item.shootDate || rawStart ? new Date(item.shootDate || rawStart).toLocaleDateString('vi-VN') : 'Chưa đặt';
          pickupTime = item.shootTimeSlot || '09:00 - 11:00';
          if (b.deliveredPhotos?.length > 0) {
            returnDate = 'Đã giao ảnh';
            returnTime = `${b.deliveredPhotos.length} ảnh`;
          } else if (rawStart) {
            const estimatedDelivery = new Date(new Date(rawStart).getTime() + 3 * 24 * 60 * 60 * 1000);
            returnDate = estimatedDelivery.toLocaleDateString('vi-VN');
            returnTime = 'Dự kiến trả ảnh';
          } else {
            returnDate = '3 ngày sau chụp';
            returnTime = 'Dự kiến trả ảnh';
          }
        }

        // Status configuration tailored by booking category
        let statusLabel = 'HOÀN TẤT';
        let statusSubtext = 'Đã hoàn tất';
        let statusBg = '#F2F4F4';
        let statusColor = '#574D4F';

        if (isPhoto) {
          if (b.status === 'DEPOSIT_PAID') {
            statusLabel = 'CHỜ DUYỆT';
            statusSubtext = 'Chờ thợ chụp xác nhận';
            statusBg = '#FFFBEB';
            statusColor = '#B45309';
          } else if (b.status === 'CONFIRMED') {
            statusLabel = 'SẮP CHỤP';
            statusSubtext = getDaysDiffText(item.shootDate || rawStart, 'Chụp sau') || 'Đã xác nhận lịch';
            statusBg = '#EFF6FF';
            statusColor = '#1D4ED8';
          } else if (b.status === 'IN_PROGRESS') {
            statusLabel = 'ĐANG CHỤP';
            statusSubtext = 'Đang thực hiện';
            statusBg = '#ECFDF5';
            statusColor = '#047857';
          } else if (b.status === 'AWAITING_REVIEW') {
            statusLabel = 'CHỜ DUYỆT ẢNH';
            statusSubtext = 'Đã có ảnh, vui lòng duyệt';
            statusBg = '#FEF3C7';
            statusColor = '#B45309';
          } else if (b.status === 'COMPLETED') {
            statusLabel = 'HOÀN TẤT';
            statusSubtext = 'Đã nhận đủ ảnh';
            statusBg = '#E8F8F5';
            statusColor = '#27AE60';
          } else if (b.status === 'CANCELLED') {
            statusLabel = 'ĐÃ HỦY';
            statusSubtext = 'Đơn đã hủy';
            statusBg = '#FDEDEC';
            statusColor = '#C0392B';
          } else if (b.status === 'PENDING_PAYMENT') {
            statusLabel = 'CHỜ CỌC';
            statusSubtext = 'Chưa thanh toán cọc';
            statusBg = '#FEF3C7';
            statusColor = '#B45309';
          }
        } else if (isCombo) {
          if (b.status === 'DEPOSIT_PAID') {
            statusLabel = 'CHỜ DUYỆT';
            statusSubtext = 'Chờ đối tác xác nhận';
            statusBg = '#FFFBEB';
            statusColor = '#B45309';
          } else if (b.status === 'CONFIRMED') {
            statusLabel = 'SẮP DIỄN RA';
            statusSubtext = getDaysDiffText(rawStart, 'Bắt đầu sau') || 'Đã xác nhận lịch';
            statusBg = '#EFF6FF';
            statusColor = '#1D4ED8';
          } else if (b.status === 'IN_PROGRESS' || b.status === 'PICKED_UP') {
            statusLabel = 'ĐANG TRẢI NGHIỆM';
            statusSubtext = 'Đang trong lịch trình';
            statusBg = '#ECFDF5';
            statusColor = '#047857';
          } else if (b.status === 'AWAITING_REVIEW') {
            statusLabel = 'CHỜ DUYỆT ẢNH';
            statusSubtext = 'Đã có ảnh, vui lòng duyệt';
            statusBg = '#FEF3C7';
            statusColor = '#B45309';
          } else if (b.status === 'COMPLETED' || b.status === 'RETURNED') {
            statusLabel = 'HOÀN TẤT';
            statusSubtext = 'Đã hoàn tất trải nghiệm';
            statusBg = '#E8F8F5';
            statusColor = '#27AE60';
          } else if (b.status === 'CANCELLED') {
            statusLabel = 'ĐÃ HỦY';
            statusSubtext = 'Đơn đã hủy';
            statusBg = '#FDEDEC';
            statusColor = '#C0392B';
          } else if (b.status === 'PENDING_PAYMENT') {
            statusLabel = 'CHỜ CỌC';
            statusSubtext = 'Chưa thanh toán cọc';
            statusBg = '#FEF3C7';
            statusColor = '#B45309';
          }
        } else {
          // RENTAL (Thuê áo dài)
          if (b.status === 'DEPOSIT_PAID') {
            statusLabel = 'CHỜ DUYỆT';
            statusSubtext = 'Chờ cửa hàng xác nhận';
            statusBg = '#FFFBEB';
            statusColor = '#B45309';
          } else if (b.status === 'CONFIRMED') {
            statusLabel = 'SẮP NHẬN';
            statusSubtext = getDaysDiffText(rawStart, 'Nhận sau') || 'Đã xác nhận lịch';
            statusBg = '#EFF6FF';
            statusColor = '#1D4ED8';
          } else if (b.status === 'PICKUP_PENDING') {
            statusLabel = 'SẴN SÀNG';
            statusSubtext = 'Đã chuẩn bị đồ';
            statusBg = '#F5EEF8';
            statusColor = '#8E44AD';
          } else if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS') {
            statusLabel = 'ĐANG THUÊ';
            statusSubtext = getDaysDiffText(rawEnd, 'Còn') || 'Đang trong thời gian thuê';
            statusBg = '#ECFDF5';
            statusColor = '#047857';
          } else if (b.status === 'RETURN_PENDING') {
            statusLabel = 'CHỜ TRẢ';
            statusSubtext = 'Đang kiểm tra đồ';
            statusBg = '#FEF9E7';
            statusColor = '#F39C12';
          } else if (b.status === 'RETURNED' || b.status === 'COMPLETED') {
            statusLabel = 'ĐÃ TRẢ';
            statusSubtext = 'Đã trả đúng hạn';
            statusBg = '#F2F4F4';
            statusColor = '#574D4F';
          } else if (b.status === 'CANCELLED') {
            statusLabel = 'ĐÃ HỦY';
            statusSubtext = 'Đơn đã hủy';
            statusBg = '#FDEDEC';
            statusColor = '#C0392B';
          } else if (b.status === 'PENDING_PAYMENT') {
            statusLabel = 'CHỜ CỌC';
            statusSubtext = 'Chưa thanh toán cọc';
            statusBg = '#FEF3C7';
            statusColor = '#B45309';
          }
        }

        // Nếu có yêu cầu đổi lịch đang chờ duyệt
        if (item.rescheduleRequest?.status === 'PENDING') {
          statusSubtext = 'Đang chờ duyệt đổi lịch';
        }

        rows.push({
          id: `${b._id}-${idx}`,
          bookingId: b._id,
          code: b.bookingCode || `RT-${b._id.slice(-4)}`,
          title,
          size,
          image,
          pickupDate,
          pickupTime,
          returnDate,
          returnTime,
          status: b.status,
          statusLabel,
          statusSubtext,
          statusBg,
          statusColor,
          booking: b,
          item
        });
      });
    });

    return rows;
  }, [bookings, activeCategory]);

  // Filtering
  const filteredItems = useMemo(() => {
    let list = [...tableItems];

    if (activeStatus === 'RENTING') {
      list = list.filter((r) => r.status === 'PICKED_UP' || r.status === 'IN_PROGRESS' || r.status === 'AWAITING_REVIEW');
    } else if (activeStatus === 'PICKUP_SOON') {
      list = list.filter((r) => r.status === 'PICKUP_PENDING' || r.status === 'CONFIRMED' || r.status === 'DEPOSIT_PAID');
    } else if (activeStatus === 'DUE_SOON') {
      list = list.filter((r) => r.status === 'PICKED_UP' || r.status === 'AWAITING_REVIEW');
    } else if (activeStatus === 'RETURNED') {
      list = list.filter((r) => r.status === 'RETURNED' || r.status === 'COMPLETED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
      );
    }

    return list;
  }, [tableItems, activeStatus, searchQuery]);

  // Dynamic Urgent Items (Overdue or Due Soon within 48h)
  const urgentItems = useMemo(() => {
    if (!bookings || bookings.length === 0) {
      return [];
    }

    const now = Date.now();
    const results: Array<{
      id: string;
      type: 'DUE_SOON' | 'OVERDUE';
      title: string;
      code: string;
      size: string;
      dueDate: string;
      countdownLabel: string;
      countdownValue: string;
      image?: string;
      booking?: any;
    }> = [];

    bookings.forEach((b) => {
      const isPickedUp = b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS';
      if (!isPickedUp) return;

      (b.items || []).forEach((item: any, idx: number) => {
        const rawEnd = item.endDate || item.rentalTo || b.endDate;
        if (!rawEnd) return;

        const dueTime = new Date(rawEnd).getTime();
        if (isNaN(dueTime)) return;

        const diffMs = dueTime - now;

        // 1. Quá hạn (Overdue)
        if (diffMs < 0) {
          const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);
          const days = Math.floor(diffHours / 24);
          const hours = Math.floor(diffHours % 24);

          const countdownValue = days > 0 ? `${days} ngày` : `${Math.max(1, hours)} giờ`;

          results.push({
            id: `urgent-${b._id}-${idx}`,
            type: 'OVERDUE',
            title: item.name || 'Trang phục thuê',
            code: b.bookingCode || `RT-${b._id.slice(-4)}`,
            size: item.selectedSize || item.size || '',
            dueDate: new Date(rawEnd).toLocaleDateString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }),
            countdownLabel: 'Quá hạn',
            countdownValue,
            image: item.images?.[0] || item.coverImage || item.image,
            booking: b
          });
        }
        // 2. Sắp đến hạn (Due soon <= 48h)
        else if (diffMs <= 48 * 60 * 60 * 1000) {
          const diffHours = diffMs / (1000 * 60 * 60);
          const days = Math.floor(diffHours / 24);
          const hours = Math.ceil(diffHours % 24);

          const countdownValue = days > 0 ? `${days} ngày` : `${Math.max(1, hours)} giờ`;

          results.push({
            id: `urgent-${b._id}-${idx}`,
            type: 'DUE_SOON',
            title: item.name || 'Trang phục thuê',
            code: b.bookingCode || `RT-${b._id.slice(-4)}`,
            size: item.selectedSize || item.size || '',
            dueDate: new Date(rawEnd).toLocaleDateString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }),
            countdownLabel: 'Còn',
            countdownValue,
            image: item.images?.[0] || item.coverImage || item.image,
            booking: b
          });
        }
      });
    });

    return results;
  }, [bookings]);

  // Dynamic Header Stats
  const headerStats = useMemo(() => {
    let activeRentals = 0;
    let upcomingShoots = 0;
    let upcomingCombos = 0;

    if (bookings && bookings.length > 0) {
      bookings.forEach((b) => {
        const isConfirmed = b.status === 'CONFIRMED' || b.status === 'PICKUP_PENDING';
        const isPickedUp = b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS';

        (b.items || []).forEach((item: any) => {
          const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
          const isCombo = item.itemType === 'COMBO' || (b.items && b.items.length > 1);

          if (isCombo && (isConfirmed || isPickedUp)) {
            upcomingCombos++;
          } else if (isPhoto && (isConfirmed || isPickedUp)) {
            upcomingShoots++;
          } else if (!isPhoto && isPickedUp) {
            activeRentals++;
          }
        });
      });
    }

    return {
      activeRentals,
      upcomingShoots,
      upcomingCombos,
      favoritesCount: (user as any)?.favorites?.length || 0
    };
  }, [bookings, user]);

  // Dynamic Category Counts
  const categoryCounts = useMemo(() => {
    let rentals = 0;
    let photoshoots = 0;
    let combos = 0;
    let subAll = 0;
    let subRenting = 0;
    let subPickupSoon = 0;
    let subReturned = 0;

    if (bookings && bookings.length > 0) {
      bookings.forEach((b) => {
        (b.items || []).forEach((item: any) => {
          const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
          const isCombo = item.itemType === 'COMBO' || (b.items && b.items.length > 1);

          if (isCombo) combos++;
          else if (isPhoto) photoshoots++;
          else rentals++;

          const matchesCategory =
            (activeCategory === 'RENTAL' && !isPhoto) ||
            (activeCategory === 'PHOTOSHOOT' && isPhoto) ||
            (activeCategory === 'COMBO' && isCombo);

          if (matchesCategory) {
            subAll++;
            if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS' || b.status === 'AWAITING_REVIEW') subRenting++;
            if (b.status === 'PICKUP_PENDING' || b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') subPickupSoon++;
            if (b.status === 'RETURNED' || b.status === 'COMPLETED') subReturned++;
          }
        });
      });

      return {
        rentals,
        photoshoots,
        combos,
        subAll,
        subRenting,
        subPickupSoon,
        subDueSoon: urgentItems.length,
        subReturned
      };
    }

    // Default counts when no bookings
    return {
      rentals: 0,
      photoshoots: 0,
      combos: 0,
      subAll: 0,
      subRenting: 0,
      subPickupSoon: 0,
      subDueSoon: 0,
      subReturned: 0
    };
  }, [bookings, activeCategory, urgentItems.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0 }}>
      {/* 1. Header & Greeting Summary */}
      <ScheduleHeaderSummary
        fullName={user?.fullName || 'Khách hàng LUMÉ'}
        onEditProfile={() => onNavigateTab?.('personal')}
        onViewUrgentDetail={() => urgentItems[0]?.booking && onViewDetails(urgentItems[0].booking)}
        urgentItem={urgentItems[0]}
        urgentCount={urgentItems.length}
        stats={headerStats}
      />

      {/* 2. Main Title: "Lịch của tôi" */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#231F20' }}>
          Lịch của tôi
        </h3>

        {/* Master Category Tabs & Secondary Filter Pills */}
        <ScheduleMasterTabs
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          activeStatus={activeStatus}
          onSelectStatus={setActiveStatus}
          counts={categoryCounts}
        />

        {/* Search & Sort & Action Toolbar */}
        <ScheduleToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          activeCategory={activeCategory}
        />
      </div>

      {/* 3. "Cần chú ý" Section (Only shown when there are real urgent items) */}
      {urgentItems.length > 0 && (
        <ScheduleUrgentAttentionSection
          urgentItems={urgentItems}
          onViewDetail={(u) => u.booking && onViewDetails(u.booking)}
        />
      )}

      {/* 4. "Tất cả lịch thuê (10)" Data Table */}
      <ScheduleDataTable
        items={filteredItems}
        totalCount={filteredItems.length}
        categoryLabel={activeCategory === 'PHOTOSHOOT' ? 'lịch chụp' : activeCategory === 'COMBO' ? 'combo' : 'lịch thuê'}
        onViewDetails={onViewDetails}
        onOpenReschedule={onOpenReschedule}
        onOpenCancel={onOpenCancel}
        onOpenReview={onOpenReview}
        onContinuePayment={onContinuePayment}
      />
    </div>
  );
};
