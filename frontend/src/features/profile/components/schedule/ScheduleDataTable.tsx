import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  CalendarCheck,
  Star,
  XCircle,
  CreditCard,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { ImageWithFallback } from '../../../../shared/media/ImageWithFallback';

export interface ScheduleRowItem {
  id: string;
  bookingId: string;
  code: string;
  title: string;
  size: string;
  image?: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  status: string;
  statusLabel: string;
  statusSubtext: string;
  statusBg: string;
  statusColor: string;
  booking: any;
  item: any;
}

interface ScheduleDataTableProps {
  items: ScheduleRowItem[];
  totalCount: number;
  categoryLabel?: string;
  onViewDetails: (booking: any) => void;
  onOpenReschedule: (item: any) => void;
  onOpenCancel: (booking: any) => void;
  onOpenReview: (item: any) => void;
  onContinuePayment: (bookingId: string) => void;
}

export const ScheduleDataTable: React.FC<ScheduleDataTableProps> = ({
  items,
  totalCount,
  categoryLabel = 'lịch thuê',
  onViewDetails,
  onOpenReschedule,
  onOpenCancel,
  onOpenReview,
  onContinuePayment
}) => {
  const [activeDropdown, setActiveDropdown] = useState<{
    id: string;
    bookingId: string;
    triggerRect: DOMRect;
    booking: any;
    item: any;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (!activeDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
      const isTrigger = (e.target as HTMLElement)?.closest('[data-dropdown-trigger="true"]');
      if (isTrigger) {
        return;
      }
      setActiveDropdown(null);
    };

    const handleScrollOrResize = () => {
      setActiveDropdown(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDropdown]);

  const toggleDropdown = (e: React.MouseEvent<HTMLButtonElement>, row: ScheduleRowItem) => {
    e.stopPropagation();
    if (activeDropdown?.id === row.id) {
      setActiveDropdown(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveDropdown({
        id: row.id,
        bookingId: row.bookingId,
        triggerRect: rect,
        booking: row.booking,
        item: row.item
      });
    }
  };

  const getDropdownStyle = (): React.CSSProperties => {
    if (!activeDropdown) return {};
    const rect = activeDropdown.triggerRect;
    const menuWidth = 184;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > 220;

    if (openUpward) {
      return {
        position: 'fixed',
        top: `${rect.top - 6}px`,
        left: `${left}px`,
        transform: 'translateY(-100%)',
        width: `${menuWidth}px`,
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #EFE9E1',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0,0,0,0.04)',
        zIndex: 9999,
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      };
    }

    return {
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${left}px`,
      width: `${menuWidth}px`,
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #EFE9E1',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0,0,0,0.04)',
      zIndex: 9999,
      padding: '6px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    };
  };

  const col1Header =
    categoryLabel === 'lịch chụp'
      ? 'GÓI CHỤP / DỊCH VỤ'
      : categoryLabel === 'combo'
      ? 'COMBO / DỊCH VỤ'
      : 'ÁO DÀI / DỊCH VỤ';

  const col2Header =
    categoryLabel === 'lịch chụp'
      ? 'NGÀY CHỤP'
      : categoryLabel === 'combo'
      ? 'NGÀY BẮT ĐẦU'
      : 'NGÀY NHẬN';

  const col3Header =
    categoryLabel === 'lịch chụp'
      ? 'TRẢ ẢNH / KHUNG GIỜ'
      : categoryLabel === 'combo'
      ? 'HẠN HOÀN TẤT'
      : 'HẠN TRẢ';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Section Heading */}
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#231F20' }}>
        Tất cả {categoryLabel} ({totalCount})
      </h3>

      {/* Main Table Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE9E1',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          overflow: 'hidden'
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#8C827A'
            }}
          >
            <Calendar size={36} color="#D5C9B8" />
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#4A3F35' }}>
              Chưa có {categoryLabel} nào được ghi nhận.
            </p>
            <span style={{ fontSize: '12px', color: '#8C827A' }}>
              Các lịch đặt của bạn sẽ tự động xuất hiện tại đây sau khi bạn hoàn tất đặt dịch vụ.
            </span>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ECE5DB', backgroundColor: '#FCFAF7' }}>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, color: '#7D736B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {col1Header}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#7D736B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {col2Header}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#7D736B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {col3Header}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#7D736B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      TRẠNG THÁI
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, color: '#7D736B', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                      THAO TÁC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid #F3EFE9',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FCFAF7')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  {/* Column 1: Item Thumbnail & Info */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '58px',
                          minWidth: '48px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: '#EAE6E1',
                          border: '1px solid rgba(0,0,0,0.06)'
                        }}
                      >
                        <ImageWithFallback
                          src={row.image}
                          alt={row.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          fallback={
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C827A' }}>
                              <ImageIcon size={16} />
                            </div>
                          }
                        />
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '13.5px', fontWeight: 800, color: '#231F20' }}>
                          {row.title}
                        </h4>
                        <span style={{ fontSize: '11.5px', color: '#7D736B' }}>
                          Mã thuê: {row.code} {row.size ? `• Size ${row.size}` : ''}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Pickup Date */}
                  <td style={{ padding: '14px 16px', fontSize: '12.5px', color: '#4A3F35' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <Calendar size={13} color="#8C827A" />
                      <span>{row.pickupDate}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#8C827A', marginLeft: '19px' }}>
                      {row.pickupTime}
                    </span>
                  </td>

                  {/* Column 3: Return Date */}
                  <td style={{ padding: '14px 16px', fontSize: '12.5px', color: '#4A3F35' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <Calendar size={13} color="#8C827A" />
                      <span>{row.returnDate}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#8C827A', marginLeft: '19px' }}>
                      {row.returnTime}
                    </span>
                  </td>

                  {/* Column 4: Status Badge */}
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: row.statusBg,
                        color: row.statusColor,
                        letterSpacing: '0.02em'
                      }}
                    >
                      {row.statusLabel}
                    </span>
                    {row.statusSubtext && (
                      <div style={{ fontSize: '11px', color: row.statusColor, marginTop: '2px', fontWeight: 600 }}>
                        {row.statusSubtext}
                      </div>
                    )}
                  </td>

                  {/* Column 5: Action Dropdown */}
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button
                      type="button"
                      data-dropdown-trigger="true"
                      onClick={(e) => toggleDropdown(e, row)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: activeDropdown?.id === row.id ? '#F8F5F1' : '#FFFFFF',
                        border: activeDropdown?.id === row.id ? '1px solid #8B1E2D' : '1px solid #DED7CB',
                        color: activeDropdown?.id === row.id ? '#8B1E2D' : '#4A3F35',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>Chi tiết</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transform: activeDropdown?.id === row.id ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease'
                        }}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #ECE5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: '#7D736B',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            Hiển thị {(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, items.length)} trong {totalCount} {categoryLabel}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Prev */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid #DED7CB',
                backgroundColor: '#FFFFFF',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4A3F35'
              }}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                onClick={() => setCurrentPage(pg)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: pg === currentPage ? '1px solid #8B1E2D' : '1px solid #DED7CB',
                  backgroundColor: pg === currentPage ? '#8B1E2D' : '#FFFFFF',
                  color: pg === currentPage ? '#FFFFFF' : '#4A3F35',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {pg}
              </button>
            ))}

            {/* Next */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid #DED7CB',
                backgroundColor: '#FFFFFF',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4A3F35'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </>
      )}
    </div>

    {/* Dropdown Menu Portaled to Body (Avoids Table Overflow / Scrolling Glitches) */}
    {activeDropdown &&
      createPortal(
        <div ref={dropdownRef} style={getDropdownStyle()}>
          {/* 1. Xem chi tiết */}
          <button
            type="button"
            onClick={() => {
              const booking = activeDropdown.booking;
              setActiveDropdown(null);
              onViewDetails(booking);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#231F20',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FDF2F4')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Eye size={14} color="#8B1E2D" />
            <span>Xem chi tiết</span>
          </button>

          {/* 2. Mở kho ảnh kết quả */}
          {(activeDropdown.booking.deliveredPhotos?.length > 0 || activeDropdown.booking.deliveryDriveUrl) && (
            <button
              type="button"
              onClick={() => {
                const booking = activeDropdown.booking;
                setActiveDropdown(null);
                onViewDetails(booking);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#1D4ED8',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Download size={14} />
              <span>Mở kho ảnh kết quả</span>
            </button>
          )}

          {/* 3. Đổi lịch hẹn */}
          {['CONFIRMED', 'DEPOSIT_PAID'].includes(activeDropdown.booking.status) && (
            <button
              type="button"
              onClick={() => {
                const item = activeDropdown.item;
                setActiveDropdown(null);
                onOpenReschedule(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#1D4ED8',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <CalendarCheck size={14} />
              <span>Đổi lịch hẹn</span>
            </button>
          )}

          {/* 4. Tiếp tục thanh toán */}
          {activeDropdown.booking.status === 'PENDING_PAYMENT' && (
            <button
              type="button"
              onClick={() => {
                const bId = activeDropdown.bookingId;
                setActiveDropdown(null);
                onContinuePayment(bId);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#8B1E2D',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FDF2F4')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <CreditCard size={14} />
              <span>Tiếp tục thanh toán</span>
            </button>
          )}

          {/* 5. Đánh giá dịch vụ */}
          {['COMPLETED', 'RETURNED'].includes(activeDropdown.booking.status) && (
            <button
              type="button"
              onClick={() => {
                const item = activeDropdown.item;
                setActiveDropdown(null);
                onOpenReview(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#D97706',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Star size={14} />
              <span>Đánh giá dịch vụ</span>
            </button>
          )}

          {/* 6. Hủy lịch */}
          {!['COMPLETED', 'CANCELLED', 'RETURNED'].includes(activeDropdown.booking.status) && (
            <button
              type="button"
              onClick={() => {
                const booking = activeDropdown.booking;
                setActiveDropdown(null);
                onOpenCancel(booking);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                borderTop: '1px dashed #ECE5DB'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <XCircle size={14} />
              <span>Hủy lịch</span>
            </button>
          )}
        </div>,
        document.body
      )}
  </div>
  );
};
