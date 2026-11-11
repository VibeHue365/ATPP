# VIBEHUE — CHECKOUT RESULT FRONTEND FIX & VERIFICATION (P0)

**Date**: 2026-11-03  
**Files Modified**:  
- [`frontend/src/pages/checkout/CheckoutResultPage.tsx`](file:///d:/gameeee/KI8/DOAN/Vibehue/frontend/src/pages/checkout/CheckoutResultPage.tsx)  
- [`frontend/src/pages/checkout/CheckoutResultPage.css`](file:///d:/gameeee/KI8/DOAN/Vibehue/frontend/src/pages/checkout/CheckoutResultPage.css)  
**Tests Updated**: [`frontend/tests/checkout-result-page.test.tsx`](file:///d:/gameeee/KI8/DOAN/Vibehue/frontend/tests/checkout-result-page.test.tsx)  
**Vitest Test Result**: 9/9 PASSED (100%)  
**TypeScript Check**: PASS (`tsc --noEmit` exited 0)  

---

## 1. Ma trận xử lý trạng thái mới (Terminal States Matrix)

| Trạng thái UI | Điều kiện kích hoạt từ Backend | Biểu tượng (Icon) | Eyebrow & Tiêu đề | Thông điệp người dùng chuẩn hóa | Hành động (Actions) |
|---|---|---|---|---|---|
| **SUCCESS** | `paymentStatus === 'SUCCESS' && confirmed === true && !needsManualReview && bookingStatus !== 'CANCELLED'` | `CheckCircle2` (Xanh lá) | `GIAO DỊCH HOÀN TẤT`<br/>**Thanh toán thành công!** | Đơn hàng đã được xác nhận và sẵn sàng trong tài khoản của bạn. | • Xem đơn hàng (`ROUTES.PROFILE`)<br/>• Về trang chủ |
| **REVIEW_REQUIRED** | `paymentStatus === 'SUCCESS'` kèm bất kỳ điều kiện nào sau: `!confirmed`, `needsManualReview === true`, hoặc `bookingStatus === 'CANCELLED'` | `ShieldCheck` (Hổ phách) | `ĐÃ GHI NHẬN THANH TOÁN`<br/>**Giao dịch đang được xác thực** | Giao dịch thanh toán đã được ghi nhận trên hệ thống nhưng đơn hàng đang chờ xác thực bảo mật trước khi kích hoạt. **Vui lòng không thực hiện thanh toán lại để tránh phát sinh giao dịch trùng lặp.** | • Kiểm tra lại (1 lần)<br/>• Xem đơn hàng (`ROUTES.PROFILE`)<br/>• Về trang chủ<br/>*(ẨN nút Quay lại giỏ hàng để bảo vệ khách không bị trừ tiền 2 lần)* |
| **TIMEOUT** | Hết 30 lần polling (60s) mà chưa nhận được trạng thái cuối | `Clock3` (Vàng sẫm) | `QUÁ THỜI GIAN PHẢN HỒI`<br/>**Chưa có kết quả giao dịch** | Hệ thống chưa nhận được phản hồi xác nhận từ cổng thanh toán sau thời gian chờ. **Vui lòng không thực hiện thanh toán lại lúc này để tránh phát sinh giao dịch trùng lặp.** Bạn có thể kiểm tra lại sau giây lát, xem lịch sử đơn hàng hoặc liên hệ bộ phận hỗ trợ. | • Kiểm tra lại (1 lần có spinner trên nút)<br/>• Xem đơn hàng (`ROUTES.PROFILE`)<br/>• Về trang chủ |
| **FAILED** | `paymentStatus === 'FAILED'` | `XCircle` (Đỏ) | `GIAO DỊCH THẤT BẠI`<br/>**Thanh toán không thành công** | Giao dịch thanh toán chưa thành công. Các sản phẩm vẫn được giữ nguyên trong giỏ hàng. | • Quay lại giỏ hàng (`ROUTES.CART`)<br/>• Về trang chủ |
| **CANCELLED** | `(paymentStatus === 'CANCELLED' \|\| bookingStatus === 'CANCELLED')` VÀ `paymentStatus !== 'SUCCESS'` | `XCircle` (Đỏ) | `GIAO DỊCH ĐÃ HỦY`<br/>**Đơn hàng đã được hủy** | Giao dịch đã được hủy. Các sản phẩm vẫn được lưu trong giỏ hàng để bạn có thể tiếp tục bất cứ lúc nào. | • Quay lại giỏ hàng (`ROUTES.CART`)<br/>• Về trang chủ |
| **PENDING** | Đang trong 30 lần polling đầu tiên | `LoaderCircle` (Xoay vàng) | `ĐANG XỬ LÝ GIAO DỊCH`<br/>**Vui lòng chờ trong giây lát** | Hệ thống đang xác minh giao dịch của bạn. Quá trình này chỉ mất ít phút. | • Kiểm tra lại (1 lần)<br/>• Về trang chủ |
| **ERROR** | Lỗi mạng / Backend 5xx / 4xx | `XCircle` (Đỏ) | `SỰ CỐ KẾT NỐI`<br/>**Có lỗi xảy ra** | Chưa thể kiểm tra giao dịch lúc này do sự cố kết nối. | • Kiểm tra lại (1 lần)<br/>• Về trang chủ |

---

## 2. Các quy tắc an toàn đã được xác minh

1. **Thông điệp TIMEOUT trung thực (Honest Timeout)**:
   - Tuyệt đối **không khẳng định "số tiền đã được an toàn"** khi chưa có dữ liệu xác minh.
   - Tuyệt đối **không mặc định giao dịch thất bại**.
   - Cảnh báo rõ ràng: Không thực hiện thanh toán lại khi kết quả chưa rõ để tránh trừ tiền 2 lần.
   - Cung cấp mã giao dịch tham chiếu, nút "Xem đơn hàng" và đường dẫn hỗ trợ.
2. **Ưu tiên tuyệt đối cho `needsManualReview`**:
   - Khi `needsManualReview === true`, ngay cả khi `confirmed === true`, hệ thống vẫn bắt buộc hiển thị `REVIEW_REQUIRED`, không cho phép chuyển sang `SUCCESS` hoàn tất.
3. **Chặn thanh toán lại khi booking `CANCELLED` mà payment đã `SUCCESS`**:
   - Nếu booking đã bị hủy nhưng tiền đã được nạp/ghi nhận (`paymentStatus === 'SUCCESS'`), hệ thống **chuyển thẳng vào `REVIEW_REQUIRED`**, ẩn nút giỏ hàng và chuyển sang kênh đối soát, tuyệt đối không đưa khách về luồng trả tiền lại.
4. **Bảo toàn giỏ hàng, chỉ dọn khi đủ điều kiện thành công 100%**:
   - `clearPendingCart()` **chỉ được gọi duy nhất** khi: `paymentStatus === 'SUCCESS' && confirmed === true && !needsManualReview && bookingStatus !== 'CANCELLED'`.
   - Trong trạng thái `REVIEW_REQUIRED` hoặc `TIMEOUT`, dữ liệu giỏ hàng không bị xóa vội vã.
5. **Nút "Kiểm tra lại" không sinh Polling vô hạn**:
   - Bấm nút chỉ gửi **1 request kiểm tra duy nhất**; hiển thị spinner con trên nút (`isChecking: true`), không lặp lại `setTimeout` 30 lần.

---

## 3. Bằng chứng kiểm thử Vitest UI (9 Tests)

Tập test suite: [`frontend/tests/checkout-result-page.test.tsx`](file:///d:/gameeee/KI8/DOAN/Vibehue/frontend/tests/checkout-result-page.test.tsx)
```bash
 RUN  v5.0.5 D:/gameeee/KI8/DOAN/Vibehue/frontend

 ✓ tests/checkout-result-page.test.tsx (9 tests) 151ms
   ✓ P0: CheckoutResultPage Terminal States & Anti-Stuck Verification (9)
     ✓ 1. SUCCESS + Confirmed Booking (clean, no review flag): Clears cart and provides view order link
     ✓ 2. REVIEW_REQUIRED (SUCCESS captured but unconfirmed booking): Stops spinner, does NOT clear cart, warns against duplicate payment
     ✓ 3. REVIEW_REQUIRED priority: When needsManualReview=true, even if confirmed=true, stays in REVIEW_REQUIRED
     ✓ 4. Payment SUCCESS but booking CANCELLED: Routes to REVIEW_REQUIRED, NOT to retry payment
     ✓ 5. FAILED payment: Shows failure message and provides Return to Cart link
     ✓ 6. CANCELLED booking with PENDING payment: Shows cancelled message and provides Return to Cart link
     ✓ 7. Polling Exhaustion / TIMEOUT: Does NOT claim money is safe, warns against double payment, stops spinner
     ✓ 8. Controlled "Kiểm tra lại" button: Performs a single verification without launching infinite 30-poll loop
     ✓ 9. Network / Server Error: Displays connection issue with single retry button

 Test Files  1 passed (1)
      Tests  9 passed (9)
```
