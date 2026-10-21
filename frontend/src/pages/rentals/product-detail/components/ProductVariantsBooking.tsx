import React from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Shield,
} from 'lucide-react';
import type { CalendarDay, ProductDetail, RentalMode } from '../types';
import { productSlots, formatSingleDate } from '../utils/timeSlotUtils';
import { translateColorHex } from '../utils/colorUtils';

interface ProductVariantsBookingProps {
  product: ProductDetail;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  selectedSize: string;
  onSelectSize: (size: string) => void;
  rentalMode: RentalMode;
  onChangeRentalMode: (mode: RentalMode) => void;
  calendarDate: Date;
  onChangeCalendarDate: (date: Date) => void;
  calendarDays: CalendarDay[];
  onSelectCalendarDay: (dateStr: string) => void;
  startDate: string;
  endDate: string;
  singleDate: string;
  startTime: string;
  endTime: string;
  onSelectSlot: (index: number) => void;
  bookedSlotsOnSelectedDate: string[];
  isTimeSlotOverlap: (slot1: string, slot2: string) => boolean;
  startSlotIndex: number;
  endSlotIndex: number;
  isCurrentTimeSlotBusy: boolean;
  availability: any;
  bookingQty: number;
  onChangeBookingQty: React.Dispatch<React.SetStateAction<number>>;
  onAddToCart: () => void;
  onRentNow: () => void;
}

