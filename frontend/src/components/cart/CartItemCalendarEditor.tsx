import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CartItem } from '../../context/CartContext';
import { httpClient } from '../../services/httpClient';
import { formatSingleDate } from '../../utils/dateHelper';

interface CartItemCalendarEditorProps {
  item: CartItem;
  realProductList: any[];
  updateCartItemSize: (itemId: string, size: string) => void;
  updateCartItemColor: (itemId: string, color: string) => void;
  updateCartItemDates: (itemId: string, rentalFrom: string, rentalTo: string) => void;
  updateCartItemTimeSlot: (itemId: string, timeSlot: string) => void;
  onClose: () => void;
  toast: {
    error: (msg: string) => void;
    success: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const productSlots = [
  { start: '07:00', end: '09:00', label: '07:00 - 09:00' },
  { start: '09:00', end: '11:00', label: '09:00 - 11:00' },
  { start: '11:00', end: '13:00', label: '11:00 - 13:00' },
  { start: '13:00', end: '15:00', label: '13:00 - 15:00' },
  { start: '15:00', end: '17:00', label: '15:00 - 17:00' },
  { start: '17:00', end: '19:00', label: '17:00 - 19:00' },
  { start: '19:00', end: '21:00', label: '19:00 - 21:00' },
];

const isTimeSlotOverlap = (slot1: string, slot2: string) => {
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const [start1Str, end1Str] = slot1.split('-').map(s => s.trim());
  const [start2Str, end2Str] = slot2.split('-').map(s => s.trim());
  if (!start1Str || !end1Str || !start2Str || !end2Str) return false;
  const s1 = parseTime(start1Str);
  const e1 = parseTime(end1Str);
  const s2 = parseTime(start2Str);
  const e2 = parseTime(end2Str);
  return s1 < e2 && s2 < e1;
};

export const CartItemCalendarEditor: React.FC<CartItemCalendarEditorProps> = ({
  item,
  realProductList,
  updateCartItemSize,
  updateCartItemColor,
  updateCartItemDates,
  updateCartItemTimeSlot,
  onClose,
  toast,
}) => {
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [busySlots, setBusySlots] = useState<{ date: string, timeSlot: string }[]>([]);

  const editingItemType = item.rentalType || 'DAILY';

  // Fetch busy dates/slots with AbortController to handle race condition
  useEffect(() => {
    const controller = new AbortController();
    const pId = item.productId || item.id;
    if (!pId) return;

    httpClient.get<any>(`/api/bookings/busy-dates/product/${pId}`, { signal: controller.signal })
      .then(res => {
        setBusyDates(res.bookedDates || []);
        setBusySlots(res.bookedSlots || []);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching busy dates/slots:', err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [item.productId, item.id]);

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Align to Monday
    
    const days: any[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: 0, dateStr: '', isWeekend: false, isAvailable: false, isEmpty: true });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = new Date(dateStr).getDay();
      
      let isAvailable = !busyDates.includes(dateStr) && dateStr >= todayStr;
      if (editingItemType === 'HOURLY' && dateStr === todayStr) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const hasTimeSlotsLeft = productSlots.some(block => {
          const [h, m] = block.start.split(':').map(Number);
          return h > currentHour || (h === currentHour && m > currentMinute);
        });
        isAvailable = isAvailable && hasTimeSlotsLeft;
      }
      
      days.push({
        day: i,
        dateStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isAvailable,
        isEmpty: false,
      });
    }
    return days;
  }, [calendarDate, busyDates, editingItemType]);

  const handleCalendarDayClick = (dateStr: string) => {
    if (editingItemType === 'HOURLY') {
      updateCartItemDates(item.id, dateStr, dateStr);
    } else {
      if (busyDates.includes(dateStr)) {
        toast.error('Ngày này đã bị đặt lịch!');
        return;
      }
      const currentFrom = item.rentalFrom || item.startDate || '';
      const currentTo = item.rentalTo || item.endDate || '';
      
      if (!currentFrom || (currentFrom && currentTo)) {
        updateCartItemDates(item.id, dateStr, '');
      } else {
        if (dateStr < currentFrom) {
          updateCartItemDates(item.id, dateStr, '');
        } else {
          const hasUnavailable = calendarDays.some(d => 
            !d.isEmpty && !d.isAvailable && d.dateStr >= currentFrom && d.dateStr <= dateStr
          );
          if (hasUnavailable) {
            toast.error('Khoảng thời gian chọn chứa ngày đã bị đặt!');
            return;
          }
          updateCartItemDates(item.id, currentFrom, dateStr);
        }
      }
    }
  };

  const bookedSlotsOnSelectedDate = useMemo(() => {
    const singleDate = item.rentalFrom || item.startDate || '';
    if (!singleDate) return [];
    return busySlots.filter(s => s.date === singleDate).map(s => s.timeSlot);
  }, [item.rentalFrom, item.startDate, busySlots]);

  const startSlotIndex = useMemo(() => {
    const startTime = item.startTime || '07:00';
    return productSlots.findIndex(s => s.start === startTime);
  }, [item.startTime]);

  const endSlotIndex = useMemo(() => {
    const endTime = item.endTime || '09:00';
    return productSlots.findIndex(s => s.end === endTime);
  }, [item.endTime]);

  const handleSlotClick = (i: number) => {
    const block = productSlots[i];
    const singleDate = item.rentalFrom || item.startDate || '';
    
    const isBusy = bookedSlotsOnSelectedDate.some(bookedSlot => 
      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot)
    );
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isPast = singleDate === todayStr && (() => {
      const [sh, sm] = block.start.split(':').map(Number);
      return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
    })();
    
    if (isBusy || isPast) return;

    const currentStartTime = item.startTime || '07:00';
    const currentStartIdx = productSlots.findIndex(s => s.start === currentStartTime);

    if (currentStartIdx === -1 || currentStartIdx !== endSlotIndex || i < currentStartIdx) {
      updateCartItemTimeSlot(item.id, `${block.start}-${block.end}`);
    } else {
      let hasBusyOrPastInRange = false;
      for (let idx = currentStartIdx; idx <= i; idx++) {
        const checkBlock = productSlots[idx];
        const checkBusy = bookedSlotsOnSelectedDate.some(bookedSlot => 
          isTimeSlotOverlap(`${checkBlock.start}-${checkBlock.end}`, bookedSlot)
        );
        const checkPast = singleDate === todayStr && (() => {
          const [sh, sm] = checkBlock.start.split(':').map(Number);
          return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
        })();
        if (checkBusy || checkPast) {
          hasBusyOrPastInRange = true;
          break;
        }
      }

      if (hasBusyOrPastInRange) {
        toast.error('Khoảng thời gian chọn chứa khung giờ đã bận hoặc đã qua!');
        updateCartItemTimeSlot(item.id, `${block.start}-${block.end}`);
      } else {
        const targetStartTime = productSlots[currentStartIdx].start;
        const targetEndTime = productSlots[i].end;
        updateCartItemTimeSlot(item.id, `${targetStartTime}-${targetEndTime}`);
      }
    }
  };

