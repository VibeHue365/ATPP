/**
 * Translates English error messages from the API to user-friendly Vietnamese.
 */
export const translateError = (message?: string): string => {
  if (!message) return "";

  const msgLower = message.toLowerCase().trim();

  if (msgLower.includes("invalid email or password")) {
    return "Email hoặc mật khẩu không chính xác.";
  }
  if (msgLower.includes("email already exists")) {
    return "Email này đã được đăng ký bởi một tài khoản khác.";
  }
  if (msgLower.includes("phone already exists")) {
    return "Số điện thoại này đã được đăng ký bởi một tài khoản khác.";
  }
  if (msgLower.includes("current password is incorrect")) {
    return "Mật khẩu hiện tại không chính xác.";
  }
  if (msgLower.includes("reset token is expired or invalid")) {
    return "Mã khôi phục mật khẩu không hợp lệ hoặc đã hết hạn.";
  }
  if (msgLower.includes("otp is expired")) {
    return "Mã OTP đã hết hạn.";
  }
  if (msgLower.includes("otp is incorrect")) {
    return "Mã OTP không chính xác.";
  }
  if (msgLower.includes("otp is expired or invalid")) {
    return "Mã OTP không hợp lệ hoặc đã hết hạn.";
  }
  if (msgLower.includes("otp attempt limit exceeded")) {
    return "Vượt quá giới hạn số lần thử OTP. Vui lòng thử lại sau.";
  }
  if (msgLower.includes("invalid verification request")) {
    return "Yêu cầu xác thực không hợp lệ.";
  }
  if (msgLower.includes("password must be at least 8 characters")) {
    return "Mật khẩu phải chứa ít nhất 8 ký tự.";
  }
  if (msgLower.includes("password is too weak")) {
    return "Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.";
  }
  if (
    msgLower.includes("account is not active") ||
    msgLower.includes("user is not active")
  ) {
    return "Tài khoản của bạn chưa được kích hoạt hoặc chưa xác minh email.";
  }
  if (msgLower.includes("google email is not verified")) {
    return "Tài khoản Google chưa được xác minh email.";
  }
  if (msgLower.includes("oauth code is expired or invalid")) {
    return "Mã xác thực đăng nhập bên thứ ba đã hết hạn hoặc không hợp lệ.";
  }
  if (msgLower.includes("oauth state is expired or invalid")) {
    return "Trạng thái đăng nhập bên thứ ba đã hết hạn.";
  }
  if (msgLower.includes("refresh token is invalid")) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (msgLower.includes("session is expired or revoked")) {
    return "Phiên đăng nhập của bạn đã hết hạn hoặc bị thu hồi.";
  }
  if (msgLower.includes("too many requests")) {
    return "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.";
  }
  if (
    msgLower.includes("signal timed out") ||
    msgLower.includes("timed out") ||
    msgLower.includes("timeout")
  ) {
    return "Thời gian kết nối quá hạn (Timeout). Máy chủ đang phản hồi chậm hoặc đang tải lại, vui lòng thử lại.";
  }
  if (
    msgLower.includes("failed to fetch") ||
    msgLower.includes("networkerror") ||
    msgLower.includes("network error") ||
    msgLower.includes("load failed")
  ) {
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc đảm bảo máy chủ backend đang chạy.";
  }
  if (
    msgLower.includes("the operation was aborted") ||
    msgLower.includes("aborterror") ||
    msgLower.includes("aborted")
  ) {
    return "Yêu cầu đã bị hủy hoặc gián đoạn.";
  }


  const translations: Array<[string, string]> = [
    ["shoot location is outside", "Địa điểm chụp nằm ngoài phạm vi phục vụ của nhiếp ảnh gia."],
    ["service radius", "Địa điểm đã chọn nằm ngoài phạm vi phục vụ."],
    ["photographer not found", "Không tìm thấy nhiếp ảnh gia."],
    ["photography package not found", "Không tìm thấy gói chụp ảnh."],
    ["package not found", "Không tìm thấy gói dịch vụ."],
    ["product not found", "Không tìm thấy sản phẩm hoặc sản phẩm không còn hoạt động."],
    ["payment_intent_index_required", "Đang khởi tạo chỉ mục thanh toán hệ thống, vui lòng thử lại sau giây lát."],
    ["booking_hold_expired", "Thời hạn giữ đơn đã hết hạn (tối đa 15 phút). Vui lòng thao tác đặt lại đơn mới."],
    ["booking not found", "Không tìm thấy đơn hàng."],
    ["user not found", "Không tìm thấy người dùng."],
    ["address not found", "Không tìm thấy địa chỉ."],
    ["avatar file is required", "Vui lòng chọn ảnh đại diện."],
    ["invalid availability query", "Thông tin kiểm tra lịch trống không hợp lệ."],
    ["invalid rental period", "Khoảng thời gian thuê không hợp lệ."],
    ["invalid hourly rental period", "Khung giờ thuê không hợp lệ."],
    ["start and end time are required", "Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc."],
    ["internal server error", "Hệ thống đang gặp sự cố. Vui lòng thử lại sau."],

    // Contracts V2 localized error translations
    ["contract_product_replacement_value_missing", "Trang phục trong đơn hàng chưa có Giá trị bồi hoàn được thiết lập bởi Shop. Vui lòng liên hệ Shop để cập nhật giá trị bồi hoàn trước khi tạo hợp đồng."],
    ["contract_product_replacement_value_unapproved", "Giá trị bồi hoàn của trang phục trong đơn hàng đang chờ Quản trị viên sàn phê duyệt. Vui lòng liên hệ Shop để được hỗ trợ."],
    ["provider_rental_not_active", "Tài khoản Shop chưa được kích hoạt tư cách cho thuê hoặc chưa được cấp quyền cho thuê Áo dài. Vui lòng liên hệ Quản trị viên sàn để phê duyệt hồ sơ đối tác."],
    ["provider_auto_acceptance_missing", "Nhà cung cấp chưa thực hiện chấp thuận Quy chế hợp đồng điện tử của sàn. Quý khách vui lòng chọn trang phục từ Shop khác hoặc liên hệ Shop."],
    ["provider_auto_acceptance_invalid", "Xác nhận chấp thuận Quy chế của Shop không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu Shop cập nhật lại."],
    ["provider_acceptance_stale", "Chính sách thuê của Shop hoặc Quy chế sàn vừa được cập nhật mới. Hệ thống cần làm mới hợp đồng để tiếp tục."],
    ["provider_acceptance_changed", "Cam kết quy chế của Shop vừa thay đổi. Vui lòng tải lại trang để đối chiếu phiên bản mới nhất."],
    ["provider_acceptance_already_active", "Shop đã hoàn tất chấp thuận Quy chế này trước đó và cam kết đang có hiệu lực."],
    ["contract_mechanism_not_approved", "Quy chế hoạt động sàn giao dịch hiện đang ở trạng thái bản thảo (DRAFT), chưa có hiệu lực pháp lý để ký kết."],
    ["contract_mechanism_changed", "Quy chế sàn đã có phiên bản cập nhật mới. Vui lòng tải lại trang để xem và chấp thuận văn bản mới nhất."],
    ["contract_template_not_approved", "Mẫu hợp đồng điện tử hiện chưa được phê duyệt ban hành."],
    ["contract_template_changed", "Mẫu hợp đồng điện tử đã được cập nhật phiên bản mới. Vui lòng tải lại trang."],
    ["contract_version_not_accepted", "Hợp đồng thuê chưa được khách hàng xác nhận chấp thuận. Vui lòng hoàn tất ký hợp đồng trước khi thanh toán."],
    ["contract_consent_missing", "Chưa ghi nhận sự đồng thuận ký kết hợp đồng của quý khách."],
    ["contract_content_changed", "Nội dung hoặc điều khoản hợp đồng đã có sự thay đổi. Vui lòng kiểm tra lại trước khi ký."],
    ["contract_content_stale", "Nội dung hợp đồng đã cũ so với phiên bản hiện tại. Vui lòng tải lại trang."],
    ["contract_version_stale", "Phiên bản hợp đồng đã thay đổi. Vui lòng xem lại các điều khoản mới."],
    ["contract_version_expired", "Phiên bản hợp đồng đã hết hiệu lực. Vui lòng tải lại trang."],
    ["contract_version_not_offered", "Hợp đồng đang được hệ thống tạo mới. Vui lòng thử lại sau giây lát."],
    ["contract_snapshot_stale", "Thông tin đơn hàng hoặc chính sách giá đã thay đổi. Vui lòng tải lại trang đặt đơn."],
    ["contract_binding_stale", "Phiên bản hợp đồng gắn với giao dịch thanh toán không còn khớp. Vui lòng kiểm tra lại."],
    ["contract_booking_not_found", "Không tìm thấy thông tin đơn đặt lịch gắn với hợp đồng này."],
    ["contract_not_found", "Không tìm thấy hợp đồng điện tử tương ứng."],
    ["contracts_v2_disabled", "Tính năng Hợp đồng điện tử tạm thời đang được bảo trì."],
    ["policy_pending_review_locked", "Chính sách đang trong quá trình chờ Quản trị viên duyệt. Không thể chỉnh sửa trong thời gian này."],
    ["policy_not_pending_review", "Yêu cầu chính sách này không ở trạng thái chờ duyệt hoặc đã được xử lý."],
    ["review_note_required", "Bắt buộc cung cấp lý do từ chối để Shop đối tác nắm thông tin điều chỉnh."],
    ["admin_role_required", "Chỉ Quản trị viên sàn mới có quyền thực hiện thao tác này."],
    ["provider_role_required", "Thao tác này chỉ dành cho tài khoản Nhà cung cấp (Shop đối tác)."],
    ["provider_not_found", "Không tìm thấy hồ sơ đối tác của tài khoản này."],
    ["guardrail_cancellation_rules_empty", "Cần thiết lập ít nhất 1 mốc hoàn tiền cho chính sách hủy đơn."],
    ["guardrail_custom_terms_too_long", "Điều khoản tùy chỉnh tối đa 1000 ký tự."],
    ["missing_damage_compensation_policy", "Chính sách bồi thường hư hỏng chưa được thiết lập đầy đủ."],
    ["incomplete_tier_compensation", "Cần hoàn tất thiết lập phương thức bồi thường cho tất cả các cấp độ sự cố."],
    ["invalid_tier_fixed_fee", "Mức phí cố định bồi thường phải là số tiền hợp lệ (lớn hơn hoặc bằng 0)."],
    ["invalid_tier_percentage", "Tỷ lệ phần trăm bồi thường phải từ 1% đến 100%."],
    ["missing_tier_evidence_conditions", "Cần nêu rõ căn cứ và chứng từ xác minh cho cấp độ hư hại tương ứng."],
    ["payment_amount_invalid", "Số tiền thanh toán không hợp lệ."],
    ["rental_items_missing", "Đơn hàng không có sản phẩm thuê áo dài hợp lệ."],
  ];
  if (msgLower.includes("technical_validation_error:")) {
    return message.replace(/^technical_validation_error:\s*/i, "");
  }
  const matched = translations.find(([english]) => msgLower.includes(english));
  return matched ? matched[1] : message;
};
