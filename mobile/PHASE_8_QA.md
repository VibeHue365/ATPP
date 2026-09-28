# Giai đoạn 8 — Kiểm thử tổng thể mobile customer

Ngày kiểm tra: 28/09/2026. Phạm vi chỉ gồm React Native customer; không chỉnh sửa backend, frontend web, admin hoặc provider.

## Kết quả tự động

- `npm run typecheck`: đạt.
- `npx expo install --check`: đạt sau khi đồng bộ các bản vá tương thích Expo SDK 57.
- `npx expo export --platform android`: đạt, Metro đóng gói 1.478 module.
- `git diff --check`: đạt; chỉ có cảnh báo chuyển LF sang CRLF của Git trên Windows.
- Socket.IO customer: đăng nhập JWT, sự kiện `authenticated` và `ping/pong` đạt trên backend local.
- Search/sort/pagination API: sản phẩm và photographer đều đạt, gồm trường hợp kết quả rỗng.

## API customer đã kiểm tra chỉ đọc

| Nhóm | Kết quả |
| --- | --- |
| Hồ sơ, sở thích | Đạt |
| Áo dài, cá nhân hóa, nổi bật, chi tiết | Đạt — 4 sản phẩm |
| Photographer, chi tiết, đánh giá | Đạt — 7 photographer |
| Gian hàng provider | Đạt |
| Booking và chi tiết | Đạt — 3 booking, gồm `CONFIRMED`, `RETURNED`, `DISPUTED` |
| Thông báo | Đạt — 9 mục |
| Thanh toán và pending checkout | Đạt — 4 giao dịch, không có checkout đang chờ |
| Hoàn tiền và eligibility | Đạt — 2 yêu cầu, endpoint eligibility phản hồi hợp lệ |
| Chat rooms | Đạt — tài khoản hiện chưa có phòng chat |
| Combo promotion public | Endpoint đạt nhưng hiện trả 0 mục |

Không tự tạo booking, thanh toán, báo cáo đánh giá, phòng chat hoặc tin nhắn mới trong QA để tránh dữ liệu rác. Các luồng ghi dữ liệu đã được UAT ở Phase 11 trước đó hoặc cần kiểm thử có chủ đích bằng hai tài khoản customer/provider.

## Phần cần UAT thủ công

- BlueStacks đang cài Expo Go nhưng cấu hình `bst.enable_adb_access="0"`; phiên kiểm thử không tự thay đổi cài đặt hệ thống này.
- Metro đang phục vụ tại `exp://192.168.1.61:8081`. Cần mở liên kết này trong Expo Go để kiểm tra hình ảnh, thao tác cuộn, bàn phím, picker ảnh và WebView thanh toán.
- Chat hai đầu cần một provider đăng nhập web và một phòng hợp lệ để xác nhận `new_message`, `room_update` và `messages_read`; handshake socket customer đã đạt.
- AI chatbot cần backend đặt timeout cho FastAPI/Gemini trước khi có thể UAT ổn định.

## Cảnh báo dependency

`npm audit` còn 14 cảnh báo mức moderate nằm trong chuỗi phụ thuộc Expo Router/Expo CLI. Công cụ chỉ đề xuất `npm audit fix --force`, nhưng thao tác đó sẽ hạ Expo hoặc Expo Router sang phiên bản breaking nên không áp dụng. Các package hiện đã đúng ma trận tương thích SDK 57.

## Giới hạn backend

Chi tiết được lưu trong `BACKEND_NOTES.md`, gồm Google OAuth callback cho native, quyền participant của chat REST/Socket.IO, định danh người báo cáo review, timeout AI, lịch sử review customer và hợp đồng giá combo promotion.

Không commit hoặc push trong quá trình kiểm thử.