  // Reset and auto-select first available slot when date changes
  useEffect(() => {
    if (editingItemType !== 'HOURLY') return;
    const singleDate = item.rentalFrom || item.startDate || '';
    if (!singleDate) return;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const currentStartTime = item.startTime || '07:00';
    const currentEndTime = item.endTime || '09:00';
    const isCurrentBusy = bookedSlotsOnSelectedDate.some(bookedSlot => 
      isTimeSlotOverlap(`${currentStartTime}-${currentEndTime}`, bookedSlot)
    );
    const isCurrentPast = singleDate === todayStr && (() => {
      const [sh, sm] = currentStartTime.split(':').map(Number);
      return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
    })();

    if (isCurrentBusy || isCurrentPast) {
      const firstAvailableIndex = productSlots.findIndex((block) => {
        const isBusy = bookedSlotsOnSelectedDate.some(bookedSlot => 
          isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot)
        );
        const isPast = singleDate === todayStr && (() => {
          const [sh, sm] = block.start.split(':').map(Number);
          return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
        })();
        return !isBusy && !isPast;
      });

      if (firstAvailableIndex !== -1) {
        updateCartItemTimeSlot(item.id, `${productSlots[firstAvailableIndex].start}-${productSlots[firstAvailableIndex].end}`);
      }
    }
  }, [item.rentalFrom, item.startDate, bookedSlotsOnSelectedDate, editingItemType]);

  const dbProd = useMemo(() => {
    return realProductList.find(p => p._id === item.productId || p._id === item.id);
  }, [realProductList, item.productId, item.id]);

  const sizes: string[] = dbProd?.sizes || ['S', 'M', 'L', 'XL'];
  const colors: string[] = dbProd?.colors || [];

  return (
    <div style={{
      backgroundColor: '#FAF5EE',
      border: '1px solid #E8D9C0',
      borderRadius: '8px',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '4px',
      animation: 'fadeIn 0.2s ease'
    }}>
      {/* Size selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#8B1E22', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kích cỡ</label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {sizes.map(sz => (
            <button
              key={sz}
              type="button"
              onClick={() => updateCartItemSize(item.id, sz)}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                border: `1.5px solid ${(item.size || '').toUpperCase() === sz.toUpperCase() ? '#8B1E22' : '#D5C2AD'}`,
                backgroundColor: (item.size || '').toUpperCase() === sz.toUpperCase() ? '#8B1E22' : 'white',
                color: (item.size || '').toUpperCase() === sz.toUpperCase() ? 'white' : '#5D4037',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Color selector */}
      {colors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#8B1E22', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Màu sắc</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {colors.map(cl => (
              <button
                key={cl}
                type="button"
                onClick={() => updateCartItemColor(item.id, cl)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: `1.5px solid ${(item.color || '').toUpperCase() === cl.toUpperCase() ? '#8B1E22' : '#D5C2AD'}`,
                  backgroundColor: (item.color || '').toUpperCase() === cl.toUpperCase() ? '#8B1E22' : 'white',
                  color: (item.color || '').toUpperCase() === cl.toUpperCase() ? 'white' : '#5D4037',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {cl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar & Timeslot Grid */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAE1D4',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '8px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* Calendar Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#8B1E22', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 750, color: '#2D2926' }}>
                Tháng {calendarDate.getMonth() + 1}, {calendarDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#8B1E22', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
                <span key={w} style={{ fontSize: '10px', fontWeight: 800, color: '#8C827A', padding: '2px 0' }}>{w}</span>
              ))}
              {calendarDays.map((d, idx) => {
                if (d.isEmpty) return <div key={`e-${idx}`} />;
                
                const startDateVal = item.rentalFrom || item.startDate || '';
                const endDateVal = item.rentalTo || item.endDate || '';
                
                const isDaySelected = editingItemType === 'HOURLY'
                  ? startDateVal === d.dateStr
                  : (startDateVal === d.dateStr || endDateVal === d.dateStr);
                  
                const isDayInRange = editingItemType === 'DAILY' && startDateVal && endDateVal && d.dateStr > startDateVal && d.dateStr < endDateVal;
                
                return (
                  <button
                    key={d.day}
                    type="button"
                    disabled={!d.isAvailable}
                    onClick={() => handleCalendarDayClick(d.dateStr)}
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
                      padding: 0
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
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHỌN GIỜ THUÊ (MỖI Ô 2 TIẾNG)</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {productSlots.map((block, idx) => {
                    const singleDate = item.rentalFrom || item.startDate || '';
                    const isBusy = bookedSlotsOnSelectedDate.some(bookedSlot => 
                      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot)
                    );
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    const isPast = singleDate === todayStr && (() => {
                      const [sh, sm] = block.start.split(':').map(Number);
                      return sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes());
                    })();

                    const isSelected = idx >= startSlotIndex && idx <= endSlotIndex;

                    return (
                      <button
                        key={block.label}
                        type="button"
                        disabled={isBusy || isPast}
                        onClick={() => handleSlotClick(idx)}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: (isBusy || isPast) ? 'not-allowed' : 'pointer',
                          backgroundColor: isSelected
                            ? '#8B1E22'
                            : (isBusy || isPast)
                              ? '#EAEAE8'
                              : '#FFFFFF',
                          color: isSelected
                            ? '#FFFFFF'
                            : (isBusy || isPast)
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
              <div style={{
                backgroundColor: '#FCF9F2',
                border: '1px solid #EAE1D4',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '12px',
                color: '#5D4037',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 700, color: '#8B1E22', marginBottom: '4px' }}>Thời gian chọn thuê:</div>
                {item.rentalFrom && item.rentalTo ? (
                  <>
                    <div>Từ ngày: <strong>{formatSingleDate(item.rentalFrom)}</strong></div>
                    <div>Đến ngày: <strong>{formatSingleDate(item.rentalTo)}</strong></div>
                    <div style={{ marginTop: '6px', fontSize: '11px', fontStyle: 'italic', color: '#8C7355' }}>
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
          <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#8C7355', lineHeight: 1.4 }}>
            * Bạn có thể chọn liên tiếp nhiều ô để thuê nhiều giờ (Ví dụ: click ô 9h-11h rồi click ô 11h-13h).
          </span>
        )}
      </div>

      <button
        type="button"
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
          marginTop: '2px'
        }}
      >
        ✓ Xong
      </button>
    </div>
  );
};
