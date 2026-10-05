# Ghi chú backend dành cho mobile

Code mobile không được phép chỉnh sửa backend. Mọi vấn đề bị giới hạn bởi backend phải được ghi lại tại đây và xác nhận với chủ dự án trước khi thực hiện bất kỳ thay đổi nào ở backend.

## Đăng nhập Google OAuth

- Trạng thái: tạm hoãn.
- Backend hiện có `POST /auth/oauth/exchange` để đổi authorization code một lần thành phiên đăng nhập, nhưng callback Google vẫn luôn chuyển hướng tới `FRONTEND_URL/oauth/callback`.
- Mobile không thể nhận authorization code bằng Expo deep link vì backend không nhận `redirectUri`/platform trong OAuth state. Cũng không dùng WebView nhúng cho Google OAuth vì không phù hợp chính sách OAuth của Google.
- Cần callback/universal link dành cho ứng dụng native, hoặc endpoint cho phép đổi Google ID token lấy phiên đăng nhập, trước khi bật nút Google trên mobile.
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

## Giá combo promotion chưa được nối với combo hold

- Trạng thái: mobile đã hoàn thành danh sách, chi tiết, chọn dịch vụ, giỏ hàng và checkout combo bằng API thật; chưa sửa backend.
- `GET /combo-promotions/public` và `GET /combo-promotions/:id` công bố `discountPercent`/`comboPrice`, nhưng `CreatePhotographyComboHoldDto` không nhận `comboPromotionId`.
- `PhotographyHoldService.createComboHold` hiện luôn giảm cố định 10% cho phần phí thuê và chụp, không đọc promotion đã chọn và cũng không tăng `usedCount` của promotion.
- Mobile hiển thị giá promotion là “giá công bố”, đồng thời dùng mức 10% khi dự tính checkout để khớp cách backend đang tạo booking. Cần nối promotion vào hold và tính giá phía server trước khi có thể cam kết mọi mức giảm do provider công bố.

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
- Trang gian hàng đã bật tạo cuộc trò chuyện vì `GET /products/store-info/:providerId` trả `userId`; mobile chỉ gọi `POST /chat/rooms` khi trường này tồn tại và không dùng `_id` provider thay thế.
- Trang chi tiết photographer đã bật tạo cuộc trò chuyện vì `GET /api/photographers/:id` có trả `userId`; payload discovery dạng danh sách không có trường này nên mobile luôn tải detail trước khi mở chat.
- Đã hỗ trợ chọn ảnh, tải qua `POST /chat/upload`, gửi URL trong `attachments` và hiển thị ảnh trong hội thoại giống frontend web.
- Mobile đã kết nối Socket.IO bằng JWT, dùng `join_room`, `send_message`, `mark_read`, `new_message`, `room_update`, `messages_read`, tự reconnect và quay về REST polling mỗi 5 giây khi mất socket. Handshake `authenticated` và `ping/pong` đã được kiểm tra thành công trên backend local.
- `GET /chat/rooms/:roomId/messages`, `POST /chat/rooms/:roomId/messages`, socket `join_room`, `send_message` và `mark_read` hiện chưa kiểm tra người gọi có thuộc phòng hay không. Người dùng đã đăng nhập nếu biết `roomId` có thể đọc, ghi hoặc tham gia sai hội thoại; cần kiểm tra participant trong cả controller, service và gateway để bảo vệ dữ liệu web/mobile.
- Tài khoản customer kiểm thử hiện chưa có phòng chat nên chưa gửi tin nhắn thử hai đầu với provider web, nhằm tránh tự tạo phòng/tin nhắn rác. Cần UAT bằng customer và provider thật trong giai đoạn kiểm thử tổng thể.

## Báo cáo đánh giá không phù hợp

- Mobile customer đã dùng endpoint thật `POST /reviews/:id/report`, giống phần provider trên web; không dùng dữ liệu giả.
- Endpoint xác thực JWT nhưng không truyền `CurrentUser` vào service, không lưu người báo cáo và không kiểm tra báo cáo trùng hoặc người dùng báo cáo đánh giá của chính mình. Mobile ẩn nút trên đánh giá của tài khoản hiện tại khi payload có author id và khóa nút sau khi gửi trong phiên, nhưng backend vẫn cần ràng buộc để bảo vệ dữ liệu cho mọi client.

## Liên kết đặt lại mật khẩu trên mobile

- Trạng thái: tạm hoãn; màn hình đặt lại mật khẩu trên mobile nhận tham số truy vấn `token` và cũng cho phép nhập token thủ công.
- Email đặt lại mật khẩu hiện sử dụng `FRONTEND_URL/auth/reset-password`, vì vậy liên kết sẽ mở frontend web thay vì scheme `vibehue://` của mobile.
- Cần xác nhận có sử dụng universal link/app link trong email đặt lại mật khẩu hay không trước khi chỉnh sửa cấu hình gửi email của backend.

## Trợ lý AI customer

- Mobile đã nối đúng hai endpoint web đang dùng: `POST /ai/chat` và `POST /ai/chat/with-image`; không sử dụng dữ liệu tư vấn hoặc sản phẩm giả.
- Đăng nhập backend local hoạt động, FastAPI ở cổng `8000` cũng phản hồi health check, nhưng thử gọi `/ai/chat` qua backend không hoàn tất trong 15–30 giây khi bước xử lý Gemini bị chậm hoặc không phản hồi.
- `AiService` trong backend gọi `fetch` tới FastAPI mà chưa có `AbortSignal.timeout` hoặc timeout tương đương. Vì vậy nhánh `offlineFallback` không được kích hoạt nếu kết nối vẫn mở nhưng không trả dữ liệu, đồng thời request mobile hết timeout sau 30 giây.
- Nên đặt timeout rõ ràng cho lời gọi FastAPI/Gemini, hủy request khi quá hạn và trả fallback hoặc lỗi có kiểm soát. Chưa chỉnh sửa backend trong phạm vi mobile.

## Tài khoản kiểm thử mobile có xác thực

- Trạng thái: đã hoàn thành ngày 06/09/2026 bằng tài khoản customer đã xác minh do chủ dự án cung cấp.
- Đã kiểm tra các luồng: đăng nhập, hồ sơ, yêu thích, thông báo, đánh giá, danh sách đơn hàng, chi tiết đơn hàng, giỏ thuê áo dài, checkout, thanh toán mô phỏng thành công, dọn giỏ hàng và xem chi tiết đơn hàng vừa tạo.
- Thông tin đăng nhập không được lưu trong repository.
