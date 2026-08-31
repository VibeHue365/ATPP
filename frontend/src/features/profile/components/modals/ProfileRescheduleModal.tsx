import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../../components/common/Modal';
import { httpClient } from '../../../../services/httpClient';
import { useToast } from '../../../../components/feedback/Toast';

interface ProfileRescheduleModalProps {
  booking: any;
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}

const toMinutes = (value: string): number => {
  const [hours, minutes] = value.trim().split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN;
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const timeSlotsOverlap = (first: string, second: string): boolean => {
  const [firstStart, firstEnd] = first.split('-').map(toMinutes);
  const [secondStart, secondEnd] = second.split('-').map(toMinutes);
  return (
    [firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite) &&
    firstStart < secondEnd &&
    secondStart < firstEnd
  );
};

export const ProfileRescheduleModal: React.FC<ProfileRescheduleModalProps> = ({
  booking,
  item,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const isProduct = item?.itemType === 'PRODUCT';

  const [rescheduleFrom, setRescheduleFrom] = useState(item?.startDate || item?.rentalFrom || '');
  const [rescheduleTo, setRescheduleTo] = useState(item?.endDate || item?.rentalTo || '');
  const [rescheduleShootDate, setRescheduleShootDate] = useState(
    item?.shootDate ? String(item.shootDate).slice(0, 10) : ''
  );
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState(item?.shootTimeSlot || '');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const durationMinutes = useMemo(() => {
    const pkgDuration = Number(
      item?.photographyPackageId?.includedDurationMinutes ||
        item?.photographyPackageId?.durationMinutes
    );
    if (Number.isFinite(pkgDuration) && pkgDuration > 0) return pkgDuration;
    return 120;
  }, [item]);

  // Load photographer availability
  useEffect(() => {
    if (isProduct || !rescheduleShootDate) {
      setAvailableSlots([]);
      setSlotsError(null);
      return;
    }

    const photographerId =
      item?.providerId?._id ||
      item?.providerId ||
      item?.photographerId?._id ||
      item?.photographerId ||
      booking?.providerIds?.[0];

    if (!photographerId) {
      setAvailableSlots([]);
      setSlotsError('Không xác định được nhiếp ảnh gia của lịch này.');
      return;
    }

    let isCurrent = true;
    setIsLoadingSlots(true);
    setSlotsError(null);
    setRescheduleTimeSlot('');

    Promise.all([
      httpClient.get<{ timeRanges: { start: string; end: string }[] }>(
        `/api/photographers/${photographerId}/availability?date=${rescheduleShootDate}`
      ),
      httpClient.get<{ bookedSlots: { date: string; timeSlot: string; bookingItemId?: string }[] }>(
        `/api/bookings/busy-dates/provider/${photographerId}`
      )
    ])
      .then(([availability, busy]) => {
        if (!isCurrent) return;
        const slots = (availability.timeRanges || []).flatMap((range) => {
          const rangeStart = toMinutes(range.start);
          const rangeEnd = toMinutes(range.end);
          if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) return [];

          const candidates: string[] = [];
          for (let start = rangeStart; start + durationMinutes <= rangeEnd; start += 30) {
            const candidate = `${toTime(start)}-${toTime(start + durationMinutes)}`;
            const conflicts = (busy.bookedSlots || []).some(
              (booked) =>
                booked.date === rescheduleShootDate &&
                String(booked.bookingItemId || '') !== String(item._id) &&
                timeSlotsOverlap(candidate, booked.timeSlot)
            );
            if (!conflicts) candidates.push(candidate);
          }
          return candidates;
        });
        setAvailableSlots([...new Set(slots)]);
      })
      .catch(() => {
        if (!isCurrent) return;
        setAvailableSlots([]);
        setSlotsError('Không thể tải khung giờ trống.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingSlots(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isProduct, rescheduleShootDate, durationMinutes, item, booking]);

  const handleReschedule = async () => {
    if (isProduct && (!rescheduleFrom || !rescheduleTo)) {
      toast.error('Vui lòng chọn ngày nhận và ngày trả mới');
      return;
    }
    if (!isProduct && (!rescheduleShootDate || !rescheduleTimeSlot)) {
      toast.error('Vui lòng chọn ngày chụp và khung giờ còn trống');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await httpClient.patch<any>(`/api/bookings/${booking._id}/reschedule`, {
        itemId: item._id,
        ...(isProduct
          ? { newRentalFrom: rescheduleFrom, newRentalTo: rescheduleTo }
          : {
              newShootDate: rescheduleShootDate,
              newShootTimeSlot: rescheduleTimeSlot
            }),
        reason: rescheduleReason || undefined
      });

      if (res?.directUpdate || res?.status === 'APPROVED') {
        toast.success('Lịch chụp mới đã được cập nhật trực tiếp thành công!');
      } else {
        toast.success('Đã gửi yêu cầu đổi lịch. Vui lòng chờ đối tác xác nhận.');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Không thể đổi lịch. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`ĐỔI LỊCH: ${booking.bookingCode}`}
      maxWidth="580px"
    >
      <div className="lume-modal-content-box animate-fade-in">
        {/* Notice Box */}
        <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 14px', fontSize: '12.5px', color: '#1E40AF', lineHeight: 1.4 }}>
          <strong>Lưu ý:</strong> Yêu cầu đổi lịch cần được gửi trước 24 giờ. Khung giờ mới sẽ được tạm giữ chỗ chờ phản hồi duyệt.
        </div>

        {isProduct ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#574D4F', marginBottom: '6px' }}>
                NGÀY NHẬN MỚI
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleFrom}
                onChange={(e) => setRescheduleFrom(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #DED7CB', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#574D4F', marginBottom: '6px' }}>
                NGÀY TRẢ MỚI
              </label>
              <input
                type="date"
                min={rescheduleFrom || new Date().toISOString().split('T')[0]}
                value={rescheduleTo}
                onChange={(e) => setRescheduleTo(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #DED7CB', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#574D4F', marginBottom: '6px' }}>
                CHỌN NGÀY CHỤP MỚI
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleShootDate}
                onChange={(e) => setRescheduleShootDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #DED7CB', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Time Slot Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#574D4F', marginBottom: '6px' }}>
                CHỌN KHUNG GIỜ TRỐNG
              </label>

              {!rescheduleShootDate ? (
                <p style={{ fontSize: '12px', color: '#8C827A', margin: 0, fontStyle: 'italic' }}>
                  Vui lòng chọn ngày chụp mới ở trên trước.
                </p>
              ) : isLoadingSlots ? (
                <p style={{ fontSize: '12px', color: '#2563EB', margin: 0 }}>
                  Đang kiểm tra lịch trống của thợ ảnh...
                </p>
              ) : slotsError ? (
                <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>{slotsError}</p>
              ) : availableSlots.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>
                  Nhiếp ảnh gia đã kín lịch hoặc không có ca làm việc vào ngày này.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {availableSlots.map((slot) => {
                    const isSelected = rescheduleTimeSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setRescheduleTimeSlot(slot)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: isSelected ? '1.5px solid #8B1E2D' : '1px solid #DED7CB',
                          backgroundColor: isSelected ? '#8B1E2D' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : '#231F20',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {slot.replace('-', ' - ')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reason textarea */}
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#574D4F', marginBottom: '6px' }}>
            LÝ DO ĐỔI LỊCH (TÙY CHỌN)
          </label>
          <textarea
            placeholder="Nhập lý do đổi lịch để thợ chuẩn bị..."
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            style={{ width: '100%', minHeight: '60px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #DED7CB', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #ECE5DB', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, backgroundColor: '#FFFFFF', border: '1px solid #DED7CB', color: '#574D4F', cursor: 'pointer' }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleReschedule}
            style={{ padding: '8px 22px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 750, backgroundColor: '#8B1E2D', color: '#FFFFFF', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu đổi lịch'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
