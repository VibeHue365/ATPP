# Đối chiếu luồng khách hàng mobile với frontend web

Ngày rà soát: 08/09/2026. Phạm vi chỉ gồm khách hàng; không gồm admin và provider. Backend chỉ được đọc để xác nhận hợp đồng API và không có file backend nào được chỉnh sửa.

## Đã có trên mobile

- Tài khoản: đăng ký, đăng nhập email/mật khẩu, xác minh email, quên và đặt lại mật khẩu, đổi mật khẩu, tự làm mới phiên.
- Khám phá: trang chủ, danh sách/tìm kiếm/lọc áo dài, danh sách/tìm kiếm/lọc photographer.
- Chi tiết dịch vụ: gallery, đánh giá, yêu thích, chọn biến thể và thời gian, kiểm tra tồn kho/lịch trống, báo giá gói chụp và add-on.
- Mua dịch vụ: giỏ hàng, địa chỉ nhận áo, mã ưu đãi hợp lệ, tạo hold, thanh toán trong WebView, xác minh trạng thái thanh toán và các màn hình thành công/thất bại/hết hạn.
- Đơn hàng và lịch: danh sách, lọc/tìm kiếm, chi tiết rental/photography/combo, tiến trình, giao nhận, ảnh bàn giao, xác nhận nhận áo, xác nhận hoàn tất.
- Hậu mãi: hủy đơn; hiển thị kết quả hoàn/phạt; số tiền đã hoàn; kiểm tra điều kiện, gửi và theo dõi yêu cầu hoàn tiền; đổi ngày thuê/lịch chụp; yêu cầu đổi địa điểm chụp.
- Tài khoản: sửa hồ sơ/avatar, CRUD địa chỉ và địa chỉ mặc định, sở thích cá nhân/số đo, yêu thích, thông báo, đánh giá và đăng xuất.
- Danh sách dài: áo dài và gói chụp dùng phân trang API; lịch hẹn, yêu thích, thông báo, đánh giá và lịch sử thanh toán có tìm kiếm/lọc/phân trang phía mobile theo giới hạn API hiện tại.

## Đã bổ sung trong đợt rà soát này

- Panel hoàn tiền dùng `GET /refunds/bookings/:id/eligibility`, `GET /refunds/mine`, `POST /refunds/bookings/:id` và idempotency key.
- Kết quả hủy đọc `isFreeCancel`, `refundAmount`, `penaltyReason` thay vì chỉ báo hủy chung chung.
- Đổi lịch từng mục dịch vụ bằng `PATCH /api/bookings/:id/reschedule`; lịch chụp kiểm tra availability và busy slots trước khi gửi.
- Đổi địa điểm của photoshoot schedule bằng endpoint location-change-request hiện có.
- Màn hình sở thích cá nhân đồng bộ qua `/users/me/preferences`.
- Báo lỗi nhẹ hoặc từ chối nhận áo kèm tối đa 5 ảnh; xem và đồng ý/từ chối yêu cầu bồi thường của cửa hàng qua API incident.
- Lịch sử thanh toán/hoàn tiền riêng, có tìm kiếm, lọc, sắp xếp và phân trang.
- Danh sách hội thoại hiện có và màn nhắn tin customer với shop/photographer bằng API thật; tự đồng bộ định kỳ khi dùng Expo Go.

## Có trên web nhưng chủ động chưa đưa vào mobile MVP

- Combo promotion listing/detail riêng: API có thật nhưng luồng chi tiết dài và checkout combo còn vướng hợp đồng promo code đã ghi trong `BACKEND_NOTES.md`. Mobile vẫn xử lý được đơn kết hợp khi giỏ có áo dài và gói chụp.
- Trang cửa hàng provider: nội dung phần lớn trùng danh sách/chi tiết sản phẩm; chưa cần cho luồng đặt dịch vụ cốt lõi.
- Tạo hội thoại mới và upload ảnh chat: cần kiểm tra định danh `Provider.userId` trong public DTO trước khi bật điểm vào từ cửa hàng/photographer. Các phòng chat đã có vẫn đọc và gửi text được.
- Virtual Try-on 3D: loại khỏi phạm vi mobile customer. Trang web hiện phụ thuộc API Kaggle/Cloudflare do người dùng tự cấu hình và trình xem GLB; đây là công cụ thử nghiệm ngoài backend nghiệp vụ chính và không ảnh hưởng luồng đặt dịch vụ.
- Membership, chi tiêu năm và ưu đãi cá nhân ở Settings: frontend web đang suy ra hoặc dùng dữ liệu trình diễn; không có API riêng đáng tin để đồng bộ.
- Cấu hình email/SMS/promotion notification: web mới chỉ đổi state cục bộ và hiện toast, chưa lưu API nên không dựng một màn hình giả trên mobile.

## Còn bị giới hạn bởi backend

- Google OAuth native, app link đặt lại mật khẩu, lịch sử/chỉnh sửa đánh giá của chính khách hàng, khiếu nại buổi chụp và promo code cho checkout có gói chụp: xem `BACKEND_NOTES.md`.
- Luồng “Đã đánh giá” trên mobile hiện chỉ suy ra cờ `isReviewed` của booking item, chưa tải được nội dung/rating đã gửi.

## Chức năng customer có API thật nhưng mobile chưa triển khai

- Khiếu nại buổi chụp như photographer vắng mặt, đến trễ, thái độ hoặc chất lượng ảnh; frontend web có giao diện nhưng API hiện từ chối quyền customer nên chưa thể triển khai đúng.
- Tạo phòng chat mới từ trang dịch vụ và gửi ảnh trong chat.
- Danh sách/chi tiết combo promotion riêng và trang gian hàng provider.

## Thứ tự đề xuất sau MVP

1. UAT các thao tác hậu mãi mới bằng booking thật ở các trạng thái phù hợp.
2. Xác nhận thay đổi API cho khiếu nại buổi chụp vì endpoint web hiện không cấp quyền customer.
3. Xác nhận public provider DTO trả `userId`, sau đó bật tạo hội thoại từ trang dịch vụ và bổ sung upload ảnh/realtime Socket.IO.
4. Làm combo listing/detail; promo code có thể tiếp tục bị khóa riêng trong checkout cho đến khi backend thống nhất hợp đồng.
5. Trang provider store vẫn là customer-facing nhưng chỉ nên làm sau combo/chat vì ít ảnh hưởng luồng đặt dịch vụ cốt lõi; Virtual Try-on 3D đã loại khỏi phạm vi.
