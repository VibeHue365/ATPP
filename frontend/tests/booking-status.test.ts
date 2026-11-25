import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUS_CODES,
  BOOKING_STATUS_META,
  DISPUTE_STATUS_META,
  INCIDENT_STATUS_META,
  MODERATION_STATUS_META,
  NOTIFICATION_TYPE_META,
  PAYMENT_TX_STATUS_META,
  PROVIDER_STATUS_META,
  REFUND_STATUS_META,
  RENTAL_FULFILLMENT_STATUS_META,
  SETTLEMENT_STATUS_META,
  USER_STATUS_META,
  VERIFICATION_STATUS_META,
  getBookingStatusGroup,
  getBookingStatusLabel,
  getBookingStatusMeta,
  normalizeBookingStatusCode,
} from '../src/utils/bookingStatus';
import {
  getOrderGroup,
  statusBadgeStyle,
} from '../src/features/provider-dashboard/orders/orderHelpers';

describe('bookingStatus canonical helpers', () => {
  it('covers all 18 canonical booking statuses with Vietnamese labels', () => {
    expect(BOOKING_STATUS_CODES).toHaveLength(18);
    for (const code of BOOKING_STATUS_CODES) {
      const meta = BOOKING_STATUS_META[code];
      expect(meta.code).toBe(code);
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.group).toBeDefined();
      expect(getBookingStatusLabel(code)).toBe(meta.label);
    }
  });

  it('normalizes legacy Vietnamese labels and separates RETURNED from COMPLETED', () => {
    expect(normalizeBookingStatusCode('CHỜ XÁC NHẬN')).toBe('DEPOSIT_PAID');
    expect(normalizeBookingStatusCode('CHỜ NHẬN ĐỒ')).toBe('PICKUP_PENDING');
    expect(normalizeBookingStatusCode('ĐÃ TRẢ ĐỒ')).toBe('RETURNED');
    expect(normalizeBookingStatusCode('HOÀN THÀNH')).toBe('COMPLETED');
    expect(normalizeBookingStatusCode('ĐÃ HỦY')).toBe('CANCELLED');
    expect(normalizeBookingStatusCode('TRANH CHẤP')).toBe('DISPUTED');

    expect(getBookingStatusGroup('RETURNED')).toBe('ACTIVE');
    expect(getBookingStatusGroup('COMPLETED')).toBe('COMPLETED');
    expect(getBookingStatusGroup('REFUNDED')).toBe('DISPUTED');
    expect(getBookingStatusGroup('DISPUTED')).toBe('DISPUTED');
    expect(getBookingStatusGroup('OVERDUE')).toBe('ACTIVE');
    expect(getBookingStatusGroup('LOST_ITEM')).toBe('CANCELLED');

    expect(getBookingStatusLabel('RETURN_PENDING', { hasPendingIncident: true })).toBe(
      'Chờ khách duyệt sự cố',
    );
  });

  it('maps provider orderHelpers groups accurately without falling back to Khác', () => {
    expect(getOrderGroup('ĐANG THUÊ')).toBe('Đang thực hiện');
    expect(getOrderGroup('CHỜ NHẬN ĐỒ')).toBe('Đang thực hiện');
    expect(getOrderGroup('ĐÃ TRẢ ĐỒ · CHỜ HOÀN CỌC')).toBe('Đang thực hiện');
    expect(getOrderGroup('HOÀN TẤT')).toBe('Hoàn tất');
    expect(getOrderGroup('ĐÃ HỦY')).toBe('Đã hủy');
    expect(getOrderGroup('ĐÃ HOÀN TIỀN')).toBe('Tranh chấp / Hoàn tiền');
    expect(getOrderGroup('TRANH CHẤP')).toBe('Tranh chấp / Hoàn tiền');
    expect(getOrderGroup('unknown-status')).toBe('Khác');

    expect(statusBadgeStyle('COMPLETED').color).toBe('white');
    expect(statusBadgeStyle('COMPLETED').backgroundColor).toBe('#2e7d32');
    expect(statusBadgeStyle('DISPUTED').backgroundColor).toBe('#d32f2f');
  });

  it('covers non-booking status domains cleanly', () => {
    expect(Object.keys(RENTAL_FULFILLMENT_STATUS_META)).toHaveLength(9);
    expect(Object.keys(PAYMENT_TX_STATUS_META)).toEqual(
      expect.arrayContaining(['PENDING', 'PROCESSING', 'SUCCESS', 'PAID', 'FAILED', 'CANCELLED']),
    );
    expect(Object.keys(REFUND_STATUS_META)).toHaveLength(7);
    expect(Object.keys(DISPUTE_STATUS_META)).toHaveLength(4);
    expect(Object.keys(INCIDENT_STATUS_META)).toHaveLength(4);
    expect(Object.keys(VERIFICATION_STATUS_META)).toHaveLength(7);
    expect(Object.keys(PROVIDER_STATUS_META)).toHaveLength(4);
    expect(Object.keys(USER_STATUS_META)).toHaveLength(5);
    expect(Object.keys(SETTLEMENT_STATUS_META)).toHaveLength(4);
    expect(Object.keys(NOTIFICATION_TYPE_META)).toHaveLength(7);
    expect(Object.keys(MODERATION_STATUS_META)).toHaveLength(5);
    expect(getBookingStatusMeta('UNKNOWN_X').label).toBe('Đang cập nhật');
  });
});