export const ProductVariantsBooking: React.FC<ProductVariantsBookingProps> = ({
  product,
  selectedColor,
  onSelectColor,
  selectedSize,
  onSelectSize,
  rentalMode,
  onChangeRentalMode,
  calendarDate,
  onChangeCalendarDate,
  calendarDays,
  onSelectCalendarDay,
  startDate,
  endDate,
  singleDate,
  startTime,
  endTime,
  onSelectSlot,
  bookedSlotsOnSelectedDate,
  isTimeSlotOverlap,
  startSlotIndex,
  endSlotIndex,
  isCurrentTimeSlotBusy,
  availability,
  bookingQty,
  onChangeBookingQty,
  onAddToCart,
  onRentNow,
}) => {
  const isActionDisabled =
    isCurrentTimeSlotBusy ||
    availability.state === 'checking' ||
    availability.state === 'unavailable';

  return (
    <>
      {/* Colors Selection */}
      {product.colors && product.colors.length > 0 && (
        <div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            MÀU SẮC: {selectedColor}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
            {product.colors.map((c) => {
              const isSelected = selectedColor === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSelectColor(c)}
                  title={c}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: translateColorHex(c),
                    border: isSelected
                      ? '2px solid var(--color-primary)'
                      : '1px solid rgba(0,0,0,0.15)',
                    boxShadow: isSelected
                      ? '0 0 0 2px white, var(--shadow-sm)'
                      : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Sizes Selection */}
      {product.sizes && product.sizes.length > 0 && (
        <div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            KÍCH CỠ: {selectedSize}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
            {product.sizes.map((s) => {
              const isSelected = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelectSize(s)}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    backgroundColor: isSelected
                      ? 'var(--color-primary)'
                      : 'white',
                    color: isSelected ? 'white' : 'var(--color-text-primary)',
                    border: isSelected
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--color-light-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '56px',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TIME SELECTION WIDGET */}
      <div className="vh-pd-time-widget">
        {/* Switcher Tab */}
        <div className="vh-pd-time-tabs">
          <button
            type="button"
            onClick={() => onChangeRentalMode('DAILY')}
            className={`vh-pd-time-tab-btn ${rentalMode === 'DAILY' ? 'active' : ''}`}
          >
            Thuê Theo Ngày
          </button>
          <button
            type="button"
            onClick={() => onChangeRentalMode('HOURLY')}
            className={`vh-pd-time-tab-btn ${rentalMode === 'HOURLY' ? 'active' : ''}`}
          >
            Thuê Theo Giờ
          </button>
        </div>

        {/* Selector Panels */}
        <div className="vh-pd-time-body">
          <div className="vh-pd-time-panels-grid">
            {/* LEFT: Calendar Grid */}
            <div>
              {/* Month navigation header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calendarDate);
                    d.setMonth(d.getMonth() - 1);
                    onChangeCalendarDate(d);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calendarDate);
                    d.setMonth(d.getMonth() + 1);
                    onChangeCalendarDate(d);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Calendar grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '4px',
                  textAlign: 'center',
                }}
              >
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
                  <span
                    key={w}
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#8C827A',
                      padding: '4px 0',
                    }}
                  >
                    {w}
                  </span>
                ))}
                {calendarDays.map((d, idx) => {
                  if (d.isEmpty) return <div key={`empty-${idx}`} />;

                  const isDaySelected =
                    rentalMode === 'HOURLY'
                      ? singleDate === d.dateStr
                      : startDate === d.dateStr || endDate === d.dateStr;

                  const isDayInRange =
                    rentalMode === 'DAILY' &&
                    startDate &&
                    endDate &&
                    d.dateStr > startDate &&
                    d.dateStr < endDate;

                  return (
                    <button
                      key={d.day}
                      type="button"
                      disabled={!d.isAvailable}
                      onClick={() => onSelectCalendarDay(d.dateStr)}
                      style={{
                        aspectRatio: '1',
                        border: isDaySelected
                          ? '2px solid var(--color-primary-dark)'
                          : '1px solid transparent',
                        borderRadius: '8px',
                        backgroundColor: isDaySelected
                          ? 'var(--color-primary-dark)'
                          : isDayInRange
                            ? '#FFF0F1'
                            : !d.isAvailable
                              ? '#F5F5F5'
                              : d.isWeekend
                                ? '#FCF9F2'
                                : '#FFFFFF',
                        color: !d.isAvailable
                          ? '#CCCCCC'
                          : isDaySelected
                            ? '#FFFFFF'
                            : isDayInRange
                              ? 'var(--color-primary-dark)'
                              : '#4A4440',
                        fontWeight: isDaySelected || isDayInRange ? 700 : 500,
                        fontSize: '12px',
                        cursor: !d.isAvailable ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        padding: 0,
                      }}
                    >
                      {d.day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Time Selectors (HOURLY) or Range Summary (DAILY) */}
            <div>
              {rentalMode === 'HOURLY' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 800,
                        color: '#8C827A',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        margin: 0,
                      }}
                    >
                      CHỌN GIỜ THUÊ (MỖI Ô 2 TIẾNG)
                    </h3>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                      {startTime} - {endTime}
                    </span>
                  </div>
                  <div className="vh-pd-slots-grid">
                    {productSlots.map((block, idx) => {
                      const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
                        isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
                      );
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                      const isPast =
                        singleDate === todayStr &&
                        (() => {
                          const [sh, sm] = block.start.split(':').map(Number);
                          return (
                            sh < today.getHours() ||
                            (sh === today.getHours() && sm <= today.getMinutes())
                          );
                        })();

                      const isSelected = idx >= startSlotIndex && idx <= endSlotIndex;

                      return (
                        <button
                          key={block.label}
                          type="button"
                          disabled={isBusy || isPast}
                          onClick={() => onSelectSlot(idx)}
                          className={`vh-pd-slot-btn ${isSelected ? 'selected' : ''}`}
                        >
                          <span>{block.label}</span>
                          <span style={{ fontSize: '9px', fontWeight: 600, opacity: 0.85 }}>
                            {isBusy
                              ? 'Đã bận'
                              : isPast
                                ? 'Đã qua'
                                : isSelected
                                  ? 'Đã chọn'
                                  : 'Trống'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontStyle: 'italic',
                      color: 'var(--color-text-secondary)',
                      marginTop: '8px',
                      lineHeight: 1.4,
                    }}
                  >
                    * Bạn có thể chọn liên tiếp nhiều ô để thuê nhiều giờ (Ví dụ: click ô 8h-10h rồi click ô 10h-12h).
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#8C827A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '4px',
                    }}
                  >
                    THỜI GIAN THUÊ
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        NGÀY NHẬN ĐỒ
                      </span>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {startDate ? formatSingleDate(startDate) : 'Chưa chọn'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        NGÀY TRẢ ĐỒ
                      </span>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {endDate ? formatSingleDate(endDate) : 'Chưa chọn'}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontStyle: 'italic',
                      color: 'var(--color-text-secondary)',
                      marginTop: '8px',
                      lineHeight: 1.4,
                      display: 'block',
                    }}
                  >
                    * Chọn Ngày nhận và Ngày trả trực tiếp trên lịch.
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontStyle: 'italic',
                      color: '#8C6D1F',
                      marginTop: '4px',
                      lineHeight: 1.4,
                      display: 'block',
                      fontWeight: 600,
                    }}
                  >
                    ⏰ Giờ lấy đồ: từ 1h sáng | Giờ trả đồ: trước 11h đêm.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACTION ACTIONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isCurrentTimeSlotBusy && (
          <div
            style={{
              color: '#C0392B',
              backgroundColor: '#FADBD8',
              border: '1px solid #F1948A',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 650,
              textAlign: 'center',
              marginBottom: '10px',
            }}
          >
            ⚠️ Trang phục đã bận trong khung giờ này. Vui lòng chọn giờ hoặc ngày khác!
          </div>
        )}

        {availability.state === 'checking' && (
          <div style={{ color: '#6B5B4D', fontSize: '14px' }}>
            Đang kiểm tra lịch trống...
          </div>
        )}
        {availability.state === 'available' && availability.result && (
          <div style={{ color: '#1E7A46', fontSize: '14px' }}>
            Còn {availability.result.availableQuantity} sản phẩm phù hợp với lịch thuê đã chọn.
          </div>
        )}
        {availability.state === 'unavailable' && (
          <div style={{ color: '#C0392B', fontSize: '14px' }}>
            {availability.result?.message || 'Không đủ số lượng cho lịch thuê đã chọn. Vui lòng đổi ngày, giờ hoặc số lượng.'}
          </div>
        )}
        {availability.state === 'error' && (
          <div style={{ color: '#8C6D1F', fontSize: '14px' }}>
            Chưa thể kiểm tra lịch ngay lúc này. Hệ thống sẽ kiểm tra lại trước khi xác nhận thuê.
          </div>
        )}

        {/* Quantity Selector */}
        <div className="vh-pd-quantity-row">
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Số lượng thuê
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              onClick={() => onChangeBookingQty((q) => Math.max(1, q - 1))}
              className="vh-pd-qty-btn"
            >
              -
            </button>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              {bookingQty}
            </span>
            <button
              type="button"
              onClick={() => onChangeBookingQty((q) => q + 1)}
              className="vh-pd-qty-btn"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          disabled={isActionDisabled}
          className="vh-btn vh-btn-outline vh-btn-lg"
          style={{
            width: '100%',
            borderRadius: '12px',
            fontSize: '16px',
            height: '54px',
            fontWeight: 700,
            border: isCurrentTimeSlotBusy
              ? '1.5px solid #8C827A'
              : '1.5px solid var(--color-primary-dark)',
            backgroundColor: 'transparent',
            color: isCurrentTimeSlotBusy
              ? '#8C827A'
              : 'var(--color-primary-dark)',
            cursor: isActionDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          THÊM VÀO GIỎ HÀNG
        </button>

        <button
          type="button"
          onClick={onRentNow}
          disabled={isActionDisabled}
          className="vh-btn vh-btn-primary vh-btn-lg"
          style={{
            width: '100%',
            borderRadius: '12px',
            fontSize: '16px',
            height: '54px',
            fontWeight: 700,
            backgroundColor: isCurrentTimeSlotBusy
              ? '#8C827A'
              : 'var(--color-primary-dark)',
            color: '#FFFFFF',
            border: 'none',
            cursor: isActionDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span>THUÊ NGAY</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Micro value bullets */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--color-light-border)',
          paddingTop: '20px',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MapPin size={14} className="text-stone-500" /> Nhận tại cửa hàng
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Shield size={14} className="text-stone-500" /> Bảo mật thanh toán
        </span>
      </div>
    </>
  );
};
