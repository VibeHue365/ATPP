import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EnrichedCartItem, CartCalendarDay } from '../types';
import { productSlots, isTimeSlotOverlap } from '../../rentals/product-detail/utils/timeSlotUtils';
import { formatSingleDate } from '../utils/cartCalculations';

interface CartEditItemInlineProps {
  item: EnrichedCartItem;
  realProductList: any[];
  calendarDate: Date;
  setCalendarDate: React.Dispatch<React.SetStateAction<Date>>;
  calendarDays: CartCalendarDay[];
  editingItemType: 'DAILY' | 'HOURLY';
  bookedSlotsOnSelectedDate: string[];
  startSlotIndex: number;
  endSlotIndex: number;
  onSizeChange: (size: string) => Promise<void>;
  onColorChange: (color: string) => Promise<void>;
  onCalendarDayClick: (dateStr: string) => void;
  onSlotClick: (slotIndex: number) => void;
  onClose: () => void;
}

export const CartEditItemInline: React.FC<CartEditItemInlineProps> = ({
  item,
  realProductList,
  calendarDate,
  setCalendarDate,
  calendarDays,
  editingItemType,
  bookedSlotsOnSelectedDate,
  startSlotIndex,
  endSlotIndex,
  onSizeChange,
  onColorChange,
  onCalendarDayClick,
  onSlotClick,
  onClose,
}) => {
  const dbProd = realProductList.find((p) => p._id === item.productId || p._id === item.id);
  const sizes: string[] = dbProd?.sizes || ['S', 'M', 'L', 'XL'];
  const colors: string[] = dbProd?.colors || [];

  return (
    <div
      style={{
        backgroundColor: '#FAF5EE',
        border: '1px solid #E8D9C0',
        borderRadius: '8px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginTop: '4px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Size selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#8B1E22',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Kích cỡ
        </label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {sizes.map((sz) => {
            const isSelected = (item.size || '').toUpperCase() === sz.toUpperCase();
            return (
              <button
                key={sz}
                onClick={() => onSizeChange(sz)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: `1.5px solid ${isSelected ? '#8B1E22' : '#D5C2AD'}`,
                  backgroundColor: isSelected ? '#8B1E22' : 'white',
                  color: isSelected ? 'white' : '#5D4037',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {sz}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color selector */}
      {colors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#8B1E22',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Màu sắc
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {colors.map((cl) => {
              const isSelected = (item.color || '').toUpperCase() === cl.toUpperCase();
              return (
                <button
                  key={cl}
                  onClick={() => onColorChange(cl)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: `1.5px solid ${isSelected ? '#8B1E22' : '#D5C2AD'}`,
                    backgroundColor: isSelected ? '#8B1E22' : 'white',
                    color: isSelected ? 'white' : '#5D4037',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {cl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar & Timeslot Grid */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #EAE1D4',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* Calendar Section */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const d = new Date(calendarDate);
                  d.setMonth(d.getMonth() - 1);
                  setCalendarDate(d);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#8B1E22',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 750, color: '#2D2926' }}>
                Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(calendarDate);
                  d.setMonth(d.getMonth() + 1);
                  setCalendarDate(d);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#8B1E22',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

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
                  style={{ fontSize: '10px', fontWeight: 800, color: '#8C827A', padding: '2px 0' }}
                >
                  {w}
                </span>
              ))}
              {calendarDays.map((d, idx) => {
                if (d.isEmpty) return <div key={`e-${idx}`} />;

                const startDateVal = item.rentalFrom || item.startDate || '';
                const endDateVal = item.rentalTo || item.endDate || '';

                const isDaySelected =
                  editingItemType === 'HOURLY'
                    ? startDateVal === d.dateStr
                    : startDateVal === d.dateStr || endDateVal === d.dateStr;

                const isDayInRange =
                  editingItemType === 'DAILY' &&
                  startDateVal &&
                  endDateVal &&
                  d.dateStr > startDateVal &&
                  d.dateStr < endDateVal;

                return (
                  <button
                    key={d.day}
                    type="button"
                    disabled={!d.isAvailable}
                    onClick={() => onCalendarDayClick(d.dateStr)}
                    style={{
                      aspectRatio: '1',
                      border: isDaySelected ? '1.5px solid #8B1E22' : '1px solid transparent',
                      borderRadius: '6px',
                      backgroundColor: isDaySelected
                        ? '#8B1E22'
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
                            ? '#8B1E22'
                            : '#4A4440',
                      fontWeight: isDaySelected || isDayInRange ? 700 : 500,
                      fontSize: '11px',
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

          {/* Time Slots Section (HOURLY) or Info Section (DAILY) */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {editingItemType === 'HOURLY' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#8C827A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  CHỌN GIỜ THUÊ (MỖI Ô 2 TIẾNG)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {productSlots.map((block, idx) => {
                    const singleDate = item.rentalFrom || item.startDate || '';
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
                        onClick={() => onSlotClick(idx)}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: isBusy || isPast ? 'not-allowed' : 'pointer',
                          backgroundColor: isSelected
                            ? '#8B1E22'
                            : isBusy || isPast
                              ? '#EAEAE8'
                              : '#FFFFFF',
                          color: isSelected
                            ? '#FFFFFF'
                            : isBusy || isPast
                              ? '#A0A09E'
                              : '#5D4037',
                          border: isSelected
                            ? '1.5px solid #8B1E22'
                            : '1.5px solid rgba(45, 41, 38, 0.15)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{block.label}</span>
                        <span style={{ fontSize: '8px', fontWeight: 600, opacity: 0.85 }}>
                          {isBusy ? 'Đã bận' : isPast ? 'Đã qua' : isSelected ? 'Đã chọn' : 'Trống'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FCF9F2',
                  border: '1px solid #EAE1D4',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#5D4037',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, color: '#8B1E22', marginBottom: '4px' }}>
                  Thời gian chọn thuê:
                </div>
                {item.rentalFrom && item.rentalTo ? (
                  <>
                    <div>
                      Từ ngày: <strong>{formatSingleDate(item.rentalFrom)}</strong>
                    </div>
                    <div>
                      Đến ngày: <strong>{formatSingleDate(item.rentalTo)}</strong>
                    </div>
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '11px',
                        fontStyle: 'italic',
                        color: '#8C7355',
                      }}
                    >
                      * Click chọn Ngày nhận đầu tiên, sau đó click Ngày trả.
                    </div>
                  </>
                ) : (
                  <div style={{ fontStyle: 'italic', color: '#8C827A' }}>
                    Vui lòng chọn ngày nhận và ngày trả trên lịch.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {editingItemType === 'HOURLY' && (
          <span
            style={{
              fontSize: '10px',
              fontStyle: 'italic',
              color: '#8C7355',
              lineHeight: 1.4,
            }}
          >
            * Bạn có thể chọn liên tiếp nhiều ô để thuê nhiều giờ (Ví dụ: click ô 9h-11h rồi click ô
            11h-13h).
          </span>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          alignSelf: 'flex-end',
          padding: '5px 14px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#8B1E22',
          color: 'white',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: '2px',
        }}
      >
        ✓ Xong
      </button>
    </div>
  );
};

export default CartEditItemInline;
