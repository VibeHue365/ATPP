# Ghi chú backend dành cho mobile

Code mobile không được phép chỉnh sửa backend. Mọi vấn đề bị giới hạn bởi backend phải được ghi lại tại đây và xác nhận với chủ dự án trước khi thực hiện bất kỳ thay đổi nào ở backend.

## Đăng nhập Google OAuth

- Trạng thái: tạm hoãn.
- Callback hiện tại của backend chuyển hướng tới `FRONTEND_URL/oauth/callback`.
- Mobile cần một địa chỉ chuyển hướng dành cho ứng dụng native hoặc một endpoint cho phép đổi Google ID token lấy phiên đăng nhập.
- Đăng nhập bằng email và mật khẩu vẫn hoạt động mà không cần thay đổi phần này.

## Các phần đã xác nhận tương thích

- Trình mô phỏng thanh toán đã chuyển hướng tới `vibehue://payment/success` và `vibehue://payment/cancel` cho development build và production build.
- Đã giải quyết ở phía mobile mà không cần sửa backend: bản native và Expo Go mở trang thanh toán trong `react-native-webview`, chặn callback `vibehue://payment/...`, sau đó xác minh trạng thái cuối cùng qua `/payments/:code/status`. Ứng dụng không coi URL callback là bằng chứng thanh toán thành công.
- React Native Web vẫn mở liên kết thanh toán bên ngoài, đồng thời lưu mã thanh toán và cung cấp màn hình polling cùng nút **Kiểm tra lại** để khôi phục trạng thái.
- Các đường dẫn media tương đối dạng `/uploads/...` có thể được ghép với `EXPO_PUBLIC_API_URL`.

## Mã khuyến mãi trong checkout kết hợp

- Trạng thái: tạm hoãn; mobile khóa trường nhập mã ưu đãi khi checkout có gói chụp ảnh.
- `CreatePhotographyComboHoldDto` không chấp nhận `promoCode`, trong khi thiết kế checkout có trường mã ưu đãi cho đơn kết hợp gói chụp ảnh và áo dài.
- Cần xác nhận bên nào chịu trách nhiệm sở hữu và tính toán giảm giá trước khi thay đổi hợp đồng backend.

## Lịch sử đánh giá của khách hàng

- Trạng thái: tạm hoãn; mobile hiện suy ra trạng thái chờ đánh giá/đã đánh giá từ các dịch vụ trong đơn hàng đã hoàn tất.
- Backend cho phép tạo đánh giá và truy vấn đánh giá theo provider hoặc dịch vụ, nhưng chưa có endpoint dành cho khách hàng để lấy danh sách đánh giá do chính tài khoản đang đăng nhập gửi, kèm thông tin đơn hàng và dịch vụ.
- Cần bổ sung endpoint chỉ đọc dành cho lịch sử đánh giá của khách hàng trước khi bật đầy đủ kho lưu trữ **Đã đánh giá** và chức năng chỉnh sửa đánh giá.

## Khiếu nại buổi chụp của khách hàng

- Trạng thái: tạm hoãn; không gọi endpoint sai quyền từ mobile.
- Frontend web gửi `PATCH /bookings/:id/status` với trạng thái `DISPUTED`, ghi chú và ảnh bằng chứng.
- Backend hiện kiểm tra endpoint cập nhật trạng thái và chỉ cho provider của booking hoặc admin thực hiện; customer sẽ nhận lỗi `403`.
- Cần tạo endpoint customer riêng cho khiếu nại buổi chụp, hoặc cho phép customer chuyển đúng các trạng thái photography hợp lệ sang `DISPUTED` với kiểm tra thời gian/quyền sở hữu booking.

## Phân trang dữ liệu tài khoản

- `GET /api/bookings`, `GET /notifications` và `GET /payments/history` hiện trả toàn bộ mảng, không nhận `page`, `limit`, search hoặc sort.
- Mobile đang phân trang, tìm kiếm và sắp xếp phía ứng dụng để tránh màn hình quá dài. Khi dữ liệu lớn, backend nên hỗ trợ server-side pagination để không tải toàn bộ lịch sử mỗi lần.

## Chat customer

- Mobile đã hỗ trợ mở các phòng chat hiện có, đọc và gửi tin nhắn qua API thật.
- Chưa bật tạo cuộc trò chuyện từ danh sách photographer vì payload public không đảm bảo trả `userId`; dùng `_id` provider thay cho user id có thể tạo sai phòng hoặc trả lỗi.
- `GET /chat/rooms/:roomId/messages` hiện chưa truyền user hiện tại vào service để kiểm tra người gọi có thuộc phòng hay không. Nên bổ sung kiểm tra thành viên phòng trước khi phát hành production.

## Liên kết đặt lại mật khẩu trên mobile

- Trạng thái: tạm hoãn; màn hình đặt lại mật khẩu trên mobile nhận tham số truy vấn `token` và cũng cho phép nhập token thủ công.
- Email đặt lại mật khẩu hiện sử dụng `FRONTEND_URL/auth/reset-password`, vì vậy liên kết sẽ mở frontend web thay vì scheme `vibehue://` của mobile.
- Cần xác nhận có sử dụng universal link/app link trong email đặt lại mật khẩu hay không trước khi chỉnh sửa cấu hình gửi email của backend.

## Tài khoản kiểm thử mobile có xác thực

- Trạng thái: đã hoàn thành ngày 06/09/2026 bằng tài khoản customer đã xác minh do chủ dự án cung cấp.
- Đã kiểm tra các luồng: đăng nhập, hồ sơ, yêu thích, thông báo, đánh giá, danh sách đơn hàng, chi tiết đơn hàng, giỏ thuê áo dài, checkout, thanh toán mô phỏng thành công, dọn giỏ hàng và xem chi tiết đơn hàng vừa tạo.
- Thông tin đăng nhập không được lưu trong repository.
