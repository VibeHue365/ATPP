export const SYSTEM_POLICIES = {
  /** Thời gian giữ slot tạm thời cho đơn hàng chờ thanh toán (miligiây) - Mặc định 30 phút */
  BOOKING_HOLD_TIMEOUT_MS: 30 * 60 * 1000,

  /** Thời hạn hủy đơn miễn phí (giờ) trước thời điểm hẹn bắt đầu - Mặc định 72 giờ (3 ngày) */
  FREE_CANCEL_LIMIT_HOURS: 72,

  /** Thời gian ân hạn (phút) đối với đơn đặt sát giờ (dưới 72h trước khi bắt đầu) - Mặc định 60 phút */
  LAST_MIN_GRACE_MINUTES: 60,

  /** Thời gian ân hạn (phút) đối với đơn đặt siêu gấp (dưới 2h trước khi bắt đầu) - Mặc định 5 phút */
  URGENT_GRACE_MINUTES: 5,

  /** Tỷ lệ phạt tiền thuê khi khách hàng hủy trễ đối với áo dài (PRODUCT) - Mặc định 100% (1.0) */
  PRODUCT_CANCEL_PENALTY_RATE: 1.0,

  /** Tỷ lệ phạt đặt cọc khi khách hàng hủy trễ đối với gói chụp ảnh (PHOTOGRAPHY) - Mặc định 30% (0.3) */
  PHOTOGRAPHY_CANCEL_PENALTY_RATE: 0.3,
};
