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

  return message;
};
