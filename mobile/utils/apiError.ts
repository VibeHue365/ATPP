import axios from 'axios';

const ERROR_TRANSLATIONS: Array<[string, string]> = [
  ['invalid email or password', 'Email hoặc mật khẩu không chính xác.'],
  ['too many requests', 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'],
  ['booking_hold_expired', 'Thời hạn giữ đơn (15 phút) đã hết. Vui lòng đặt lại đơn mới.'],
  ['booking not found', 'Không tìm thấy đơn hàng.'],
  ['provider_contract_suspended', 'Cửa hàng này đang tạm ngưng nhận đơn thuê do cập nhật quy chế hợp đồng điện tử. Vui lòng chọn sản phẩm khác hoặc liên hệ cửa hàng.'],
  ['mixed_contract_flow_unsupported', 'Không thể gộp sản phẩm hợp đồng điện tử V2 và đơn thường trong cùng một lần đặt. Vui lòng tách riêng từng đơn.'],
  ['contract_product_replacement_value_missing', 'Trang phục chưa có Giá trị bồi hoàn được Shop thiết lập. Vui lòng liên hệ Shop trước khi tạo hợp đồng.'],
  ['contract_product_replacement_value_unapproved', 'Giá trị bồi hoàn của trang phục đang chờ quản trị viên phê duyệt. Vui lòng liên hệ Shop để được hỗ trợ.'],
  ['provider_rental_not_active', 'Cửa hàng chưa kích hoạt đầy đủ quyền cho thuê trang phục.'],
  ['provider_auto_acceptance_missing', 'Cửa hàng chưa xác nhận quy chế hợp đồng điện tử của sàn.'],
  ['provider_acceptance_stale', 'Chính sách của cửa hàng vừa thay đổi. Hệ thống cần làm mới phiên bản hợp đồng.'],
  ['contract_version_not_accepted', 'Bạn cần xem và đồng ý Hợp đồng điện tử trước khi thanh toán.'],
  ['contract_consent_missing', 'Chưa ghi nhận xác nhận đồng ý hợp đồng từ bạn.'],
  ['contract_content_changed', 'Nội dung hợp đồng vừa được cập nhật. Vui lòng làm mới và xem lại trước khi ký.'],
  ['contract_content_stale', 'Phiên bản hợp đồng đã cũ. Vui lòng bấm làm mới phiên bản mới.'],
  ['contract_version_stale', 'Phiên bản hợp đồng đã thay đổi. Vui lòng làm mới điều khoản.'],
  ['contract_version_expired', 'Phiên bản hợp đồng đã hết hiệu lực. Vui lòng làm mới hoặc đặt lại đơn.'],
  ['contract_version_not_offered', 'Hợp đồng đang được khởi tạo. Vui lòng thử lại sau giây lát.'],
  ['contract_snapshot_stale', 'Thông tin đơn hàng hoặc giá đã thay đổi so với bản hợp đồng trước. Vui lòng làm mới hợp đồng.'],
  ['contract_pdf_not_ready', 'Tài liệu PDF hợp đồng đang được hệ thống tạo. Vui lòng thử lại sau vài giây.'],
  ['contracts_v2_disabled', 'Tính năng Hợp đồng điện tử hiện đang bảo trì.'],
];

export function translateApiMessage(message?: string): string {
  if (!message) return '';
  const cleaned = message.replace(/^[A-Z0-9_]+:\s*/i, '').trim();
  const lower = message.toLowerCase();
  const hit = ERROR_TRANSLATIONS.find(([needle]) => lower.includes(needle));
  return hit ? hit[1] : cleaned || message;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.',
) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: { message?: string } }
      | undefined;
    const raw = Array.isArray(data?.message) ? data.message[0] : data?.message;
    const msg = raw ?? data?.error?.message;
    if (msg) return translateApiMessage(msg);
    if (error.code === 'ECONNABORTED') {
      return 'Kết nối quá thời gian. Vui lòng thử lại.';
    }
    return fallback;
  }
  return error instanceof Error ? translateApiMessage(error.message) : fallback;
}
