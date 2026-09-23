# Phase 11 handoff

## Phạm vi bàn giao

- React Native + Expo SDK 57 + Expo Router + TypeScript.
- Chỉ có luồng customer; không có admin/provider.
- UI theo Figma, API và nghiệp vụ tham chiếu frontend web.
- Không thay đổi source backend.

## Đối chiếu bản Flutter backup

| Vấn đề | Cách làm trong Flutter cũ | Kết luận cho React Native |
| --- | --- | --- |
| Google OAuth | Nút chỉ báo “đang phát triển” | Không có giải pháp để chuyển; tiếp tục deferred. |
| Callback thanh toán | Mở PayOS bằng WebView và chặn `vibehue://payment/success|cancel` | Đã áp dụng. React Native luôn hỏi API để xác nhận trạng thái, an toàn hơn việc tin URL. |
| Voucher cho combo | Flutter validate voucher phía client nhưng gửi field không thống nhất (`promoCode`/`voucherCode`) | Không áp dụng; chưa giải quyết DTO combo hiện tại. |
| Lịch sử đánh giá customer | Suy luận từ booking và tải review theo từng item/customer name | Không áp dụng vì N+1 request và đối chiếu tên không đáng tin cậy; giữ trạng thái từ booking cho đến khi có endpoint customer. |
| Reset mật khẩu | Service cũ dùng `email + code`, UI chỉ hướng người dùng liên hệ hỗ trợ | Không áp dụng; contract hiện tại là `token + newPassword`, vẫn cần app/universal link từ email. |

## Kiểm tra trước bàn giao

```bash
npm run typecheck
npx expo install --check
npx expo export --platform android
```

UAT customer đã hoàn tất với backend local: đăng nhập, hồ sơ, yêu thích, thông báo, đánh giá, đơn hàng, chi tiết đơn, giỏ hàng, checkout, thanh toán mô phỏng và kiểm tra đơn mới.

Các hạn chế cần backend được lưu tại `BACKEND_NOTES.md`. Không lưu tài khoản hoặc mật khẩu test trong repository.
