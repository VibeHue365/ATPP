import React, { useState, useMemo } from 'react';
import { ScheduleHeaderSummary } from './ScheduleHeaderSummary';
import { ScheduleMasterTabs, type MasterCategoryType, type SubStatusFilterType } from './ScheduleMasterTabs';
import { ScheduleToolbar } from './ScheduleToolbar';
import { ScheduleUrgentAttentionSection } from './ScheduleUrgentAttentionSection';
import { ScheduleDataTable, type ScheduleRowItem } from './ScheduleDataTable';
import { useAuth } from '../../../auth/hooks/useAuth';
import { includesVietnamese } from '../../../../utils/vietnameseUtils';
import { getBookingStatusMeta } from '../../../../utils/bookingStatus';
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
      const isBookingCombo =
        b.bookingType === 'COMBO' ||
        (b.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId) &&
          b.items?.some((i: any) => i.itemType === 'PRODUCT' || i.productId));

      // 1. COMBO BOOKING HANDLING (1 single row per combo)
      if (isBookingCombo) {
        if (activeCategory !== 'COMBO') return;

        const prodItem = b.items?.find((i: any) => i.itemType === 'PRODUCT' || i.productId);
        const pkgItem = b.items?.find((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId);

        const prodObj = prodItem?.productId && typeof prodItem.productId === 'object' ? prodItem.productId : null;
        const pkgObj = pkgItem?.photographyPackageId && typeof pkgItem.photographyPackageId === 'object' ? pkgItem.photographyPackageId : null;

        const comboTitle =
          b.comboName ||
          b.comboSnapshot?.name ||
          (pkgObj?.name && prodObj?.name ? `${pkgObj.name} • ${prodObj.name}` : null) ||
          pkgObj?.name ||
          prodObj?.name ||
          b.name ||
          'Combo Áo Dài & Chụp Ảnh Nghệ Thuật';

        const image =
          prodObj?.images?.[0] ||
          prodObj?.coverImage ||
          pkgObj?.coverImage ||
          pkgObj?.images?.[0] ||
          b.items?.[0]?.images?.[0] ||
          b.items?.[0]?.coverImage ||
          b.items?.[0]?.image;

        const size = prodItem?.selectedSize || prodItem?.size ? `Size ${prodItem.selectedSize || prodItem.size}` : '';

        const rawStart = prodItem?.rentalFrom || prodItem?.startDate || pkgItem?.shootDate || b.startDate;
        const rawEnd = prodItem?.rentalTo || prodItem?.endDate || b.endDate;

        let pickupDate = rawStart ? new Date(rawStart).toLocaleDateString('vi-VN') : 'Theo lịch';
        let pickupTime = prodItem?.pickupTime || '09:00';
        if (pkgItem?.shootTimeSlot) {
          pickupTime = `${pickupTime} • Chụp: ${pkgItem.shootTimeSlot}`;
        }

        let returnDate = rawEnd ? new Date(rawEnd).toLocaleDateString('vi-VN') : '—';
        let returnTime = prodItem?.returnTime ? `Trả đồ: ${prodItem.returnTime}` : 'Trả đồ';
        if (b.deliveredPhotos?.length > 0) {
          returnDate = 'Đã giao ảnh';
          returnTime = `${b.deliveredPhotos.length} ảnh`;
        } else if (pkgItem?.shootDate || rawStart) {
          const estimatedDelivery = new Date(new Date(pkgItem?.shootDate || rawStart).getTime() + 3 * 24 * 60 * 60 * 1000);
          returnDate = estimatedDelivery.toLocaleDateString('vi-VN');
          returnTime = 'Dự kiến trả ảnh';
        }

        const hasIncident = Boolean(
          b.activeIncident ||
          b.hasIncident ||
          b.statusTimeline?.some((t: any) =>
            t.status === 'RETURN_PENDING' &&
            (t.note?.includes('sự cố') || t.note?.includes('báo cáo') || t.note?.includes('đền bù') || t.note?.includes('hỏng'))
          )
        );
        const meta = getBookingStatusMeta(b.status, { hasPendingIncident: hasIncident });
        const statusLabel = meta.label.toUpperCase();
        const statusBg = meta.bg;
        const statusColor = meta.color;
        let statusSubtext = meta.label;

        if (b.status === 'CONFIRMED') {
          statusSubtext = getDaysDiffText(rawStart, 'Bắt đầu sau') || 'Đã xác nhận lịch combo';
        } else if (b.status === 'PICKUP_PENDING') {
          statusSubtext = 'Trang phục sẵn sàng, chờ nhận';
        } else if (b.status === 'PICKED_UP') {
          statusSubtext = 'Đã nhận đồ, sẵn sàng chụp';
        } else if (b.status === 'IN_PROGRESS') {
          statusSubtext = 'Đang trong buổi chụp';
        } else if (b.status === 'RETURN_PENDING') {
          statusSubtext = hasIncident ? 'Shop yêu cầu đền bù hư hỏng' : 'Đang kiểm tra trả đồ combo';
        } else if (b.status === 'AWAITING_REVIEW') {
          statusSubtext = 'Đã có ảnh, vui lòng xem & duyệt';
        } else if (b.status === 'COMBO_PHOTOS_APPROVED') {
          statusSubtext = 'Chờ hoàn tất trả đồ';
        } else if (b.status === 'RETURNED') {
          statusSubtext = 'Đã trả đồ, chờ hoàn cọc';
        } else if (b.status === 'COMPLETED') {
          statusSubtext = 'Đã hoàn tất trải nghiệm';
        } else if (b.status === 'DISPUTED') {
          statusSubtext = 'Đang xử lý khiếu nại';
        }

        rows.push({
          id: b._id,
          bookingId: b._id,
          code: b.bookingCode || `CB-${b._id.slice(-4)}`,
          title: comboTitle,
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
          item: prodItem || pkgItem || b.items?.[0]
        });
        return;
      }

      // 2. NON-COMBO BOOKINGS HANDLING (Grouped by date range within booking - Cấp độ 2)
      if (activeCategory === 'COMBO') return;

      const items = b.items || [];
      const isPhoto =
        b.bookingType === 'PHOTOGRAPHY' ||
        (items.length > 0 && items.every((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId));

      // Check if matches activeCategory
      if (activeCategory === 'RENTAL' && isPhoto) return;
      if (activeCategory === 'PHOTOSHOOT' && !isPhoto) return;

      // Group items in this booking by provider and rental date range (Tách dòng lịch nếu khác shop hoặc khác ngày thuê)
      const getItemDateRangeKey = (it: any) => {
        const provId = it.providerId ? (typeof it.providerId === 'object' ? it.providerId._id || it.providerId : it.providerId) : '';
        const start = it.startDate || it.rentalFrom || it.shootDate || b.startDate || '';
        const end = it.endDate || it.rentalTo || b.endDate || '';
        const startStr = start ? new Date(start).toISOString().split('T')[0] : '';
        const endStr = end ? new Date(end).toISOString().split('T')[0] : '';
        return `${provId}_${startStr}_${endStr}`;
      };

      const dateRangeGroups = new Map<string, any[]>();
      if (items.length === 0) {
        dateRangeGroups.set('default', []);
      } else {
        items.forEach((it: any) => {
          const key = getItemDateRangeKey(it);
          const grp = dateRangeGroups.get(key) || [];
          grp.push(it);
          dateRangeGroups.set(key, grp);
        });
      }

      dateRangeGroups.forEach((groupItems, dRangeKey) => {
        const firstGroupItem = groupItems[0] || {};
        const uniqueNames: string[] = [];
        groupItems.forEach((i: any) => {
          const pkgObj = isPhoto && i.photographyPackageId && typeof i.photographyPackageId === 'object' ? i.photographyPackageId : null;
          const prodObj = !isPhoto && i.productId && typeof i.productId === 'object' ? i.productId : null;
          const n = prodObj?.name || pkgObj?.name || i.packageSnapshot?.name || i.name || i.productName;
          if (n && !uniqueNames.includes(n)) uniqueNames.push(n);
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
          title = b.productName || (isPhoto ? 'Gói Chụp Ảnh Nghệ Thuật' : 'Áo Dài Truyền Thống');
        }

        const prodObj = !isPhoto && firstGroupItem.productId && typeof firstGroupItem.productId === 'object' ? firstGroupItem.productId : null;
        const pkgObj = isPhoto && firstGroupItem.photographyPackageId && typeof firstGroupItem.photographyPackageId === 'object' ? firstGroupItem.photographyPackageId : null;

        const image =
          prodObj?.images?.[0] ||
          prodObj?.coverImage ||
          pkgObj?.coverImage ||
          firstGroupItem.images?.[0] ||
          firstGroupItem.coverImage ||
          firstGroupItem.image ||
          firstGroupItem.productImage ||
          b.image;

        let size = '';
        if (!isPhoto) {
          const uniqueSizes: string[] = [];
          groupItems.forEach((i: any) => {
            const s = i.selectedSize || i.size;
            if (s && !uniqueSizes.includes(s)) uniqueSizes.push(s);
          });
          if (uniqueSizes.length > 0) size = uniqueSizes.join(', ');
        }

        const rawStart = firstGroupItem.startDate || firstGroupItem.rentalFrom || firstGroupItem.shootDate || b.startDate;
        const rawEnd = firstGroupItem.endDate || firstGroupItem.rentalTo || b.endDate;

        let pickupDate = rawStart ? new Date(rawStart).toLocaleDateString('vi-VN') : 'Chưa đặt';
        let pickupTime = firstGroupItem.shootTimeSlot || firstGroupItem.pickupTime || b.pickupTime || '09:00';
        let returnDate = rawEnd ? new Date(rawEnd).toLocaleDateString('vi-VN') : '—';
        let returnTime = firstGroupItem.returnTime || b.returnTime || '18:00';

        if (isPhoto) {
          pickupDate = firstGroupItem.shootDate || rawStart ? new Date(firstGroupItem.shootDate || rawStart).toLocaleDateString('vi-VN') : 'Chưa đặt';
          pickupTime = firstGroupItem.shootTimeSlot || b.shootTimeSlot || '09:00 - 11:00';
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

        const hasIncident = Boolean(
          b.activeIncident ||
          b.hasIncident ||
          b.statusTimeline?.some((t: any) =>
            t.status === 'RETURN_PENDING' &&
            (t.note?.includes('sự cố') || t.note?.includes('báo cáo') || t.note?.includes('đền bù') || t.note?.includes('hỏng'))
          )
        );
        const meta = getBookingStatusMeta(b.status, { hasPendingIncident: hasIncident });
        const statusLabel = meta.label.toUpperCase();
        const statusBg = meta.bg;
        const statusColor = meta.color;
        let statusSubtext = meta.label;

        if (isPhoto) {
          if (b.status === 'CONFIRMED') {
            statusSubtext = getDaysDiffText(firstGroupItem.shootDate || rawStart, 'Chụp sau') || 'Đã xác nhận lịch';
          } else if (b.status === 'IN_PROGRESS') {
            statusSubtext = 'Đang thực hiện';
          } else if (b.status === 'AWAITING_REVIEW') {
            statusSubtext = 'Đã có ảnh, vui lòng duyệt';
          } else if (b.status === 'COMPLETED') {
            statusSubtext = 'Đã nhận đủ ảnh';
          }
        } else {
          if (b.status === 'CONFIRMED') {
            statusSubtext = getDaysDiffText(rawStart, 'Nhận sau') || 'Đã xác nhận lịch';
          } else if (b.status === 'PICKUP_PENDING') {
            statusSubtext = 'Đã chuẩn bị đồ, chờ nhận';
          } else if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS') {
            statusSubtext = getDaysDiffText(rawEnd, 'Còn') || 'Đang trong thời gian thuê';
          } else if (b.status === 'RETURN_PENDING') {
            statusSubtext = hasIncident ? 'Shop yêu cầu đền bù hư hỏng' : 'Đang kiểm tra trả đồ';
          } else if (b.status === 'RETURNED') {
            statusSubtext = 'Đã trả đồ · Chờ hoàn cọc';
          } else if (b.status === 'COMPLETED') {
            statusSubtext = 'Đã hoàn tất đơn thuê';
          }
        }

        // Nếu có yêu cầu đổi lịch đang chờ duyệt
        if (groupItems.some((i: any) => i.rescheduleRequest?.status === 'PENDING')) {
          statusSubtext = 'Đang chờ duyệt đổi lịch';
        }

        rows.push({
          id: `${b._id}-${dRangeKey}`,
          bookingId: b._id,
          code: b.bookingCode || (isPhoto ? `PS-${b._id.slice(-4)}` : `RT-${b._id.slice(-4)}`),
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
          item: firstGroupItem
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
      list = list.filter((r) => r.status === 'RETURNED' || r.status === 'COMPLETED' || r.status === 'RETURN_PENDING');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      list = list.filter((r) => {
        const provName = r.booking?.provider?.businessName || r.booking?.provider?.fullName || '';
        const custName = r.booking?.customer?.fullName || r.booking?.customerName || '';
        return (
          includesVietnamese(r.title, q) ||
          includesVietnamese(r.code, q) ||
          includesVietnamese(provName, q) ||
          includesVietnamese(custName, q) ||
          includesVietnamese(r.statusLabel, q)
        );
      });
    }

    return list;
  }, [tableItems, activeStatus, searchQuery]);

  // Dynamic Urgent Items (Overdue or Due Soon within 48h, Grouped by Booking)
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

      const items = b.items || [];
      const firstItem = items[0] || {};
      const rawEnd = b.endDate || firstItem.endDate || firstItem.rentalTo;
      if (!rawEnd) return;

      const dueTime = new Date(rawEnd).getTime();
      if (isNaN(dueTime)) return;

      const diffMs = dueTime - now;

      const uniqueNames: string[] = [];
      items.forEach((i: any) => {
        const prodObj = i.productId && typeof i.productId === 'object' ? i.productId : null;
        const n = i.name || prodObj?.name || i.productName;
        if (n && !uniqueNames.includes(n)) uniqueNames.push(n);
      });
      const totalQty = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);
      let title = '';
      if (uniqueNames.length === 1) {
        title = totalQty > 1 ? `${uniqueNames[0]} (x${totalQty})` : uniqueNames[0];
      } else if (uniqueNames.length === 2) {
        title = `${uniqueNames[0]} + ${uniqueNames[1]}`;
      } else if (uniqueNames.length > 2) {
        title = `${uniqueNames[0]} + ${items.length - 1} sản phẩm khác`;
      } else {
        title = b.productName || 'Trang phục thuê';
      }

      const uniqueSizes: string[] = [];
      items.forEach((i: any) => {
        const s = i.selectedSize || i.size;
        if (s && !uniqueSizes.includes(s)) uniqueSizes.push(s);
      });
      const size = uniqueSizes.length > 0 ? `Size ${uniqueSizes.join(', ')}` : '';

      const image =
        firstItem.productId?.images?.[0] ||
        firstItem.productId?.coverImage ||
        firstItem.images?.[0] ||
        firstItem.coverImage ||
        firstItem.image ||
        firstItem.productImage;

      // 1. Quá hạn (Overdue)
      if (diffMs < 0) {
        const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);
        const days = Math.floor(diffHours / 24);
        const hours = Math.floor(diffHours % 24);

        const countdownValue = days > 0 ? `${days} ngày` : `${Math.max(1, hours)} giờ`;

        results.push({
          id: `urgent-${b._id}`,
          type: 'OVERDUE',
          title,
          code: b.bookingCode || `RT-${b._id.slice(-4)}`,
          size,
          dueDate: new Date(rawEnd).toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          countdownLabel: 'Quá hạn',
          countdownValue,
          image,
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
          id: `urgent-${b._id}`,
          type: 'DUE_SOON',
          title,
          code: b.bookingCode || `RT-${b._id.slice(-4)}`,
          size,
          dueDate: new Date(rawEnd).toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          countdownLabel: 'Còn',
          countdownValue,
          image,
          booking: b
        });
      }
    });

    return results;
  }, [bookings]);

  // Dynamic Header Stats
  const headerStats = useMemo(() => {
    let activeRentals = 0;
    let upcomingRentals = 0;
    let upcomingShoots = 0;
    let upcomingCombos = 0;

    if (bookings && bookings.length > 0) {
      bookings.forEach((b) => {
        const isUpcoming =
          b.status === 'CONFIRMED' ||
          b.status === 'DEPOSIT_PAID' ||
          b.status === 'PICKUP_PENDING';
        const isInUse =
          b.status === 'PICKED_UP' ||
          b.status === 'IN_PROGRESS' ||
          b.status === 'RETURN_PENDING' ||
          b.status === 'OVERDUE' ||
          b.status === 'AWAITING_REVIEW';

        const isCombo =
          b.bookingType === 'COMBO' ||
          (b.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId) &&
            b.items?.some((i: any) => i.itemType === 'PRODUCT' || i.productId));

        if (isCombo) {
          if (isUpcoming || isInUse) {
            upcomingCombos++;
          }
        } else {
          const isPhoto =
            b.bookingType === 'PHOTOGRAPHY' ||
            (b.items && b.items.length > 0 && b.items.every((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId));

          if (isPhoto) {
            if (isUpcoming || isInUse) {
              upcomingShoots++;
            }
          } else if (isInUse) {
            activeRentals++;
          } else if (isUpcoming) {
            upcomingRentals++;
          }
        }
      });
    }

    return {
      activeRentals,
      upcomingRentals,
      upcomingShoots,
      upcomingCombos,
      favoritesCount: (user as any)?.favorites?.length || 0
    };
  }, [bookings, user]);

  // Dynamic Category Counts (Counts bookings per category)
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
        const isCombo =
          b.bookingType === 'COMBO' ||
          (b.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId) &&
            b.items?.some((i: any) => i.itemType === 'PRODUCT' || i.productId));

        if (isCombo) {
          combos++;
          if (activeCategory === 'COMBO') {
            subAll++;
            if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS' || b.status === 'AWAITING_REVIEW') subRenting++;
            if (b.status === 'PICKUP_PENDING' || b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') subPickupSoon++;
            if (b.status === 'RETURNED' || b.status === 'COMPLETED' || b.status === 'RETURN_PENDING' || b.status === 'COMBO_PHOTOS_APPROVED') subReturned++;
          }
        } else {
          const isPhoto =
            b.bookingType === 'PHOTOGRAPHY' ||
            (b.items && b.items.length > 0 && b.items.every((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE' || i.photographyPackageId));

          if (isPhoto) {
            photoshoots++;
            if (activeCategory === 'PHOTOSHOOT') {
              subAll++;
              if (b.status === 'IN_PROGRESS' || b.status === 'AWAITING_REVIEW') subRenting++;
              if (b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') subPickupSoon++;
              if (b.status === 'COMPLETED') subReturned++;
            }
          } else {
            const items = b.items || [];
            const getItemDateRangeKey = (it: any) => {
              const provId = it.providerId ? (typeof it.providerId === 'object' ? it.providerId._id || it.providerId : it.providerId) : '';
              const start = it.startDate || it.rentalFrom || it.shootDate || b.startDate || '';
              const end = it.endDate || it.rentalTo || b.endDate || '';
              const startStr = start ? new Date(start).toISOString().split('T')[0] : '';
              const endStr = end ? new Date(end).toISOString().split('T')[0] : '';
              return `${provId}_${startStr}_${endStr}`;
            };
            const slotCount = items.length > 0 ? new Set(items.map(getItemDateRangeKey)).size : 1;

            rentals += slotCount;
            if (activeCategory === 'RENTAL') {
              subAll += slotCount;
              if (b.status === 'PICKED_UP' || b.status === 'IN_PROGRESS') subRenting += slotCount;
              if (b.status === 'PICKUP_PENDING' || b.status === 'CONFIRMED' || b.status === 'DEPOSIT_PAID') subPickupSoon += slotCount;
              if (b.status === 'RETURNED' || b.status === 'COMPLETED' || b.status === 'RETURN_PENDING') subReturned += slotCount;
            }
          }
        }
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
        fullName={user?.fullName || 'Khách hàng TàGo'}
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
